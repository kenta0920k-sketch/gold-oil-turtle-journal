const KEY="kentaTurtleJournal_v1", SET="kentaTurtleSettings_v1";
let trades=JSON.parse(localStorage.getItem(KEY)||"[]");
let settings=JSON.parse(localStorage.getItem(SET)||'{"startAsset":60}');
let currentImage="";

const $=id=>document.getElementById(id);
const money=n=>`${n<0?"-$":"$"}${Math.abs(n).toFixed(2)}`;
const pct=n=>`${n.toFixed(2)}%`;
const ym=d=>{const x=new Date(d+"T00:00:00");return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`};
const ymLabel=k=>{const [y,m]=k.split("-");return `${y}年${Number(m)}月`};
function save(){localStorage.setItem(KEY,JSON.stringify(trades));localStorage.setItem(SET,JSON.stringify(settings));}
function signedRR(t){
  const e=Number(t.entry), s=Number(t.sl), x=Number(t.exit);
  if(!e||!s||!x) return null;
  const risk=Math.abs(e-s); if(!risk) return null;
  return t.side==="Long"?(x-e)/risk:(e-x)/risk;
}
function go(page){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===page));
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  if(page==="dashboard")renderDashboard();
  if(page==="history")renderHistory();
  if(page==="months")renderMonths();
  if(page==="settings")$("startAsset").value=settings.startAsset;
  window.scrollTo({top:0,behavior:"smooth"});
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page)});

function renderDashboard(){
  const now=new Date(), key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const closed=trades.filter(t=>t.pnl!==""&&t.pnl!==null&&t.pnl!==undefined&&!isNaN(Number(t.pnl)));
  const month=closed.filter(t=>ym(t.date)===key);
  const totalPnl=closed.reduce((a,t)=>a+Number(t.pnl),0), monthPnl=month.reduce((a,t)=>a+Number(t.pnl),0);
  const prevAsset=settings.startAsset+closed.filter(t=>new Date(t.date+"T23:59:59")<=new Date()).reduce((a,t)=>a+Number(t.pnl),0);
  const wins=month.filter(t=>Number(t.pnl)>0).length;
  const rrs=month.map(signedRR).filter(x=>x!==null);
  $("monthLabel").textContent=ymLabel(key);
  $("asset").textContent=money(prevAsset);
  $("monthlyPnl").textContent=money(monthPnl); $("monthlyPnl").className=monthPnl<0?"negative":"positive";
  $("monthlyRate").textContent=pct(settings.startAsset?monthPnl/settings.startAsset*100:0);
  $("monthlyRate").className=monthPnl<0?"negative":"positive";
  $("tradeCount").textContent=month.length;
  $("winRate").textContent=month.length?pct(wins/month.length*100):"0.00%";
  $("avgRR").textContent=rrs.length?rrs.reduce((a,b)=>a+b,0)/rrs.length.toFixed(2):"—";
  const syms={}; closed.forEach(t=>syms[t.symbol]=(syms[t.symbol]||0)+Number(t.pnl));
  const entries=Object.entries(syms).sort((a,b)=>b[1]-a[1]);
  $("symbolStats").innerHTML=entries.length?entries.map(([s,v])=>`<div class="row"><span>${esc(s)}</span><b class="${v<0?"negative":"positive"}">${money(v)}</b></div>`).join(""):`<div class="empty">まだトレードがありません</div>`;
  const recent=[...trades].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  $("recentTrades").innerHTML=recent.length?recent.map(t=>tradeRow(t)).join(""):`<div class="empty">「新規記録」からトレードを追加してください</div>`;
}
function tradeRow(t){
  const pnl=t.pnl===""||t.pnl==null?null:Number(t.pnl), rr=signedRR(t);
  return `<div class="trade-row" data-edit="${t.id}"><div class="trade-top"><div><b>${esc(t.symbol)}</b> <span class="badge">${esc(t.side)}</span></div><b class="${pnl!==null&&pnl<0?"negative":"positive"}">${pnl===null?"未決済":money(pnl)}</b></div><div class="trade-meta">${t.date} ・ ${t.holdTime||"保有時間未入力"} ・ RR ${rr===null?"—":rr.toFixed(2)}</div></div>`;
}
document.addEventListener("click",e=>{const r=e.target.closest("[data-edit]");if(r){loadTrade(r.dataset.edit)}});

$("image").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f)return;
  const reader=new FileReader(); reader.onload=()=>{currentImage=reader.result;$("imagePreview").innerHTML=`<img src="${currentImage}" alt="entry chart">`;$("imagePreview").classList.remove("hidden")};reader.readAsDataURL(f);
});
$("tradeForm").addEventListener("submit",e=>{
  e.preventDefault();
  const id=$("tradeId").value||crypto.randomUUID();
  const old=trades.find(t=>t.id===id);
  const t={id,date:$("date").value,symbol:$("symbol").value.trim(),side:$("side").value,entry:$("entry").value,sl:$("sl").value,entryReason:$("entryReason").value.trim(),exitPlan:$("exitPlan").value.trim(),image:currentImage||(old?.image||""),exit:$("exit").value,pnl:$("pnl").value,pnlRate:$("pnlRate").value,holdTime:$("holdTime").value.trim(),emotion:$("emotion").value.trim()};
  const i=trades.findIndex(x=>x.id===id); if(i>=0)trades[i]=t;else trades.push(t);
  save();toast("トレードを保存しました");resetForm();go("dashboard");
});
function resetForm(){ $("tradeForm").reset();$("tradeId").value="";currentImage="";$("imagePreview").innerHTML="";$("imagePreview").classList.add("hidden");$("formTitle").textContent="新規トレード記録"; $("date").value=new Date().toISOString().slice(0,10)}
function loadTrade(id){
  const t=trades.find(x=>x.id===id);if(!t)return;
  go("new");$("formTitle").textContent="トレードを編集";$("tradeId").value=t.id;
  ["date","symbol","side","entry","sl","entryReason","exitPlan","exit","pnl","pnlRate","holdTime","emotion"].forEach(k=>$(k).value=t[k]??"");
  currentImage=t.image||""; if(currentImage){$("imagePreview").innerHTML=`<img src="${currentImage}" alt="entry chart">`;$("imagePreview").classList.remove("hidden")}
}
function renderHistory(){
  const list=[...trades].sort((a,b)=>new Date(b.date)-new Date(a.date));
  $("historyList").innerHTML=list.length?list.map(t=>`<article class="panel history-card"><div class="history-head"><div><b>${esc(t.symbol)}</b> <span class="badge">${esc(t.side)}</span> <span class="trade-meta">${t.date}</span></div><div class="btns"><button class="mini secondary" data-load="${t.id}">編集</button><button class="mini dangerbtn" data-delete="${t.id}">削除</button></div></div><div class="trade-meta">損益：<strong class="${Number(t.pnl)<0?"negative":"positive"}">${t.pnl===""?"未決済":money(Number(t.pnl))}</strong>　損益率：${t.pnlRate===""?"—":pct(Number(t.pnlRate))}　保有：${t.holdTime||"—"}　RR：${signedRR(t)===null?"—":signedRR(t).toFixed(2)}</div><p style="margin-top:10px;font-size:13px">エントリー理由：${esc(t.entryReason)}</p><p style="margin-top:6px;font-size:13px">どうなったら出るのか：${esc(t.exitPlan)}</p>${t.emotion?`<p style="margin-top:6px;font-size:13px">感情：${esc(t.emotion)}</p>`:""}</article>`).join(""):`<div class="panel empty">まだトレードがありません</div>`;
}
document.addEventListener("click",e=>{
  const l=e.target.closest("[data-load]");if(l)loadTrade(l.dataset.load);
  const d=e.target.closest("[data-delete]");if(d){if(confirm("このトレードを削除しますか？")){trades=trades.filter(t=>t.id!==d.dataset.delete);save();renderHistory();renderDashboard()}}
});
function renderMonths(){
  const map={};trades.forEach(t=>{if(t.pnl===""||t.pnl==null)return;const k=ym(t.date);(map[k]??=[]).push(t)});
  const keys=Object.keys(map).sort().reverse();
  $("monthList").innerHTML=keys.length?keys.map(k=>{
    const a=map[k],p=a.reduce((s,t)=>s+Number(t.pnl),0),w=a.filter(t=>Number(t.pnl)>0).length,rr=a.map(signedRR).filter(x=>x!==null);
    return `<article class="panel month-card"><div class="month-title">${ymLabel(k)}</div><div class="month-metrics"><div><span>損益</span><b class="${p<0?"negative":"positive"}">${money(p)}</b></div><div><span>トレード数</span><b>${a.length}</b></div><div><span>勝率</span><b>${(w/a.length*100).toFixed(1)}%</b></div><div><span>平均RR</span><b>${rr.length?(rr.reduce((s,x)=>s+x,0)/rr.length).toFixed(2):"—"}</b></div></div></article>`
  }).join(""):`<div class="panel empty">決済済みトレードが記録されると月別履歴が表示されます。</div>`;
}
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();settings.startAsset=Number($("startAsset").value)||0;save();toast("設定を保存しました");renderDashboard()});
$("clearData").addEventListener("click",()=>{if(confirm("全トレードと設定を削除します。本当に実行しますか？")){localStorage.removeItem(KEY);localStorage.removeItem(SET);trades=[];settings={startAsset:60};renderDashboard();renderHistory();renderMonths();$("startAsset").value=60;toast("データを削除しました")}});

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
let timer;function toast(s){$("toast").textContent=s;$("toast").classList.add("show");clearTimeout(timer);timer=setTimeout(()=>$("toast").classList.remove("show"),1800)}
resetForm();renderDashboard();
