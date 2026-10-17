/* Rootline: an etymology dig. Vanilla JS, no dependencies. */
(function(){
"use strict";
var W = window.ROOTLINE_WORDS, S = window.ROOTLINE_SCRIPTS;
var app = document.getElementById("app");
var KEY = "rootline.v1";
var EPOCH = "2026-10-01";
var URL_GAME = "https://games.noveltie.com/rootline/";
var TRACKS = {all:{name:"All words",desc:"Everything, shuffled"},roots:{name:"Indo-European Roots",desc:"Back to Proto-Indo-European"},
  world:{name:"World Words",desc:"Loans from Asia & beyond"},ancient:{name:"Ancient Track",desc:"Egypt, Persia, the Aztecs"}};
var REGIONS = {am:["Americas",85,72],we:["W. Europe",152,50],ne:["N. Europe",178,26],me:["Mediterr.",186,64],af:["Africa",192,110],
  ee:["E. Europe",214,38],mi:["Middle East",228,76],sa:["S. Asia",262,92],ea:["E. Asia",306,60]};

/* ---------- storage ---------- */
function blank(){ return {played:{},roots:{},gates:{},daily:{},streak:{last:null,count:0},stats:{digs:0,hits:0,layers:0}}; }
var st = blank();
try{ var raw = localStorage.getItem(KEY); if(raw){ var o = JSON.parse(raw); for(var k in st){ if(o[k]!==undefined) st[k]=o[k]; } } }catch(e){}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} }

/* ---------- utils ---------- */
function SB(t,l,o){ return window.RLSay ? RLSay.btn(t,l,o) : ""; }
function SH(t,l,o){ return window.RLSay ? RLSay.help(t,l,o) : ""; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function denverDate(d){
  try{ return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"}).format(d||new Date()); }
  catch(e){ var x=new Date((d||new Date()).getTime()-7*3600e3); return x.toISOString().slice(0,10); }
}
function dayNum(ds){ return Math.round((Date.parse(ds+"T00:00:00Z")-Date.parse(EPOCH+"T00:00:00Z"))/864e5); }
function dailyWord(ds){ var n=W.length, i=((dayNum(ds)*17)%n+n)%n; return W[i]; }
function byId(id){ for(var i=0;i<W.length;i++) if(W[i].id===id) return W[i]; return null; }
function toast(msg){ var t=document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(function(){t.remove();},2200); }
function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
var canSpeak = "speechSynthesis" in window;
function speak(text, lang){ if(!canSpeak||!lang) return; try{ var u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=.8; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }
function copyText(txt){
  function fallback(){ var ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
    var ok=false; try{ ok=document.execCommand("copy"); }catch(e){} ta.remove(); toast(ok?"Copied! Paste it anywhere.":"Couldn't copy: long-press to select"); if(!ok) modal('<h3>Your result</h3><pre style="white-space:pre-wrap">'+esc(txt)+'</pre><button class="btn" data-act="close">Close</button>'); }
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(txt).then(function(){toast("Copied! Paste it anywhere.");},fallback); } else fallback();
}
function dust(el){
  var r = el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  for(var i=0;i<14;i++){ var d=document.createElement("i"); d.className="dust"; d.style.left=cx+"px"; d.style.top=cy+"px";
    var a=Math.random()*Math.PI*2, m=40+Math.random()*70; d.style.setProperty("--dx",Math.cos(a)*m+"px"); d.style.setProperty("--dy",(Math.sin(a)*m+30)+"px");
    d.style.background=["#f0d491","#d9b25f","#a8834a","#6b4f2c"][i%4]; document.body.appendChild(d); setTimeout(function(x){return function(){x.remove();};}(d),900); }
}
var GLYPH = {
  ox:'<svg class="glyph" viewBox="0 0 40 40" aria-label="ox-head sign"><g fill="none" stroke="#f0d491" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7c1 7 6 9 10 8M35 7c-1 7-6 9-10 8"/><path d="M14 15h12l-1 12c-1 6-9 6-10 0z"/><circle cx="17" cy="20" r="1" fill="#f0d491"/><circle cx="23" cy="20" r="1" fill="#f0d491"/></g></svg>',
  aleph:'<svg class="glyph" viewBox="0 0 40 40" aria-label="Phoenician aleph"><g fill="none" stroke="#f0d491" stroke-width="2.6" stroke-linecap="round"><path d="M31 7L11 20l20 13"/><path d="M19 8l4 25"/></g></svg>',
  brick:'<svg class="glyph" viewBox="0 0 40 40" aria-label="brick sign"><g fill="none" stroke="#f0d491" stroke-width="2.2"><rect x="5" y="12" width="30" height="16" rx="1.5"/><path d="M5 20h30M15 12v8M25 20v8"/></g></svg>'
};

/* ---------- navigation ---------- */
var screen = "home", R = null;
function go(name, arg, noPush){
  screen = name; closeModal();
  if(!noPush && name!=="home") try{ history.pushState({s:name},""); }catch(e){}
  if(name==="home") renderHome();
  else if(name==="round") startRound(arg.word, arg.daily, arg.track);
  else if(name==="gates") renderGates();
  else if(name==="gate") renderGate(arg);
  else if(name==="codex") renderCodex();
  else if(name==="bank" && window.RootlineBank) window.RootlineBank.start();
  window.scrollTo(0,0);
}
window.addEventListener("popstate", function(){ if(document.querySelector(".modal")){ closeModal(); return; } go("home",null,true); });
function topbar(title, right){
  return '<div class="top"><button class="iconbtn" data-act="home" aria-label="Back">←</button><h2>'+esc(title)+'</h2>'+(right||"")+'</div>';
}

/* ---------- modal ---------- */
function modal(html){ closeModal(); var m=document.createElement("div"); m.className="modal"; m.innerHTML='<div class="sheet" role="dialog">'+html+'</div>';
  m.addEventListener("click",function(e){ if(e.target===m) closeModal(); }); document.body.appendChild(m); return m; }
function closeModal(){ var m=document.querySelector(".modal"); if(m) m.remove(); }

/* ---------- home ---------- */
function renderHome(){
  screen="home"; R=null;
  var today=denverDate(), dw=dailyWord(today), dres=st.daily[today];
  var nPlayed=Object.keys(st.played).length, nRoots=Object.keys(st.roots).length;
  var nGates=S.order.filter(function(g){return st.gates[g]&&st.gates[g].passed;}).length;
  var streak = (st.streak.last===today||st.streak.last===prevDay(today)) ? st.streak.count : 0;
  var h = '<div class="hero"><h1 class="logo">Rootline<small>Dig to the roots of words</small></h1>'+
   '<svg class="rootart" viewBox="0 0 150 46"><g fill="none" stroke="#d9b25f" stroke-width="1.6" stroke-linecap="round"><path d="M75 0v16M75 16c-8 6-22 6-34 16M75 16c8 6 22 6 34 16M75 16v14c0 6-6 9-10 14M41 32c-6 4-14 5-22 12M109 32c6 4 14 5 22 12M75 30c4 4 9 6 12 14"/></g></svg></div>';
  h += '<div class="home-grid"><div style="display:grid;gap:14px">';
  h += '<div class="daily"><div class="lbl">Daily Dig · #'+(dayNum(today)+1)+' · '+esc(today)+'</div>';
  if(dres){
    h += '<div class="big">Dug up: <i>'+esc(byId(dres.id).w)+'</i></div><div class="trail" style="font-size:24px;text-align:left">'+esc(dres.trail)+'</div><div class="muted">'+dres.score+' points. A new word arrives at midnight (Mountain Time).</div>'+
         '<div class="row"><button class="btn primary" data-act="sharedaily">Copy result</button><button class="btn" data-act="codexword" data-id="'+dres.id+'">Review</button></div>';
  } else {
    h += '<div class="big">Today\'s word is waiting.</div><div class="muted">One word for everyone each day. Dig to its root, meet its cousins, and share your trail.</div>'+
         '<button class="btn primary" data-act="daily">⛏ Start the Daily Dig</button>';
  }
  h += '</div>';
  if(window.storyOfTheDay) h += window.wordStoryHTML(window.storyOfTheDay(today), "Word story of the day");
  h += '<div class="stats"><div class="stat"><b>'+nPlayed+'/'+W.length+'</b><span>Words</span></div><div class="stat"><b>'+nRoots+'</b><span>Roots</span></div>'+
       '<div class="stat"><b>'+nGates+'/3</b><span>Gates</span></div><div class="stat"><b>'+streak+'</b><span>Streak</span></div></div>';
  h += '</div><div style="display:grid;gap:14px"><div class="card"><h3>Free Play</h3><div class="tracks">';
  for(var t in TRACKS){ var cnt = t==="all"?W.length:W.filter(function(w){return w.track===t;}).length;
    h += '<button class="track" data-act="free" data-track="'+t+'"><b>'+TRACKS[t].name+'</b><span>'+TRACKS[t].desc+' · '+cnt+'</span></button>'; }
  h += '</div></div>'+(window.RootlineBank?window.RootlineBank.homeCard():"")+'<div class="row"><button class="btn" data-act="gates">🔤 Script Gates</button><button class="btn" data-act="codex">📜 Root Codex</button></div></div></div>';
  h += '<p class="dim small" style="text-align:center;margin-top:26px">Progress saves on this device. Works offline once loaded. <a href="#" data-act="audiocredits" style="color:var(--gold)">🎧 Audio credits</a><br><a href="https://arcade.noveltie.com/" style="color:var(--gold)">← NovelTie Arcade</a></p>';
  app.innerHTML = h;
}
function prevDay(ds){ var t=Date.parse(ds+"T12:00:00Z")-864e5; return new Date(t).toISOString().slice(0,10); }

/* ---------- round ---------- */
function pickFree(track){
  var pool = W.filter(function(w){ return track==="all"||!track||w.track===track; });
  var fresh = pool.filter(function(w){ return !st.played[w.id] && (!R||R.word.id!==w.id); });
  var from = fresh.length?fresh:pool.filter(function(w){return !R||R.word.id!==w.id;});
  return from[Math.floor(Math.random()*from.length)];
}
function startRound(word, daily, track){
  R = {word:word, daily:!!daily, track:track||"all", stage:"intro", layer:0, answered:false, picked:-1, results:[], opts:null, score:0, bonusSel:{}, bonusChecked:false, bonusPts:0, bonusHits:0};
  renderRound();
}
function layerOpts(L){ return shuffle([{l:L.l,f:L.f,g:L.g,ok:true}].concat(L.x.map(function(x){return {l:x[0],f:x[1],g:x[2],ok:false};}))); }
function stratumColor(i,n){ var t=n<=1?1:i/(n-1); var a=[150,112,62], b=[46,30,18]; var c=a.map(function(v,k){return Math.round(v+(b[k]-v)*t);}); return "rgb("+c.join(",")+")"; }
function rootStrip(w,k){
  var nodes=[{f:w.w,l:"English"}], chain=[];
  for(var i=0;i<=k;i++) nodes.push({f:w.L[i].f,l:w.L[i].l});
  var last = k===w.L.length-1;
  var base=function(f){ return String(f).replace(/\s*\([^)]*\)/g,'').trim(); };
  if(last){ if(base(w.root.f)!==base(w.L[k].f)) nodes.push({f:w.root.f,l:w.root.l,root:1}); else nodes[nodes.length-1].root=1; }
  var rom=function(f){ return String(f).split(" ").pop().toLowerCase(); }, latin=function(f){ return !/[^\u0000-\u024F\u1E00-\u1EFF\u02B0-\u036F*₀-₉ʷʰ]/.test(f); };
  nodes.forEach(function(n,i){
    var same = i>0 && !n.root && latin(n.f) && rom(n.f)===rom(nodes[i-1].f);
    chain.push('<span class="rs-n">'+(n.root?'Root: ':'')+(same?'':'<span class="sc">'+esc(n.f)+'</span> ')+'<i>'+esc(n.l)+(same?', same form':'')+'</i></span>');
  });
  var h=chain.join(' <b>←</b> ');
  if(last) h+='<div class="rs-root">Root meaning: “'+esc(w.root.g)+'”'+'</div>';
  var q=encodeURIComponent(w.w);
  return '<div class="rootstrip"><div class="rs-chain">'+h+'</div>'+
    '<div class="rs-src">Check it in a dictionary: <a href="https://www.etymonline.com/word/'+q+'" target="_blank" rel="noopener noreferrer">Etymonline</a> · <a href="https://en.wiktionary.org/wiki/'+q+'#Etymology" target="_blank" rel="noopener noreferrer">Wiktionary</a></div></div>';
}
function renderRound(){
  var w=R.word, n=w.L.length, h="";
  var right = '<span class="pill">'+R.score+' pts</span>';
  h += topbar(R.daily?"Daily Dig":TRACKS[R.track].name, right);
  if(R.stage==="intro"){
    h += '<div class="wordcard"><div class="tag">'+(R.daily?"Today's word":"Your word")+'</div><div class="w">'+esc(w.w)+' '+SB(w.w,"English")+'</div><div class="d">'+esc(w.def)+'</div></div><div class="sep"></div>';
    h += '<div class="card"><p style="margin-top:0">This word has <b>'+n+'</b> older layers beneath it. Guess each ancestor, one layer at a time.</p><button class="btn primary" data-act="dig">⛏ Start digging</button></div>';
  } else if(R.stage==="dig"){
    if(!R.opts) R.opts = layerOpts(w.L[R.layer]);
    h += '<div class="progress">'+w.L.map(function(_,i){return '<i class="'+(i<R.results.length?"on":"")+'"></i>';}).join("")+'</div>';
    h += '<div class="dig"><div class="strata" id="strata">'+strataHTML()+'</div><div>';
    var L = w.L[R.layer], above = R.layer===0? w.w : w.L[R.layer-1].f;
    h += '<p class="q">Layer '+(R.layer+1)+' of '+n+': what lies beneath <em class="sc">'+esc(above)+'</em> '+SB(above, R.layer===0?"English":w.L[R.layer-1].l)+'?</p><div class="opts">';
    R.opts.forEach(function(o,i){
      var cls = ""; if(R.answered){ if(o.ok) cls=" right"; else if(i===R.picked) cls=" wrong"; }
      h += '<button class="opt'+cls+'" data-act="pick" data-i="'+i+'"'+(R.answered?" disabled":"")+'><span class="ol">'+esc(o.l)+'</span><span class="of sc">'+esc(o.f)+' '+SB(o.f,o.l,R.answered?null:{blind:true})+'</span>'+(R.answered?SH(o.f,o.l):'')+'<span class="og">“'+esc(o.g)+'”</span></button>';
    });
    h += '</div>';
    if(R.answered){
      var good = R.results[R.layer];
      h += '<div class="feedback '+(good?"good":"bad")+'"><b>'+(good?"Struck it! +10":"Not quite. The answer: "+esc(L.l)+" "+esc(L.f))+'</b><br>'+(L.glyph?GLYPH[L.glyph]:"")+esc(L.why)+rootStrip(w,R.layer)+'</div><div class="sep"></div>';
      h += R.layer<n-1 ? '<button class="btn primary" data-act="next">⛏ Dig deeper</button>' : '<button class="btn primary" data-act="tocousins">🪨 Bedrock! Meet the cousins →</button>';
    }
    h += '</div></div>';
  } else if(R.stage==="cousins"){
    h += '<div class="card" style="margin-bottom:12px"><h3>Cousins of “'+esc(w.w)+'”</h3><div class="muted small">Root: <span class="sc" style="color:var(--gold2)">'+esc(w.root.f)+'</span> '+SB(w.root.f,w.root.l)+' · '+esc(w.root.l)+' “'+esc(w.root.g)+'”.'+SH(w.root.f,w.root.l)+' Tap a word in another script to read it letter by letter.</div></div>';
    h += mapSVG(w.C) + '<div class="cousins">';
    w.C.forEach(function(c,i){
      var sc=S.detect(c.n), gate=S[sc], tapl = sc!=="latin";
      h += '<button class="cousin" data-act="'+(tapl?"letters":"noop")+'" data-i="'+i+'" data-region="'+c.r+'">'+(gate?'<span class="gate">'+(gate.ready?"tap to read":"gate soon")+'</span>':"")+
        '<span class="lg">'+esc(c.l)+'</span><span class="n">'+(c.glyph?GLYPH[c.glyph]:"")+esc(c.n)+' '+SB(c.n,c.l)+'</span>'+(SH(c.n,c.l)||(c.t?'<span class="t">'+esc(c.t)+'</span>':""))+'<span class="gl">“'+esc(c.g)+'”</span></button>';
    });
    h += '</div>'+(w.note?'<div class="note">'+esc(w.note)+'</div>':'<div class="sep"></div>')+'<button class="btn primary" data-act="tobonus">⭐ Bonus round →</button>';
  } else if(R.stage==="bonus"){
    var B=w.B; if(!R.bonusList) R.bonusList = shuffle(B.y.map(function(x){return {w:x,ok:true};}).concat(B.n.map(function(x){return {w:x[0],ok:false,why:x[1]};})));
    h += '<div class="card"><h3>Bonus: word family</h3><p style="margin-top:0">'+esc(B.p)+' <span class="muted small">Pick all that apply.</span></p><div class="chips">';
    R.bonusList.forEach(function(b,i){
      var cls=""; if(R.bonusChecked){ if(b.ok&&R.bonusSel[i]) cls=" right"; else if(!b.ok&&R.bonusSel[i]) cls=" wrong"; else if(b.ok) cls=" missed"; } else if(R.bonusSel[i]) cls=" sel";
      h += '<button class="chip'+cls+'" data-act="chip" data-i="'+i+'"'+(R.bonusChecked?" disabled":"")+'>'+esc(b.w)+' '+SB(b.w,"English")+'</button>';
    });
    h += '</div>';
    if(R.bonusChecked){
      h += '<p><b style="color:var(--gold2)">+'+R.bonusPts+' pts</b> · '+R.bonusHits+' of '+B.y.length+' found.</p>';
      R.bonusList.forEach(function(b){ if(!b.ok) h += '<div class="explain">✗ <b>'+esc(b.w)+'</b> '+SB(b.w,"English")+': '+esc(b.why)+'</div>'; });
      h += '<div class="sep"></div><button class="btn primary" data-act="finish">See your dig →</button>';
    } else h += '<button class="btn primary" data-act="checkbonus">Check</button>';
    h += '</div>';
  } else if(R.stage==="done"){
    var hits=R.results.filter(Boolean).length;
    h += '<div class="wordcard"><div class="tag">'+(hits===n?"Perfect dig!":"Dig complete")+'</div><div class="w" style="font-size:clamp(36px,9vw,60px)">'+esc(w.w)+' '+SB(w.w,"English")+'</div><div class="d">← '+w.L.map(function(l){return esc(l.f);}).join(" ← ")+'</div></div><div class="sep"></div>';
    if(window.wordStoryHTML) h += window.wordStoryHTML(w.w) ;
    h += '<div class="card"><p class="score">'+R.score+'</p><p class="muted" style="text-align:center;margin:0">points'+(hits===n?" (incl. +10 perfect-dig bonus)":"")+'</p><div class="trail">'+esc(R.trail)+'</div>';
    h += '<p class="muted small" style="text-align:center">Root added to your Codex: <span class="sc" style="color:var(--gold2)">'+esc(w.root.f)+'</span> “'+esc(w.root.g)+'”</p>';
    if(R.daily) h += '<button class="btn primary" data-act="sharedaily">Copy result to share</button><div class="sep"></div><button class="btn" data-act="free" data-track="all">Keep digging (Free Play) →</button>';
    else h += '<button class="btn primary" data-act="free" data-track="'+R.track+'">Next word →</button>';
    h += '<div class="sep"></div><div class="row"><button class="btn" data-act="codex">📜 Codex</button><button class="btn" data-act="home">Home</button></div></div><div id="wb-helper"></div>';
  }
  app.innerHTML = h;
  if(R.stage==="done" && window.RootlineBank) window.RootlineBank.helperCard(w);
}
function strataHTML(){
  var w=R.word, n=w.L.length, h='<div class="stratum surface"><span class="l">English</span><span class="f">'+esc(w.w)+' '+SB(w.w,"English")+'</span><span class="g">'+esc(w.def)+'</span></div>';
  for(var i=0;i<n;i++){
    var L=w.L[i];
    if(i<R.results.length){
      var isNew = (i===R.results.length-1 && R.justDug);
      h += '<div class="stratum '+(R.results[i]?"hit":"miss")+(isNew?" new":"")+'" style="background:'+stratumColor(i,n)+'"><span class="l">'+esc(L.l)+'</span><span class="f sc">'+(L.glyph?GLYPH[L.glyph]:"")+esc(L.f)+' '+SB(L.f,L.l)+'</span><span class="g">“'+esc(L.g)+'”</span>'+SH(L.f,L.l)+'</div>';
    } else h += '<div class="stratum unknown" style="background-color:'+stratumColor(i,n)+'"><span class="f">?</span><span class="l">layer '+(i+1)+'</span></div>';
  }
  return h;
}
function mapSVG(C){
  var counts={}; C.forEach(function(c){counts[c.r]=(counts[c.r]||0)+1;});
  var s='<svg class="map" viewBox="0 0 360 150" role="img" aria-label="Map of where the cousins are spoken">'+
   '<path class="land" d="M28 22c20-10 70-12 92 0 8 12-4 26-16 34-10 8-14 18-26 22-14 2-22-6-28-16-8-12-30-20-22-40z"/>'+
   '<path class="land" d="M92 82c12-2 26 4 30 14 2 14-8 30-16 44-6 4-10-2-12-10-4-16-12-30-2-48z"/>'+
   '<path class="land" d="M146 22c14-8 40-12 66-6 4 10-2 22-10 30-12 8-26 12-44 14-10 0-16-10-14-20 0-8 0-14 2-18z"/>'+
   '<path class="land" d="M156 74c18-6 44-6 60 2 8 12 4 26-4 40-8 16-14 24-22 26-10 0-14-12-18-24-6-12-22-26-16-44z"/>'+
   '<path class="land" d="M206 14c40-10 100-10 132 6 6 14-4 30-18 40-10 8-20 18-34 26-14 6-26 2-34-6-14-10-30-14-42-22-10-10-14-30-4-44z"/>';
  for(var r in REGIONS){ var g=REGIONS[r], on=!!counts[r];
    s += '<g data-act="region" data-r="'+r+'" style="cursor:pointer"><circle class="reg'+(on?" on":"")+'" cx="'+g[1]+'" cy="'+g[2]+'" r="'+(on?8:5)+'"/>'+(on?'<text class="cnt" x="'+g[1]+'" y="'+(g[2]+2.5)+'">'+counts[r]+'</text>':'')+'<text x="'+g[1]+'" y="'+(g[2]+16)+'">'+g[0]+'</text></g>';
  }
  return s+'</svg>';
}
function lettersModal(text, translit, gloss, lang){
  var sc=S.detect(text), gate=S[sc], h='<h3>'+esc(lang||"")+'</h3><div class="bigword">'+esc(text)+'</div><p style="text-align:center;margin:0 0 6px"><b style="color:var(--gold2)">'+esc(translit||"")+'</b> '+(gloss?'<span class="muted">“'+esc(gloss)+'”</span>':"")+'</p>';
  if(gate && gate.ready){
    var chars = Array.from(text.normalize("NFC")).filter(function(c){return c.trim();});
    h += '<p class="muted small" style="margin:6px 0 0">'+esc(gate.name)+': tap each letter to hear how it sounds.</p><div class="tiles">';
    chars.forEach(function(c,i){ h += '<button class="tile" data-act="letter" data-s="'+sc+'" data-c="'+esc(c)+'">'+esc(c)+'</button>'; });
    h += '</div><div class="letterinfo" id="linfo"><span class="muted">Tap a letter above.</span></div>';
    var passed = st.gates[sc]&&st.gates[sc].passed;
    h += '<div class="sep"></div><div class="row">'+(canSpeak?'<button class="btn" data-act="speak" data-t="'+esc(text)+'" data-l="'+gate.lang+'">🔊 Hear it</button>':"")+
      '<button class="btn" data-act="opengate" data-g="'+sc+'">'+(passed?"✓ ":"")+esc(gate.name)+' Gate</button></div>';
  } else if(gate){
    h += '<div class="card" style="margin-top:10px"><b>'+esc(gate.name)+' Gate: coming soon.</b><p class="muted small" style="margin:6px 0 0">'+esc(gate.blurb)+'</p></div>'+(canSpeak&&gate.lang?'<div class="sep"></div><button class="btn" data-act="speak" data-t="'+esc(text)+'" data-l="'+gate.lang+'">🔊 Hear it</button>':"");
  } else {
    h += '<p class="muted small">Written in '+esc(S.otherNames[sc]||sc)+' script.</p>';
  }
  h += '<div class="sep"></div><button class="btn primary" data-act="close">Done</button>';
  modal(h);
}
function letterInfoHTML(sc, c){
  var info = S[sc].info(c);
  if(!info) return '<span class="muted">No sound for this mark.</span>';
  var h='<span class="big">'+esc(c)+'</span><b>'+esc(info.sound)+'</b> <span class="muted">· '+esc(info.name)+'</span>';
  if(info.parts) h += '<div style="margin-top:8px">'+info.parts.map(function(p){return '<span class="pill" style="margin-right:6px">'+esc(p.j)+' '+esc(p.r)+' <small class="muted">'+p.role+'</small></span>';}).join("")+'</div>';
  if(info.notes&&info.notes.length) h += '<div class="small muted" style="margin-top:6px">'+info.notes.map(esc).join("<br>")+'</div>';
  return h;
}
function finishRound(){
  var w=R.word, n=w.L.length, hits=R.results.filter(Boolean).length;
  if(hits===n) R.score += 10;
  var trail = R.results.map(function(x){return x?"🟩":"🟥";}).join("")+" ⭐"+R.bonusHits+"/"+w.B.y.length;
  R.trail = trail;
  var p = st.played[w.id]||{best:0,times:0}; p.best=Math.max(p.best,R.score); p.times++; st.played[w.id]=p;
  st.roots[w.root.k]=1; st.stats.digs++; st.stats.hits+=hits; st.stats.layers+=n;
  if(R.daily){
    var today=denverDate();
    if(!st.daily[today]){
      st.daily[today]={id:w.id,score:R.score,trail:trail,cousins:w.C.length};
      if(st.streak.last===prevDay(today)) st.streak.count++; else if(st.streak.last!==today) st.streak.count=1;
      st.streak.last=today;
    }
  }
  save(); R.stage="done"; renderRound(); window.scrollTo(0,0);
}
function shareDaily(){
  var today=denverDate(), d=st.daily[today]; if(!d){ toast("Finish today's dig first"); return; }
  var txt="Rootline Daily #"+(dayNum(today)+1)+" ⛏️\n"+d.trail+"\n🌍 "+d.cousins+" cousins · "+d.score+" pts\n"+URL_GAME;
  copyText(txt);
}

/* ---------- gates ---------- */
function gateStatus(id){
  var g=S[id], i=S.order.indexOf(id);
  if(st.gates[id]&&st.gates[id].passed) return "passed";
  if(!g.ready) return "soon";
  if(i===0) return "open";
  var prev=S.order[i-1]; return (st.gates[prev]&&st.gates[prev].passed)?"open":"locked";
}
function renderGates(){
  var h = topbar("Script Gates") + '<p class="muted" style="margin-top:0">Learn to read the world\'s writing systems. Pass a gate\'s trial to open the next one.</p><div class="gates">';
  S.order.forEach(function(id,i){ var g=S[id], s=gateStatus(id);
    var label = s==="passed"?"✓ Passed · best "+st.gates[id].best+"/6":s==="open"?"Open: begin the trial":s==="locked"?"🔒 Pass "+S[S.order[i-1]].name+" to open":"Coming soon";
    h += '<button class="gatecard '+(s==="soon"||s==="locked"?"locked":"")+(s==="passed"?" passed":"")+'" data-act="'+(s==="soon"?"gatesoon":"opengate")+'" data-g="'+id+'"><span class="gn sc">'+esc(g.native)+'</span><span><b>'+(i+1)+'. '+esc(g.name)+'</b><span>'+label+'</span></span></button>';
  });
  app.innerHTML = h+'</div>';
}
function renderGate(id){
  var g=S[id], s=gateStatus(id);
  var h = topbar(g.name+" Gate") + '<div class="card"><div class="bigword" style="font-size:44px">'+esc(g.native)+'</div><p style="margin-top:0">'+esc(g.blurb)+'</p>'+(g.tips||[]).map(function(t){return '<p class="muted small" style="margin:4px 0">'+esc(t)+'</p>';}).join("")+'</div><div class="sep"></div>';
  h += '<div class="card"><h3>The letters</h3><div class="tiles">';
  g.table().forEach(function(t){ var c=t.ch.split(" ").pop(); h += '<button class="tile sm" data-act="letter" data-s="'+id+'" data-c="'+esc(c)+'">'+esc(t.ch)+'<small>'+esc(t.sound.split(/[ (,]/)[0])+'</small></button>'; });
  h += '</div><div class="letterinfo" id="linfo"><span class="muted">Tap any letter for its name and sound.</span></div></div><div class="sep"></div>';
  if(s==="locked") h += '<button class="btn" disabled>🔒 Pass the previous gate to take this trial</button>';
  else h += '<button class="btn primary" data-act="trial" data-g="'+id+'">'+(s==="passed"?"Retake":"Begin")+' the trial (6 words)</button>';
  app.innerHTML = h;
}
var T = null;
function startTrial(id){
  var g=S[id], items=shuffle(g.trial).slice(0,6);
  T={g:id, items:items, i:0, hits:0, answered:false, picked:-1, opts:null};
  renderTrial();
}
function renderTrial(){
  var g=S[T.g], it=T.items[T.i];
  if(!T.opts){ var others=shuffle(g.trial.filter(function(x){return x[1]!==it[1];})).slice(0,3).map(function(x){return x[1];}); T.opts=shuffle([it[1]].concat(others)); }
  var h = topbar(g.name+" trial", '<span class="pill">'+(T.i+1)+'/6</span>');
  h += '<div class="card"><p class="q" style="margin-top:0">'+esc(g.prompt)+'</p><div class="tiles" style="justify-content:center">';
  Array.from(it[0]).forEach(function(c){ h += '<button class="tile" data-act="letter" data-s="'+T.g+'" data-c="'+esc(c)+'">'+esc(c)+'</button>'; });
  h += '</div><div class="letterinfo" id="linfo"><span class="muted small">Stuck? Tap a letter for its sound.</span></div><div class="sep"></div><div class="opts">';
  T.opts.forEach(function(o,i){ var cls=""; if(T.answered){ if(o===it[1]) cls=" right"; else if(i===T.picked) cls=" wrong"; }
    h += '<button class="opt'+cls+'" data-act="tpick" data-i="'+i+'"'+(T.answered?" disabled":"")+'><span class="of">'+esc(o)+'</span></button>'; });
  h += '</div>';
  if(T.answered){
    h += '<div class="sep"></div><div class="row">'+(canSpeak?'<button class="btn" data-act="speak" data-t="'+esc(it[0])+'" data-l="'+g.lang+'">🔊 Hear it</button>':"")+
      '<button class="btn primary" data-act="tnext">'+(T.i<5?"Next →":"Finish")+'</button></div>';
  }
  app.innerHTML = h+'</div>';
}
function finishTrial(){
  var g=S[T.g], pass=T.hits>=4, prevPassed = st.gates[T.g]&&st.gates[T.g].passed;
  var rec = st.gates[T.g]||{passed:false,best:0}; rec.best=Math.max(rec.best,T.hits); if(pass) rec.passed=true; st.gates[T.g]=rec; save();
  var nextId = S.order[S.order.indexOf(T.g)+1], next = nextId?S[nextId]:null;
  var h = topbar(g.name+" trial") + '<div class="card" style="text-align:center"><p class="score">'+T.hits+'/6</p>';
  if(pass){
    h += '<h3>'+(prevPassed?"Gate mastered again!":"The "+esc(g.name)+" Gate is open!")+'</h3>';
    if(next) h += '<p class="muted">'+(next.ready?"Next unlocked: <b>"+esc(next.name)+"</b>.":"Next up: "+esc(next.name)+" (coming soon).")+'</p>';
  } else h += '<h3>So close.</h3><p class="muted">You need 4 of 6 to pass. Study the letters and try again.</p>';
  h += '<div class="row">'+(pass&&next&&next.ready?'<button class="btn primary" data-act="opengate" data-g="'+nextId+'">'+esc(next.name)+' Gate →</button>':(pass?'<button class="btn primary" data-act="trial" data-g="'+T.g+'">Retake trial</button>':'<button class="btn primary" data-act="trial" data-g="'+T.g+'">Try again</button>'))+
       '<button class="btn" data-act="gates">All gates</button></div></div>';
  app.innerHTML = h;
}

/* ---------- codex ---------- */
function renderCodex(){
  var found = W.filter(function(w){return st.played[w.id];});
  var h = topbar("Root Codex", '<span class="pill">'+found.length+'/'+W.length+'</span>') + '<p class="muted" style="margin-top:0">Every root you\'ve reached. Tap one to revisit its full chain.</p><div class="codex">';
  found.forEach(function(w){ h += '<button class="rootcard" data-act="codexword" data-id="'+w.id+'"><div class="rf">'+esc(w.root.f)+'</div><div class="rg">'+esc(w.root.l)+' · “'+esc(w.root.g)+'”</div><div class="rw">'+esc(w.w)+'</div></button>'; });
  for(var i=found.length;i<W.length;i++) h += '<div class="rootcard lock">?</div>';
  h += '</div>';
  if(!found.length) h = h.replace('<div class="codex">','<div class="card" style="margin-bottom:12px">Your Codex is empty. Finish a dig to record your first root.</div><div class="codex">');
  app.innerHTML = h;
}
function codexModal(id){
  var w=byId(id), h='<h3>'+esc(w.w)+' '+SB(w.w,"English")+'</h3><p class="muted" style="margin-top:0">'+esc(w.def)+'</p><div class="chain">';
  w.L.forEach(function(L){ h += '<div><span class="dim small">'+esc(L.l)+'</span><br><b class="sc">'+(L.glyph?GLYPH[L.glyph]:"")+esc(L.f)+'</b> '+SB(L.f,L.l)+' <i class="muted">“'+esc(L.g)+'”</i>'+SH(L.f,L.l)+'<div class="small muted">'+esc(L.why)+'</div></div>'; });
  h += '</div><h3 style="font-size:18px">Cousins</h3><p class="sc">'+w.C.map(function(c){return esc(c.n)+' '+SB(c.n,c.l)+(c.t?" ("+esc(c.t)+")":"")+' <span class="dim small">'+esc(c.l)+'</span>';}).join(" · ")+'</p>';
  if(w.note) h += '<div class="note">'+esc(w.note)+'</div>';
  h += '<div class="row"><button class="btn primary" data-act="replay" data-id="'+id+'">⛏ Dig again</button><button class="btn" data-act="close">Close</button></div>';
  modal(h);
}

/* ---------- events ---------- */
document.addEventListener("click", function(e){
  var el = e.target.closest("[data-act]"); if(!el) return;
  var a = el.getAttribute("data-act"), d = el.dataset;
  switch(a){
    case "home": if(screen==="home") return; try{ history.back(); }catch(_){ go("home",null,true); } setTimeout(function(){ if(screen!=="home") go("home",null,true); },60); break;
    case "close": closeModal(); break;
    case "daily": go("round",{word:dailyWord(denverDate()),daily:true}); break;
    case "free": closeModal(); var tr=d.track||"all"; var wd=pickFree(tr); screen="round"; try{ history.pushState({s:"round"},""); }catch(_){} startRound(wd,false,tr); window.scrollTo(0,0); break;
    case "replay": closeModal(); go("round",{word:byId(d.id),daily:false,track:"all"}); break;
    case "gates": go("gates"); break;
    case "codex": go("codex"); break;
    case "codexword": codexModal(d.id); break;
    case "dig": R.stage="dig"; renderRound(); break;
    case "pick":
      if(R.answered) return; var i=+d.i, ok=R.opts[i].ok; R.answered=true; R.picked=i; R.results.push(ok); R.justDug=true;
      if(ok){ R.score+=10; buzz(25); } else buzz([40,60,40]);
      renderRound();
      var btn=document.querySelector('.opt[data-i="'+i+'"]'); if(btn){ if(ok) dust(btn); else btn.classList.add("shake"); }
      var fb=document.querySelector(".feedback"); if(fb && fb.getBoundingClientRect().bottom>innerHeight) fb.scrollIntoView({behavior:"smooth",block:"center"});
      break;
    case "next": R.layer++; R.answered=false; R.picked=-1; R.opts=null; R.justDug=false; renderRound();
      var q=document.querySelector(".q"); if(q&&q.getBoundingClientRect().top<0) q.scrollIntoView({behavior:"smooth"}); break;
    case "tocousins": R.stage="cousins"; renderRound(); window.scrollTo(0,0); break;
    case "audiocredits": e.preventDefault(); if(window.RLSay) modal(RLSay.creditsHTML()); break;
    case "letters": var c=R.word.C[+d.i]; lettersModal(c.n,c.t,c.g,c.l); break;
    case "region": var r=d.r, cards=document.querySelectorAll('.cousin[data-region="'+r+'"]');
      if(cards.length){ cards[0].scrollIntoView({behavior:"smooth",block:"center"}); cards.forEach(function(x){ x.classList.remove("shake"); void x.offsetWidth; x.classList.add("shake"); }); } break;
    case "letter": var box=document.getElementById("linfo"); if(box) box.innerHTML=letterInfoHTML(d.s,d.c);
      document.querySelectorAll(".tile.sel").forEach(function(x){x.classList.remove("sel");}); el.classList.add("sel"); break;
    case "speak": speak(d.t,d.l); break;
    case "opengate": closeModal(); if(gateStatus(d.g)==="soon"){ toast(S[d.g].name+" gate: coming soon"); break; } go("gate",d.g); break;
    case "gatesoon": modal('<h3>'+esc(S[d.g].name)+' <span class="sc">'+esc(S[d.g].native)+'</span></h3><p>'+esc(S[d.g].blurb)+'</p><p class="muted">This gate is coming soon.</p><button class="btn primary" data-act="close">OK</button>'); break;
    case "tobonus": R.stage="bonus"; renderRound(); window.scrollTo(0,0); break;
    case "chip": if(R.bonusChecked) return; R.bonusSel[+d.i]=!R.bonusSel[+d.i]; el.classList.toggle("sel"); break;
    case "checkbonus":
      var pts=0, hits=0; R.bonusList.forEach(function(b,i){ if(R.bonusSel[i]){ if(b.ok){pts+=5;hits++;} else pts-=2; } });
      R.bonusPts=Math.max(0,pts); R.bonusHits=hits; R.score+=R.bonusPts; R.bonusChecked=true; if(hits) buzz(25); renderRound(); break;
    case "finish": finishRound(); break;
    case "sharedaily": shareDaily(); break;
    case "trial": startTrial(d.g); window.scrollTo(0,0); break;
    case "tpick": if(T.answered) return; var ti=+d.i, tok=T.opts[ti]===T.items[T.i][1]; T.answered=true; T.picked=ti; if(tok){T.hits++;buzz(25);} else buzz([40,60,40]);
      renderTrial(); var tb=document.querySelector('.opt[data-i="'+ti+'"]'); if(tb){ if(tok) dust(tb); else tb.classList.add("shake"); } break;
    case "tnext": if(T.i<5){ T.i++; T.answered=false; T.picked=-1; T.opts=null; renderTrial(); } else finishTrial(); break;
  }
});

/* expose for tests */
window.ROOTLINE = {state:function(){return st;}, round:function(){return R;}, dailyWord:dailyWord, denverDate:denverDate,
  ui:{esc:esc, toast:toast, modal:modal, closeModal:closeModal, topbar:topbar, buzz:buzz, dust:dust, go:go}};
renderHome();
if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){ window.addEventListener("load",function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); }); }
})();
