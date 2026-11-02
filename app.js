(() => {
  const $ = id => document.getElementById(id);
  const API = (window.SALAVAT_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
  const KEY = "salavat-smart-v2";
  const dhikr = {
    salavat: ["اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَآلِ مُحَمَّدٍ", "خدایا بر محمد و خاندان محمد درود فرست."],
    istighfar: ["أَسْتَغْفِرُ اللَّهَ رَبِّي وَأَتُوبُ إِلَيْهِ", "از خداوند، پروردگارم، آمرزش می‌خواهم و به سوی او بازمی‌گردم."],
    tasbih: ["سُبْحَانَ اللَّهِ", "پاک و منزه است خداوند."],
    hamd: ["الْحَمْدُ لِلَّهِ", "ستایش مخصوص خداوند است."]
  };
  const today = () => new Date().toLocaleDateString("en-CA");
  const fa = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
  const fresh = () => ({count:0,total:0,goal:100,history:{},theme:"dark",dhikr:"salavat",audio:true,undo:[],token:null,username:null,groups:[]});
  let state = load();
  let installEvent = null;
  let toastTimer;
  function load(){ try{return {...fresh(),...JSON.parse(localStorage.getItem(KEY)||"{}")};}catch{return fresh();} }
  function save(){localStorage.setItem(KEY,JSON.stringify(state));render();}
  function notify(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600);}
  function render(){
    const d=today(); const count=state.history[d] ?? state.count;
    $("countValue").textContent=fa(count); $("totalValue").textContent=fa(state.total);
    $("goalText").textContent=`${fa(state.goal)} / ${fa(count)}`;
    $("goalProgress").style.width=Math.min(100,count/Math.max(1,state.goal)*100)+"%";
    $("goalInput").value=state.goal; $("dhikrSelect").value=state.dhikr;
    $("arabicText").textContent=dhikr[state.dhikr][0]; $("translationText").textContent=dhikr[state.dhikr][1];
    $("audioToggle").checked=state.audio; $("todayLabel").textContent=new Intl.DateTimeFormat("fa-IR",{dateStyle:"full"}).format(new Date());
    const keys=Object.keys(state.history).sort().reverse();
    $("activeDays").textContent=fa(keys.filter(k=>state.history[k]>0).length);
    $("todayStat").textContent=fa(count);
    const y=new Date();y.setDate(y.getDate()-1);const yd=y.toLocaleDateString("en-CA");
    $("yesterdayStat").textContent=fa(state.history[yd]||0);
    const sum=Object.values(state.history).reduce((a,b)=>a+Number(b||0),0);
    $("averageStat").textContent=fa(keys.length?Math.round(sum/keys.length):0);
    $("historyList").innerHTML=keys.slice(0,7).map(k=>`<div class="history-item"><span>${new Date(k+"T12:00:00").toLocaleDateString("fa-IR",{dateStyle:"medium"})}</span><span>${fa(state.history[k])}</span></div>`).join("") || '<p class="muted">هنوز تاریخچه‌ای ثبت نشده است.</p>';
    $("authStatus").textContent=state.username?`وارد شده‌اید: ${state.username}`:"شمارش محلی بدون حساب نیز فعال است.";
    $("loginBtn").classList.toggle("hidden",!!state.token);$("registerBtn").classList.toggle("hidden",!!state.token);$("logoutBtn").classList.toggle("hidden",!state.token);
    $("groupList").innerHTML=(state.groups||[]).map(g=>`<div class="group-item"><b>${escapeHtml(g.name||"ختم گروهی")}</b>کد: ${escapeHtml(g.code||"—")} · پیشرفت شما: ${fa(g.progress||0)}</div>`).join("");
    document.documentElement.dataset.theme=state.theme;
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function countUp(){const d=today();state.undo.push({date:d,count:state.history[d]||0,total:state.total});if(state.undo.length>30)state.undo.shift();state.history[d]=(state.history[d]||0)+1;state.count=state.history[d];state.total++;save();if(navigator.vibrate)navigator.vibrate(18);if(state.token)api("/api/sync",{method:"POST",body:JSON.stringify({history:state.history,total:state.total,goal:state.goal})}).catch(()=>{});}
  $("countBtn").addEventListener("click",countUp);
  document.addEventListener("keydown",e=>{if(e.code==="Space" && !["INPUT","TEXTAREA","SELECT","BUTTON"].includes(document.activeElement.tagName)){e.preventDefault();countUp();}});
  $("undoBtn").onclick=()=>{const x=state.undo.pop();if(!x)return notify("عملی برای بازگشت وجود ندارد.");state.history[x.date]=x.count;state.total=x.total;state.count=state.history[today()]||0;save();};
  $("resetBtn").onclick=()=>{if(!confirm("فقط شمارش امروز صفر شود؟"))return;const d=today(),old=state.history[d]||0;state.history[d]=0;state.total=Math.max(0,state.total-old);state.count=0;state.undo=[];save();notify("شمارش امروز صفر شد.");};
  $("dhikrSelect").onchange=e=>{state.dhikr=e.target.value;save();};
  $("saveGoalBtn").onclick=()=>{state.goal=Math.max(1,Math.min(1000000,Number($("goalInput").value)||100));save();notify("هدف روزانه ذخیره شد.");};
  $("audioToggle").onchange=e=>{state.audio=e.target.checked;save();if(!state.audio&&speechSynthesis)speechSynthesis.cancel();};
  $("speakBtn").onclick=()=>{if(!state.audio)return notify("پخش صوت غیرفعال است.");if(!("speechSynthesis"in window))return notify("مرورگر از پخش گفتار پشتیبانی نمی‌کند.");speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(dhikr[state.dhikr][0]);u.lang="ar-SA";u.rate=.82;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>/^ar/i.test(v.lang))||null;speechSynthesis.speak(u);};
  $("themeBtn").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";save();};
  function backup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`salavat-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);}
  $("backupBtn").onclick=backup;$("exportBtn").onclick=backup;
  $("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!data||typeof data!=="object"||!data.history)throw Error();if(!confirm("اطلاعات پشتیبان با اطلاعات فعلی ادغام شود؟"))return;for(const [k,v] of Object.entries(data.history))state.history[k]=Math.max(Number(state.history[k]||0),Number(v||0));state.total=Math.max(state.total,Number(data.total||0),Object.values(state.history).reduce((a,b)=>a+Number(b||0),0));state.goal=Number(data.goal)||state.goal;save();notify("بازیابی و ادغام انجام شد.");}catch{notify("فایل پشتیبان معتبر نیست.");}e.target.value="";};
  function modal(id){$(id).classList.remove("hidden");}
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
  $("helpBtn").onclick=()=>{$("infoTitle").textContent="راهنمای صلوات‌شمار";$("infoBody").textContent="برای ثبت ذکر دکمه دایره‌ای را لمس کنید یا کلید فاصله را بزنید. اطلاعات روی همین دستگاه ذخیره می‌شود. برای همگام‌سازی و ختم گروهی، ابتدا Worker را نصب و سپس وارد حساب شوید. نسخه ۲.۰.۰";modal("infoModal");};
  async function api(path,opts={}){if(!API)throw Error("سرویس ابری هنوز پیکربندی نشده است.");const headers={"Content-Type":"application/json",...(opts.headers||{})};if(state.token)headers.Authorization="Bearer "+state.token;const res=await fetch(API+path,{...opts,headers});const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||"خطا در ارتباط با سرور");return data;}
  async function auth(action){try{const data=await api("/api/auth/"+action,{method:"POST",body:JSON.stringify({username:$("username").value.trim(),password:$("password").value})});state.token=data.token;state.username=data.username;save();notify("ورود با موفقیت انجام شد.");await syncNow();}catch(e){notify(e.message);}}
  $("registerBtn").onclick=()=>auth("register");$("loginBtn").onclick=()=>auth("login");
  $("logoutBtn").onclick=()=>{state.token=null;state.username=null;save();notify("از حساب خارج شدید.");};
  async function syncNow(){try{const d=await api("/api/sync");if(d.history){for(const [k,v] of Object.entries(d.history))state.history[k]=Math.max(Number(state.history[k]||0),Number(v||0));state.total=Math.max(state.total,Number(d.total||0));state.goal=Number(d.goal)||state.goal;save();} }catch(e){notify(e.message);}}
  $("createGroupBtn").onclick=async()=>{try{const d=await api("/api/groups",{method:"POST",body:JSON.stringify({name:$("groupName").value.trim()||"ختم صلوات"})});state.groups.push(d.group);save();notify("ختم ساخته شد؛ کد دعوت را به دوستان بدهید.");}catch(e){notify(e.message);}};
  $("joinGroupBtn").onclick=async()=>{try{const d=await api("/api/groups/join",{method:"POST",body:JSON.stringify({code:$("inviteCode").value.trim()})});state.groups.push(d.group);save();notify("به ختم گروهی پیوستید.");}catch(e){notify(e.message);}};
  async function loadGroups(){if(!state.token)return;try{const d=await api("/api/groups");state.groups=d.groups||[];save();}catch{}}
  async function globalCount(){if(!API)return;try{const d=await api("/api/global");$("globalValue").textContent=fa(d.count);$("globalStatus").textContent="شمارنده همگام‌شده جهانی";}catch{$("globalStatus").textContent="فعلاً اتصال به شمارنده جهانی برقرار نشد.";}}
  async function pushGlobal(){if(!API)return;try{await api("/api/global",{method:"POST",body:JSON.stringify({increment:1})});globalCount();}catch{}}
  const originalCount=countUp;
  // شمارنده جهانی پس از ثبت محلی، در صورت اتصال API به‌روزرسانی می‌شود.
  $("countBtn").removeEventListener("click",countUp);
  $("countBtn").addEventListener("click",()=>{originalCount();pushGlobal();});
  $("updateBtn").onclick=async()=>{if(!("serviceWorker"in navigator))return notify("این مرورگر از به‌روزرسانی خودکار پشتیبانی نمی‌کند.");try{const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();notify(reg.waiting?"نسخه جدید آماده نصب است.":"درخواست بررسی نسخه جدید ارسال شد.");}else notify("سرویس آفلاین هنوز فعال نشده است.");}catch{notify("بررسی به‌روزرسانی ناموفق بود.");}};
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvent=e;$("installBtn").classList.remove("hidden");modal("installPrompt");});
  $("installBtn").onclick=()=>modal("installPrompt");
  $("confirmInstall").onclick=async()=>{if(!installEvent){notify("از منوی مرورگر گزینه Add to Home Screen را انتخاب کنید.");return;}installEvent.prompt();await installEvent.userChoice;installEvent=null;$("installPrompt").classList.add("hidden");$("installBtn").classList.add("hidden");};
  window.addEventListener("appinstalled",()=>{$("installPrompt").classList.add("hidden");$("installBtn").classList.add("hidden");notify("برنامه با موفقیت نصب شد.");});
  if("serviceWorker"in navigator){window.addEventListener("load",async()=>{try{const reg=await navigator.serviceWorker.register("/sw.js");if(reg.waiting)notify("نسخه جدید برنامه آماده است؛ صفحه را تازه‌سازی کنید.");reg.addEventListener("updatefound",()=>{const w=reg.installing;w?.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)notify("به‌روزرسانی جدید آماده شد؛ صفحه را تازه‌سازی کنید.");});});}catch(e){console.warn("SW:",e);}});}
  render();globalCount();if(state.token){syncNow();loadGroups();}
})();
