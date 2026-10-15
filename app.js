// 金・原油タートル ジャーナル（GMOクリック証券 CFD）
// 旧版（ドル建て・暗号資産）のデータは LEGACY_KEY に残したまま、別のキーで保存する。
const KEY = "kentaTurtleJournal_jpy_v2", SET = "kentaTurtleSettings_jpy_v2";
const LEGACY_KEY = "kentaTurtleJournal_v1";
const DEFAULT_INSTRUMENTS = [
  { id: "gold-jpy", name: "金/JPY", unit: "円", contract: "1.1g", minLot: 0.1 },
  { id: "wti", name: "WTI原油", unit: "ドル", contract: "10バレル", minLot: 0.1 },
];
const RULE_LABEL = { yes: "はい", no: "いいえ" };

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
const clone = o => JSON.parse(JSON.stringify(o));
let trades = load(KEY, []);
let settings = Object.assign({ startAsset: 80000 }, load(SET, {}));
if (!Array.isArray(settings.instruments)) settings.instruments = clone(DEFAULT_INSTRUMENTS);
let currentImage = "";

const $ = id => document.getElementById(id);
const yen = n => `${n < 0 ? "-¥" : "¥"}${Math.round(Math.abs(n)).toLocaleString("ja-JP")}`;
const pct = n => `${n.toFixed(2)}%`;
const ym = d => { const x = new Date(d + "T00:00:00"); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
// 端末の日付（toISOString は UTC なので、日本時間の朝9時前は前日になってしまう）
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ymLabel = k => { const [y, m] = k.split("-"); return `${y}年${Number(m)}月`; };

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(trades));
    localStorage.setItem(SET, JSON.stringify(settings));
    return true;
  } catch {
    toast("保存できませんでした（ブラウザの容量オーバーの可能性。画像を減らしてください）");
    return false;
  }
}

// ---- 銘柄 ----
const inst = id => settings.instruments.find(i => i.id === id) || null;
const symName = t => inst(t.instrumentId)?.name ?? `${t.symbol || "不明"}（削除済み）`;
const priceUnit = t => inst(t.instrumentId)?.unit ?? t.unit ?? "";
const isClosed = t => t.pnl !== "" && t.pnl !== null && t.pnl !== undefined && !isNaN(Number(t.pnl));

function signedRR(t) {
  const e = Number(t.entry), s = Number(t.sl), x = Number(t.exit);
  if (!e || !s || !x) return null;
  const risk = Math.abs(e - s); if (!risk) return null;
  return t.side === "Long" ? (x - e) / risk : (e - x) / risk;
}
function avg(list) { return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null; }
function ruleRate(list) {
  const judged = list.filter(t => t.ruleFollowed === "yes" || t.ruleFollowed === "no");
  if (!judged.length) return null;
  return { rate: judged.filter(t => t.ruleFollowed === "yes").length / judged.length * 100, n: judged.length };
}

function go(page) {
  document.querySelectorAll(".page").forEach(x => x.classList.toggle("active", x.id === page));
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.page === page));
  if (page === "dashboard") renderDashboard();
  if (page === "history") renderHistory();
  if (page === "months") renderMonths();
  if (page === "settings") renderSettings();
  if (page === "new" && !$("tradeId").value) fillInstrumentSelect();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.addEventListener("click", e => { const b = e.target.closest("[data-page]"); if (b) go(b.dataset.page); });

// ---- ダッシュボード ----
function renderDashboard() {
  const now = new Date(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const closed = trades.filter(isClosed);
  const month = closed.filter(t => ym(t.date) === key);
  const monthPnl = month.reduce((a, t) => a + Number(t.pnl), 0);
  const asset = settings.startAsset + closed.filter(t => t.date <= today()).reduce((a, t) => a + Number(t.pnl), 0);
  const wins = month.filter(t => Number(t.pnl) > 0).length;
  const rr = avg(month.map(signedRR).filter(x => x !== null));
  $("monthLabel").textContent = ymLabel(key);
  $("asset").textContent = yen(asset);
  $("monthlyPnl").textContent = yen(monthPnl); $("monthlyPnl").className = monthPnl < 0 ? "negative" : "positive";
  $("monthlyRate").textContent = pct(settings.startAsset ? monthPnl / settings.startAsset * 100 : 0);
  $("monthlyRate").className = monthPnl < 0 ? "negative" : "positive";
  $("tradeCount").textContent = month.length;
  $("winRate").textContent = month.length ? pct(wins / month.length * 100) : "0.00%";
  $("avgRR").textContent = rr === null ? "—" : rr.toFixed(2);
  const rm = ruleRate(month), ra = ruleRate(closed);
  $("ruleRate").textContent = rm ? pct(rm.rate) : "—";
  $("ruleRateAll").textContent = ra ? `累計 ${ra.rate.toFixed(1)}%（${ra.n}件）` : "決済時に「ルール通りか」を入力";

  // 銘柄別損益：銘柄リストの順に表示。削除済みの銘柄の記録は最後にまとめる
  const rows = settings.instruments.map(i => {
    const list = closed.filter(t => t.instrumentId === i.id);
    return { name: i.name, pnl: list.reduce((a, t) => a + Number(t.pnl), 0), n: list.length };
  });
  const orphan = {};
  closed.filter(t => !inst(t.instrumentId)).forEach(t => {
    const k = symName(t); (orphan[k] ??= { name: k, pnl: 0, n: 0 }); orphan[k].pnl += Number(t.pnl); orphan[k].n++;
  });
  const all = [...rows, ...Object.values(orphan)];
  $("symbolStats").innerHTML = all.length ? all.map(r => `<div class="row"><span>${esc(r.name)} <small class="muted">${r.n}件</small></span><b class="${r.pnl < 0 ? "negative" : "positive"}">${yen(r.pnl)}</b></div>`).join("") : `<div class="empty">設定で銘柄を追加してください</div>`;

  const recent = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  $("recentTrades").innerHTML = recent.length ? recent.map(tradeRow).join("") : `<div class="empty">「新規記録」からトレードを追加してください</div>`;
}
function tradeRow(t) {
  const pnl = isClosed(t) ? Number(t.pnl) : null, rr = signedRR(t);
  return `<div class="trade-row" data-edit="${t.id}"><div class="trade-top"><div><b>${esc(symName(t))}</b> <span class="badge">${esc(t.side)}</span> <span class="badge gray">U${esc(t.unitNo || "1")}</span></div><b class="${pnl !== null && pnl < 0 ? "negative" : "positive"}">${pnl === null ? "未決済" : yen(pnl)}</b></div><div class="trade-meta">${t.date} ・ ${t.lots ? esc(t.lots) + "枚" : "枚数未入力"} ・ RR ${rr === null ? "—" : rr.toFixed(2)}${t.ruleFollowed ? " ・ ルール通り：" + RULE_LABEL[t.ruleFollowed] : ""}</div></div>`;
}
document.addEventListener("click", e => { const r = e.target.closest("[data-edit]"); if (r) loadTrade(r.dataset.edit); });

// ---- 記録フォーム ----
function fillInstrumentSelect(selectedId, fallbackName) {
  const opts = settings.instruments.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`);
  if (selectedId && !inst(selectedId)) opts.push(`<option value="${esc(selectedId)}">${esc(fallbackName || "不明")}（削除済み）</option>`);
  opts.push(`<option value="${NEW_INST}">＋ 新しい銘柄を追加…</option>`);
  $("instrument").innerHTML = opts.join("");
  if (selectedId) $("instrument").value = selectedId;
  onInstrumentChange();
}
const NEW_INST = "__new__";
function onInstrumentChange() {
  const isNew = $("instrument").value === NEW_INST;
  $("newInstBox").classList.toggle("hidden", !isNew);
  const i = isNew ? null : inst($("instrument").value);
  const unit = isNew ? $("newInstUnit").value : i?.unit ?? "";
  document.querySelectorAll("[data-unit]").forEach(s => s.textContent = unit ? `（${unit}）` : "");
  $("instrumentInfo").textContent = i ? `1枚＝${i.contract || "—"}／最小 ${i.minLot}枚` : isNew ? "下で銘柄の内容を入力" : "";
  const step = (isNew ? Number($("newInstMinLot").value) : i?.minLot) || 0.1;
  $("lots").step = step; $("lots").min = step;
  updateSlHint();
}
["newInstUnit", "newInstMinLot"].forEach(id => $(id).addEventListener("input", onInstrumentChange));
$("newInstUnit").addEventListener("change", onInstrumentChange);
function updateSlHint() {
  const e = Number($("entry").value), n = Number($("n").value);
  if (!e || !n) { $("slHint").textContent = ""; return; }
  const sl = $("side").value === "Long" ? e - 2 * n : e + 2 * n;
  $("slHint").textContent = `2N損切りの目安：${Number(sl.toFixed(4))}`;
}
$("instrument").addEventListener("change", onInstrumentChange);
["entry", "n", "side"].forEach(id => $(id).addEventListener("input", updateSlHint));
$("ruleFollowed").addEventListener("change", () => $("ruleNoteWrap").classList.toggle("hidden", $("ruleFollowed").value !== "no"));

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject; img.src = reader.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
$("image").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    currentImage = await compressImage(f); // 保存容量を抑えるため、幅1200pxのJPEGに縮小する
    $("imagePreview").innerHTML = `<img src="${currentImage}" alt="entry chart">`; $("imagePreview").classList.remove("hidden");
  } catch { toast("画像を読み込めませんでした"); }
});

$("tradeForm").addEventListener("submit", e => {
  e.preventDefault();
  if ($("ruleFollowed").value === "no" && !$("ruleNote").value.trim()) { toast("ルール通りでなかった理由を入力してください"); $("ruleNote").focus(); return; }
  const id = $("tradeId").value || crypto.randomUUID();
  const old = trades.find(t => t.id === id);
  const instBackup = clone(settings.instruments);
  let i = inst($("instrument").value);
  if ($("instrument").value === NEW_INST) { // 記録画面から新しい銘柄を追加する
    const name = $("newInstName").value.trim();
    if (!name) { toast("新しい銘柄の銘柄名を入力してください"); $("newInstName").focus(); return; }
    if (settings.instruments.some(x => x.name === name)) { toast(`「${name}」はすでにあります。リストから選んでください`); return; }
    i = { id: crypto.randomUUID(), name, unit: $("newInstUnit").value, contract: $("newInstContract").value.trim(), minLot: Number($("newInstMinLot").value) || 0.1 };
    settings.instruments.push(i);
  }
  const t = {
    id, date: $("date").value, instrumentId: i?.id ?? $("instrument").value,
    symbol: i?.name ?? old?.symbol ?? "", unit: i?.unit ?? old?.unit ?? "",
    side: $("side").value, unitNo: $("unitNo").value, entry: $("entry").value, sl: $("sl").value,
    lots: $("lots").value, n: $("n").value,
    entryReason: $("entryReason").value.trim(), exitPlan: $("exitPlan").value.trim(), image: currentImage || (old?.image || ""),
    exit: $("exit").value, pnl: $("pnl").value, pnlRate: $("pnlRate").value, holdTime: $("holdTime").value.trim(),
    exitReason: $("exitReason").value, ruleFollowed: $("ruleFollowed").value,
    ruleNote: $("ruleFollowed").value === "no" ? $("ruleNote").value.trim() : "",
    emotion: $("emotion").value.trim(),
  };
  const backup = trades.slice();
  const idx = trades.findIndex(x => x.id === id); if (idx >= 0) trades[idx] = t; else trades.push(t);
  if (!save()) { trades = backup; settings.instruments = instBackup; return; }
  toast("トレードを保存しました"); resetForm(); go("dashboard");
});
function resetForm() {
  $("tradeForm").reset(); $("tradeId").value = ""; currentImage = "";
  $("imagePreview").innerHTML = ""; $("imagePreview").classList.add("hidden");
  $("ruleNoteWrap").classList.add("hidden");
  $("formTitle").textContent = "新規トレード記録"; $("date").value = today();
  fillInstrumentSelect();
}
const FORM_FIELDS = ["date", "side", "unitNo", "entry", "sl", "lots", "n", "entryReason", "exitPlan", "exit", "pnl", "pnlRate", "holdTime", "exitReason", "ruleFollowed", "ruleNote", "emotion"];
function loadTrade(id) {
  const t = trades.find(x => x.id === id); if (!t) return;
  go("new"); $("formTitle").textContent = "トレードを編集"; $("tradeId").value = t.id;
  fillInstrumentSelect(t.instrumentId, t.symbol);
  FORM_FIELDS.forEach(k => $(k).value = t[k] ?? "");
  if (!t.unitNo) $("unitNo").value = "1";
  $("ruleNoteWrap").classList.toggle("hidden", t.ruleFollowed !== "no");
  updateSlHint();
  currentImage = t.image || "";
  if (currentImage) { $("imagePreview").innerHTML = `<img src="${currentImage}" alt="entry chart">`; $("imagePreview").classList.remove("hidden"); }
}

// ---- 履歴 ----
function renderHistory() {
  const list = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
  $("historyList").innerHTML = list.length ? list.map(t => {
    const u = priceUnit(t), rr = signedRR(t);
    return `<article class="panel history-card"><div class="history-head"><div><b>${esc(symName(t))}</b> <span class="badge">${esc(t.side)}</span> <span class="badge gray">ユニット${esc(t.unitNo || "1")}</span> <span class="trade-meta">${t.date}</span></div><div class="btns"><button class="mini secondary" data-load="${t.id}">編集</button><button class="mini dangerbtn" data-delete="${t.id}">削除</button></div></div>
    <div class="trade-meta">枚数：${esc(t.lots || "—")}　N：${esc(t.n || "—")}${esc(u)}　エントリー：${esc(t.entry)}${esc(u)}　SL：${esc(t.sl)}${esc(u)}　決済：${t.exit ? esc(t.exit) + esc(u) : "—"}</div>
    <div class="trade-meta">損益：<strong class="${Number(t.pnl) < 0 ? "negative" : "positive"}">${isClosed(t) ? yen(Number(t.pnl)) : "未決済"}</strong>　損益率：${t.pnlRate === "" || t.pnlRate == null ? "—" : pct(Number(t.pnlRate))}　保有：${esc(t.holdTime || "—")}　RR：${rr === null ? "—" : rr.toFixed(2)}　決済理由：${esc(t.exitReason || "—")}　ルール通り：${t.ruleFollowed ? RULE_LABEL[t.ruleFollowed] : "—"}</div>
    ${t.ruleFollowed === "no" ? `<p class="rule-note">ルール通りでなかった理由：${esc(t.ruleNote)}</p>` : ""}
    <p class="note">エントリー理由：${esc(t.entryReason)}</p><p class="note">どうなったら出るのか：${esc(t.exitPlan)}</p>${t.emotion ? `<p class="note">感情：${esc(t.emotion)}</p>` : ""}${t.image ? `<img class="history-img" src="${t.image}" alt="entry chart">` : ""}</article>`;
  }).join("") : `<div class="panel empty">まだトレードがありません</div>`;
}
document.addEventListener("click", e => {
  const l = e.target.closest("[data-load]"); if (l) loadTrade(l.dataset.load);
  const d = e.target.closest("[data-delete]");
  if (d && confirm("このトレードを削除しますか？")) { trades = trades.filter(t => t.id !== d.dataset.delete); save(); renderHistory(); renderDashboard(); }
});

// ---- 月別 ----
function renderMonths() {
  const map = {}; trades.filter(isClosed).forEach(t => (map[ym(t.date)] ??= []).push(t));
  const keys = Object.keys(map).sort().reverse();
  $("monthList").innerHTML = keys.length ? keys.map(k => {
    const a = map[k], p = a.reduce((s, t) => s + Number(t.pnl), 0), w = a.filter(t => Number(t.pnl) > 0).length;
    const rr = avg(a.map(signedRR).filter(x => x !== null)), rule = ruleRate(a);
    return `<article class="panel month-card"><div class="month-title">${ymLabel(k)}</div><div class="month-metrics"><div><span>損益</span><b class="${p < 0 ? "negative" : "positive"}">${yen(p)}</b></div><div><span>トレード数</span><b>${a.length}</b></div><div><span>勝率</span><b>${(w / a.length * 100).toFixed(1)}%</b></div><div><span>平均RR</span><b>${rr === null ? "—" : rr.toFixed(2)}</b></div><div><span>ルール通り率</span><b>${rule ? rule.rate.toFixed(1) + "%" : "—"}</b></div></div></article>`;
  }).join("") : `<div class="panel empty">決済済みトレードが記録されると月別履歴が表示されます。</div>`;
}

// ---- 設定：開始資産・銘柄 ----
function renderSettings() {
  $("startAsset").value = settings.startAsset;
  $("instrumentList").innerHTML = settings.instruments.length ? `<div class="table-scroll"><table class="inst-table"><thead><tr><th>銘柄名</th><th>価格の単位</th><th>1枚の内容</th><th>最小枚数</th><th>記録</th><th></th></tr></thead><tbody>${settings.instruments.map(i => {
    const n = trades.filter(t => t.instrumentId === i.id).length;
    return `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.unit)}</td><td>${esc(i.contract || "—")}</td><td>${esc(i.minLot)}枚</td><td>${n}件</td><td class="btns"><button class="mini secondary" data-inst-edit="${esc(i.id)}">編集</button><button class="mini dangerbtn" data-inst-del="${esc(i.id)}">削除</button></td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="empty">銘柄がありません。下のフォームから追加してください。</div>`;
  renderLegacy();
}
$("settingsForm").addEventListener("submit", e => { e.preventDefault(); settings.startAsset = Number($("startAsset").value) || 0; if (save()) toast("設定を保存しました"); renderDashboard(); });

function resetInstForm() {
  $("instrumentForm").reset(); $("instId").value = ""; $("instMinLot").value = 0.1;
  $("instFormTitle").textContent = "銘柄を追加"; $("instSubmit").textContent = "追加する"; $("instCancel").classList.add("hidden");
}
$("instCancel").addEventListener("click", resetInstForm);
$("instrumentForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = $("instId").value;
  const data = { name: $("instName").value.trim(), unit: $("instUnit").value, contract: $("instContract").value.trim(), minLot: Number($("instMinLot").value) || 0.1 };
  if (!data.name) return;
  if (settings.instruments.some(i => i.name === data.name && i.id !== id)) { toast("同じ名前の銘柄がすでにあります"); return; }
  if (id) Object.assign(inst(id), data); else settings.instruments.push({ id: crypto.randomUUID(), ...data });
  if (!save()) return;
  toast(id ? "銘柄を更新しました" : "銘柄を追加しました"); resetInstForm(); renderSettings(); fillInstrumentSelect();
});
document.addEventListener("click", e => {
  const ed = e.target.closest("[data-inst-edit]");
  if (ed) {
    const i = inst(ed.dataset.instEdit); if (!i) return;
    $("instId").value = i.id; $("instName").value = i.name; $("instUnit").value = i.unit; $("instContract").value = i.contract || ""; $("instMinLot").value = i.minLot;
    $("instFormTitle").textContent = `「${i.name}」を編集`; $("instSubmit").textContent = "更新する"; $("instCancel").classList.remove("hidden");
    $("instrumentForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const del = e.target.closest("[data-inst-del]");
  if (del) {
    const i = inst(del.dataset.instDel); if (!i) return;
    const n = trades.filter(t => t.instrumentId === i.id).length;
    const msg = n ? `「${i.name}」を削除しますか？\nこの銘柄のトレード記録${n}件は残り、「${i.name}（削除済み）」として表示されます。` : `「${i.name}」を削除しますか？`;
    if (!confirm(msg)) return;
    settings.instruments = settings.instruments.filter(x => x.id !== i.id);
    if (save()) { toast("銘柄を削除しました"); renderSettings(); fillInstrumentSelect(); }
  }
});

// ---- CSV バックアップ ----
// 1つのファイルに「設定・銘柄・トレード」を入れる。record_type 列で行の種類を区別する。
const COLS = ["record_type", "id", "name", "unit", "contract", "min_lot", "start_asset", "date", "instrument_id", "symbol", "side", "unit_no", "entry", "sl", "lots", "n", "entry_reason", "exit_plan", "exit", "pnl", "pnl_rate", "hold_time", "exit_reason", "rule_followed", "rule_note", "emotion", "image"];
const TRADE_COLS = { id: "id", date: "date", instrumentId: "instrument_id", symbol: "symbol", unit: "unit", side: "side", unitNo: "unit_no", entry: "entry", sl: "sl", lots: "lots", n: "n", entryReason: "entry_reason", exitPlan: "exit_plan", exit: "exit", pnl: "pnl", pnlRate: "pnl_rate", holdTime: "hold_time", exitReason: "exit_reason", ruleFollowed: "rule_followed", ruleNote: "rule_note", emotion: "emotion", image: "image" };
const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
function toCSV(header, rows) { return "﻿" + [header, ...rows.map(r => header.map(c => r[c] ?? ""))].map(r => r.map(cell).join(",")).join("\r\n"); }
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; if (row.some(x => x !== "")) rows.push(row); row = [];
    } else f += c;
  }
  row.push(f); if (row.some(x => x !== "")) rows.push(row);
  return rows;
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("exportCsv").addEventListener("click", () => {
  const rows = [{ record_type: "setting", start_asset: settings.startAsset }];
  settings.instruments.forEach(i => rows.push({ record_type: "instrument", id: i.id, name: i.name, unit: i.unit, contract: i.contract, min_lot: i.minLot }));
  trades.forEach(t => { const r = { record_type: "trade" }; Object.entries(TRADE_COLS).forEach(([k, c]) => r[c] = t[k]); rows.push(r); });
  download(`turtle-journal-${today()}.csv`, toCSV(COLS, rows));
  toast(`トレード${trades.length}件・銘柄${settings.instruments.length}件を書き出しました`);
});
$("importCsv").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  try {
    const rows = parseCSV(await file.text());
    const head = rows.shift() || [];
    if (!head.includes("record_type")) { toast("このアプリで書き出したCSVではありません"); return; }
    const objs = rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
    const newInst = objs.filter(o => o.record_type === "instrument").map(o => ({ id: o.id || crypto.randomUUID(), name: o.name, unit: o.unit || "円", contract: o.contract, minLot: Number(o.min_lot) || 0.1 }));
    const newTrades = objs.filter(o => o.record_type === "trade").map(o => { const t = {}; Object.entries(TRADE_COLS).forEach(([k, c]) => t[k] = o[c] ?? ""); if (!t.id) t.id = crypto.randomUUID(); return t; });
    const setting = objs.find(o => o.record_type === "setting");
    if (!confirm(`今のデータを、CSVの内容（トレード${newTrades.length}件・銘柄${newInst.length}件）に置き換えますか？\n今のデータは消えます。先に「CSVを書き出す」で保存しておくと安心です。`)) return;
    const backup = { trades, settings: clone(settings) };
    trades = newTrades;
    if (newInst.length) settings.instruments = newInst;
    if (setting && setting.start_asset !== "") settings.startAsset = Number(setting.start_asset) || 0;
    if (!save()) { trades = backup.trades; settings = backup.settings; return; }
    toast("CSVを読み込みました"); renderSettings(); renderDashboard(); fillInstrumentSelect();
  } catch { toast("CSVを読み込めませんでした"); }
});

// 旧版（ドル建て・暗号資産）のデータが残っていれば知らせる。消さずに残し、CSVで取り出せるようにする
function renderLegacy() {
  const legacy = load(LEGACY_KEY, []);
  const box = $("legacyBox");
  if (!Array.isArray(legacy) || !legacy.length) { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  box.innerHTML = `<p>旧ジャーナル（ドル建て・暗号資産）の記録が <b>${legacy.length}件</b> このブラウザに残っています。この画面には表示しませんが、消してはいません。</p><button type="button" class="secondary" id="exportLegacy">旧データをCSVで書き出す</button>`;
  $("exportLegacy").addEventListener("click", () => {
    const cols = [...new Set(legacy.flatMap(t => Object.keys(t)))];
    download(`turtle-journal-old-usd-${today()}.csv`, toCSV(cols, legacy));
  });
}

$("clearData").addEventListener("click", () => {
  if (!confirm("全トレードと設定（銘柄リストを含む）を削除します。本当に実行しますか？")) return;
  localStorage.removeItem(KEY); localStorage.removeItem(SET);
  trades = []; settings = { startAsset: 80000, instruments: clone(DEFAULT_INSTRUMENTS) };
  renderDashboard(); renderHistory(); renderMonths(); renderSettings(); fillInstrumentSelect(); toast("データを削除しました");
});

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
let timer; function toast(s) { $("toast").textContent = s; $("toast").classList.add("show"); clearTimeout(timer); timer = setTimeout(() => $("toast").classList.remove("show"), 2400); }
resetForm(); renderDashboard();
