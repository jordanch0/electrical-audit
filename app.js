"use strict";
if(typeof React==='undefined'){throw new Error('react.js not loaded - React is undefined');}
if(typeof ReactDOM==='undefined'){throw new Error('reactdom.js not loaded - ReactDOM is undefined');}
function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }
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
// Parse company, ABN, licence from an Excel header row string
function parseCompanyRow(cellValue) {
  const s = String(cellValue||"").trim();
  if(!s) return {company:"", abn:"", licence:""};
  const parts = s.split(/\s*\|\s*/);
  let company="", abn="", licence="";
  parts.forEach(p=>{
    const lower = p.toLowerCase();
    if(lower.startsWith("abn:")) abn = p.replace(/^abn:\s*/i,"").trim();
    else if(lower.startsWith("electrical licence:")) licence = p.replace(/^electrical licence:\s*/i,"").trim();
    else if(lower.startsWith("abn ")) abn = p.replace(/^abn\s*/i,"").trim();
    else if(lower.startsWith("licence:")) licence = p.replace(/^licence:\s*/i,"").trim();
    else if(!company) company = p.trim();
  });
  return {company, abn, licence};
}

function parseExcelToProject(data, projectName, company, abn, licence) {
const ws   = data.Sheets[data.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
// Auto-detect company/ABN/licence from row 2 only (row 1 is the site title)
if(rows[1]) {
  const parsed = parseCompanyRow(rows[1][0]);
  if(!company && parsed.company) company = parsed.company;
  if(!abn && parsed.abn) abn = parsed.abn;
  if(!licence && parsed.licence) licence = parsed.licence;
}
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
const coLine = [project.company||"Vorick Group Asset Maintenance", project.abn?`ABN: ${project.abn}`:"", project.licence?`Electrical Licence: ${project.licence}`:""].filter(Boolean).join("  |  ");
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
let wbOut;
  try {
    wbOut = XLSX.write(wb, {bookType:"xlsx", type:"base64", cellStyles:true, bookSST:false});
  } catch(xlsxErr) {
    alert("Export requires internet connection to load the XLSX library.\nPlease connect to WiFi and try again.");
    return;
  }
const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbOut}`;
const filename = `${project.name.replace(/\s+/g,"_")}_RCD_${isInject?"Injection":"Push"}_${testDate||"export"}.xlsx`;
// Send to native iOS share sheet (saves to Files app, AirDrop, etc.)
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.shareFile) {
    window.webkit.messageHandlers.shareFile.postMessage({
      base64: wbOut,
      filename: filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  } else {
    // Fallback for non-native (browser preview etc)
    var link=document.createElement('a');
    link.href=dataUri; link.download=filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }
}
// ─────────────────────────────────────────────────────────────────────────
// TEMPLATE DOWNLOAD — gives user a sample import spreadsheet
// ─────────────────────────────────────────────────────────────────────────
function downloadTemplate() {
const wb=XLSX.utils.book_new();
const rows=[
["Area","Panel / DB Name","Circuit / CB"],
["Area 1","Panel 1","CB1"],
["Area 1","Panel 1","CB2"],
["Area 1","Panel 1","CB3"],
["Area 1","Panel 2","CB1"],
["Area 1","Panel 2","CB2"],
["Wash Plant","DB Wash Plant","CB9"],
["Wash Plant","DB Wash Plant","CB10"],
["Wash Plant","DB Lunch Shed","CB1"],
];
const ws=XLSX.utils.aoa_to_sheet(rows);
ws["!cols"]=[{wch:24},{wch:24},{wch:16}];
XLSX.utils.book_append_sheet(wb,ws,"RCD Import Template");
const tOut = XLSX.write(wb, {bookType:"xlsx", type:"base64", cellStyles:true});
const tUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${tOut}`;
if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.shareFile) {
    window.webkit.messageHandlers.shareFile.postMessage({
      base64: tOut,
      filename: 'RCD_Import_Template.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  } else {
    var tLink=document.createElement('a');
    tLink.href=tUri; tLink.download='RCD_Import_Template.xlsx';
    document.body.appendChild(tLink); tLink.click(); document.body.removeChild(tLink);
  }
}
// ═════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════════════
function RCDApp() {
const [projects,      setProjects]     = React.useState([]);
const [allResults,    setAllResults]   = React.useState({});
const [allMeta,       setAllMeta]      = React.useState({});
const [history,       setHistory]      = React.useState([]);
const [dropdowns,     setDropdowns]    = React.useState({ responsibility:DEFAULT_RESPONSIBILITY, rectified:DEFAULT_RECTIFIED });
const [logo,          setLogo]         = React.useState(null);  // base64 data-URL
const [activeProject, setActiveProject]= React.useState(null);
const [mode,          setMode]         = React.useState(null);
const [view,          setView]         = React.useState("projects");
const [auditEntered,  setAuditEntered] = React.useState(false);
const [activeAreaId,  setActiveAreaId] = React.useState(null);
const [activePanelId, setActivePanelId]= React.useState(null);
const [loaded,        setLoaded]       = React.useState(false);
const [saveFlash,     setSaveFlash]    = React.useState(false);
const [detailInfo,    setDetailInfo]   = React.useState(null);
React.useEffect(()=>{
// Safety: force loaded=true after 3s even if storage fails
var safetyTimer=setTimeout(()=>setLoaded(true),3000);
(async()=>{
try {
const [p,r,m,h,d,l]=await Promise.all([
load(K_PROJECTS,[]),
load(K_RESULTS,{}),
load(K_META,{}),
load(K_HISTORY,[]),
load(K_DROPDOWNS,{responsibility:DEFAULT_RESPONSIBILITY,rectified:DEFAULT_RECTIFIED,ampRating:DEFAULT_AMP_RATING,cbType:DEFAULT_CB_TYPE}),
load(K_LOGO,null),
]);
clearTimeout(safetyTimer);setProjects(p);setAllResults(r);setAllMeta(m);setHistory(h);setDropdowns(d);setLogo(l);setLoaded(true);
} catch(loadErr) { console.error('Load error:',loadErr); clearTimeout(safetyTimer); setLoaded(true); }
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
const goProjects=()=>{setView("projects");setActiveProject(null);setMode(null);setActiveAreaId(null);setActivePanelId(null);setAuditEntered(false);};
const goHome=()=>{setView("home");setActiveAreaId(null);setActivePanelId(null);};
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
else if(view==="audit"&&activePanelId){setActivePanelId(null);}
else if(view==="audit"&&activeAreaId){setActiveAreaId(null);}
else if(view==="audit"&&auditEntered&&!activeAreaId){setAuditEntered(false);}
else if(view==="audit"){setView("home");}
else if(view==="home"){goProjects();}
else if(["manage","report","history","settings"].includes(view)){setView("home");}
else goProjects();
},}, "‹")
, React.createElement('div', null
, React.createElement('div', { style: S.appTitle,}, "RCD TEST" )
, React.createElement('div', { style: {...S.appSub,color:mode?modeColor:"#555"},}, view==="projects"?"Site Select":_optionalChain([project, 'optionalAccess', _60 => _60.name])||"")
)
)
, React.createElement('div', { style: S.topbarRight,}
, React.createElement('div', { style: {...S.saveIndicator,opacity:saveFlash?1:0},}, "✓ Saved" )
, mode&&project&&React.createElement(React.Fragment, null, React.createElement(StatPill, { label: "PASS", val: summary.pass, col: "#22c55e",}), React.createElement(StatPill, { label: "FAIL", val: summary.fail, col: "#ef4444",}), React.createElement(StatPill, { label: "UNTESTED", val: summary.untested, col: "#f59e0b",}))
)
)
, view!=="projects"&&(
React.createElement('div', { style: S.breadcrumb,}
, React.createElement('span', { style: S.bcItem, onClick: goProjects,}, "Sites")
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
onStartPush: ()=>{setMode("push");setView("audit");setAuditEntered(true);},
onStartInject: ()=>{setMode("inject");setView("audit");setAuditEntered(true);},
onReport: ()=>setView("report"), onManage: ()=>setView("manage"),
onHistory: ()=>setView("history"), onSettings: ()=>setView("settings"),
onReset: ()=>setAllResults(prev=>({...prev,[activeProject]:{}})),
onExportPush: ()=>exportExcel(allResults,project,meta,"push",logo),
onExportInject: ()=>exportExcel(allResults,project,meta,"inject",logo),
onArchive: archiveAudit,
activeMode: mode,
onCompleteAudit: ()=>{archiveAudit(mode);setAllResults(prev=>({...prev,[activeProject]:{}}));setAllMeta(prev=>({...prev,[activeProject]:{auditor:"",pushDate:new Date().toISOString().slice(0,10),injectDate:new Date().toISOString().slice(0,10),notes:""}}));setMode(null);setAuditEntered(false);setActiveAreaId(null);setActivePanelId(null);},})
, isAudit&&project&&!auditEntered&&React.createElement(AuditGatePage,{color:mode?modeColor:"#e8731a",moduleLabel:"RCD TEST",auditLabel:mode?modeLabel:"",hasActiveAudit:!!mode,onGoHome:goHome,onCompleteAudit:()=>{archiveAudit(mode);setAllResults(prev=>({...prev,[activeProject]:{}}));setAllMeta(prev=>({...prev,[activeProject]:{auditor:"",pushDate:new Date().toISOString().slice(0,10),injectDate:new Date().toISOString().slice(0,10),notes:""}}));setMode(null);setAuditEntered(false);setActiveAreaId(null);setActivePanelId(null);setView("home");},onEnterAudit:()=>setAuditEntered(true),isRCD:true})
, isAudit&&project&&auditEntered&&!activeAreaId&&React.createElement(AreaListView, { project: project, results: allResults, mode: mode, modeColor: modeColor, onSelect: id=>setActiveAreaId(id),})
, isAudit&&project&&auditEntered&&activeAreaId&&!activePanelId&&React.createElement(PanelListView, { area: area, project: project, results: allResults, mode: mode, modeColor: modeColor, onSelect: id=>{setActivePanelId(id);setView("panel");},})
, view==="panel"&&panel&&React.createElement(CircuitGrid, { area: area, panel: panel, project: project, results: allResults, mode: mode, modeColor: modeColor,
onCycle: c=>cycleCircuit(activeAreaId,activePanelId,c),
onSetAll: s=>setAllPanel(activeAreaId,activePanelId,panel.circuits,s),
onOpenDetail: c=>setDetailInfo({areaId:activeAreaId,panelId:activePanelId,circuit:c}),})
, view==="report"&&project&&React.createElement(ReportView, { project: project, results: allResults, meta: meta, onExportPush: ()=>exportExcel(allResults,project,meta,"push",logo), onExportInject: ()=>exportExcel(allResults,project,meta,"inject",logo), onArchive: archiveAudit,})
, view==="manage"&&project&&React.createElement(ManageView, { project: project, onUpdateProject: updated=>setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p)),})
, view==="history"&&React.createElement(HistoryView, { history: history.filter(h=>h.projectId===activeProject), project: project, onDelete: id=>setHistory(prev=>prev.filter(h=>h.id!==id)), onExportSnap: (snap)=>exportExcel({[snap.projectId]:snap.results},projects.find(p=>p.id===snap.projectId)||project,snap.meta,snap.mode,logo),
onContinueFromSnap: (snap)=>{
  // Deep-copy snap results into active results (does NOT overwrite archived snap)
  setAllResults(prev=>({...prev,[activeProject]:JSON.parse(JSON.stringify(snap.results||{}))}));
  setAllMeta(prev=>({...prev,[activeProject]:{...snap.meta}}));
  setMode(snap.mode||"push");
  setAuditEntered(true);
  setActiveAreaId(null);
  setActivePanelId(null);
  setView("audit");
},})
, view==="settings"&&React.createElement(SettingsView, { dropdowns: dropdowns, setDropdowns: setDropdowns, logo: logo, setLogo: setLogo,})
)
, detailInfo&&project&&React.createElement(DetailModal, { ...detailInfo, project: project, mode: mode, results: allResults, meta: meta, dropdowns: dropdowns,
onPatch: patch=>patchCircuit(activeProject,detailInfo.areaId,detailInfo.panelId,detailInfo.circuit,patch),
onClose: ()=>setDetailInfo(null),})
, view!=="projects"&&(
React.createElement('nav', { style: S.bottomNav, 'data-nav': 'bottom',}
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
const [newCo,      setNewCo]      = React.useState("");
const [newAbn,     setNewAbn]     = React.useState("");
const [newLic,     setNewLic]     = React.useState("");

const [deleteId,   setDeleteId]   = React.useState(null);
const [importing,  setImporting]  = React.useState(false);
const [importPreview, setImportPreview] = React.useState(null); // parsed project before confirming
const [importName, setImportName] = React.useState("");
const [importCo,   setImportCo]   = React.useState("");
const [importAbn,  setImportAbn]  = React.useState("");
const [importLic,  setImportLic]  = React.useState("");

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
// Auto-fill fields from parsed header if currently empty
if(!importCo && proj.company) setImportCo(proj.company);
if(!importAbn && proj.abn) setImportAbn(proj.abn);
if(!importLic && proj.licence) setImportLic(proj.licence);
} catch(err){ setImportError("Could not parse file: "+err.message); }
setImporting(false);
};
reader.readAsArrayBuffer(file);
e.target.value="";
};
const confirmImport = () => {
if(!importPreview) return;
const finalProject={...importPreview,id:slugify(importName||importPreview.name),name:importName||importPreview.name,company:importCo,abn:importAbn.trim(),licence:importLic.trim()};
onAddProject(finalProject);
setImportPreview(null);setShowAdd(false);setImportName("");setImportError("");
};
const addManual=()=>{
if(!newName.trim()) return;
onAddProject({id:slugify(newName),name:newName.trim(),company:newCo.trim(),abn:newAbn.trim(),licence:newLic.trim(),areas:[]});
setNewName("");setNewAbn("");setNewLic("");setShowAdd(false);
};
return (
React.createElement('div', { style: S.listWrap,}
, React.createElement('div', { style: S.brandBlock,}, React.createElement('div', { style: S.brandTitle,}, "VORICK GROUP" ), React.createElement('div', { style: S.brandSub,}, "RCD Test Management"  ))
, React.createElement('div', { style: {...S.listTitle,marginTop:24},}, "Sites")
, projects.length===0&&React.createElement('div', { style: {color:"#555",fontSize:14,marginBottom:16},}, "No projects yet."  )
, projects.map(proj=>{
let total=0,tested=0,fail=0;
proj.areas.forEach(a=>a.panels.forEach(p=>p.circuits.forEach(c=>{total++;const v=getCircuitStatus(allResults,proj.id,a.id,p.id,c,"push");if(v!==STATUS.UNTESTED)tested++;if(v===STATUS.FAIL)fail++;})));
const pct=total>0?Math.round((tested/total)*100):0;
return(
React.createElement('div', { key: proj.id, style: {...S.siteCard,flexDirection:"column",gap:0,padding:0,overflow:"hidden"},}
, React.createElement('button', { style: {display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"16px 18px",color:"inherit",textAlign:"left"}, onClick: ()=>onSelect(proj.id),}
, React.createElement('div', { style: {flex:1},}
, React.createElement('div', { style: S.siteCardName,}, proj.name)
, React.createElement('div', { style: S.siteCardSub,}, proj.company||"", " · ", proj.areas.length, " areas · ", total, " circuits · ", tested, "/", total, " tested")
, React.createElement('div', { style: {...S.siteCardBar,marginTop:8},}, React.createElement('div', { style: {...S.siteCardBarFill,width:`${pct}%`,background:fail>0?"#ef4444":tested===total&&total>0?"#22c55e":"#e8731a"},}))
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
, React.createElement('div', { style: {fontSize:14,fontWeight:800,color:"#eee",marginBottom:12},}, "New Site" )
, React.createElement(LabelInput, { label: "SITE NAME" ,   value: newName, onChange: setNewName, placeholder: "Site name"  ,})
, React.createElement(LabelInput, { label: "COMPANY (optional)", value: newCo, onChange: setNewCo, placeholder: "Company name" ,})
, React.createElement(LabelInput, { label: "ABN (optional)", value: newAbn, onChange: setNewAbn, placeholder: "e.g. 12 345 678 901" ,})
, React.createElement(LabelInput, { label: "ELECTRICAL LICENCE (optional)", value: newLic, onChange: setNewLic, placeholder: "e.g. 123456C" ,})
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:4},}
, React.createElement('button', { style: S.ctaPrimary, onClick: addManual,}, "Add Site" )
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setShowAdd(false),}, "Cancel")
)
)
, tab==="import"&&React.createElement(React.Fragment, null
, React.createElement('div', { style: {fontSize:14,fontWeight:800,color:"#eee",marginBottom:4},}, "Import from Excel"  )
, React.createElement('div', { style: {fontSize:12,color:"#666",marginBottom:12},}, "Upload a spreadsheet with columns: "     , React.createElement('strong', { style: {color:"#aaa"},}, "Area | Panel/DB | Circuit"    ), ". The app will build the project structure automatically."        )
, React.createElement(LabelInput, { label: "SITE NAME" ,   value: importName, onChange: setImportName, placeholder: "Site name"  ,})
, React.createElement(LabelInput, { label: "COMPANY (optional)", value: importCo, onChange: setImportCo, placeholder: "Company name" ,})
, React.createElement(LabelInput, { label: "ABN (optional)", value: importAbn, onChange: setImportAbn, placeholder: "e.g. 12 345 678 901" ,})
, React.createElement(LabelInput, { label: "ELECTRICAL LICENCE (optional)", value: importLic, onChange: setImportLic, placeholder: "e.g. 123456C" ,})
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
function ProjectHomeView({ project, meta, setMeta, results, onStartPush, onStartInject, onReport, onManage, onHistory, onSettings, onReset, onExportPush, onExportInject, onArchive, onCompleteAudit, activeMode }) {
const pushSum=summariseProject(results,project,"push");
const injectSum=summariseProject(results,project,"inject");
const pushPct=pushSum.total>0?Math.round(((pushSum.pass+pushSum.na)/pushSum.total)*100):0;
const injectPct=injectSum.total>0?Math.round(((injectSum.pass+injectSum.na)/injectSum.total)*100):0;
const [showExports,setShowExports]=React.useState(false);
const [confirmReset,setConfirmReset]=React.useState(false);
const [archiveMsg,setArchiveMsg]=React.useState("");
const handleArchive=(m)=>{onArchive(m);setArchiveMsg(`${m==="inject"?"Injection":"Push"} test archived!`);setTimeout(()=>setArchiveMsg(""),2500);};
const hasAuditor=!!(meta&&meta.auditor&&meta.auditor.trim());
return (
React.createElement('div', { style: S.homeWrap,}
, React.createElement('div', { style: S.brandBlock,}, React.createElement('div', { style: S.brandTitle,}, project.company||"VORICK GROUP"), React.createElement('div', { style: S.brandSub,}, "Asset Maintenance" ))
, React.createElement('div', { style: S.siteTitle,}, project.name)
, React.createElement('div', { style: S.siteSub,}, "RCD Test Management"  )
, React.createElement('div', { style: S.metaCard,}
, React.createElement(LabelInput, { label: "AUDITOR", value: _nullishCoalesce(_optionalChain([meta, 'optionalAccess', _66 => _66.auditor]), () => ("")), onChange: v=>setMeta({auditor:v}), placeholder: "Enter name to begin audit…" ,})
, !hasAuditor&&React.createElement('div', { style: {fontSize:11,color:"#ef4444",marginTop:4}}, "⚠ Auditor name required before starting a test")
, React.createElement('div', { style: {display:"flex",flexDirection:"column",gap:8,marginTop:4},}
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
, React.createElement('button', { style: {...S.modeBtnPush,opacity:hasAuditor?1:0.45,cursor:hasAuditor?"pointer":"not-allowed"}, onClick: hasAuditor?onStartPush:undefined,}
, React.createElement('span', { style: S.modeBtnIcon,}, "📋")
, React.createElement('span', { style: S.modeBtnTitle,}, "Monthly", React.createElement('br', null), "Push Test" )
, React.createElement('div', { style: S.modeBtnProgress,}, React.createElement('div', { style: {...S.modeBtnBar,width:`${pushPct}%`,background:"#e8731a"},}))
, React.createElement('span', { style: S.modeBtnPct,}, pushPct, "% · "  , pushSum.fail>0?`${pushSum.fail} FAIL`:"clear")
)
, React.createElement('button', { style: {...S.modeBtnInject,opacity:hasAuditor?1:0.45,cursor:hasAuditor?"pointer":"not-allowed"}, onClick: hasAuditor?onStartInject:undefined,}
, React.createElement('span', { style: S.modeBtnIcon,}, "🔬")
, React.createElement('span', { style: S.modeBtnTitle,}, "Annual", React.createElement('br', null), "Injection Test" )
, React.createElement('div', { style: S.modeBtnProgress,}, React.createElement('div', { style: {...S.modeBtnBar,width:`${injectPct}%`,background:"#3b82f6"},}))
, React.createElement('span', { style: S.modeBtnPct,}, injectPct, "% · "  , injectSum.fail>0?`${injectSum.fail} FAIL`:"clear")
)
)
/* Archive / Complete buttons */
, React.createElement('div', { style: {width:"100%",maxWidth:500,background:"#161616",border:`1px solid ${activeMode?"#e8731a44":"#2a2a2a"}`,borderRadius:12,padding:"10px 14px"},}
, React.createElement('div', { style: {fontSize:10,color:"#555",fontWeight:700,letterSpacing:0.8,marginBottom:8},}, activeMode?"COMPLETE ACTIVE AUDIT":"ARCHIVE COMPLETED AUDIT")
, activeMode&&React.createElement(CompleteAuditBtn, {color:activeMode==="push"?"#e8731a":"#3b82f6", label:activeMode==="push"?"📋 Complete Push Test":"🔬 Complete Injection Test", onComplete:onCompleteAudit})
, !activeMode&&React.createElement('div', { style: {display:"flex",gap:8},}
  , React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#e8731a",borderColor:"#e8731a44",padding:"8px"}, onClick: ()=>handleArchive("push"),}, "📋 Archive Push Test")
  , React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",padding:"8px"}, onClick: ()=>handleArchive("inject"),}, "🔬 Archive Injection Test")
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
function HistoryView({ history, project, onDelete, onExportSnap, onContinueFromSnap }) {
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
, React.createElement('button', { style: {...S.smallBtn,flex:1,color:"#a78bfa",borderColor:"#7c3aed44",fontWeight:700}, onClick: ()=>onContinueFromSnap(snap),}, "▶ Continue" )
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

const upd=u=>onUpdateProject(u);
const addArea=()=>{if(!newAreaName.trim())return;upd({...project,areas:[...project.areas,{id:slugify(newAreaName),name:newAreaName.trim(),panels:[]}]});setNewAreaName("");};
const delArea=id=>upd({...project,areas:project.areas.filter(a=>a.id!==id)});
const addPanel=(aid)=>{const n=(newPanelName[aid]||"").trim();if(!n)return;upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:[...a.panels,{id:slugify(n),name:n,circuits:[]}]}:a)});setNewPanelName(x=>({...x,[aid]:""}));};
const delPanel=(aid,pid)=>upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.filter(p=>p.id!==pid)}:a)});
const addCircuit=(aid,pid)=>{const n=(newCircuit[pid]||"").trim();if(!n)return;upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:[...p.circuits,n]}:p)}:a)});setNewCircuit(x=>({...x,[pid]:""}));};
const addBulk=(aid,pid)=>{const raw=(bulkCircuit[pid]||"").trim();if(!raw)return;const items=raw.split(",").map(s=>s.trim()).filter(Boolean);upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:[...p.circuits,...items.filter(c=>!p.circuits.includes(c))]}:p)}:a)});setBulkCircuit(x=>({...x,[pid]:""}));};
const delCircuit=(aid,pid,c)=>upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.id===pid?{...p,circuits:p.circuits.filter(x=>x!==c)}:p)}:a)});
const saveProj=()=>{upd({...project,name:projName.trim()||project.name,company:projCo.trim()});setEditingProject(false);};
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
, React.createElement('div', { style: {display:"flex",gap:8,marginTop:8},}
, React.createElement('button', { style: S.ctaPrimary, onClick: saveProj,}, "Save")
, React.createElement('button', { style: S.ctaSecondary, onClick: ()=>setEditingProject(false),}, "Cancel")
)
):React.createElement('div', { style: {fontSize:12,color:"#666",marginTop:4},}, project.company||"")
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
return (React.createElement('button', { onClick: onClick, style: {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",minHeight:50,color:c,borderTop:active?`2px solid ${color||"#e8731a"}`:"2px solid transparent"},}, React.createElement('span', { style: {fontSize:18},}, icon), React.createElement('span', { style: {fontSize:9,fontWeight:active?700:500,letterSpacing:0.5},}, label)));
}
// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────
const S={
root:{display:"flex",flexDirection:"column",flex:1,minHeight:0,touchAction:"pan-y",background:"#111",color:"#eee",fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",WebkitFontSmoothing:"antialiased",overflow:"hidden"},
loader:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#111"},
loaderSpinner:{width:40,height:40,border:"3px solid #333",borderTop:"3px solid #e8731a",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",background:"#161616",flexShrink:0,zIndex:10},
topbarLeft:{display:"flex",alignItems:"center",gap:12},topbarRight:{display:"flex",alignItems:"center",gap:8},
appTitle:{fontSize:16,fontWeight:800,letterSpacing:1,color:"#e8731a"},appSub:{fontSize:10,letterSpacing:0.5,transition:"color 0.3s"},
backBtn:{fontSize:28,color:"#aaa",background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:"0 8px 0 0",fontWeight:300},
saveIndicator:{fontSize:11,color:"#22c55e",fontWeight:600,transition:"opacity 0.4s",pointerEvents:"none"},
breadcrumb:{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#161616",borderBottom:"1px solid #1e1e1e",fontSize:12,flexWrap:"wrap",flexShrink:0},
bcItem:{color:"#888",cursor:"pointer"},bcSep:{color:"#444"},
main:{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",minHeight:0},
bottomNav:{display:"flex",background:"#161616",borderTop:"1px solid #222",flexShrink:0,paddingBottom:"34px",boxShadow:"0 200px 0 200px #161616"},
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


// ═════════════════════════════════════════════════════════════════════════
// IEL MODULE v2 — mirrors RCD structure exactly
// Sites → Areas → Category view → Items (machines)
// ═════════════════════════════════════════════════════════════════════════

// Storage keys
const K_IEL_PROJECTS = "iel-projects-v2";
const K_IEL_RESULTS  = "iel-results-v2";   // { siteId: { areaId: { cat: { itemId: {status,checks,notes,...} } } } }
const K_IEL_META     = "iel-meta-v2";
const K_IEL_HISTORY  = "iel-history-v2";

const IEL_CATEGORIES = [
  { key:"estops",    label:"E-Stops",   icon:"🔴", color:"#ef4444", desc:"Emergency stop buttons & devices" },
  { key:"lanyards",  label:"Lanyards",  icon:"🔗", color:"#10b981", desc:"Safety lanyards & fall arrest equipment" },
  { key:"isolators", label:"Isolators", icon:"⚡", color:"#f59e0b", desc:"Electrical isolators & lockout points" },
];
const IEL_TYPE_LABEL  = { estops:"Estop", lanyards:"Lanyard", isolators:"Isolator" };
const IEL_STATUS = { UNTESTED:"untested", PASS:"pass", FAIL:"fail", NA:"na" };
const IEL_SM = {
  untested: { label:"—",    bg:"#2a2a2a", fg:"#666",    border:"#333" },
  pass:     { label:"PASS", bg:"#1a3d1a", fg:"#4ade80", border:"#22c55e" },
  fail:     { label:"FAIL", bg:"#3d1a1a", fg:"#f87171", border:"#ef4444" },
  na:       { label:"N/A",  bg:"#1e2535", fg:"#64748b", border:"#334155" },
};

function ielUid()  { return Math.random().toString(36).slice(2,9); }
function ielSlug(s){ return s.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,20)+"-"+ielUid(); }
function isOverdue(d){ if(!d)return false; try{return new Date(d)<new Date();}catch(_){return false;} }
function isDueSoon(d){ if(!d)return false; try{const n=new Date(),tw=new Date(n.getTime()+14*864e5);const x=new Date(d);return x>=n&&x<=tw;}catch(_){return false;} }
function parseAUDate(val){
  if(!val)return"";const s=String(val).trim();
  const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m)return`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  if(/^\d+(\.\d+)?$/.test(s)){try{const d=new Date(Math.round((parseFloat(s)-25569)*86400*1000));if(!isNaN(d))return d.toISOString().slice(0,10);}catch(_){}}
  try{const d=new Date(s);if(!isNaN(d))return d.toISOString().slice(0,10);}catch(_){}
  return s;
}
function ielTypeToKey(t){
  if(!t)return null;const s=String(t).trim().toLowerCase();
  if(s.includes("lanyard"))return"lanyards";
  if(s.includes("estop")||s.includes("e-stop")||s.includes("e stop"))return"estops";
  if(s.includes("isolat"))return"isolators";
  return null;
}

// ─── IEL data helpers ────────────────────────────────────────────────────
function ielGetItem(results,siteId,areaId,cat,itemId){
  return((((results[siteId]||{})[areaId]||{})[cat]||{})[itemId])||{status:IEL_STATUS.UNTESTED,mechCheck:false,circuitIso:false,lanyardCond:false,notes:"",priority:"",rectified:"",lastTested:""};
}
function ielGetStatus(results,siteId,areaId,cat,itemId){
  return(ielGetItem(results,siteId,areaId,cat,itemId).status)||IEL_STATUS.UNTESTED;
}
function ielCatSummary(results,siteId,areaId,cat,items){
  let pass=0,fail=0,na=0,untested=0;
  items.forEach(id=>{const v=ielGetStatus(results,siteId,areaId,cat,id);if(v===IEL_STATUS.PASS)pass++;else if(v===IEL_STATUS.FAIL)fail++;else if(v===IEL_STATUS.NA)na++;else untested++;});
  return{pass,fail,na,untested};
}
function ielSiteSummary(results,project,cat){
  let pass=0,fail=0,na=0,untested=0;
  project.areas.forEach(a=>{
    // only look at the panel whose name matches cat
    const catPanel=a.panels.find(p=>p.name===cat);
    if(!catPanel)return;
    catPanel.circuits.forEach(id=>{
      const v=ielGetStatus(results,project.id,a.id,cat,id);
      if(v===IEL_STATUS.PASS)pass++;else if(v===IEL_STATUS.FAIL)fail++;else if(v===IEL_STATUS.NA)na++;else untested++;
    });
  });
  return{pass,fail,na,untested,total:pass+fail+na+untested};
}

// ─── IEL Excel helpers ────────────────────────────────────────────────────
const IEL_C={green:"FF10B981",white:"FFFFFFFF",darkGrey:"FF2D2D2D",lightGrey:"FFF5F5F5",midGrey:"FFD9D9D9",passWhite:"FFFFFFFF",failRed:"FFFFC7CE",naGrey:"FFF2F2F2",priorityU_bg:"FF9B0000",priorityU_font:"FFFFFFFF",priorityH_bg:"FFFFC7CE",priorityH_font:"FF9C0006",priorityM_bg:"FFFFD966",priorityM_font:"FF7F6000",priorityL_bg:"FFE2EFDA",priorityL_font:"FF375623"};
function ielBorder(s="thin",c=IEL_C.midGrey){return{style:s,color:{rgb:c}};}
function ielAllBorders(){const b=ielBorder();return{top:b,bottom:b,left:b,right:b};}
function ielBtm(){return{bottom:ielBorder("hair")};}
function ielCS(fill,font={},align={},borders={}){return{fill:{patternType:"solid",fgColor:{rgb:fill}},font:{name:"Calibri",sz:10,...font},alignment:{vertical:"center",...align},border:borders};}
function ielPriColor(p){if(p==="U")return{bg:IEL_C.priorityU_bg,font:IEL_C.priorityU_font,bold:true};if(p==="H")return{bg:IEL_C.priorityH_bg,font:IEL_C.priorityH_font,bold:false};if(p==="M")return{bg:IEL_C.priorityM_bg,font:IEL_C.priorityM_font,bold:false};if(p==="L")return{bg:IEL_C.priorityL_bg,font:IEL_C.priorityL_font,bold:false};return null;}
function ielDS(ri,pf,priority=""){if(priority){const pc=ielPriColor(priority);if(pc)return ielCS(pc.bg,{sz:9,color:{rgb:pc.font},bold:pc.bold},{wrapText:true},ielBtm());}let bg=ri%2===0?IEL_C.white:IEL_C.lightGrey,fontColor=IEL_C.darkGrey,bold=false;if(pf==="Pass")bg=IEL_C.passWhite;if(pf==="Fail"){bg=IEL_C.failRed;fontColor=IEL_C.priorityH_font;bold=true;}if(pf==="N/A")bg=IEL_C.naGrey;return ielCS(bg,{sz:9,color:{rgb:fontColor},bold},{wrapText:true},ielBtm());}
function ielSetCell(ws,ref,value,style){const t=typeof value==="number"?"n":"s";ws[ref]={v:value!=null?value:"",t,s:style};}

function exportIELExcel(project, results, meta) {
  const wb=XLSX.utils.book_new();
  const testDate=(meta&&meta.testDate)||"";
  const auditor=(meta&&meta.auditor)||"";
  const nextDue=addMonths(testDate,3);
  const sName=project.name||"Site";
  const headers=["Location","Type","Machine","Date","Mechanism / Reset Check","Circuit Isolation Verified","Lanyard Tension / Cond.","Pass / Fail","Rectified / Scheduled","Date Rectified / Scheduled","Defect ID","Responsibility","Notes / Recommendations","Priority (L,M,H,U)","Next Test Due (3 months)"];
  const n=headers.length;
  const cols="ABCDEFGHIJKLMNO".slice(0,n).split("");
  const titleSt=ielCS("FF2D2D2D",{bold:true,sz:14,color:{rgb:"FFFFFFFF"}},{horizontal:"left"});
  const subSt=ielCS("FF1E1E1E",{sz:9,color:{rgb:"FFbbbbbb"}},{horizontal:"left"});
  const metaSt=ielCS("FF262626",{sz:9,color:{rgb:"FF999999"}},{horizontal:"left"});
  const spaceSt=ielCS("FF1E1E1E");
  const hdrSt=ielCS(IEL_C.green,{bold:true,sz:10,color:{rgb:"FFFFFFFF"}},{horizontal:"center",wrapText:true},ielAllBorders());
  const rows=[];
  rows.push([`${sName} — Isolators, E-Stops & Lanyards Test`,...Array(n-1).fill("")]);
  rows.push([[project.company||'Vorick Group Asset Maintenance', project.abn?`ABN: ${project.abn}`:'', project.licence?`Electrical Licence: ${project.licence}`:''].filter(Boolean).join('  |  '),...Array(n-1).fill('')]);
  rows.push([`Auditor: ${auditor}`,"",`Date Tested: ${fmtDate(testDate)}`,"",`Next Test Due: ${nextDue}`,...Array(Math.max(0,n-5)).fill("")]);
  rows.push(Array(n).fill(""));
  rows.push(headers);
  const dataRows=[];
  const catOrder=["estops","lanyards","isolators"];
  // Organised by AREA first, then category within each area — no separator rows
  project.areas.forEach(area=>{
    catOrder.forEach(catKey=>{
      const catLabel=IEL_TYPE_LABEL[catKey]||catKey;
      const catPanel=area.panels.find(p=>p.name===catKey);
      if(!catPanel||!catPanel.circuits.length)return;
      catPanel.circuits.forEach(itemId=>{
        const machineName=(catPanel.machineNames||{})[itemId]||itemId;
        const item=(((results[area.id]||{})[catKey])||{})[itemId]||{status:IEL_STATUS.UNTESTED,mechCheck:false,circuitIso:false,lanyardCond:false,notes:"",priority:"",rectified:"",lastTested:""};
        const st=item.status||IEL_STATUS.UNTESTED;
        const pf=st===IEL_STATUS.PASS?"Pass":st===IEL_STATUS.FAIL?"Fail":st===IEL_STATUS.NA?"N/A":"Untested";
        const dueDate=item.lastTested?addMonths(item.lastTested,3):"";
        rows.push([
          area.name,catLabel,machineName,
          fmtDate(item.lastTested),
          item.mechCheck?"yes":"",
          item.circuitIso?"yes":"",
          catKey==="lanyards"?(item.lanyardCond?"yes":""):"",
          pf,
          item.rectified||"",item.scheduledDate?fmtDate(item.scheduledDate):"",
          item.defectId||"",item.responsibility||"",item.notes||"",item.priority||"",
          dueDate
        ]);
        dataRows.push({pf,priority:item.priority||""});
      });
    });
  });
  rows.push(Array(n).fill(""));
  rows.push([`Notes: ${(meta&&meta.notes)||""}`,...Array(n-1).fill("")]);
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:10},{wch:28},{wch:11},{wch:18},{wch:18},{wch:18},{wch:10},{wch:20},{wch:14},{wch:10},{wch:16},{wch:36},{wch:10},{wch:16}];
  ws["!rows"]=[{hpt:32},{hpt:16},{hpt:16},{hpt:6},{hpt:40}];
  ws["!merges"]=[{s:{r:0,c:0},e:{r:0,c:n-1}},{s:{r:1,c:0},e:{r:1,c:n-1}},{s:{r:2,c:0},e:{r:2,c:1}},{s:{r:2,c:2},e:{r:2,c:3}},{s:{r:2,c:4},e:{r:2,c:n-1}},{s:{r:3,c:0},e:{r:3,c:n-1}}];
  cols.forEach(col=>{ielSetCell(ws,`${col}1`,(ws[`${col}1`]||{}).v||"",titleSt);ielSetCell(ws,`${col}2`,(ws[`${col}2`]||{}).v||"",subSt);ielSetCell(ws,`${col}3`,(ws[`${col}3`]||{}).v||"",metaSt);ielSetCell(ws,`${col}4`,"",spaceSt);ielSetCell(ws,`${col}5`,(ws[`${col}5`]||{}).v||"",hdrSt);});
  let row=6;dataRows.forEach((dr,ri)=>{
    cols.forEach(col=>{const ref=`${col}${row}`;ielSetCell(ws,ref,(ws[ref]||{}).v||"",ielDS(ri,dr.pf,dr.priority));});
    row++;
  });
  XLSX.utils.book_append_sheet(wb,ws,"Isolators EStops Lanyards");
  const filename=`IEL_${sName.replace(/\s+/g,"_")}_${testDate||"export"}.xlsx`;
  const wbOut=XLSX.write(wb,{bookType:"xlsx",type:"base64",cellStyles:true,bookSST:false});
  if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.shareFile){
    window.webkit.messageHandlers.shareFile.postMessage({base64:wbOut,filename,mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }else{const link=document.createElement("a");link.href=`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbOut}`;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);}
}

// Import — same format as export
function parseIELExcel(data){
  const ws=data.Sheets[data.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  let headerIdx=-1;
  for(let i=0;i<Math.min(rows.length,10);i++){const r=rows[i].map(c=>String(c).toLowerCase());if(r.some(c=>c.includes("location"))&&r.some(c=>c.includes("type"))){headerIdx=i;break;}}
  if(headerIdx===-1)headerIdx=4;
  const header=rows[headerIdx].map(c=>String(c).toLowerCase().trim());
  const col=search=>header.findIndex(h=>h.includes(search));
  const cLoc=col("location"),cType=col("type"),cMachine=col("machine"),cDate=col("date");
  const cMech=header.findIndex(h=>h.includes("mechanism")||h.includes("reset"));
  const cCirc=header.findIndex(h=>h.includes("circuit")&&h.includes("iso"));
  const cLany=header.findIndex(h=>h.includes("lanyard")&&(h.includes("tension")||h.includes("cond")));
  const cPF=header.findIndex(h=>h.includes("pass")||h.includes("fail"));
  const cRect=header.findIndex(h=>h.includes("rectif")||h.includes("schedul"));
  const cDRect=header.findIndex((h,i)=>i>cRect&&(h.includes("date")||h.includes("schedul")));
  const cDef=col("defect"),cResp=col("responsib"),cNotes=header.findIndex(h=>h.includes("note")||h.includes("recommend")),cPri=col("priority");
  let siteName="",parsedCompany="",parsedAbn="",parsedLicence="";
  if(rows[0]&&rows[0][0]){const t=String(rows[0][0]);siteName=t.split(/\s*[-–]\s*/)[0].trim()||t;}
  // Company/ABN/licence live in row 2 (index 1), not the title row
  if(rows[1]&&rows[1][0]){
    const p=parseCompanyRow(rows[1][0]);
    // Only use as company if it doesn't look like a site/test title (no dates, no "test")
    const raw=String(rows[1][0]).toLowerCase();
    const looksLikeTitle=raw.includes(" test")||raw.includes("march")||raw.includes("april")||raw.includes("january")||raw.includes("february")||/\d{4}/.test(raw)&&!raw.includes("abn");
    if(!looksLikeTitle){parsedCompany=p.company||"";}
    parsedAbn=p.abn||"";
    parsedLicence=p.licence||"";
  }
  // Build areas from Location column, panels from area+type grouping, items = machines
  const areaMap={};
  for(let i=headerIdx+1;i<rows.length;i++){
    const row=rows[i];
    const typeRaw=cType>=0?String(row[cType]||"").trim():"";
    const catKey=ielTypeToKey(typeRaw);
    if(!catKey)continue;
    const location=cLoc>=0?String(row[cLoc]||"").trim():"General";
    const machine=cMachine>=0?String(row[cMachine]||"").trim():"";
    if(!machine)continue;
    if(!areaMap[location])areaMap[location]={};
    if(!areaMap[location][catKey])areaMap[location][catKey]=[];
    const itemId=ielUid();
    // Import structure only — all results start blank for a fresh audit
    areaMap[location][catKey].push({
      itemId,machine,
      data:{
        status:IEL_STATUS.UNTESTED,
        lastTested:"",
        mechCheck:false,
        circuitIso:false,
        lanyardCond:false,
        rectified:"",
        scheduledDate:"",
        defectId:"",
        responsibility:"",
        notes:"",
        priority:"",
      }
    });
  }
  // Build project structure: areas, panels (one per catKey), circuits (itemIds)
  // results: { [siteId]: { [areaId]: { [catKey]: { [itemId]: data } } } }
  const areas=Object.entries(areaMap).map(([aName,catMap])=>({
    id:ielSlug(aName),name:aName,
    panels:Object.entries(catMap).map(([catKey,itemArr])=>({
      id:ielSlug(catKey+"-"+aName),name:catKey,
      circuits:itemArr.map(i=>i.itemId),
      // store machine names on panel for display
      machineNames:Object.fromEntries(itemArr.map(i=>[i.itemId,i.machine])),
    }))
  }));
  // Flatten results
  const results={};
  const siteId=ielSlug(siteName||"site");
  results[siteId]={};
  Object.entries(areaMap).forEach(([aName,catMap])=>{
    const areaId=areas.find(a=>a.name===aName).id;
    results[siteId][areaId]={};
    Object.entries(catMap).forEach(([catKey,itemArr])=>{
      results[siteId][areaId][catKey]={};
      itemArr.forEach(({itemId,data})=>{results[siteId][areaId][catKey][itemId]=data;});
    });
  });
  return{siteName,siteId,areas,results,company:parsedCompany,abn:parsedAbn,licence:parsedLicence};
}

function downloadIELTemplate(){
  const wb=XLSX.utils.book_new();
  const rows=[
    ["Location","Type","Machine","Date","Mechanism / Reset Check","Circuit Isolation Verified","Lanyard Tension / Cond.","Pass / Fail","Rectified / Scheduled","Date Rectified / Scheduled","Defect ID","Responsibility","Notes / Recommendations","Priority (L,M,H,U)"],
    ["Area Name","Estop","Machine Name","","","","","","","","","","",""],
    ["Area Name","Lanyard","Machine Name","","","","","","","","","","",""],
    ["Area Name","Isolator","Machine Name","","","","","","","","","","",""],
  ];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:22},{wch:10},{wch:28},{wch:12},{wch:18},{wch:18},{wch:18},{wch:10},{wch:20},{wch:14},{wch:10},{wch:16},{wch:36},{wch:10}];
  XLSX.utils.book_append_sheet(wb,ws,"IEL Template");
  const tOut=XLSX.write(wb,{bookType:"xlsx",type:"base64"});
  if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.shareFile){
    window.webkit.messageHandlers.shareFile.postMessage({base64:tOut,filename:"IEL_Import_Template.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }else{const link=document.createElement("a");link.href=`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${tOut}`;link.download="IEL_Import_Template.xlsx";document.body.appendChild(link);link.click();document.body.removeChild(link);}
}

// ═════════════════════════════════════════════════════════════════════════
// IEL APP — mirrors RCD app structure exactly
// ═════════════════════════════════════════════════════════════════════════
function IELApp({ onGoHome }) {
  const [projects,      setProjects]     = React.useState([]);
  const [allResults,    setAllResults]   = React.useState({});
  const [allMeta,       setAllMeta]      = React.useState({});
  const [history,       setHistory]      = React.useState([]);
  const [loaded,        setLoaded]       = React.useState(false);
  const [saveFlash,     setSaveFlash]    = React.useState(false);
  const [activeProject, setActiveProject]= React.useState(null);
  const [activeCat,     setActiveCat]    = React.useState(null);
  const [auditEntered,  setAuditEntered] = React.useState(false); // "estops"|"lanyards"|"isolators"
  const [view,          setView]         = React.useState("projects"); // projects|home|audit|panel|manage|history|report
  const [activeAreaId,  setActiveAreaId] = React.useState(null);
  const [activePanelId, setActivePanelId]= React.useState(null);
  const [detailInfo,    setDetailInfo]   = React.useState(null); // {areaId,panelId,itemId}

  React.useEffect(()=>{
    var t=setTimeout(()=>setLoaded(true),3000);
    (async()=>{
      try{
        const[p,r,m,h]=await Promise.all([load(K_IEL_PROJECTS,[]),load(K_IEL_RESULTS,{}),load(K_IEL_META,{}),load(K_IEL_HISTORY,[])]);
        clearTimeout(t);setProjects(p);setAllResults(r);setAllMeta(m);setHistory(h);setLoaded(true);
      }catch(e){clearTimeout(t);setLoaded(true);}
    })();
  },[]);

  React.useEffect(()=>{if(loaded)save(K_IEL_PROJECTS,projects);},[projects,loaded]);
  React.useEffect(()=>{if(loaded){save(K_IEL_RESULTS,allResults);setSaveFlash(true);const t=setTimeout(()=>setSaveFlash(false),1200);return()=>clearTimeout(t);}},[allResults,loaded]);
  React.useEffect(()=>{if(loaded)save(K_IEL_META,allMeta);},[allMeta,loaded]);
  React.useEffect(()=>{if(loaded)save(K_IEL_HISTORY,history);},[history,loaded]);

  const project  = projects.find(p=>p.id===activeProject);
  const meta     = allMeta[activeProject]||{auditor:"",testDate:new Date().toISOString().slice(0,10),notes:""};
  const setMeta  = patch=>setAllMeta(prev=>({...prev,[activeProject]:{...meta,...patch}}));
  const area     = project&&project.areas.find(a=>a.id===activeAreaId);
  // panel here represents a category-panel (panel.name = catKey)
  const panel    = area&&area.panels.find(p=>p.id===activePanelId);
  const catInfo  = IEL_CATEGORIES.find(c=>c.key===activeCat)||IEL_CATEGORIES[0];

  const patchItem=(pid,aid,cat,itemId,patch)=>{
    setAllResults(prev=>{
      const old=((((prev[pid]||{})[aid]||{})[cat])||{})[itemId]||{};
      return{...prev,[pid]:{...prev[pid],[aid]:{...(prev[pid]||{})[aid],[cat]:{...((prev[pid]||{})[aid]||{})[cat],[itemId]:{...old,...patch}}}}};
    });
  };

  const archiveAudit=()=>{
    if(!project)return;
    const snap={id:ielUid(),projectId:activeProject,projectName:project.name,auditor:meta.auditor||"",testDate:meta.testDate||"",archivedAt:new Date().toISOString(),results:JSON.parse(JSON.stringify(allResults[activeProject]||{})),meta:{...meta}};
    setHistory(prev=>[snap,...prev].slice(0,100));
    return snap;
  };

  const goProjects=()=>{setView("projects");setActiveProject(null);setActiveCat(null);setActiveAreaId(null);setActivePanelId(null);setAuditEntered(false);};
  const goHome=()=>{setView("home");setActiveAreaId(null);setActivePanelId(null);};

  if(!loaded)return React.createElement('div',{style:SI.loader},React.createElement('div',{style:SI.loaderSpinner}),React.createElement('p',{style:{color:"#aaa",marginTop:16}},"Loading…"));

  const catColor = catInfo?catInfo.color:"#10b981";
  const isAudit  = view==="audit"||view==="panel";
  const summary  = project&&activeCat?ielSiteSummary(allResults,project,activeCat):{total:0,pass:0,fail:0,na:0,untested:0};
  const canGoBack= view!=="projects";

  const handleBack=()=>{
    if(view==="panel"){setView("audit");setActivePanelId(null);}
    else if(view==="audit"&&activePanelId){setActivePanelId(null);}
    else if(view==="audit"&&activeAreaId){setActiveAreaId(null);}
    else if(view==="audit"&&auditEntered&&!activeAreaId){setAuditEntered(false);}
    else if(view==="audit"&&!activeAreaId){setView("home");}
    else if(view==="home"){goProjects();}
    else if(["manage","report","history"].includes(view)){setView("home");}
    else goProjects();
  };

  return React.createElement('div',{style:SI.root}
    // ── Header
    ,React.createElement('header',{style:{...SI.topbar,borderBottom:`2px solid ${activeCat?catColor+"44":"#10b98144"}`}}
      ,React.createElement('div',{style:SI.topbarLeft}
        ,canGoBack&&React.createElement('button',{style:SI.backBtn,onClick:handleBack},"‹")
        ,React.createElement('div',null
          ,React.createElement('div',{style:SI.appTitle},"IEL TEST")
          ,React.createElement('div',{style:{...SI.appSub,color:activeCat?catColor:"#10b981"}},view==="projects"?"Site Select":project?project.name:"")
        )
      )
      ,React.createElement('div',{style:SI.topbarRight}
        ,React.createElement('div',{style:{...SI.saveIndicator,opacity:saveFlash?1:0}},"✓ Saved")
        ,activeCat&&project&&React.createElement(React.Fragment,null
          ,React.createElement(IELStatPill,{label:"PASS",val:summary.pass,col:"#22c55e"})
          ,React.createElement(IELStatPill,{label:"FAIL",val:summary.fail,col:"#ef4444"})
          ,React.createElement(IELStatPill,{label:"LEFT",val:summary.untested,col:"#f59e0b"})
        )
        ,React.createElement('button',{style:SI.homeModuleBtn,onClick:onGoHome},"⌂ Modules")
      )
    )

    // ── Breadcrumb
    ,view!=="projects"&&React.createElement('div',{style:SI.breadcrumb}
      ,React.createElement('span',{style:SI.bcItem,onClick:goProjects},"Sites")
      ,project&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:SI.bcItem,onClick:goHome},project.name))
      ,activeCat&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:{...SI.bcItem,color:catColor}},catInfo.label))
      ,activeAreaId&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:SI.bcItem,onClick:()=>{setView("audit");setActivePanelId(null);}},area&&area.name))
      ,activePanelId&&panel&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:{...SI.bcItem,color:catColor}},IEL_CATEGORIES.find(c=>c.key===panel.name)?.label||panel.name))
      ,view==="manage"&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:{...SI.bcItem,color:"#a855f7"}},"Manage"))
      ,view==="history"&&React.createElement(React.Fragment,null,React.createElement('span',{style:SI.bcSep},"›"),React.createElement('span',{style:{...SI.bcItem,color:"#f59e0b"}},"History"))
    )

    // ── Main
    ,React.createElement('main',{style:SI.main}
      ,view==="projects"&&React.createElement(IELProjectListView,{projects,allResults,onSelect:id=>{setActiveProject(id);setView("home");},onAddProject:(p,importedResults)=>{setProjects(prev=>[...prev,p]);if(importedResults)setAllResults(prev=>({...prev,[p.id]:importedResults}));},onDeleteProject:id=>{setProjects(prev=>prev.filter(p=>p.id!==id));setAllResults(prev=>{const n={...prev};delete n[id];return n;});if(activeProject===id)goProjects();}})
      ,view==="home"&&project&&React.createElement(IELProjectHomeView,{project,meta,setMeta,results:allResults,onStartCat:cat=>{setActiveCat(cat);setView("audit");setAuditEntered(true);},onReport:()=>setView("report"),onManage:()=>setView("manage"),onHistory:()=>setView("history"),onReset:()=>setAllResults(prev=>({...prev,[activeProject]:{}})),onExport:()=>exportIELExcel(project,allResults[activeProject]||{},meta),onArchive:archiveAudit,activeCatKey:activeCat,onCompleteAudit:()=>{archiveAudit();setAllResults(prev=>({...prev,[activeProject]:{}}));setAllMeta(prev=>({...prev,[activeProject]:{auditor:"",testDate:new Date().toISOString().slice(0,10),notes:""}}));setActiveCat(null);setAuditEntered(false);setActiveAreaId(null);setActivePanelId(null);}})
      ,isAudit&&project&&!auditEntered&&React.createElement(AuditGatePage,{color:activeCat?catColor:"#10b981",moduleLabel:"IEL TEST",auditLabel:activeCat?(IEL_CATEGORIES.find(c=>c.key===activeCat)||{label:activeCat}).label:"",hasActiveAudit:!!activeCat,onGoHome:goHome,onCompleteAudit:()=>{archiveAudit();setAllResults(prev=>({...prev,[activeProject]:{}}));setAllMeta(prev=>({...prev,[activeProject]:{auditor:"",testDate:new Date().toISOString().slice(0,10),notes:""}}));setActiveCat(null);setAuditEntered(false);setActiveAreaId(null);setActivePanelId(null);setView("home");},onEnterAudit:()=>setAuditEntered(true),isRCD:false})
      ,isAudit&&project&&auditEntered&&!activeAreaId&&React.createElement(IELAreaListView,{project,results:allResults,cat:activeCat,catColor,onSelect:id=>setActiveAreaId(id)})
      ,isAudit&&project&&auditEntered&&activeAreaId&&!activePanelId&&React.createElement(IELPanelListView,{area,project,results:allResults,cat:activeCat,catColor,onSelect:id=>{setActivePanelId(id);setView("panel");}})
      ,view==="panel"&&panel&&React.createElement(IELItemGrid,{area,panel,project,results:allResults,cat:activeCat,catColor,meta,onPatch:(itemId,patch)=>patchItem(activeProject,activeAreaId,activeCat,itemId,patch),onSetAll:(itemId,s)=>patchItem(activeProject,activeAreaId,activePanelId,itemId,{status:s}),onOpenDetail:itemId=>setDetailInfo({areaId:activeAreaId,panelId:activePanelId,itemId})})
      ,view==="report"&&project&&React.createElement(IELReportView,{project,results:allResults,meta,onExport:()=>exportIELExcel(project,allResults[activeProject]||{},meta),onArchive:archiveAudit})
      ,view==="manage"&&project&&React.createElement(IELManageView,{project,onUpdateProject:updated=>setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p))})
      ,view==="history"&&React.createElement(IELHistoryView,{history:history.filter(h=>h.projectId===activeProject),project,onDelete:id=>setHistory(prev=>prev.filter(h=>h.id!==id)),onExportSnap:snap=>exportIELExcel(project,snap.results||{},snap.meta||{}),
        onContinueFromSnap:(snap)=>{
          setAllResults(prev=>({...prev,[activeProject]:JSON.parse(JSON.stringify(snap.results||{}))}));
          setAllMeta(prev=>({...prev,[activeProject]:{...snap.meta}}));
          setActiveCat(null);
          setAuditEntered(false);
          setActiveAreaId(null);
          setActivePanelId(null);
          setView("home");
        }})
    )

    // ── Detail modal
    ,detailInfo&&project&&React.createElement(IELItemModal,{...detailInfo,project,cat:activeCat,results:allResults,meta,onPatch:patch=>patchItem(activeProject,detailInfo.areaId,activeCat,detailInfo.itemId,patch),onClose:()=>setDetailInfo(null)})

    // ── Bottom nav
    ,view!=="projects"&&React.createElement('nav',{style:SI.bottomNav}
      ,React.createElement(IELNavBtn,{icon:"⌂",label:"Home",active:view==="home",onClick:goHome})
      ,React.createElement(IELNavBtn,{icon:"☑",label:"Audit",active:isAudit,onClick:()=>{setView("audit");setActivePanelId(null);}})
      ,React.createElement(IELNavBtn,{icon:"≡",label:"Report",active:view==="report",onClick:()=>setView("report")})
      ,React.createElement(IELNavBtn,{icon:"🕐",label:"History",active:view==="history",color:"#f59e0b",onClick:()=>setView("history")})
      ,React.createElement(IELNavBtn,{icon:"⚙",label:"Manage",active:view==="manage",color:"#a855f7",onClick:()=>setView("manage")})
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL PROJECT LIST — with import
// ─────────────────────────────────────────────────────────────────────────
function IELProjectListView({projects,allResults,onSelect,onAddProject,onDeleteProject}){
  const[showAdd,setShowAdd]=React.useState(false);
  const[tab,setTab]=React.useState("manual");
  const[newName,setNewName]=React.useState("");
  const[newCo,setNewCo]=React.useState("");
  const[newAbn,setNewAbn]=React.useState("");
  const[newLic,setNewLic]=React.useState("");
  const[importAbn,setImportAbn]=React.useState("");
  const[importLic,setImportLic]=React.useState("");
  const[deleteId,setDeleteId]=React.useState(null);
  const[importing,setImporting]=React.useState(false);
  const[importPreview,setImportPreview]=React.useState(null);
  const[importName,setImportName]=React.useState("");
  const[importCo,setImportCo]=React.useState("");
  const[importError,setImportError]=React.useState("");
  const fileRef=React.useRef();

  const handleFile=e=>{
    const file=e.target.files[0];if(!file)return;
    setImporting(true);setImportError("");
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=XLSX.read(ev.target.result,{type:"array"});
        const parsed=parseIELExcel(data);
        setImportName(parsed.siteName||file.name.replace(/\.(xlsx|xls|csv)$/i,"").replace(/[_-]+/g," ").trim());
        setImportPreview(parsed);
        // Auto-fill company/ABN/licence from spreadsheet header if currently empty
        if(!importCo && parsed.company) setImportCo(parsed.company);
        if(!importAbn && parsed.abn) setImportAbn(parsed.abn);
        if(!importLic && parsed.licence) setImportLic(parsed.licence);
      }catch(err){setImportError("Could not parse file: "+err.message);}
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  };

  const confirmImport=()=>{
    if(!importPreview)return;
    const sName=importName.trim()||importPreview.siteName||"Imported Site";
    const proj={id:importPreview.siteId,name:sName,company:importCo.trim(),abn:importAbn.trim(),licence:importLic.trim(),areas:importPreview.areas};
    onAddProject(proj,importPreview.results[importPreview.siteId]||{});
    setImportPreview(null);setShowAdd(false);setImportName("");setImportCo("");setImportError("");
  };

  return React.createElement('div',{style:SI.listWrap}
    ,React.createElement('div',{style:SI.brandBlock}
      ,React.createElement('div',{style:SI.brandTitle},"VORICK GROUP")
      ,React.createElement('div',{style:SI.brandSub},"IEL Test Management")
    )
    ,React.createElement('div',{style:{...SI.listTitle,marginTop:24}},"Sites")
    ,projects.length===0&&React.createElement('div',{style:{color:"#555",fontSize:14,marginBottom:16}},"No sites yet — add one or import from Excel below.")
    ,projects.map(proj=>{
      let total=0,tested=0,fails=0;
      IEL_CATEGORIES.forEach(cat=>{
        proj.areas.forEach(a=>a.panels.forEach(p=>{
          if(p.name===cat.key)p.circuits.forEach(id=>{
            total++;
            const st=ielGetStatus(allResults,proj.id,a.id,cat.key,id);
            if(st!==IEL_STATUS.UNTESTED)tested++;
            if(st===IEL_STATUS.FAIL)fails++;
          });
        }));
      });
      const pct=total>0?Math.round((tested/total)*100):0;
      return React.createElement('div',{key:proj.id,style:{...SI.siteCard,flexDirection:"column",gap:0,padding:0,overflow:"hidden"}}
        ,React.createElement('button',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"16px 18px",color:"inherit",textAlign:"left"},onClick:()=>onSelect(proj.id)}
          ,React.createElement('div',{style:{flex:1}}
            ,React.createElement('div',{style:SI.siteCardName},proj.name)
            ,React.createElement('div',{style:SI.siteCardSub},proj.company?proj.company+" · ":"" ,proj.areas.length," areas · ",total," items · 3-month cycle")
            ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
              ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:fails>0?"#ef4444":tested===total&&total>0?"#22c55e":"#10b981",transition:"width 0.4s"}})
            )
            ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:4}},tested," / ",total," tested")
          )
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginLeft:16}}
            ,fails>0&&React.createElement('span',{style:SI.failBadge},fails," FAIL")
            ,React.createElement('span',{style:SI.arrow},"›")
          )
        )
        ,deleteId===proj.id
          ?React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,padding:"8px 18px",background:"#1e1010",borderTop:"1px solid #333"}}
            ,React.createElement('span',{style:{fontSize:12,color:"#ef4444",flex:1}},'Delete "',proj.name,'"?')
            ,React.createElement('button',{style:SI.confirmYes,onClick:()=>{onDeleteProject(proj.id);setDeleteId(null);}},"Delete")
            ,React.createElement('button',{style:SI.confirmNo,onClick:()=>setDeleteId(null)},"Cancel")
          )
          :React.createElement('button',{style:{background:"transparent",border:"none",borderTop:"1px solid #2a2a2a",color:"#555",fontSize:11,padding:"6px 18px",cursor:"pointer",textAlign:"left",width:"100%"},onClick:e=>{e.stopPropagation();setDeleteId(proj.id);}},"🗑 Remove site")
      );
    })
    ,showAdd
      ?React.createElement('div',{style:SI.addCard}
        ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:14}}
          ,React.createElement('button',{style:{...SI.tabBtn,...(tab==="manual"?SI.tabBtnActive:{})},onClick:()=>setTab("manual")},"✏️ Manual Entry")
          ,React.createElement('button',{style:{...SI.tabBtn,...(tab==="import"?SI.tabBtnActive:{})},onClick:()=>setTab("import")},"📥 Import Excel")
        )
        ,tab==="manual"&&React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:"#eee",marginBottom:12}},"New Site")
          ,React.createElement('div',{style:{marginBottom:8}}
            ,React.createElement('div',{style:SI.metaLabelText},"SITE NAME")
            ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:newName,placeholder:"Site name",onChange:e=>setNewName(e.target.value)})
          )
          ,React.createElement('div',{style:{marginBottom:10}}
            ,React.createElement('div',{style:SI.metaLabelText},"COMPANY")
            ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:newCo,placeholder:"Company name",onChange:e=>setNewCo(e.target.value)})
          )
          ,React.createElement('div',{style:{marginBottom:8}}
            ,React.createElement('div',{style:SI.metaLabelText},"ABN (optional)")
            ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:newAbn,placeholder:"e.g. 12 345 678 901",onChange:e=>setNewAbn(e.target.value)})
          )
          ,React.createElement('div',{style:{marginBottom:10}}
            ,React.createElement('div',{style:SI.metaLabelText},"ELECTRICAL LICENCE (optional)")
            ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:newLic,placeholder:"e.g. 123456C",onChange:e=>setNewLic(e.target.value)})
          )
          ,React.createElement('div',{style:{display:"flex",gap:8}}
            ,React.createElement('button',{style:SI.ctaPrimary,onClick:()=>{if(!newName.trim())return;onAddProject({id:ielSlug(newName),name:newName.trim(),company:newCo.trim(),abn:newAbn.trim(),licence:newLic.trim(),areas:[]},{});setNewName("");setNewCo("");setNewAbn("");setNewLic("");setShowAdd(false);}},"Add Site")
            ,React.createElement('button',{style:SI.ctaSecondary,onClick:()=>setShowAdd(false)},"Cancel")
          )
        )
        ,tab==="import"&&React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:"#eee",marginBottom:4}},"Import from Excel")
          ,React.createElement('div',{style:{fontSize:12,color:"#666",marginBottom:12}},"Upload your IEL spreadsheet. Columns needed: ",React.createElement('strong',{style:{color:"#aaa"}},"Location | Type | Machine")," — all 3 categories imported from one sheet. Areas are built from Location column.")
          ,!importPreview&&React.createElement(React.Fragment,null
            ,React.createElement('input',{ref:fileRef,type:"file",accept:".xlsx,.xls,.csv",style:{display:"none"},onChange:handleFile})
            ,React.createElement('button',{style:{...SI.ctaPrimary,width:"100%",marginBottom:8},onClick:()=>fileRef.current&&fileRef.current.click()},importing?"Parsing…":"📂 Choose Excel / CSV File")
            ,React.createElement('button',{style:{...SI.ctaSecondary,width:"100%",fontSize:12},onClick:downloadIELTemplate},"↓ Download Import Template")
            ,importError&&React.createElement('div',{style:{color:"#f87171",fontSize:12,marginTop:8}},importError)
          )
          ,importPreview&&React.createElement(React.Fragment,null
            ,React.createElement('div',{style:{background:"#0e1a0e",border:"1px solid #10b98144",borderRadius:10,padding:"12px",marginBottom:12}}
              ,React.createElement('div',{style:{fontSize:12,fontWeight:700,color:"#10b981",marginBottom:8}},"✓ Preview")
              ,React.createElement('div',{style:{fontSize:12,color:"#aaa",marginBottom:4}},importPreview.areas.length," areas — ",importPreview.areas.reduce((s,a)=>s+a.panels.reduce((ss,p)=>ss+p.circuits.length,0),0)," total items")
              ,importPreview.areas.slice(0,4).map(a=>React.createElement('div',{key:a.id,style:{fontSize:11,color:"#666",marginBottom:2}},a.name," — ",a.panels.reduce((s,p)=>s+p.circuits.length,0)," items"))
              ,importPreview.areas.length>4&&React.createElement('div',{style:{fontSize:11,color:"#555"}},"…and ",importPreview.areas.length-4," more areas")
            )
            ,React.createElement('div',{style:{marginBottom:8}}
              ,React.createElement('div',{style:SI.metaLabelText},"SITE NAME")
              ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:importName,placeholder:"Site name",onChange:e=>setImportName(e.target.value)})
            )
            ,React.createElement('div',{style:{marginBottom:8}}
              ,React.createElement('div',{style:SI.metaLabelText},"COMPANY (optional)")
              ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:importCo,placeholder:"Company name",onChange:e=>setImportCo(e.target.value)})
            )
            ,React.createElement('div',{style:{marginBottom:8}}
              ,React.createElement('div',{style:SI.metaLabelText},"ABN (optional)")
              ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:importAbn,placeholder:"e.g. 12 345 678 901",onChange:e=>setImportAbn(e.target.value)})
            )
            ,React.createElement('div',{style:{marginBottom:10}}
              ,React.createElement('div',{style:SI.metaLabelText},"ELECTRICAL LICENCE (optional)")
              ,React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:importLic,placeholder:"e.g. 123456C",onChange:e=>setImportLic(e.target.value)})
            )
            ,React.createElement('div',{style:{display:"flex",gap:8}}
              ,React.createElement('button',{style:SI.ctaPrimary,onClick:confirmImport},"✓ Import Site")
              ,React.createElement('button',{style:SI.ctaSecondary,onClick:()=>setImportPreview(null)},"Re-upload")
              ,React.createElement('button',{style:SI.ctaSecondary,onClick:()=>setShowAdd(false)},"Cancel")
            )
          )
        )
      )
      :React.createElement('button',{style:{...SI.ctaPrimary,width:"100%",marginTop:8},onClick:()=>setShowAdd(true)},"+ Add / Import Site")
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL PROJECT HOME — auditor gate + category selection (mirrors ProjectHomeView)
// ─────────────────────────────────────────────────────────────────────────
function IELProjectHomeView({project,meta,setMeta,results,onStartCat,onReport,onManage,onHistory,onReset,onExport,onArchive,onCompleteAudit,activeCatKey}){
  const[showExports,setShowExports]=React.useState(false);
  const[confirmReset,setConfirmReset]=React.useState(false);
  const[archiveMsg,setArchiveMsg]=React.useState("");
  const hasAuditor=!!(meta.auditor&&meta.auditor.trim());
  const handleArchive=()=>{onArchive();setArchiveMsg("Audit archived!");setTimeout(()=>setArchiveMsg(""),2500);};
  return React.createElement('div',{style:SI.homeWrap}
    ,React.createElement('div',{style:SI.brandBlock}
      ,React.createElement('div',{style:SI.brandTitle},"VORICK GROUP")
      ,React.createElement('div',{style:SI.brandSub},"Asset Maintenance")
    )
    ,React.createElement('div',{style:SI.siteTitle},project.name)
    ,React.createElement('div',{style:SI.siteSub},"IEL Test Management — 3-month cycle")
    ,React.createElement('div',{style:SI.metaCard}
      ,React.createElement('div',{style:{marginBottom:10}}
        ,React.createElement('div',{style:SI.metaLabelText},"AUDITOR")
        ,React.createElement('input',{style:{...SI.metaInput,marginTop:4,borderColor:!hasAuditor?"#ef4444":"#333"},value:meta.auditor||"",placeholder:"Enter name to begin audit…",onChange:e=>setMeta({auditor:e.target.value})})
        ,!hasAuditor&&React.createElement('div',{style:{fontSize:11,color:"#ef4444",marginTop:4}},"⚠ Auditor name required before starting a test")
      )
      ,React.createElement('div',{style:{marginBottom:8}}
        ,React.createElement('div',{style:SI.metaLabelText},"TEST DATE")
        ,React.createElement('input',{style:{...SI.metaInput,marginTop:4,display:"block",width:"100%"},type:"date",value:meta.testDate||"",onChange:e=>setMeta({testDate:e.target.value})})
      )
      ,meta.testDate&&React.createElement('div',{style:{...SI.duePill,borderColor:"#10b98155",color:"#10b981",display:"inline-block",marginTop:4,marginBottom:4}},"Next due: ",React.createElement('strong',null,addMonths(meta.testDate,3)))
    )
    ,React.createElement('div',{style:SI.modeSelectLabel},"SELECT TEST CATEGORY")
    ,IEL_CATEGORIES.map(cat=>{
      const sum=ielSiteSummary(results,project,cat.key);
      const pct=sum.total>0?Math.round(((sum.pass+sum.na)/sum.total)*100):0;
      return React.createElement('button',{key:cat.key,
        style:{...SI.catBtn,borderColor:`${cat.color}${hasAuditor?"88":"33"}`,opacity:hasAuditor?1:0.5,cursor:hasAuditor?"pointer":"not-allowed"},
        onClick:()=>hasAuditor&&onStartCat(cat.key)}
        ,React.createElement('span',{style:{fontSize:28,marginRight:4}},cat.icon)
        ,React.createElement('div',{style:{flex:1,textAlign:"left"}}
          ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:hasAuditor?cat.color:"#555",letterSpacing:0.3}},cat.label)
          ,React.createElement('div',{style:{fontSize:11,color:"#666",marginTop:1}},cat.desc)
          ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:6,overflow:"hidden"}}
            ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:sum.fail>0?"#ef4444":cat.color,transition:"width 0.4s"}})
          )
          ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}
            ,sum.pass>0&&React.createElement('span',{style:{fontSize:11,color:"#22c55e"}},sum.pass," Pass")
            ,sum.fail>0&&React.createElement('span',{style:{fontSize:11,color:"#ef4444",fontWeight:800}},sum.fail," FAIL")
            ,sum.untested>0&&React.createElement('span',{style:{fontSize:11,color:"#f59e0b"}},sum.untested," untested")
            ,React.createElement('span',{style:{fontSize:11,color:"#555"}},sum.total," total")
          )
        )
        ,React.createElement('span',{style:{fontSize:22,color:hasAuditor?cat.color+"88":"#444"}},"›")
      );
    })
    ,React.createElement('div',{style:{width:"100%",maxWidth:500,background:"#161616",border:`1px solid ${activeCatKey?"#10b98144":"#2a2a2a"}`,borderRadius:12,padding:"10px 14px"}}
      ,React.createElement('div',{style:{fontSize:10,color:"#555",fontWeight:700,letterSpacing:0.8,marginBottom:8}},activeCatKey?"COMPLETE ACTIVE AUDIT":"ARCHIVE COMPLETED AUDIT")
      ,activeCatKey&&React.createElement(CompleteAuditBtn,{color:(IEL_CATEGORIES.find(c=>c.key===activeCatKey)||{color:"#10b981"}).color,label:"✓ Complete & Archive IEL Audit",onComplete:onCompleteAudit})
      ,!activeCatKey&&React.createElement('button',{style:{...SI.smallBtn,width:"100%",color:"#10b981",borderColor:"#10b98144",padding:"8px"},onClick:handleArchive},"📁 Archive IEL Audit")
      ,archiveMsg&&React.createElement('div',{style:{fontSize:12,color:"#4ade80",marginTop:6,textAlign:"center"}},"✓ ",archiveMsg)
    )
    ,React.createElement('div',{style:{width:"100%",maxWidth:500,display:"flex",gap:8,flexWrap:"wrap"}}
      ,React.createElement('button',{style:{...SI.secondaryBtn,flex:1},onClick:onReport},"≡ Report")
      ,React.createElement('button',{style:{...SI.secondaryBtn,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"},onClick:onHistory},"🕐 History")
      ,React.createElement('button',{style:{...SI.secondaryBtn,flex:1,color:"#a855f7",borderColor:"#a855f744"},onClick:onManage},"⚙ Structure")
      ,React.createElement('button',{style:{...SI.secondaryBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"},onClick:()=>setShowExports(x=>!x)},"↓ Export")
    )
    ,showExports&&React.createElement('button',{style:{...SI.exportBtn,width:"100%",maxWidth:500,color:"#10b981",borderColor:"#10b98144",background:"#0a1a12"},onClick:onExport},"↓ Export IEL xlsx (All Categories)")
    ,confirmReset
      ?React.createElement('div',{style:SI.confirmRow},React.createElement('span',{style:{color:"#ef4444",fontSize:13}},"Reset all results?"),React.createElement('button',{style:SI.confirmYes,onClick:()=>{onReset();setConfirmReset(false);}},"Yes"),React.createElement('button',{style:SI.confirmNo,onClick:()=>setConfirmReset(false)},"Cancel"))
      :React.createElement('button',{style:{background:"transparent",border:"none",color:"#555",fontSize:12,cursor:"pointer",textDecoration:"underline"},onClick:()=>setConfirmReset(true)},"Reset all test results")
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL AREA LIST (mirrors AreaListView)
// ─────────────────────────────────────────────────────────────────────────
function IELAreaListView({project,results,cat,catColor,onSelect}){
  return React.createElement('div',{style:SI.listWrap}
    ,React.createElement('div',{style:SI.listTitle},"Select Area")
    ,project.areas.length===0&&React.createElement('div',{style:{color:"#555",fontSize:14}},"No areas. Go to ⚙ Manage to add areas.")
    ,project.areas.map(area=>{
      // Only count panels for this cat
      const catPanel=area.panels.find(p=>p.name===cat);
      const items=catPanel?catPanel.circuits:[];
      let pass=0,fail=0,untested=0;
      items.forEach(id=>{const v=ielGetStatus(results,project.id,area.id,cat,id);if(v===IEL_STATUS.PASS||v===IEL_STATUS.NA)pass++;else if(v===IEL_STATUS.FAIL)fail++;else untested++;});
      const total=items.length;
      const pct=total>0?Math.round((pass/total)*100):0;
      return React.createElement('button',{key:area.id,style:{...SI.siteCard,...(fail>0?{background:"#1e1010",borderColor:"#ef444455"}:{})},onClick:()=>onSelect(area.id)}
        ,React.createElement('div',{style:SI.siteCardLeft}
          ,React.createElement('div',{style:SI.siteCardName},area.name)
          ,React.createElement('div',{style:SI.siteCardSub},total," items")
          ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
            ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:fail>0?"#ef4444":untested>0?catColor:"#22c55e"}})
          )
        )
        ,React.createElement('div',{style:SI.siteCardRight}
          ,fail>0&&React.createElement('span',{style:SI.failBadge},fail," FAIL")
          ,untested>0&&React.createElement('span',{style:{fontSize:11,fontWeight:700,color:"#fbbf24",background:"#2a1e00",borderRadius:6,padding:"3px 8px"}},untested)
          ,React.createElement('span',{style:SI.arrow},"›")
        )
      );
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL PANEL LIST — shows the category's items in the area (mirrors PanelListView)
// Here "panel" = the category panel within an area
// ─────────────────────────────────────────────────────────────────────────
function IELPanelListView({area,project,results,cat,catColor,onSelect}){
  const catPanel=area.panels.find(p=>p.name===cat);
  if(!catPanel)return React.createElement('div',{style:SI.listWrap},React.createElement('div',{style:{color:"#555",fontSize:14}},"No items for this category in ",area.name,". Add items via ⚙ Manage."));
  // Group items by their panel — for IEL the panel IS the catPanel, circuits are items
  // But to mirror RCD which has panels inside areas, we show one "panel" card for the cat
  const items=catPanel.circuits;
  const s=ielCatSummary(results,project.id,area.id,cat,items);
  const catI=IEL_CATEGORIES.find(c=>c.key===cat)||IEL_CATEGORIES[0];
  return React.createElement('div',{style:SI.listWrap}
    ,React.createElement('div',{style:SI.listTitle},area.name)
    ,React.createElement('button',{style:{...SI.siteCard,...(s.fail>0?{background:"#1e1010",borderColor:"#ef444455"}:s.untested===0?{background:"#0e1e0e",borderColor:"#22c55e55"}:{})},onClick:()=>onSelect(catPanel.id)}
      ,React.createElement('div',{style:SI.siteCardLeft}
        ,React.createElement('div',{style:SI.siteCardName},catI.icon," ",catI.label)
        ,React.createElement('div',{style:SI.siteCardSub},items.length," item",items.length!==1?"s":"")
        ,React.createElement('div',{style:{display:"flex",gap:6,marginTop:6}}
          ,s.pass>0&&React.createElement('span',{style:{fontSize:11,color:"#22c55e",background:"#22c55e22",borderRadius:4,padding:"1px 6px",fontWeight:700}},s.pass," Pass")
          ,s.fail>0&&React.createElement('span',{style:{fontSize:11,color:"#f87171",background:"#f8717122",borderRadius:4,padding:"1px 6px",fontWeight:700}},s.fail," Fail")
          ,s.untested>0&&React.createElement('span',{style:{fontSize:11,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"1px 6px",fontWeight:700}},s.untested," untested")
        )
      )
      ,React.createElement('div',{style:SI.siteCardRight}
        ,s.fail>0&&React.createElement('span',{style:SI.failBadge},"FAIL")
        ,s.untested===0&&s.fail===0&&React.createElement('span',{style:{color:"#4ade80",fontSize:18,fontWeight:800}},"✓")
        ,React.createElement('span',{style:SI.arrow},"›")
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL ITEM GRID — mirrors CircuitGrid, items = machines
// ─────────────────────────────────────────────────────────────────────────
function IELItemGrid({area,panel,project,results,cat,catColor,meta,onPatch,onSetAll,onOpenDetail}){
  const items=panel.circuits;
  const machineNames=panel.machineNames||{};
  const s=ielCatSummary(results,project.id,area.id,cat,items);
  const catI=IEL_CATEGORIES.find(c=>c.key===cat)||IEL_CATEGORIES[0];
  return React.createElement('div',{style:SI.circuitWrap}
    ,React.createElement('div',{style:SI.panelHeader}
      ,React.createElement('div',null
        ,React.createElement('div',{style:SI.panelTitle},catI.icon," ",catI.label)
        ,React.createElement('div',{style:SI.panelSub},area.name," · ",items.length," item",items.length!==1?"s":"")
      )
      ,React.createElement('div',{style:SI.panelStats}
        ,React.createElement('span',{style:{color:"#22c55e"}},s.pass,"P")
        ,React.createElement('span',{style:{color:"#ef4444"}},s.fail,"F")
        ,React.createElement('span',{style:{color:"#f59e0b",fontSize:12}},s.untested," untested")
      )
    )
    ,React.createElement('div',{style:{fontSize:12,color:catColor,background:"#0a1a10",border:`1px solid ${catColor}33`,borderRadius:8,padding:"8px 12px",marginBottom:12}},catI.icon," Tap any item to open the test form")
    ,items.length===0&&React.createElement('div',{style:{color:"#555",fontSize:13}},"No items. Go to ⚙ Manage to add items.")
    ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8}}
      ,items.map(itemId=>{
        const d=ielGetItem(results,project.id,area.id,cat,itemId);
        const st=d.status||IEL_STATUS.UNTESTED;
        const sm=IEL_SM[st]||IEL_SM.untested;
        const machineName=machineNames[itemId]||itemId;
        const nextDue=d.lastTested?addMonths(d.lastTested,3):null;
        const overdue=nextDue&&isOverdue(nextDue);
        const dueSoon=nextDue&&!overdue&&isDueSoon(nextDue);
        const hasNote=!!(d.notes);
        return React.createElement('div',{key:itemId,style:{display:"flex",alignItems:"stretch",background:sm.bg,border:`2px solid ${sm.border}`,borderRadius:12,overflow:"hidden",cursor:"pointer",boxShadow:st!==IEL_STATUS.UNTESTED?`0 0 10px ${sm.border}44`:"none"},onClick:()=>onOpenDetail(itemId)}
          ,React.createElement('div',{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 4px",borderRight:`1px solid ${sm.border}44`}}
            ,React.createElement('div',{style:{fontSize:11,fontWeight:800,color:sm.fg,letterSpacing:0.5}},sm.label)
          )
          ,React.createElement('div',{style:{flex:1,padding:"12px 14px",minWidth:0}}
            ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}
              ,React.createElement('span',{style:{fontSize:14,fontWeight:800,color:"#eee"}},machineName)
              ,overdue&&React.createElement('span',{style:{fontSize:10,fontWeight:800,color:"#ef4444",background:"#3d1a1a",borderRadius:4,padding:"1px 6px",border:"1px solid #ef444455"}},"OVERDUE")
              ,dueSoon&&React.createElement('span',{style:{fontSize:10,fontWeight:700,color:"#f59e0b",background:"#2a1e00",borderRadius:4,padding:"1px 6px"}},"DUE SOON")
            )
            ,React.createElement('div',{style:{display:"flex",gap:10,marginTop:4,fontSize:11,color:"#555",flexWrap:"wrap"}}
              ,d.lastTested&&React.createElement('span',null,"Tested: ",fmtDate(d.lastTested))
              ,nextDue&&React.createElement('span',{style:{color:overdue?"#ef4444":dueSoon?"#f59e0b":"#555"}},"Due: ",nextDue)
            )
            ,React.createElement('div',{style:{display:"flex",gap:6,marginTop:6}}
              ,React.createElement('span',{style:{fontSize:10,color:d.mechCheck?"#22c55e":"#444",fontWeight:600}},d.mechCheck?"✓":"○"," Mech")
              ,React.createElement('span',{style:{fontSize:10,color:d.circuitIso?"#22c55e":"#444",fontWeight:600}},d.circuitIso?"✓":"○"," Circuit")
              ,cat==="lanyards"&&React.createElement('span',{style:{fontSize:10,color:d.lanyardCond?"#22c55e":"#444",fontWeight:600}},d.lanyardCond?"✓":"○"," Lanyard")
            )
            ,hasNote&&React.createElement('div',{style:{fontSize:10,color:"#e8731a",marginTop:3}},"✎ ",d.notes.slice(0,40),d.notes.length>40?"…":"")
          )
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",padding:"0 12px",color:"#555",fontSize:20}},"›")
        );
      })
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL ITEM MODAL — test form with checkboxes (core testing interface)
// ─────────────────────────────────────────────────────────────────────────
function IELItemModal({areaId,panelId,itemId,project,cat,results,meta,onPatch,onClose}){
  const area=project.areas.find(a=>a.id===areaId);
  const panel=area&&area.panels.find(p=>p.id===panelId);
  const machineNames=panel&&panel.machineNames||{};
  const machineName=machineNames[itemId]||itemId;
  const item=ielGetItem(results,project.id,areaId,cat,itemId);
  const catI=IEL_CATEGORIES.find(c=>c.key===cat)||IEL_CATEGORIES[0];
  const isLanyard=cat==="lanyards";

  // Determine if checks allow pass
  const requiredChecks=isLanyard?["mechCheck","circuitIso","lanyardCond"]:["mechCheck","circuitIso"];
  const allChecked=requiredChecks.every(k=>item[k]);

  const patch=p=>onPatch({...p});

  const toggleCheck=key=>{
    const newVal=!item[key];
    const updated={...item,[key]:newVal};
    // If any required check is unchecked, downgrade pass to untested
    const stillAllChecked=requiredChecks.every(k=>updated[k]);
    const newStatus=!stillAllChecked&&updated.status===IEL_STATUS.PASS?IEL_STATUS.UNTESTED:updated.status;
    onPatch({[key]:newVal,status:newStatus});
  };

  const setStatus=s=>{
    if(s===IEL_STATUS.PASS&&!allChecked)return; // blocked
    const testDate=meta.testDate||new Date().toISOString().slice(0,10);
    onPatch({status:s,...(s===IEL_STATUS.PASS||s===IEL_STATUS.FAIL?{lastTested:testDate}:{})});
  };

  const nextDue=item.lastTested?addMonths(item.lastTested,3):null;
  const overdue=nextDue&&isOverdue(nextDue);
  const sm=IEL_SM[item.status||IEL_STATUS.UNTESTED]||IEL_SM.untested;

  return React.createElement('div',{style:SI.modalOverlay,onClick:onClose}
    ,React.createElement('div',{style:SI.modalBox,onClick:e=>e.stopPropagation()}
      // Header
      ,React.createElement('div',{style:SI.modalHeader}
        ,React.createElement('div',null
          ,React.createElement('div',{style:{fontSize:18,fontWeight:800,color:"#eee"}},catI.icon," ",machineName)
          ,React.createElement('div',{style:{fontSize:12,color:"#666",marginTop:3}},catI.label," · ",area&&area.name," · 3-month cycle")
        )
        ,React.createElement('div',{style:{padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:800,background:sm.bg,color:sm.fg,border:`1.5px solid ${sm.border}`}},sm.label)
      )

      // ── CHECKS ────────────────────────────────────────────────────────
      ,React.createElement('div',{style:{marginBottom:16}}
        ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:8}},"INSPECTION CHECKS")
        ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8}}
          // Mechanism / Reset Check
          ,React.createElement('button',{
            style:{display:"flex",alignItems:"center",gap:12,padding:"14px",background:item.mechCheck?"#1a3d1a":"#1a1a1a",border:`2px solid ${item.mechCheck?"#22c55e":"#333"}`,borderRadius:12,cursor:"pointer",color:"#eee",textAlign:"left"},
            onClick:()=>toggleCheck("mechCheck")}
            ,React.createElement('div',{style:{width:28,height:28,borderRadius:6,background:item.mechCheck?"#22c55e":"#2a2a2a",border:`2px solid ${item.mechCheck?"#22c55e":"#444"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
              ,item.mechCheck&&React.createElement('span',{style:{color:"#fff",fontSize:16,fontWeight:900}},"✓")
            )
            ,React.createElement('div',null
              ,React.createElement('div',{style:{fontSize:14,fontWeight:700,color:item.mechCheck?"#4ade80":"#aaa"}},"Mechanism / Reset Check")
              ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Verify mechanism operates correctly & resets properly")
            )
          )
          // Circuit Isolation Verified
          ,React.createElement('button',{
            style:{display:"flex",alignItems:"center",gap:12,padding:"14px",background:item.circuitIso?"#1a3d1a":"#1a1a1a",border:`2px solid ${item.circuitIso?"#22c55e":"#333"}`,borderRadius:12,cursor:"pointer",color:"#eee",textAlign:"left"},
            onClick:()=>toggleCheck("circuitIso")}
            ,React.createElement('div',{style:{width:28,height:28,borderRadius:6,background:item.circuitIso?"#22c55e":"#2a2a2a",border:`2px solid ${item.circuitIso?"#22c55e":"#444"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
              ,item.circuitIso&&React.createElement('span',{style:{color:"#fff",fontSize:16,fontWeight:900}},"✓")
            )
            ,React.createElement('div',null
              ,React.createElement('div',{style:{fontSize:14,fontWeight:700,color:item.circuitIso?"#4ade80":"#aaa"}},"Circuit Isolation Verified")
              ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Confirm circuit is correctly isolated when activated")
            )
          )
          // Lanyard Tension / Condition — only for Lanyards
          ,isLanyard&&React.createElement('button',{
            style:{display:"flex",alignItems:"center",gap:12,padding:"14px",background:item.lanyardCond?"#1a3d1a":"#1a1a1a",border:`2px solid ${item.lanyardCond?"#22c55e":"#333"}`,borderRadius:12,cursor:"pointer",color:"#eee",textAlign:"left"},
            onClick:()=>toggleCheck("lanyardCond")}
            ,React.createElement('div',{style:{width:28,height:28,borderRadius:6,background:item.lanyardCond?"#22c55e":"#2a2a2a",border:`2px solid ${item.lanyardCond?"#22c55e":"#444"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
              ,item.lanyardCond&&React.createElement('span',{style:{color:"#fff",fontSize:16,fontWeight:900}},"✓")
            )
            ,React.createElement('div',null
              ,React.createElement('div',{style:{fontSize:14,fontWeight:700,color:item.lanyardCond?"#4ade80":"#aaa"}},"Lanyard Tension / Condition")
              ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Check tension, wear, and overall condition of lanyard")
            )
          )
        )
      )

      // ── RESULT ────────────────────────────────────────────────────────
      ,React.createElement('div',{style:{marginBottom:14}}
        ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:8}},"RESULT")
        ,!allChecked&&React.createElement('div',{style:{background:"#1e1e00",border:"1px solid #f59e0b44",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#f59e0b"}},"⚠ All checks must be ticked before marking as PASS")
        ,React.createElement('div',{style:{display:"flex",gap:8}}
          ,[IEL_STATUS.PASS,IEL_STATUS.FAIL,IEL_STATUS.NA,IEL_STATUS.UNTESTED].map(s=>{
            const sm2=IEL_SM[s]||IEL_SM.untested;
            const active=(item.status||IEL_STATUS.UNTESTED)===s;
            const blocked=s===IEL_STATUS.PASS&&!allChecked;
            return React.createElement('button',{key:s,
              style:{flex:1,padding:"12px 4px",borderRadius:8,fontSize:12,fontWeight:800,cursor:blocked?"not-allowed":"pointer",border:`2px solid ${active?sm2.border:"#333"}`,background:active?sm2.bg:"#1a1a1a",color:active?sm2.fg:blocked?"#333":"#555",boxShadow:active?`0 0 8px ${sm2.border}66`:"none",opacity:blocked?0.4:1},
              onClick:()=>setStatus(s)},sm2.label);
          })
        )
      )

      // ── Date tested
      ,React.createElement('div',{style:SI.modalField}
        ,React.createElement('label',{style:SI.modalLabel},"DATE TESTED")
        ,React.createElement('input',{style:SI.modalInput,type:"date",value:item.lastTested||"",onChange:e=>onPatch({lastTested:e.target.value})})
      )

      // Next due
      ,nextDue&&React.createElement('div',{style:{display:"flex",alignItems:"center",background:overdue?"#3d1a1a":"#111",border:`1px solid ${overdue?"#ef444455":"#10b98133"}`,borderRadius:8,padding:"10px 14px",marginBottom:14}}
        ,React.createElement('span',{style:{color:"#888",fontSize:11}},"NEXT TEST DUE:")
        ,React.createElement('span',{style:{color:overdue?"#f87171":"#10b981",fontWeight:800,fontSize:13,marginLeft:8}},nextDue)
        ,overdue&&React.createElement('span',{style:{fontSize:11,fontWeight:800,color:"#f87171",marginLeft:8}},"⚠ OVERDUE")
      )

      // Notes
      ,React.createElement('div',{style:SI.modalField}
        ,React.createElement('label',{style:SI.modalLabel},"NOTES / COMMENTS")
        ,React.createElement('textarea',{style:{...SI.modalInput,minHeight:72,resize:"vertical"},placeholder:"Defect details, action required…",value:item.notes||"",onChange:e=>onPatch({notes:e.target.value})})
      )

      // Fail-only fields
      ,(item.status===IEL_STATUS.FAIL)&&React.createElement(React.Fragment,null
        ,React.createElement('div',{style:SI.modalField}
          ,React.createElement('label',{style:SI.modalLabel},"RECTIFIED / SCHEDULED")
          ,React.createElement('input',{style:SI.modalInput,value:item.rectified||"",placeholder:"e.g. Scheduled for Repair",onChange:e=>onPatch({rectified:e.target.value})})
        )
        ,React.createElement('div',{style:{display:"flex",gap:10}}
          ,React.createElement('div',{style:{...SI.modalField,flex:2}}
            ,React.createElement('label',{style:SI.modalLabel},"RESPONSIBILITY")
            ,React.createElement('input',{style:SI.modalInput,value:item.responsibility||"",placeholder:"Company name",onChange:e=>onPatch({responsibility:e.target.value})})
          )
          ,React.createElement('div',{style:{...SI.modalField,flex:1}}
            ,React.createElement('label',{style:SI.modalLabel},"PRIORITY")
            ,React.createElement('select',{style:SI.modalInput,value:item.priority||"",onChange:e=>onPatch({priority:e.target.value})}
              ,React.createElement('option',{value:""},"— Select")
              ,React.createElement('option',{value:"L"},"L – Low")
              ,React.createElement('option',{value:"M"},"M – Medium")
              ,React.createElement('option',{value:"H"},"H – High")
              ,React.createElement('option',{value:"U"},"U – Urgent")
            )
          )
        )
      )

      ,React.createElement('button',{style:{...SI.modalClose,background:catI.color,color:"#fff"},onClick:onClose},"Done")
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL REPORT VIEW
// ─────────────────────────────────────────────────────────────────────────
function IELReportView({project,results,meta,onExport,onArchive}){
  const[archiveMsg,setArchiveMsg]=React.useState("");
  const handleArchive=()=>{onArchive();setArchiveMsg("Audit archived!");setTimeout(()=>setArchiveMsg(""),2500);};
  return React.createElement('div',{style:SI.summaryWrap}
    ,React.createElement('div',{style:{...SI.summaryTitle,color:"#10b981"}},"IEL REPORT")
    ,React.createElement('div',{style:SI.summaryMeta},project.name," · Auditor: ",meta.auditor||"—"," · ",fmtDate(meta.testDate))
    ,IEL_CATEGORIES.map(cat=>{
      const sum=ielSiteSummary(results,project,cat.key);
      return React.createElement('div',{key:cat.key,style:{marginBottom:20}}
        ,React.createElement('div',{style:{fontSize:13,fontWeight:800,color:cat.color,marginBottom:8}},cat.icon," ",cat.label)
        ,React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap"}}
          ,[["Total",sum.total,"#94a3b8"],["Pass",sum.pass,"#22c55e"],["Fail",sum.fail,"#ef4444"],["N/A",sum.na,"#64748b"],["Untested",sum.untested,"#f59e0b"]].map(([l,v,c])=>
            React.createElement('div',{key:l,style:{flex:1,textAlign:"center",background:"#1a1a1a",borderRadius:10,border:`1px solid ${c}33`,padding:"10px 4px",minWidth:48}}
              ,React.createElement('div',{style:{fontSize:22,fontWeight:800,color:c}},v)
              ,React.createElement('div',{style:{fontSize:9,color:"#666",marginTop:2}},l.toUpperCase())
            )
          )
        )
      );
    })
    ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:8}}
      ,React.createElement('button',{style:{...SI.exportBtn,flex:1,color:"#10b981",borderColor:"#10b98144",background:"#0a1a12"},onClick:onExport},"↓ Export xlsx")
      ,React.createElement('button',{style:{...SI.exportBtn,flex:1,color:"#10b981",borderColor:"#10b98144"},onClick:handleArchive},"📁 Archive")
    )
    ,archiveMsg&&React.createElement('div',{style:{fontSize:12,color:"#4ade80",marginTop:8,textAlign:"center"}},"✓ ",archiveMsg)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL MANAGE VIEW — mirrors ManageView from RCD
// ─────────────────────────────────────────────────────────────────────────
function IELManageView({project,onUpdateProject}){
  const[expandedArea,setExpandedArea]=React.useState(null);
  const[newAreaName,setNewAreaName]=React.useState("");
  const[newItemName,setNewItemName]=React.useState({});
  const[bulkItems,setBulkItems]=React.useState({});
  const[editingProject,setEditingProject]=React.useState(false);
  const[projName,setProjName]=React.useState(project.name);
  const[projCo,setProjCo]=React.useState(project.company||"");
  const upd=u=>onUpdateProject(u);
  const addArea=()=>{if(!newAreaName.trim())return;upd({...project,areas:[...project.areas,{id:ielSlug(newAreaName),name:newAreaName.trim(),panels:IEL_CATEGORIES.map(cat=>({id:ielSlug(cat.key+"-"+newAreaName),name:cat.key,circuits:[],machineNames:{}}))}]});setNewAreaName("");};
  const delArea=id=>upd({...project,areas:project.areas.filter(a=>a.id!==id)});
  const addItem=(aid,catKey)=>{
    const key=`${aid}-${catKey}`;
    const n=(newItemName[key]||"").trim();if(!n)return;
    const itemId=ielUid();
    upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.name===catKey?{...p,circuits:[...p.circuits,itemId],machineNames:{...(p.machineNames||{}),[itemId]:n}}:p)}:a)});
    setNewItemName(x=>({...x,[key]:""}));
  };
  const addBulk=(aid,catKey)=>{
    const key=`${aid}-${catKey}`;
    const raw=(bulkItems[key]||"").trim();if(!raw)return;
    const names=raw.split(",").map(s=>s.trim()).filter(Boolean);
    const newItems=names.map(n=>({id:ielUid(),name:n}));
    upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>p.name===catKey?{...p,circuits:[...p.circuits,...newItems.map(i=>i.id)],machineNames:{...(p.machineNames||{}),...Object.fromEntries(newItems.map(i=>[i.id,i.name]))}}:p)}:a)});
    setBulkItems(x=>({...x,[key]:""}));
  };
  const delItem=(aid,catKey,itemId)=>upd({...project,areas:project.areas.map(a=>a.id===aid?{...a,panels:a.panels.map(p=>{if(p.name!==catKey)return p;const mn={...(p.machineNames||{})};delete mn[itemId];return{...p,circuits:p.circuits.filter(c=>c!==itemId),machineNames:mn};})}:a)});
  return React.createElement('div',{style:SI.listWrap}
    ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:"#a855f7",marginBottom:16}},"⚙ Manage")
    ,React.createElement('div',{style:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:12,padding:"12px 14px",marginBottom:14}}
      ,editingProject
        ?React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{marginBottom:8}},React.createElement('div',{style:SI.metaLabelText},"SITE NAME"),React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:projName,onChange:e=>setProjName(e.target.value)}))
          ,React.createElement('div',{style:{marginBottom:8}},React.createElement('div',{style:SI.metaLabelText},"COMPANY"),React.createElement('input',{style:{...SI.metaInput,marginTop:4},value:projCo,placeholder:"Company name",onChange:e=>setProjCo(e.target.value)}))
          ,React.createElement('div',{style:{display:"flex",gap:8}}
            ,React.createElement('button',{style:SI.ctaPrimary,onClick:()=>{upd({...project,name:projName.trim()||project.name,company:projCo.trim()});setEditingProject(false);}},"Save")
            ,React.createElement('button',{style:SI.ctaSecondary,onClick:()=>setEditingProject(false)},"Cancel")
          )
        )
        :React.createElement('div',{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}}
          ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:"#eee"}},project.name)
          ,React.createElement('button',{style:{...SI.smallBtn,color:"#a855f7",borderColor:"#a855f755"},onClick:()=>setEditingProject(true)},"✏️ Edit")
        )
    )
    ,React.createElement('div',{style:{fontSize:11,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:10}},"AREAS / LOCATIONS")
    ,project.areas.length===0&&React.createElement('div',{style:{color:"#555",fontSize:13,marginBottom:12}},"No areas yet.")
    ,project.areas.map(area=>
      React.createElement('div',{key:area.id,style:{border:`1px solid ${expandedArea===area.id?"#a855f755":"#2a2a2a"}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"#1a1a1a"}}
          ,React.createElement('button',{style:{flex:1,display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",color:"inherit",textAlign:"left",padding:0},onClick:()=>setExpandedArea(expandedArea===area.id?null:area.id)}
            ,React.createElement('span',{style:{fontSize:16,color:expandedArea===area.id?"#c084fc":"#aaa"}},expandedArea===area.id?"▾":"▸")
            ,React.createElement('span',{style:{fontWeight:700,color:"#eee",fontSize:14}},area.name)
            ,React.createElement('span',{style:{fontSize:11,color:"#555"}},area.panels.reduce((s,p)=>s+p.circuits.length,0)," items")
          )
          ,React.createElement('button',{style:{...SI.smallBtn,color:"#ef4444",borderColor:"#ef444433"},onClick:()=>delArea(area.id)},"🗑")
        )
        ,expandedArea===area.id&&React.createElement('div',{style:{padding:"8px 8px 12px 20px"}}
          ,IEL_CATEGORIES.map(cat=>
            React.createElement('div',{key:cat.key,style:{border:`1px solid ${cat.color}33`,borderRadius:8,padding:"10px 12px",marginBottom:8,background:"#161616"}}
              ,React.createElement('div',{style:{fontSize:13,fontWeight:700,color:cat.color,marginBottom:8}},cat.icon," ",cat.label)
              ,React.createElement('div',{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}
                ,(area.panels.find(p=>p.name===cat.key)||{circuits:[],machineNames:{}}).circuits.map(itemId=>{
                  const mn=(area.panels.find(p=>p.name===cat.key)||{machineNames:{}}).machineNames||{};
                  return React.createElement('div',{key:itemId,style:{display:"flex",alignItems:"center",gap:4,background:"#1e1e1e",border:`1px solid ${cat.color}33`,borderRadius:6,padding:"3px 8px"}}
                    ,React.createElement('span',{style:{fontSize:12,color:"#ccc",fontWeight:600}},mn[itemId]||itemId)
                    ,React.createElement('button',{style:{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12,padding:"0 0 0 4px"},onClick:()=>delItem(area.id,cat.key,itemId)},"✕")
                  );
                })
                ,(area.panels.find(p=>p.name===cat.key)||{circuits:[]}).circuits.length===0&&React.createElement('span',{style:{fontSize:12,color:"#555"}},"No items")
              )
              ,React.createElement('div',{style:{display:"flex",gap:6,marginBottom:4}}
                ,React.createElement('input',{style:{...SI.smallInput,flex:1},placeholder:`Add ${cat.label.slice(0,-1)} e.g. Screen Conveyor 1`,value:newItemName[`${area.id}-${cat.key}`]||"",onChange:e=>setNewItemName(x=>({...x,[`${area.id}-${cat.key}`]:e.target.value})),onKeyDown:e=>e.key==="Enter"&&addItem(area.id,cat.key)})
                ,React.createElement('button',{style:{...SI.smallBtn,color:cat.color,borderColor:`${cat.color}55`},onClick:()=>addItem(area.id,cat.key)},"+ Add")
              )
              ,React.createElement('div',{style:{fontSize:10,color:"#555",marginBottom:4}},"BULK ADD (comma-separated)")
              ,React.createElement('div',{style:{display:"flex",gap:6}}
                ,React.createElement('input',{style:{...SI.smallInput,flex:1},placeholder:"Screen 1,Screen 2,Pump 3",value:bulkItems[`${area.id}-${cat.key}`]||"",onChange:e=>setBulkItems(x=>({...x,[`${area.id}-${cat.key}`]:e.target.value})),onKeyDown:e=>e.key==="Enter"&&addBulk(area.id,cat.key)})
                ,React.createElement('button',{style:{...SI.smallBtn,color:"#4ade80",borderColor:"#22c55e55"},onClick:()=>addBulk(area.id,cat.key)},"+ Bulk")
              )
            )
          )
        )
      )
    )
    ,React.createElement('div',{style:{display:"flex",gap:6,marginTop:12}}
      ,React.createElement('input',{style:{...SI.smallInput,flex:1},placeholder:"New area / location name",value:newAreaName,onChange:e=>setNewAreaName(e.target.value),onKeyDown:e=>e.key==="Enter"&&addArea()})
      ,React.createElement('button',{style:{...SI.ctaPrimary,padding:"10px 16px",fontSize:13},onClick:addArea},"+ Area")
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL HISTORY VIEW
// ─────────────────────────────────────────────────────────────────────────
function IELHistoryView({history,project,onDelete,onExportSnap,onContinueFromSnap}){
  const[expanded,setExpanded]=React.useState(null);
  const[deleteId,setDeleteId]=React.useState(null);
  const[viewSnap,setViewSnap]=React.useState(null);

  // ── Read-only snapshot viewer — Area list → Category list → Items ──────
  const[viewArea,setViewArea]=React.useState(null);
  const[viewCat, setViewCat] =React.useState(null);
  if(viewSnap){
    const snap=viewSnap;

    // ── LEVEL 3: Items for one area + one category ──────────────────────
    if(viewArea&&viewCat){
      const area=project&&project.areas.find(a=>a.id===viewArea);
      const cat=IEL_CATEGORIES.find(c=>c.key===viewCat);
      const cp=area&&area.panels.find(p=>p.name===viewCat);
      let pass=0,fail=0,na=0,unt=0;
      (cp&&cp.circuits||[]).forEach(id=>{const v=((((snap.results||{})[area.id]||{})[viewCat])||{})[id];const st=(v&&v.status)||IEL_STATUS.UNTESTED;if(st===IEL_STATUS.PASS)pass++;else if(st===IEL_STATUS.FAIL)fail++;else if(st===IEL_STATUS.NA)na++;else unt++;});
      return React.createElement('div',{style:SI.listWrap}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12,marginBottom:16}}
          ,React.createElement('button',{style:{...SI.smallBtn,color:"#aaa"},onClick:()=>setViewCat(null)},"‹ Back")
          ,React.createElement('div',null
            ,React.createElement('div',{style:{fontSize:16,fontWeight:800,color:cat&&cat.color||"#eee"}},cat&&cat.icon," ",cat&&cat.label)
            ,React.createElement('div',{style:{fontSize:11,color:"#555"}},area&&area.name," · ",fmtDate(snap.testDate)," · Read-only")
          )
          ,React.createElement('div',{style:{display:"flex",gap:6,marginLeft:"auto"}}
            ,React.createElement('span',{style:{fontSize:11,color:"#22c55e",background:"#22c55e22",borderRadius:4,padding:"2px 7px",fontWeight:700}},pass,"P")
            ,fail>0&&React.createElement('span',{style:{fontSize:11,color:"#f87171",background:"#ef444422",borderRadius:4,padding:"2px 7px",fontWeight:700}},fail,"F")
            ,unt>0&&React.createElement('span',{style:{fontSize:11,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"2px 7px",fontWeight:700}},unt," left")
          )
        )
        ,(!cp||!cp.circuits.length)&&React.createElement('div',{style:{color:"#555",fontSize:13}},"No items for this category in this area.")
        ,(cp&&cp.circuits||[]).map(id=>{
          const mn=(cp.machineNames||{})[id]||id;
          const v=((((snap.results||{})[area.id]||{})[viewCat])||{})[id]||{};
          const st=v.status||IEL_STATUS.UNTESTED;
          const sm=IEL_SM[st]||IEL_SM.untested;
          return React.createElement('div',{key:id,style:{display:"flex",alignItems:"stretch",background:sm.bg,border:`2px solid ${sm.border}44`,borderRadius:12,marginBottom:8,overflow:"hidden"}}
            ,React.createElement('div',{style:{width:58,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${sm.border}44`,padding:"12px 4px"}}
              ,React.createElement('span',{style:{fontSize:11,fontWeight:800,color:sm.fg,letterSpacing:0.5}},sm.label)
            )
            ,React.createElement('div',{style:{flex:1,padding:"10px 12px",minWidth:0}}
              ,React.createElement('div',{style:{fontSize:14,fontWeight:700,color:"#eee",marginBottom:4}},mn)
              ,React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap"}}
                ,React.createElement('span',{style:{fontSize:10,fontWeight:600,color:v.mechCheck?"#22c55e":"#444"}},v.mechCheck?"✓":"✕"," Mech / Reset")
                ,React.createElement('span',{style:{fontSize:10,fontWeight:600,color:v.circuitIso?"#22c55e":"#444"}},v.circuitIso?"✓":"✕"," Circuit Iso")
                ,viewCat==="lanyards"&&React.createElement('span',{style:{fontSize:10,fontWeight:600,color:v.lanyardCond?"#22c55e":"#444"}},v.lanyardCond?"✓":"✕"," Lanyard Cond")
              )
              ,v.lastTested&&React.createElement('div',{style:{fontSize:10,color:"#555",marginTop:3}},"Tested: ",fmtDate(v.lastTested))
              ,v.notes&&React.createElement('div',{style:{fontSize:11,color:"#e8731a",marginTop:3}},"✎ ",v.notes)
              ,v.status===IEL_STATUS.FAIL&&v.priority&&React.createElement('div',{style:{fontSize:10,fontWeight:800,color:v.priority==="U"?"#ef4444":v.priority==="H"?"#f87171":"#f59e0b",marginTop:2}},"Priority: ",v.priority)
            )
          );
        })
      );
    }

    // ── LEVEL 2: Category cards for one area ───────────────────────────
    if(viewArea){
      const area=project&&project.areas.find(a=>a.id===viewArea);
      return React.createElement('div',{style:SI.listWrap}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12,marginBottom:16}}
          ,React.createElement('button',{style:{...SI.smallBtn,color:"#aaa"},onClick:()=>setViewArea(null)},"‹ Back")
          ,React.createElement('div',null
            ,React.createElement('div',{style:{fontSize:16,fontWeight:800,color:"#eee"}},area&&area.name)
            ,React.createElement('div',{style:{fontSize:11,color:"#555"}},fmtDate(snap.testDate)," · Read-only")
          )
        )
        ,IEL_CATEGORIES.map(cat=>{
          const cp=area&&area.panels.find(p=>p.name===cat.key);
          if(!cp||!cp.circuits.length)return null;
          let pass=0,fail=0,na=0,unt=0;
          cp.circuits.forEach(id=>{const v=((((snap.results||{})[area.id]||{})[cat.key])||{})[id];const st=(v&&v.status)||IEL_STATUS.UNTESTED;if(st===IEL_STATUS.PASS)pass++;else if(st===IEL_STATUS.FAIL)fail++;else if(st===IEL_STATUS.NA)na++;else unt++;});
          const total=cp.circuits.length;
          const pct=total>0?Math.round(((pass+na)/total)*100):0;
          return React.createElement('button',{key:cat.key,
            style:{...SI.siteCard,...(fail>0?{background:"#1e1010",borderColor:"#ef444455"}:unt===0?{background:"#0e1e0e",borderColor:"#22c55e55"}:{})},
            onClick:()=>setViewCat(cat.key)}
            ,React.createElement('div',{style:SI.siteCardLeft}
              ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:cat.color}},cat.icon," ",cat.label)
              ,React.createElement('div',{style:{fontSize:12,color:"#666",marginTop:2}},total," item",total!==1?"s":"")
              ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
                ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:fail>0?"#ef4444":cat.color}})
              )
              ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:4}}
                ,React.createElement('span',{style:{fontSize:11,color:"#22c55e"}},pass," Pass")
                ,fail>0&&React.createElement('span',{style:{fontSize:11,color:"#f87171",fontWeight:800}},fail," Fail")
                ,unt>0&&React.createElement('span',{style:{fontSize:11,color:"#f59e0b"}},unt," untested")
              )
            )
            ,React.createElement('div',{style:SI.siteCardRight}
              ,fail>0&&React.createElement('span',{style:SI.failBadge},fail," FAIL")
              ,unt===0&&fail===0&&React.createElement('span',{style:{color:"#4ade80",fontSize:18,fontWeight:800}},"✓")
              ,React.createElement('span',{style:SI.arrow},"›")
            )
          );
        })
      );
    }

    // ── AREA LIST for this snapshot ────────────────────────────────────
    // Summary totals across all categories
    let totPass=0,totFail=0,totNa=0,totAll=0;
    if(project){project.areas.forEach(a=>{IEL_CATEGORIES.forEach(cat=>{const cp=a.panels.find(p=>p.name===cat.key);if(!cp)return;cp.circuits.forEach(id=>{totAll++;const v=((((snap.results||{})[a.id]||{})[cat.key])||{})[id];const st=(v&&v.status)||IEL_STATUS.UNTESTED;if(st===IEL_STATUS.PASS)totPass++;else if(st===IEL_STATUS.FAIL)totFail++;else if(st===IEL_STATUS.NA)totNa++;});});}); }

    return React.createElement('div',{style:SI.listWrap}
      // Header
      ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12,marginBottom:8}}
        ,React.createElement('button',{style:{...SI.smallBtn,color:"#aaa"},onClick:()=>{setViewSnap(null);setViewArea(null);setViewCat(null);}},"‹ Back")
        ,React.createElement('div',{style:{flex:1}}
          ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:"#10b981"}},"IEL Audit Snapshot")
          ,React.createElement('div',{style:{fontSize:11,color:"#555"}},fmtDate(snap.testDate)," · ",snap.auditor||"No auditor"," · Read-only")
        )
        ,React.createElement('button',{style:{...SI.smallBtn,color:"#4ade80",borderColor:"#22c55e44"},onClick:()=>onExportSnap(snap)},"↓ Export")
      )
      // Summary pills
      ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}
        ,[["Pass",totPass,"#22c55e"],["Fail",totFail,"#ef4444"],["N/A",totNa,"#64748b"],["Untested",totAll-totPass-totFail-totNa,"#f59e0b"]].map(([l,v,c])=>
          React.createElement('div',{key:l,style:{background:"#1a1a1a",border:`1px solid ${c}33`,borderRadius:8,padding:"6px 12px",textAlign:"center",flex:1}}
            ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:c}},v)
            ,React.createElement('div',{style:{fontSize:10,color:"#666"}},l)
          )
        )
      )
      ,React.createElement('div',{style:{fontSize:11,color:"#555",marginBottom:12}},"Tap an area to view items")
      // Area cards — mirrors RCD exactly
      ,project&&project.areas.map(area=>{
        let aPass=0,aFail=0,aTotal=0;
        IEL_CATEGORIES.forEach(cat=>{
          const cp=area.panels.find(p=>p.name===cat.key);
          if(!cp)return;
          cp.circuits.forEach(id=>{
            aTotal++;
            const v=((((snap.results||{})[area.id]||{})[cat.key])||{})[id];
            const st=(v&&v.status)||IEL_STATUS.UNTESTED;
            if(st===IEL_STATUS.PASS||st===IEL_STATUS.NA)aPass++;
            else if(st===IEL_STATUS.FAIL)aFail++;
          });
        });
        const pct=aTotal>0?Math.round((aPass/aTotal)*100):0;
        return React.createElement('button',{key:area.id,
          style:{...SI.siteCard,...(aFail>0?{background:"#1e1010",borderColor:"#ef444455"}:{})},
          onClick:()=>setViewArea(area.id)}
          ,React.createElement('div',{style:SI.siteCardLeft}
            ,React.createElement('div',{style:SI.siteCardName},area.name)
            ,React.createElement('div',{style:SI.siteCardSub},aTotal," items")
            ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
              ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:aFail>0?"#ef4444":"#10b981"}})
            )
          )
          ,React.createElement('div',{style:SI.siteCardRight}
            ,aFail>0&&React.createElement('span',{style:SI.failBadge},aFail," FAIL")
            ,aFail===0&&aTotal>0&&aPass===aTotal&&React.createElement('span',{style:{color:"#4ade80",fontSize:18,fontWeight:800}},"✓")
            ,React.createElement('span',{style:SI.arrow},"›")
          )
        );
      })
    );
  }

  if(history.length===0)return React.createElement('div',{style:SI.listWrap},React.createElement('div',{style:SI.listTitle},"IEL History"),React.createElement('div',{style:{color:"#555",fontSize:14}},"No archived audits yet."));
  return React.createElement('div',{style:SI.listWrap}
    ,React.createElement('div',{style:SI.listTitle},"IEL History")
    ,React.createElement('div',{style:{fontSize:12,color:"#555",marginBottom:16}},history.length," saved audit",history.length!==1?"s":"")
    ,history.map(snap=>{
      let pass=0,fail=0,total=0;
      if(project){project.areas.forEach(a=>{IEL_CATEGORIES.forEach(cat=>{const cp=a.panels.find(p=>p.name===cat.key);if(!cp)return;cp.circuits.forEach(id=>{total++;const v=((((snap.results||{})[a.id]||{})[cat.key])||{})[id];const st=(v&&v.status)||IEL_STATUS.UNTESTED;if(st===IEL_STATUS.PASS)pass++;else if(st===IEL_STATUS.FAIL)fail++;});});});}
      return React.createElement('div',{key:snap.id,style:{...SI.siteCard,flexDirection:"column",padding:0,marginBottom:10,overflow:"hidden"}}
        ,React.createElement('button',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"14px 16px",color:"inherit",textAlign:"left"},onClick:()=>setExpanded(expanded===snap.id?null:snap.id)}
          ,React.createElement('div',{style:{flex:1}}
            ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:"#10b981",marginBottom:4}},"IEL Audit")
            ,React.createElement('div',{style:{fontSize:12,color:"#888"}},fmtDate(snap.testDate)," · ",snap.auditor||"No auditor")
            ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Archived ",fmtDateTime(snap.archivedAt))
            ,total>0&&React.createElement('div',{style:{display:"flex",gap:8,marginTop:6}}
              ,React.createElement('span',{style:{fontSize:11,color:"#22c55e"}},pass," Pass")
              ,React.createElement('span',{style:{fontSize:11,color:"#ef4444"}},fail," Fail")
              ,React.createElement('span',{style:{fontSize:11,color:"#f59e0b"}},total-pass-fail," Untested")
            )
          )
          ,React.createElement('span',{style:{...SI.arrow,color:expanded===snap.id?"#10b981":"#555"}},expanded===snap.id?"▾":"›")
        )
        ,expanded===snap.id&&React.createElement('div',{style:{padding:"0 16px 14px",borderTop:"1px solid #2a2a2a"}}
          ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:10}}
            ,React.createElement('button',{style:{...SI.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",fontWeight:700},onClick:()=>setViewSnap(snap)},"👁 View Results")
            ,React.createElement('button',{style:{...SI.smallBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"},onClick:()=>onExportSnap(snap)},"↓ Export")
            ,React.createElement('button',{style:{...SI.smallBtn,flex:1,color:"#a78bfa",borderColor:"#7c3aed44",fontWeight:700},onClick:()=>onContinueFromSnap(snap)},"▶ Continue")
            ,deleteId===snap.id
              ?React.createElement(React.Fragment,null,React.createElement('button',{style:{...SI.smallBtn,color:"#f87171",borderColor:"#ef444455"},onClick:()=>{onDelete(snap.id);setDeleteId(null);}},"Confirm"),React.createElement('button',{style:SI.smallBtn,onClick:()=>setDeleteId(null)},"Cancel"))
              :React.createElement('button',{style:{...SI.smallBtn,color:"#ef4444",borderColor:"#ef444433"},onClick:()=>setDeleteId(snap.id)},"🗑")
          )
        )
      );
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// IEL SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────
function IELStatPill({label,val,col}){return React.createElement('div',{style:{display:"flex",alignItems:"center",gap:4,background:"#1a1a1a",border:`1px solid ${col}44`,borderRadius:6,padding:"3px 8px"}},React.createElement('span',{style:{fontSize:10,color:col,fontWeight:700,letterSpacing:0.5}},label),React.createElement('span',{style:{fontSize:14,color:col,fontWeight:800}},val));}
function IELNavBtn({icon,label,active,onClick,color}){const c=active?(color||"#10b981"):"#555";return React.createElement('button',{onClick,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",minHeight:50,color:c,borderTop:active?`2px solid ${color||"#10b981"}`:"2px solid transparent"}},React.createElement('span',{style:{fontSize:18}},icon),React.createElement('span',{style:{fontSize:9,fontWeight:active?700:500,letterSpacing:0.5}},label));}

// ─────────────────────────────────────────────────────────────────────────
// IEL STYLES — mirrors S from RCD
// ─────────────────────────────────────────────────────────────────────────
const SI={
  root:{display:"flex",flexDirection:"column",flex:1,minHeight:0,touchAction:"pan-y",background:"#111",color:"#eee",fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",WebkitFontSmoothing:"antialiased",overflow:"hidden"},
  loader:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#111"},
  loaderSpinner:{width:40,height:40,border:"3px solid #333",borderTop:"3px solid #10b981",borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",background:"#161616",flexShrink:0,zIndex:10},
  topbarLeft:{display:"flex",alignItems:"center",gap:12},topbarRight:{display:"flex",alignItems:"center",gap:8},
  appTitle:{fontSize:16,fontWeight:800,letterSpacing:1,color:"#10b981"},appSub:{fontSize:10,letterSpacing:0.5,transition:"color 0.3s"},
  backBtn:{fontSize:28,color:"#aaa",background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:"0 8px 0 0",fontWeight:300},
  homeModuleBtn:{fontSize:11,color:"#555",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"},
  saveIndicator:{fontSize:11,color:"#22c55e",fontWeight:600,transition:"opacity 0.4s",pointerEvents:"none"},
  breadcrumb:{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#161616",borderBottom:"1px solid #1e1e1e",fontSize:12,flexWrap:"wrap",flexShrink:0},
  bcItem:{color:"#888",cursor:"pointer"},bcSep:{color:"#444"},
  main:{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",minHeight:0},
  bottomNav:{display:"flex",background:"#161616",borderTop:"1px solid #222",flexShrink:0,paddingBottom:"34px",boxShadow:"0 200px 0 200px #161616"},
  listWrap:{padding:"16px"},listTitle:{fontSize:20,fontWeight:800,color:"#eee",marginBottom:16},
  brandBlock:{textAlign:"center",borderBottom:"2px solid #10b981",paddingBottom:8,width:"100%",maxWidth:500},
  brandTitle:{fontSize:20,fontWeight:900,letterSpacing:3,color:"#10b981"},brandSub:{fontSize:11,color:"#666",letterSpacing:1,marginTop:2},
  siteTitle:{fontSize:20,fontWeight:800,color:"#eee"},siteSub:{fontSize:12,color:"#666"},
  homeWrap:{padding:"24px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14},
  metaCard:{width:"100%",maxWidth:500,background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"14px"},
  metaLabelText:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700},
  metaInput:{background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"9px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"},
  duePill:{fontSize:12,background:"#161616",border:"1px solid",borderRadius:8,padding:"5px 10px"},
  modeSelectLabel:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1},
  catBtn:{width:"100%",maxWidth:500,display:"flex",alignItems:"center",gap:14,padding:"18px 16px",background:"#161616",border:"2px solid",borderRadius:16,cursor:"pointer",color:"#eee",marginBottom:10,textAlign:"left"},
  siteCard:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px 18px",marginBottom:10,cursor:"pointer",textAlign:"left"},
  siteCardLeft:{flex:1},siteCardRight:{display:"flex",alignItems:"center",gap:8,marginLeft:16},
  siteCardName:{fontSize:16,fontWeight:700,color:"#eee"},siteCardSub:{fontSize:12,color:"#666",marginTop:2},
  failBadge:{fontSize:11,fontWeight:800,color:"#f87171",background:"#3d1a1a",borderRadius:6,padding:"3px 8px",border:"1px solid #ef4444"},
  arrow:{fontSize:22,color:"#555",lineHeight:1},
  addCard:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px",marginBottom:10},
  panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14},
  panelTitle:{fontSize:20,fontWeight:800,color:"#eee"},panelSub:{fontSize:12,color:"#666",marginTop:2},
  panelStats:{display:"flex",gap:10,fontSize:15,fontWeight:800},
  circuitWrap:{padding:"16px"},
  summaryWrap:{padding:"16px"},summaryTitle:{fontSize:22,fontWeight:900,letterSpacing:1.5},summaryMeta:{fontSize:13,color:"#777",marginTop:4,marginBottom:20},
  secondaryBtn:{padding:"11px",background:"#161616",color:"#aaa",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
  exportBtn:{padding:"11px",background:"#161616",color:"#4ade80",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
  confirmRow:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},
  confirmYes:{padding:"7px 14px",background:"#3d1a1a",color:"#f87171",border:"1px solid #ef4444",borderRadius:8,fontSize:13,cursor:"pointer"},
  confirmNo:{padding:"7px 14px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:8,fontSize:13,cursor:"pointer"},
  smallBtn:{padding:"5px 10px",background:"transparent",border:"1px solid #333",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:600,flexShrink:0,color:"#aaa"},
  smallInput:{background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"},
  tabBtn:{flex:1,padding:"9px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#666",fontSize:12,fontWeight:600,cursor:"pointer"},
  tabBtnActive:{background:"#1a2e1a",border:"1px solid #10b981",color:"#10b981"},
  ctaPrimary:{padding:"11px 20px",background:"#10b981",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"},
  ctaSecondary:{padding:"11px 20px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"},
  modalOverlay:{position:"absolute",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modalBox:{background:"#1a1a1a",border:"1px solid #333",borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},
  modalField:{marginBottom:14},
  modalLabel:{display:"block",fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5},
  modalInput:{width:"100%",background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
  modalClose:{width:"100%",padding:"14px",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8},
};



// ═════════════════════════════════════════════════════════════════════════
// CALENDAR / TEST SCHEDULER MODULE
// ═════════════════════════════════════════════════════════════════════════
const K_CAL_EVENTS = "cal-events-v1";

const CAL_TYPES = [
  { key:"rcd_push",    label:"RCD Push Test",       color:"#e8731a", icon:"📋", period:"Monthly"    },
  { key:"rcd_inject",  label:"RCD Injection Test",  color:"#3b82f6", icon:"🔬", period:"Annual"     },
  { key:"iel_estop",   label:"IEL E-Stops",         color:"#ef4444", icon:"🔴", period:"3-Monthly"  },
  { key:"iel_lanyard", label:"IEL Lanyards",        color:"#10b981", icon:"🔗", period:"3-Monthly"  },
  { key:"iel_iso",     label:"IEL Isolators",       color:"#f59e0b", icon:"⚡", period:"3-Monthly"  },
  { key:"other",       label:"Other / Custom",      color:"#a855f7", icon:"📌", period:"Custom"     },
];

function calUid(){ return Math.random().toString(36).slice(2,9); }

function daysUntil(dateStr){
  if(!dateStr) return null;
  try{
    const d = new Date(dateStr);
    const now = new Date();
    now.setHours(0,0,0,0);
    d.setHours(0,0,0,0);
    return Math.round((d-now)/(1000*60*60*24));
  }catch(_){return null;}
}

function urgencyColor(days){
  if(days===null) return "#555";
  if(days<0) return "#ef4444";
  if(days<=7) return "#ef4444";
  if(days<=14) return "#f59e0b";
  if(days<=30) return "#fbbf24";
  return "#22c55e";
}

function urgencyLabel(days){
  if(days===null) return "";
  if(days<0) return `OVERDUE ${Math.abs(days)}d`;
  if(days===0) return "DUE TODAY";
  if(days===1) return "DUE TOMORROW";
  if(days<=7) return `${days}d — THIS WEEK`;
  if(days<=14) return `${days}d — 2 WEEKS`;
  if(days<=30) return `${days}d`;
  return `${days}d`;
}

// ─────────────────────────────────────────────────────────────────────────
// UPCOMING VIEW — structured, collapsible sections
// ─────────────────────────────────────────────────────────────────────────
function EventCard({ev, compact=false, onToggleComplete, onDelete, onDeleteSeries, onStartEdit}) {
  const [del, setDel] = React.useState(false);
  const days = daysUntil(ev.dueDate);
  const uc = ev.completed ? "#22c55e" : urgencyColor(days);
  const ul = ev.completed ? "COMPLETED" : urgencyLabel(days);
  const ct = CAL_TYPES.find(t=>t.key===ev.type)||CAL_TYPES[CAL_TYPES.length-1];
  return React.createElement('div',{style:{background:"#1a1a1a",border:`2px solid ${uc}44`,borderRadius:12,padding:"12px 14px",marginBottom:8,opacity:ev.completed?0.7:1}}
    ,React.createElement('div',{style:{display:"flex",alignItems:"flex-start",gap:10}}
      ,React.createElement('button',{
        style:{fontSize:22,flexShrink:0,background:"transparent",border:"none",cursor:"pointer",padding:0,lineHeight:1},
        onClick:()=>onToggleComplete&&onToggleComplete(ev.id),
        title:ev.completed?"Mark incomplete":"Mark complete"}
        ,ev.completed
          ? React.createElement('span',{style:{fontSize:22}},"✅")
          : React.createElement('span',{style:{fontSize:22}},"⬜")
      )
      ,React.createElement('div',{style:{flex:1,minWidth:0}}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}
          ,React.createElement('span',{style:{fontSize:14,fontWeight:800,color:ev.completed?"#555":"#eee",textDecoration:ev.completed?"line-through":"none"}},ct.label)
          ,React.createElement('span',{style:{fontSize:11,fontWeight:700,color:uc,background:uc+"22",borderRadius:4,padding:"2px 7px",border:`1px solid ${uc}44`}},ul)
        )
        ,React.createElement('div',{style:{fontSize:12,color:"#888",marginTop:3}},ev.site)
        ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Due: ",React.createElement('strong',{style:{color:ev.completed?"#555":uc}},fmtDate(ev.dueDate)),ev.recur&&ev.recur!=="none"?React.createElement('span',{style:{color:"#6366f1",marginLeft:6}},"↻ "+ev.recur):"")
        ,ev.completed&&ev.completedAt&&React.createElement('div',{style:{fontSize:10,color:"#22c55e",marginTop:2}},"✓ Completed ",fmtDate(ev.completedAt.slice(0,10)))
        ,ev.notes&&React.createElement('div',{style:{fontSize:11,color:"#aaa",marginTop:3}},ev.notes)
        ,ev.seriesId&&React.createElement('div',{style:{fontSize:10,color:"#6366f1",marginTop:3}},"↻ ",ev.recur," · ",ev.seriesIndex!==undefined?`${ev.seriesIndex+1} of ${ev.seriesTotal}`:"series")
      )
      ,!compact&&!ev.completed&&React.createElement('div',{style:{display:"flex",gap:6,marginLeft:8,alignItems:"flex-start"}}
        ,React.createElement('button',{style:{...SI.smallBtn,color:"#818cf8",borderColor:"#6366f144"},onClick:()=>onStartEdit&&onStartEdit(ev)},"✏️ Edit")
        ,del
          ?React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4}}
            ,React.createElement('button',{style:{...SI.smallBtn,color:"#f87171",borderColor:"#ef444455",fontSize:11},onClick:()=>{deleteEvent(ev.id);setDel(false);}},"Delete this")
            ,ev.seriesId&&React.createElement('button',{style:{...SI.smallBtn,color:"#f87171",borderColor:"#ef444455",fontSize:11},onClick:()=>{onDeleteSeries&&onDeleteSeries(ev.seriesId);setDel(false);}},"Delete all ",ev.seriesTotal," in series")
            ,React.createElement('button',{style:SI.smallBtn,onClick:()=>setDel(false)},"Cancel")
          )
          :React.createElement('button',{style:{...SI.smallBtn,color:"#ef4444",borderColor:"#ef444433"},onClick:()=>setDel(true)},"🗑")
      )
      ,!compact&&ev.completed&&React.createElement('button',{style:{...SI.smallBtn,color:"#555",marginLeft:8},onClick:()=>(onToggleComplete||toggleComplete)&&(onToggleComplete||toggleComplete)(ev.id)},"↩ Undo")
    )
  );
};

function UpcomingView({overdue,upcoming7,upcoming30,future,completedEvents,activeEvents,toggleComplete,onDelete,onDeleteSeries,onStartEdit}){
  const[showFuture,setShowFuture]=React.useState(false);
  const[showCompleted,setShowCompleted]=React.useState(false);

  const SectionHeader=({color,icon,label,count,small})=>React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}}
    ,React.createElement('span',{style:{fontSize:small?10:11,color,fontWeight:700,letterSpacing:1}},icon," ",label)
    ,React.createElement('span',{style:{fontSize:10,color:"#555",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,padding:"1px 7px",fontWeight:600}},count)
  );

  return React.createElement('div',{style:{padding:"16px"}}

    // Empty state
    ,activeEvents.length===0&&completedEvents.length===0&&React.createElement('div',{style:{textAlign:"center",padding:"40px 20px",color:"#555"}}
      ,React.createElement('div',{style:{fontSize:40,marginBottom:16}},"📅")
      ,React.createElement('div',{style:{fontSize:16,fontWeight:700,color:"#444",marginBottom:8}},"No tests scheduled yet")
      ,React.createElement('div',{style:{fontSize:13,color:"#444"}},"Tap + Add Event to get started")
    )

    // ── OVERDUE — always visible, bold red ────────────────────────────
    ,overdue.length>0&&React.createElement('div',{style:{background:"#1e0a0a",border:"2px solid #ef4444",borderRadius:14,padding:"12px 14px",marginBottom:14}}
      ,React.createElement('div',{style:{fontSize:12,fontWeight:800,color:"#f87171",marginBottom:10,letterSpacing:0.5}},"⚠ OVERDUE — ",overdue.length," TEST",overdue.length!==1?"S":"")
      ,overdue.map(ev=>React.createElement(EventCard,{key:ev.id,ev,onToggleComplete:toggleComplete,onDelete,onDeleteSeries,onStartEdit}))
    )

    // ── DUE THIS WEEK ─────────────────────────────────────────────────
    ,upcoming7.length>0&&React.createElement('div',{style:{marginBottom:14}}
      ,React.createElement(SectionHeader,{color:"#ef4444",icon:"⚡",label:"DUE THIS WEEK",count:upcoming7.length})
      ,upcoming7.map(ev=>React.createElement(EventCard,{key:ev.id,ev,onToggleComplete:toggleComplete,onDelete,onDeleteSeries,onStartEdit}))
    )

    // ── DUE THIS MONTH ────────────────────────────────────────────────
    ,upcoming30.length>0&&React.createElement('div',{style:{marginBottom:14}}
      ,React.createElement(SectionHeader,{color:"#f59e0b",icon:"📅",label:"DUE THIS MONTH",count:upcoming30.length})
      ,upcoming30.map(ev=>React.createElement(EventCard,{key:ev.id,ev,onToggleComplete:toggleComplete,onDelete,onDeleteSeries,onStartEdit}))
    )

    // ── FUTURE — collapsed by default ─────────────────────────────────
    ,future.length>0&&React.createElement('div',{style:{marginBottom:14}}
      ,React.createElement('button',{
        style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"#161616",border:"1px solid #2a2a2a",borderRadius:10,padding:"10px 14px",cursor:"pointer",color:"inherit",marginBottom:showFuture?8:0},
        onClick:()=>setShowFuture(x=>!x)}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}}
          ,React.createElement('span',{style:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1}},"🗓 FUTURE")
          ,React.createElement('span',{style:{fontSize:10,color:"#555",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:10,padding:"1px 7px",fontWeight:600}},future.length)
        )
        ,React.createElement('span',{style:{fontSize:14,color:"#555"}},showFuture?"▾":"▸")
      )
      ,showFuture&&future.map(ev=>React.createElement(EventCard,{key:ev.id,ev,onToggleComplete:toggleComplete,onDelete,onDeleteSeries,onStartEdit}))
    )

    // ── COMPLETED — collapsed, at bottom ─────────────────────────────
    ,completedEvents.length>0&&React.createElement('div',{style:{marginBottom:14}}
      ,React.createElement('button',{
        style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"#0a1a0a",border:"1px solid #22c55e33",borderRadius:10,padding:"10px 14px",cursor:"pointer",color:"inherit",marginBottom:showCompleted?8:0},
        onClick:()=>setShowCompleted(x=>!x)}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}}
          ,React.createElement('span',{style:{fontSize:11,color:"#22c55e",fontWeight:700,letterSpacing:1}},"✓ COMPLETED")
          ,React.createElement('span',{style:{fontSize:10,color:"#22c55e",background:"#22c55e22",border:"1px solid #22c55e33",borderRadius:10,padding:"1px 7px",fontWeight:600}},completedEvents.length)
        )
        ,React.createElement('span',{style:{fontSize:14,color:"#22c55e"}},showCompleted?"▾":"▸")
      )
      ,showCompleted&&completedEvents.map(ev=>React.createElement(EventCard,{key:ev.id,ev,onToggleComplete:toggleComplete,onDelete,onDeleteSeries,onStartEdit}))
    )
  );
}


function CalendarApp({ onGoHome }) {
  const [events,    setEvents]   = React.useState([]);
  const [allSites,  setAllSites] = React.useState([]);  // combined from RCD + IEL
  const [loaded,    setLoaded]   = React.useState(false);
  const [view,      setView]     = React.useState("upcoming"); // upcoming | calendar | add
  const [showAdd,   setShowAdd]  = React.useState(false);
  const [editId,    setEditId]   = React.useState(null);
  const [saveFlash, setSaveFlash]= React.useState(false);

  // Form state
  const blank = {type:"rcd_push",site:"",dueDate:"",notes:"",recur:"none"};
  const [form,  setForm]  = React.useState({...blank});
  const [customSite, setCustomSite] = React.useState("");

  React.useEffect(()=>{
    (async()=>{
      try{
        const [ev, rcdProjs, ielProjs, tatProjs] = await Promise.all([
          load(K_CAL_EVENTS,[]),
          load(K_PROJECTS,[]),
          load(K_IEL_PROJECTS,[]),
          load(K_TAT_PROJECTS,[]),
        ]);
        setEvents(ev);
        // Merge site names from both modules, deduplicate by name
        const names = new Set();
        const combined = [];
        [...(rcdProjs||[]), ...(ielProjs||[]), ...(tatProjs||[])].forEach(p=>{
          if(p&&p.name&&!names.has(p.name)){ names.add(p.name); combined.push(p.name); }
        });
        setAllSites(combined);
      } catch(_){}
      setLoaded(true);
    })();
  },[]);
  React.useEffect(()=>{
    if(loaded){ save(K_CAL_EVENTS,events); setSaveFlash(true); const t=setTimeout(()=>setSaveFlash(false),1200); return()=>clearTimeout(t); }
  },[events,loaded]);

  const saveEvent = () => {
    const finalSite = (form.site==="__custom__"||!form.site) ? customSite.trim() : form.site.trim();
    if(!form.dueDate||!finalSite) return;
    const formToSave = {...form, site: finalSite};
    if(editId){
      // Editing a single event — just update it, don't regenerate series
      setEvents(prev=>prev.map(e=>e.id===editId?{...e,...form}:e));
      setEditId(null);
    } else {
      // Generate all occurrences for recurring events
      const newEvents = [];
      const seriesId = calUid(); // shared ID links events in same series
      if(form.recur==="none"){
        newEvents.push({id:calUid(),...formToSave,seriesId:null});
      } else {
        // Work out how many occurrences to generate
        // Monthly: 12 months (1 year ahead)
        // 3-Monthly: 8 occurrences (2 years ahead)
        // Annual: 3 occurrences (3 years ahead)
        const counts = {Monthly:12,"3-Monthly":8,Annual:3};
        const count = counts[form.recur]||1;
        let d = new Date(form.dueDate);
        for(let i=0;i<count;i++){
          const dateStr = d.toISOString().slice(0,10);
          newEvents.push({
            id:calUid(),
            ...formToSave,
            dueDate:dateStr,
            seriesId,
            seriesIndex:i,
            seriesTotal:count,
          });
          // Advance date
          if(form.recur==="Monthly"){
            d = new Date(d.getFullYear(), d.getMonth()+1, d.getDate());
          } else if(form.recur==="3-Monthly"){
            d = new Date(d.getFullYear(), d.getMonth()+3, d.getDate());
          } else if(form.recur==="Annual"){
            d = new Date(d.getFullYear()+1, d.getMonth(), d.getDate());
          }
        }
      }
      setEvents(prev=>[...prev,...newEvents]);
    }
    setForm({...blank});
    setCustomSite("");
    setShowAdd(false);
  };

  const deleteEvent = id => setEvents(prev=>prev.filter(e=>e.id!==id));
  const deleteSeries = seriesId => setEvents(prev=>prev.filter(e=>e.seriesId!==seriesId));
  const toggleComplete = id => setEvents(prev=>prev.map(e=>e.id===id?{...e,completed:!e.completed,completedAt:!e.completed?new Date().toISOString():null}:e));

  const startEdit = ev => {
    setForm({type:ev.type,site:ev.site,dueDate:ev.dueDate,notes:ev.notes||"",recur:ev.recur||"none"});
    setEditId(ev.id);
    setShowAdd(true);
  };

  // Sort by due date — separate completed from active
  const sorted = [...events].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const activeEvents = sorted.filter(e=>!e.completed);
  const completedEvents = sorted.filter(e=>e.completed);
  const overdue = activeEvents.filter(e=>daysUntil(e.dueDate)<0);
  const upcoming7 = activeEvents.filter(e=>{ const d=daysUntil(e.dueDate); return d!==null&&d>=0&&d<=7; });
  const upcoming30 = activeEvents.filter(e=>{ const d=daysUntil(e.dueDate); return d!==null&&d>7&&d<=30; });
  const future = activeEvents.filter(e=>{ const d=daysUntil(e.dueDate); return d!==null&&d>30; });

  // Build calendar grid for current month
  const today = new Date();
  const [calYear,  setCalYear]  = React.useState(today.getFullYear());
  const [calMonth, setCalMonth] = React.useState(today.getMonth());

  const monthName = new Date(calYear,calMonth,1).toLocaleString("default",{month:"long",year:"numeric"});
  const firstDay  = new Date(calYear,calMonth,1).getDay();
  const daysInMonth = new Date(calYear,calMonth+1,0).getDate();

  const [selectedDay, setSelectedDay] = React.useState(null);

  const eventsOnDay = day => {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter(e=>e.dueDate===ds);
  };

  // Clear selected day when month changes
  React.useEffect(()=>{ setSelectedDay(null); }, [calMonth, calYear]);

  const selectedDateStr = selectedDay
    ? `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`
    : null;
  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  const CAL_STYLE = {
    root:{display:"flex",flexDirection:"column",flex:1,minHeight:0,background:"#111",color:"#eee",fontFamily:"'DM Sans',sans-serif",WebkitFontSmoothing:"antialiased",overflow:"hidden",maxWidth:"100vw"},
    topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",background:"#161616",borderBottom:"2px solid #6366f144",flexShrink:0},
    main:{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",minHeight:0,maxWidth:"100%"},
    bottomNav:{display:"flex",background:"#161616",borderTop:"1px solid #222",flexShrink:0,paddingBottom:"34px"},
    formWrap:{padding:"16px",boxSizing:"border-box",width:"100%",maxWidth:"100%",overflowX:"hidden"},
  };



  return React.createElement('div',{style:CAL_STYLE.root}
    // Header
    ,React.createElement('header',{style:CAL_STYLE.topbar}
      ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12}}
        ,React.createElement('div',null
          ,React.createElement('div',{style:{fontSize:16,fontWeight:800,letterSpacing:1,color:"#818cf8"}},"TEST CALENDAR")
          ,React.createElement('div',{style:{fontSize:10,color:"#555",letterSpacing:0.5}},events.length," scheduled events")
        )
      )
      ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}}
        ,React.createElement('div',{style:{fontSize:11,color:"#22c55e",opacity:saveFlash?1:0,transition:"opacity 0.4s"}},"✓ Saved")
        ,React.createElement('button',{style:{fontSize:11,color:"#555",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:600},onClick:onGoHome},"⌂ Modules")
      )
    )

    // Main
    ,React.createElement('main',{style:CAL_STYLE.main}
      ,view==="upcoming"&&!showAdd&&React.createElement(UpcomingView,{
          overdue,upcoming7,upcoming30,future,completedEvents,activeEvents,
          toggleComplete,
          onDelete:deleteEvent,
          onDeleteSeries:deleteSeries,
          onStartEdit:startEdit,
        })

      ,view==="calendar"&&!showAdd&&React.createElement('div',{style:{padding:"16px"}}
        // Month navigation
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}
          ,React.createElement('button',{style:{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#aaa",fontSize:20,width:40,height:40,cursor:"pointer"},onClick:()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}},"‹")
          ,React.createElement('div',{style:{fontSize:16,fontWeight:800,color:"#eee"}},monthName)
          ,React.createElement('button',{style:{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,color:"#aaa",fontSize:20,width:40,height:40,cursor:"pointer"},onClick:()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}},"›")
        )
        // Day headers
        ,React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}
          ,["S","M","T","W","T","F","S"].map((d,i)=>React.createElement('div',{key:i,style:{textAlign:"center",fontSize:10,color:"#555",fontWeight:700,padding:"4px 0"}},d))
        )
        // Calendar grid
        ,React.createElement('div',{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}
          // Empty cells before first day
          ,[...Array(firstDay)].map((_,i)=>React.createElement('div',{key:"e"+i,style:{height:52}}))
          // Day cells
          ,[...Array(daysInMonth)].map((_,i)=>{
            const day=i+1;
            const evs=eventsOnDay(day);
            const isToday=day===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear();
            const hasOverdue=evs.some(e=>daysUntil(e.dueDate)<0);
            const isSelected = selectedDay===day;
            return React.createElement('div',{key:day,onClick:()=>setSelectedDay(isSelected?null:day),style:{height:44,width:"100%",boxSizing:"border-box",overflow:"hidden",cursor:"pointer",background:isSelected?"#2a2040":isToday?"#1e2035":"#161616",border:`2px solid ${isSelected?"#818cf8":isToday?"#6366f1":hasOverdue?"#ef444455":"#2a2a2a"}`,borderRadius:8,padding:"4px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}
              ,React.createElement('div',{style:{fontSize:11,color:isSelected?"#c4b5fd":isToday?"#818cf8":"#555",fontWeight:isSelected||isToday?800:400,lineHeight:1}},day)
              ,evs.length>0&&React.createElement('div',{style:{display:"flex",gap:2,flexWrap:"nowrap",justifyContent:"center"}}
                ,evs.slice(0,3).map((ev,j)=>{
                  const days2=daysUntil(ev.dueDate);
                  const uc=urgencyColor(days2);
                  return ev.completed
                    ? React.createElement('div',{key:j,style:{width:7,height:7,borderRadius:"50%",background:"transparent",border:"1.5px solid #22c55e",flexShrink:0}})
                    : React.createElement('div',{key:j,style:{width:7,height:7,borderRadius:"50%",background:uc,flexShrink:0}});
                })
                ,evs.length>3&&React.createElement('div',{style:{width:7,height:7,borderRadius:"50%",background:"#444",flexShrink:0}})
              )
            );
          })
        )
        // Selected day events
        ,selectedDay&&React.createElement('div',{style:{marginTop:16,background:"#1a1a2e",border:"2px solid #6366f155",borderRadius:14,padding:"14px"}}
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}
            ,React.createElement('div',{style:{fontSize:13,fontWeight:800,color:"#c4b5fd"}}
              ,new Date(calYear,calMonth,selectedDay).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})
            )
            ,React.createElement('button',{style:{background:"transparent",border:"none",color:"#555",fontSize:18,cursor:"pointer",lineHeight:1},onClick:()=>setSelectedDay(null)},"✕")
          )
          ,selectedEvents.length===0
            ? React.createElement('div',{style:{fontSize:13,color:"#555",textAlign:"center",padding:"12px 0"}},"No events on this date")
            : selectedEvents.map(ev=>React.createElement(EventCard,{key:ev.id,ev}))
        )
        // Events this month
        ,React.createElement('div',{style:{marginTop:16}}
          ,React.createElement('div',{style:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1,marginBottom:8}},"EVENTS THIS MONTH")
          ,sorted.filter(e=>{
            const d=new Date(e.dueDate);
            return d.getFullYear()===calYear&&d.getMonth()===calMonth;
          }).map(ev=>React.createElement(EventCard,{key:ev.id,ev}))
        )
      )

      // Add / Edit form
      ,showAdd&&React.createElement('div',{style:CAL_STYLE.formWrap}
        ,React.createElement('div',{style:{fontSize:16,fontWeight:800,color:"#818cf8",marginBottom:16}},editId?"✏️ Edit Event":"+ Add Test Event")
        // Type
        ,React.createElement('div',{style:{marginBottom:12}}
          ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:6}},"TEST TYPE")
          ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6}}
            ,CAL_TYPES.map(t=>React.createElement('button',{key:t.key,
              style:{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:form.type===t.key?t.color+"22":"#161616",border:`2px solid ${form.type===t.key?t.color:"#2a2a2a"}`,borderRadius:10,cursor:"pointer",color:"#eee",textAlign:"left"},
              onClick:()=>setForm(f=>({...f,type:t.key}))}
              ,React.createElement('span',{style:{fontSize:18}},t.icon)
              ,React.createElement('span',{style:{fontSize:13,fontWeight:700,color:form.type===t.key?t.color:"#aaa"}},t.label)
              ,React.createElement('span',{style:{fontSize:11,color:"#555",marginLeft:"auto"}},t.period)
            ))
          )
        )
        // Site / Location — dropdown from saved projects + custom entry
        ,React.createElement('div',{style:{marginBottom:12}}
          ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5}},"SITE / LOCATION")
          ,React.createElement(React.Fragment,null
              ,React.createElement('select',{
                style:{width:"100%",background:"#1a1a1a",border:`1px solid ${!form.site&&!customSite?"#ef4444":"#333"}`,borderRadius:8,color:form.site||customSite?"#eee":"#666",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:6},
                value:customSite?"__custom__":form.site,
                onChange:e=>{
                  if(e.target.value==="__custom__"){
                    setCustomSite("");
                    setForm(f=>({...f,site:"__custom__"}));
                  } else {
                    setCustomSite("");
                    setForm(f=>({...f,site:e.target.value}));
                  }
                }}
                ,React.createElement('option',{value:""},"— Select a site")
                ,allSites.map(s=>React.createElement('option',{key:s,value:s},s))
                ,allSites.length===0&&React.createElement('option',{value:"",disabled:true},"No sites yet — add one in RCD or IEL first, or use custom below")
                ,React.createElement('option',{value:"__custom__"},"+ Enter custom site…")
              )
              ,(form.site==="__custom__"||customSite)&&React.createElement('input',{
                style:{width:"100%",background:"#1a1a1a",border:"1px solid #6366f1",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
                placeholder:"Type site name…",
                value:customSite,
                autoFocus:true,
                onChange:e=>{
                  setCustomSite(e.target.value);
                  setForm(f=>({...f,site:e.target.value||"__custom__"}));
                }
              })
            )
          ,React.createElement('div',{style:{fontSize:10,color:"#555",marginTop:4}},"Sites auto-filled from RCD & IEL modules")
        )
        // Due date
        ,React.createElement('div',{style:{marginBottom:12}}
          ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5}},"DUE DATE")
          ,React.createElement('input',{style:{width:"100%",background:"#1a1a1a",border:`1px solid ${!form.dueDate?"#ef4444":"#333"}`,borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},type:"date",value:form.dueDate,onChange:e=>setForm(f=>({...f,dueDate:e.target.value}))})
        )
        // Recurrence
        ,React.createElement('div',{style:{marginBottom:12}}
          ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5}},"RECURRENCE")
          ,React.createElement('select',{style:{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},value:form.recur,onChange:e=>setForm(f=>({...f,recur:e.target.value}))}
            ,React.createElement('option',{value:"none"},"No recurrence (one-off)")
            ,React.createElement('option',{value:"Monthly"},"Monthly")
            ,React.createElement('option',{value:"3-Monthly"},"Every 3 months")
            ,React.createElement('option',{value:"Annual"},"Annual")
          )
        )
        // Notes
        ,React.createElement('div',{style:{marginBottom:16}}
          ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5}},"NOTES (optional)")
          ,React.createElement('input',{style:{width:"100%",background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},value:form.notes,placeholder:"e.g. Contact: John — 0400 000 000",onChange:e=>setForm(f=>({...f,notes:e.target.value}))})
        )
        ,React.createElement('div',{style:{display:"flex",gap:8}}
          ,React.createElement('button',{style:{flex:1,padding:"13px",background:"#6366f1",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer",opacity:(!form.dueDate||!form.site.trim())?0.5:1},onClick:saveEvent},editId?"Save Changes":"Add Event")
          ,React.createElement('button',{style:{padding:"13px 20px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,cursor:"pointer"},onClick:()=>{setShowAdd(false);setEditId(null);setForm({...blank});}},  "Cancel")
        )
      )
    )

    // Bottom nav
    ,React.createElement('nav',{style:CAL_STYLE.bottomNav}
      ,React.createElement('button',{onClick:()=>{setView("upcoming");setShowAdd(false);},style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",color:view==="upcoming"&&!showAdd?"#818cf8":"#555",borderTop:view==="upcoming"&&!showAdd?"2px solid #6366f1":"2px solid transparent"}}
        ,React.createElement('span',{style:{fontSize:18}},"📋")
        ,React.createElement('span',{style:{fontSize:9,fontWeight:600}},"Upcoming")
      )
      ,React.createElement('button',{onClick:()=>{setView("calendar");setShowAdd(false);},style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",color:view==="calendar"&&!showAdd?"#818cf8":"#555",borderTop:view==="calendar"&&!showAdd?"2px solid #6366f1":"2px solid transparent"}}
        ,React.createElement('span',{style:{fontSize:18}},"📅")
        ,React.createElement('span',{style:{fontSize:9,fontWeight:600}},"Calendar")
      )
      ,React.createElement('button',{onClick:()=>{setShowAdd(true);setEditId(null);setForm({...blank});},style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",color:showAdd?"#818cf8":"#555",borderTop:showAdd?"2px solid #6366f1":"2px solid transparent"}}
        ,React.createElement('span',{style:{fontSize:18}},"➕")
        ,React.createElement('span',{style:{fontSize:9,fontWeight:600}},"Add Event")
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPLETE AUDIT BUTTON — inline confirm, used on Home tab
// ─────────────────────────────────────────────────────────────────────────
function CompleteAuditBtn({ color, label, onComplete }) {
  const [confirm, setConfirm] = React.useState(false);
  if (confirm) {
    return React.createElement('div', {style:{background:"#111",border:`1px solid ${color}55`,borderRadius:10,padding:"12px",marginTop:4}}
      ,React.createElement('div',{style:{fontSize:12,color:"#eee",marginBottom:10,fontWeight:600}},"Archive this audit and reset for next run?")
      ,React.createElement('div',{style:{display:"flex",gap:8}}
        ,React.createElement('button',{style:{flex:1,padding:"11px",background:color,color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer"},onClick:()=>{onComplete();setConfirm(false);}},"✓ Yes, Complete")
        ,React.createElement('button',{style:{flex:1,padding:"11px",background:"transparent",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,cursor:"pointer"},onClick:()=>setConfirm(false)},"Cancel")
      )
    );
  }
  return React.createElement('button',{
    style:{width:"100%",padding:"10px",background:`${color}22`,color:color,border:`1px solid ${color}55`,borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer"},
    onClick:()=>setConfirm(true)},label);
}


// ─────────────────────────────────────────────────────────────────────────
// AUDIT GATE PAGE — shown in audit tab when no audit is in progress
// ─────────────────────────────────────────────────────────────────────────
function AuditGatePage({color, moduleLabel, auditLabel, hasActiveAudit, onGoHome, onCompleteAudit, onEnterAudit, isRCD}) {
  const [confirmComplete, setConfirmComplete] = React.useState(false);
  return React.createElement('div',{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",textAlign:"center",minHeight:"60vh",gap:0}}
    ,React.createElement('div',{style:{fontSize:52,marginBottom:16}},hasActiveAudit?"☑":"📋")
    ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:hasActiveAudit?color:"#555",marginBottom:8,letterSpacing:0.5}}
      ,hasActiveAudit?"AUDIT IN PROGRESS":"NO ACTIVE AUDIT"
    )
    ,hasActiveAudit
      ? React.createElement('div',{style:{fontSize:13,color:"#888",marginBottom:28,lineHeight:1.6}}
          ,"Currently running: "
          ,React.createElement('strong',{style:{color:color}},auditLabel)
          ,React.createElement('br',null)
          ,"Tap Continue to test items, or complete the audit when done."
        )
      : React.createElement('div',{style:{fontSize:13,color:"#555",marginBottom:28,lineHeight:1.6}}
          ,"No audit is currently in progress."
          ,React.createElement('br',null)
          ,"Go to Home to select ",isRCD?"a test type (Push / Injection)":"a category (E-Stops / Lanyards / Isolators)"
          ,React.createElement('br',null)
          ,"and enter your auditor name to begin."
        )
    ,!hasActiveAudit&&React.createElement('button',{
      style:{padding:"14px 32px",background:"#e8731a",color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:16,width:"100%",maxWidth:320},
      onClick:onGoHome},"⌂ Go to Home to Start Audit")
    ,hasActiveAudit&&React.createElement('button',{
      style:{padding:"14px 32px",background:color,color:"#fff",border:"none",borderRadius:14,fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:12,width:"100%",maxWidth:320},
      onClick:onEnterAudit},"☑ Continue Audit →")
    ,hasActiveAudit&&React.createElement('button',{
      style:{padding:"12px 32px",background:"transparent",color:"#888",border:"1px solid #2a2a2a",borderRadius:12,fontSize:13,cursor:"pointer",marginBottom:12,width:"100%",maxWidth:320},
      onClick:onGoHome},"⌂ Back to Home")
    ,hasActiveAudit&&!confirmComplete&&React.createElement('button',{
      style:{padding:"12px 32px",background:"transparent",color:"#555",border:"1px solid #333",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",width:"100%",maxWidth:320},
      onClick:()=>setConfirmComplete(true)},"✓ Complete & Archive Audit")
    ,hasActiveAudit&&confirmComplete&&React.createElement('div',{style:{background:"#1a1a1a",border:"1px solid #333",borderRadius:12,padding:"16px",width:"100%",maxWidth:320}}
      ,React.createElement('div',{style:{fontSize:13,color:"#eee",marginBottom:12,fontWeight:600}},"Archive this audit and mark as complete?")
      ,React.createElement('div',{style:{display:"flex",gap:8}}
        ,React.createElement('button',{style:{flex:1,padding:"11px",background:color,color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer"},onClick:()=>{onCompleteAudit();setConfirmComplete(false);}},"✓ Yes, Complete")
        ,React.createElement('button',{style:{flex:1,padding:"11px",background:"transparent",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,cursor:"pointer"},onClick:()=>setConfirmComplete(false)},"Cancel")
      )
    )
  );
}


// ═════════════════════════════════════════════════════════════════════════
// TEST & TAG MODULE
// Sites → Areas → Items (tagged equipment)
// ═════════════════════════════════════════════════════════════════════════

const K_TAT_PROJECTS = "tat-projects-v1";
const K_TAT_SETTINGS = "tat-settings-v1";
const K_TAT_FREQS = "tat-freqs-v1";
const TAT_DEFAULT_FREQS = [{value:"1",label:"1 Month"},{value:"3",label:"3 Months"},{value:"6",label:"6 Months"},{value:"12",label:"12 Months"}];
const TAT_DEFAULT_EQUIP_TYPES = ["Power Tool","Extension Lead","RCD Portable","Appliance","Double Adaptor","Power Board","Transformer","Other"];
const K_TAT_RESULTS  = "tat-results-v1";   // { siteId: { areaId: { itemId: {...} } } }
const K_TAT_META     = "tat-meta-v1";
const K_TAT_HISTORY  = "tat-history-v1";

const TAT_STATUS = { UNTESTED:"untested", PASS:"pass", FAIL:"fail", NA:"na" };
const TAT_SM = {
  untested:{ label:"—",    bg:"#2a2a2a", fg:"#666",    border:"#333" },
  pass:    { label:"PASS", bg:"#1a2e3d", fg:"#60a5fa", border:"#3b82f6" },
  fail:    { label:"FAIL", bg:"#3d1a1a", fg:"#f87171", border:"#ef4444" },
  na:      { label:"N/A",  bg:"#1e2535", fg:"#64748b", border:"#334155" },
};

const TAT_COLOR = "#3b82f6";

const TAT_EQUIP_TYPES = [
  "Power Tool","Extension Lead","RCD Portable","Appliance",
  "Double Adaptor","Power Board","Transformer","Other"
];

const TAT_FREQUENCIES = [
  { value:"1",  label:"1 Month"  },
  { value:"3",  label:"3 Months" },
  { value:"6",  label:"6 Months" },
  { value:"12", label:"12 Months"},
];

function tatUid()  { return Math.random().toString(36).slice(2,9); }
function tatSlug(s){ return s.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,20)+"-"+tatUid(); }

function addTATMonths(dateStr, months) {
  if(!dateStr) return "";
  try {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + parseInt(months));
    return d.toISOString().slice(0,10);
  } catch(_) { return ""; }
}

function tatGetItem(results, siteId, areaId, itemId) {
  return(((results[siteId]||{})[areaId]||{})[itemId])||{
    status:TAT_STATUS.UNTESTED, visualCheck:false,
    equipType:"", freq:"3", lastTested:"", notes:"", priority:"", tag:"", desc:""
  };
}

function tatGetStatus(results, siteId, areaId, itemId) {
  return tatGetItem(results,siteId,areaId,itemId).status || TAT_STATUS.UNTESTED;
}

function tatAreaSummary(results, siteId, areaId, items) {
  let pass=0,fail=0,na=0,untested=0;
  items.forEach(id=>{
    const v=tatGetStatus(results,siteId,areaId,id);
    if(v===TAT_STATUS.PASS)pass++;
    else if(v===TAT_STATUS.FAIL)fail++;
    else if(v===TAT_STATUS.NA)na++;
    else untested++;
  });
  return{pass,fail,na,untested,total:pass+fail+na+untested};
}

function tatSiteSummary(results, project) {
  let pass=0,fail=0,na=0,untested=0;
  project.areas.forEach(a=>
    a.items.forEach(id=>{
      const v=tatGetStatus(results,project.id,a.id,id);
      if(v===TAT_STATUS.PASS)pass++;
      else if(v===TAT_STATUS.FAIL)fail++;
      else if(v===TAT_STATUS.NA)na++;
      else untested++;
    })
  );
  return{pass,fail,na,untested,total:pass+fail+na+untested};
}

// ─────────────────────────────────────────────────────────────────────────
// T&T EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────
const TAT_C = {
  blue:"FF3B82F6", white:"FFFFFFFF", darkGrey:"FF2D2D2D",
  lightGrey:"FFF5F5F5", midGrey:"FFD9D9D9",
  passWhite:"FFFFFFFF", failRed:"FFFFC7CE", naGrey:"FFF2F2F2",
  priorityU_bg:"FF9B0000",priorityU_font:"FFFFFFFF",
  priorityH_bg:"FFFFC7CE",priorityH_font:"FF9C0006",
  priorityM_bg:"FFFFD966",priorityM_font:"FF7F6000",
  priorityL_bg:"FFE2EFDA",priorityL_font:"FF375623",
};
function tatBorder(s="thin",c=TAT_C.midGrey){return{style:s,color:{rgb:c}};}
function tatAllBorders(){const b=tatBorder();return{top:b,bottom:b,left:b,right:b};}
function tatBtm(){return{bottom:tatBorder("hair")};}
function tatCS(fill,font={},align={},borders={}){return{fill:{patternType:"solid",fgColor:{rgb:fill}},font:{name:"Calibri",sz:10,...font},alignment:{vertical:"center",...align},border:borders};}
function tatPriColor(p){
  if(p==="U")return{bg:TAT_C.priorityU_bg,font:TAT_C.priorityU_font,bold:true};
  if(p==="H")return{bg:TAT_C.priorityH_bg,font:TAT_C.priorityH_font,bold:false};
  if(p==="M")return{bg:TAT_C.priorityM_bg,font:TAT_C.priorityM_font,bold:false};
  if(p==="L")return{bg:TAT_C.priorityL_bg,font:TAT_C.priorityL_font,bold:false};
  return null;
}
function tatDS(ri,pf,priority=""){
  if(priority){const pc=tatPriColor(priority);if(pc)return tatCS(pc.bg,{sz:9,color:{rgb:pc.font},bold:pc.bold},{wrapText:true},tatBtm());}
  let bg=ri%2===0?TAT_C.white:TAT_C.lightGrey,fontColor=TAT_C.darkGrey,bold=false;
  if(pf==="Pass")bg=TAT_C.passWhite;
  if(pf==="Fail"){bg=TAT_C.failRed;fontColor=TAT_C.priorityH_font;bold=true;}
  if(pf==="N/A")bg=TAT_C.naGrey;
  return tatCS(bg,{sz:9,color:{rgb:fontColor},bold},{wrapText:true},tatBtm());
}
function tatSetCell(ws,ref,value,style){const t=typeof value==="number"?"n":"s";ws[ref]={v:value!=null?value:"",t,s:style};}

function exportTATExcel(project, results, meta) {
  const wb=XLSX.utils.book_new();
  const testDate=(meta&&meta.testDate)||"";
  const auditor=(meta&&meta.auditor)||"";
  const sName=project.name||"Site";
  const coLine=[project.company||"Vorick Group Asset Maintenance",project.abn?`ABN: ${project.abn}`:"",project.licence?`Electrical Licence: ${project.licence}`:""].filter(Boolean).join("  |  ");
  const headers=["Area","Asset ID / Tag","Description","Equipment Type","Visual Inspection","Pass / Fail","Date Tested","Test Frequency","Next Test Due","Notes / Comments","Priority (L,M,H,U)"];
  const n=headers.length;
  const cols="ABCDEFGHIJK".slice(0,n).split("");
  const titleSt=tatCS("FF2D2D2D",{bold:true,sz:14,color:{rgb:"FFFFFFFF"}},{horizontal:"left"});
  const subSt=tatCS("FF1E1E1E",{sz:9,color:{rgb:"FFbbbbbb"}},{horizontal:"left"});
  const metaSt=tatCS("FF262626",{sz:9,color:{rgb:"FF999999"}},{horizontal:"left"});
  const spaceSt=tatCS("FF1E1E1E");
  const hdrSt=tatCS(TAT_C.blue,{bold:true,sz:10,color:{rgb:"FFFFFFFF"}},{horizontal:"center",wrapText:true},tatAllBorders());
  const rows=[];
  rows.push([`${sName} — Test & Tag`,...Array(n-1).fill("")]);
  rows.push([coLine,...Array(n-1).fill("")]);
  rows.push([`Auditor: ${auditor}`,"",`Date Tested: ${fmtDate(testDate)}`,...Array(n-3).fill("")]);
  rows.push(Array(n).fill(""));
  rows.push(headers);
  const dataRows=[];
  project.areas.forEach(area=>{
    area.items.forEach(itemId=>{
      const item=tatGetItem(results,project.id,area.id,itemId);
      const st=item.status||TAT_STATUS.UNTESTED;
      const pf=st===TAT_STATUS.PASS?"Pass":st===TAT_STATUS.FAIL?"Fail":st===TAT_STATUS.NA?"N/A":"Untested";
      const freqLabel=TAT_FREQUENCIES.find(f=>f.value===item.freq)?.label||"3 Months";
      const nextDue=item.lastTested?addTATMonths(item.lastTested,parseInt(item.freq||"3")):"";
      rows.push([
        area.name, item.tag||"", item.desc||"", item.equipType||"",
        item.visualCheck?"Yes":"", pf, fmtDate(item.lastTested),
        freqLabel, nextDue, item.notes||"", item.priority||""
      ]);
      dataRows.push({pf,priority:item.priority||""});
    });
  });
  rows.push(Array(n).fill(""));
  rows.push([`Notes: ${(meta&&meta.notes)||""}`,...Array(n-1).fill("")]);
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:20},{wch:14},{wch:30},{wch:16},{wch:14},{wch:10},{wch:12},{wch:14},{wch:14},{wch:36},{wch:10}];
  ws["!rows"]=[{hpt:32},{hpt:16},{hpt:16},{hpt:6},{hpt:40}];
  ws["!merges"]=[
    {s:{r:0,c:0},e:{r:0,c:n-1}},
    {s:{r:1,c:0},e:{r:1,c:n-1}},
    {s:{r:2,c:0},e:{r:2,c:1}},
    {s:{r:2,c:2},e:{r:2,c:n-1}},
    {s:{r:3,c:0},e:{r:3,c:n-1}},
  ];
  cols.forEach(col=>{
    tatSetCell(ws,`${col}1`,(ws[`${col}1`]||{}).v||"",titleSt);
    tatSetCell(ws,`${col}2`,(ws[`${col}2`]||{}).v||"",subSt);
    tatSetCell(ws,`${col}3`,(ws[`${col}3`]||{}).v||"",metaSt);
    tatSetCell(ws,`${col}4`,"",spaceSt);
    tatSetCell(ws,`${col}5`,(ws[`${col}5`]||{}).v||"",hdrSt);
  });
  let row=6;
  dataRows.forEach((dr,ri)=>{
    cols.forEach(col=>{const ref=`${col}${row}`;tatSetCell(ws,ref,(ws[ref]||{}).v||"",tatDS(ri,dr.pf,dr.priority));});
    row++;
  });
  XLSX.utils.book_append_sheet(wb,ws,"Test & Tag");
  const filename=`TAT_${sName.replace(/\s+/g,"_")}_${testDate||"export"}.xlsx`;
  const wbOut=XLSX.write(wb,{bookType:"xlsx",type:"base64",cellStyles:true,bookSST:false});
  if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.shareFile){
    window.webkit.messageHandlers.shareFile.postMessage({base64:wbOut,filename,mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }else{
    const link=document.createElement("a");link.href=`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbOut}`;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// T&T EXCEL IMPORT
// ─────────────────────────────────────────────────────────────────────────
function parseTATExcel(data) {
  const ws=data.Sheets[data.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  let headerIdx=-1;
  for(let i=0;i<Math.min(rows.length,10);i++){
    const r=rows[i].map(c=>String(c).toLowerCase());
    if(r.some(c=>c.includes("area"))&&r.some(c=>c.includes("asset")||c.includes("tag")||c.includes("desc"))){headerIdx=i;break;}
  }
  if(headerIdx===-1)headerIdx=4;
  const header=rows[headerIdx].map(c=>String(c).toLowerCase().trim());
  const col=s=>header.findIndex(h=>h.includes(s));
  const cArea=col("area");
  const cTag=header.findIndex(h=>h.includes("asset")||h.includes("tag"));
  const cDesc=header.findIndex(h=>h.includes("desc")||h.includes("name"));
  const cType=col("type")||col("equip");
  const cFreq=col("freq");
  let siteName="",parsedCompany="",parsedAbn="",parsedLicence="";
  if(rows[0]&&rows[0][0]){const t=String(rows[0][0]);siteName=t.split(/\s*[-–]\s*/)[0].trim()||t;}
  if(rows[1]&&rows[1][0]){const p=parseCompanyRow(rows[1][0]);const raw=String(rows[1][0]).toLowerCase();const looksLikeTitle=raw.includes(" test")||/\d{4}/.test(raw)&&!raw.includes("abn");if(!looksLikeTitle){parsedCompany=p.company||"";}parsedAbn=p.abn||"";parsedLicence=p.licence||"";}
  const areaMap={};
  for(let i=headerIdx+1;i<rows.length;i++){
    const row=rows[i];
    const area=cArea>=0?String(row[cArea]||"").trim():"General";
    const tag=cTag>=0?String(row[cTag]||"").trim():"";
    const desc=cDesc>=0?String(row[cDesc]||"").trim():"";
    if(!tag&&!desc)continue;
    if(!areaMap[area])areaMap[area]=[];
    const itemId=tatUid();
    areaMap[area].push({
      itemId,tag,
      data:{
        tag,desc,
        equipType:cType>=0?String(row[cType]||"").trim():"",
        freq:cFreq>=0&&row[cFreq]?String(row[cFreq]).match(/\d+/)?.[0]||"3":"3",
        status:TAT_STATUS.UNTESTED,visualCheck:false,
        lastTested:"",notes:"",priority:"",
      }
    });
  }
  const siteId=tatSlug(siteName||"site");
  const areas=Object.entries(areaMap).map(([aName,itemArr])=>({
    id:tatSlug(aName),name:aName,
    items:itemArr.map(i=>i.itemId),
    itemNames:Object.fromEntries(itemArr.map(i=>[i.itemId,i.tag||i.data.desc||i.itemId])),
    itemData:Object.fromEntries(itemArr.map(i=>[i.itemId,{tag:i.tag,desc:i.data.desc}])),
  }));
  const results={};
  results[siteId]={};
  Object.entries(areaMap).forEach(([aName,itemArr])=>{
    const areaId=areas.find(a=>a.name===aName).id;
    results[siteId][areaId]={};
    itemArr.forEach(({itemId,data})=>{results[siteId][areaId][itemId]=data;});
  });
  return{siteName,siteId,areas,results,company:parsedCompany,abn:parsedAbn,licence:parsedLicence};
}

function downloadTATTemplate(){
  const wb=XLSX.utils.book_new();
  const rows=[
    ["Area","Asset ID / Tag","Description","Equipment Type","Test Frequency (months)"],
    ["Workshop","TAG-001","Angle Grinder 9\"","Power Tool","3"],
    ["Workshop","TAG-002","10m Extension Lead","Extension Lead","6"],
    ["Office","TAG-003","Laptop Charger","Appliance","12"],
  ];
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"]=[{wch:20},{wch:14},{wch:30},{wch:16},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws,"T&T Template");
  const tOut=XLSX.write(wb,{bookType:"xlsx",type:"base64"});
  if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.shareFile){
    window.webkit.messageHandlers.shareFile.postMessage({base64:tOut,filename:"TAT_Import_Template.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }else{
    const link=document.createElement("a");link.href=`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${tOut}`;link.download="TAT_Import_Template.xlsx";document.body.appendChild(link);link.click();document.body.removeChild(link);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// T&T APP
// ─────────────────────────────────────────────────────────────────────────
function TATApp({ onGoHome }) {
  const [projects,     setProjects]    = React.useState([]);
  const [equipTypes,   setEquipTypes]  = React.useState(TAT_DEFAULT_EQUIP_TYPES);
  const [freqOptions,  setFreqOptions]  = React.useState(TAT_DEFAULT_FREQS);
  const [allResults,   setAllResults]  = React.useState({});
  const [allMeta,      setAllMeta]     = React.useState({});
  const [history,      setHistory]     = React.useState([]);
  const [loaded,       setLoaded]      = React.useState(false);
  const [saveFlash,    setSaveFlash]   = React.useState(false);
  const [activeProject,setActiveProject]=React.useState(null);
  const [view,         setView]        = React.useState("projects"); // projects|home|audit|panel|manage|report|history
  const [activeAreaId, setActiveAreaId]=React.useState(null);
  const [detailItemId, setDetailItemId]=React.useState(null);
  const [auditEntered, setAuditEntered]=React.useState(false);

  React.useEffect(()=>{
    var t=setTimeout(()=>setLoaded(true),3000);
    (async()=>{
      try{
        const[p,r,m,h,et,fq]=await Promise.all([load(K_TAT_PROJECTS,[]),load(K_TAT_RESULTS,{}),load(K_TAT_META,{}),load(K_TAT_HISTORY,[]),load(K_TAT_SETTINGS,TAT_DEFAULT_EQUIP_TYPES),load(K_TAT_FREQS,TAT_DEFAULT_FREQS)]);
        clearTimeout(t);setProjects(p);setAllResults(r);setAllMeta(m);setHistory(h);setEquipTypes(et||TAT_DEFAULT_EQUIP_TYPES);setFreqOptions(fq||TAT_DEFAULT_FREQS);setLoaded(true);
      }catch(e){clearTimeout(t);setLoaded(true);}
    })();
  },[]);

  React.useEffect(()=>{if(loaded)save(K_TAT_PROJECTS,projects);},[projects,loaded]);
  React.useEffect(()=>{if(loaded)save(K_TAT_SETTINGS,equipTypes);},[equipTypes,loaded]);
  React.useEffect(()=>{if(loaded)save(K_TAT_FREQS,freqOptions);},[freqOptions,loaded]);
  React.useEffect(()=>{if(loaded){save(K_TAT_RESULTS,allResults);setSaveFlash(true);const t=setTimeout(()=>setSaveFlash(false),1200);return()=>clearTimeout(t);}},[allResults,loaded]);
  React.useEffect(()=>{if(loaded)save(K_TAT_META,allMeta);},[allMeta,loaded]);
  React.useEffect(()=>{if(loaded)save(K_TAT_HISTORY,history);},[history,loaded]);

  const project=projects.find(p=>p.id===activeProject);
  const meta=allMeta[activeProject]||{auditor:"",testDate:new Date().toISOString().slice(0,10),notes:""};
  const setMeta=patch=>setAllMeta(prev=>({...prev,[activeProject]:{...meta,...patch}}));
  const area=project&&project.areas.find(a=>a.id===activeAreaId);

  const patchItem=(pid,aid,itemId,patch)=>{
    setAllResults(prev=>{
      const old=(((prev[pid]||{})[aid])||{})[itemId]||{};
      return{...prev,[pid]:{...prev[pid],[aid]:{...(prev[pid]||{})[aid],[itemId]:{...old,...patch}}}};
    });
  };

  const archiveAudit=()=>{
    if(!project)return;
    const snap={id:tatUid(),projectId:activeProject,projectName:project.name,auditor:meta.auditor||"",testDate:meta.testDate||"",archivedAt:new Date().toISOString(),results:JSON.parse(JSON.stringify(allResults[activeProject]||{})),meta:{...meta}};
    setHistory(prev=>[snap,...prev].slice(0,100));
    return snap;
  };

  const goProjects=()=>{setView("projects");setActiveProject(null);setActiveAreaId(null);setAuditEntered(false);};
  const goHome=()=>{setView("home");setActiveAreaId(null);};
  const isAudit=view==="audit";
  const hasAuditor=!!(meta.auditor&&meta.auditor.trim());

  const handleBack=()=>{
    if(view==="audit"&&activeAreaId){setActiveAreaId(null);}
    else if(view==="audit"&&auditEntered&&!activeAreaId){setAuditEntered(false);}
    else if(view==="audit"){goHome();}
    else if(view==="home"){goProjects();}
    else if(["manage","report","history","settings"].includes(view)){goHome();}
    else goProjects();
  };

  const summary=project?tatSiteSummary(allResults,project):{total:0,pass:0,fail:0,na:0,untested:0};
  const canGoBack=view!=="projects";

  if(!loaded)return React.createElement('div',{style:ST.loader},React.createElement('div',{style:ST.loaderSpinner}),React.createElement('p',{style:{color:"#aaa",marginTop:16}},"Loading…"));

  return React.createElement('div',{style:ST.root}
    // Header
    ,React.createElement('header',{style:{...ST.topbar,borderBottom:`2px solid ${TAT_COLOR}44`}}
      ,React.createElement('div',{style:ST.topbarLeft}
        ,canGoBack&&React.createElement('button',{style:ST.backBtn,onClick:handleBack},"‹")
        ,React.createElement('div',null
          ,React.createElement('div',{style:{...ST.appTitle,color:TAT_COLOR}},"TEST & TAG")
          ,React.createElement('div',{style:{...ST.appSub,color:TAT_COLOR}},view==="projects"?"Site Select":project?project.name:"")
        )
      )
      ,React.createElement('div',{style:ST.topbarRight}
        ,React.createElement('div',{style:{...ST.saveIndicator,opacity:saveFlash?1:0}},"✓ Saved")
        ,isAudit&&project&&React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:4,background:"#1a1a1a",border:`1px solid #22c55e44`,borderRadius:6,padding:"3px 8px"}}
            ,React.createElement('span',{style:{fontSize:10,color:"#22c55e",fontWeight:700,letterSpacing:0.5}},"PASS")
            ,React.createElement('span',{style:{fontSize:14,color:"#22c55e",fontWeight:800}},summary.pass)
          )
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:4,background:"#1a1a1a",border:`1px solid #ef444444`,borderRadius:6,padding:"3px 8px"}}
            ,React.createElement('span',{style:{fontSize:10,color:"#ef4444",fontWeight:700,letterSpacing:0.5}},"FAIL")
            ,React.createElement('span',{style:{fontSize:14,color:"#ef4444",fontWeight:800}},summary.fail)
          )
        )
        ,React.createElement('button',{style:ST.homeModuleBtn,onClick:onGoHome},"⌂ Modules")
      )
    )

    // Breadcrumb
    ,view!=="projects"&&React.createElement('div',{style:ST.breadcrumb}
      ,React.createElement('span',{style:ST.bcItem,onClick:goProjects},"Sites")
      ,project&&React.createElement(React.Fragment,null,React.createElement('span',{style:ST.bcSep},"›"),React.createElement('span',{style:ST.bcItem,onClick:goHome},project.name))
      ,activeAreaId&&React.createElement(React.Fragment,null,React.createElement('span',{style:ST.bcSep},"›"),React.createElement('span',{style:{...ST.bcItem,color:TAT_COLOR}},area&&area.name))
      ,view==="manage"&&React.createElement(React.Fragment,null,React.createElement('span',{style:ST.bcSep},"›"),React.createElement('span',{style:{...ST.bcItem,color:"#a855f7"}},"Manage"))
      ,view==="history"&&React.createElement(React.Fragment,null,React.createElement('span',{style:ST.bcSep},"›"),React.createElement('span',{style:{...ST.bcItem,color:"#f59e0b"}},"History"))
      ,view==="settings"&&React.createElement(React.Fragment,null,React.createElement('span',{style:ST.bcSep},"›"),React.createElement('span',{style:{...ST.bcItem,color:"#64748b"}},"Dropdowns"))
    )

    // Main
    ,React.createElement('main',{style:ST.main}
      ,view==="projects"&&React.createElement(TATProjectListView,{projects,allResults,onSelect:id=>{setActiveProject(id);setView("home");},
        onAddProject:(p,importedResults)=>{setProjects(prev=>[...prev,p]);if(importedResults)setAllResults(prev=>({...prev,[p.id]:importedResults}));},
        onDeleteProject:id=>{setProjects(prev=>prev.filter(p=>p.id!==id));setAllResults(prev=>{const n={...prev};delete n[id];return n;});if(activeProject===id)goProjects();}})
      ,view==="home"&&project&&React.createElement(TATHomeView,{project,meta,setMeta,results:allResults,summary,
        onStartAudit:()=>{setAuditEntered(true);setView("audit");},
        onReport:()=>setView("report"),onManage:()=>setView("manage"),onHistory:()=>setView("history"),onSettings:()=>setView("settings"),
        onReset:()=>setAllResults(prev=>({...prev,[activeProject]:{}})),
        onExport:()=>exportTATExcel(project,allResults[activeProject]||{},meta),
        onArchive:archiveAudit,auditEntered,
        onCompleteAudit:()=>{archiveAudit();setAllResults(prev=>({...prev,[activeProject]:{}}));setAllMeta(prev=>({...prev,[activeProject]:{auditor:"",testDate:new Date().toISOString().slice(0,10),notes:""}}));setAuditEntered(false);},
      })
      ,isAudit&&project&&!auditEntered&&React.createElement(AuditGatePage,{color:TAT_COLOR,moduleLabel:"TEST & TAG",auditLabel:"",hasActiveAudit:false,onGoHome:goHome,onCompleteAudit:()=>{},onEnterAudit:()=>{},isRCD:false})
      ,isAudit&&project&&auditEntered&&!activeAreaId&&React.createElement(TATAreaListView,{project,results:allResults,onSelect:id=>setActiveAreaId(id)})
      ,isAudit&&project&&auditEntered&&activeAreaId&&React.createElement(TATItemGrid,{area,project,results:allResults,meta,freqOptions,
        onPatch:(itemId,patch)=>patchItem(activeProject,activeAreaId,itemId,patch),
        onOpenDetail:itemId=>{
          // Pre-populate equipType from area metadata if not yet set in results
          const existing=tatGetItem(allResults,project.id,area.id,itemId);
          if(!existing.equipType){
            const areaEquip=(area.itemEquipTypes||{})[itemId]||"";
            if(areaEquip)patchItem(activeProject,activeAreaId,itemId,{equipType:areaEquip});
          }
          setDetailItemId(itemId);
        },
      })
      ,view==="report"&&project&&React.createElement(TATReportView,{project,results:allResults,meta,
        onExport:()=>exportTATExcel(project,allResults[activeProject]||{},meta),onArchive:archiveAudit})
      ,view==="manage"&&project&&React.createElement(TATManageView,{project,equipTypes,onUpdateProject:updated=>setProjects(prev=>prev.map(p=>p.id===updated.id?updated:p))})
      ,view==="settings"&&React.createElement(TATSettingsView,{equipTypes,setEquipTypes,freqOptions,setFreqOptions})
      ,view==="history"&&React.createElement(TATHistoryView,{history:history.filter(h=>h.projectId===activeProject),project,
        onDelete:id=>setHistory(prev=>prev.filter(h=>h.id!==id)),
        onExportSnap:snap=>exportTATExcel(project,snap.results||{},snap.meta||{}),
        onContinueFromSnap:snap=>{setAllResults(prev=>({...prev,[activeProject]:JSON.parse(JSON.stringify(snap.results||{}))}));setAllMeta(prev=>({...prev,[activeProject]:{...snap.meta}}));setAuditEntered(false);setActiveAreaId(null);setView("home");},
      })
    )

    // Item detail modal
    ,detailItemId&&area&&React.createElement(TATItemModal,{equipTypes,freqOptions,
      itemId:detailItemId,area,project,results:allResults,meta,
      onPatch:patch=>patchItem(activeProject,activeAreaId,detailItemId,patch),
      onClose:()=>setDetailItemId(null),
    })

    // Bottom nav
    ,view!=="projects"&&React.createElement('nav',{style:ST.bottomNav}
      ,React.createElement(TATNavBtn,{icon:"⌂",label:"Home",active:view==="home",onClick:goHome})
      ,React.createElement(TATNavBtn,{icon:"☑",label:"Audit",active:isAudit,color:TAT_COLOR,onClick:()=>{setView("audit");setActiveAreaId(null);}})
      ,React.createElement(TATNavBtn,{icon:"≡",label:"Report",active:view==="report",onClick:()=>setView("report")})
      ,React.createElement(TATNavBtn,{icon:"🕐",label:"History",active:view==="history",color:"#f59e0b",onClick:()=>setView("history")})
      ,React.createElement(TATNavBtn,{icon:"⚙",label:"Manage",active:view==="manage",color:"#a855f7",onClick:()=>setView("manage")})
      ,React.createElement(TATNavBtn,{icon:"≔",label:"Dropdowns",active:view==="settings",color:"#64748b",onClick:()=>setView("settings")})
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T PROJECT LIST
// ─────────────────────────────────────────────────────────────────────────
function TATProjectListView({projects,allResults,onSelect,onAddProject,onDeleteProject}){
  const[showAdd,setShowAdd]=React.useState(false);
  const[tab,setTab]=React.useState("manual");
  const[newName,setNewName]=React.useState("");
  const[newCo,setNewCo]=React.useState("");
  const[newAbn,setNewAbn]=React.useState("");
  const[newLic,setNewLic]=React.useState("");
  const[deleteId,setDeleteId]=React.useState(null);
  const[importing,setImporting]=React.useState(false);
  const[importPreview,setImportPreview]=React.useState(null);
  const[importName,setImportName]=React.useState("");
  const[importCo,setImportCo]=React.useState("");
  const[importAbn,setImportAbn]=React.useState("");
  const[importLic,setImportLic]=React.useState("");
  const[importError,setImportError]=React.useState("");
  const fileRef=React.useRef();

  const handleFile=e=>{
    const file=e.target.files[0];if(!file)return;
    setImporting(true);setImportError("");
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=XLSX.read(ev.target.result,{type:"array"});
        const parsed=parseTATExcel(data);
        setImportName(parsed.siteName||file.name.replace(/\.(xlsx|xls|csv)$/i,"").replace(/[_-]+/g," ").trim());
        setImportPreview(parsed);
        if(!importCo&&parsed.company)setImportCo(parsed.company);
        if(!importAbn&&parsed.abn)setImportAbn(parsed.abn);
        if(!importLic&&parsed.licence)setImportLic(parsed.licence);
      }catch(err){setImportError("Could not parse file: "+err.message);}
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  };

  const confirmImport=()=>{
    if(!importPreview)return;
    const sName=importName.trim()||importPreview.siteName||"Imported Site";
    const proj={id:importPreview.siteId,name:sName,company:importCo.trim(),abn:importAbn.trim(),licence:importLic.trim(),areas:importPreview.areas};
    onAddProject(proj,importPreview.results[importPreview.siteId]||{});
    setImportPreview(null);setShowAdd(false);setImportName("");setImportError("");
  };

  return React.createElement('div',{style:ST.listWrap}
    ,React.createElement('div',{style:{...ST.brandBlock,borderColor:TAT_COLOR}}
      ,React.createElement('div',{style:{...ST.brandTitle,color:TAT_COLOR}},"VORICK GROUP")
      ,React.createElement('div',{style:ST.brandSub},"Test & Tag Management")
    )
    ,React.createElement('div',{style:{...ST.listTitle,marginTop:24}},"Sites")
    ,projects.length===0&&React.createElement('div',{style:{color:"#555",fontSize:14,marginBottom:16}},"No sites yet — add one or import from Excel.")
    ,projects.map(proj=>{
      const sum=tatSiteSummary(allResults,proj);
      const pct=sum.total>0?Math.round((sum.pass+sum.na)/sum.total*100):0;
      return React.createElement('div',{key:proj.id,style:{...ST.siteCard,flexDirection:"column",gap:0,padding:0,overflow:"hidden"}}
        ,React.createElement('button',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"16px 18px",color:"inherit",textAlign:"left"},onClick:()=>onSelect(proj.id)}
          ,React.createElement('div',{style:{flex:1}}
            ,React.createElement('div',{style:ST.siteCardName},proj.name)
            ,React.createElement('div',{style:ST.siteCardSub},proj.areas.reduce((s,a)=>s+a.items.length,0)," items · ",proj.areas.length," areas")
            ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
              ,React.createElement('div',{style:{height:"100%",borderRadius:2,transition:"width 0.4s",width:`${pct}%`,background:sum.fail>0?"#ef4444":pct===100?"#22c55e":TAT_COLOR}})
            )
          )
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,marginLeft:16}}
            ,sum.fail>0&&React.createElement('span',{style:ST.failBadge},sum.fail," FAIL")
            ,React.createElement('span',{style:ST.arrow},"›")
          )
        )
        ,deleteId===proj.id
          ?React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,padding:"8px 18px",background:"#1e1010",borderTop:"1px solid #333"}}
            ,React.createElement('span',{style:{fontSize:12,color:"#ef4444",flex:1}},'Delete "',proj.name,'"?')
            ,React.createElement('button',{style:ST.confirmYes,onClick:()=>{onDeleteProject(proj.id);setDeleteId(null);}},"Delete")
            ,React.createElement('button',{style:ST.confirmNo,onClick:()=>setDeleteId(null)},"Cancel")
          )
          :React.createElement('button',{style:{background:"transparent",border:"none",borderTop:"1px solid #2a2a2a",color:"#555",fontSize:11,padding:"6px 18px",cursor:"pointer",textAlign:"left",width:"100%"},onClick:e=>{e.stopPropagation();setDeleteId(proj.id);}},"🗑 Remove site")
      );
    })
    ,showAdd
      ?React.createElement('div',{style:ST.addCard}
        ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:14}}
          ,React.createElement('button',{style:{...ST.tabBtn,...(tab==="manual"?{...ST.tabBtnActive,borderColor:TAT_COLOR,color:TAT_COLOR,background:"#1a2030"}:{})},onClick:()=>setTab("manual")},"✏️ Manual")
          ,React.createElement('button',{style:{...ST.tabBtn,...(tab==="import"?{...ST.tabBtnActive,borderColor:TAT_COLOR,color:TAT_COLOR,background:"#1a2030"}:{})},onClick:()=>setTab("import")},"📥 Import Excel")
        )
        ,tab==="manual"&&React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:"#eee",marginBottom:12}},"New Site")
          ,[["SITE NAME","newName",newName,setNewName,"Site name"],["COMPANY (optional)",null,newCo,setNewCo,"Company name"],["ABN (optional)",null,newAbn,setNewAbn,"e.g. 12 345 678 901"],["ELECTRICAL LICENCE (optional)",null,newLic,setNewLic,"e.g. 123456C"]].map(([label,,val,setter,ph])=>
            React.createElement('div',{key:label,style:{marginBottom:8}}
              ,React.createElement('div',{style:ST.metaLabelText},label)
              ,React.createElement('input',{style:{...ST.metaInput,marginTop:4},value:val,placeholder:ph,onChange:e=>setter(e.target.value)})
            )
          )
          ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:4}}
            ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR},onClick:()=>{if(!newName.trim())return;onAddProject({id:tatSlug(newName),name:newName.trim(),company:newCo.trim(),abn:newAbn.trim(),licence:newLic.trim(),areas:[]},{});setNewName("");setNewCo("");setNewAbn("");setNewLic("");setShowAdd(false);}},"Add Site")
            ,React.createElement('button',{style:ST.ctaSecondary,onClick:()=>setShowAdd(false)},"Cancel")
          )
        )
        ,tab==="import"&&React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:"#eee",marginBottom:4}},"Import from Excel")
          ,React.createElement('div',{style:{fontSize:12,color:"#666",marginBottom:12}},"Columns needed: ",React.createElement('strong',{style:{color:"#aaa"}},"Area | Asset ID/Tag | Description")," — equipment type and frequency imported if present.")
          ,!importPreview&&React.createElement(React.Fragment,null
            ,React.createElement('input',{ref:fileRef,type:"file",accept:".xlsx,.xls,.csv",style:{display:"none"},onChange:handleFile})
            ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,width:"100%",marginBottom:8},onClick:()=>fileRef.current&&fileRef.current.click()},importing?"Parsing…":"📂 Choose Excel / CSV File")
            ,React.createElement('button',{style:{...ST.ctaSecondary,width:"100%",fontSize:12},onClick:downloadTATTemplate},"↓ Download Import Template")
            ,importError&&React.createElement('div',{style:{color:"#f87171",fontSize:12,marginTop:8}},importError)
          )
          ,importPreview&&React.createElement(React.Fragment,null
            ,React.createElement('div',{style:{background:"#0e1a2a",border:`1px solid ${TAT_COLOR}44`,borderRadius:10,padding:"12px",marginBottom:12}}
              ,React.createElement('div',{style:{fontSize:12,fontWeight:700,color:TAT_COLOR,marginBottom:8}},"✓ Preview")
              ,React.createElement('div',{style:{fontSize:12,color:"#aaa",marginBottom:4}},importPreview.areas.length," areas — ",importPreview.areas.reduce((s,a)=>s+a.items.length,0)," items")
              ,importPreview.areas.slice(0,4).map(a=>React.createElement('div',{key:a.id,style:{fontSize:11,color:"#666",marginBottom:2}},a.name," — ",a.items.length," items"))
              ,importPreview.areas.length>4&&React.createElement('div',{style:{fontSize:11,color:"#555"}},"…and ",importPreview.areas.length-4," more")
            )
            ,[["SITE NAME",importName,setImportName,"Site name"],["COMPANY (optional)",importCo,setImportCo,"Company name"],["ABN (optional)",importAbn,setImportAbn,"e.g. 12 345 678 901"],["ELECTRICAL LICENCE (optional)",importLic,setImportLic,"e.g. 123456C"]].map(([label,val,setter,ph])=>
              React.createElement('div',{key:label,style:{marginBottom:8}}
                ,React.createElement('div',{style:ST.metaLabelText},label)
                ,React.createElement('input',{style:{...ST.metaInput,marginTop:4},value:val,placeholder:ph,onChange:e=>setter(e.target.value)})
              )
            )
            ,React.createElement('div',{style:{display:"flex",gap:8}}
              ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR},onClick:confirmImport},"✓ Import Site")
              ,React.createElement('button',{style:ST.ctaSecondary,onClick:()=>setImportPreview(null)},"Re-upload")
              ,React.createElement('button',{style:ST.ctaSecondary,onClick:()=>setShowAdd(false)},"Cancel")
            )
          )
        )
      )
      :React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,width:"100%",marginTop:8},onClick:()=>setShowAdd(true)},"+ Add / Import Site")
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T HOME VIEW
// ─────────────────────────────────────────────────────────────────────────
function TATHomeView({project,meta,setMeta,results,summary,onStartAudit,onReport,onManage,onHistory,onSettings,onReset,onExport,onArchive,auditEntered,onCompleteAudit}){
  const[showExports,setShowExports]=React.useState(false);
  const[confirmReset,setConfirmReset]=React.useState(false);
  const hasAuditor=!!(meta.auditor&&meta.auditor.trim());
  const pct=summary.total>0?Math.round(((summary.pass+summary.na)/summary.total)*100):0;
  return React.createElement('div',{style:ST.homeWrap}
    ,React.createElement('div',{style:{...ST.brandBlock,borderColor:TAT_COLOR}}
      ,React.createElement('div',{style:{...ST.brandTitle,color:TAT_COLOR}},"VORICK GROUP")
      ,React.createElement('div',{style:ST.brandSub},"Test & Tag")
    )
    ,React.createElement('div',{style:ST.siteTitle},project.name)
    ,React.createElement('div',{style:ST.siteSub},project.company||"")
    ,React.createElement('div',{style:ST.metaCard}
      ,React.createElement('div',{style:{marginBottom:10}}
        ,React.createElement('div',{style:ST.metaLabelText},"AUDITOR")
        ,React.createElement('input',{style:{...ST.metaInput,marginTop:4,borderColor:!hasAuditor?"#ef4444":"#333"},value:meta.auditor||"",placeholder:"Enter name to begin audit…",onChange:e=>setMeta({auditor:e.target.value})})
        ,!hasAuditor&&React.createElement('div',{style:{fontSize:11,color:"#ef4444",marginTop:4}},"⚠ Auditor name required before starting")
      )
      ,React.createElement('div',null
        ,React.createElement('div',{style:ST.metaLabelText},"TEST DATE")
        ,React.createElement('input',{style:{...ST.metaInput,marginTop:4,display:"block",width:"100%"},type:"date",value:meta.testDate||"",onChange:e=>setMeta({testDate:e.target.value})})
      )
    )
    ,React.createElement('div',{style:{width:"100%",maxWidth:500,background:"#161616",border:`1px solid ${TAT_COLOR}33`,borderRadius:14,padding:"14px"}}
      ,React.createElement('div',{style:{display:"flex",justifyContent:"space-between",marginBottom:8}}
        ,React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"#eee"}},"Overall Progress")
        ,React.createElement('div',{style:{fontSize:12,color:"#555"}},summary.pass+summary.na," / ",summary.total," tested")
      )
      ,React.createElement('div',{style:{width:"100%",height:8,background:"#2a2a2a",borderRadius:4,overflow:"hidden",marginBottom:10}}
        ,React.createElement('div',{style:{height:"100%",borderRadius:4,transition:"width 0.4s",width:`${pct}%`,background:summary.fail>0?"#ef4444":pct===100?"#22c55e":TAT_COLOR}})
      )
      ,React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap"}}
        ,React.createElement('span',{style:{fontSize:11,color:"#60a5fa"}},summary.pass," Pass")
        ,summary.fail>0&&React.createElement('span',{style:{fontSize:11,color:"#f87171",fontWeight:800}},summary.fail," FAIL")
        ,summary.untested>0&&React.createElement('span',{style:{fontSize:11,color:"#f59e0b"}},summary.untested," untested")
        ,React.createElement('span',{style:{fontSize:11,color:"#555"}},summary.total," total")
      )
    )
    ,React.createElement('button',{
      style:{width:"100%",maxWidth:500,padding:"16px",background:hasAuditor?TAT_COLOR:"#1a1a1a",color:hasAuditor?"#fff":"#555",border:`2px solid ${hasAuditor?TAT_COLOR:"#2a2a2a"}`,borderRadius:16,fontSize:16,fontWeight:800,cursor:hasAuditor?"pointer":"not-allowed",letterSpacing:0.5},
      onClick:()=>hasAuditor&&onStartAudit()}
      ,"☑ Start / Continue Audit"
    )
    ,React.createElement('div',{style:{width:"100%",maxWidth:500,background:"#161616",border:`1px solid ${auditEntered?TAT_COLOR+"44":"#2a2a2a"}`,borderRadius:12,padding:"10px 14px"}}
      ,React.createElement('div',{style:{fontSize:10,color:"#555",fontWeight:700,letterSpacing:0.8,marginBottom:8}},auditEntered?"COMPLETE ACTIVE AUDIT":"ARCHIVE COMPLETED AUDIT")
      ,auditEntered&&React.createElement(CompleteAuditBtn,{color:TAT_COLOR,label:"✓ Complete & Archive Test & Tag Audit",onComplete:onCompleteAudit})
      ,!auditEntered&&React.createElement(CompleteAuditBtn,{color:TAT_COLOR,label:"📁 Archive Completed Audit",onComplete:()=>onArchive&&onArchive()})
    )
    ,React.createElement('div',{style:{width:"100%",maxWidth:500,display:"flex",gap:8,flexWrap:"wrap"}}
      ,React.createElement('button',{style:{...ST.secondaryBtn,flex:1},onClick:onReport},"≡ Report")
      ,React.createElement('button',{style:{...ST.secondaryBtn,flex:1,color:"#f59e0b",borderColor:"#f59e0b33"},onClick:onHistory},"🕐 History")
      ,React.createElement('button',{style:{...ST.secondaryBtn,flex:1,color:"#a855f7",borderColor:"#a855f744"},onClick:onManage},"⚙ Structure")
      ,React.createElement('button',{style:{...ST.secondaryBtn,flex:1,color:"#64748b",borderColor:"#64748b44"},onClick:onSettings},"≔ Dropdowns")
      ,React.createElement('button',{style:{...ST.secondaryBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"},onClick:()=>setShowExports(x=>!x)},"↓ Export")
    )
    ,showExports&&React.createElement('button',{style:{...ST.exportBtn,width:"100%",maxWidth:500,color:TAT_COLOR,borderColor:`${TAT_COLOR}44`,background:"#0a1020"},onClick:onExport},"↓ Export Test & Tag xlsx")
    ,confirmReset
      ?React.createElement('div',{style:{...ST.confirmRow,width:"100%",maxWidth:500}}
        ,React.createElement('span',{style:{color:"#ef4444",fontSize:13,flex:1}},"Reset all test results?")
        ,React.createElement('button',{style:ST.confirmYes,onClick:()=>{onReset();setConfirmReset(false);}},"Yes")
        ,React.createElement('button',{style:ST.confirmNo,onClick:()=>setConfirmReset(false)},"Cancel")
      )
      :React.createElement('button',{style:{background:"transparent",border:"none",color:"#555",fontSize:12,cursor:"pointer",textDecoration:"underline"},onClick:()=>setConfirmReset(true)},"Reset all test results")
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T AREA LIST VIEW
// ─────────────────────────────────────────────────────────────────────────
function TATAreaListView({project,results,onSelect}){
  return React.createElement('div',{style:ST.listWrap}
    ,React.createElement('div',{style:ST.listTitle},"Select Area")
    ,project.areas.length===0&&React.createElement('div',{style:{color:"#555",fontSize:14}},"No areas yet. Go to ⚙ Manage to add areas and items.")
    ,project.areas.map(area=>{
      const s=tatAreaSummary(results,project.id,area.id,area.items);
      const pct=s.total>0?Math.round(((s.pass+s.na)/s.total)*100):0;
      return React.createElement('button',{key:area.id,
        style:{...ST.siteCard,...(s.fail>0?{background:"#1e1010",borderColor:"#ef444455"}:{})},
        onClick:()=>onSelect(area.id)}
        ,React.createElement('div',{style:ST.siteCardLeft}
          ,React.createElement('div',{style:ST.siteCardName},area.name)
          ,React.createElement('div',{style:ST.siteCardSub},s.total," items · ",s.pass+s.na," / ",s.total," tested")
          ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,marginTop:8,overflow:"hidden"}}
            ,React.createElement('div',{style:{height:"100%",borderRadius:2,transition:"width 0.4s",width:`${pct}%`,background:s.fail>0?"#ef4444":pct===100?"#22c55e":TAT_COLOR}})
          )
        )
        ,React.createElement('div',{style:ST.siteCardRight}
          ,s.fail>0&&React.createElement('span',{style:ST.failBadge},s.fail," FAIL")
          ,pct===100&&s.fail===0&&React.createElement('span',{style:{color:"#4ade80",fontSize:18,fontWeight:800}},"✓")
          ,React.createElement('span',{style:ST.arrow},"›")
        )
      );
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T ITEM GRID
// ─────────────────────────────────────────────────────────────────────────
function TATItemGrid({area,project,results,meta,freqOptions,onPatch,onOpenDetail}){
  const s=tatAreaSummary(results,project.id,area.id,area.items);
  const itemNames=area.itemNames||{};
  return React.createElement('div',{style:ST.circuitWrap}
    ,React.createElement('div',{style:ST.panelHeader}
      ,React.createElement('div',null
        ,React.createElement('div',{style:ST.panelTitle},area.name)
        ,React.createElement('div',{style:ST.panelSub},area.items.length," items")
      )
      ,React.createElement('div',{style:ST.panelStats}
        ,React.createElement('span',{style:{color:"#60a5fa"}},s.pass,"P")
        ,React.createElement('span',{style:{color:"#ef4444"}},s.fail,"F")
        ,React.createElement('span',{style:{color:"#f59e0b",fontSize:12}},s.untested," untested")
      )
    )
    ,React.createElement('div',{style:{fontSize:12,color:TAT_COLOR,background:"#0a1020",border:`1px solid ${TAT_COLOR}33`,borderRadius:8,padding:"8px 12px",marginBottom:12}},"🏷 Tap any item to open the test form")
    ,area.items.length===0&&React.createElement('div',{style:{color:"#555",fontSize:13}},"No items. Go to ⚙ Manage to add items.")
    ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:8}}
      ,area.items.map(itemId=>{
        const d=tatGetItem(results,project.id,area.id,itemId);
        const st=d.status||TAT_STATUS.UNTESTED;
        const sm=TAT_SM[st]||TAT_SM.untested;
        const rawName=itemNames[itemId]||d.tag||itemId;
        const tagNum=(area.itemTags||{})[itemId]||d.tag||"";
        const cleanName=rawName.replace(/^\d+\s*—\s*/,"");
        const freqLabel=(freqOptions||TAT_DEFAULT_FREQS).find(f=>f.value===d.freq)?.label||"3 Months";
        return React.createElement('div',{key:itemId,
          style:{display:"flex",alignItems:"stretch",background:sm.bg,border:`2px solid ${sm.border}`,borderRadius:12,overflow:"hidden",cursor:"pointer",boxShadow:st!==TAT_STATUS.UNTESTED?`0 0 10px ${sm.border}44`:"none"},
          onClick:()=>onOpenDetail(itemId)}
          ,React.createElement('div',{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"12px 4px",borderRight:`1px solid ${sm.border}44`}}
            ,React.createElement('div',{style:{fontSize:11,fontWeight:800,color:sm.fg,letterSpacing:0.5}},sm.label)
          )
          ,React.createElement('div',{style:{flex:1,padding:"12px 14px",minWidth:0}}
            ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6,marginBottom:2}}
              ,tagNum&&React.createElement('span',{style:{fontSize:10,fontWeight:800,color:TAT_COLOR,background:`${TAT_COLOR}22`,borderRadius:4,padding:"1px 6px"}},tagNum)
              ,React.createElement('span',{style:{fontSize:14,fontWeight:800,color:"#eee"}},cleanName)
            )
            ,d.equipType&&React.createElement('div',{style:{fontSize:11,color:"#666",marginBottom:4}},d.equipType)
            ,React.createElement('div',{style:{display:"flex",gap:10,fontSize:11,color:"#555",flexWrap:"wrap"}}
              ,React.createElement('span',{style:{color:d.visualCheck?"#22c55e":"#444",fontWeight:600}},d.visualCheck?"✓":"○"," Visual")
              ,d.lastTested&&React.createElement('span',null,"Tested: ",fmtDate(d.lastTested))
              ,React.createElement('span',null,freqLabel)
            )
            ,d.notes&&React.createElement('div',{style:{fontSize:10,color:"#e8731a",marginTop:3}},"✎ ",d.notes.slice(0,40))
          )
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",padding:"0 12px",color:"#555",fontSize:20}},"›")
        );
      })
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T ITEM MODAL — test form
// ─────────────────────────────────────────────────────────────────────────
function TATItemModal({itemId,area,project,results,meta,onPatch,onClose,equipTypes,freqOptions}){
  const item=tatGetItem(results,project.id,area.id,itemId);
  const name=(area.itemNames||{})[itemId]||item.tag||item.desc||itemId;
  const sm=TAT_SM[item.status||TAT_STATUS.UNTESTED]||TAT_SM.untested;
  const canPass=item.visualCheck;

  const setStatus=s=>{
    if(s===TAT_STATUS.PASS&&!canPass)return;
    const testDate=meta.testDate||new Date().toISOString().slice(0,10);
    onPatch({status:s,...(s===TAT_STATUS.PASS||s===TAT_STATUS.FAIL?{lastTested:testDate}:{})});
  };

  const toggleVisual=()=>{
    const newVal=!item.visualCheck;
    const newStatus=!newVal&&item.status===TAT_STATUS.PASS?TAT_STATUS.UNTESTED:item.status;
    onPatch({visualCheck:newVal,status:newStatus});
  };

  const nextDue=item.lastTested?addTATMonths(item.lastTested,parseInt(item.freq||"3")):"";

  return React.createElement('div',{style:ST.modalOverlay,onClick:onClose}
    ,React.createElement('div',{style:ST.modalBox,onClick:e=>e.stopPropagation()}
      ,React.createElement('div',{style:ST.modalHeader}
        ,React.createElement('div',null
          ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8}}
            ,(area.itemTags||{})[itemId]&&React.createElement('span',{style:{fontSize:12,fontWeight:800,color:TAT_COLOR,background:`${TAT_COLOR}22`,borderRadius:6,padding:"2px 8px"}},(area.itemTags||{})[itemId])
            ,React.createElement('span',{style:{fontSize:18,fontWeight:800,color:"#eee"}},name.replace(/^\d+\s*—\s*/,""))
          )
          ,React.createElement('div',{style:{fontSize:12,color:"#666",marginTop:3}},area.name," · Test & Tag")
        )
        ,React.createElement('div',{style:{padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:800,background:sm.bg,color:sm.fg,border:`1.5px solid ${sm.border}`}},sm.label)
      )

      // Equipment type + frequency
      ,React.createElement('div',{style:{display:"flex",gap:10,marginBottom:14}}
        ,React.createElement('div',{style:{flex:2}}
          ,React.createElement('label',{style:ST.modalLabel},"EQUIPMENT TYPE")
          ,React.createElement('select',{style:ST.modalInput,value:item.equipType||"",onChange:e=>onPatch({equipType:e.target.value})}
            ,React.createElement('option',{value:""},"— Select type")
            ,(equipTypes||TAT_DEFAULT_EQUIP_TYPES).map(t=>React.createElement('option',{key:t,value:t},t))
          )
        )
        ,React.createElement('div',{style:{flex:1}}
          ,React.createElement('label',{style:ST.modalLabel},"TEST FREQ.")
          ,React.createElement('select',{style:ST.modalInput,value:item.freq||"3",onChange:e=>onPatch({freq:e.target.value})}
            ,(freqOptions||TAT_DEFAULT_FREQS).map(f=>React.createElement('option',{key:f.value,value:f.value},f.label))
          )
        )
      )

      // Visual inspection checkbox
      ,React.createElement('div',{style:{marginBottom:16}}
        ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:8}},"INSPECTION CHECK")
        ,React.createElement('button',{
          style:{display:"flex",alignItems:"center",gap:12,padding:"14px",background:item.visualCheck?"#1a3d1a":"#1a1a1a",border:`2px solid ${item.visualCheck?"#22c55e":"#333"}`,borderRadius:12,cursor:"pointer",color:"#eee",textAlign:"left",width:"100%"},
          onClick:toggleVisual}
          ,React.createElement('div',{style:{width:28,height:28,borderRadius:6,background:item.visualCheck?"#22c55e":"#2a2a2a",border:`2px solid ${item.visualCheck?"#22c55e":"#444"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
            ,item.visualCheck&&React.createElement('span',{style:{color:"#fff",fontSize:16,fontWeight:900}},"✓")
          )
          ,React.createElement('div',null
            ,React.createElement('div',{style:{fontSize:14,fontWeight:700,color:item.visualCheck?"#4ade80":"#aaa"}},"Visual Inspection")
            ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Check for physical damage, cord condition, plug integrity")
          )
        )
      )

      // Result
      ,React.createElement('div',{style:{marginBottom:14}}
        ,React.createElement('div',{style:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:8}},"RESULT")
        ,!canPass&&React.createElement('div',{style:{background:"#1e1e00",border:"1px solid #f59e0b44",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#f59e0b"}},"⚠ Visual inspection must be ticked before marking PASS")
        ,React.createElement('div',{style:{display:"flex",gap:8}}
          ,[TAT_STATUS.PASS,TAT_STATUS.FAIL,TAT_STATUS.NA,TAT_STATUS.UNTESTED].map(s=>{
            const sm2=TAT_SM[s]||TAT_SM.untested;
            const active=(item.status||TAT_STATUS.UNTESTED)===s;
            const blocked=s===TAT_STATUS.PASS&&!canPass;
            return React.createElement('button',{key:s,
              style:{flex:1,padding:"12px 4px",borderRadius:8,fontSize:12,fontWeight:800,cursor:blocked?"not-allowed":"pointer",border:`2px solid ${active?sm2.border:"#333"}`,background:active?sm2.bg:"#1a1a1a",color:active?sm2.fg:blocked?"#333":"#555",opacity:blocked?0.4:1},
              onClick:()=>setStatus(s)},sm2.label);
          })
        )
      )

      // Date tested
      ,React.createElement('div',{style:ST.modalField}
        ,React.createElement('label',{style:ST.modalLabel},"DATE TESTED")
        ,React.createElement('input',{style:ST.modalInput,type:"date",value:item.lastTested||"",onChange:e=>onPatch({lastTested:e.target.value})})
      )

      // Next due
      ,nextDue&&React.createElement('div',{style:{display:"flex",alignItems:"center",background:"#111",border:`1px solid ${TAT_COLOR}33`,borderRadius:8,padding:"10px 14px",marginBottom:14}}
        ,React.createElement('span',{style:{color:"#888",fontSize:11}},"NEXT TEST DUE:")
        ,React.createElement('span',{style:{color:TAT_COLOR,fontWeight:800,fontSize:13,marginLeft:8}},nextDue)
        ,React.createElement('span',{style:{color:"#555",fontSize:11,marginLeft:8}},"(",TAT_FREQUENCIES.find(f=>f.value===item.freq)?.label||"3 Months",")")
      )

      // Notes
      ,React.createElement('div',{style:ST.modalField}
        ,React.createElement('label',{style:ST.modalLabel},"NOTES / COMMENTS")
        ,React.createElement('textarea',{style:{...ST.modalInput,minHeight:72,resize:"vertical"},placeholder:"Defect details, action required…",value:item.notes||"",onChange:e=>onPatch({notes:e.target.value})})
      )

      // Priority (only on fail)
      ,item.status===TAT_STATUS.FAIL&&React.createElement('div',{style:ST.modalField}
        ,React.createElement('label',{style:ST.modalLabel},"PRIORITY")
        ,React.createElement('select',{style:ST.modalInput,value:item.priority||"",onChange:e=>onPatch({priority:e.target.value})}
          ,React.createElement('option',{value:""},"— Select")
          ,React.createElement('option',{value:"L"},"L – Low")
          ,React.createElement('option',{value:"M"},"M – Medium")
          ,React.createElement('option',{value:"H"},"H – High")
          ,React.createElement('option',{value:"U"},"U – Urgent")
        )
      )

      ,React.createElement('button',{style:{...ST.modalClose,background:TAT_COLOR,color:"#fff"},onClick:onClose},"Done")
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T REPORT VIEW
// ─────────────────────────────────────────────────────────────────────────
function TATReportView({project,results,meta,onExport,onArchive}){
  const[archiveMsg,setArchiveMsg]=React.useState("");
  const sum=tatSiteSummary(results,project);
  const handleArchive=()=>{onArchive();setArchiveMsg("Audit archived!");setTimeout(()=>setArchiveMsg(""),2500);};
  return React.createElement('div',{style:ST.summaryWrap}
    ,React.createElement('div',{style:{...ST.summaryTitle,color:TAT_COLOR}},"TEST & TAG REPORT")
    ,React.createElement('div',{style:ST.summaryMeta},project.name," · Auditor: ",meta.auditor||"—"," · ",fmtDate(meta.testDate))
    ,React.createElement('div',{style:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}
      ,[["Total",sum.total,"#94a3b8"],["Pass",sum.pass,"#60a5fa"],["Fail",sum.fail,"#ef4444"],["N/A",sum.na,"#64748b"],["Untested",sum.untested,"#f59e0b"]].map(([l,v,c])=>
        React.createElement('div',{key:l,style:{flex:1,textAlign:"center",background:"#1a1a1a",borderRadius:10,border:`1px solid ${c}33`,padding:"10px 4px",minWidth:48}}
          ,React.createElement('div',{style:{fontSize:22,fontWeight:800,color:c}},v)
          ,React.createElement('div',{style:{fontSize:9,color:"#666",marginTop:2}},l.toUpperCase())
        )
      )
    )
    ,React.createElement('div',{style:{marginBottom:16}}
      ,React.createElement('div',{style:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1,marginBottom:10}},"BY AREA")
      ,project.areas.map(area=>{
        const as=tatAreaSummary(results,project.id,area.id,area.items);
        const pct=as.total>0?Math.round(((as.pass+as.na)/as.total)*100):0;
        return React.createElement('div',{key:area.id,style:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:10,padding:"10px 14px",marginBottom:8}}
          ,React.createElement('div',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}
            ,React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"#eee"}},area.name)
            ,React.createElement('div',{style:{fontSize:11,color:"#555"}},as.pass+as.na," / ",as.total)
          )
          ,React.createElement('div',{style:{width:"100%",height:4,background:"#2a2a2a",borderRadius:2,overflow:"hidden"}}
            ,React.createElement('div',{style:{height:"100%",borderRadius:2,width:`${pct}%`,background:as.fail>0?"#ef4444":pct===100?"#22c55e":TAT_COLOR}})
          )
          ,as.fail>0&&React.createElement('div',{style:{fontSize:11,color:"#f87171",marginTop:4,fontWeight:700}},as.fail," FAIL")
        );
      })
    )
    ,React.createElement('div',{style:{display:"flex",gap:8}}
      ,React.createElement('button',{style:{...ST.exportBtn,flex:1,color:TAT_COLOR,borderColor:`${TAT_COLOR}44`,background:"#0a1020"},onClick:onExport},"↓ Export xlsx")
      ,React.createElement('button',{style:{...ST.exportBtn,flex:1,color:TAT_COLOR,borderColor:`${TAT_COLOR}44`},onClick:handleArchive},"📁 Archive")
    )
    ,archiveMsg&&React.createElement('div',{style:{fontSize:12,color:"#4ade80",marginTop:8,textAlign:"center"}},"✓ ",archiveMsg)
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T MANAGE VIEW
// ─────────────────────────────────────────────────────────────────────────
function TATManageView({project,onUpdateProject,equipTypes}){
  const[expandedArea,setExpandedArea]=React.useState(null);
  const[newAreaName,setNewAreaName]=React.useState("");
  const[newItemName,setNewItemName]=React.useState({});   // appliance name
  const[newItemTag,setNewItemTag]=React.useState({});     // asset ID
  const[newItemEquip,setNewItemEquip]=React.useState({}); // equipment type
  const[bulkItems,setBulkItems]=React.useState({});
  const[editingProject,setEditingProject]=React.useState(false);
  const[projName,setProjName]=React.useState(project.name);

  // Auto-next tag — looks at ALL itemTags across ALL areas in this site
  const nextTag=()=>{
    const allNums=[];
    project.areas.forEach(a=>{
      Object.values(a.itemTags||{}).forEach(t=>{
        if(t){const m=String(t).match(/(\d+)/);if(m)allNums.push(parseInt(m[1]));}
      });
    });
    const max=allNums.length>0?Math.max(...allNums):0;
    return String(max+1).padStart(3,"0");
  };

  const upd=u=>onUpdateProject(u);
  const addArea=()=>{
    if(!newAreaName.trim())return;
    upd({...project,areas:[...project.areas,{id:tatSlug(newAreaName),name:newAreaName.trim(),items:[],itemNames:{},itemTags:{},itemEquipTypes:{}}]});
    setNewAreaName("");
  };
  const delArea=id=>upd({...project,areas:project.areas.filter(a=>a.id!==id)});
  const addItem=(areaId)=>{
    const n=(newItemName[areaId]||"").trim();if(!n)return;
    const tag=(newItemTag[areaId]||nextTag()).trim();
    const eType=(newItemEquip[areaId]||"").trim();
    const itemId=tatUid();
    const displayName=tag?`${tag} — ${n}`:n;
    upd({...project,areas:project.areas.map(a=>a.id===areaId?{
      ...a,
      items:[...a.items,itemId],
      itemNames:{...(a.itemNames||{}),[itemId]:displayName},
      itemTags:{...(a.itemTags||{}),[itemId]:tag},
      itemEquipTypes:{...(a.itemEquipTypes||{}),[itemId]:eType},
    }:a)});
    setNewItemName(x=>({...x,[areaId]:""}));
    setNewItemTag(x=>({...x,[areaId]:""}));
    setNewItemEquip(x=>({...x,[areaId]:""}));
  };
  const addBulk=(areaId)=>{
    const raw=(bulkItems[areaId]||"").trim();if(!raw)return;
    const names=raw.split(",").map(s=>s.trim()).filter(Boolean);
    let tagNum=parseInt(nextTag())||1;
    const newItems=names.map(n=>{
      const tag=String(tagNum).padStart(3,"0");
      tagNum++;
      const itemId=tatUid();
      return{itemId,name:`${tag} — ${n}`,tag,n};
    });
    upd({...project,areas:project.areas.map(a=>a.id===areaId?{
      ...a,
      items:[...a.items,...newItems.map(i=>i.itemId)],
      itemNames:{...(a.itemNames||{}),...Object.fromEntries(newItems.map(i=>[i.itemId,i.name]))},
      itemTags:{...(a.itemTags||{}),...Object.fromEntries(newItems.map(i=>[i.itemId,i.tag]))},
    }:a)});
    setBulkItems(x=>({...x,[areaId]:""}));
  };
  const delItem=(areaId,itemId)=>upd({...project,areas:project.areas.map(a=>{
    if(a.id!==areaId)return a;
    const mn={...(a.itemNames||{})};const mt={...(a.itemTags||{})};const me={...(a.itemEquipTypes||{})};
    delete mn[itemId];delete mt[itemId];delete me[itemId];
    return{...a,items:a.items.filter(i=>i!==itemId),itemNames:mn,itemTags:mt,itemEquipTypes:me};
  })});

  return React.createElement('div',{style:ST.listWrap}
    ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:"#a855f7",marginBottom:16}},"⚙ Manage")
    ,React.createElement('div',{style:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:12,padding:"12px 14px",marginBottom:14}}
      ,editingProject
        ?React.createElement(React.Fragment,null
          ,React.createElement('div',{style:{marginBottom:8}},React.createElement('div',{style:ST.metaLabelText},"SITE NAME"),React.createElement('input',{style:{...ST.metaInput,marginTop:4},value:projName,onChange:e=>setProjName(e.target.value)}))
          ,React.createElement('div',{style:{display:"flex",gap:8}},React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR},onClick:()=>{upd({...project,name:projName.trim()||project.name});setEditingProject(false);}},"Save"),React.createElement('button',{style:ST.ctaSecondary,onClick:()=>setEditingProject(false)},"Cancel"))
        )
        :React.createElement('div',{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}}
          ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:"#eee"}},project.name)
          ,React.createElement('button',{style:{...ST.smallBtn,color:"#a855f7",borderColor:"#a855f755"},onClick:()=>setEditingProject(true)},"✏️ Edit")
        )
    )
    ,React.createElement('div',{style:{fontSize:11,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:10}},"AREAS")
    ,project.areas.length===0&&React.createElement('div',{style:{color:"#555",fontSize:13,marginBottom:12}},"No areas yet.")
    ,project.areas.map(area=>
      React.createElement('div',{key:area.id,style:{border:`1px solid ${expandedArea===area.id?"#a855f755":"#2a2a2a"}`,borderRadius:12,marginBottom:10,overflow:"hidden"}}
        ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",background:"#1a1a1a"}}
          ,React.createElement('button',{style:{flex:1,display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",color:"inherit",textAlign:"left",padding:0},onClick:()=>setExpandedArea(expandedArea===area.id?null:area.id)}
            ,React.createElement('span',{style:{fontSize:16,color:expandedArea===area.id?"#c084fc":"#aaa"}},expandedArea===area.id?"▾":"▸")
            ,React.createElement('span',{style:{fontWeight:700,color:"#eee",fontSize:14}},area.name)
            ,React.createElement('span',{style:{fontSize:11,color:"#555"}},(area.items||[]).length," items")
          )
          ,React.createElement('button',{style:{...ST.smallBtn,color:"#ef4444",borderColor:"#ef444433"},onClick:()=>delArea(area.id)},"🗑")
        )
        ,expandedArea===area.id&&React.createElement('div',{style:{padding:"8px 12px 12px"}}
          ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}
            ,(area.items||[]).map(itemId=>{
              const mn=(area.itemNames||{})[itemId]||itemId;
              const tag=(area.itemTags||{})[itemId]||"";
              const eType=(area.itemEquipTypes||{})[itemId]||"";
              return React.createElement('div',{key:itemId,style:{display:"flex",alignItems:"center",gap:6,background:"#1e1e1e",border:`1px solid ${TAT_COLOR}33`,borderRadius:8,padding:"6px 10px"}}
                ,tag&&React.createElement('span',{style:{fontSize:10,color:TAT_COLOR,fontWeight:800,background:`${TAT_COLOR}22`,borderRadius:4,padding:"1px 6px",flexShrink:0}},tag)
                ,React.createElement('span',{style:{fontSize:12,color:"#ccc",fontWeight:600,flex:1}},mn.replace(/^\d+\s*—\s*/,""))
                ,eType&&React.createElement('span',{style:{fontSize:10,color:"#555"}},eType)
                ,React.createElement('button',{style:{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12,padding:"0 0 0 4px",flexShrink:0},onClick:()=>delItem(area.id,itemId)},"✕")
              );
            })
            ,(area.items||[]).length===0&&React.createElement('span',{style:{fontSize:12,color:"#555"}},"No items")
          )
          ,React.createElement('div',{style:{background:"#111",border:`1px solid ${TAT_COLOR}22`,borderRadius:10,padding:"10px",marginBottom:8}}
            ,React.createElement('div',{style:{fontSize:10,color:"#555",fontWeight:700,letterSpacing:0.8,marginBottom:8}},"ADD ITEM")
            ,React.createElement('div',{style:{display:"flex",gap:6,marginBottom:6}}
              ,React.createElement('div',{style:{flex:1}}
                ,React.createElement('div',{style:{fontSize:9,color:"#555",marginBottom:3}},"ASSET ID / TAG (auto)")
                ,React.createElement('input',{style:{...ST.smallInput,width:"100%"},placeholder:nextTag(),value:newItemTag[area.id]||"",onChange:e=>setNewItemTag(x=>({...x,[area.id]:e.target.value}))})
              )
              ,React.createElement('div',{style:{flex:2}}
                ,React.createElement('div',{style:{fontSize:9,color:"#555",marginBottom:3}},"APPLIANCE NAME *")
                ,React.createElement('input',{
                  list:`names-${area.id}`,
                  style:{...ST.smallInput,width:"100%"},
                  placeholder:'e.g. Angle Grinder 9"',
                  value:newItemName[area.id]||"",
                  onChange:e=>setNewItemName(x=>({...x,[area.id]:e.target.value})),
                  onKeyDown:e=>e.key==="Enter"&&addItem(area.id)
                })
                ,React.createElement('datalist',{id:`names-${area.id}`}
                  ,...[...new Set(project.areas.flatMap(a=>
                    (a.items||[]).map(id=>(a.itemNames||{})[id]||"").filter(Boolean).map(n=>n.replace(/^\d+\s*—\s*/,""))
                  ))].map(n=>React.createElement('option',{key:n,value:n}))
                )
              )
            )
            ,React.createElement('div',{style:{display:"flex",gap:6,marginBottom:8}}
              ,React.createElement('div',{style:{flex:1}}
                ,React.createElement('div',{style:{fontSize:9,color:"#555",marginBottom:3}},"EQUIPMENT TYPE")
                ,React.createElement('select',{style:{...ST.smallInput,width:"100%"},value:newItemEquip[area.id]||"",onChange:e=>setNewItemEquip(x=>({...x,[area.id]:e.target.value}))}
                  ,React.createElement('option',{value:""},"— Optional")
                  ,(equipTypes||TAT_DEFAULT_EQUIP_TYPES).map(t=>React.createElement('option',{key:t,value:t},t))
                )
              )
            )
            ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,width:"100%",padding:"9px",fontSize:13},onClick:()=>addItem(area.id)},"+ Add Item")
          )
          ,React.createElement('div',{style:{fontSize:10,color:"#555",marginBottom:4}},"BULK ADD (comma-separated appliance names)")
          ,React.createElement('div',{style:{display:"flex",gap:6}}
            ,React.createElement('input',{style:{...ST.smallInput,flex:1},placeholder:"Grinder, Drill, Lead 10m",value:bulkItems[area.id]||"",onChange:e=>setBulkItems(x=>({...x,[area.id]:e.target.value})),onKeyDown:e=>e.key==="Enter"&&addBulk(area.id)})
            ,React.createElement('button',{style:{...ST.smallBtn,color:"#4ade80",borderColor:"#22c55e55"},onClick:()=>addBulk(area.id)},"+ Bulk")
          )
        )
      )
    )
    ,React.createElement('div',{style:{display:"flex",gap:6,marginTop:12}}
      ,React.createElement('input',{style:{...ST.smallInput,flex:1},placeholder:"New area name",value:newAreaName,onChange:e=>setNewAreaName(e.target.value),onKeyDown:e=>e.key==="Enter"&&addArea()})
      ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,padding:"10px 16px",fontSize:13},onClick:addArea},"+ Area")
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T HISTORY VIEW
// ─────────────────────────────────────────────────────────────────────────
function TATHistoryView({history,project,onDelete,onExportSnap,onContinueFromSnap}){
  const[expanded,setExpanded]=React.useState(null);
  const[deleteId,setDeleteId]=React.useState(null);
  const[viewSnap,setViewSnap]=React.useState(null);

  if(viewSnap){
    const snap=viewSnap;
    let pass=0,fail=0,na=0,unt=0,total=0;
    if(project){project.areas.forEach(a=>(a.items||[]).forEach(id=>{total++;const v=(((snap.results||{})[a.id]||{})[id]);const st=(v&&v.status)||TAT_STATUS.UNTESTED;if(st===TAT_STATUS.PASS)pass++;else if(st===TAT_STATUS.FAIL)fail++;else if(st===TAT_STATUS.NA)na++;else unt++;}));}
    return React.createElement('div',{style:ST.listWrap}
      ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:12,marginBottom:16}}
        ,React.createElement('button',{style:{...ST.smallBtn,color:"#aaa"},onClick:()=>setViewSnap(null)},"‹ Back")
        ,React.createElement('div',{style:{flex:1}}
          ,React.createElement('div',{style:{fontSize:15,fontWeight:800,color:TAT_COLOR}},"Test & Tag Snapshot")
          ,React.createElement('div',{style:{fontSize:11,color:"#555"}},fmtDate(snap.testDate)," · ",snap.auditor||"No auditor"," · Read-only")
        )
        ,React.createElement('button',{style:{...ST.smallBtn,color:"#4ade80",borderColor:"#22c55e44",marginLeft:"auto"},onClick:()=>onExportSnap(snap)},"↓ Export")
      )
      ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}
        ,[["Pass",pass,"#60a5fa"],["Fail",fail,"#ef4444"],["N/A",na,"#64748b"],["Untested",unt,"#f59e0b"]].map(([l,v,c])=>
          React.createElement('div',{key:l,style:{background:"#1a1a1a",border:`1px solid ${c}33`,borderRadius:8,padding:"6px 12px",textAlign:"center",flex:1}}
            ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:c}},v)
            ,React.createElement('div',{style:{fontSize:10,color:"#666"}},l)
          )
        )
      )
      ,project&&project.areas.map(area=>{
        const aItems=(area.items||[]);
        if(!aItems.length)return null;
        return React.createElement('div',{key:area.id,style:{marginBottom:16}}
          ,React.createElement('div',{style:{fontSize:13,fontWeight:700,color:"#aaa",marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${TAT_COLOR}33`}},area.name)
          ,aItems.map(id=>{
            const mn=(area.itemNames||{})[id]||id;
            const tag=(area.itemTags||{})[id]||"";
            const v=(((snap.results||{})[area.id]||{})[id])||{};
            const st=v.status||TAT_STATUS.UNTESTED;
            const sm=TAT_SM[st]||TAT_SM.untested;
            return React.createElement('div',{key:id,style:{display:"flex",alignItems:"stretch",background:sm.bg,border:`2px solid ${sm.border}44`,borderRadius:10,marginBottom:6,overflow:"hidden"}}
              ,React.createElement('div',{style:{width:52,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${sm.border}44`,padding:"10px 4px"}}
                ,React.createElement('span',{style:{fontSize:10,fontWeight:800,color:sm.fg}},sm.label)
              )
              ,React.createElement('div',{style:{flex:1,padding:"8px 12px",minWidth:0}}
                ,React.createElement('div',{style:{display:"flex",alignItems:"center",gap:6}}
                  ,tag&&React.createElement('span',{style:{fontSize:9,fontWeight:800,color:TAT_COLOR,background:`${TAT_COLOR}22`,borderRadius:3,padding:"1px 5px"}},tag)
                  ,React.createElement('span',{style:{fontSize:13,fontWeight:700,color:"#eee"}},mn.replace(/^\d+\s*—\s*/,""))
                )
                ,React.createElement('div',{style:{display:"flex",gap:8,fontSize:10,color:"#555",marginTop:3}}
                  ,React.createElement('span',{style:{color:v.visualCheck?"#22c55e":"#444"}},v.visualCheck?"✓":"✕"," Visual")
                  ,v.lastTested&&React.createElement('span',null,"Tested: ",fmtDate(v.lastTested))
                )
                ,v.notes&&React.createElement('div',{style:{fontSize:10,color:"#e8731a",marginTop:2}},"✎ ",v.notes)
              )
            );
          })
        );
      })
    );
  }

  if(history.length===0)return React.createElement('div',{style:ST.listWrap},React.createElement('div',{style:ST.listTitle},"Test & Tag History"),React.createElement('div',{style:{color:"#555",fontSize:14}},"No archived audits yet."));
  return React.createElement('div',{style:ST.listWrap}
    ,React.createElement('div',{style:ST.listTitle},"Test & Tag History")
    ,React.createElement('div',{style:{fontSize:12,color:"#555",marginBottom:16}},history.length," saved audit",history.length!==1?"s":"")
    ,history.map(snap=>{
      let pass=0,fail=0,total=0;
      if(project){project.areas.forEach(a=>{(a.items||[]).forEach(id=>{total++;const v=(((snap.results||{})[a.id]||{})[id]);const st=(v&&v.status)||TAT_STATUS.UNTESTED;if(st===TAT_STATUS.PASS)pass++;else if(st===TAT_STATUS.FAIL)fail++;});});}
      return React.createElement('div',{key:snap.id,style:{...ST.siteCard,flexDirection:"column",padding:0,marginBottom:10,overflow:"hidden"}}
        ,React.createElement('button',{style:{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"transparent",border:"none",cursor:"pointer",padding:"14px 16px",color:"inherit",textAlign:"left"},onClick:()=>setExpanded(expanded===snap.id?null:snap.id)}
          ,React.createElement('div',{style:{flex:1}}
            ,React.createElement('div',{style:{fontSize:14,fontWeight:800,color:TAT_COLOR,marginBottom:4}},"Test & Tag Audit")
            ,React.createElement('div',{style:{fontSize:12,color:"#888"}},fmtDate(snap.testDate)," · ",snap.auditor||"No auditor")
            ,React.createElement('div',{style:{fontSize:11,color:"#555",marginTop:2}},"Archived ",fmtDateTime(snap.archivedAt))
            ,total>0&&React.createElement('div',{style:{display:"flex",gap:8,marginTop:6}}
              ,React.createElement('span',{style:{fontSize:11,color:"#60a5fa"}},pass," Pass")
              ,React.createElement('span',{style:{fontSize:11,color:"#ef4444"}},fail," Fail")
              ,React.createElement('span',{style:{fontSize:11,color:"#f59e0b"}},total-pass-fail," Untested")
            )
          )
          ,React.createElement('span',{style:{...ST.arrow,color:expanded===snap.id?TAT_COLOR:"#555"}},expanded===snap.id?"▾":"›")
        )
        ,expanded===snap.id&&React.createElement('div',{style:{padding:"0 16px 14px",borderTop:"1px solid #2a2a2a"}}
          ,React.createElement('div',{style:{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}
            ,React.createElement('button',{style:{...ST.smallBtn,flex:1,color:"#60a5fa",borderColor:"#3b82f644",fontWeight:700},onClick:()=>setViewSnap(snap)},"👁 View Results")
            ,React.createElement('button',{style:{...ST.smallBtn,flex:1,color:"#4ade80",borderColor:"#22c55e44"},onClick:()=>onExportSnap(snap)},"↓ Export")
            ,React.createElement('button',{style:{...ST.smallBtn,flex:1,color:"#a78bfa",borderColor:"#7c3aed44",fontWeight:700},onClick:()=>onContinueFromSnap(snap)},"▶ Continue")
            ,deleteId===snap.id
              ?React.createElement(React.Fragment,null,React.createElement('button',{style:{...ST.smallBtn,color:"#f87171",borderColor:"#ef444455"},onClick:()=>{onDelete(snap.id);setDeleteId(null);}},"Confirm"),React.createElement('button',{style:ST.smallBtn,onClick:()=>setDeleteId(null)},"Cancel"))
              :React.createElement('button',{style:{...ST.smallBtn,color:"#ef4444",borderColor:"#ef444433"},onClick:()=>setDeleteId(snap.id)},"🗑")
          )
        )
      );
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────
// T&T NAV BTN + STYLES (reuse SI/ST shared style objects)
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// T&T SETTINGS VIEW — manage equipment type dropdown
// ─────────────────────────────────────────────────────────────────────────
function TATSettingsView({equipTypes, setEquipTypes, freqOptions, setFreqOptions}) {
  const [newEquip, setNewEquip] = React.useState("");
  const [newFreqMonths, setNewFreqMonths] = React.useState("");

  const addEquip = () => {
    if(!newEquip.trim()||equipTypes.includes(newEquip.trim())) return;
    setEquipTypes(prev=>[...prev, newEquip.trim()]); setNewEquip("");
  };
  const removeEquip = val => setEquipTypes(prev=>prev.filter(x=>x!==val));
  const resetEquip = () => setEquipTypes([...TAT_DEFAULT_EQUIP_TYPES]);

  const addFreq = () => {
    const months = parseInt(newFreqMonths);
    if(!months||isNaN(months)||months<1) return;
    const val = String(months);
    if((freqOptions||[]).find(f=>f.value===val)) return;
    const label = months===1?"1 Month":`${months} Months`;
    setFreqOptions(prev=>[...(prev||[]), {value:val, label}].sort((a,b)=>parseInt(a.value)-parseInt(b.value)));
    setNewFreqMonths("");
  };
  const removeFreq = val => setFreqOptions(prev=>(prev||[]).filter(f=>f.value!==val));
  const resetFreq = () => setFreqOptions([...TAT_DEFAULT_FREQS]);

  const secStyle={background:"#161616",border:`1px solid ${TAT_COLOR}33`,borderRadius:14,padding:"14px",marginBottom:16};
  const secTitle=t=>React.createElement('div',{style:{fontSize:13,fontWeight:700,color:TAT_COLOR,marginBottom:12}},t);

  return React.createElement('div',{style:{...ST.listWrap,paddingBottom:80}}
    ,React.createElement('div',{style:{fontSize:20,fontWeight:800,color:"#64748b",marginBottom:4}},"≔ Dropdowns")
    ,React.createElement('div',{style:{fontSize:12,color:"#555",marginBottom:20}},"Manage dropdown options shown in the test form.")

    ,React.createElement('div',{style:secStyle}
      ,secTitle("EQUIPMENT TYPE")
      ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}
        ,equipTypes.map(t=>React.createElement('div',{key:t,style:{display:"flex",alignItems:"center",gap:8,background:"#1a1a1a",border:`1px solid ${TAT_COLOR}33`,borderRadius:8,padding:"8px 12px"}}
          ,React.createElement('span',{style:{fontSize:13,color:"#eee",flex:1}},t)
          ,React.createElement('button',{style:{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14,padding:"0 0 0 8px"},onClick:()=>removeEquip(t)},"✕")
        ))
      )
      ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:8}}
        ,React.createElement('input',{style:{...ST.smallInput,flex:1},placeholder:"Add equipment type…",value:newEquip,onChange:e=>setNewEquip(e.target.value),onKeyDown:e=>e.key==="Enter"&&addEquip()})
        ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,padding:"10px 16px",fontSize:13},onClick:addEquip},"+ Add")
      )
      ,React.createElement('button',{style:{...ST.smallBtn,color:"#555",fontSize:11},onClick:resetEquip},"Reset to defaults")
    )

    ,React.createElement('div',{style:secStyle}
      ,secTitle("TEST FREQUENCY")
      ,React.createElement('div',{style:{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}
        ,(freqOptions||TAT_DEFAULT_FREQS).map(f=>React.createElement('div',{key:f.value,style:{display:"flex",alignItems:"center",gap:8,background:"#1a1a1a",border:`1px solid ${TAT_COLOR}33`,borderRadius:8,padding:"8px 12px"}}
          ,React.createElement('span',{style:{fontSize:13,color:"#eee",flex:1}},f.label," (",f.value,"m)")
          ,React.createElement('button',{style:{background:"transparent",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14,padding:"0 0 0 8px"},onClick:()=>removeFreq(f.value)},"✕")
        ))
      )
      ,React.createElement('div',{style:{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}
        ,React.createElement('input',{style:{...ST.smallInput,flex:1},placeholder:"Number of months e.g. 2",type:"number",min:"1",value:newFreqMonths,onChange:e=>setNewFreqMonths(e.target.value),onKeyDown:e=>e.key==="Enter"&&addFreq()})
        ,React.createElement('button',{style:{...ST.ctaPrimary,background:TAT_COLOR,padding:"10px 16px",fontSize:13,flexShrink:0},onClick:addFreq},"+ Add")
      )
      ,React.createElement('button',{style:{...ST.smallBtn,color:"#555",fontSize:11},onClick:resetFreq},"Reset to defaults")
    )
  );
}


function TATNavBtn({icon,label,active,onClick,color}){
  const c=active?(color||TAT_COLOR):"#555";
  return React.createElement('button',{onClick,style:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 6px",minHeight:50,color:c,borderTop:active?`2px solid ${color||TAT_COLOR}`:"2px solid transparent"}}
    ,React.createElement('span',{style:{fontSize:18}},icon)
    ,React.createElement('span',{style:{fontSize:9,fontWeight:active?700:500,letterSpacing:0.5}},label)
  );
}

// Reuse SI styles for T&T (same dark theme, blue accent handled inline)
const ST = {...(typeof SI !== 'undefined' ? SI : {}),
  root:{display:"flex",flexDirection:"column",flex:1,minHeight:0,touchAction:"pan-y",background:"#111",color:"#eee",fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",WebkitFontSmoothing:"antialiased",overflow:"hidden"},
  loader:{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#111"},
  loaderSpinner:{width:40,height:40,border:"3px solid #333",borderTop:`3px solid ${TAT_COLOR}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"},
  topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 10px",background:"#161616",flexShrink:0,zIndex:10},
  topbarLeft:{display:"flex",alignItems:"center",gap:12},topbarRight:{display:"flex",alignItems:"center",gap:8},
  appTitle:{fontSize:16,fontWeight:800,letterSpacing:1},appSub:{fontSize:10,letterSpacing:0.5},
  backBtn:{fontSize:28,color:"#aaa",background:"transparent",border:"none",cursor:"pointer",lineHeight:1,padding:"0 8px 0 0",fontWeight:300},
  homeModuleBtn:{fontSize:11,color:"#555",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"},
  saveIndicator:{fontSize:11,color:"#22c55e",fontWeight:600,transition:"opacity 0.4s",pointerEvents:"none"},
  breadcrumb:{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#161616",borderBottom:"1px solid #1e1e1e",fontSize:12,flexWrap:"wrap",flexShrink:0},
  bcItem:{color:"#888",cursor:"pointer"},bcSep:{color:"#444"},
  main:{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",minHeight:0},
  bottomNav:{display:"flex",background:"#161616",borderTop:"1px solid #222",flexShrink:0,paddingBottom:"34px",boxShadow:"0 200px 0 200px #161616"},
  listWrap:{padding:"16px"},listTitle:{fontSize:20,fontWeight:800,color:"#eee",marginBottom:16},
  brandBlock:{textAlign:"center",borderBottom:"2px solid #3b82f6",paddingBottom:8,width:"100%",maxWidth:500},
  brandTitle:{fontSize:20,fontWeight:900,letterSpacing:3},brandSub:{fontSize:11,color:"#666",letterSpacing:1,marginTop:2},
  siteTitle:{fontSize:20,fontWeight:800,color:"#eee"},siteSub:{fontSize:12,color:"#666"},
  homeWrap:{padding:"24px 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:14},
  metaCard:{width:"100%",maxWidth:500,background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"14px"},
  metaLabelText:{fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700},
  metaInput:{background:"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"9px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box"},
  duePill:{fontSize:12,background:"#161616",border:"1px solid",borderRadius:8,padding:"5px 10px"},
  siteCard:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px 18px",marginBottom:10,cursor:"pointer",textAlign:"left"},
  siteCardLeft:{flex:1},siteCardRight:{display:"flex",alignItems:"center",gap:8,marginLeft:16},
  siteCardName:{fontSize:16,fontWeight:700,color:"#eee"},siteCardSub:{fontSize:12,color:"#666",marginTop:2},
  failBadge:{fontSize:11,fontWeight:800,color:"#f87171",background:"#3d1a1a",borderRadius:6,padding:"3px 8px",border:"1px solid #ef4444"},
  arrow:{fontSize:22,color:"#555",lineHeight:1},
  addCard:{background:"#161616",border:"1px solid #2a2a2a",borderRadius:14,padding:"16px",marginBottom:10},
  panelHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14},
  panelTitle:{fontSize:20,fontWeight:800,color:"#eee"},panelSub:{fontSize:12,color:"#666",marginTop:2},
  panelStats:{display:"flex",gap:10,fontSize:15,fontWeight:800},
  circuitWrap:{padding:"16px"},
  summaryWrap:{padding:"16px"},summaryTitle:{fontSize:22,fontWeight:900,letterSpacing:1.5},summaryMeta:{fontSize:13,color:"#777",marginTop:4,marginBottom:20},
  secondaryBtn:{padding:"11px",background:"#161616",color:"#aaa",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
  exportBtn:{padding:"11px",background:"#161616",color:"#4ade80",border:"1px solid #2a2a2a",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"},
  confirmRow:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},
  confirmYes:{padding:"7px 14px",background:"#3d1a1a",color:"#f87171",border:"1px solid #ef4444",borderRadius:8,fontSize:13,cursor:"pointer"},
  confirmNo:{padding:"7px 14px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:8,fontSize:13,cursor:"pointer"},
  smallBtn:{padding:"5px 10px",background:"transparent",border:"1px solid #333",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:600,flexShrink:0,color:"#aaa"},
  smallInput:{background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"},
  tabBtn:{flex:1,padding:"9px",background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#666",fontSize:12,fontWeight:600,cursor:"pointer"},
  tabBtnActive:{background:"#1a2030",border:`1px solid ${TAT_COLOR}`,color:TAT_COLOR},
  ctaPrimary:{padding:"11px 20px",background:TAT_COLOR,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"},
  ctaSecondary:{padding:"11px 20px",background:"#1a1a1a",color:"#aaa",border:"1px solid #333",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"},
  modalOverlay:{position:"absolute",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"},
  modalBox:{background:"#1a1a1a",border:"1px solid #333",borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",width:"100%",maxWidth:620,maxHeight:"92vh",overflowY:"auto"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20},
  modalField:{marginBottom:14},
  modalLabel:{display:"block",fontSize:10,color:"#666",letterSpacing:0.8,fontWeight:700,marginBottom:5},
  modalInput:{width:"100%",background:"#111",border:"1px solid #333",borderRadius:8,color:"#eee",padding:"10px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
  modalClose:{width:"100%",padding:"14px",border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8},
};

// ═════════════════════════════════════════════════════════════════════════
// MODULE SELECTOR — top-level landing screen
// ═════════════════════════════════════════════════════════════════════════
function AppRoot() {
  const [module, setModule] = React.useState(null); // null | "rcd" | "iel"

  if (module === "rcd") return React.createElement(RCDAppWrapper, {onGoHome: ()=>setModule(null)});
  if (module === "iel") return React.createElement(IELApp, {onGoHome: ()=>setModule(null)});
  if (module === "tat") return React.createElement(TATApp, {onGoHome: ()=>setModule(null)});
  if (module === "cal") return React.createElement(CalendarApp, {onGoHome: ()=>setModule(null)});

  return React.createElement('div', {style:{
    display:"flex",flexDirection:"column",flex:1,minHeight:0,
    background:"#111",color:"#eee",
    fontFamily:"'DM Sans','SF Pro Display',-apple-system,sans-serif",
    WebkitFontSmoothing:"antialiased",
    overflowY:"auto",
  }}
    , React.createElement('div', {style:{
        padding:"40px 24px 32px",
        display:"flex",flexDirection:"column",
        alignItems:"center",
        minHeight:"100%",
        justifyContent:"center",
        gap:0,
      }}

      // Brand
      , React.createElement('div', {style:{textAlign:"center",marginBottom:32}}
        , React.createElement('div', {style:{fontSize:11,color:"#444",letterSpacing:2,fontWeight:700,marginBottom:8}}, "VORICK GROUP")
        , React.createElement('div', {style:{fontSize:36,fontWeight:900,letterSpacing:-1,lineHeight:1,marginBottom:6,color:"#eee"}}, "AUDIT")
        , React.createElement('div', {style:{fontSize:36,fontWeight:900,letterSpacing:-1,lineHeight:1,color:"#e8731a"}}, "PORTAL")
        , React.createElement('div', {style:{width:60,height:3,background:"linear-gradient(90deg,#e8731a,#10b981)",borderRadius:2,margin:"16px auto 0"}})
        , React.createElement('div', {style:{fontSize:12,color:"#555",marginTop:12,letterSpacing:0.5}}, "Asset Maintenance · Electrical Testing")
      )

      // Module cards
      , React.createElement('div', {style:{fontSize:11,color:"#555",fontWeight:700,letterSpacing:1.5,marginBottom:16,textAlign:"center"}}, "SELECT MODULE")

      , React.createElement('button', {
          style:{
            width:"100%",maxWidth:420,
            display:"flex",alignItems:"center",gap:20,
            padding:"24px 24px",
            background:"#161616",
            border:"2px solid #e8731a44",
            borderRadius:20,
            cursor:"pointer",
            color:"#eee",
            marginBottom:14,
            textAlign:"left",
          },
          onClick: ()=>setModule("rcd")
        }
        , React.createElement('div', {style:{width:56,height:56,borderRadius:14,background:"#e8731a22",border:"1px solid #e8731a44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}, "⚡")
        , React.createElement('div', {style:{flex:1}}
          , React.createElement('div', {style:{fontSize:18,fontWeight:800,color:"#e8731a",letterSpacing:0.5}}, "RCD TESTING")
          , React.createElement('div', {style:{fontSize:12,color:"#888",marginTop:4,lineHeight:1.5}}, "Monthly push tests & annual injection tests for RCDs, RCBOs, and circuit breakers")
          , React.createElement('div', {style:{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}
            , React.createElement('span', {style:{fontSize:10,color:"#e8731a",background:"#e8731a22",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "📋 Monthly Push")
            , React.createElement('span', {style:{fontSize:10,color:"#60a5fa",background:"#3b82f622",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🔬 Annual Injection")
          )
        )
        , React.createElement('span', {style:{fontSize:24,color:"#555"}}, "›")
      )

      , React.createElement('button', {
          style:{
            width:"100%",maxWidth:420,
            display:"flex",alignItems:"center",gap:20,
            padding:"24px 24px",
            background:"#161616",
            border:"2px solid #10b98144",
            borderRadius:20,
            cursor:"pointer",
            color:"#eee",
            marginBottom:14,
            textAlign:"left",
          },
          onClick: ()=>setModule("iel")
        }
        , React.createElement('div', {style:{width:56,height:56,borderRadius:14,background:"#10b98122",border:"1px solid #10b98144",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}, "🔗")
        , React.createElement('div', {style:{flex:1}}
          , React.createElement('div', {style:{fontSize:18,fontWeight:800,color:"#10b981",letterSpacing:0.5}}, "IEL TESTING")
          , React.createElement('div', {style:{fontSize:12,color:"#888",marginTop:4,lineHeight:1.5}}, "3-monthly testing for lanyards, emergency stops, and electrical isolators")
          , React.createElement('div', {style:{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}
            , React.createElement('span', {style:{fontSize:10,color:"#10b981",background:"#10b98122",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🔗 Lanyards")
            , React.createElement('span', {style:{fontSize:10,color:"#ef4444",background:"#ef444422",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🔴 E-Stops")
            , React.createElement('span', {style:{fontSize:10,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "⚡ Isolators")
          )
        )
        , React.createElement('span', {style:{fontSize:24,color:"#555"}}, "›")
      )

      // Footer
      , React.createElement('button', {
          style:{
            width:"100%",maxWidth:420,
            display:"flex",alignItems:"center",gap:20,
            padding:"24px 24px",
            background:"#161616",
            border:"2px solid #3b82f644",
            borderRadius:20,
            cursor:"pointer",
            color:"#eee",
            marginBottom:14,
            textAlign:"left",
          },
          onClick: ()=>setModule("tat")
        }
        , React.createElement('div', {style:{width:56,height:56,borderRadius:14,background:"#3b82f622",border:"1px solid #3b82f644",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}, "🏷")
        , React.createElement('div', {style:{flex:1}}
          , React.createElement('div', {style:{fontSize:18,fontWeight:800,color:"#60a5fa",letterSpacing:0.5}}, "TEST & TAG")
          , React.createElement('div', {style:{fontSize:12,color:"#888",marginTop:4,lineHeight:1.5}}, "In-service testing of tools, leads, appliances and portable equipment")
          , React.createElement('div', {style:{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}
            , React.createElement('span', {style:{fontSize:10,color:"#60a5fa",background:"#3b82f622",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🏷 Asset Tagging")
            , React.createElement('span', {style:{fontSize:10,color:"#22c55e",background:"#22c55e22",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "☑ Visual Inspection")
            , React.createElement('span', {style:{fontSize:10,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "📋 1-12 Month Cycles")
          )
        )
        , React.createElement('span', {style:{fontSize:24,color:"#555"}}, "›")
      )

      , React.createElement('button', {
          style:{
            width:"100%",maxWidth:420,
            display:"flex",alignItems:"center",gap:20,
            padding:"24px 24px",
            background:"#161616",
            border:"2px solid #6366f144",
            borderRadius:20,
            cursor:"pointer",
            color:"#eee",
            marginBottom:14,
            textAlign:"left",
          },
          onClick: ()=>setModule("cal")
        }
        , React.createElement('div', {style:{width:56,height:56,borderRadius:14,background:"#6366f122",border:"1px solid #6366f144",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}, "📅")
        , React.createElement('div', {style:{flex:1}}
          , React.createElement('div', {style:{fontSize:18,fontWeight:800,color:"#818cf8",letterSpacing:0.5}}, "TEST CALENDAR")
          , React.createElement('div', {style:{fontSize:12,color:"#888",marginTop:4,lineHeight:1.5}}, "Track upcoming test due dates, get reminders for RCD, IEL and other scheduled audits")
          , React.createElement('div', {style:{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}
            , React.createElement('span', {style:{fontSize:10,color:"#818cf8",background:"#6366f122",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "📋 Monthly Push")
            , React.createElement('span', {style:{fontSize:10,color:"#10b981",background:"#10b98122",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🔗 IEL 3-Month")
            , React.createElement('span', {style:{fontSize:10,color:"#f59e0b",background:"#f59e0b22",borderRadius:4,padding:"2px 8px",fontWeight:700}}, "🔬 Annual Injection")
          )
        )
        , React.createElement('span', {style:{fontSize:24,color:"#555"}}, "›")
      )

      , React.createElement('div', {style:{marginTop:24,textAlign:"center",fontSize:11,color:"#333",letterSpacing:0.5}}, "Vorick Group Asset Maintenance · v10")
    )
  );
}

// RCDApp wrapper that injects a "← Module Select" button into the top bar
function RCDAppWrapper({ onGoHome }) {
  // We render the RCDApp as-is, but inject a back button by patching
  // the render with a wrapper overlay that doesn't interfere with RCD layout.
  // We use a floating pill button positioned absolutely.
  return React.createElement('div', {style:{display:"flex",flexDirection:"column",flex:1,minHeight:0,position:"relative"}}
    , React.createElement(RCDApp, null)
    , React.createElement('button', {
        onClick: onGoHome,
        style:{
          position:"absolute",top:12,right:16,
          fontSize:11,color:"#555",
          background:"#1a1a1a",border:"1px solid #2a2a2a",
          borderRadius:8,padding:"5px 10px",cursor:"pointer",
          fontWeight:600,zIndex:100,whiteSpace:"nowrap",
        }
      }, "⌂ Module Select")
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MOUNT
// ─────────────────────────────────────────────────────────────────────────
(function(){
  try {
    var root=ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(AppRoot));
    if(window.__hideLoading)window.__hideLoading();
  } catch(e) {
    document.body.style.overflow='auto';
    document.body.innerHTML='<div style="color:#ff6b6b;padding:30px;font-family:sans-serif;background:#111;min-height:100vh"><h2 style="color:#e8731a">Mount Error</h2><b>'+e.message+'</b><br><br><pre style="font-size:10px;color:#888;white-space:pre-wrap">'+e.stack+'</pre></div>';
  }
})();
