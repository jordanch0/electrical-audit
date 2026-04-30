"use strict";function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _react={useState:React.useState,useEffect:React.useEffect,useRef:React.useRef,default:React};
// ─────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────
const STATUS = { UNTESTED:"untested", PASS:"pass", FAIL:"fail", NA:"na" };
const SM = {
[STATUS.UNTESTED]: { label:"—",    bg:"#2a2a2a", fg:"#666",    border:"#333" },
[STATUS.PASS]:     { label:"PASS", bg:"#1a3d1a", fg:"#4ade80", border:"#22c55e" },
[STATUS.FAIL]:     { label:"FAIL", bg:"#3d1a1a", fg:"#f87171", border:"#ef4444" },
[STATUS.NA]:       { label:"N/A",  bg:"#1e2535", fg:"#64748b", border:"#334155" },
};
const uid = () => Math.random().toString(36).slice(2,9);
const fmtDate = d => { if(!d) return ""; try { return new Date(d).toLocaleDateString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric"}); } catch(_) { return d; } };
const fmtDateTime = d => { if(!d) return ""; try { return new Date(d).toLocaleString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}); } catch(_) { return d; } };
const addMonths = (d,n) => { if(!d) return ""; try { const x=new Date(d); x.setMonth(x.getMonth()+n); return x.toLocaleDateString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric"}); } catch(_) { return ""; } };
const addYears  = (d,n) => { if(!d) return ""; try { const x=new Date(d); x.setFullYear(x.getFullYear()+n); return x.toLocaleDateString("en-AU",{day:"2-digit",month:"2-digit",year:"numeric"}); } catch(_) { return ""; } };
const cycleS = s => s===STATUS.UNTESTED?STATUS.PASS:s===STATUS.PASS?STATUS.FAIL:s===STATUS.FAIL?STATUS.NA:STATUS.UNTESTED;
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,20)+"-"+uid();
// ─────────────────────────────────────────────────────────────────────────
// DEFAULT DROPDOWN OPTIONS
// ─────────────────────────────────────────────────────────────────────────
const DEFAULT_RESPONSIBILITY = ["Vorick Group","Site Electrician","Site Manager","Contractor","Client"];
const DEFAULT_RECTIFIED      = ["Removed from Service","Scheduled for Repair","Replacement Required","Fuse Replaced & Retested","Circuit Isolated","Under Investigation","No Action Required"];
const DEFAULT_AMP_RATING     = ["6A","10A","16A","20A","25A","32A","40A","50A","63A","80A","100A","125A","160A","200A","250A","315A","400A"];
const DEFAULT_CB_TYPE        = ["RCBO Type A","RCBO Type AC","RCBO Type B","RCBO Type F","RCD Type A","RCD Type AC","MCB Type B","MCB Type C","MCB Type D","ELCB","RCCB"];
// ─────────────────────────────────────────────────────────────────────────
// DEFAULT PROJECT DATA
// ─────────────────────────────────────────────────────────────────────────
// No default project — users import or create their own
// ─────────────────────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────
const K_PROJECTS  = "rcd-projects-v6";
const K_RESULTS   = "rcd-results-v6";
const K_META      = "rcd-meta-v6";
const K_HISTORY   = "rcd-history-v6";
const K_DROPDOWNS = "rcd-dropdowns-v6";
const K_LOGO      = "rcd-logo-v6";       // base64 data-URL of uploaded logo
const load = async (key, fallback) => { try { const r=localStorage.getItem(key); return r?JSON.parse(r):fallback; } catch(_) { return fallback; } };
const save = async (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {} };
// ─────────────────────────────────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────────────────────────────────
function getCircuitData(results, pid, aid, panid, circuit) {
return _nullishCoalesce(_optionalChain([results, 'optionalAccess', _2 => _2[pid], 'optionalAccess', _3 => _3[aid], 'optionalAccess', _4 => _4[panid], 'optionalAccess', _5 => _5[circuit]])
, () => ( { push:{status:STATUS.UNTESTED,comment:""}, inject:{resultPos:"",resultNeg:"",status:STATUS.UNTESTED,comment:"",rectified:"",scheduledDate:"",defectId:"",responsibility:"Vorick Group",priority:""} }));
}
function getCircuitStatus(results, pid, aid, panid, circuit, mode) {
const d=getCircuitData(results,pid,aid,panid,circuit);
return mode==="inject"?(_nullishCoalesce(_optionalChain([d, 'access', _6 => _6.inject, 'optionalAccess', _7 => _7.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'access', _8 => _8.push, 'optionalAccess', _9 => _9.status]), () => (STATUS.UNTESTED)));
}
function summariseProject(results, project, mode) {
let total=0,pass=0,fail=0,na=0,untested=0;
project.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{
total++; const v=getCircuitStatus(results,project.id,a.id,p.id,c,mode);
if(v===STATUS.PASS)pass++; else if(v===STATUS.FAIL)fail++; else if(v===STATUS.NA)na++; else untested++;
})));
return {total,pass,fail,na,untested};
}
function panelSummary(results, pid, aid, panel, mode) {
let pass=0,fail=0,na=0,untested=0;
panel.circuits.forEach(c=>{ const v=getCircuitStatus(results,pid,aid,panel.id,c,mode);
if(v===STATUS.PASS)pass++; else if(v===STATUS.FAIL)fail++; else if(v===STATUS.NA)na++; else untested++; });
return {pass,fail,na,untested};
}
// ─────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT
// ─────────────────────────────────────────────────────────────────────────
// Split "CREEK PUMP DB CB1" or "MSB1 CB 4" → { panel, circuit }
// Returns null if no circuit token found (e.g. "MSB PUMP", "MSB1 SPD RIGHT SECTION")
// Returns true if an injection test ms value represents a failure (>300ms)
// Handles: ">300ms", ">300", "350", "350.5", "-350" (abs value), "300+" etc.
function msIsOver(val) {
if (!val && val !== 0) return false;
const s = String(val).trim().toLowerCase();
// Explicit >300 text
if (s.includes(">300") || s.includes("300ms") || s.includes(">300ms")) return true;
// Parse numeric value — strip any leading > or ms suffix, take absolute value
const num = parseFloat(s.replace(/[^0-9.\-]/g, ""));
if (!isNaN(num) && Math.abs(num) > 300) return true;
return false;
}
function parsePanelCircuit(raw) {
const s = raw.trim();
const m = s.match(/^(.+?)\s+(CB\s*\d+[A-Za-z]?|RCCD|RCBO|AIRCON)$/i);
if (!m) return null;
return {
panel:   m[1].trim().toUpperCase(),
circuit: m[2].replace(/\s+/g, "").toUpperCase(),
};
}
// For unsplit rows (no CB token), find the longest word-aligned prefix
// shared with at least one other row in the same area.
function findSharedPrefix(s, allStrings) {
const sWords = s.toUpperCase().split(/\s+/);
let bestLen = 0;
allStrings.forEach(other => {
if (other.toUpperCase() === s.toUpperCase()) return;
const oWords = other.toUpperCase().split(/\s+/); // keep dashes intact for token matching
let i = 0;
while (i < sWords.length - 1 && i < oWords.length && sWords[i] === oWords[i]) i++;
if (i > bestLen) bestLen = i;
});
return bestLen > 0 ? sWords.slice(0, bestLen).join(" ") : s.toUpperCase();
}
// After initial panel assignment, collapse longer names into shorter siblings.
// "MSB1-DB" → "MSB1" when "MSB1" already exists as a panel name.
function collapsePanelNames(resolved) {
const names = [...new Set(resolved.map(r => r.panel))];
const collapseMap = {};
names.forEach(p => {
const pNorm = p.replace(/[-–]/g, " ");
const shorter = names.find(other => {
if (other === p) return false;
const oNorm = other.replace(/[-–]/g, " ");
return pNorm.startsWith(oNorm + " ") || pNorm.startsWith(oNorm + "-");
});
collapseMap[p] = shorter || p;
});
return resolved.map(r => {
const canonical = collapseMap[r.panel] || r.panel;
let circuit = r.circuit;
if (canonical !== r.panel) {
const suffix = r.panel.slice(canonical.length).replace(/^[\s\-–]+/, "").trim();
if (suffix) circuit = (suffix + " " + circuit).trim();
}
return { panel: canonical, circuit };
});
}
// extractBoardPrefix / buildPrefixMap kept for the consolidate-existing-project button
function extractBoardPrefix(raw) {
if (!raw) return "";
return raw.trim().split(/[\s\-–]+/)[0].toUpperCase();
}
function buildPrefixMap(panelNames) {
const map = {};
panelNames.forEach(p => {
const pNorm = p.replace(/[-–]/g, " ");
const sibling = panelNames.find(other => {
if (other === p) return false;
const oNorm = other.replace(/[-–]/g, " ");
return pNorm.toUpperCase().startsWith(oNorm.toUpperCase() + " ") ||
pNorm.toUpperCase().startsWith(oNorm.toUpperCase() + "-");
});
map[p] = sibling || p;
});
return map;
}
function parseExcelToProject(data, projectName, company, abn, licence) {
const ws   = data.Sheets[data.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
// Find header row
let headerIdx = -1;
for (let i = 0; i < Math.min(rows.length, 15); i++) {
const r = rows[i].map(c => String(c).toLowerCase());
if (r.some(c => c.includes("area"))) { headerIdx = i; break; }
}
if (headerIdx === -1) headerIdx = 0;
const header = rows[headerIdx].map(c => String(c).toLowerCase().trim());
// Find the Area column (col with "area" in header)
const aC = Math.max(0, header.findIndex(h => h.includes("area")));
// Find the Panel/Asset Name column — the column right after area,
// or the one with "panel" / "asset" in the header
// This column contains the full combined string like "MSB1-DB CB 9"
let pC = header.findIndex(h =>
(h.includes("panel") || h.includes("asset") || h.includes("name")) &&
!h.includes("device") && !h.includes("type")
);
if (pC < 0) pC = aC + 1; // fallback: column right after area
// Collect all panel/asset names grouped by area
// We intentionally ignore all other columns — they are test results, not structure
const rawByArea = {};
for (let i = headerIdx + 1; i < rows.length; i++) {
const row  = rows[i];
const aRaw = String(row[aC] || "").trim();
const pRaw = String(row[pC] || "").trim();
if (!aRaw && !pRaw) continue;
// Skip rows that look like repeated headers
if (aRaw.toLowerCase() === "area") continue;
const aKey = aRaw || "General";
if (!rawByArea[aKey]) rawByArea[aKey] = [];
if (pRaw) rawByArea[aKey].push(pRaw);
}
const areaMap = {};
Object.entries(rawByArea).forEach(([aName, panelStrs]) => {
// Each string in panelStrs is a combined "BOARD CIRCUIT" string
// Parse: split at last CB token if present, otherwise group by shared prefix
let resolved = panelStrs.map(pRaw => {
const split = parsePanelCircuit(pRaw);
if (split) return split;
// No circuit token — use shared prefix with siblings
const prefix  = findSharedPrefix(pRaw, panelStrs);
const circuit = pRaw.slice(prefix.length).replace(/^[\s\-–_]+/, "").trim() || pRaw;
return { panel: prefix, circuit };
});
// Collapse "MSB1-DB" → "MSB1" where "MSB1" also exists
resolved = collapsePanelNames(resolved);
areaMap[aName] = {};
resolved.forEach(({ panel, circuit }) => {
if (!areaMap[aName][panel]) areaMap[aName][panel] = new Set();
areaMap[aName][panel].add(circuit);
});
});
const areas = Object.entries(areaMap).map(([aName, panelObj]) => ({
id: slugify(aName),
name: aName,
panels: Object.entries(panelObj).map(([pName, circuits]) => ({
id: slugify(pName),
name: pName,
circuits: [...circuits],
})),
}));
return { id: slugify(projectName), name: projectName, company: company || "Vorick Group", abn: abn || "", licence: licence || "", areas };
}
// ─────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT — styled to match PDF report exactly
// ─────────────────────────────────────────────────────────────────────────
// Colours matching the defects register image exactly:
// U=dark maroon bg, H=red/salmon bg, M=yellow bg, L=light green bg, Pass=white (no fill), Fail=red bg
const C = {
orange:    "FFE8731A",  // Vorick orange header
white:     "FFFFFFFF",
darkGrey:  "FF2D2D2D",
lightGrey: "FFF5F5F5",
midGrey:   "FFD9D9D9",
// Row backgrounds — match image
passWhite: "FFFFFFFF",  // Pass = plain white (no colour)
failRed:   "FFFFC7CE",  // Fail = light red (Excel standard fail red)
naGrey:    "FFF2F2F2",
// Priority row colours — exact match to image
priorityU_bg:   "FF9B0000",  // Urgent = dark maroon row background
priorityU_font: "FFFFFFFF",  // white text
priorityH_bg:   "FFFFC7CE",  // High   = light red/salmon (same as image)
priorityH_font: "FF9C0006",  // dark red text
priorityM_bg:   "FFFFD966",  // Medium = yellow (matches image)
priorityM_font: "FF7F6000",  // dark gold text
priorityL_bg:   "FFE2EFDA",  // Low    = light green (matches image)
priorityL_font: "FF375623",  // dark green text
};
const border = (style="thin",color=C.midGrey) => ({style,color:{rgb:color}});
const allBorders = (style="thin",color=C.midGrey) => ({top:border(style,color),bottom:border(style,color),left:border(style,color),right:border(style,color)});
const btmBorder = (color=C.midGrey) => ({bottom:border("hair",color)});
function cellStyle(fill,font={},align={},borders={}) {
return { fill:{patternType:"solid",fgColor:{rgb:fill}}, font:{name:"Calibri",sz:10,...font}, alignment:{vertical:"center",...align}, border:borders };
}
const titleStyle    = cellStyle(C.darkGrey,  {bold:true,sz:14,color:{rgb:C.white}},    {horizontal:"left"});
const subtitleStyle = cellStyle("FF1E1E1E",  {sz:9,color:{rgb:"FFbbbbbb"}},             {horizontal:"left"});
const metaStyle     = cellStyle("FF262626",  {sz:9,color:{rgb:"FF999999"}},             {horizontal:"left"});
const spacerStyle   = cellStyle("FF1E1E1E");
const hdrStyle      = cellStyle(C.orange,    {bold:true,sz:10,color:{rgb:C.white}},    {horizontal:"center",wrapText:true}, allBorders("thin","FFB85A10"));
// Priority colours for the ENTIRE ROW (used when priority is set and it's a fail/defect)
function priorityRowColour(priority) {
if (priority === "U") return { bg: C.priorityU_bg, font: C.priorityU_font, bold: true };
if (priority === "H") return { bg: C.priorityH_bg, font: C.priorityH_font, bold: false };
if (priority === "M") return { bg: C.priorityM_bg, font: C.priorityM_font, bold: false };
if (priority === "L") return { bg: C.priorityL_bg, font: C.priorityL_font, bold: false };
return null;
}
function dataStyle(ri, pf, priority="") {
// Priority colour overrides everything — if priority is set, use it
if (priority) {
const priColor = priorityRowColour(priority);
if (priColor) {
return cellStyle(priColor.bg, {sz:9,color:{rgb:priColor.font},bold:priColor.bold}, {wrapText:true}, btmBorder(C.midGrey));
}
}
// No priority — colour by pass/fail status
let bg = ri%2===0 ? C.white : C.lightGrey;
let fontColor = C.darkGrey; let bold = false;
if (pf === "Pass")    { bg = C.passWhite; }
if (pf === "Fail")    { bg = C.failRed; fontColor = C.priorityH_font; bold = true; }
if (pf === "N/A")     { bg = C.naGrey; }
return cellStyle(bg, {sz:9,color:{rgb:fontColor},bold}, {wrapText:true}, btmBorder(C.midGrey));
}
function setCell(ws, ref, value, style) {
const t = typeof value === "number" ? "n" : "s";
ws[ref] = { v: _nullishCoalesce(value, () => ( "")), t, s: style };
}
function exportExcel(results, project, meta, mode, logoBase64) {
const wb = XLSX.utils.book_new();
const testDate = mode==="inject" ? (_optionalChain([meta, 'optionalAccess', _10 => _10.injectDate])||"") : (_optionalChain([meta, 'optionalAccess', _11 => _11.pushDate])||"");
const nextDue  = mode==="inject" ? addYears(testDate,1)   : addMonths(testDate,1);
const label    = mode==="inject" ? "Annual Injection Test" : "Monthly Push Test";
const isInject = mode === "inject";
const headers = isInject
? ["Area","Panel / Asset Name","Device Type","Amp Rating","Date","Injection Test Result + (ms)","Injection Test Result - (ms)","Pass / Fail","Rectified / Scheduled","Date Rectified / Scheduled","Defect ID","Responsibility","Notes / Recommendations","Priority\n(L,M,H,U)","Next Test Required"]
: ["Area","Panel / Asset Name","Device Type","Amp Rating","Date Tested","Pass / Fail","Notes / Comments","Next Test Required"];
const n = headers.length;
const colLetters = "ABCDEFGHIJKLMNO".slice(0,n).split("");
const rows = [];
rows.push([`${project.name}  –  RCD & ELR Test  (${label})`, ...Array(n-1).fill("")]);
const coLine = `${project.company||"Vorick Group"} Asset Maintenance Pty. Ltd.${project.abn?`  |  ABN: ${project.abn}`:""}${project.licence?`  |  Electrical Licence: ${project.licence}`:""}`;
rows.push([coLine, ...Array(n-1).fill("")]);
rows.push([`Auditor: ${_optionalChain([meta, 'optionalAccess', _12 => _12.auditor])||""}`, "", `Date Tested: ${fmtDate(testDate)}`, "", `Next ${label} Due: ${nextDue}`, ...Array(Math.max(0,n-5)).fill("")]);
rows.push(Array(n).fill(""));
rows.push(headers);
const dataStart = 6;
const dataRows  = [];
project.areas.forEach(area => area.panels.forEach(panel => panel.circuits.forEach(circuit => {
const d   = getCircuitData(results, project.id, area.id, panel.id, circuit);
const inj = _nullishCoalesce(d.inject, () => ( {}));
const push = _nullishCoalesce(d.push, () => ( {}));
const st  = isInject ? (_nullishCoalesce(_optionalChain([d, 'access', _13 => _13.inject, 'optionalAccess', _14 => _14.status]), () => (STATUS.UNTESTED))) : (_nullishCoalesce(_optionalChain([d, 'access', _15 => _15.push, 'optionalAccess', _16 => _16.status]), () => (STATUS.UNTESTED)));
// If ms values indicate >300ms, treat as Fail regardless of stored status
const msOver = isInject && (msIsOver(inj.resultPos) || msIsOver(inj.resultNeg));
const pf  = msOver ? "Fail" : st===STATUS.PASS?"Pass":st===STATUS.FAIL?"Fail":st===STATUS.NA?"N/A":"Untested";
const cbType = isInject ? (inj.cbType||"RCBO Type A") : (push.cbType||"RCBO Type A");
const ampRating = isInject ? (inj.ampRating||"") : (push.ampRating||"");
dataRows.push({ area:area.name, panelCircuit:`${panel.name} ${circuit}`, pf, inj, push, cbType, ampRating });
if (isInject) {
rows.push([area.name,`${panel.name} ${circuit}`,cbType,ampRating,fmtDate(testDate),
inj.resultPos||"",inj.resultNeg||"",pf,
inj.rectified||"",inj.scheduledDate?fmtDate(inj.scheduledDate):"",
inj.defectId||"",inj.responsibility||"",inj.comment||"",inj.priority||"",nextDue]);
} else {
rows.push([area.name,`${panel.name} ${circuit}`,cbType,ampRating,fmtDate(testDate),pf,push.comment||"",nextDue]);
}
})));
rows.push(Array(n).fill(""));
rows.push([`Notes: ${_optionalChain([meta, 'optionalAccess', _17 => _17.notes])||""}`, ...Array(n-1).fill("")]);
const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = isInject
? [{wch:20},{wch:24},{wch:14},{wch:9},{wch:11},{wch:16},{wch:16},{wch:10},{wch:20},{wch:14},{wch:10},{wch:16},{wch:34},{wch:12},{wch:16}]
: [{wch:20},{wch:26},{wch:14},{wch:9},{wch:13},{wch:10},{wch:42},{wch:16}];
ws["!rows"] = [{hpt:32},{hpt:16},{hpt:16},{hpt:6},{hpt:40}];
ws["!merges"] = [
{s:{r:0,c:0},e:{r:0,c:n-1}},
{s:{r:1,c:0},e:{r:1,c:n-1}},
{s:{r:2,c:0},e:{r:2,c:1}},
{s:{r:2,c:2},e:{r:2,c:3}},
{s:{r:2,c:4},e:{r:2,c:n-1}},
{s:{r:3,c:0},e:{r:3,c:n-1}},
];
// Style header rows
colLetters.forEach(col => {
setCell(ws, `${col}1`, _nullishCoalesce(_optionalChain([ws, 'access', _18 => _18[`${col}1`], 'optionalAccess', _19 => _19.v]), () => ( "")), titleStyle);
setCell(ws, `${col}2`, _nullishCoalesce(_optionalChain([ws, 'access', _20 => _20[`${col}2`], 'optionalAccess', _21 => _21.v]), () => ( "")), subtitleStyle);
setCell(ws, `${col}3`, _nullishCoalesce(_optionalChain([ws, 'access', _22 => _22[`${col}3`], 'optionalAccess', _23 => _23.v]), () => ( "")), metaStyle);
setCell(ws, `${col}4`, "", spacerStyle);
setCell(ws, `${col}5`, _nullishCoalesce(_optionalChain([ws, 'access', _24 => _24[`${col}5`], 'optionalAccess', _25 => _25.v]), () => ( "")), hdrStyle);
});
// Style data rows
let excelRow = dataStart;
dataRows.forEach((dr, ri) => {
const pf       = dr.pf;
const priority = isInject ? (_optionalChain([dr, 'access', _26 => _26.inj, 'optionalAccess', _27 => _27.priority])||"") : "";
colLetters.forEach(col => {
const ref = `${col}${excelRow}`;
const val = _nullishCoalesce(_optionalChain([ws, 'access', _28 => _28[ref], 'optionalAccess', _29 => _29.v]), () => ( ""));
setCell(ws, ref, val, dataStyle(ri, pf, priority));
});
excelRow++;
});
XLSX.utils.book_append_sheet(wb, ws, label.slice(0,31));
// Summary sheet
const sum = summariseProject(results, project, mode);
const fails = [];
project.areas.forEach(a => a.panels.forEach(p => p.circuits.forEach(c => {
const d  = getCircuitData(results, project.id, a.id, p.id, c);
const st = isInject?(_nullishCoalesce(_optionalChain([d, 'access', _30 => _30.inject, 'optionalAccess', _31 => _31.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'access', _32 => _32.push, 'optionalAccess', _33 => _33.status]), () => (STATUS.UNTESTED)));
const pri= isInject?(_optionalChain([d, 'access', _34 => _34.inject, 'optionalAccess', _35 => _35.priority])||""):"";
if (st===STATUS.FAIL) fails.push([a.name,p.name,c,isInject?(_optionalChain([d, 'access', _36 => _36.inject, 'optionalAccess', _37 => _37.comment])||""):(_optionalChain([d, 'access', _38 => _38.push, 'optionalAccess', _39 => _39.comment])||""),pri]);
})));
const sumRows=[
[`${project.name} – RCD Test Summary`,""],["",""],
["Test Type",label],["Date",fmtDate(testDate)],["Auditor",_optionalChain([meta, 'optionalAccess', _40 => _40.auditor])||""],["",""],
["Total",sum.total],["Pass",sum.pass],["Fail",sum.fail],["N/A",sum.na],["Untested",sum.untested],["",""],
["Next Test Due",nextDue],["",""],
["Failed Circuits","","","",""],
["Area","Panel","Circuit","Notes","Priority"],
...fails,
];
const ws2=XLSX.utils.aoa_to_sheet(sumRows);
ws2["!cols"]=[{wch:22},{wch:22},{wch:12},{wch:40},{wch:10}];
if(ws2["A1"]) ws2["A1"].s=titleStyle;
["A","B","C","D","E"].forEach(col=>{const ref=`${col}16`;if(ws2[ref])ws2[ref].s=hdrStyle;});
fails.forEach((f,ri)=>{
const r=17+ri; const pri=f[4]||"";
["A","B","C","D"].forEach(col=>{const ref=`${col}${r}`;if(!ws2[ref])ws2[ref]={v:"",t:"s"};ws2[ref].s=dataStyle(ri,"Fail",pri);});
const ref=`E${r}`;if(!ws2[ref])ws2[ref]={v:pri,t:"s"};ws2[ref].s=dataStyle(ri,"Fail",pri);
});
XLSX.utils.book_append_sheet(wb,ws2,"Summary");
// Write workbook with cellStyles — use base64 data URI which works in sandboxed iframes
const wbOut = XLSX.write(wb, {bookType:"xlsx", type:"base64", cellStyles:true, bookSST:false});
const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbOut}`;
const filename = `${project.name.replace(/\s+/g,"_")}_RCD_${isInject?"Injection":"Push"}_${testDate||"export"}.xlsx`;
// Open in new tab — user taps the link to download
const win = window.open("", "_blank");
if (win) {
win.document.write(`<!DOCTYPE html><html><head><title>${filename}</title></head><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee;">
<h2 style="color:#e8731a">📄 ${filename}</h2>
<p>Tap the link below to download your spreadsheet:</p>
<a href="${dataUri}" download="${filename}" style="display:inline-block;padding:14px 24px;background:#e8731a;color:#fff;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;margin-top:12px;">
⬇ Download Excel File
</a>
<p style="color:#555;font-size:12px;margin-top:20px;">If download doesn't start automatically, long-press the button and choose "Download Link".</p>
</body></html>`);
win.document.close();
}
}
// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE DOWNLOAD — gives user a sample import spreadsheet
// ─────────────────────────────────────────────────────────────────────────
function downloadTemplate() {
const wb=XLSX.utils.book_new();
const rows=[
["Area","Panel / DB Name","Circuit / CB"],
["ONR Workshop","DB2","CB1"],
["ONR Workshop","DB2","CB2"],
["ONR Workshop","DB2","CB3"],
["ONR Workshop","DB Office","CB1"],
["ONR Workshop","DB Office","CB2"],
["Wash Plant","DB Wash Plant","CB9"],
["Wash Plant","DB Wash Plant","CB10"],
["Wash Plant","DB Lunch Shed","CB1"],
];
const ws=XLSX.utils.aoa_to_sheet(rows);
ws["!cols"]=[{wch:24},{wch:24},{wch:16}];
XLSX.utils.book_append_sheet(wb,ws,"RCD Import Template");
const tOut = XLSX.write(wb, {bookType:"xlsx", type:"base64", cellStyles:true});
const tUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${tOut}`;
const tw = window.open("", "_blank");
if (tw) {
tw.document.write(`<!DOCTYPE html><html><head><title>RCD Import Template</title></head><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee;">
<h2 style="color:#e8731a">📄 RCD_Import_Template.xlsx</h2>
<a href="${tUri}" download="RCD_Import_Template.xlsx" style="display:inline-block;padding:14px 24px;background:#e8731a;color:#fff;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">⬇ Download Template</a>
</body></html>`);
tw.document.close();
}
}
// ═════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════════════
function App() {
const [projects,      setProjects]     = React.useState([]);
const [allResults,    setAllResults]   = React.useState({});
const [allMeta,       setAllMeta]      = React.useState({});
const [history,       setHistory]      = React.useState([]);
const [dropdowns,     setDropdowns]    = React.useState({ responsibility:DEFAULT_RESPONSIBILITY, rectified:DEFAULT_RECTIFIED });
const [logo,          setLogo]         = React.useState(null);  // base64 data-URL
const [activeProject, setActiveProject]= React.useState(null);
const [mode,          setMode]         = React.useState(null);
const [view,          setView]         = React.useState("projects");
const [activeAreaId,  setActiveAreaId] = React.useState(null);
const [activePanelId, setActivePanelId]= React.useState(null);
const [loaded,        setLoaded]       = React.useState(false);
const [saveFlash,     setSaveFlash]    = React.useState(false);
const [detailInfo,    setDetailInfo]   = React.useState(null);
React.useEffect(()=>{
(async()=>{
const [p,r,m,h,d,l]=await Promise.all([
load(K_PROJECTS,[]),
load(K_RESULTS,{}),
load(K_META,{}),
load(K_HISTORY,[]),
load(K_DROPDOWNS,{responsibility:DEFAULT_RESPONSIBILITY,rectified:DEFAULT_RECTIFIED,ampRating:DEFAULT_AMP_RATING,cbType:DEFAULT_CB_TYPE}),
load(K_LOGO,null),
]);
setProjects(p);setAllResults(r);setAllMeta(m);setHistory(h);setDropdowns(d);setLogo(l);setLoaded(true);
})();
},[]);
React.useEffect(()=>{ if(loaded){save(K_PROJECTS,projects);} },[projects,loaded]);
React.useEffect(()=>{ if(loaded){save(K_RESULTS,allResults);setSaveFlash(true);const t=setTimeout(()=>setSaveFlash(false),1200);return()=>clearTimeout(t);} },[allResults,loaded]);
React.useEffect(()=>{ if(loaded){save(K_META,allMeta);} },[allMeta,loaded]);
React.useEffect(()=>{ if(loaded){save(K_HISTORY,history);} },[history,loaded]);
React.useEffect(()=>{ if(loaded){save(K_DROPDOWNS,dropdowns);} },[dropdowns,loaded]);
React.useEffect(()=>{ if(loaded){save(K_LOGO,logo);} },[logo,loaded]);
const project = projects.find(p=>p.id===activeProject);
const meta    = _nullishCoalesce(allMeta[activeProject], () => ({auditor:"",pushDate:new Date().toISOString().slice(0,10),injectDate:new Date().toISOString().slice(0,10),notes:""}));
const setMeta = patch=>setAllMeta(prev=>({...prev,[activeProject]:{...meta,...patch}}));
const area    = _optionalChain([project, 'optionalAccess', _41 => _41.areas, 'access', _42 => _42.find, 'call', _43 => _43(a=>a.id===activeAreaId)]);
const panel   = _optionalChain([area, 'optionalAccess', _44 => _44.panels, 'access', _45 => _45.find, 'call', _46 => _46(p=>p.id===activePanelId)]);
const patchCircuit=(pid,aid,panid,circuit,patch)=>{
setAllResults(prev=>{
const old=_nullishCoalesce(_optionalChain([prev, 'optionalAccess', _47 => _47[pid], 'optionalAccess', _48 => _48[aid], 'optionalAccess', _49 => _49[panid], 'optionalAccess', _50 => _50[circuit]]), () => ({push:{},inject:{}}));
return {...prev,[pid]:{...prev[pid],[aid]:{...(_nullishCoalesce(prev[pid], () => ({})))[aid],[panid]:{...(_nullishCoalesce((_nullishCoalesce(prev[pid], () => ({})))[aid], () => ({})))[panid],[circuit]:{...old,...patch}}}}};
});
};
const cycleCircuit=(aid,panid,circuit)=>{
const d=getCircuitData(allResults,activeProject,aid,panid,circuit);
if(mode==="push") patchCircuit(activeProject,aid,panid,circuit,{push:{...d.push,status:cycleS(_nullishCoalesce(_optionalChain([d, 'access', _51 => _51.push, 'optionalAccess', _52 => _52.status]), () => (STATUS.UNTESTED)))}});
else patchCircuit(activeProject,aid,panid,circuit,{inject:{...d.inject,status:cycleS(_nullishCoalesce(_optionalChain([d, 'access', _53 => _53.inject, 'optionalAccess', _54 => _54.status]), () => (STATUS.UNTESTED)))}});
};
const setAllPanel=(aid,panid,circuits,status)=>{
setAllResults(prev=>{
const base=_nullishCoalesce(prev, () => ({}));const proj={...base[activeProject]};const ar={...proj[aid]};const pan={...ar[panid]};
circuits.forEach(c=>{const old=_nullishCoalesce(pan[c], () => ({push:{},inject:{}}));pan[c]=mode==="push"?{...old,push:{...old.push,status}}:{...old,inject:{...old.inject,status}};});
ar[panid]=pan;proj[aid]=ar;return {...base,[activeProject]:proj};
});
};
// ── Archive current audit ─────────────────────────────────────────────
const archiveAudit = (archiveMode) => {
const snap = {
id: uid(),
projectId: activeProject,
projectName: _optionalChain([project, 'optionalAccess', _55 => _55.name])||"",
mode: archiveMode,
label: archiveMode==="inject"?"Annual Injection Test":"Monthly Push Test",
testDate: archiveMode==="inject"?(_optionalChain([meta, 'optionalAccess', _56 => _56.injectDate])||_optionalChain([meta, 'optionalAccess', _57 => _57.pushDate])||""):(_optionalChain([meta, 'optionalAccess', _58 => _58.pushDate])||""),
auditor: _optionalChain([meta, 'optionalAccess', _59 => _59.auditor])||"",
archivedAt: new Date().toISOString(),
results: JSON.parse(JSON.stringify(allResults[activeProject]||{})),
meta: {...meta},
};
setHistory(prev=>[snap,...prev].slice(0,100)); // keep last 100
return snap;
};
const goProjects=()=>{setView("projects");setActiveProject(null);setMode(null);setActiveAreaId(null);setActivePanelId(null);};
const goHome=()=>{setView("home");setMode(null);setActiveAreaId(null);setActivePanelId(null);};
if(!loaded) return React.createElement('div', { style: S.loader,}, React.createElement('div', { style: S.loaderSpinner,}), React.createElement('p', { style: {color:"#aaa",marginTop:16},}, "Loading…"));
const modeColor=mode==="push"?"#e8731a":"#3b82f6";
const modeLabel=mode==="push"?"MONTHLY PUSH TEST":"ANNUAL INJECTION TEST";
const isAudit=view==="audit"||view==="panel";
const summary=project?summariseProject(allResults,project,mode||"push"):{total:0,pass:0,fail:0,na:0,untested:0};
return (
React.createElement('div', { style: S.root,}
, React.createElement('header', { style: {...S.topbar,borderBottom:`2px solid ${mode?modeColor+"33":"#222"}`},}
, React.createElement('div', { style: S.topbarLeft,}
, view!=="projects" && React.createElement('button', { style: S.backBtn, onClick: ()=>{
if(view==="panel"){setView("audit");setActivePanelId(null);}
else if(view==="audit"){setView("home");setActiveAreaId(null);}
else if(["manage","report","history","settings"].includes(view)){setView("home");}
else goHome();
},}, "‹")
, React.createElement('div', null
, React.createElement('div', { style: S.appTitle,}, "RCD TEST" )
, React.createElement('div', { style: {...S.appSub,color:mode?modeColor:"#555"},}, view==="projects"?"Project Select":_optionalChain([project, 'optionalAccess', _60 => _60.name])||"")
)
)
, React.createElement('div', { style: S.topbarRight,}
, React.createElement('div', { style: {...S.saveIndicator,opacity:saveFlash?1:0},}, "✓ Saved" )
, mode&&project&&React.createElement(React.Fragment, null, React.createElement(StatPill, { label: "PASS", val: summary.pass, col: "#22c55e",}), React.createElement(StatPill, { label: "FAIL", val: summary.fail, col: "#ef4444",}), React.createElement(StatPill, { label: "UNTESTED", val: summary.untested, col: "#f59e0b",}))
)
)
, view!=="projects"&&(
React.createElement('div', { style: S.breadcrumb,}
, React.createElement('span', { style: S.bcItem, onClick: goProjects,}, "Projects")
, project&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: S.bcItem, onClick: goHome,}, project.name))
, mode&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: {...S.bcItem,color:modeColor},}, modeLabel))
, activeAreaId&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: S.bcItem, onClick: ()=>{setView("audit");setActivePanelId(null);},}, _optionalChain([area, 'optionalAccess', _61 => _61.name])))
, activePanelId&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: {...S.bcItem,color:modeColor},}, _optionalChain([panel, 'optionalAccess', _62 => _62.name])))
, view==="manage"&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: {...S.bcItem,color:"#a855f7"},}, "Manage"))
, view==="history"&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: {...S.bcItem,color:"#f59e0b"},}, "History"))
, view==="settings"&&React.createElement(React.Fragment, null, React.createElement('span', { style: S.bcSep,}, "›"), React.createElement('span', { style: {...S.bcItem,color:"#64748b"},}, "Settings"))
)
)
, React.createElement('main', { style: S.main,}
, view==="projects"&&React.createElement(ProjectListView, { projects: projects, allResults: allResults, dropdowns: dropdowns,
onSelect: id=>{setActiveProject(id);setView("home");},
onAddProject: p=>setProjects(prev=>[...prev,p]),
onDeleteProject: id=>{setProjects(prev=>prev.filter(p=>p.id!==id));if(activeProject===id)goProjects();},})
, view==="home"&&project&&React.createElement(ProjectHomeView, { project: project, meta: meta, setMeta: setMeta, results: allResults,
onStartPush: ()=>{setMode("push");setView("audit");},
onStartInject: ()=>{setMode("inject");setView("audit");},
onReport: ()=>setView("report"), onManage: ()=>setView("manage"),
onHistory: ()=>setView("history"), onSettings: ()=>setView("settings"),
onReset: ()=>setAllResults(prev=>({...prev,[activeProject]:{}})),
onExportPush: ()=>exportExcel(allResults,project,meta,"push",logo),
onExportInject: ()=>exportExcel(allResults,project,meta,"inject",logo),
onArchive: archiveAudit,})
, isAudit&&project&&!activeAreaId&&React.createElement(AreaListView, { project: project, results: allResults, mode: mode, modeColor: modeColor, onSelect: id=>setActiveAreaId(id),})
, isAudit&&project&&activeAreaId&&!activePanelId&&React.createElement(PanelListView, { area: area, project: project, results: allResults, mode: mode, modeColor: modeColor, onSelect: id=>{setActivePanelId(id);setView("panel");},})
, view==="panel"&&panel&&React.createElement(CircuitGrid, { area: area, panel: panel, project: project, results: allResults, mode: mode, modeColor: modeColor,
onCycle: c=>cycleCircuit(activeAreaId,activePanelId,c),
onSetAll: s=>setAllPanel(activeAreaId,activePanelId,panel.circuits,s),
onOpenDetail: c=>setDetailInfo({areaId:activeAreaId,panelId:activePanelId,circuit:c}),})
, view==="report"&&project&&React.createElement(ReportView, { project: project, results: allResults, meta: meta, onExportPush: ()=>exportExcel(allResults,project,meta,"push",logo), onExportInject: ()=>exportExcel(allResults,project,meta,"inject",logo), onArchive: archiveAudit,})
, view==="manage"&&project&&React.createElement(ManageView, { project: project, onUpdateProject: updated=>setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p)),})
, view==="history"&&React.createElement(HistoryView, { history: history.filter(h=>h.projectId===activeProject), project: project, onDelete: id=>setHistory(prev=>prev.filter(h=>h.id!==id)), onExportSnap: (snap)=>exportExcel({[snap.projectId]:snap.results},projects.find(p=>p.id===snap.projectId)||project,snap.meta,snap.mode,logo),})
, view==="settings"&&React.createElement(SettingsView, { dropdowns: dropdowns, setDropdowns: setDropdowns, logo: logo, setLogo: setLogo,})
)
, detailInfo&&project&&React.createElement(DetailModal, { ...detailInfo, project: project, mode: mode, results: allResults, meta: meta, dropdowns: dropdowns,
onPatch: patch=>patchCircuit(activeProject,detailInfo.areaId,detailInfo.panelId,detailInfo.circuit,patch),
onClose: ()=>setDetailInfo(null),})
, view!=="projects"&&(
React.createElement('nav', { style: S.bottomNav,}
, React.createElement(NavBtn, { icon: "⌂", label: "Home",      active: view==="home",     onClick: goHome,})
, React.createElement(NavBtn, { icon: "☑", label: "Audit",     active: isAudit,           onClick: ()=>{setView("audit");setActivePanelId(null);},})
, React.createElement(NavBtn, { icon: "≡", label: "Report",    active: view==="report",   onClick: ()=>setView("report"),})
, React.createElement(NavBtn, { icon: "🕐", label: "History",  active: view==="history",  onClick: ()=>setView("history"), color: "#f59e0b",})
, React.createElement(NavBtn, { icon: "⚙", label: "Manage",   active: view==="manage",   onClick: ()=>setView("manage"), color: "#a855f7",})
, React.createElement(NavBtn, { icon: "▾", label: "Dropdowns", active: view==="settings", onClick: ()=>setView("settings"), color: "#64748b",})
)
)
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// PROJECT LIST — with Excel Import
// ─────────────────────────────────────────────────────────────────────────
function ProjectListView({ projects, allResults, dropdowns, onSelect, onAddProject, onDeleteProject }) {
const [showAdd,    setShowAdd]    = React.useState(false);
const [tab,        setTab]        = React.useState("manual"); // manual | import
const [newName,    setNewName]    = React.useState("");
const [newCo,      setNewCo]      = React.useState("Vorick Group");
const [newAbn,     setNewAbn]     = React.useState("44 601 045 872");
const [newLic,     setNewLic]     = React.useState("319114C");
const [deleteId,   setDeleteId]   = React.useState(null);
const [importing,  setImporting]  = React.useState(false);
const [importPreview, setImportPreview] = React.useState(null); // parsed project before confirming
const [importName, setImportName] = React.useState("");
const [importCo,   setImportCo]   = React.useState("Vorick Group");
const [importAbn,  setImportAbn]  = React.useState("44 601 045 872");
const [importLic,  setImportLic]  = React.useState("319114C");
const [importError,setImportError]= React.useState("");
const fileRef = React.useRef();
const handleFile = e => {
const file = e.target.files[0]; if(!file) return;
setImporting(true); setImportError("");
const reader=new FileReader();
reader.onload=ev=>{
try {
const data=XLSX.read(ev.target.result,{type:"array"});
// Auto-detect project name from filename
const fname=file.name.replace(/\.(xlsx|xls|csv)$/i,"").replace(/[_-]+/g," ").trim();
setImportName(fname);
const proj=parseExcelToProject(data, fname||"New Project", importCo, importAbn, importLic);
setImportPreview(proj);
} catch(err){ setImportError("Could not parse file: "+err.message); }
setImporting(false);
};
reader.readAsArrayBuffer(file);
e.target.value="";
};
const confirmImport = () => {
if(!importPreview) return;
const finalProject={...importPreview,id:slugify(importName||importPreview.name),name:importName||importPreview.name,company:importCo,abn:importAbn,licence:importLic};
onAddProject(finalProject);
setImportPreview(null);setShowAdd(false);setImportName("");setImportError("");
};
const addManual=()=>{
if(!newName.trim()) return;
onAddProject({id:slugify(newName),name:newName.trim(),company:newCo.trim(),abn:newAbn.trim(),licence:newLic.trim(),areas:[]});
setNewName("");setShowAdd(false);
};
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: S.brandBlock,}, React.createElement('div', { style: S.brandTitle,}, "VORICK GROUP" ), React.createElement('div', { style: S.brandSub,}, "RCD Test Management"  ))
, React.createElement('div', { style: {...S.listTitle,marginTop:24},}, "Projects")
, projects.length===0&&React.createElement('div', { style: {color:"#555",fontSize:14,marginBottom:16},}, "No projects yet."  )
, projects.map(proj=>{
let total=0,pass=0,fail=0;
proj.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{total++;const v=getCircuitStatus(allResults,proj.id,a.id,p.id,c,"push");if(v===STATUS.PASS||v===STATUS.NA)pass++;else if(v===STATUS.FAIL)fail++;})));
const pct=total>0?Math.round((pass/total)*100):0;
return(
React.createElement('div', { key: proj.id, style: {...S.siteCard,flexDirection:"column",gap:0,padding:0,overflow:"hidden"},}
, React.createElement('button', { style: {display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"16px 18px",color:"inherit",textAlign:"left"}, onClick: ()=>onSelect(proj.id),}
, React.createElement('div', { style: {flex:1},}
, React.createElement('div', { style: S.siteCardName,}, proj.name)
, React.createElement('div', { style: S.siteCardSub,}, proj.company||"", " · "  , proj.areas.length, " areas · "   , total, " circuits" )
, React.createElement('div', { style: {...S.siteCardBar,marginTop:8},}, React.createElement('div', { style: {...S.siteCardBarFill,width:`${pct}%`,background:fail>0?"#ef4444":pct<100?"#e8731a":"#22c55e"},}))
)
, React.createElement('div', { style: {display:"flex",alignItems:"center",gap:8,marginLeft:16},}
, fail>0&&React.createElement('span', { style: S.failBadge,}, fail, " FAIL" )
, React.createElement('span', { style: S.arrow,}, "›")
)
)
, deleteId===proj.id
?React.createElement('div', { style: {display:"flex",alignItems:"center",gap:8,padding:"8px 18px",background:"#1e1010",borderTop:"1px solid #333"},}
, React.createElement('span', { style: {fontSize:12,color:"#ef4444",flex:1},}, "Delete \"" , proj.name, "\"?")
, React.createElement('button', { style: S.confirmYes, onClick: ()=>{onDeleteProject(proj.id);setDeleteId(null);},}, "Delete")
, React.createElement('button', { style: S.confirmNo,  onClick: ()=>setDeleteId(null),}, "Cancel")
)
:React.createElement('button', { style: {background:"transparent",border:"none",borderTop:"1px solid #2a2a2a",color:"#555",fontSize:11,padding:"6px 18px",cursor:"pointer",textAlign:"left",width:"100%"}, onClick: e=>{e.stopPropagation();setDeleteId(proj.id);},}, "🗑 Remove project"  )
)
);
})
/* Add / Import */
, showAdd?(
React.createElement('div', { style: S.addCard,}
, React.createElement('div', { style: {display:"flex",gap:8,marginBottom:14},}
, React.createElement('button', { style: {...S.tabBtn,...(tab==="manual"?S.tabBtnActive:{})}, onClick: ()=>setTab("manual"),}, "✏️ Manual Entry"  )
, React.createElement('button', { style: {...S.tabBtn,...(tab==="import"?S.tabBtnActive:{})}, onClick: ()=>setTab("import"),}, "📥 Import from Excel"   )
)
, tab==="manual"&&React.createElement(React.Fragment, null
, React.createElement('div', { style: {fontSize:14,fontWeight:800,color:"#eee",marginBottom:12},}, "New Project" )
, React.createElement(LabelInput, { label: "PROJECT NAME" ,   value: newName, onChange: setNewName, placeholder: "e.g. PF Formation"  ,})
, React.createElement(LabelInput, { label: "COMPANY",        value: newCo,   onChange: setNewCo,   placeholder: "Company name" ,})
, React.createElement(LabelInput, { label: "ABN (optional)" , value: newAbn,  onChange: setNewAbn,  placeholder: "XX XXX XXX XXX"   ,})
, React.createElement(LabelInput, { label: "LICENCE (optional)" , value: newLic, onChange: setNewLic, placeholder: "e.g. 319114C" ,})
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:4},}
, React.createElement('button', { style: S.ctaPrimary, onClick: addManual,}, "Add Project" )
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setShowAdd(false),}, "Cancel")
)
)
, tab==="import"&&React.createElement(React.Fragment, null
, React.createElement('div', { style: {fontSize:14,fontWeight:800,color:"#eee",marginBottom:4},}, "Import from Excel"  )
, React.createElement('div', { style: {fontSize:12,color:"#666",marginBottom:12},}, "Upload a spreadsheet with columns: "     , React.createElement('strong', { style: {color:"#aaa"},}, "Area | Panel/DB | Circuit"    ), ". The app will build the project structure automatically."        )
, React.createElement(LabelInput, { label: "PROJECT NAME" ,   value: importName, onChange: setImportName, placeholder: "e.g. PF Formation"  ,})
, React.createElement(LabelInput, { label: "COMPANY",        value: importCo,   onChange: setImportCo,   placeholder: "Company name" ,})
, React.createElement(LabelInput, { label: "ABN (optional)" , value: importAbn,  onChange: setImportAbn,  placeholder: "XX XXX XXX XXX"   ,})
, React.createElement(LabelInput, { label: "LICENCE (optional)" , value: importLic, onChange: setImportLic, placeholder: "e.g. 319114C" ,})
, React.createElement('input', { ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv", style: {display:"none"}, onChange: handleFile,})
, !importPreview&&React.createElement(React.Fragment, null
, React.createElement('button', { style: {...S.ctaPrimary,width:"100%",marginBottom:8}, onClick: ()=>_optionalChain([fileRef, 'access', _63 => _63.current, 'optionalAccess', _64 => _64.click, 'call', _65 => _65()]),}
, importing?"Parsing…":"📂 Choose Excel / CSV File"
)
, React.createElement('button', { style: {...S.ctaSecondary,width:"100%",fontSize:12}, onClick: downloadTemplate,}, "↓ Download Import Template"   )
, importError&&React.createElement('div', { style: {color:"#f87171",fontSize:12,marginTop:8},}, importError)
)
, importPreview&&React.createElement(React.Fragment, null
, React.createElement('div', { style: {background:"#0e1a0e",border:"1px solid #22c55e44",borderRadius:10,padding:"12px",marginBottom:12},}
, React.createElement('div', { style: {fontSize:12,fontWeight:700,color:"#4ade80",marginBottom:8},}, "✓ Preview — "   , importPreview.areas.length, " areas found"  )
, importPreview.areas.slice(0,5).map(a=>(
React.createElement('div', { key: a.id, style: {fontSize:12,color:"#aaa",marginBottom:3},}
, React.createElement('strong', { style: {color:"#ccc"},}, a.name), " — "  , a.panels.length, " panels, "  , a.panels.reduce((s,p)=>s+p.circuits.length,0), " circuits"
)
))
, importPreview.areas.length>5&&React.createElement('div', { style: {fontSize:11,color:"#666"},}, "…and " , importPreview.areas.length-5, " more areas"  )
)
, React.createElement('div', { style: {display:"flex",gap:8},}
, React.createElement('button', { style: S.ctaPrimary, onClick: confirmImport,}, "✓ Import Project"  )
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setImportPreview(null),}, "Re-upload")
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setShowAdd(false),}, "Cancel")
)
)
)
)
):(
React.createElement('button', { style: {...S.ctaPrimary,width:"100%",marginTop:8}, onClick: ()=>setShowAdd(true),}, "+ Add / Import Project"    )
)
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// PROJECT HOME
// ─────────────────────────────────────────────────────────────────────────
function ProjectHomeView({ project, meta, setMeta, results, onStartPush, onStartInject, onReport, onManage, onHistory, onSettings, onReset, onExportPush, onExportInject, onArchive }) {
const pushSum=summariseProject(results,project,"push");
const injectSum=summariseProject(results,project,"inject");
const pushPct=pushSum.total>0?Math.round(((pushSum.pass+pushSum.na)/pushSum.total)*100):0;
const injectPct=injectSum.total>0?Math.round(((injectSum.pass+injectSum.na)/injectSum.total)*100):0;
const [showExports,setShowExports]=React.useState(false);
const [confirmReset,setConfirmReset]=React.useState(false);
const [archiveMsg,setArchiveMsg]=React.useState("");
const handleArchive=(m)=>{onArchive(m);setArchiveMsg(`${m==="inject"?"Injection":"Push"} test archived!`);setTimeout(()=>setArchiveMsg(""),2500);};
return (
React.createElement('div', { style: S.homeWrap,}
, React.createElement('div', { style: S.brandBlock,}, React.createElement('div', { style: S.brandTitle,}, project.company||"VORICK GROUP"), React.createElement('div', { style: S.brandSub,}, "Asset Maintenance" ))
, React.createElement('div', { style: S.siteTitle,}, project.name)
, React.createElement('div', { style: S.siteSub,}, "RCD Test Management"  )
, React.createElement('div', { style: S.metaCard,}
, React.createElement(LabelInput, { label: "AUDITOR", value: _nullishCoalesce(_optionalChain([meta, 'optionalAccess', _66 => _66.auditor]), () => ("")), onChange: v=>setMeta({auditor:v}), placeholder: "Enter name…" ,})
, React.createElement('div', { style: {display:"flex",gap:10,marginTop:4},}
, React.createElement('div', { style: {flex:1},}, React.createElement('div', { style: S.metaLabelText,}, "PUSH TEST DATE"  ), React.createElement('input', { style: {...S.metaInput,marginTop:4}, type: "date", value: _nullishCoalesce(_optionalChain([meta, 'optionalAccess', _67 => _67.pushDate]), () => ("")), onChange: e=>setMeta({pushDate:e.target.value}),}))
, React.createElement('div', { style: {flex:1},}, React.createElement('div', { style: S.metaLabelText,}, "INJECTION TEST DATE"  ), React.createElement('input', { style: {...S.metaInput,marginTop:4}, type: "date", value: _nullishCoalesce(_optionalChain([meta, 'optionalAccess', _68 => _68.injectDate]), () => ("")), onChange: e=>setMeta({injectDate:e.target.value}),}))
)
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:10,flexWrap:"wrap"},}
, _optionalChain([meta, 'optionalAccess', _69 => _69.pushDate])&&React.createElement('div', { style: {...S.duePill,borderColor:"#e8731a55",color:"#e8731a"},}, "📋 Next push: "   , React.createElement('strong', null, addMonths(meta.pushDate,1)))
, _optionalChain([meta, 'optionalAccess', _70 => _70.injectDate])&&React.createElement('div', { style: {...S.duePill,borderColor:"#3b82f655",color:"#60a5fa"},}, "🔬 Next injection: "   , React.createElement('strong', null, addYears(meta.injectDate,1)))
)
)
, React.createElement('div', { style: S.modeSelectLabel,}, "SELECT TEST TYPE"  )
, React.createElement('div', { style: S.modeBtnRow,}
, React.createElement('button', { style: S.modeBtnPush, onClick: onStartPush,}
, React.createElement('span', { style: S.modeBtnIcon,}, "📋")
, React.createElement('span', { style: S.modeBtnTitle,}, "Monthly", React.createElement('br', null), "Push Test" )
, React.createElement('div', { style: S.modeBtnProgress,}, React.createElement('div', { style: {...S.modeBtnBar,width:`${pushPct}%`,background:"#e8731a"},}))
, React.createElement('span', { style: S.modeBtnPct,}, pushPct, "% · "  , pushSum.fail>0?`${pushSum.fail} FAIL`:"clear")
)
, React.createElement('button', { style: S.modeBtnInject, onClick: onStartInject,}
, React.createElement('span', { style: S.modeBtnIcon,}, "🔬")
, React.createElement('span', { style: S.modeBtnTitle,}, "Annual", React.createElement('br', null), "Injection Test" )
, React.createElement('div', { style: S.modeBtnProgress,}, React.createElement('div', { style: {...S.modeBtnBar,width:`${injectPct}%`,background:"#3b82f6"},}))
, React.createElement('span', { style: S.modeBtnPct,}, injectPct, "% · "  , injectSum.fail>0?`${injectSum.fail} FAIL`:"clear")
)
)
/* Archive buttons */
, React.createElement('div', { style: {width:"100%",maxWidth:500,background:"#161616",border:"1px solid #2a2a2a",borderRadius:12,padding:"10px 14px"},}
, React.createElement('div', { style: {fontSize:10,color:"#555",fontWeight:700,letterSpacing:0.8,marginBottom:8},}, "ARCHIVE COMPLETED AUDIT"  )
, React.createElement('div', { style: {display:"flex",gap:8},}
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#e8731a",borderColor:"#e8731a44",padding:"8px"}, onClick: ()=>handleArchive("push"),}, "📋 Archive Push Test"   )
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",padding:"8px"}, onClick: ()=>handleArchive("inject"),}, "🔬 Archive Injection Test"   )
)
, archiveMsg&&React.createElement('div', { style: {fontSize:12,color:"#4ade80",marginTop:6,textAlign:"center"},}, "✓ " , archiveMsg)
)
, React.createElement('div', { style: {width:"100%",maxWidth:500,display:"flex",gap:8,flexWrap:"wrap"},}
, React.createElement('button', { style: {...S.secondaryBtn,flex:1}, onClick: onReport,}, "≡ Report" )
, React.createElement('button', { style: {...S.secondaryBtn,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"}, onClick: onHistory,}, "🕐 History" )
, React.createElement('button', { style: {...S.secondaryBtn,flex:1,color:"#c084fc",borderColor:"#a855f744"}, onClick: onManage,}, "⚙ Structure" )
, React.createElement('button', { style: {...S.secondaryBtn,flex:1,color:"#64748b",borderColor:"#64748b44"}, onClick: onSettings,}, "▾ Dropdowns" )
, React.createElement('button', { style: {...S.secondaryBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"}, onClick: ()=>setShowExports(x=>!x),}, "↓ Export" )
)
, showExports&&React.createElement('div', { style: {width:"100%",maxWidth:500,display:"flex",gap:8},}
, React.createElement('button', { style: {...S.exportBtn,flex:1,background:"#1a1200",borderColor:"#e8731a55",color:"#e8731a"}, onClick: onExportPush,}, "📋 Push Test xlsx"   )
, React.createElement('button', { style: {...S.exportBtn,flex:1,background:"#0a1628",borderColor:"#3b82f655",color:"#60a5fa"}, onClick: onExportInject,}, "🔬 Injection Test xlsx"   )
)
, confirmReset
?React.createElement('div', { style: S.confirmRow,}, React.createElement('span', { style: {color:"#ef4444",fontSize:13},}, "Reset all results?"  ), React.createElement('button', { style: S.confirmYes, onClick: ()=>{onReset();setConfirmReset(false);},}, "Yes"), React.createElement('button', { style: S.confirmNo, onClick: ()=>setConfirmReset(false),}, "Cancel"))
:React.createElement('button', { style: S.resetBtn, onClick: ()=>setConfirmReset(true),}, "Reset all test results"   )
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// HISTORY VIEW — with read-only circuit viewer
// ─────────────────────────────────────────────────────────────────────────
function HistoryView({ history, project, onDelete, onExportSnap }) {
const [expanded,   setExpanded]  = React.useState(null);
const [deleteId,   setDeleteId]  = React.useState(null);
const [viewSnap,   setViewSnap]  = React.useState(null);  // snap being viewed in full
const [viewArea,   setViewArea]  = React.useState(null);  // area id in snapshot viewer
// ── Snapshot full-screen read-only viewer ──────────────────────────────
if (viewSnap) {
const snap    = viewSnap;
const isInject= snap.mode==="inject";
// area drill-down
if (viewArea) {
const area = _optionalChain([project, 'optionalAccess', _71 => _71.areas, 'access', _72 => _72.find, 'call', _73 => _73(a=>a.id===viewArea)]);
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: {display:"flex",alignItems:"center",gap:12,marginBottom:16},}
, React.createElement('button', { style: {...S.smallBtn,color:"#aaa"}, onClick: ()=>setViewArea(null),}, "‹ Back" )
, React.createElement('div', null
, React.createElement('div', { style: {fontSize:16,fontWeight:800,color:"#eee"},}, _optionalChain([area, 'optionalAccess', _74 => _74.name]))
, React.createElement('div', { style: {fontSize:11,color:"#555"},}, snap.label, " · "  , fmtDate(snap.testDate), " · Read-only"  )
)
)
, _optionalChain([area, 'optionalAccess', _75 => _75.panels, 'access', _76 => _76.map, 'call', _77 => _77(pnl=>(
React.createElement('div', { key: pnl.id, style: {...S.addCard,marginBottom:10},}
, React.createElement('div', { style: {fontSize:14,fontWeight:700,color:"#ccc",marginBottom:10},}, pnl.name, " " , React.createElement('span', { style: {fontSize:11,color:"#555",fontWeight:400},}, "(", pnl.circuits.length, " circuits)" ))
, React.createElement('div', { style: {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8},}
, pnl.circuits.map(c=>{
const d  = _optionalChain([snap, 'access', _78 => _78.results, 'optionalAccess', _79 => _79[area.id], 'optionalAccess', _80 => _80[pnl.id], 'optionalAccess', _81 => _81[c]]);
const st = isInject?(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _82 => _82.inject, 'optionalAccess', _83 => _83.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _84 => _84.push, 'optionalAccess', _85 => _85.status]), () => (STATUS.UNTESTED)));
const sm = SM[st];
const msPos = isInject?(_optionalChain([d, 'optionalAccess', _86 => _86.inject, 'optionalAccess', _87 => _87.resultPos])||""):"";
const msNeg = isInject?(_optionalChain([d, 'optionalAccess', _88 => _88.inject, 'optionalAccess', _89 => _89.resultNeg])||""):"";
const note  = isInject?(_optionalChain([d, 'optionalAccess', _90 => _90.inject, 'optionalAccess', _91 => _91.comment])||""):(_optionalChain([d, 'optionalAccess', _92 => _92.push, 'optionalAccess', _93 => _93.comment])||"");
const pri   = isInject?(_optionalChain([d, 'optionalAccess', _94 => _94.inject, 'optionalAccess', _95 => _95.priority])||""):"";
const priColor = pri==="U"?"#9B0000":pri==="H"?"#ef4444":pri==="M"?"#f59e0b":pri==="L"?"#4ade80":"";
return (
React.createElement('div', { key: c, style: {background:sm.bg,border:`2px solid ${sm.border}`,borderRadius:10,padding:"10px 6px",textAlign:"center",position:"relative"},}
, React.createElement('div', { style: {fontSize:12,fontWeight:800,color:sm.fg},}, c)
, React.createElement('div', { style: {fontSize:10,fontWeight:700,color:sm.fg,marginTop:4},}, sm.label)
, isInject&&msPos&&React.createElement('div', { style: {fontSize:9,color:"#aaa",marginTop:3},}, msPos, " / "  , msNeg)
, priColor&&React.createElement('div', { style: {fontSize:9,fontWeight:800,color:priColor,marginTop:2},}, pri)
, note&&React.createElement('div', { style: {fontSize:9,color:"#e8731a",marginTop:2},}, "✎")
)
);
})
)
/* Show notes for any failed circuits */
, pnl.circuits.filter(c=>{
const d=_optionalChain([snap, 'access', _96 => _96.results, 'optionalAccess', _97 => _97[area.id], 'optionalAccess', _98 => _98[pnl.id], 'optionalAccess', _99 => _99[c]]);
const st=isInject?(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _100 => _100.inject, 'optionalAccess', _101 => _101.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _102 => _102.push, 'optionalAccess', _103 => _103.status]), () => (STATUS.UNTESTED)));
return st===STATUS.FAIL;
}).map(c=>{
const d=_optionalChain([snap, 'access', _104 => _104.results, 'optionalAccess', _105 => _105[area.id], 'optionalAccess', _106 => _106[pnl.id], 'optionalAccess', _107 => _107[c]]);
const note=isInject?(_optionalChain([d, 'optionalAccess', _108 => _108.inject, 'optionalAccess', _109 => _109.comment])||""):(_optionalChain([d, 'optionalAccess', _110 => _110.push, 'optionalAccess', _111 => _111.comment])||"");
const pri=isInject?(_optionalChain([d, 'optionalAccess', _112 => _112.inject, 'optionalAccess', _113 => _113.priority])||""):"";
const rect=isInject?(_optionalChain([d, 'optionalAccess', _114 => _114.inject, 'optionalAccess', _115 => _115.rectified])||""):"";
if(!note&&!pri&&!rect) return null;
return (
React.createElement('div', { key: c, style: {marginTop:8,background:"#1e1010",border:"1px solid #ef444433",borderRadius:6,padding:"8px 10px",fontSize:12},}
, React.createElement('span', { style: {fontWeight:700,color:"#f87171"},}, c)
, pri&&React.createElement('span', { style: {marginLeft:8,fontSize:11,fontWeight:700,color:pri==="U"?"#9B0000":pri==="H"?"#ef4444":pri==="M"?"#f59e0b":"#4ade80"},}, "[", pri, "]")
, rect&&React.createElement('div', { style: {color:"#aaa",marginTop:2},}, rect)
, note&&React.createElement('div', { style: {color:"#888",marginTop:2},}, note)
)
);
})
)
))])
)
);
}
// Area list for snapshot
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: {display:"flex",alignItems:"center",gap:12,marginBottom:6},}
, React.createElement('button', { style: {...S.smallBtn,color:"#aaa"}, onClick: ()=>setViewSnap(null),}, "‹ Back" )
, React.createElement('div', null
, React.createElement('div', { style: {fontSize:16,fontWeight:800,color:"#eee"},}, snap.label)
, React.createElement('div', { style: {fontSize:11,color:"#555"},}, fmtDate(snap.testDate), " · "  , snap.auditor||"No auditor", " · Read-only"  )
)
)
/* Summary pills */
, project&&(()=>{
let pass=0,fail=0,na=0,total=0;
project.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{
total++;
const d=_optionalChain([snap, 'access', _116 => _116.results, 'optionalAccess', _117 => _117[a.id], 'optionalAccess', _118 => _118[p.id], 'optionalAccess', _119 => _119[c]]);
const st=snap.mode==="inject"?(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _120 => _120.inject, 'optionalAccess', _121 => _121.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _122 => _122.push, 'optionalAccess', _123 => _123.status]), () => (STATUS.UNTESTED)));
if(st===STATUS.PASS)pass++;else if(st===STATUS.FAIL)fail++;else if(st===STATUS.NA)na++;
})));
return (
React.createElement('div', { style: {display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"},}
, [["Pass",pass,"#22c55e"],["Fail",fail,"#ef4444"],["N/A",na,"#64748b"],["Untested",total-pass-fail-na,"#f59e0b"]].map(([l,v,c])=>(
React.createElement('div', { key: l, style: {background:"#1a1a1a",border:`1px solid ${c}33`,borderRadius:8,padding:"6px 12px",textAlign:"center"},}
, React.createElement('div', { style: {fontSize:18,fontWeight:800,color:c},}, v)
, React.createElement('div', { style: {fontSize:10,color:"#666"},}, l)
)
))
)
);
})()
, React.createElement('div', { style: {fontSize:11,color:"#555",marginBottom:12},}, "Tap an area to view circuit results"      )
, _optionalChain([project, 'optionalAccess', _124 => _124.areas, 'access', _125 => _125.map, 'call', _126 => _126(area=>{
let pass=0,fail=0,total=0;
area.panels.forEach(p=>p.circuits.forEach(c=>{
total++;
const d=_optionalChain([snap, 'access', _127 => _127.results, 'optionalAccess', _128 => _128[area.id], 'optionalAccess', _129 => _129[p.id], 'optionalAccess', _130 => _130[c]]);
const st=snap.mode==="inject"?(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _131 => _131.inject, 'optionalAccess', _132 => _132.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _133 => _133.push, 'optionalAccess', _134 => _134.status]), () => (STATUS.UNTESTED)));
if(st===STATUS.PASS||st===STATUS.NA)pass++;else if(st===STATUS.FAIL)fail++;
}));
return (
React.createElement('button', { key: area.id, style: {...S.siteCard,...(fail>0?S.siteCardFail:{})}, onClick: ()=>setViewArea(area.id),}
, React.createElement('div', { style: S.siteCardLeft,}
, React.createElement('div', { style: S.siteCardName,}, area.name)
, React.createElement('div', { style: S.siteCardSub,}, total, " circuits" )
, React.createElement('div', { style: {...S.siteCardBar,marginTop:8},}
, React.createElement('div', { style: {...S.siteCardBarFill,width:`${total>0?Math.round((pass/total)*100):0}%`,background:fail>0?"#ef4444":"#22c55e"},})
)
)
, React.createElement('div', { style: S.siteCardRight,}
, fail>0&&React.createElement('span', { style: S.failBadge,}, fail, " FAIL" )
, React.createElement('span', { style: S.arrow,}, "›")
)
)
);
})])
)
);
}
// ── Main history list ──────────────────────────────────────────────────
if(history.length===0) return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: S.listTitle,}, "Audit History" )
, React.createElement('div', { style: {color:"#555",fontSize:14},}, "No archived audits yet. After completing a test, tap \"Archive\" on the project home screen to save a snapshot here."                   )
)
);
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: S.listTitle,}, "Audit History" )
, React.createElement('div', { style: {fontSize:12,color:"#555",marginBottom:16},}, history.length, " saved audit"  , history.length!==1?"s":"")
, history.map(snap=>{
let total=0,pass=0,fail=0,na=0;
if(project){
project.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{
total++;
const d=_optionalChain([snap, 'access', _135 => _135.results, 'optionalAccess', _136 => _136[a.id], 'optionalAccess', _137 => _137[p.id], 'optionalAccess', _138 => _138[c]]);
const st=snap.mode==="inject"?(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _139 => _139.inject, 'optionalAccess', _140 => _140.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'optionalAccess', _141 => _141.push, 'optionalAccess', _142 => _142.status]), () => (STATUS.UNTESTED)));
if(st===STATUS.PASS)pass++;else if(st===STATUS.FAIL)fail++;else if(st===STATUS.NA)na++;
})));
}
const hasFail=fail>0;
return (
React.createElement('div', { key: snap.id, style: {...S.siteCard,flexDirection:"column",padding:0,marginBottom:10,overflow:"hidden"},}
, React.createElement('button', { style: {display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"14px 16px",color:"inherit",textAlign:"left"},
onClick: ()=>setExpanded(expanded===snap.id?null:snap.id),}
, React.createElement('div', { style: {flex:1},}
, React.createElement('div', { style: {display:"flex",alignItems:"center",gap:8,marginBottom:4},}
, React.createElement('span', { style: {fontSize:13,fontWeight:800,color:"#eee"},}, snap.label)
, React.createElement('span', { style: {fontSize:11,padding:"2px 8px",borderRadius:5,background:snap.mode==="inject"?"#0a1628":"#1a1200",color:snap.mode==="inject"?"#60a5fa":"#e8731a",border:`1px solid ${snap.mode==="inject"?"#3b82f644":"#e8731a44"}`},}
, snap.mode==="inject"?"🔬 Annual":"📋 Monthly"
)
, hasFail&&React.createElement('span', { style: S.failBadge,}, fail, " FAIL" )
)
, React.createElement('div', { style: {fontSize:12,color:"#888"},}, fmtDate(snap.testDate), " · "  , snap.auditor||"No auditor")
, React.createElement('div', { style: {fontSize:11,color:"#555",marginTop:2},}, "Archived " , fmtDateTime(snap.archivedAt))
, total>0&&React.createElement('div', { style: {display:"flex",gap:8,marginTop:6},}
, React.createElement('span', { style: {fontSize:11,color:"#22c55e"},}, pass, " Pass" )
, React.createElement('span', { style: {fontSize:11,color:"#ef4444"},}, fail, " Fail" )
, React.createElement('span', { style: {fontSize:11,color:"#64748b"},}, na, " N/A" )
, React.createElement('span', { style: {fontSize:11,color:"#f59e0b"},}, total-pass-fail-na, " Untested" )
)
)
, React.createElement('span', { style: {...S.arrow,color:expanded===snap.id?"#e8731a":"#555"},}, expanded===snap.id?"▾":"›")
)
, expanded===snap.id&&(
React.createElement('div', { style: {padding:"0 16px 14px",borderTop:"1px solid #2a2a2a"},}
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:10},}
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",fontWeight:700}, onClick: ()=>{ setViewSnap(snap); setViewArea(null); },}, "👁 View Results"
)
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"}, onClick: ()=>onExportSnap(snap),}, "↓ Export" )
, deleteId===snap.id
?React.createElement(React.Fragment, null, React.createElement('button', { style: {...S.smallBtn,color:"#f87171",borderColor:"#ef444455"}, onClick: ()=>{onDelete(snap.id);setDeleteId(null);},}, "Confirm"), React.createElement('button', { style: S.smallBtn, onClick: ()=>setDeleteId(null),}, "Cancel"))
:React.createElement('button', { style: {...S.smallBtn,color:"#ef4444",borderColor:"#ef444433"}, onClick: ()=>setDeleteId(snap.id),}, "🗑")
)
)
)
)
);
})
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW — logo + all dropdown lists
// ─────────────────────────────────────────────────────────────────────────
function SettingsView({ dropdowns, setDropdowns, logo, setLogo }) {
const [newVals, setNewVals] = React.useState({});
const logoRef = React.useRef();
const handleLogoUpload = e => {
const file = e.target.files[0]; if(!file) return;
const reader = new FileReader();
reader.onload = ev => setLogo(ev.target.result);
reader.readAsDataURL(file);
e.target.value = "";
};
const addItem = (key,val) => {
if(!val.trim()) return;
setDropdowns(d => ({...d,[key]:[...((_nullishCoalesce(d[key], () => ([]))).filter(x=>x!==val.trim())),val.trim()]}));
setNewVals(v => ({...v,[key]:""}));
};
const removeItem = (key,val) => setDropdowns(d => ({...d,[key]:(_nullishCoalesce(d[key], () => ([]))).filter(x=>x!==val)}));
const resetKey   = (key, def) => setDropdowns(d => ({...d,[key]:def}));
const LISTS = [
{ key:"cbType",         label:"CB / RCD TYPE",        defaults:DEFAULT_CB_TYPE,        color:"#60a5fa", desc:"Available in both monthly push test and annual injection test forms" },
{ key:"ampRating",      label:"AMP RATING",           defaults:DEFAULT_AMP_RATING,     color:"#4ade80", desc:"Available in both monthly push test and annual injection test forms" },
{ key:"responsibility", label:"RESPONSIBILITY",        defaults:DEFAULT_RESPONSIBILITY, color:"#c084fc", desc:"Used in annual injection test form" },
{ key:"rectified",      label:"RECTIFIED / SCHEDULED",defaults:DEFAULT_RECTIFIED,      color:"#f59e0b", desc:"Used in annual injection test form" },
];
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: {...S.listTitle,color:"#64748b"},}, "⚙ Settings" )
/* Logo */
, React.createElement('div', { style: {...S.addCard,marginBottom:20,borderColor:"#e8731a33"},}
, React.createElement('div', { style: {fontSize:13,fontWeight:700,color:"#e8731a",marginBottom:8},}, "Company Logo — Excel Reports"    )
, React.createElement('div', { style: {fontSize:12,color:"#666",marginBottom:10},}, "Upload your logo (PNG/JPG) to appear in exported reports."        )
, logo?(
React.createElement('div', { style: {display:"flex",alignItems:"center",gap:12,marginBottom:10},}
, React.createElement('img', { src: logo, alt: "Logo", style: {maxHeight:56,maxWidth:140,objectFit:"contain",background:"#fff",borderRadius:6,padding:4},})
, React.createElement('div', null
, React.createElement('div', { style: {fontSize:12,color:"#4ade80",marginBottom:6},}, "✓ Logo uploaded"  )
, React.createElement('button', { style: {...S.smallBtn,color:"#ef4444",borderColor:"#ef444433",fontSize:11}, onClick: ()=>setLogo(null),}, "Remove")
)
)
):(
React.createElement('div', { style: {fontSize:12,color:"#555",marginBottom:8},}, "No logo — reports will use company name as text."         )
)
, React.createElement('input', { ref: logoRef, type: "file", accept: "image/*", style: {display:"none"}, onChange: handleLogoUpload,})
, React.createElement('button', { style: {...S.ctaPrimary,fontSize:13,padding:"9px 16px"}, onClick: ()=>_optionalChain([logoRef, 'access', _143 => _143.current, 'optionalAccess', _144 => _144.click, 'call', _145 => _145()]),}
, logo?"🔄 Replace Logo":"📷 Upload Logo"
)
/* Priority colour legend */
, React.createElement('div', { style: {marginTop:14,paddingTop:12,borderTop:"1px solid #2a2a2a"},}
, React.createElement('div', { style: {fontSize:10,fontWeight:700,color:"#555",letterSpacing:0.8,marginBottom:8},}, "PRIORITY COLOUR CODING (Excel export — matches defects register)"        )
, React.createElement('div', { style: {display:"flex",gap:6,flexWrap:"wrap"},}
, [["U – Urgent","#9B0000","#fff"],["H – High","#FFC7CE","#9C0006"],["M – Medium","#FFD966","#7F6000"],["L – Low","#E2EFDA","#375623"]].map(([lbl,bg,fg])=>(
React.createElement('div', { key: lbl, style: {background:bg,color:fg,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700,border:"1px solid rgba(0,0,0,0.15)"},}, lbl)
))
, React.createElement('div', { style: {background:"#fff",color:"#444",borderRadius:5,padding:"3px 10px",fontSize:11,border:"1px solid #ccc"},}, "Pass — white"  )
)
)
)
/* Dropdown lists */
, React.createElement('div', { style: {fontSize:12,color:"#666",marginBottom:16},}, "These lists appear as dropdown menus in the test forms. First item in each list is the default."                 )
, LISTS.map(({key,label,defaults,color,desc})=>{
const items = _nullishCoalesce(_optionalChain([dropdowns, 'optionalAccess', _146 => _146[key]]), () => ( defaults));
const newVal = newVals[key] || "";
return (
React.createElement('div', { key: key, style: {...S.addCard,marginBottom:14,borderColor:`${color}22`},}
, React.createElement('div', { style: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6},}
, React.createElement('div', null
, React.createElement('div', { style: {fontSize:13,fontWeight:700,color},}, label)
, React.createElement('div', { style: {fontSize:11,color:"#555",marginTop:2},}, desc)
)
, React.createElement('button', { style: {...S.smallBtn,fontSize:10,color:"#555",borderColor:"#333",flexShrink:0}, onClick: ()=>resetKey(key,defaults),}, "Reset")
)
, React.createElement('div', { style: {display:"flex",flexDirection:"column",gap:5,marginBottom:10,maxHeight:200,overflowY:"auto"},}
, items.map((item,i)=>(
React.createElement('div', { key: i, style: {display:"flex",alignItems:"center",gap:8,background:"#111",border:"1px solid #1e1e1e",borderRadius:7,padding:"7px 10px"},}
, i===0&&React.createElement('span', { style: {fontSize:9,color,fontWeight:700,letterSpacing:0.5,flexShrink:0},}, "DEFAULT")
, React.createElement('span', { style: {flex:1,fontSize:12,color:"#ccc"},}, item)
, React.createElement('button', { style: {background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13,lineHeight:1,padding:"0 0 0 6px"}, onClick: ()=>removeItem(key,item),}, "✕")
)
))
, items.length===0&&React.createElement('div', { style: {fontSize:12,color:"#444",padding:"6px 0"},}, "No options — add one below"     )
)
, React.createElement('div', { style: {display:"flex",gap:8},}
, React.createElement('input', { style: {...S.smallInput,flex:1}, placeholder: `Add new ${label.toLowerCase()} option…`,
value: newVal,
onChange: e=>setNewVals(v=>({...v,[key]:e.target.value})),
onKeyDown: e=>{ if(e.key==="Enter"){ addItem(key,newVal); } },})
, React.createElement('button', { style: {...S.smallBtn,color,borderColor:`${color}55`,fontWeight:700}, onClick: ()=>addItem(key,newVal),}, "+ Add" )
)
)
);
})
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────
function DetailModal({ areaId, panelId, circuit, project, mode, results, meta, dropdowns, onPatch, onClose }) {
const area  = project.areas.find(a=>a.id===areaId);
const panel = _optionalChain([area, 'optionalAccess', _147 => _147.panels, 'access', _148 => _148.find, 'call', _149 => _149(p=>p.id===panelId)]);
const d     = getCircuitData(results, project.id, areaId, panelId, circuit);
const isPush = mode==="push";
const ampOptions  = _nullishCoalesce(_optionalChain([dropdowns, 'optionalAccess', _150 => _150.ampRating]), () => ( DEFAULT_AMP_RATING));
const cbOptions   = _nullishCoalesce(_optionalChain([dropdowns, 'optionalAccess', _151 => _151.cbType]), () => ( DEFAULT_CB_TYPE));
const respOptions = _nullishCoalesce(_optionalChain([dropdowns, 'optionalAccess', _152 => _152.responsibility]), () => ( DEFAULT_RESPONSIBILITY));
const rectOptions = _nullishCoalesce(_optionalChain([dropdowns, 'optionalAccess', _153 => _153.rectified]), () => ( DEFAULT_RECTIFIED));
if(isPush){
const push=_nullishCoalesce(d.push, () => ({}));
return (
React.createElement('div', { style: S.modalOverlay, onClick: onClose,}
, React.createElement('div', { style: S.modalBox, onClick: e=>e.stopPropagation(),}
, React.createElement('div', { style: S.modalHeader,}
, React.createElement('div', null, React.createElement('div', { style: S.modalTitle,}, _optionalChain([panel, 'optionalAccess', _154 => _154.name]), " · "  , circuit), React.createElement('div', { style: S.modalSub,}, _optionalChain([area, 'optionalAccess', _155 => _155.name]), " · Monthly Push Test"    ))
, React.createElement(StatusBadge, { status: _nullishCoalesce(push.status, () => (STATUS.UNTESTED)),})
)
/* CB Type + Amp Rating */
, React.createElement('div', { style: {display:"flex",gap:10},}
, React.createElement('div', { style: {...S.modalField,flex:2},}
, React.createElement('label', { style: S.modalLabel,}, "CB / RCD TYPE"   )
, React.createElement(EditableDropdown, { options: cbOptions, value: _nullishCoalesce(push.cbType, () => ((cbOptions[0]||""))), onChange: v=>onPatch({push:{...push,cbType:v}}), placeholder: "Select type…" ,})
)
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "AMP RATING" )
, React.createElement(EditableDropdown, { options: ampOptions, value: push.ampRating||"", onChange: v=>onPatch({push:{...push,ampRating:v}}), placeholder: "Select…",})
)
)
/* Pass/Fail buttons */
, React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "RESULT")
, React.createElement('div', { style: {display:"flex",gap:8},}
, [STATUS.PASS,STATUS.FAIL,STATUS.NA,STATUS.UNTESTED].map(s=>{
const sm=SM[s]; const active=(_nullishCoalesce(push.status, () => (STATUS.UNTESTED)))===s;
return React.createElement('button', { key: s, onClick: ()=>onPatch({push:{...push,status:s}}),
style: {flex:1,padding:"12px 4px",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",border:`2px solid ${active?sm.border:"#333"}`,background:active?sm.bg:"#1a1a1a",color:active?sm.fg:"#555",boxShadow:active?`0 0 8px ${sm.border}66`:"none"},}, sm.label);
})
)
)
, React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "NOTES / COMMENTS"  )
, React.createElement('textarea', { style: {...S.modalInput,minHeight:80,resize:"vertical"}, placeholder: "Defect details, rectification notes…"   , value: _nullishCoalesce(push.comment, () => ("")), onChange: e=>onPatch({push:{...push,comment:e.target.value}}),})
)
, React.createElement('button', { style: {...S.modalClose,background:"#e8731a",color:"#fff"}, onClick: onClose,}, "Done")
)
)
);
}
const inj=_nullishCoalesce(d.inject, () => ({}));
const isOver = msIsOver(inj.resultPos) || msIsOver(inj.resultNeg);
return (
React.createElement('div', { style: S.modalOverlay, onClick: onClose,}
, React.createElement('div', { style: S.modalBox, onClick: e=>e.stopPropagation(),}
, React.createElement('div', { style: S.modalHeader,}
, React.createElement('div', null, React.createElement('div', { style: S.modalTitle,}, _optionalChain([panel, 'optionalAccess', _156 => _156.name]), " · "  , circuit), React.createElement('div', { style: S.modalSub,}, _optionalChain([area, 'optionalAccess', _157 => _157.name]), " · Annual Injection Test"    ))
, React.createElement(StatusBadge, { status: _nullishCoalesce(inj.status, () => (STATUS.UNTESTED)),})
)
/* CB Type + Amp Rating */
, React.createElement('div', { style: {display:"flex",gap:10},}
, React.createElement('div', { style: {...S.modalField,flex:2},}
, React.createElement('label', { style: S.modalLabel,}, "CB / RCD TYPE"   )
, React.createElement(EditableDropdown, { options: cbOptions, value: _nullishCoalesce(inj.cbType, () => ((cbOptions[0]||""))), onChange: v=>onPatch({inject:{...inj,cbType:v}}), placeholder: "Select type…" ,})
)
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "AMP RATING" )
, React.createElement(EditableDropdown, { options: ampOptions, value: inj.ampRating||"", onChange: v=>onPatch({inject:{...inj,ampRating:v}}), placeholder: "Select…",})
)
)
/* ms values */
, React.createElement('div', { style: {display:"flex",gap:10},}
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "INJECTION TEST + (ms)"   )
, React.createElement('input', { style: S.modalInput, type: "text", placeholder: "e.g. 23.1 or >300ms"   , value: _nullishCoalesce(inj.resultPos, () => ("")), onChange: e=>{
const v=e.target.value;
onPatch({inject:{...inj,resultPos:v,...(msIsOver(v)?{status:STATUS.FAIL}:{})}});
},})
)
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "INJECTION TEST − (ms)"   )
, React.createElement('input', { style: S.modalInput, type: "text", placeholder: "e.g. -13.2 or >300ms"   , value: _nullishCoalesce(inj.resultNeg, () => ("")), onChange: e=>{
const v=e.target.value;
onPatch({inject:{...inj,resultNeg:v,...(msIsOver(v)?{status:STATUS.FAIL}:{})}});
},})
)
)
/* Only show result banner when BOTH values are entered */
, (inj.resultPos&&inj.resultNeg)&&(()=>{
const failed = msIsOver(inj.resultPos) || msIsOver(inj.resultNeg);
return (React.createElement('div', { style: {...S.injectResult,background:failed?"#3d1a1a":"#1a3d1a",borderColor:failed?"#ef4444":"#22c55e"},}
, React.createElement('span', { style: {fontWeight:800,color:failed?"#f87171":"#4ade80"},}, failed?"⚠ FAIL — device must be removed from service":"✓ PASS")
));
})()
/* Pass/Fail */
, React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "PASS / FAIL"  )
, React.createElement('div', { style: {display:"flex",gap:8},}
, [STATUS.PASS,STATUS.FAIL,STATUS.NA,STATUS.UNTESTED].map(s=>{
const sm=SM[s];const active=(_nullishCoalesce(inj.status, () => (STATUS.UNTESTED)))===s;
return React.createElement('button', { key: s, onClick: ()=>onPatch({inject:{...inj,status:s}}), style: {flex:1,padding:"10px 4px",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",border:`2px solid ${active?sm.border:"#333"}`,background:active?sm.bg:"#1a1a1a",color:active?sm.fg:"#555",boxShadow:active?`0 0 8px ${sm.border}66`:"none"},}, sm.label);
})
)
)
/* Rectified — only show on fail */
, (inj.status===STATUS.FAIL)&&(
React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "RECTIFIED / SCHEDULED"  )
, React.createElement(EditableDropdown, {
options: rectOptions,
value: _nullishCoalesce(inj.rectified, () => ("")),
onChange: v=>onPatch({inject:{...inj,rectified:v}}),
placeholder: "Select or type…"  ,})
)
)
, (inj.status===STATUS.FAIL)&&(
React.createElement('div', { style: {display:"flex",gap:10},}
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "DATE RECTIFIED" )
, React.createElement('input', { style: S.modalInput, type: "date", value: _nullishCoalesce(inj.scheduledDate, () => ("")), onChange: e=>onPatch({inject:{...inj,scheduledDate:e.target.value}}),})
)
, React.createElement('div', { style: {...S.modalField,flex:1},}
, React.createElement('label', { style: S.modalLabel,}, "DEFECT ID" )
, React.createElement('input', { style: S.modalInput, type: "text", placeholder: "e.g. 74" , value: _nullishCoalesce(inj.defectId, () => ("")), onChange: e=>onPatch({inject:{...inj,defectId:e.target.value}}),})
)
)
)
/* Responsibility — DROPDOWN */
, React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "RESPONSIBILITY")
, React.createElement(EditableDropdown, {
options: respOptions,
value: _nullishCoalesce(inj.responsibility, () => ((respOptions[0]||"Vorick Group"))),
onChange: v=>onPatch({inject:{...inj,responsibility:v}}),
placeholder: "Select or type…"  ,})
)
/* Priority — only on fail */
, (inj.status===STATUS.FAIL)&&(
React.createElement('div', { style: {display:"flex",gap:10},}
, React.createElement('div', { style: {...S.modalField,flex:3},}
, React.createElement('label', { style: S.modalLabel,}, "PRIORITY")
, React.createElement('select', { style: S.modalInput, value: _nullishCoalesce(inj.priority, () => ("")), onChange: e=>onPatch({inject:{...inj,priority:e.target.value}}),}
, React.createElement('option', { value: "",}, "— Select" ), React.createElement('option', { value: "L",}, "L – Low"  ), React.createElement('option', { value: "M",}, "M – Medium"  ), React.createElement('option', { value: "H",}, "H – High"  ), React.createElement('option', { value: "U",}, "U – Urgent"  )
)
)
)
)
, React.createElement('div', { style: S.modalField,}
, React.createElement('label', { style: S.modalLabel,}, "NOTES / RECOMMENDATIONS"  )
, React.createElement('textarea', { style: {...S.modalInput,minHeight:80,resize:"vertical"}, placeholder: "Defect details, action required…"   , value: _nullishCoalesce(inj.comment, () => ("")), onChange: e=>onPatch({inject:{...inj,comment:e.target.value}}),})
)
, _optionalChain([meta, 'optionalAccess', _158 => _158.injectDate])&&React.createElement('div', { style: S.nextBanner,}
, React.createElement('span', { style: {color:"#888",fontSize:11},}, "NEXT INJECTION TEST DUE:"   )
, React.createElement('span', { style: {color:"#60a5fa",fontWeight:800,fontSize:13,marginLeft:8},}, addYears(meta.injectDate,1))
)
, React.createElement('button', { style: {...S.modalClose,background:"#1e3a5f",color:"#60a5fa"}, onClick: onClose,}, "Done")
)
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// EDITABLE DROPDOWN — shows list of options + free-type fallback
// ─────────────────────────────────────────────────────────────────────────
function EditableDropdown({ options, value, onChange, placeholder }) {
const [open, setOpen] = React.useState(false);
const [custom, setCustom] = React.useState(false);
const [typedVal, setTypedVal] = React.useState(value||"");
const isCustom = value && !options.includes(value);
React.useEffect(()=>{ if(isCustom){setCustom(true);setTypedVal(value);} },[]);
if(custom){
return (
React.createElement('div', { style: {display:"flex",gap:8},}
, React.createElement('input', { style: {...S.modalInput,flex:1}, value: typedVal, placeholder: placeholder, onChange: e=>{setTypedVal(e.target.value);onChange(e.target.value);},})
, React.createElement('button', { style: {...S.smallBtn,color:"#aaa",borderColor:"#333",flexShrink:0}, onClick: ()=>{setCustom(false);setTypedVal("");},}, "▾ List" )
)
);
}
return (
React.createElement('div', { style: {position:"relative"},}
, React.createElement('button', { style: {...S.modalInput,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left"}, onClick: ()=>setOpen(x=>!x),}
, React.createElement('span', { style: {color:value?"#eee":"#555"},}, value||placeholder||"Select…")
, React.createElement('span', { style: {color:"#666",fontSize:12},}, "▾")
)
, open&&(
React.createElement('div', { style: {position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#1e1e1e",border:"1px solid #333",borderRadius:10,zIndex:300,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.6)"},}
, options.map((opt,i)=>(
React.createElement('button', { key: i, style: {display:"block",width:"100%",textAlign:"left",padding:"11px 14px",background:value===opt?"#2a2a1a":"transparent",color:value===opt?"#e8731a":"#ccc",border:"none",borderBottom:"1px solid #2a2a2a",cursor:"pointer",fontSize:13,fontWeight:value===opt?700:400},
onClick: ()=>{onChange(opt);setOpen(false);},}
, i===0&&React.createElement('span', { style: {fontSize:9,color:"#e8731a",fontWeight:700,marginRight:6},}, "DEFAULT"), opt
)
))
, React.createElement('button', { style: {display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"transparent",color:"#64748b",border:"none",borderTop:"1px solid #333",cursor:"pointer",fontSize:12}, onClick: ()=>{setOpen(false);setCustom(true);},}, "✏️ Type custom value…"
)
)
)
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// MANAGE VIEW
// ─────────────────────────────────────────────────────────────────────────
function ManageView({ project, onUpdateProject }) {
const [expandedArea,setExpandedArea]=React.useState(null);
const [expandedPanel,setExpandedPanel]=React.useState(null);
const [newAreaName,setNewAreaName]=React.useState("");
const [newPanelName,setNewPanelName]=React.useState({});
const [newCircuit,setNewCircuit]=React.useState({});
const [bulkCircuit,setBulkCircuit]=React.useState({});
const [editingProject,setEditingProject]=React.useState(false);
const [projName,setProjName]=React.useState(project.name);
const [projCo,setProjCo]=React.useState(project.company||"");
const [projAbn,setProjAbn]=React.useState(project.abn||"");
const [projLic,setProjLic]=React.useState(project.licence||"");
const upd=u=>onUpdateProject(u);
const addArea=()=>{if(!newAreaName.trim())return;upd({...project,areas:[...project.areas,{id:slugify(newAreaName),name:newAreaName.trim(),panels:[]}]});setNewAreaName("");};
const delArea=id=>upd({...project,areas:project.areas.filter(a=>a.id!==id)});
const addPanel=(aid)=>{const n=(newPanelName[aid]||"").trim();if(!n)return;upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:[...a.panels,{id:slugify(n),name:n,circuits:[]}]}:a)});setNewPanelName(x=>({...x,[aid]:""}));};
const delPanel=(aid,pid)=>upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.filter(p=>p.id!==pid)}:a)});
const addCircuit=(aid,pid)=>{const n=(newCircuit[pid]||"").trim();if(!n)return;upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:[...p.circuits,n]}:p)}:a)});setNewCircuit(x=>({...x,[pid]:""}));};
const addBulk=(aid,pid)=>{const raw=(bulkCircuit[pid]||"").trim();if(!raw)return;const items=raw.split(",").map(s=>s.trim()).filter(Boolean);upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:[...p.circuits,...items.filter(c=>!p.circuits.includes(c))]}:p)}:a)});setBulkCircuit(x=>({...x,[pid]:""}));};
const delCircuit=(aid,pid,c)=>upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:p.circuits.filter(x=>x!==c)}:p)}:a)});
const saveProj=()=>{upd({...project,name:projName.trim()||project.name,company:projCo.trim(),abn:projAbn.trim(),licence:projLic.trim()});setEditingProject(false);};
// ── Consolidate panels with shared prefix ────────────────────────────
// Re-runs the same prefix-merging logic used during import, so projects
// imported before the fix can be repaired without re-importing.
const consolidatePanels = () => {
const newAreas = project.areas.map(area => {
const allRaws = [];
area.panels.forEach(panel => {
panel.circuits.forEach(circuit => {
if (circuit.toUpperCase() === panel.name.toUpperCase()) {
allRaws.push({ raw: panel.name, isOldFormat: true });
} else {
allRaws.push({ raw: panel.name + " " + circuit, isOldFormat: false, panel: panel.name, circuit });
}
});
});
const rawStrings = allRaws.map(r => r.raw);
let resolved = allRaws.map(({ raw, isOldFormat, panel, circuit }) => {
if (!isOldFormat) return { panel: panel.toUpperCase(), circuit };
const split = parsePanelCircuit(raw);
if (split) return split;
const prefix = findSharedPrefix(raw, rawStrings);
const circ   = raw.slice(prefix.length).replace(/^[\s\-\u2013_]+/, "").trim() || raw;
return { panel: prefix, circuit: circ };
});
resolved = collapsePanelNames(resolved);
const merged = {};
resolved.forEach(({ panel, circuit }) => {
if (!merged[panel]) merged[panel] = new Set();
merged[panel].add(circuit);
});
return {
...area,
panels: Object.entries(merged).map(([name, circs]) => ({ id: slugify(name), name, circuits: [...circs] })),
};
});
upd({ ...project, areas: newAreas });
setConsolidateMsg("Done! Panels consolidated.");
setTimeout(() => setConsolidateMsg(""), 3000);
};
const [consolidateMsg, setConsolidateMsg] = React.useState("");
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: {...S.listTitle,color:"#c084fc"},}, "⚙ Manage: "  , project.name)
/* Consolidate banner — prominent for imported projects */
, React.createElement('div', { style: {...S.addCard,borderColor:"#e8731a44",marginBottom:16,background:"#1a1200"},}
, React.createElement('div', { style: {fontSize:13,fontWeight:700,color:"#e8731a",marginBottom:6},}, "Fix Panel Structure (Import Fix)"    )
, React.createElement('div', { style: {fontSize:12,color:"#888",marginBottom:10},}, "If panels like \"MSB1 SPD RIGHT SECTION\" and \"MSB1-DB CB 9\" appear as separate folders instead of being grouped under \"MSB1\", tap below to consolidate them automatically."
)
, React.createElement('button', { style: {...S.ctaPrimary,fontSize:13,padding:"10px 16px",background:"#e8731a"}, onClick: consolidatePanels,}, "⟳ Consolidate Panels by Prefix"
)
, consolidateMsg&&React.createElement('div', { style: {fontSize:12,color:"#4ade80",marginTop:8},}, "✓ " , consolidateMsg)
)
, React.createElement('div', { style: {...S.addCard,borderColor:"#a855f733",marginBottom:16},}
, React.createElement('div', { style: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:editingProject?12:0},}
, React.createElement('span', { style: {fontSize:13,fontWeight:700,color:"#c084fc"},}, "Project Details" )
, !editingProject&&React.createElement('button', { style: {...S.smallBtn,color:"#c084fc",borderColor:"#a855f744"}, onClick: ()=>setEditingProject(true),}, "Edit")
)
, editingProject?React.createElement(React.Fragment, null
, React.createElement(LabelInput, { label: "PROJECT NAME" , value: projName, onChange: setProjName, placeholder: "Project name" ,})
, React.createElement(LabelInput, { label: "COMPANY",      value: projCo,   onChange: setProjCo,   placeholder: "Company",})
, React.createElement(LabelInput, { label: "ABN",          value: projAbn,  onChange: setProjAbn,  placeholder: "ABN",})
, React.createElement(LabelInput, { label: "LICENCE",      value: projLic,  onChange: setProjLic,  placeholder: "Electrical licence" ,})
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:8},}
, React.createElement('button', { style: S.ctaPrimary, onClick: saveProj,}, "Save")
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setEditingProject(false),}, "Cancel")
)
):React.createElement('div', { style: {fontSize:12,color:"#666",marginTop:4},}, project.company||"", project.abn?` · ABN: ${project.abn}`:"", project.licence?` · Lic: ${project.licence}`:"")
)
, React.createElement('div', { style: {fontSize:11,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:10},}, "AREAS / LOCATIONS"  )
, project.areas.length===0&&React.createElement('div', { style: {color:"#555",fontSize:13,marginBottom:12},}, "No areas yet."  )
, project.areas.map(area=>(
React.createElement('div', { key: area.id, style: {...S.manageSection,borderColor:expandedArea===area.id?"#a855f755":"#2a2a2a"},}
, React.createElement('div', { style: S.manageSectionHeader,}
, React.createElement('button', { style: {flex:1,display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",color:"inherit",textAlign:"left",padding:0}, onClick: ()=>setExpandedArea(expandedArea===area.id?null:area.id),}
, React.createElement('span', { style: {fontSize:16,color:expandedArea===area.id?"#c084fc":"#aaa"},}, expandedArea===area.id?"▾":"▸")
, React.createElement('span', { style: {fontWeight:700,color:"#eee",fontSize:14},}, area.name)
, React.createElement('span', { style: {fontSize:11,color:"#555"},}, area.panels.length, " panels · "   , area.panels.reduce((s,p)=>s+p.circuits.length,0), " circuits" )
)
, React.createElement('button', { style: {...S.smallBtn,color:"#ef4444",borderColor:"#ef444433"}, onClick: ()=>delArea(area.id),}, "🗑")
)
, expandedArea===area.id&&(
React.createElement('div', { style: {padding:"0 4px 8px 20px"},}
, area.panels.map(pnl=>(
React.createElement('div', { key: pnl.id, style: {...S.managePanel,borderColor:expandedPanel===pnl.id?"#60a5fa44":"#222"},}
, React.createElement('div', { style: {display:"flex",alignItems:"center",gap:8,marginBottom:expandedPanel===pnl.id?10:0},}
, React.createElement('button', { style: {flex:1,display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",color:"inherit",textAlign:"left",padding:0}, onClick: ()=>setExpandedPanel(expandedPanel===pnl.id?null:pnl.id),}
, React.createElement('span', { style: {fontSize:14,color:expandedPanel===pnl.id?"#60a5fa":"#666"},}, expandedPanel===pnl.id?"▾":"▸")
, React.createElement('span', { style: {fontWeight:600,color:"#ccc",fontSize:13},}, pnl.name)
, React.createElement('span', { style: {fontSize:11,color:"#555"},}, pnl.circuits.length, " circuits" )
)
, React.createElement('button', { style: {...S.smallBtn,color:"#ef4444",borderColor:"#ef444433"}, onClick: ()=>delPanel(area.id,pnl.id),}, "🗑")
)
, expandedPanel===pnl.id&&(
React.createElement('div', { style: {paddingLeft:8},}
, React.createElement('div', { style: {display:"flex",flexWrap:"wrap",gap:6,marginBottom:10},}
, pnl.circuits.map(c=>(
React.createElement('div', { key: c, style: {display:"flex",alignItems:"center",gap:4,background:"#1e1e1e",border:"1px solid #333",borderRadius:6,padding:"3px 8px"},}
, React.createElement('span', { style: {fontSize:12,color:"#ccc",fontWeight:600},}, c)
, React.createElement('button', { style: {background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12,padding:"0 0 0 4px"}, onClick: ()=>delCircuit(area.id,pnl.id,c),}, "✕")
)
))
, pnl.circuits.length===0&&React.createElement('span', { style: {fontSize:12,color:"#555"},}, "No circuits" )
)
, React.createElement('div', { style: {display:"flex",gap:6,marginBottom:6},}
, React.createElement('input', { style: {...S.smallInput,flex:1}, placeholder: "Add circuit e.g. CB5"   , value: newCircuit[pnl.id]||"", onChange: e=>setNewCircuit(x=>({...x,[pnl.id]:e.target.value})), onKeyDown: e=>e.key==="Enter"&&addCircuit(area.id,pnl.id),})
, React.createElement('button', { style: {...S.smallBtn,color:"#60a5fa",borderColor:"#3b82f655"}, onClick: ()=>addCircuit(area.id,pnl.id),}, "+ Add" )
)
, React.createElement('div', { style: {fontSize:10,color:"#555",marginBottom:4},}, "BULK ADD (comma-separated)"  )
, React.createElement('div', { style: {display:"flex",gap:6},}
, React.createElement('input', { style: {...S.smallInput,flex:1}, placeholder: "CB1,CB2,CB3", value: bulkCircuit[pnl.id]||"", onChange: e=>setBulkCircuit(x=>({...x,[pnl.id]:e.target.value})), onKeyDown: e=>e.key==="Enter"&&addBulk(area.id,pnl.id),})
, React.createElement('button', { style: {...S.smallBtn,color:"#4ade80",borderColor:"#22c55e55"}, onClick: ()=>addBulk(area.id,pnl.id),}, "+ Bulk" )
)
)
)
)
))
, React.createElement('div', { style: {display:"flex",gap:6,marginTop:8},}
, React.createElement('input', { style: {...S.smallInput,flex:1}, placeholder: "New DB / Panel name"    , value: newPanelName[area.id]||"", onChange: e=>setNewPanelName(x=>({...x,[area.id]:e.target.value})), onKeyDown: e=>e.key==="Enter"&&addPanel(area.id),})
, React.createElement('button', { style: {...S.smallBtn,color:"#a855f7",borderColor:"#a855f755"}, onClick: ()=>addPanel(area.id),}, "+ Panel" )
)
)
)
)
))
, React.createElement('div', { style: {display:"flex",gap:6,marginTop:12},}
, React.createElement('input', { style: {...S.smallInput,flex:1}, placeholder: "New area / location name"    , value: newAreaName, onChange: e=>setNewAreaName(e.target.value), onKeyDown: e=>e.key==="Enter"&&addArea(),})
, React.createElement('button', { style: {...S.ctaPrimary,padding:"10px 16px",fontSize:13}, onClick: addArea,}, "+ Area" )
)
)
);
}
// ─────────────────────────────────────────────────────────────────────────
// AREA / PANEL / CIRCUIT / REPORT VIEWS (unchanged from v5)
// ─────────────────────────────────────────────────────────────────────────
function AreaListView({project,results,mode,modeColor,onSelect}){
return(React.createElement('div', { style: S.listWrap,}, React.createElement('div', { style: S.listTitle,}, "Select Area" )
, project.areas.length===0&&React.createElement('div', { style: {color:"#555",fontSize:14},}, "No areas. Go to ⚙ Manage to add areas."        )
, project.areas.map(area=>{
let total=0,pass=0,fail=0,untested=0;
area.panels.forEach(p=>p.circuits.forEach(c=>{total++;const v=getCircuitStatus(results,project.id,area.id,p.id,c,mode);if(v===STATUS.PASS||v===STATUS.NA)pass++;else if(v===STATUS.FAIL)fail++;else untested++;}));
const pct=total>0?Math.round((pass/total)*100):0;
return(React.createElement('button', { key: area.id, style: {...S.siteCard,...(fail>0?S.siteCardFail:{})}, onClick: ()=>onSelect(area.id),}
, React.createElement('div', { style: S.siteCardLeft,}, React.createElement('div', { style: S.siteCardName,}, area.name), React.createElement('div', { style: S.siteCardSub,}, area.panels.length, " panels · "   , total, " circuits" )
, React.createElement('div', { style: S.siteCardBar,}, React.createElement('div', { style: {...S.siteCardBarFill,width:`${pct}%`,background:fail>0?"#ef4444":untested>0?modeColor:"#22c55e"},})))
, React.createElement('div', { style: S.siteCardRight,}, fail>0&&React.createElement('span', { style: S.failBadge,}, fail, " FAIL" ), untested>0&&React.createElement('span', { style: S.untestedBadge,}, untested), React.createElement('span', { style: S.arrow,}, "›"))
));
})
));
}
function PanelListView({area,project,results,mode,modeColor,onSelect}){
return(React.createElement('div', { style: S.listWrap,}, React.createElement('div', { style: S.listTitle,}, area.name)
, area.panels.length===0&&React.createElement('div', { style: {color:"#555",fontSize:14},}, "No panels. Go to ⚙ Manage to add panels."        )
, area.panels.map(pnl=>{
const ps=panelSummary(results,project.id,area.id,pnl,mode);
const total=pnl.circuits.length;
return(React.createElement('button', { key: pnl.id, style: {...S.siteCard,...(ps.fail>0?S.siteCardFail:ps.untested===0?S.siteCardDone:{})}, onClick: ()=>onSelect(pnl.id),}
, React.createElement('div', { style: S.siteCardLeft,}, React.createElement('div', { style: S.siteCardName,}, pnl.name), React.createElement('div', { style: S.siteCardSub,}, total, " circuit" , total!==1?"s":"")
, React.createElement('div', { style: {display:"flex",gap:6,marginTop:6},}
, ps.pass>0&&React.createElement('span', { style: {fontSize:11,color:"#22c55e",background:"#22c55e22",borderRadius:4,padding:"1px 6px",fontWeight:700},}, ps.pass, " Pass" )
, ps.fail>0&&React.createElement('span', { style: {fontSize:11,color:"#f87171",background:"#f8717122",borderRadius:4,padding:"1px 6px",fontWeight:700},}, ps.fail, " Fail" )
, ps.na>0&&React.createElement('span', { style: {fontSize:11,color:"#64748b",background:"#64748b22",borderRadius:4,padding:"1px 6px",fontWeight:700},}, ps.na, " N/A" )
, ps.untested>0&&React.createElement('span', { style: {fontSize:11,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"1px 6px",fontWeight:700},}, ps.untested, " untested" )
)
)
, React.createElement('div', { style: S.siteCardRight,}, ps.fail>0&&React.createElement('span', { style: S.failBadge,}, "FAIL"), ps.untested===0&&ps.fail===0&&React.createElement('span', { style: {color:"#4ade80",fontSize:18,fontWeight:800},}, "✓"), React.createElement('span', { style: S.arrow,}, "›"))
));
})
));
}
function CircuitGrid({area,panel,project,results,mode,modeColor,onCycle,onSetAll,onOpenDetail}){
const circuits=panel.circuits;const ps=panelSummary(results,project.id,area.id,panel,mode);const isPush=mode==="push";
const total=circuits.length;
return(React.createElement('div', { style: S.circuitWrap,}
, React.createElement('div', { style: S.panelHeader,}, React.createElement('div', null, React.createElement('div', { style: S.panelTitle,}, panel.name), React.createElement('div', { style: S.panelSub,}, area.name, " · "  , total, " circuit" , total!==1?"s":""))
, React.createElement('div', { style: S.panelStats,}
, React.createElement('span', { style: {color:"#22c55e"},}, ps.pass, "P")
, React.createElement('span', { style: {color:"#ef4444"},}, ps.fail, "F")
, React.createElement('span', { style: {color:"#f59e0b",fontSize:12},}, ps.untested, " untested" )
))
, React.createElement('div', { style: S.quickRow,}, React.createElement('span', { style: S.quickLabel,}, "Set all:" )
, React.createElement('button', { style: {...S.quickBtn,background:"#1a3d1a",color:"#4ade80",borderColor:"#22c55e"}, onClick: ()=>onSetAll(STATUS.PASS),}, "✓ Pass" )
, React.createElement('button', { style: {...S.quickBtn,background:"#3d1a1a",color:"#f87171",borderColor:"#ef4444"}, onClick: ()=>onSetAll(STATUS.FAIL),}, "✗ Fail" )
, React.createElement('button', { style: {...S.quickBtn,background:"#1e2535",color:"#64748b",borderColor:"#334155"}, onClick: ()=>onSetAll(STATUS.NA),}, "N/A")
, React.createElement('button', { style: {...S.quickBtn,background:"#222",color:"#666",borderColor:"#333"}, onClick: ()=>onSetAll(STATUS.UNTESTED),}, "Reset")
)
, !isPush && (
React.createElement('div', { style: {fontSize:12,color:"#3b82f6",background:"#0a1628",border:"1px solid #3b82f633",borderRadius:8,padding:"8px 12px",marginBottom:12},}, "🔬 "
, React.createElement('strong', null, "Annual mode" ), " — tap any circuit to open the injection test form"
)
)
, React.createElement('div', { style: S.circuitGrid,}
, circuits.length===0&&React.createElement('div', { style: {color:"#555",fontSize:13,gridColumn:"1/-1"},}, "No circuits. Go to ⚙ Manage to add circuits."        )
, circuits.map(circuit=>{
const d=getCircuitData(results,project.id,area.id,panel.id,circuit);
const st=isPush?(_nullishCoalesce(_optionalChain([d, 'access', _159 => _159.push, 'optionalAccess', _160 => _160.status]), () => (STATUS.UNTESTED))):(_nullishCoalesce(_optionalChain([d, 'access', _161 => _161.inject, 'optionalAccess', _162 => _162.status]), () => (STATUS.UNTESTED)));
const sm=SM[st];
const hasNote=isPush?!!_optionalChain([d, 'access', _163 => _163.push, 'optionalAccess', _164 => _164.comment]):!!(_optionalChain([d, 'access', _165 => _165.inject, 'optionalAccess', _166 => _166.resultPos])||_optionalChain([d, 'access', _167 => _167.inject, 'optionalAccess', _168 => _168.resultNeg])||_optionalChain([d, 'access', _169 => _169.inject, 'optionalAccess', _170 => _170.comment]));
const priority=!isPush?(_optionalChain([d, 'access', _171 => _171.inject, 'optionalAccess', _172 => _172.priority])||""):"";
// Priority indicator colour
const priColor = priority==="U"?"#8B0000":priority==="H"?"#ef4444":priority==="M"?"#f59e0b":priority==="L"?"#eab308":"";
return(React.createElement('div', { key: circuit, style: {display:"flex",flexDirection:"column",gap:4},}
, isPush ? (
// PUSH MODE: tap = cycle status
React.createElement('button', { style: {...S.circuitBtn,background:sm.bg,color:sm.fg,borderColor:sm.border,boxShadow:st!==STATUS.UNTESTED?`0 0 10px ${sm.border}55`:"none"},
onClick: ()=>onCycle(circuit),}
, React.createElement('div', { style: S.circuitBtnLabel,}, circuit)
, React.createElement('div', { style: {...S.circuitBtnStatus,color:sm.fg},}, sm.label)
, hasNote&&React.createElement('div', { style: {fontSize:9,color:modeColor,marginTop:3},}, "✎")
)
) : (
// ANNUAL MODE: tap = open detail modal directly
React.createElement('button', { style: {...S.circuitBtn,background:sm.bg,color:sm.fg,borderColor:sm.border,boxShadow:st!==STATUS.UNTESTED?`0 0 10px ${sm.border}55`:"none",position:"relative"},
onClick: ()=>onOpenDetail(circuit),}
, React.createElement('div', { style: S.circuitBtnLabel,}, circuit)
, React.createElement('div', { style: {...S.circuitBtnStatus,color:sm.fg},}, sm.label)
, React.createElement('div', { style: {display:"flex",gap:3,marginTop:4,justifyContent:"center",alignItems:"center"},}
, hasNote&&React.createElement('span', { style: {fontSize:9,color:"#60a5fa"},}, "✎")
, priColor&&React.createElement('span', { style: {fontSize:9,fontWeight:800,color:priColor},}, priority)
)
)
)
/* Push: small note button. Annual: no secondary button needed (main tap opens modal) */
, isPush && (
React.createElement('button', { style: {...S.circuitEditBtn,borderColor:`${modeColor}44`,color:modeColor}, onClick: ()=>onOpenDetail(circuit),}, "✎ note" )
)
));
})
)
, React.createElement('div', { style: S.tapHint,}, isPush
?"Tap circuit to cycle Pass → Fail → N/A  ·  \"note\" to add a comment"
:"Tap any circuit to open the injection test form")
));
}
function ReportView({project,results,meta,onExportPush,onExportInject,onArchive}){
const pushSum=summariseProject(results,project,"push");const injectSum=summariseProject(results,project,"inject");
const fails=[];project.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{const d=getCircuitData(results,project.id,a.id,p.id,c);if((_nullishCoalesce(_optionalChain([d, 'access', _173 => _173.push, 'optionalAccess', _174 => _174.status]), () => (STATUS.UNTESTED)))===STATUS.FAIL)fails.push({area:a.name,panel:p.name,circuit:c,comment:_optionalChain([d, 'access', _175 => _175.push, 'optionalAccess', _176 => _176.comment])||""});})));
return(React.createElement('div', { style: S.summaryWrap,}
, React.createElement('div', { style: S.summaryTitle,}, project.name), React.createElement('div', { style: S.summaryMeta,}, "AUDIT REPORT "  , _optionalChain([meta, 'optionalAccess', _177 => _177.auditor])?`· ${meta.auditor}`:"")
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:8,marginBottom:20,flexWrap:"wrap"},}
, _optionalChain([meta, 'optionalAccess', _178 => _178.pushDate])&&React.createElement('div', { style: {...S.duePill,borderColor:"#e8731a55",color:"#e8731a",padding:"7px 12px"},}, "📋 Push: "  , fmtDate(meta.pushDate), " → next "   , addMonths(meta.pushDate,1))
, _optionalChain([meta, 'optionalAccess', _179 => _179.injectDate])&&React.createElement('div', { style: {...S.duePill,borderColor:"#3b82f655",color:"#60a5fa",padding:"7px 12px"},}, "🔬 Injection: "  , fmtDate(meta.injectDate), " → next "   , addYears(meta.injectDate,1))
)
, [["MONTHLY PUSH TEST",pushSum,"#e8731a"],["ANNUAL INJECTION TEST",injectSum,"#3b82f6"]].map(([lbl,sum,col])=>(
React.createElement('div', { key: lbl, style: {marginBottom:20},}
, React.createElement('div', { style: {fontSize:12,fontWeight:700,color:col,letterSpacing:0.8,marginBottom:8},}, lbl)
, React.createElement('div', { style: {display:"flex",gap:8},}, [["Total",sum.total,"#94a3b8"],["Pass",sum.pass,"#22c55e"],["Fail",sum.fail,"#ef4444"],["N/A",sum.na,"#64748b"],["Untested",sum.untested,"#f59e0b"]].map(([l,v,c])=>(
React.createElement('div', { key: l, style: {flex:1,textAlign:"center",background:"#1a1a1a",borderRadius:10,border:`1px solid ${c}33`,padding:"10px 4px"},}
, React.createElement('div', { style: {fontSize:22,fontWeight:800,color:c},}, v), React.createElement('div', { style: {fontSize:9,color:"#666",marginTop:2},}, l.toUpperCase())
)
)))
)
))
, fails.length>0&&React.createElement('div', { style: {marginBottom:20},}
, React.createElement('div', { style: {fontSize:13,fontWeight:800,color:"#ef4444",marginBottom:10},}, "Failed Circuits (Push Test)"   )
, fails.map((f,i)=>React.createElement('div', { key: i, style: {display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#1e1010",border:"1px solid #ef444433",borderRadius:8,marginBottom:6,fontSize:13,flexWrap:"wrap"},}
, React.createElement('span', { style: {flex:2,color:"#aaa"},}, f.area), React.createElement('span', { style: {flex:2,color:"#ccc",fontWeight:600},}, f.panel), React.createElement('span', { style: {flex:1,color:"#fff",fontWeight:800},}, f.circuit)
, React.createElement('span', { style: {background:"#3d1a1a",color:"#f87171",border:"1px solid #ef4444",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:800},}, "FAIL")
, f.comment&&React.createElement('span', { style: {fontSize:11,color:"#aaa",width:"100%",marginTop:4},}, f.comment)
))
)
, React.createElement('div', { style: {display:"flex",gap:8,marginBottom:8},}
, React.createElement('button', { style: {...S.exportBtn,flex:1,background:"#1a1200",borderColor:"#e8731a55",color:"#e8731a"}, onClick: onExportPush,}, "📋 Export Push Test"   )
, React.createElement('button', { style: {...S.exportBtn,flex:1,background:"#0a1628",borderColor:"#3b82f655",color:"#60a5fa"}, onClick: onExportInject,}, "🔬 Export Injection Test"   )
)
, onArchive&&React.createElement('div', { style: {display:"flex",gap:8},}
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#e8731a",borderColor:"#e8731a44",padding:"8px"}, onClick: ()=>onArchive("push"),}, "📋 Archive Push Test"   )
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",padding:"8px"}, onClick: ()=>onArchive("inject"),}, "🔬 Archive Injection Test"   )
)
));
}
// ─────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────
function LabelInput({label,value,onChange,placeholder,type="text"}){
return (
React.createElement('div', { style: {marginBottom:10},}
, label&&React.createElement('div', { style: S.metaLabelText,}, label)
, React.createElement('input', { style: {...S.metaInput,marginTop:4}, type: type, value: value, placeholder: placeholder, onChange: e=>onChange(e.target.value),})
)
);
}
function StatusBadge({status}){
const sm=SM[status];
return (React.createElement('div', { style: {padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:800,letterSpacing:0.5,background:sm.bg,color:sm.fg,border:`1.5px solid ${sm.border}`},}, sm.label));
}
function StatPill({label,val,col}){
return (React.createElement('div', { style: {display:"flex",alignItems:"center",gap:4,background:"#1a1a1a",border:`1px solid ${col}44`,borderRadius:6,padding:"3px 8px"},}, React.createElement('span', { style: {fontSize:10,color:col,fontWeight:700,letterSpacing:0.5},}, label), React.createElement('span', { style: {fontSize:14,color:col,fontWeight:800},}, val)));
}
function NavBtn({icon,label,active,onClick,color}){
const c=active?(color||"#e8731a"):"#555";
return (React.createElement('button', { onClick: onClick, style: {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"6px 0",color:c,borderTop:active?`2px solid ${color||"#e8731a"}`:"2px solid transparent"},}, React.createElement('span', { style: {fontSize:18},}, icon), React.createElement('span', { style: {fontSize:9,fontWeight:active?700:500,letterSpacing:0.5},}, label)));
}
// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────
const S={
root:{height:"100vh",display:"flex",flexDirection:"column",background:"#111",color:"#eee",fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",maxWidth:900,margin:"0 auto",WebkitFontSmoothing:"antialiased",overflow:"hidden"},
loader:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#111"},
loaderSpinner:{width:40,height:40,border:"3px solid #333",borderTop:"3px solid #e8731a",borderRadius:"50%"},
topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",background:"#161616",flexShrink:0,zIndex:10},
topbarLeft:{display:"flex",alignItems:"center",gap:12},topbarRight:{display:"flex",alignItems:"center",gap:8},
appTitle:{fontSize:16,fontWeight:800,letterSpacing:1,color:"#e8731a"},appSub:{fontSize:10,letterSpacing:0.5,transition:"color 0.3s"},
backBtn:{fontSize:28,color:"#aaa",background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:"0 8px 0 0",fontWeight:300},
saveIndicator:{fontSize:11,color:"#22c55e",fontWeight:600,transition:"opacity 0.4s",pointerEvents:"none"},
breadcrumb:{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#161616",borderBottom:"1px solid #1e1e1e",fontSize:12,flexWrap:"wrap",flexShrink:0},
bcItem:{color:"#888",cursor:"pointer"},bcSep:{color:"#444"},
main:{flex:1,overflowY:"auto",padding:"0 0 0"},
bottomNav:{display:"flex",background:"#161616",borderTop:"1px solid #222",flexShrink:0},
homeWrap:{padding:"24px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14},
brandBlock:{textAlign:"center",borderBottom:"2px solid #e8731a",paddingBottom:8,width:"100%",maxWidth:500},
brandTitle:{fontSize:20,fontWeight:900,letterSpacing:3,color:"#e8731a"},brandSub:{fontSize:11,color:"#666",letterSpacing:1,marginTop:2},
siteTitle:{fontSize:20,fontWeight:800,color:"#eee"},siteSub:{fontSize:12,color:"#666"},
metaCard:{width:"100%",maxWidth:500,background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"14px"},
metaLabelText:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700},
metaInput:{background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"9px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"},
metaRow:{marginBottom:8},metaLabel:{flex:1,display:"flex",flexDirection:"column",gap:4},
duePill:{fontSize:12,background:"#161616",border:"1px solid",borderRadius:8,padding:"5px 10px"},
modeSelectLabel:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1},
modeBtnRow:{display:"flex",gap:12,width:"100%",maxWidth:500},
modeBtnPush:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"18px 12px",background:"#1a1200",border:"2px solid #e8731a55",borderRadius:16,cursor:"pointer",color:"#eee"},
modeBtnInject:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"18px 12px",background:"#0a1628",border:"2px solid #3b82f655",borderRadius:16,cursor:"pointer",color:"#eee"},
modeBtnIcon:{fontSize:26},modeBtnTitle:{fontSize:13,fontWeight:800,textAlign:"center",letterSpacing:0.3},
modeBtnProgress:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,overflow:"hidden"},
modeBtnBar:{height:"100%",borderRadius:2,transition:"width 0.4s"},modeBtnPct:{fontSize:11,color:"#666"},
secondaryBtn:{padding:"11px",background:"#161616",color:"#aaa",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
exportBtn:{padding:"11px",background:"#161616",color:"#4ade80",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
confirmRow:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},
confirmYes:{padding:"7px 14px",background:"#3d1a1a",color:"#f87171",border:"1px solid #ef4444",borderRadius:8,fontSize:13,cursor:"pointer"},
confirmNo:{padding:"7px 14px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:8,fontSize:13,cursor:"pointer"},
resetBtn:{background:"transparent",border:"none",color:"#555",fontSize:12,cursor:"pointer",textDecoration:"underline"},
ctaPrimary:{padding:"11px 20px",background:"#e8731a",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"},
ctaSecondary:{padding:"11px 20px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"},
tabBtn:{flex:1,padding:"9px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#666",fontSize:12,fontWeight:600,cursor:"pointer"},
tabBtnActive:{background:"#1e1e1e",border:"1px solid #e8731a",color:"#e8731a"},
listWrap:{padding:"16px"},listTitle:{fontSize:20,fontWeight:800,color:"#eee",marginBottom:16},
siteCard:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px 18px",marginBottom:10,cursor:"pointer",textAlign:"left"},
siteCardFail:{background:"#1e1010",borderColor:"#ef444455"},siteCardDone:{background:"#0e1e0e",borderColor:"#22c55e55"},
siteCardLeft:{flex:1},siteCardRight:{display:"flex",alignItems:"center",gap:8,marginLeft:16},
siteCardName:{fontSize:16,fontWeight:700,color:"#eee"},siteCardSub:{fontSize:12,color:"#666",marginTop:2},
siteCardBar:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:10,overflow:"hidden"},
siteCardBarFill:{height:"100%",borderRadius:2,transition:"width 0.4s"},
failBadge:{fontSize:11,fontWeight:800,color:"#f87171",background:"#3d1a1a",borderRadius:6,padding:"3px 8px",border:"1px solid #ef4444"},
untestedBadge:{fontSize:11,fontWeight:700,color:"#fbbf24",background:"#2a1e00",borderRadius:6,padding:"3px 8px"},
arrow:{fontSize:22,color:"#555",lineHeight:1},
addCard:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px",marginBottom:10},
circuitWrap:{padding:"16px"},
panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14},
panelTitle:{fontSize:20,fontWeight:800,color:"#eee"},panelSub:{fontSize:12,color:"#666",marginTop:2},
panelStats:{display:"flex",gap:10,fontSize:15,fontWeight:800},
quickRow:{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"},
quickLabel:{fontSize:12,color:"#555",fontWeight:600,letterSpacing:0.5},
quickBtn:{fontSize:12,fontWeight:700,border:"1px solid",borderRadius:8,padding:"7px 14px",cursor:"pointer"},
circuitGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(88px, 1fr))",gap:10},
circuitBtn:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"2px solid",borderRadius:12,padding:"14px 8px",cursor:"pointer",minHeight:80,width:"100%"},
circuitBtnLabel:{fontSize:13,fontWeight:800,letterSpacing:0.3},circuitBtnStatus:{fontSize:11,fontWeight:700,marginTop:6,letterSpacing:0.5},
circuitEditBtn:{fontSize:11,background:"#161616",border:"1px solid",borderRadius:6,padding:"4px 0",cursor:"pointer",width:"100%",fontWeight:600},
tapHint:{marginTop:20,textAlign:"center",fontSize:11,color:"#444"},
summaryWrap:{padding:"16px"},summaryTitle:{fontSize:22,fontWeight:900,letterSpacing:1.5,color:"#e8731a"},summaryMeta:{fontSize:13,color:"#777",marginTop:4},
manageSection:{border:"1px solid",borderRadius:12,marginBottom:10,overflow:"hidden"},
manageSectionHeader:{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"#1a1a1a"},
managePanel:{border:"1px solid",borderRadius:8,padding:"10px 12px",marginBottom:8,background:"#161616"},
smallBtn:{padding:"5px 10px",background:"transparent",border:"1px solid #333",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:600,flexShrink:0,color:"#aaa"},
smallInput:{background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"},
modalOverlay:{position:"absolute",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"},
modalBox:{background:"#1a1a1a",border:"1px solid #333",borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto"},
modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},
modalTitle:{fontSize:18,fontWeight:800,color:"#eee"},modalSub:{fontSize:12,color:"#666",marginTop:3},
modalField:{marginBottom:14},
modalLabel:{display:"block",fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5},
modalInput:{width:"100%",background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
injectResult:{border:"1px solid",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13},
nextBanner:{display:"flex",alignItems:"center",background:"#111",border:"1px solid #3b82f633",borderRadius:8,padding:"10px 14px",marginBottom:14},
modalClose:{width:"100%",padding:"14px",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8},
};
(function(){
  try {
    var rootEl = document.getElementById('root');
    var root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(App));
    if(window.__hideLoading) window.__hideLoading();
  } catch(e) {
    document.body.style.overflow='auto';
    document.body.innerHTML='<div style="color:#ff6b6b;padding:30px;font-family:sans-serif;background:#111;min-height:100vh"><h2 style="color:#e8731a">Mount Error</h2><b>'+e.message+'</b><br><br><pre style="font-size:10px;color:#888;white-space:pre-wrap">'+e.stack+'</pre></div>';
  }
})();