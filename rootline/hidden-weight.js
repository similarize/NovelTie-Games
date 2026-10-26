/* Rootline "Hidden Weight" track: words whose origin carries more weight than people realise.
   Cards come only from the word bank Worker; the lexicon itself is not published.
   Per word: dig its root (pick the origin), pick a swap that keeps the meaning, then the reveal with sources.
   Swap picks are tallied on this device only (Phase 2 may upload them). Vanilla JS. */
(function(){
"use strict";
var KEY="rootline.hw", H=null, PER=5;
var hs; try{ hs=JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ hs={}; }
hs.seen=hs.seen||{}; hs.picks=hs.picks||{}; hs.rounds=hs.rounds||0; hs.best=hs.best||0;
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(hs)); }catch(e){} }
function U(){ return window.ROOTLINE.ui; }
function esc(s){ return U().esc(s); }
function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
var CAT={gendered:"Gender",ethnic:"Ethnicity & origin",disability:"Disability & health",religious:"Religion",violent:"Violent imagery",political:"Politics",drift:"Meaning drift"};
var HEAT=["Mostly harmless","Mild","Loaded","Slur"];
/* Source: the word bank Worker (ROOTLINE_BANK_CONFIG.api) serves cards without answers (GET /v1/lexicon/round) and the
   full entry per card with its signed token (GET /v1/lexicon/reveal). There is no local copy: if the Worker can't be
   reached, the track says it's offline. */
function api(){ var c=window.ROOTLINE_BANK_CONFIG; return c && c.api ? c.api.replace(/\/$/,"") : null; }
function getJSON(u){ return fetch(u,{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }); }
function serverCards(){
  var a=api(); if(!a) return Promise.reject(new Error("no api"));
  return getJSON(a+"/v1/lexicon/round?n="+PER).then(function(j){ if(!j.cards||!j.cards.length) throw new Error("empty"); return j.cards; });
}
function reveal(c, pick){
  if(c.entry && !pick) return Promise.resolve(c);
  return getJSON(api()+"/v1/lexicon/reveal?id="+encodeURIComponent(c.id)+"&t="+encodeURIComponent(c.token)+(pick?"&pick="+encodeURIComponent(pick):""))
    .then(function(j){ c.entry=j.entry; c.decoy=j.decoy; return c; });
}
function start(){
  var app=document.getElementById("app");
  app.innerHTML=U().topbar("Hidden Weight")+'<div class="card"><p class="muted" style="margin:0">Loading words…</p></div>';
  serverCards()
    .then(function(cards){ H={words:cards, src:"server", i:0, stage:"intro", score:0, hits:0, picked:-1, busy:false}; PER=cards.length; render(); })
    .catch(function(){ offline(); });
}
function offline(){
  document.getElementById("app").innerHTML=U().topbar("Hidden Weight")+'<div class="card hw-offline"><h3>Hidden Weight is offline</h3><p class="muted">We couldn\'t reach the word list just now. Try again soon.</p><button class="btn primary" data-act="hw-start">Try again</button><div class="sep"></div><button class="btn" data-act="home">Home</button></div>';
}
function srcLinks(e){
  return '<div class="rs-src">Sources: '+e.sources.map(function(s){ return '<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer" style="color:var(--gold)">'+esc(s.title)+'</a>'; }).join(" · ")+'</div>';
}
function okOf(c, act, t){ return act==="hw-root" ? t===c.entry.origin : c.entry.alternatives.indexOf(t)>=0; }
function optBtn(o,i,act,label){
  var c=H.words[H.i], cls="";
  if(H.picked>=0 && c.entry){ var ok=okOf(c,act,o.t); if(ok && (act==="hw-root"||i===H.picked)) cls=" right"; else if(i===H.picked) cls=" wrong"; }
  return '<button class="opt'+cls+'" data-act="'+act+'" data-i="'+i+'"'+(H.picked>=0?" disabled":"")+'>'+(label?'<span class="ol">'+label+'</span>':'')+'<span class="of" style="font-size:18px">'+esc(o.t)+'</span></button>';
}
function render(){
  var app=document.getElementById("app"), e=H.words[H.i], h="";
  h+=U().topbar("Hidden Weight",'<span class="pill">'+H.score+' pts</span>');
  if(H.stage==="intro"){
    h+='<div class="wordcard"><div class="tag">Hidden Weight</div><div class="w" style="font-size:clamp(34px,9vw,58px)">Words with baggage</div><div class="d">Some everyday words carry more history than we notice.</div></div><div class="sep"></div>';
    h+='<div class="card"><p style="margin-top:0">'+PER+' words. For each one: dig up its root, then pick a swap that keeps the meaning without the baggage. Every origin links to its source.</p><button class="btn primary" data-act="hw-go">⛏ Start digging</button>'+
       (hs.rounds?'<p class="small" style="margin:10px 0 0;color:var(--gold2)">Rounds played: '+hs.rounds+' · best '+hs.best+' pts</p>':'')+'</div>';
  } else if(H.stage==="done"){
    h+='<div class="wordcard"><div class="tag">Round complete</div><div class="w" style="font-size:clamp(40px,10vw,64px)">'+H.score+' pts</div><div class="d">'+H.hits+' of '+(PER*2)+' right</div></div><div class="sep"></div>';
    h+='<div class="card"><p class="muted small" style="margin-top:0">Your swap picks are saved on this device. This word list also helps <a href="https://similarize.com" target="_blank" rel="noopener" style="color:var(--gold)">Similarize</a> explain why a word may land harder than intended.</p>'+
       '<button class="btn primary" data-act="hw-start">Another round →</button><div class="sep"></div><button class="btn" data-act="home">Home</button></div>';
  } else {
    h+='<div class="progress">'+H.words.map(function(_,k){ return '<i class="'+(k<H.i||(k===H.i&&H.stage==="reveal")?"on":"")+'"></i>'; }).join("")+'</div>';
    h+='<div class="wordcard" style="padding:18px"><div class="tag">'+esc(CAT[e.category]||e.category)+' · word '+(H.i+1)+' of '+PER+'</div><div class="w" style="font-size:clamp(36px,10vw,62px)">'+esc(e.word)+'</div></div><div class="sep"></div>';
    if(H.stage==="root"){
      H.opts=e.root_options.map(function(t){ return {t:t}; });
      h+='<p class="q">Dig up the root: where does <em>'+esc(e.word)+'</em> come from?</p><div class="opts">'+H.opts.map(function(o,i){ return optBtn(o,i,"hw-root"); }).join("")+'</div>';
      if(H.picked>=0 && e.entry){ var ok=okOf(e,"hw-root",H.opts[H.picked].t);
        h+='<div class="feedback '+(ok?"good":"bad")+'"><b>'+(ok?"Struck it! +10":"Not quite.")+'</b><br>'+esc(e.entry.origin)+'</div><div class="sep"></div><button class="btn primary" data-act="hw-toswap">Next: pick a swap →</button>'; }
    } else if(H.stage==="swap"){
      H.opts=e.swap_options.map(function(t){ return {t:t}; });
      h+='<p class="q">Pick a swap for <em>'+esc(e.word)+'</em> that keeps the meaning without the baggage.</p><div class="opts">'+H.opts.map(function(o,i){ return optBtn(o,i,"hw-swap"); }).join("")+'</div>';
      if(H.picked>=0 && e.entry){ var o=H.opts[H.picked], sok=okOf(e,"hw-swap",o.t), E=e.entry;
        h+='<div class="feedback '+(sok?"good":"bad")+'"><b>'+(sok?"Good swap! +10":"That one carries its own weight.")+'</b><br>'+
          (sok?(o.t===E.neutral_swap?"That's the top-ranked swap.":"Top-ranked swap: "+esc(E.neutral_swap)+"."):(e.decoy?esc(e.decoy.word)+": "+esc(e.decoy.why_it_lands)+" ":"")+"Try: "+esc(E.neutral_swap)+".")+
          '</div><div class="sep"></div><button class="btn primary" data-act="hw-reveal">See why →</button>'; }
    } else if(H.stage==="reveal"){
      var c0=e; e=e.entry;
      h+='<div class="card"><h3>Why “'+esc(e.word)+'” lands</h3><p style="margin-top:0">'+esc(e.why_it_lands)+'</p>'+
        '<p class="muted small" style="margin:6px 0"><b style="color:var(--gold2)">Root:</b> '+esc(e.origin)+'</p>'+
        '<p class="muted small" style="margin:6px 0"><b style="color:var(--gold2)">Weight:</b> '+HEAT[e.heat]+' · <b style="color:var(--gold2)">Swaps:</b> '+e.alternatives.map(esc).join(", ")+'</p>'+
        (e.cross_lang&&e.cross_lang.length?'<p class="muted small" style="margin:6px 0"><b style="color:var(--gold2)">Other languages:</b> '+e.cross_lang.map(function(c){ return esc(c.lang)+' <i>'+esc(c.word)+'</i> ('+esc(c.note)+')'; }).join("; ")+'</p>':'')+
        srcLinks(e)+'<div class="sep"></div><button class="btn primary" data-act="hw-next">'+(H.i<PER-1?"Next word →":"Finish round")+'</button></div>';
    }
  }
  app.innerHTML=h;
}
function homeCard(){
  return '<div class="card hw-home"><h3>⚖️ Hidden Weight</h3><p class="muted small" style="margin-top:0">Words that carry more history than we notice. Dig up the root, then find a better swap.</p>'+
    '<button class="btn primary" data-act="hw-start">Play Hidden Weight</button></div>';
}
document.addEventListener("click",function(ev){
  var el=ev.target.closest("[data-act]"); if(!el) return;
  var a=el.getAttribute("data-act");
  if(a==="hw-start"){ window.ROOTLINE.ui.go("hw"); return; }
  if(!H) return;
  if(a==="hw-go"){ H.stage="root"; H.opts=null; H.picked=-1; render(); }
  else if(a==="hw-root"||a==="hw-swap"){
    if(H.picked>=0||H.busy) return; var i=+el.dataset.i, c=H.words[H.i], t=H.opts[i].t; H.busy=true;
    reveal(c, a==="hw-swap" && c.entry && c.entry.alternatives.indexOf(t)<0 ? t : null).then(function(){
      H.busy=false; H.picked=i; var ok=okOf(c,a,t);
      if(ok){ H.score+=10; H.hits++; U().buzz(25); } else U().buzz([40,60,40]);
      if(a==="hw-swap"){ hs.picks[c.id]=hs.picks[c.id]||{}; hs.picks[c.id][t]=(hs.picks[c.id][t]||0)+1; save(); }
      render(); var b=document.querySelector('.opt[data-i="'+i+'"]'); if(b){ if(ok) U().dust(b); else b.classList.add("shake"); }
      var fb=document.querySelector(".feedback"); if(fb && fb.getBoundingClientRect().bottom>innerHeight) fb.scrollIntoView({behavior:"smooth",block:"center"});
    }).catch(function(){ H.busy=false; U().toast("Hidden Weight is offline. Try again soon."); });
  }
  else if(a==="hw-toswap"){ H.stage="swap"; H.opts=null; H.picked=-1; render(); }
  else if(a==="hw-reveal"){ H.stage="reveal"; hs.seen[H.words[H.i].id]=1; save(); render(); window.scrollTo(0,0); }
  else if(a==="hw-next"){
    if(H.i<PER-1){ H.i++; H.stage="root"; H.opts=null; H.picked=-1; render(); window.scrollTo(0,0); }
    else { H.stage="done"; hs.rounds++; if(H.score>hs.best) hs.best=H.score; save(); render(); window.scrollTo(0,0); }
  }
});
window.RootlineHW={start:start, homeCard:homeCard, state:function(){ return H; }};
})();
