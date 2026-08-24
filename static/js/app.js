
"use strict";

// ------------------------------------------------------------
// Helpers / data
// ------------------------------------------------------------
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rint = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

function readJSON(id){
  try { return JSON.parse(document.getElementById(id)?.textContent || "{}"); }
  catch(e){ console.error("JSON parse failed", id, e); return {}; }
}
const animationData = readJSON("lessonAnimationData");
const lessonData = readJSON("lessonData");

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------
function initTabs(){
  $$(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab-btn").forEach(x=>x.classList.remove("active"));
      $$(".tab-panel").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      $("#tab-"+btn.dataset.tab)?.classList.add("active");
      if(btn.dataset.tab === "practice") ensurePractice();
    });
  });
}

// ------------------------------------------------------------
// Progress
// ------------------------------------------------------------
const PROGRESS_KEY = "mathTutorProgressV3";
function getProgress(){
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{"completed":[]}'); }
  catch(e){ return {completed:[]}; }
}
function saveProgress(p){ localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
function isComplete(id){ return getProgress().completed.includes(Number(id)); }
function setComplete(id, yes){
  const p=getProgress(), set=new Set(p.completed), n=Number(id);
  yes ? set.add(n) : set.delete(n);
  p.completed=[...set].sort((a,b)=>a-b); saveProgress(p); refreshProgress();
}
function refreshProgress(){
  const p=getProgress();
  $$("[data-lesson-id]").forEach(card=>{
    const id=Number(card.dataset.lessonId);
    let prereqs=[]; try{ prereqs=JSON.parse(card.dataset.prereqs||"[]"); }catch(e){}
    const done=p.completed.includes(id), ready=prereqs.every(x=>p.completed.includes(Number(x)));
    card.classList.toggle("completed", done);
    card.classList.toggle("locked", !done && !ready);
    const status=$(".status-pill,.curr-status",card);
    if(status) status.textContent=done?"Complete":ready?"Ready":"Locked";
  });
  const total=$$(".lesson-card").length || 68, done=p.completed.length;
  const pct=Math.min(100,Math.round(done/total*100));
  if($("#progressPct")) $("#progressPct").textContent=pct+"%";
  if($("#progressText")) $("#progressText").textContent=`${done} of ${total} lessons complete`;
  if($("#progressRing")) $("#progressRing").style.background=`conic-gradient(var(--accent) ${pct}%, #1a2734 ${pct}% 100%)`;
  const b=$("#markComplete");
  if(b){
    const id=Number(b.dataset.lessonId), doneHere=isComplete(id);
    b.textContent=doneHere?"Completed ✓":"Mark complete";
    b.classList.toggle("done",doneHere);
  }
}
function initProgress(){
  $("#markComplete")?.addEventListener("click",e=>{
    const id=Number(e.currentTarget.dataset.lessonId);
    setComplete(id,!isComplete(id));
  });
  $("#resetProgress")?.addEventListener("click",()=>{
    if(confirm("Reset all Math Tutor progress stored in this browser?")){
      localStorage.removeItem(PROGRESS_KEY); refreshProgress();
    }
  });
  refreshProgress();
}

// ------------------------------------------------------------
// Animation engine
// ------------------------------------------------------------
const canvas=$("#visualCanvas");
let stepFns=[], stepIndex=0, replayToken=0;

function clearCanvas(){
  if(canvas) canvas.innerHTML="";
  stepFns=[]; stepIndex=0;
}
function elem(tag, cls="", text=""){
  const n=document.createElement(tag); if(cls)n.className=cls;
  if(text!=="")n.textContent=text; return n;
}
function caption(text){
  const c=elem("div","viz-caption",text); return c;
}
function addStep(fn){ stepFns.push(fn); }

function buildGeneric(data){
  clearCanvas();
  const w=elem("div","viz-stack");
  const p=elem("div","generic-problem",data.problem||"Lesson");
  const c=caption("Press Next step or Replay.");
  w.append(p,c); canvas.append(w);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{c.textContent=s; p.classList.add("pulse"); setTimeout(()=>p.classList.remove("pulse"),450);}));
}

// Linux terminal simulator
function buildLinux(data){
  clearCanvas();
  const term=elem("div","terminal-sim");
  term.innerHTML=`<div class="terminal-bar"><span></span><span></span><span></span><b>richmack@math-tutor</b></div>
  <div class="terminal-screen"><div class="terminal-history"></div><div class="terminal-line"><span class="prompt">richmack@lab:~$</span> <span class="cursor">▋</span></div></div>`;
  const note=caption("Watch each command run in a simulated Linux terminal.");
  const wrap=elem("div","viz-stack"); wrap.append(term,note); canvas.append(wrap);
  const hist=$(".terminal-history",term);
  const cmds=(data.steps||[]);
  const outputs={
    "pwd":"/home/richmack",
    "ls -lah":"total 28K\ndrwxr-xr-x  6 richmack staff 192 Aug 24 .\ndrwxr-xr-x 12 richmack staff 384 Aug 24 ..\n-rw-r--r--  1 richmack staff 1.2K notes.txt",
    "cd /var/log":"(directory changed to /var/log)",
    "cd ~":"(back to /home/richmack)",
    "ps aux":"USER       PID  %CPU %MEM COMMAND\nrichmack  4242   2.1  1.4 python app.py",
    "top":"Processes, CPU and memory update live...",
    "kill 4242":"SIGTERM sent to PID 4242",
    "kill -9 4242":"SIGKILL sent to PID 4242",
    "ip addr":"inet 192.168.1.42/24  scope global en0",
    "ip route":"default via 192.168.1.1 dev en0",
    "ss -lntp":"LISTEN 0 128 0.0.0.0:5055 users:((python,pid=4242))",
    "systemctl status nginx":"● nginx.service - active (running)",
    "sudo systemctl start nginx":"nginx.service started",
    "sudo systemctl enable nginx":"Created symlink for nginx.service",
  };
  cmds.forEach((cmd,i)=>addStep(async()=>{
    const line=elem("div","term-entry");
    const command=elem("div","term-command",`richmack@lab:~$ ${cmd}`);
    const out=elem("pre","term-output",outputs[cmd]||`✓ ${cmd}`);
    line.append(command,out); hist.append(line);
    note.textContent=(data.explanations||[])[i]||cmd;
    term.querySelector(".terminal-screen").scrollTop=99999;
  }));
}

// Statistics visualization
function buildStatistics(data){
  clearCanvas();
  const wrap=elem("div","viz-stack");
  const chart=elem("div","stat-chart");
  const vals=[3,5,5,7,10];
  vals.forEach((v,i)=>{
    const col=elem("div","stat-col");
    const bar=elem("div","stat-bar"); bar.style.height="0";
    const label=elem("span","",String(v));
    col.append(bar,label); chart.append(col);
    setTimeout(()=>bar.style.height=(v*16)+"px",100+i*90);
  });
  const c=caption("Statistics turns a set of observations into a picture of center and spread.");
  wrap.append(chart,c); canvas.append(wrap);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{
    c.textContent=s;
    $$(".stat-bar",chart).forEach((b,j)=>b.classList.toggle("focus",j===i%vals.length));
  }));
}

// Calculus animated secant -> tangent / accumulation
function buildCalculus(data){
  clearCanvas();
  const wrap=elem("div","calc-wrap");
  const graph=elem("div","calc-graph");
  graph.innerHTML=`<svg viewBox="0 0 520 260">
   <line x1="35" y1="220" x2="495" y2="220" class="axis"/>
   <line x1="55" y1="240" x2="55" y2="20" class="axis"/>
   <path d="M55 215 Q180 205 270 150 T480 35" class="curve"/>
   <line x1="150" y1="195" x2="400" y2="70" class="secant"/>
   <circle cx="270" cy="150" r="7" class="point"/>
  </svg>`;
  const formula=elem("div","calc-formula",data.problem||"");
  const c=caption("A calculus picture: values change continuously.");
  wrap.append(graph,formula,c); canvas.append(wrap);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{
    c.textContent=s;
    $(".secant",graph).style.transform=`rotate(${Math.max(0,12-i*4)}deg)`;
    formula.textContent=s;
  }));
}

// Chemistry visualization
function buildChemistry(data){
  clearCanvas();
  const wrap=elem("div","chem-wrap");
  const molecule=elem("div","molecule");
  molecule.innerHTML=`<div class="atom oxygen">O</div><div class="bond b1"></div><div class="bond b2"></div><div class="atom hydrogen h1">H</div><div class="atom hydrogen h2">H</div>`;
  const c=caption("Chemistry connects particles, amounts, equations, and measurable quantities.");
  const eq=elem("div","chem-equation",data.problem||"");
  wrap.append(molecule,eq,c); canvas.append(wrap);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{
    c.textContent=(data.explanations||[])[i]||s; eq.textContent=s;
    $$(".atom",molecule).forEach(a=>{a.classList.remove("bounce"); void a.offsetWidth; a.classList.add("bounce");});
  }));
}

// Trig triangle
function buildTrig(data){
  clearCanvas();
  const wrap=elem("div","trig-wrap");
  wrap.innerHTML=`<svg viewBox="0 0 520 300" class="trig-svg">
   <polygon points="70,245 430,245 430,70" class="triangle"/>
   <rect x="405" y="220" width="25" height="25" class="rightbox"/>
   <text x="245" y="278">Adjacent</text>
   <text x="440" y="165">Opposite</text>
   <text x="205" y="145" transform="rotate(-25 205 145)">Hypotenuse</text>
   <path d="M110 245 A45 45 0 0 1 150 225" class="angle"/>
   <text x="120" y="222">θ</text>
  </svg>`;
  const eq=elem("div","trig-equation",data.problem||"");
  const c=caption("Label the triangle relative to θ before choosing a trig rule.");
  wrap.append(eq,c); canvas.append(wrap);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{
    eq.textContent=s; c.textContent=(data.explanations||[])[i]||s;
    $$(".trig-svg text").forEach((t,j)=>t.classList.toggle("hot",j===i%4));
  }));
}

// PMP dashboard
function buildPmp(data){
  clearCanvas();
  const wrap=elem("div","pmp-wrap");
  const cards=elem("div","pmp-cards");
  ["PV","EV","AC","CPI","SPI"].forEach((name,i)=>{
    const card=elem("div","pmp-card");
    card.innerHTML=`<small>${name}</small><strong>${["100","90","95","0.95","0.90"][i]}</strong>`;
    cards.append(card);
  });
  const meter=elem("div","pmp-meter"); meter.innerHTML=`<div class="pmp-fill"></div>`;
  const c=caption("PMP math turns project status into comparable performance measures.");
  const eq=elem("div","pmp-eq",data.problem||"");
  wrap.append(cards,meter,eq,c); canvas.append(wrap);
  (data.steps||[]).forEach((s,i)=>addStep(()=>{
    eq.textContent=s; c.textContent=(data.explanations||[])[i]||s;
    $(".pmp-fill",meter).style.width=Math.min(100,35+i*15)+"%";
    $$(".pmp-card",cards).forEach((x,j)=>x.classList.toggle("focus",j===i%5));
  }));
}

// Existing visual families
function buildLongDivision(data){
  clearCanvas();
  const w=elem("div","ld2-wrap");
  w.innerHTML=`<div class="ld2-shortcut">How many? → Times → Take away → Drop</div>
  <div class="ld2-problem"><div class="ld2-quotient" id="ldQ"></div><div class="ld2-divisor">${data.divisor}</div>
  <div class="ld2-bracket"></div><div class="ld2-dividend">${data.dividend}</div><div class="ld2-work" id="ldWork"></div></div>
  <div class="ld2-explain">Press Next step or Replay.</div>`;
  canvas.append(w);
  const q=$("#ldQ",w), work=$("#ldWork",w), info=$(".ld2-explain",w);
  addStep(()=>info.textContent=`Start ${data.dividend} ÷ ${data.divisor} at the left.`);
  (data.cycles||[]).forEach(cycle=>{
    addStep(()=>{q.textContent=q.textContent.replace(/ R\d+$/,"")+cycle.q;info.textContent=`How many? ${cycle.chunk} ÷ ${data.divisor} gives ${cycle.q}.`;});
    addStep(()=>{const b=elem("div","ld2-line");b.innerHTML=`<div class="ld2-subtract">− ${cycle.product}</div><div class="ld2-rule"></div><div class="ld2-rem">${cycle.remainder}</div>`;work.append(b);info.textContent=`Times and take away: ${cycle.q} × ${data.divisor} = ${cycle.product}; remainder ${cycle.remainder}.`;});
    if(cycle.drop)addStep(()=>{const d=elem("span","ld2-drop",cycle.drop);work.lastElementChild.querySelector(".ld2-rem").append(d);requestAnimationFrame(()=>d.classList.add("show"));info.textContent=`Drop ${cycle.drop}.`;});
  });
  addStep(()=>{q.textContent=data.quotient;q.classList.add("answer");info.textContent=`Answer: ${data.quotient}`;});
}
function buildFractions(data){ buildGeneric(data); }
function buildRatio(data){ buildGeneric(data); }
function buildPercent(data){ buildGeneric(data); }
function buildAlgebra(data){ buildGeneric(data); }
function buildCross(data){ buildGeneric(data); }

function buildAnimation(){
  if(!canvas)return;
  replayToken++;
  const type=animationData.type || "generic";
  const map={
    long_division:buildLongDivision,
    fractions:buildFractions,
    ratio:buildRatio,
    percent:buildPercent,
    algebra:buildAlgebra,
    cross:buildCross,
    statistics:buildStatistics,
    calculus:buildCalculus,
    chemistry:buildChemistry,
    trig:buildTrig,
    pmp:buildPmp,
    linux:buildLinux,
    generic:buildGeneric
  };
  (map[type]||buildGeneric)(animationData);
}
function nextAnimationStep(){
  if(stepIndex<stepFns.length){
    const fn=stepFns[stepIndex++]; fn();
  }
}
async function replayAnimation(){
  buildAnimation();
  const token=++replayToken;
  await sleep(250);
  while(stepIndex<stepFns.length && token===replayToken){
    nextAnimationStep(); await sleep(950);
  }
}
function initAnimation(){
  if(!canvas)return;
  buildAnimation();
  $("#stepBtn")?.addEventListener("click",nextAnimationStep);
  $("#resetBtn")?.addEventListener("click",buildAnimation);
  $("#replayBtn")?.addEventListener("click",replayAnimation);
}

// ------------------------------------------------------------
// Practice engine
// ------------------------------------------------------------
let practice={correct:0,attempts:0,streak:0,current:null};
function gcd(a,b){ while(b){[a,b]=[b,a%b]} return Math.abs(a); }
function norm(s){
  return String(s??"").trim().toLowerCase()
    .replace(/remainder/g,"r").replace(/\s+/g," ")
    .replace(/[−–—]/g,"-").replace(/\s*r\s*/g," r");
}
function makeDivision(diff){
  const d=rint(2,diff==="easy"?6:diff==="standard"?9:15), q=rint(8,diff==="challenge"?250:99);
  const rem=Math.random()<.4?rint(1,d-1):0, n=d*q+rem;
  return {prompt:`${n} ÷ ${d}`,answer:rem?`${q} R${rem}`:`${q}`,hint:`Use How many → Times → Take away → Drop. Check ${d} × ${q}${rem?` + ${rem}`:""}.`};
}
function makeFraction(){
  const d1=rint(2,9),d2=rint(2,9),n1=rint(1,d1-1),n2=rint(1,d2-1);
  const den=d1*d2,num=n1*d2+n2*d1,g=gcd(num,den);
  return {prompt:`${n1}/${d1} + ${n2}/${d2}`,answer:`${num/g}/${den/g}`,hint:"Find a common denominator, rename, add numerators, simplify."};
}
function makeRatio(){ const a=rint(2,9),b=rint(2,12),k=rint(2,8);return {prompt:`${a}/${b} = x/${b*k}`,answer:String(a*k),hint:`Cross multiply: ${a} × ${b*k} = ${b}x.`};}
function makePercent(){const p=[10,20,25,30,40,50,60,75][rint(0,7)],n=rint(2,20)*10;return {prompt:`${p}% of ${n}`,answer:String(p*n/100),hint:`Convert ${p}% to ${p/100}, then multiply.`};}
function makeAlgebra(){const x=rint(2,15),a=rint(2,8),b=rint(1,12),rhs=a*x+b;return {prompt:`${a}x + ${b} = ${rhs}`,answer:String(x),hint:`Subtract ${b}, then divide by ${a}.`};}
function makePemdas(){const a=rint(2,9),b=rint(2,9),c=rint(2,7);return {prompt:`${a} + ${b} × ${c}`,answer:String(a+b*c),hint:"Multiply before adding."};}
function makeGeometry(){const a=rint(3,12),b=rint(2,10);return {prompt:`Rectangle ${a} by ${b}: area?`,answer:String(a*b),hint:`Area=${a}×${b}.`};}
function makeStatistics(){
  const vals=Array.from({length:5},()=>rint(1,15)).sort((a,b)=>a-b),sum=vals.reduce((a,b)=>a+b,0);
  return {prompt:`Mean of ${vals.join(", ")}`,answer:String(Number((sum/5).toFixed(2))),hint:`Add to get ${sum}; divide by 5.`};
}
function makeCalculus(){
  const c=rint(1,6),n=rint(2,6);
  return {prompt:`Differentiate ${c}x^${n}`,answer:`${c*n}x^${n-1}`,hint:`Power rule: coefficient × ${n}; exponent becomes ${n-1}.`};
}
function makeChemistry(){
  const n=rint(1,5),ans=(n*6.022).toFixed(3);
  return {prompt:`Particles in ${n} mol? Give coefficient ×10^23`,answer:`${ans}×10^23`,hint:`${n} × 6.022×10^23.`};
}
function makeTrig(){
  const arr=[[3,4,5],[5,12,13],[8,15,17]],t=arr[rint(0,2)];
  return {prompt:`Right triangle legs ${t[0]} and ${t[1]}. Hypotenuse?`,answer:String(t[2]),hint:"Use a²+b²=c²."};
}
function makePmp(){
  const ev=rint(60,140),ac=rint(60,140),ans=Number((ev/ac).toFixed(2));
  return {prompt:`EV=${ev}, AC=${ac}. CPI to 2 decimals?`,answer:String(ans),hint:`CPI=EV/AC=${ev}/${ac}.`};
}
function makeLinux(){
  const q=[
    ["Print current directory","pwd","PWD means present working directory."],
    ["List listening TCP ports","ss -lntp","ss shows sockets; -lntp narrows to listening TCP with PIDs."],
    ["Follow nginx logs","journalctl -u nginx -f","-u selects the service; -f follows."],
    ["Make script executable","chmod +x script.sh","chmod changes permissions; +x adds execute."],
    ["Go to parent directory","cd ..","Two dots represent the parent directory."],
    ["Show IP addresses","ip addr","ip addr displays interface addresses."]
  ][rint(0,5)];
  return {prompt:q[0],answer:q[1],hint:q[2]};
}
function makeGeneric(){return {prompt:lessonData.practice||"Try the lesson problem.",answer:String(lessonData.practice_answer||""),hint:lessonData.shortcut||"Use the lesson shortcut."};}

function generatePractice(){
  if(!$("#generatedProblem"))return;
  const type=lessonData.generator?.type||"generic",diff=$("#difficultySelect")?.value||"standard";
  const map={division:makeDivision,fraction:makeFraction,ratio:makeRatio,percent:makePercent,algebra:makeAlgebra,pemdas:makePemdas,geometry:makeGeometry,statistics:makeStatistics,calculus:makeCalculus,chemistry:makeChemistry,trig:makeTrig,pmp:makePmp,linux:makeLinux,generic:makeGeneric};
  practice.current=(map[type]||makeGeneric)(diff);
  $("#generatedProblem").textContent=practice.current.prompt;
  $("#practiceAnswer").value="";
  $("#feedback").textContent=""; $("#feedback").className="feedback";
  $("#hintBox").textContent=""; $("#hintBox").classList.remove("show");
}
function ensurePractice(){ if($("#generatedProblem") && !practice.current)generatePractice(); }
function checkPractice(){
  ensurePractice(); if(!practice.current)return;
  practice.attempts++;
  const ok=norm($("#practiceAnswer").value)===norm(practice.current.answer);
  if(ok){practice.correct++;practice.streak++;$("#feedback").textContent="Correct ✓ Great work.";$("#feedback").className="feedback good";}
  else{practice.streak=0;$("#feedback").textContent="Not yet. Use the hint and try again.";$("#feedback").className="feedback bad";}
  $("#correctCount").textContent=practice.correct;$("#attemptCount").textContent=practice.attempts;$("#streakCount").textContent=practice.streak;
}
function initPractice(){
  if(!$("#generatedProblem"))return;
  generatePractice();
  $("#newProblem")?.addEventListener("click",generatePractice);
  $("#checkAnswer")?.addEventListener("click",checkPractice);
  $("#showHint")?.addEventListener("click",()=>{ensurePractice();$("#hintBox").textContent=practice.current.hint;$("#hintBox").classList.add("show");});
  $("#practiceAnswer")?.addEventListener("keydown",e=>{if(e.key==="Enter")checkPractice();});
  $("#difficultySelect")?.addEventListener("change",generatePractice);
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded",()=>{
  initTabs();
  initProgress();
  initAnimation();
  initPractice();
});


// ============================================================
// Mastery + Guided Tutor V5
// ============================================================
const MASTERY_KEY = "mathTutorMasteryV5";

function getMasteryState(){
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY) || '{"lessons":{}}'); }
  catch(e){ return {lessons:{}}; }
}
function saveMasteryState(s){ localStorage.setItem(MASTERY_KEY, JSON.stringify(s)); }

function masteryFor(id){
  const s=getMasteryState();
  return s.lessons[String(id)] || {score:0,correct:0,attempts:0,guided:0};
}
function updateMastery(id, delta, fields={}){
  if(!id)return;
  const s=getMasteryState(), key=String(id);
  const cur=s.lessons[key] || {score:0,correct:0,attempts:0,guided:0};
  cur.score=Math.max(0,Math.min(100,cur.score+delta));
  Object.entries(fields).forEach(([k,v])=>cur[k]=(cur[k]||0)+v);
  s.lessons[key]=cur; saveMasteryState(s); refreshMasteryUI();
}
function masteryLabel(score){
  if(score>=80)return "Mastered";
  if(score>=45)return "Practicing";
  return "Learning";
}
function refreshMasteryUI(){
  const s=getMasteryState();
  $$("[data-lesson-id]").forEach(card=>{
    const m=s.lessons[String(card.dataset.lessonId)] || {score:0};
    const pill=$(".mastery-pill",card);
    if(pill)pill.textContent=masteryLabel(m.score);
    const fill=$(".mastery-fill",card);
    if(fill)fill.style.width=m.score+"%";
    card.classList.toggle("mastered",m.score>=80);
  });

  const current=Number($(".mastery-card")?.dataset.currentLesson||0);
  if(current){
    const m=masteryFor(current);
    if($("#lessonMasteryLabel"))$("#lessonMasteryLabel").textContent=masteryLabel(m.score);
    if($("#lessonMasteryPct"))$("#lessonMasteryPct").textContent=m.score+"%";
    if($("#lessonMasteryFill"))$("#lessonMasteryFill").style.width=m.score+"%";
  }

  const all=Object.values(s.lessons);
  const mastered=all.filter(x=>x.score>=80).length;
  const total=Math.max(68,$$(".lesson-card").length);
  const pct=Math.round(mastered/total*100);
  if($("#progressPct"))$("#progressPct").textContent=pct+"%";
  if($("#progressText"))$("#progressText").textContent=`${mastered} mastered`;
  if($("#progressRing"))$("#progressRing").style.background=`conic-gradient(var(--accent) ${pct}%, #1a2734 ${pct}% 100%)`;

  $$(".subject-card").forEach(card=>{
    const category=card.querySelector("h3")?.textContent.trim();
    const ids=$$(`[data-category="${CSS.escape(category||"")}"]`).map(x=>Number(x.dataset.lessonId));
    if(ids.length){
      const avg=ids.reduce((sum,id)=>sum+(s.lessons[String(id)]?.score||0),0)/ids.length;
      const fill=$(".subject-progress-fill",card); if(fill)fill.style.width=avg+"%";
    }
  });

  const summary=$(".subject-summary");
  if(summary){
    const cat=summary.dataset.subject;
    const cards=$$(`[data-category="${CSS.escape(cat)}"]`);
    const count=cards.filter(c=>(s.lessons[String(c.dataset.lessonId)]?.score||0)>=80).length;
    const node=$(".subject-mastered-count",summary); if(node)node.textContent=`${count} / ${cards.length}`;
  }
}

// Guided tutor
let guidedIndex=0;
function checkpoints(){ return lessonData.guided_checkpoints || []; }
function guidedRender(){
  const cps=checkpoints();
  if(!$("#guidedPrompt"))return;
  if(!cps.length){
    $("#guidedPrompt").textContent="This lesson does not have guided checkpoints yet.";
    return;
  }
  if(guidedIndex>=cps.length){
    $("#guidedPrompt").textContent="Guided lesson complete ✓";
    $("#guidedAnswer").style.display="none";
    $("#guidedProgressFill").style.width="100%";
    updateMastery(lessonData.id,10,{guided:1});
    return;
  }
  const cp=cps[guidedIndex];
  $("#guidedPrompt").textContent=`Step ${guidedIndex+1}: ${cp.prompt}`;
  $("#guidedAnswer").value="";
  $("#guidedFeedback").textContent="";
  $("#guidedFeedback").className="feedback";
  $("#guidedHintBox").classList.remove("show");
  $("#guidedProgressFill").style.width=(guidedIndex/cps.length*100)+"%";
}
function guidedCheck(){
  const cp=checkpoints()[guidedIndex]; if(!cp)return;
  const got=norm($("#guidedAnswer").value), expected=norm(cp.answer);
  const okay=got===expected || (got.length>3 && expected.includes(got)) || (expected.length>3 && got.includes(expected));
  if(okay){
    $("#guidedFeedback").textContent="Correct ✓ Moving to the next step.";
    $("#guidedFeedback").className="feedback good";
    updateMastery(lessonData.id,8,{correct:1,attempts:1});
    setTimeout(()=>{guidedIndex++;guidedRender();},650);
  }else{
    $("#guidedFeedback").textContent="Not yet. Use the hint or reveal the worked step.";
    $("#guidedFeedback").className="feedback bad";
    updateMastery(lessonData.id,-1,{attempts:1});
  }
}
function initGuided(){
  if(!$("#guidedPrompt"))return;
  guidedRender();
  $("#guidedCheck")?.addEventListener("click",guidedCheck);
  $("#guidedAnswer")?.addEventListener("keydown",e=>{if(e.key==="Enter")guidedCheck();});
  $("#guidedHint")?.addEventListener("click",()=>{
    const cp=checkpoints()[guidedIndex]; if(!cp)return;
    $("#guidedHintBox").textContent=cp.hint;
    $("#guidedHintBox").classList.add("show");
  });
  $("#guidedReveal")?.addEventListener("click",()=>{
    const cp=checkpoints()[guidedIndex]; if(!cp)return;
    $("#guidedFeedback").textContent=`Worked step: ${cp.answer}`;
    $("#guidedFeedback").className="feedback";
    updateMastery(lessonData.id,2);
  });
}

// Hook mastery into the existing practice checker.
const _practiceCheckV4 = typeof checkPractice === "function" ? checkPractice : null;
if(_practiceCheckV4){
  checkPractice = function(){
    const before=practice.correct;
    _practiceCheckV4();
    const gained=practice.correct>before;
    if(lessonData.id) updateMastery(lessonData.id,gained?6:-1,gained?{correct:1,attempts:1}:{attempts:1});
  };
}

document.addEventListener("DOMContentLoaded",()=>{
  refreshMasteryUI();
  initGuided();
});


// ============================================================
// Rich Tutor server-side student tracking V7
// ============================================================
let rtSessionId=null, rtStartedAt=Date.now();

async function rtPost(url,data){
  try{
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),keepalive:true});
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}

async function rtStartSession(){
  if(!window.RICH_TUTOR_USER || window.RICH_TUTOR_USER.role!=="student" || !lessonData?.id)return;
  const out=await rtPost("/api/session/start",{lesson_id:lessonData.id});
  if(out?.session_id){rtSessionId=out.session_id;rtStartedAt=Date.now();}
}
function rtEndSession(){
  if(!rtSessionId)return;
  const seconds=Math.max(1,Math.round((Date.now()-rtStartedAt)/1000));
  const payload=JSON.stringify({session_id:rtSessionId,seconds});
  if(navigator.sendBeacon){
    navigator.sendBeacon("/api/session/end",new Blob([payload],{type:"application/json"}));
  }else{
    fetch("/api/session/end",{method:"POST",headers:{"Content-Type":"application/json"},body:payload,keepalive:true});
  }
  rtSessionId=null;
}
async function rtSaveGrade(score,source="practice",attempts=1){
  if(!window.RICH_TUTOR_USER || window.RICH_TUTOR_USER.role!=="student" || !lessonData?.id)return;
  await rtPost("/api/grade",{lesson_id:lessonData.id,score,source,attempts});
}

// Hook practice scoring: correct = 100, wrong attempt = 0 record only after check.
// Server mastery preserves highest submitted score.
const _rtCheck = typeof checkPractice==="function" ? checkPractice : null;
if(_rtCheck){
  checkPractice=function(){
    const before=practice.correct, attemptsBefore=practice.attempts;
    _rtCheck();
    const correct=practice.correct>before;
    rtSaveGrade(correct?100:0,"practice",practice.attempts-attemptsBefore);
  };
}

// Guided answers also become grade events.
const _rtGuided = typeof guidedCheck==="function" ? guidedCheck : null;
if(_rtGuided){
  guidedCheck=function(){
    const cp=checkpoints?.()[guidedIndex];
    const got=norm($("#guidedAnswer")?.value||"");
    const expected=cp?norm(cp.answer):"";
    const okay=!!cp && (got===expected || (got.length>3&&expected.includes(got)) || (expected.length>3&&got.includes(expected)));
    _rtGuided();
    if(cp)rtSaveGrade(okay?100:0,"guided",1);
  };
}

document.addEventListener("DOMContentLoaded",rtStartSession);
window.addEventListener("pagehide",rtEndSession);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") rtEndSession(); else if(!rtSessionId) rtStartSession(); });


// ============================================================
// Rich Tutor animated knowledge graph V8
// ============================================================
function initKnowledgeGraph(){
  const stage=document.getElementById("knowledgeStage");
  if(!stage)return;
  const svg=stage.querySelector(".knowledge-lines");
  const edges=stage.querySelector("#knowledgeEdges");
  const core=stage.querySelector(".knowledge-core");
  const nodes=[...stage.querySelectorAll(".knowledge-node")];
  const readout=stage.querySelector("#knowledgeReadout");
  const descriptions={
    "Mathematics":"Arithmetic, fractions, algebra, geometry and core problem solving.",
    "Statistics":"Data, probability, variation and inference.",
    "Chemistry":"Particles, moles, equations, stoichiometry and chemical relationships.",
    "Linux Commands":"Terminal fluency, processes, networking, permissions and services.",
    "PMP Math":"Earned value, forecasting, PERT and project-performance formulas.",
    "Calculus":"Limits, rates of change, derivatives, integrals and optimization."
  };
  function center(el){
    const a=el.getBoundingClientRect(), b=stage.getBoundingClientRect();
    return {x:a.left-b.left+a.width/2,y:a.top-b.top+a.height/2};
  }
  function draw(){
    const c=center(core), box=stage.getBoundingClientRect();
    const sx=600/box.width, sy=420/box.height;
    edges.innerHTML="";
    nodes.forEach(n=>{
      const p=center(n);
      const line=document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",c.x*sx); line.setAttribute("y1",c.y*sy);
      line.setAttribute("x2",p.x*sx); line.setAttribute("y2",p.y*sy);
      line.setAttribute("class","knowledge-edge");
      edges.appendChild(line);
    });
  }
  nodes.forEach(n=>n.addEventListener("click",()=>{
    nodes.forEach(x=>x.classList.remove("selected"));n.classList.add("selected");
    const topic=n.dataset.topic;
    readout.innerHTML=`<strong>${topic}</strong><span>${descriptions[topic]||""}</span>`;
  }));
  draw();
  if("ResizeObserver" in window)new ResizeObserver(draw).observe(stage);
  else window.addEventListener("resize",draw);
}
document.addEventListener("DOMContentLoaded",initKnowledgeGraph);
