/* Line upon Line — a gospel-learning game for the NovelTie arcade.
   All content lives in data.js (window.LUL); quotations there were fetched verbatim from churchofjesuschrist.org. */
(function () {
  "use strict";
  var D = window.LUL;
  var app = document.getElementById("app");
  var KEY = "lul-v1";
  var DAY = 864e5, MIN = 6e4;
  var INT = [0, 1, 3, 7, 16, 35]; // days per box (box 0 = 10 minutes)

  /* ---------- state ---------- */
  var st = { v: 1, streak: 0, lastDone: "", daily: { date: "", step: 0, res: [] }, dc: {}, dm: {}, journal: [], best: { trivia: 0, hist: 0 }, quick: false, dmTab: "Book of Mormon" };
  try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); for (var k in st) { if (o[k] !== undefined) st[k] = o[k]; } } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  /* ---------- utils ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function today() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { var d = new Date(Date.now() - 6 * 36e5); return d.toISOString().slice(0, 10); }
  }
  function dayShift(ds, n) { var d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var R = rng(hashStr(String(Date.now())));
  function shuffle(arr, r) { r = r || R; var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(arr, r) { r = r || R; return arr[Math.floor(r() * arr.length)]; }
  var toastT;
  function toast(msg) { var t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.style.display = "block"; clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = "none"; }, 2200); }
  function schedule(rec, pass) { rec.box = pass ? Math.min((rec.box || 0) + 1, 5) : 0; rec.due = Date.now() + (rec.box === 0 ? 10 * MIN : INT[rec.box] * DAY); rec.seen = (rec.seen || 0) + 1; }

  /* ---------- text grading ---------- */
  function norm(s) { return String(s).toLowerCase().replace(/[\u2019\u2018`]/g, "'").replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).map(function (w) { return w.replace(/^'+|'+$/g, "").replace(/'s$/, ""); }).filter(Boolean); }
  var SUF = ["ings", "ing", "edly", "ed", "es", "s", "ly", "ness", "ment"];
  function stem(w) { if (w.length > 4) { for (var i = 0; i < SUF.length; i++) { var s = SUF[i]; if (w.length - s.length >= 3 && w.slice(-s.length) === s) return w.slice(0, -s.length); } } return w; }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = []; for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) { var cur = [i], best = i; for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; } if (best > max) return max + 1; prev = cur; }
    return prev[b.length];
  }
  function tokEq(a, b) {
    if (a === b) return true;
    var sa = stem(a), sb = stem(b); if (sa === sb) return true;
    var L = Math.min(sa.length, sb.length), tol = L >= 8 ? 2 : (L >= 5 ? 1 : 0);
    return tol > 0 && lev(sa, sb, tol) <= tol;
  }
  function kwMatch(toks, kw) {
    var kt = norm(kw); if (!kt.length) return false;
    if (kt.length === 1) { var k = kt[0]; for (var i = 0; i < toks.length; i++) { if (tokEq(toks[i], k) || (k.length >= 4 && toks[i].indexOf(k) === 0)) return true; } return false; }
    for (i = 0; i < toks.length; i++) {
      if (!tokEq(toks[i], kt[0])) continue;
      var p = i, ok = true;
      for (var m = 1; m < kt.length && ok; m++) { ok = false; for (var g = p + 1; g <= p + 3 && g < toks.length; g++) { if (tokEq(toks[g], kt[m]) || (kt[m].length >= 5 && toks[g].indexOf(kt[m]) === 0)) { p = g; ok = true; break; } } }
      if (ok) return true;
    }
    return false;
  }
  function grade(q, text) { var toks = norm(text); return q.concepts.map(function (c) { return c.kw.some(function (k) { return kwMatch(toks, k); }); }); }

  /* ---------- navigation ---------- */
  var cleanup = null, onHome = true;
  function go(fn) {
    if (cleanup) { cleanup(); cleanup = null; }
    if (onHome && fn !== home) { try { history.pushState({ s: 1 }, ""); } catch (e) {} }
    onHome = fn === home;
    var args = Array.prototype.slice.call(arguments, 1);
    fn.apply(null, args); window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", function () { if (!onHome) { if (cleanup) { cleanup(); cleanup = null; } onHome = true; home(); window.scrollTo(0, 0); } });
  var ACT = {};
  app.addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (!b || b.disabled) return; var f = ACT[b.getAttribute("data-act")]; if (f) { e.preventDefault(); f(b.getAttribute("data-arg"), b, e); } });
  ACT.home = function () { if (!onHome) { try { history.back(); } catch (e) { go(home); } setTimeout(function () { if (!onHome) go(home); }, 350); } };
  function topbar(title, right) { return '<div class="top"><button class="iconbtn" data-act="home" aria-label="Home">←</button><h2>' + esc(title) + "</h2>" + (right || "") + "</div>"; }

  /* ---------- journal ---------- */
  function jKey(text) { return hashStr(text).toString(36); }
  function inJournal(text) { var k = jKey(text); return st.journal.some(function (j) { return j.id === k; }); }
  function toggleJournal(entry) {
    var k = jKey(entry.text), i = -1;
    st.journal.forEach(function (j, n) { if (j.id === k) i = n; });
    if (i >= 0) { st.journal.splice(i, 1); save(); toast("Removed from your journal"); return false; }
    st.journal.unshift({ id: k, text: entry.text, cite: entry.cite, url: entry.url, saved: today(), note: "" }); save(); toast("Saved to your Testimony Journal"); return true;
  }
  var SAVEABLE = {};
  ACT.jsave = function (arg, b) { var e = SAVEABLE[arg]; if (!e) return; var on = toggleJournal(e); b.classList.toggle("saved", on); b.innerHTML = on ? "★ Saved" : "☆ Save"; };
  function speakBtn(k) { return ("speechSynthesis" in window) ? '<button class="linkbtn" data-act="jsay" data-arg="' + k + '" aria-label="Read aloud">🔊 Listen</button> ' : ""; }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest('[data-act="jsay"]'); if (!b) return; var en = SAVEABLE[b.getAttribute("data-arg")]; if (!en) return; speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(String(en.text).replace(/<[^>]+>/g, "")); u.rate = 0.92; u.lang = "en-US"; speechSynthesis.speak(u); }, true);
  function saveBtn(entry) { var k = jKey(entry.text); SAVEABLE[k] = entry; var on = inJournal(entry.text); return speakBtn(k) + '<button class="linkbtn' + (on ? " saved" : "") + '" data-act="jsave" data-arg="' + k + '">' + (on ? "★ Saved" : "☆ Save") + "</button>"; }
  function srcHTML(s) {
    var cite, quote = s.text;
    if (s.kind === "scripture") cite = s.ref;
    else cite = s.speaker + ", “" + s.title + ",” " + s.date;
    return '<div class="src"><blockquote>“' + esc(quote) + '”</blockquote><div class="who">— ' + esc(cite) + '</div><div class="acts"><a class="linkbtn" href="' + esc(s.url) + '" target="_blank" rel="noopener">Read the source ↗</a>' + saveBtn({ text: quote, cite: cite, url: s.url }) + "</div></div>";
  }

  /* ---------- daily five ---------- */
  function dailyPlan() {
    var t = today(), r = rng(hashStr("lul:" + t));
    var dq = pick(D.doctrine, r).id;
    var tq = shuffle(D.trivia.map(function (_, i) { return i; }), r).slice(0, 2);
    var evs = pickEvents(4, r).map(function (e) { return D.history.indexOf(e); });
    var dm = pick(D.mastery, r).ref;
    return [{ k: "doctrine", id: dq, label: "Doctrine Check" }, { k: "trivia", i: tq[0], label: "Trivia" }, { k: "history", ev: evs, label: "History Trail" }, { k: "mastery", ref: dm, label: "Doctrinal Mastery" }, { k: "trivia", i: tq[1], label: "Trivia" }];
  }
  function dailyState() { var t = today(); if (st.daily.date !== t) { st.daily = { date: t, step: 0, res: [] }; save(); } return st.daily; }
  function streakNow() { var t = today(); return (st.lastDone === t || st.lastDone === dayShift(t, -1)) ? st.streak : 0; }
  function dailyAdvance(pass) {
    var ds = dailyState(); ds.res[ds.step] = !!pass; ds.step++;
    if (ds.step >= 5 && st.lastDone !== ds.date) { st.streak = st.lastDone === dayShift(ds.date, -1) ? st.streak + 1 : 1; st.lastDone = ds.date; }
    save(); dailyRun();
  }
  function dailyRun() {
    var ds = dailyState(), plan = dailyPlan();
    if (ds.step >= 5) {
      var n = ds.res.filter(Boolean).length;
      app.innerHTML = topbar("Daily Five") + '<div class="card center stack"><div class="steps">' + stepsHTML() + '</div><h3>Today’s five are complete</h3><p class="muted">You got ' + n + " of 5. Your streak: <b>" + streakNow() + " day" + (streakNow() === 1 ? "" : "s") + '</b>.</p><p class="serif muted">Come back tomorrow for five more — line upon line, precept upon precept.</p><button class="btn primary" data-act="home">Back home</button></div>';
      return;
    }
    var it = plan[ds.step], head = { daily: true, step: ds.step, label: it.label };
    if (it.k === "doctrine") doctrine({ daily: head, id: it.id });
    else if (it.k === "trivia") triviaOne(it.i, head);
    else if (it.k === "history") historyTrail({ daily: head, ev: it.ev });
    else masteryPractice([it.ref], head);
  }
  ACT.daily = function () { go(dailyRun); };
  function dailyHead(h) { return h ? '<div class="pill" style="display:inline-block;margin-bottom:10px">Daily Five · ' + (h.step + 1) + " of 5 · " + esc(h.label) + "</div>" : ""; }
  function stepsHTML() { return [44, 62, 80, 98].map(function (w) { return '<i style="width:' + w + 'px"></i>'; }).join(""); }

  /* ---------- home ---------- */
  var SV = function (p) { return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#b0843a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>"; };
  var IC = {
    chat: SV('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
    trail: SV('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
    timer: SV('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
    book: SV('<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>'),
    pen: SV('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
    bridge: SV('<path d="M2 17h20M4 17v-4M20 17v-4M8 17v-6M16 17v-6M12 17V9"/><path d="M2 13c4-5 16-5 20 0"/>')
  };
  function home() {
    var ds = dailyState(), sk = streakNow();
    var lul = D.mastery.filter(function (m) { return m.ref === "2 Nephi 28:30"; })[0];
    var motto = lul ? '“' + esc(lul.phrase.replace(/\.$/, "")) + '” <a href="' + esc(lul.url) + '" target="_blank" rel="noopener">— 2 Nephi 28:30</a>' : "";
    var dots = ""; for (var i = 0; i < 5; i++) dots += '<i class="' + (i < ds.step ? "on" : "") + '"></i>';
    var due = D.doctrine.filter(function (q) { var r = st.dc[q.id]; return r && r.due <= Date.now(); }).length;
    var dmDue = D.mastery.filter(function (m) { var r = st.dm[m.ref]; return r && r.due <= Date.now(); }).length;
    app.innerHTML =
      '<div class="hero"><div class="steps">' + stepsHTML() + '</div><h1 class="logo">Line upon Line<span>Learn the gospel</span></h1><p class="motto">' + motto + "</p></div>" +
      '<div class="card daily" style="margin-top:14px"><div style="flex:1"><div class="serif" style="font-size:20px;color:var(--gold2);font-weight:600">Daily Five</div><div class="dots" style="margin:6px 0">' + dots + '</div><div class="small muted">Streak: <b>' + sk + " day" + (sk === 1 ? "" : "s") + '</b></div></div><button class="btn primary" style="width:auto;min-width:130px" data-act="daily">' + (ds.step === 0 ? "Start" : ds.step >= 5 ? "Done ✓" : "Continue") + "</button></div>" +
      '<div class="tiles">' +
      '<button class="tile wide" data-act="dc"><span class="ic">' + IC.chat + '</span><b>Doctrine Check</b><small>Answer real questions in your own words, see the key ideas you hit, and read the scriptures and prophets’ words behind them.' + (due ? " <b style='font-size:14px'>" + due + " to revisit</b>" : "") + "</small></button>" +
      '<button class="tile" data-act="hist"><span class="ic">' + IC.trail + '</span><b>History Trail</b><small>Put the Restoration in order.</small></button>' +
      '<button class="tile" data-act="triv"><span class="ic">' + IC.timer + '</span><b>Trivia Sprint</b><small>60 seconds. Best: ' + (st.best.trivia || 0) + "</small></button>" +
      '<button class="tile" data-act="dm"><span class="ic">' + IC.book + '</span><b>Doctrinal Mastery</b><small>Seminary passages.' + (dmDue ? " " + dmDue + " due" : "") + "</small></button>" +
      '<button class="tile" data-act="journal"><span class="ic">' + IC.pen + '</span><b>Testimony Journal</b><small>' + st.journal.length + " saved</small></button>" +
      '<button class="tile wide bridges" data-act="bridges"><span class="ic">' + IC.bridge + '</span><b>Bridges <span class="newtag">Help others</span></b><small>Two taps a passage: pick the explanation that helps you most. Your picks help the next reader, and help Similarize.</small></button>' +
      "</div>" +
      '<div class="foot"><button data-act="timeline">Full timeline</button> · <button data-act="sources">About &amp; sources</button><div>A personal study game · not an official Church product</div></div>';
  }
  ACT.dc = function () { go(doctrine, {}); };
  ACT.hist = function () { go(historyTrail, {}); };
  ACT.triv = function () { go(triviaIntro); };
  ACT.dm = function () { go(mastery); };
  ACT.journal = function () { go(journal); };
  ACT.timeline = function () { go(timeline); };
  ACT.sources = function () { go(sources); };

  /* ---------- Doctrine Check ---------- */
  function pickDoctrine() {
    var now = Date.now();
    var due = D.doctrine.filter(function (q) { var r = st.dc[q.id]; return r && r.due <= now; }).sort(function (a, b) { return st.dc[a.id].due - st.dc[b.id].due; });
    if (due.length) return due[0];
    var fresh = D.doctrine.filter(function (q) { return !st.dc[q.id]; });
    if (fresh.length) return pick(fresh);
    return D.doctrine.slice().sort(function (a, b) { return st.dc[a.id].due - st.dc[b.id].due; })[0];
  }
  var DC = null;
  function doctrine(opts) {
    var q = opts.id ? D.doctrine.filter(function (x) { return x.id === opts.id; })[0] : pickDoctrine();
    DC = { q: q, daily: opts.daily, text: opts.text || "" };
    var rec = st.dc[q.id];
    var revisit = rec && rec.missed && rec.missed.length ? '<div class="revisit">Line upon line: last time you missed <b>' + rec.missed.map(esc).join("</b>, <b>") + "</b>.</div>" : "";
    var body;
    if (st.quick) {
      var r = rng(hashStr(q.id + (rec ? rec.seen : 0)));
      var order = shuffle([0, 1, 2, 3], r);
      DC.order = order;
      body = '<div class="opts" style="margin-top:14px">' + order.map(function (i) { return '<button class="opt" data-act="dcpick" data-arg="' + i + '">' + esc(q.choices[i]) + "</button>"; }).join("") + "</div>";
    } else {
      body = '<textarea id="ans" placeholder="Type your answer in your own words…" aria-label="Your answer">' + esc(DC.text) + '</textarea><div class="row" style="margin-top:12px"><button class="btn primary" data-act="dccheck">Check my answer</button></div><button class="btn ghost" style="margin-top:10px" data-act="dcshow">I’m not sure — teach me</button>';
    }
    app.innerHTML = topbar(opts.daily ? "Daily Five" : "Doctrine Check") + dailyHead(opts.daily) +
      '<div class="card"><span class="chip">' + esc(q.topic) + '</span><p class="prompt">' + esc(q.prompt) + "</p>" + revisit + "</div>" +
      '<div class="toggle"><span class="muted small">Quick mode (4 choices)</span><button class="switch' + (st.quick ? " on" : "") + '" data-act="dcquick" aria-label="Toggle quick mode"></button></div>' + body;
    var ta = document.getElementById("ans"); if (ta && !("ontouchstart" in window)) ta.focus();
  }
  ACT.dcquick = function () { var ta = document.getElementById("ans"); st.quick = !st.quick; save(); doctrine({ id: DC.q.id, daily: DC.daily, text: ta ? ta.value : DC.text }); };
  ACT.dccheck = function () {
    var text = document.getElementById("ans").value.trim();
    if (norm(text).length < 3) { toast("Write a sentence or two first — or tap “teach me.”"); return; }
    DC.text = text; var hits = grade(DC.q, text); dcResult(hits, null);
  };
  ACT.dcshow = function () { dcResult(DC.q.concepts.map(function () { return false; }), null, true); };
  ACT.dcpick = function (arg) { dcResult(null, +arg); };
  ACT.dcrevise = function () { doctrine({ id: DC.q.id, daily: DC.daily, text: DC.text }); };
  function dcResult(hits, choice, skipped) {
    var q = DC.q, rec = st.dc[q.id] || (st.dc[q.id] = {}), pass, head = "";
    if (choice !== null && choice !== undefined) {
      pass = choice === 0;
      head = '<div class="opts">' + DC.order.map(function (i) { return '<button class="opt ' + (i === 0 ? "ok" : (i === choice ? "bad" : "")) + '" disabled>' + (i === 0 ? "✓ " : (i === choice ? "✗ " : "")) + esc(q.choices[i]) + "</button>"; }).join("") + "</div>";
      rec.missed = pass ? [] : q.concepts.map(function (c) { return c.label; }).slice(0, 2);
      head += '<div class="card" style="margin-top:14px"><h3>Key ideas</h3>' + q.concepts.map(function (c) { return '<div class="concept"><div class="mark y">•</div><div>' + esc(c.label) + "</div></div>"; }).join("") + "</div>";
    } else {
      var n = hits.filter(Boolean).length, tot = hits.length, pct = Math.round(100 * n / tot);
      pass = !skipped && n / tot >= 0.75;
      rec.missed = q.concepts.filter(function (c, i) { return !hits[i]; }).map(function (c) { return c.label; });
      var msg = skipped ? "Here are the key ideas to look for." : pct === 100 ? "Beautifully said — every key idea is there." : pct >= 75 ? "Strong answer. One idea to add next time." : pct >= 50 ? "Good start. Look at the ideas you missed." : "Let’s learn this one together.";
      var deg = Math.round(360 * n / tot);
      head = '<div class="card"><div class="score"><div class="ring" style="background:conic-gradient(var(--gold) ' + deg + 'deg,var(--stone) 0)"><div style="width:68px;height:68px;border-radius:50%;background:var(--card);display:grid;place-items:center">' + (skipped ? "—" : n + "/" + tot) + '</div></div><div><div class="serif" style="font-size:20px">' + msg + '</div><div class="small muted">Key ideas found in your answer</div></div></div>' +
        '<div style="margin-top:10px">' + q.concepts.map(function (c, i) { return '<div class="concept"><div class="mark ' + (hits[i] ? "y" : "n") + '">' + (hits[i] ? "✓" : "–") + "</div><div>" + esc(c.label) + "</div></div>"; }).join("") + "</div>" +
        (skipped ? "" : '<p class="small dim" style="margin:8px 0 0">Graded in your browser by matching key words and phrases, so a correct idea in unusual words may be missed.</p>') + "</div>";
    }
    schedule(rec, pass); save();
    var next = DC.daily ? '<button class="btn primary" data-act="dailynext" data-arg="' + (pass ? 1 : 0) + '">Next in Daily Five →</button>' : '<button class="btn primary" data-act="dcnext">Next question →</button>';
    app.innerHTML = topbar(DC.daily ? "Daily Five" : "Doctrine Check") + dailyHead(DC.daily) +
      '<div class="card" style="margin-bottom:12px"><span class="chip">' + esc(q.topic) + '</span><p class="prompt" style="font-size:19px">' + esc(q.prompt) + "</p>" + (DC.text && choice == null ? '<p class="small muted" style="margin:0"><i>Your answer:</i> ' + esc(DC.text) + "</p>" : "") + "</div>" +
      head +
      '<div class="card" style="margin-top:14px"><h3>A strong answer might say</h3><p class="model">' + esc(q.model) + "</p></div>" +
      '<div class="card" style="margin-top:14px"><h3>Sources</h3>' + q.sources.map(srcHTML).join("") + "</div>" +
      '<div class="stack" style="margin-top:16px">' + next + (choice == null && !skipped ? '<button class="btn" data-act="dcrevise">Revise my answer</button>' : "") + "</div>";
  }
  ACT.dcnext = function () { doctrine({}); window.scrollTo(0, 0); };
  ACT.dailynext = function (arg) { dailyAdvance(arg === "1"); window.scrollTo(0, 0); };

  /* ---------- History Trail ---------- */
  function pickEvents(n, r) {
    var out = [], used = {};
    shuffle(D.history, r).forEach(function (e) { if (out.length < n && !used[e.y]) { used[e.y] = 1; out.push(e); } });
    return out;
  }
  var HT = null;
  function historyTrail(opts) {
    var evs = opts.ev ? opts.ev.map(function (i) { return D.history[i]; }) : pickEvents(6);
    HT = { evs: evs, pool: shuffle(evs.map(function (_, i) { return i; })), placed: [], daily: opts.daily };
    htRender();
  }
  function htRender() {
    var placed = HT.placed.map(function (i, n) { var e = HT.evs[i]; return '<div class="ev placed"><span class="n">' + (n + 1) + '</span><span class="t">' + esc(e.title) + '</span><span class="mv"><button data-act="htup" data-arg="' + n + '" aria-label="Move up">↑</button><button data-act="htback" data-arg="' + n + '" aria-label="Remove">✕</button></span></div>'; }).join("");
    var slots = ""; for (var s = HT.placed.length; s < HT.evs.length; s++) slots += '<div class="slot">' + (s === HT.placed.length ? "Tap the next-earliest event below" : "") + "</div>";
    var pool = HT.pool.map(function (i) { return '<button class="ev" data-act="htplace" data-arg="' + i + '"><span class="t">' + esc(HT.evs[i].title) + "</span></button>"; }).join("");
    app.innerHTML = topbar(HT.daily ? "Daily Five" : "History Trail") + dailyHead(HT.daily) +
      '<p class="muted" style="margin-top:0">Tap the events from <b>earliest</b> to <b>latest</b>. Use ↑ to reorder, ✕ to send one back.</p>' +
      '<div class="stack">' + placed + slots + "</div>" +
      (pool ? '<h3 style="margin-top:20px">Events</h3><div class="stack">' + pool + "</div>" : "") +
      '<div style="margin-top:18px"><button class="btn primary" data-act="htcheck"' + (HT.pool.length ? " disabled" : "") + ">Check my order</button></div>";
  }
  ACT.htplace = function (a) { a = +a; HT.pool = HT.pool.filter(function (i) { return i !== a; }); HT.placed.push(a); htRender(); };
  ACT.htback = function (n) { n = +n; var i = HT.placed.splice(n, 1)[0]; HT.pool.push(i); htRender(); };
  ACT.htup = function (n) { n = +n; if (n === 0) return; var p = HT.placed; var t = p[n - 1]; p[n - 1] = p[n]; p[n] = t; htRender(); };
  ACT.htcheck = function () {
    var correct = HT.evs.map(function (_, i) { return i; }).sort(function (a, b) { return HT.evs[a].y - HT.evs[b].y; });
    var n = 0;
    var rows = HT.placed.map(function (i, k) { var ok = correct[k] === i; if (ok) n++; var e = HT.evs[i]; return '<div class="ev ' + (ok ? "ok" : "bad") + '"><span class="n" style="background:' + (ok ? "var(--ok)" : "var(--bad)") + '">' + (ok ? "✓" : k + 1) + '</span><span class="t">' + esc(e.title) + '<br><span class="small muted" style="font-family:var(--sans)">' + esc(e.date) + "</span></span></div>"; }).join("");
    var tot = HT.evs.length, pass = n >= tot - 1;
    if (!HT.daily && tot === 6 && n > (st.best.hist || 0)) { st.best.hist = n; save(); }
    var story = '<div class="tl">' + correct.map(function (i) { var e = HT.evs[i]; return '<div class="it"><div class="d">' + esc(e.date) + '</div><div class="h">' + esc(e.title) + "</div><p>" + esc(e.story) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Source ↗</a></p></div>'; }).join("") + "</div>";
    var next = HT.daily ? '<button class="btn primary" data-act="dailynext" data-arg="' + (pass ? 1 : 0) + '">Next in Daily Five →</button>' : '<button class="btn primary" data-act="htagain">Another trail →</button>';
    app.innerHTML = topbar(HT.daily ? "Daily Five" : "History Trail") + dailyHead(HT.daily) +
      '<div class="card center"><div class="serif" style="font-size:24px;color:var(--gold2)">' + n + " of " + tot + ' in the right place</div><div class="small muted">' + (n === tot ? "A perfect trail!" : "Here is the correct order and the story.") + "</div></div>" +
      '<div class="stack" style="margin-top:12px">' + rows + "</div>" +
      '<div class="card" style="margin-top:16px"><h3>The story</h3>' + story + "</div>" +
      '<div class="stack" style="margin-top:16px">' + next + (HT.daily ? "" : '<button class="btn" data-act="timeline">See the full timeline</button>') + "</div>";
    window.scrollTo(0, 0);
  };
  ACT.htagain = function () { historyTrail({}); window.scrollTo(0, 0); };
  function timeline() {
    var evs = D.history.slice().sort(function (a, b) { return a.y - b.y; });
    app.innerHTML = topbar("Timeline of the Restoration") + '<div class="card"><div class="tl">' + evs.map(function (e) { return '<div class="it"><div class="d">' + esc(e.date) + '</div><div class="h">' + esc(e.title) + "</div><p>" + esc(e.story) + ' <a href="' + esc(e.url) + '" target="_blank" rel="noopener">Source ↗</a></p></div>'; }).join("") + "</div></div>";
  }

  /* ---------- Trivia ---------- */
  function triviaIntro() {
    app.innerHTML = topbar("Trivia Sprint") + '<div class="card center stack"><div>' + IC.timer + '</div><h3>60 seconds</h3><p class="muted">Answer as many questions as you can about people, places, scriptures, and Church history. Each answer shows its scripture or source.</p><p class="pill" style="display:inline-block">Best: ' + (st.best.trivia || 0) + '</p><button class="btn primary" data-act="tvgo">Begin</button><button class="btn" data-act="duogo">👥 Family Duel (2 players)</button><p class="small muted">Take turns on one phone: 10 questions, no timer, a source after each.</p></div>';
  }
  var TV = null;
  ACT.tvgo = function () {
    if (cleanup) { cleanup(); cleanup = null; }
    TV = { deck: shuffle(D.trivia.map(function (_, i) { return i; })), k: 0, score: 0, missed: [], end: Date.now() + 60000, lock: false, answered: 0 };
    var iv = setInterval(tvTick, 250); cleanup = function () { clearInterval(iv); TV = null; };
    tvQ();
  };
  function tvTick() { if (!TV) return; var left = Math.max(0, TV.end - Date.now()); var bar = document.getElementById("tbar"), sec = document.getElementById("tsec"); if (bar) bar.style.width = (left / 600) + "%"; if (sec) sec.textContent = Math.ceil(left / 1000) + "s"; if (left <= 0 && !TV.done) tvEnd(); }
  function tvQ() {
    if (!TV || TV.done) return;
    if (TV.k >= TV.deck.length) { TV.deck = shuffle(TV.deck); TV.k = 0; }
    var t = D.trivia[TV.deck[TV.k]], opts = shuffle([t.a].concat(t.w));
    TV.cur = { t: t, opts: opts }; TV.lock = false;
    app.innerHTML = topbar("Trivia Sprint", '<span class="pill" id="tsec">60s</span>') +
      '<div class="timer"><i id="tbar" style="width:100%"></i></div><div class="row" style="margin:10px 0"><div class="small muted">' + esc(t.c) + '</div><div class="small" style="text-align:right">Score <b>' + TV.score + '</b></div></div>' +
      '<div class="card"><div class="bigq">' + esc(t.q) + "</div></div>" +
      '<div class="opts" style="margin-top:12px">' + opts.map(function (o, i) { return '<button class="opt" data-act="tvpick" data-arg="' + i + '">' + esc(o) + "</button>"; }).join("") + '</div><div class="flash" id="flash"></div>';
    tvTick();
  }
  ACT.tvpick = function (i, b) {
    if (!TV || TV.lock || TV.done) return; TV.lock = true; TV.answered++;
    var c = TV.cur, ok = c.opts[+i] === c.t.a;
    var btns = app.querySelectorAll(".opt");
    btns.forEach(function (x, n) { if (c.opts[n] === c.t.a) x.classList.add("ok"); else if (n === +i) x.classList.add("bad"); });
    if (ok) TV.score++; else TV.missed.push(c.t);
    var f = document.getElementById("flash"); if (f) f.innerHTML = (ok ? "✓ Correct" : "The answer: <b>" + esc(c.t.a) + "</b>") + ' <span class="dim">· ' + esc(c.t.ref) + "</span>";
    setTimeout(function () { if (TV && !TV.done) { TV.k++; tvQ(); } }, ok ? 650 : 1500);
  };
  function tvEnd() {
    TV.done = true; var best = st.best.trivia || 0, nb = TV.score > best; if (nb) { st.best.trivia = TV.score; save(); }
    var missed = TV.missed.map(function (t) { return '<div class="concept"><div class="mark n">–</div><div><div>' + esc(t.q) + '</div><div class="small"><b>' + esc(t.a) + '</b> · <a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.ref) + " ↗</a></div></div></div>"; }).join("");
    app.innerHTML = topbar("Trivia Sprint") + '<div class="card center stack"><div class="serif" style="font-size:44px;color:var(--gold2)">' + TV.score + '</div><div class="muted">correct of ' + TV.answered + " answered" + (nb ? " · <b>New best!</b>" : " · Best " + best) + "</div></div>" +
      (missed ? '<div class="card" style="margin-top:14px"><h3>Learn from these</h3>' + missed + "</div>" : "") +
      '<div class="stack" style="margin-top:16px"><button class="btn primary" data-act="tvgo">Play again</button><button class="btn" data-act="home">Home</button></div>';
  }
  /* ---------- Family Duel: 2 players, one phone ---------- */
  var DU = null;
  ACT.duogo = function () {
    if (cleanup) { cleanup(); cleanup = null; }
    DU = { deck: shuffle(D.trivia.map(function (_, i) { return i; })).slice(0, 10), k: 0, p: [0, 0] }; duQ();
  };
  function duQ() {
    var t = D.trivia[DU.deck[DU.k]], who = DU.k % 2;
    DU.cur = { t: t, opts: shuffle([t.a].concat(t.w)), done: false };
    app.innerHTML = topbar("Family Duel", '<span class="pill" id="dupill">P1 ' + DU.p[0] + ' · P2 ' + DU.p[1] + '</span>') +
      '<div class="pill" style="display:inline-block;margin-bottom:10px">Question ' + (DU.k + 1) + ' of 10 · <b>Player ' + (who + 1) + '</b> answers</div>' +
      '<p class="small muted">Player ' + (2 - who) + ': guess out loud which answer Player ' + (who + 1) + ' will pick!</p>' +
      '<div class="card"><span class="chip">' + esc(t.c) + '</span><div class="bigq" style="margin-top:10px">' + esc(t.q) + "</div></div>" +
      '<div class="opts" style="margin-top:12px">' + DU.cur.opts.map(function (o, n) { return '<button class="opt" data-act="dupick" data-arg="' + n + '">' + esc(o) + "</button>"; }).join("") + '</div><div id="dunext" style="margin-top:14px"></div>';
  }
  ACT.dupick = function (i) {
    if (!DU || DU.cur.done) return; DU.cur.done = true;
    var c = DU.cur, ok = c.opts[+i] === c.t.a; if (ok) DU.p[DU.k % 2]++; var dp = document.getElementById("dupill"); if (dp) dp.textContent = "P1 " + DU.p[0] + " · P2 " + DU.p[1];
    app.querySelectorAll(".opt").forEach(function (x, n) { x.disabled = true; if (c.opts[n] === c.t.a) x.classList.add("ok"); else if (n === +i) x.classList.add("bad"); });
    document.getElementById("dunext").innerHTML = '<p class="center">' + (ok ? "✓ Correct!" : "The answer is <b>" + esc(c.t.a) + "</b>.") + ' <a href="' + esc(c.t.url) + '" target="_blank" rel="noopener noreferrer">' + esc(c.t.ref) + ' ↗</a></p><button class="btn primary" data-act="dunext">' + (DU.k < 9 ? "Pass the phone →" : "See who won") + '</button>';
  };
  ACT.dunext = function () {
    if (!DU) return; if (DU.k < 9) { DU.k++; duQ(); return; }
    var a = DU.p[0], b = DU.p[1];
    app.innerHTML = topbar("Family Duel") + '<div class="card center stack"><div class="serif" style="font-size:40px;color:var(--gold2)">' + a + ' – ' + b + '</div><div class="muted">' + (a === b ? "A tie! Great teamwork." : "Player " + (a > b ? 1 : 2) + " wins!") + '</div><p class="small muted">Talk about it: which question surprised you most?</p></div>' +
      '<div class="stack" style="margin-top:16px"><button class="btn primary" data-act="duogo">Play again</button><button class="btn" data-act="home">Home</button></div>';
  };
  var T1 = null;
  function triviaOne(i, daily) {
    var t = D.trivia[i], opts = shuffle([t.a].concat(t.w), rng(hashStr(t.q)));
    T1 = { t: t, opts: opts, daily: daily };
    app.innerHTML = topbar("Daily Five") + dailyHead(daily) + '<div class="card"><span class="chip">' + esc(t.c) + '</span><div class="bigq" style="margin-top:10px">' + esc(t.q) + "</div></div>" +
      '<div class="opts" style="margin-top:12px">' + opts.map(function (o, n) { return '<button class="opt" data-act="t1pick" data-arg="' + n + '">' + esc(o) + "</button>"; }).join("") + '</div><div id="t1next" style="margin-top:14px"></div>';
  }
  ACT.t1pick = function (i) {
    if (!T1 || T1.done) return; T1.done = true;
    var ok = T1.opts[+i] === T1.t.a;
    app.querySelectorAll(".opt").forEach(function (x, n) { x.disabled = true; if (T1.opts[n] === T1.t.a) x.classList.add("ok"); else if (n === +i) x.classList.add("bad"); });
    document.getElementById("t1next").innerHTML = '<p class="center">' + (ok ? "✓ Correct!" : "The answer is <b>" + esc(T1.t.a) + "</b>.") + ' <a href="' + esc(T1.t.url) + '" target="_blank" rel="noopener">' + esc(T1.t.ref) + ' ↗</a></p><button class="btn primary" data-act="dailynext" data-arg="' + (ok ? 1 : 0) + '">Next in Daily Five →</button>';
  };

  /* ---------- Doctrinal Mastery ---------- */
  var COURSES = ["Old Testament", "New Testament", "Book of Mormon", "Doctrine and Covenants and Church History"];
  var CSHORT = { "Old Testament": "Old Testament", "New Testament": "New Testament", "Book of Mormon": "Book of Mormon", "Doctrine and Covenants and Church History": "D&C & Church History" };
  function lvl(box) { var s = ""; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= (box || 0) ? "on" : "") + '"></i>'; return '<span class="lvl" aria-label="Mastery ' + (box || 0) + ' of 5">' + s + "</span>"; }
  function mastery() {
    var list = D.mastery.filter(function (m) { return m.course === st.dmTab; });
    var now = Date.now(), due = list.filter(function (m) { var r = st.dm[m.ref]; return r && r.due <= now; }).length;
    var mastered = list.filter(function (m) { var r = st.dm[m.ref]; return r && r.box >= 4; }).length;
    app.innerHTML = topbar("Doctrinal Mastery") +
      '<div class="tabs">' + COURSES.map(function (c) { return '<button class="tab' + (c === st.dmTab ? " on" : "") + '" data-act="dmtab" data-arg="' + esc(c) + '">' + esc(CSHORT[c]) + "</button>"; }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><div class="row" style="align-items:center"><div><div class="serif" style="font-size:19px;color:var(--gold2)">' + esc(CSHORT[st.dmTab]) + '</div><div class="small muted">' + mastered + " of " + list.length + " mastered" + (due ? " · " + due + " due for review" : "") + '</div></div><button class="btn primary" style="flex:none;width:auto;min-width:140px" data-act="dmpractice">Practice 5</button></div></div>' +
      '<div class="plist">' + list.map(function (m) { var r = st.dm[m.ref]; return '<button class="prow" data-act="dmopen" data-arg="' + esc(m.ref) + '"><span class="r">' + esc(m.ref) + '</span><span class="k">' + esc(m.key) + "</span>" + lvl(r && r.box) + "</button>"; }).join("") + "</div>" +
      '<p class="small dim center" style="margin-top:16px">Passages and key phrases from the Seminary <a href="https://www.churchofjesuschrist.org/study/manual/doctrinal-mastery-core-document-2023/doctrinal-mastery-passages-and-key-phrases?lang=eng" target="_blank" rel="noopener">Doctrinal Mastery Core Document</a>.</p>';
  }
  ACT.dmtab = function (c) { st.dmTab = c; save(); mastery(); };
  function dmByRef(ref) { return D.mastery.filter(function (m) { return m.ref === ref; })[0]; }
  ACT.dmopen = function (ref) { go(dmPassage, ref); };
  function versesHTML(m) { return m.verses.map(function (v) { return "<sup>" + v.v + "</sup>" + esc(v.t); }).join(" "); }
  var CURREF = null;
  function dmPassage(ref) {
    CURREF = ref; var m = dmByRef(ref), r = st.dm[ref];
    app.innerHTML = topbar(m.ref, lvl(r && r.box)) +
      '<div class="card stack"><div class="small muted">Key scripture phrase</div><div class="keyp">' + esc(m.key) + '</div><div class="verse">' + versesHTML(m) + '</div><div class="acts" style="display:flex;gap:10px;flex-wrap:wrap"><a class="linkbtn" href="' + esc(m.url) + '" target="_blank" rel="noopener">Read in context ↗</a>' + saveBtn({ text: m.verses.map(function (v) { return v.t; }).join(" "), cite: m.ref, url: m.url }) + '<button class="linkbtn" data-act="dmbridge" data-arg="' + esc(m.ref) + '">🌉 Help others understand</button>' + "</div></div>" +
      '<h3 style="margin-top:18px">Practice</h3><div class="stack"><button class="btn primary" data-act="dmmode" data-arg="blanks">Fill the blanks</button><button class="btn" data-act="dmmode" data-arg="letters">First-letter recall</button><button class="btn" data-act="dmmode" data-arg="ref">Which reference?</button></div>';
  }
  var MP = null;
  ACT.dmmode = function (mode) { masteryPractice([CURREF], null, mode); };
  ACT.dmpractice = function () {
    var now = Date.now(), list = D.mastery.filter(function (m) { return m.course === st.dmTab; });
    var due = list.filter(function (m) { var r = st.dm[m.ref]; return r && r.due <= now; }).sort(function (a, b) { return st.dm[a.ref].due - st.dm[b.ref].due; });
    var fresh = shuffle(list.filter(function (m) { return !st.dm[m.ref]; }));
    var rest = list.filter(function (m) { var r = st.dm[m.ref]; return r && r.due > now; }).sort(function (a, b) { return (st.dm[a.ref].box - st.dm[b.ref].box) || (st.dm[a.ref].due - st.dm[b.ref].due); });
    var refs = due.concat(fresh, rest).slice(0, 5).map(function (m) { return m.ref; });
    go(masteryPractice, refs, null);
  };
  function modeFor(ref) { var b = (st.dm[ref] && st.dm[ref].box) || 0; return b === 0 ? "blanks" : b === 1 ? "ref" : b === 2 ? "letters" : pick(["letters", "blanks", "ref"]); }
  function words(phrase) { return phrase.split(/\s+/).filter(Boolean); }
  function isWord(w) { return /[A-Za-z]/.test(w); }
  function core(w) { return w.replace(/^[^A-Za-z\[]+|[^A-Za-z\]]+$/g, ""); }
  function masteryPractice(refs, daily, forced) {
    MP = { refs: refs, k: 0, daily: daily, forced: forced, results: [] };
    mpRender();
  }
  function mpRender() {
    var ref = MP.refs[MP.k], m = dmByRef(ref), mode = MP.forced || (MP.daily ? "blanks" : modeFor(ref));
    MP.mode = mode; MP.m = m;
    var title = MP.daily ? "Daily Five" : "Doctrinal Mastery";
    var prog = MP.refs.length > 1 ? '<div class="small muted" style="margin-bottom:8px">Passage ' + (MP.k + 1) + " of " + MP.refs.length + "</div>" : "";
    var html = topbar(title) + dailyHead(MP.daily) + prog;
    if (mode === "ref") {
      var pool = D.mastery.filter(function (x) { return x.course === m.course && x.ref !== m.ref; });
      var opts = shuffle([m.ref].concat(shuffle(pool).slice(0, 3).map(function (x) { return x.ref; })));
      MP.opts = opts;
      html += '<div class="card"><div class="small muted">Which passage contains this key phrase?</div><div class="keyp" style="margin-top:8px">' + esc(m.key) + '</div></div><div class="opts" style="margin-top:12px">' + opts.map(function (o, i) { return '<button class="opt" data-act="mpref" data-arg="' + i + '">' + esc(o) + "</button>"; }).join("") + '</div><div id="mpout"></div>';
    } else if (mode === "letters") {
      var hint = words(m.phrase).map(function (w) { if (!isWord(w)) return w; var c = core(w), i = w.indexOf(c); return w.slice(0, i) + c.charAt(0) + w.slice(i + c.length); }).join(" ");
      html += '<div class="card stack"><div class="small muted">' + esc(m.ref) + ' · Type the key phrase from memory. Each letter is the first letter of a word.</div><div class="hint">' + esc(hint) + '</div><textarea id="mpin" rows="2" style="min-height:90px" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type the phrase…"></textarea><button class="btn primary" data-act="mpletters">Check</button><button class="btn ghost" data-act="mppeek">Show the phrase</button></div><div id="mpout"></div>';
    } else {
      var ws = words(m.phrase), idx = [];
      ws.forEach(function (w, i) { if (isWord(w) && core(w).length > 3) idx.push(i); });
      if (idx.length < 3) ws.forEach(function (w, i) { if (isWord(w) && core(w).length > 1 && idx.indexOf(i) < 0) idx.push(i); });
      var r = rng(hashStr(m.ref + ((st.dm[m.ref] && st.dm[m.ref].seen) || 0)));
      var nb = Math.max(2, Math.min(6, Math.round(idx.length * 0.4)));
      var blanks = shuffle(idx, r).slice(0, nb).sort(function (a, b) { return a - b; });
      var others = []; D.mastery.forEach(function (x) { if (x.ref !== m.ref) words(x.phrase).forEach(function (w) { if (isWord(w) && core(w).length > 3) others.push(core(w)); }); });
      var answers = blanks.map(function (i) { return core(ws[i]); });
      var distract = shuffle(others, r).filter(function (w) { return answers.map(function (a) { return a.toLowerCase(); }).indexOf(w.toLowerCase()) < 0; }).slice(0, 2);
      MP.blank = { ws: ws, blanks: blanks, answers: answers, fill: blanks.map(function () { return null; }), bank: shuffle(answers.concat(distract), r) };
      html += '<div class="card stack"><div class="small muted">' + esc(m.ref) + ' · Tap the words to fill each blank in order.</div><div class="blanks" id="bl"></div><div class="bank" id="bank"></div><button class="btn primary" data-act="mpblanks" id="mpchk" disabled>Check</button></div><div id="mpout"></div>';
    }
    app.innerHTML = html;
    if (mode === "blanks") mpBlankDraw();
    var inp = document.getElementById("mpin");
    if (inp) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ACT.mpletters(); } });
  }
  function mpBlankDraw(result) {
    var B = MP.blank, cur = B.fill.indexOf(null), out = [];
    B.ws.forEach(function (w, i) {
      var bi = B.blanks.indexOf(i);
      if (bi < 0) { out.push(esc(w)); return; }
      var c = core(w), pre = w.slice(0, w.indexOf(c)), post = w.slice(w.indexOf(c) + c.length);
      var cls = "b" + (bi === cur && !result ? " cur" : "") + (result ? (result[bi] ? " ok" : " bad") : "");
      var txt = B.fill[bi] != null ? B.bank[B.fill[bi]] : "\u00a0";
      if (result && !result[bi]) txt = c;
      out.push(esc(pre) + '<span class="' + cls + '" ' + (result ? "" : 'data-act="mpunfill" data-arg="' + bi + '"') + ">" + esc(txt) + "</span>" + esc(post));
    });
    document.getElementById("bl").innerHTML = out.join(" ");
    document.getElementById("bank").innerHTML = result ? "" : B.bank.map(function (w, i) { return '<button data-act="mpfill" data-arg="' + i + '"' + (B.fill.indexOf(i) >= 0 ? " disabled" : "") + ">" + esc(w) + "</button>"; }).join("");
    var chk = document.getElementById("mpchk"); if (chk) chk.disabled = B.fill.indexOf(null) >= 0 || !!result;
  }
  ACT.mpfill = function (i) { var B = MP.blank, cur = B.fill.indexOf(null); if (cur < 0) return; B.fill[cur] = +i; mpBlankDraw(); };
  ACT.mpunfill = function (bi) { MP.blank.fill[+bi] = null; mpBlankDraw(); };
  ACT.mpblanks = function () {
    var B = MP.blank, res = B.fill.map(function (f, i) { return B.bank[f].toLowerCase() === B.answers[i].toLowerCase(); });
    mpBlankDraw(res); var chk = document.getElementById("mpchk"); if (chk) chk.style.display = "none";
    mpDone(res.every(Boolean));
  };
  ACT.mpref = function (i) {
    if (MP.answered) return; var ok = MP.opts[+i] === MP.m.ref;
    app.querySelectorAll(".opt").forEach(function (x, n) { x.disabled = true; if (MP.opts[n] === MP.m.ref) x.classList.add("ok"); else if (n === +i) x.classList.add("bad"); });
    mpDone(ok);
  };
  ACT.mppeek = function () { var o = document.getElementById("mpout"); o.innerHTML = '<div class="card" style="margin-top:12px"><div class="keyp">' + esc(MP.m.phrase) + "</div></div>"; MP.peeked = true; };
  ACT.mpletters = function () {
    if (MP.answered) return;
    var inp = document.getElementById("mpin"); if (!inp) return;
    var target = words(MP.m.phrase).filter(isWord), typed = norm(inp.value);
    var j = 0, good = 0, marks = target.map(function (w) {
      var t = norm(w)[0] || "", ok = false;
      for (var g = j; g < Math.min(typed.length, j + 3); g++) { if (typed[g] === t || (t.length >= 5 && tokEq(typed[g], t))) { ok = true; j = g + 1; break; } }
      if (ok) good++; return '<span class="w ' + (ok ? "ok" : "bad") + '">' + esc(w) + "</span>";
    });
    var pass = !MP.peeked && good / target.length >= 0.85;
    document.getElementById("mpout").innerHTML = '<div class="card" style="margin-top:12px"><div class="small muted">' + good + " of " + target.length + ' words</div><div class="diff">' + marks.join(" ") + "</div></div>";
    inp.disabled = true;
    mpDone(pass);
  };
  function mpDone(pass) {
    MP.answered = true; var ref = MP.m.ref, rec = st.dm[ref] || (st.dm[ref] = {}); schedule(rec, pass); save(); MP.results.push(pass);
    var last = MP.k >= MP.refs.length - 1, btn;
    if (MP.daily) btn = '<button class="btn primary" data-act="dailynext" data-arg="' + (pass ? 1 : 0) + '">Next in Daily Five →</button>';
    else if (!last) btn = '<button class="btn primary" data-act="mpnext">Next passage →</button>';
    else btn = '<button class="btn primary" data-act="mpfinish">Done</button>';
    var out = document.getElementById("mpout");
    out.insertAdjacentHTML("beforeend", '<div class="card" style="margin-top:12px"><div class="serif" style="font-size:20px;color:' + (pass ? "var(--ok)" : "var(--gold2)") + '">' + (pass ? "✓ Well done" : "Keep practicing — it will come back soon") + '</div><div class="small muted" style="margin:4px 0 8px">' + esc(ref) + " · " + esc(MP.m.key) + '</div><div class="verse" style="font-size:17px">' + versesHTML(MP.m) + '</div><div style="margin-top:8px"><a class="linkbtn" href="' + esc(MP.m.url) + '" target="_blank" rel="noopener">Read in context ↗</a></div></div><div style="margin-top:14px">' + btn + "</div>");
  }
  ACT.mpnext = function () { MP.k++; MP.answered = false; MP.peeked = false; mpRender(); window.scrollTo(0, 0); };
  ACT.mpfinish = function () {
    var n = MP.results.filter(Boolean).length;
    if (MP.refs.length === 1) { go(dmPassage, MP.refs[0]); return; }
    app.innerHTML = topbar("Doctrinal Mastery") + '<div class="card center stack"><h3>Session complete</h3><p class="muted">' + n + " of " + MP.refs.length + ' passages recalled. Missed passages come back in about 10 minutes; strong ones return in days.</p><button class="btn primary" data-act="dm">Back to passages</button></div>';
  };

  /* ---------- Journal ---------- */
  function journal() {
    var items = st.journal.map(function (j, i) { return '<div class="card jitem" style="margin-bottom:12px"><div class="src" style="margin:0"><blockquote>“' + esc(j.text) + '”</blockquote><div class="who">— ' + esc(j.cite) + " · saved " + esc(j.saved) + '</div></div><textarea data-j="' + i + '" placeholder="Your thoughts or impressions…">' + esc(j.note || "") + '</textarea><div class="acts" style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap"><a class="linkbtn" href="' + esc(j.url) + '" target="_blank" rel="noopener">Source ↗</a><button class="linkbtn" data-act="jdel" data-arg="' + i + '">Remove</button></div></div>'; }).join("");
    app.innerHTML = topbar("Testimony Journal") + (items || '<div class="card empty"><div>' + IC.pen + '</div><p class="serif" style="font-size:19px">Your journal is empty.</p><p>Tap <b>☆ Save</b> on any scripture or quote in Doctrine Check or Doctrinal Mastery to keep it here, with room for your own impressions.</p></div>') +
      '<p class="small dim center">Saved only on this device.</p>';
    app.querySelectorAll("textarea[data-j]").forEach(function (ta) { ta.addEventListener("input", function () { var j = st.journal[+ta.getAttribute("data-j")]; if (j) { j.note = ta.value; save(); } }); });
  }
  ACT.jdel = function (i, b) { if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Tap again to remove"; return; } st.journal.splice(+i, 1); save(); journal(); };

  /* ---------- About & sources ---------- */
  function sources() {
    var groups = {}; D.sources.forEach(function (s) { (groups[s.kind] = groups[s.kind] || []).push(s); });
    var order = ["General Conference & Church documents", "Scripture", "Church history", "Seminary"];
    app.innerHTML = topbar("About & sources") +
      '<div class="card stack"><p class="serif" style="font-size:18px;margin:0">Line upon Line is a personal gospel-study game for the NovelTie arcade. It is not an official publication of The Church of Jesus Christ of Latter-day Saints.</p>' +
      '<p class="small muted" style="margin:0">Every scripture and quotation was copied word for word from ChurchofJesusChrist.org when this edition was built (' + esc(D.built) + '), and each link was checked. Explanations and model answers are summaries written to follow the Church’s official teachings; for authoritative wording, follow the source links.</p>' +
      '<p class="small muted" style="margin:0">' + D.doctrine.length + " Doctrine Check questions · " + D.history.length + " history events · " + D.trivia.length + " trivia questions · " + D.mastery.length + ' doctrinal mastery passages</p><p class="small muted" style="margin:0">Your progress and journal are stored only in this browser.</p><button class="btn ghost" data-act="reset">Reset my progress</button></div>' +
      order.filter(function (k) { return groups[k]; }).map(function (k) { return '<div class="card srcl" style="margin-top:14px"><h3>' + esc(k) + "</h3>" + groups[k].map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + "<span>" + esc(s.url) + "</span></a>"; }).join("") + "</div>"; }).join("");
  }
  ACT.reset = function (a, b) { if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = "Tap again to erase progress (journal is kept)"; return; } var j = st.journal; st.dc = {}; st.dm = {}; st.best = { trivia: 0, hist: 0 }; st.streak = 0; st.lastDone = ""; st.daily = { date: "", step: 0, res: [] }; st.journal = j; save(); toast("Progress reset"); sources(); };


  /* ---------- Contribute (Bridges): one-tap insights that help others understand, and help Similarize learn which explanations land ---------- */
  var CAPI = (function () { try { var q = new URLSearchParams(location.search).get("api"); if (q) return q.replace(/\/$/, ""); } catch (e) {} return "https://lineuponline-bank-staging.ben-e22.workers.dev"; })();
  function csession() { var s = ""; try { s = localStorage.getItem("lul-session") || ""; if (!s) { var a = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); s = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); localStorage.setItem("lul-session", s); } } catch (e) { s = "anon" + Date.now(); } return s; }
  var CB = null;
  function cpost(path, body) { return fetch(CAPI + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); }); }
  function contribute(ref) {
    CB = { cards: [], k: 0, contexts: [], ref: ref || "", done: 0, pick: -1, ctx: "" };
    app.innerHTML = topbar("Bridges") + '<div class="card center"><p class="muted">Loading passages…</p></div>';
    var url = CAPI + "/v1/contribute/round?n=5" + (ref ? "&ref=" + encodeURIComponent(ref) : "");
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      if ((!j.cards || !j.cards.length) && ref) { toast("No explanations for this passage yet. Here are others."); return contribute(""); }
      CB.cards = j.cards || []; CB.contexts = j.life_contexts || []; CB.note = j.note || "";
      if (!CB.cards.length) throw new Error("empty");
      cbRender();
    }).catch(function () {
      if (ref && CB && CB.ref) { toast("No explanations for this passage yet. Here are others."); return contribute(""); }
      app.innerHTML = topbar("Bridges") + '<div class="card center stack"><h3>You’re offline</h3><p class="muted">Bridges needs an internet connection. Everything else in Line upon Line works offline.</p><button class="btn primary" data-act="cbstart">Try again</button><button class="btn" data-act="home">Back home</button></div>';
    });
  }
  function cbIntro() {
    app.innerHTML = topbar("Bridges") +
      '<div class="card stack"><div class="ic" style="font-size:28px">' + IC.bridge + '</div><h3 style="margin:0">Help others understand</h3>' +
      '<p class="muted" style="margin:0">Read a passage, then tap the explanation that helps <i>you</i> understand it best, and where it has shown up in your life. When enough people agree, that explanation helps the next person.</p>' +
      '<p class="small muted" style="margin:0">Anonymous: no name, no account. Two taps a passage, and you can skip anything. Your picks also help <b>Similarize</b> learn which explanations help people understand each other.</p>' +
      '<button class="btn primary" data-act="cbstart">Start</button></div>';
  }
  function cbRender() {
    var c = CB.cards[CB.k];
    if (!c) {
      app.innerHTML = topbar("Bridges") + '<div class="card center stack"><h3>Thank you</h3><p class="muted">You helped with ' + CB.done + " passage" + (CB.done === 1 ? "" : "s") + '. Explanations people agree on rise to the top for the next reader.</p><button class="btn primary" data-act="cbstart">Five more</button><button class="btn" data-act="home">Back home</button></div>';
      return;
    }
    var verses = (c.verses || []).map(function (v) { return '<sup>' + esc(v.v) + "</sup> " + esc(v.text); }).join(" ");
    var stage = CB.pick < 0 ? 1 : 2;
    var fr = c.framings.map(function (f, i) {
      var cls = CB.pick === i ? " ok" : "";
      return '<button class="opt' + cls + '" data-act="cbpick" data-arg="' + i + '"' + (stage === 2 ? " disabled" : "") + ">" + esc(f.text) + "</button>";
    }).join("");
    var ctx = stage === 2 ? '<h3 style="margin-top:18px">Where has this shown up in your life?</h3><div class="cbctx">' + CB.contexts.map(function (x) { return '<button class="chip' + (CB.ctx === x.id ? " on" : "") + '" data-act="cbctx" data-arg="' + esc(x.id) + '">' + esc(x.label) + "</button>"; }).join("") + "</div>" : "";
    app.innerHTML = topbar("Bridges", '<span class="pill">' + (CB.k + 1) + " of " + CB.cards.length + "</span>") +
      '<div class="card stack"><div class="small muted">' + esc(c.ref) + '</div><div class="verse">' + verses + '</div><a class="small" href="' + esc(c.source.url) + '" target="_blank" rel="noopener">' + esc(c.source.name) + " ↗</a></div>" +
      '<h3 style="margin-top:18px">Which helps you understand this best?</h3><p class="small muted" style="margin:-4px 0 10px">' + "Ways people explain it · not Church doctrine.</p>" +
      '<div class="opts">' + fr + "</div>" + ctx +
      '<div class="stack" style="margin-top:16px"><button class="btn' + (stage === 2 ? " primary" : " ghost") + '" data-act="cbnext">' + (stage === 2 ? "Next passage →" : "Skip this one") + "</button></div>";
  }
  ACT.bridges = function () { go(cbIntro); };
  ACT.cbstart = function () { contribute(CB && CB.ref ? CB.ref : ""); window.scrollTo(0, 0); };
  ACT.cbpick = function (i) {
    var c = CB.cards[CB.k]; i = +i; if (CB.pick >= 0) return;
    CB.pick = i; CB.done++;
    cpost("/v1/contribute/framing", { token: c.token, pick: c.framings[i].id, shown: c.framings.map(function (f) { return f.id; }), session: csession() }).then(function (j) { if (j.status === 429) toast("Slow down a moment, then keep going."); }).catch(function () {});
    cbRender();
  };
  ACT.cbctx = function (id) {
    var c = CB.cards[CB.k]; if (CB.ctx) return;
    CB.ctx = id;
    cpost("/v1/contribute/context", { token: c.token, context: id, session: csession() }).catch(function () {});
    cbRender(); setTimeout(function () { if (CB && CB.ctx === id) ACT.cbnext(); }, 650);
  };
  ACT.cbnext = function () { CB.k++; CB.pick = -1; CB.ctx = ""; cbRender(); window.scrollTo(0, 0); };
  ACT.dmbridge = function (ref) { go(function () { contribute(ref); }); };

  window.__lul = { grade: grade, norm: norm, kwMatch: kwMatch, st: function () { return st; } };
  home();
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }
})();
