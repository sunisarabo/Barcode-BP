/**
 * Boarding Scan Log — Google Apps Script Web App
 *
 * รับ log บัตรที่สแกนจากเว็บแอป (POST JSON) แล้วเขียนลง Google Sheet โดยจัดระเบียบ:
 *   - แท็บ "ตามปี-เดือน"  เช่น 2026-03   (1 แท็บ/เดือน)
 *   - ในแต่ละแท็บ จัดกลุ่ม "ตามเที่ยวบิน" (sort ตามเที่ยวบิน → เวลา)
 *   - แท็บ "สรุป"  รวมยอด ตามปี/เดือน/เที่ยวบิน (ผ่าน / ซ้ำ / ผิด)
 *   - กันข้อมูลซ้ำด้วย id ของแต่ละ record
 *
 * วิธี deploy: ดู gas/README.md
 */

var SPREADSHEET_NAME = "Boarding Scan Log";
var HEADERS = ["วันที่บิน", "เวลาสแกน", "เที่ยวบิน", "ผู้โดยสาร", "ที่นั่ง", "Seq", "สถานะ", "id"];
var SUMMARY_NAME = "สรุป";

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return json_({ ok: false, error: "busy" }); }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var records = body.records || [];
    var ss = getSpreadsheet_();
    var res = importRecords_(ss, records);
    buildSummary_(ss);
    return json_({ ok: true, imported: res.imported, skipped: res.skipped, url: ss.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, msg: "Boarding scan log endpoint พร้อมใช้งาน — ส่งข้อมูลด้วย POST" });
}

/** เปิด Sheet เดิม (เก็บ id ไว้ใน Script Properties) หรือสร้างใหม่ครั้งแรก */
function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SS_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* ถูกลบ → สร้างใหม่ */ }
  }
  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty("SS_ID", ss.getId());
  return ss;
}

/** ปี-เดือน จาก "วันที่บิน" (ISO) ถ้าไม่มีใช้เวลาสแกน */
function monthKey_(r) {
  var d = (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) ? r.date : String(r.t || "").slice(0, 10);
  return /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : "ไม่ทราบวันที่";
}

function importRecords_(ss, records) {
  var byMonth = {};
  records.forEach(function (r) {
    var k = monthKey_(r);
    (byMonth[k] = byMonth[k] || []).push(r);
  });

  var imported = 0, skipped = 0;
  Object.keys(byMonth).forEach(function (mk) {
    var sh = ss.getSheetByName(mk) || createMonthSheet_(ss, mk);
    var seen = getIdSet_(sh);
    var rows = [];
    byMonth[mk].forEach(function (r) {
      if (r.id && seen[r.id]) { skipped++; return; }
      rows.push([
        r.date || "", fmtTime_(r.t), r.flight || "", r.name || "",
        r.seat || "", r.seq || "", statusTH_(r.status), r.id || "",
      ]);
      imported++;
    });
    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
      sortByFlight_(sh);
    }
  });
  return { imported: imported, skipped: skipped };
}

function createMonthSheet_(ss, name) {
  var sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, HEADERS.length, 110);
  return sh;
}

/** อ่าน id ที่มีอยู่แล้วในแท็บ (คอลัมน์สุดท้าย) เพื่อกันซ้ำ */
function getIdSet_(sh) {
  var set = {};
  var last = sh.getLastRow();
  if (last < 2) return set;
  var ids = sh.getRange(2, HEADERS.length, last - 1, 1).getValues();
  ids.forEach(function (x) { if (x[0]) set[x[0]] = true; });
  return set;
}

/** จัดกลุ่มตามเที่ยวบิน: sort คอลัมน์ เที่ยวบิน(3) → เวลาสแกน(2) */
function sortByFlight_(sh) {
  var last = sh.getLastRow();
  if (last < 3) return;
  sh.getRange(2, 1, last - 1, HEADERS.length)
    .sort([{ column: 3, ascending: true }, { column: 2, ascending: true }]);
}

function fmtTime_(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  return isNaN(d.getTime()) ? iso
    : Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function statusTH_(s) {
  var m = { ok: "ผ่าน", recorded: "บันทึก", duplicate: "ซ้ำ",
            wrong_flight: "ผิดเที่ยวบิน", wrong_date: "ผิดวัน" };
  return m[s] || s || "";
}

/** แท็บสรุป: รวมยอดตามปี/เดือน/เที่ยวบิน */
function buildSummary_(ss) {
  var sh = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME, 0);
  sh.clear();
  var head = ["ปี", "เดือน", "เที่ยวบิน", "รวม", "ผ่าน/บันทึก", "ซ้ำ", "ผิด"];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
  sh.setFrozenRows(1);

  var agg = {};
  ss.getSheets().forEach(function (s) {
    var nm = s.getName();
    if (!/^\d{4}-\d{2}$/.test(nm)) return;                 // เฉพาะแท็บเดือน
    var last = s.getLastRow();
    if (last < 2) return;
    var vals = s.getRange(2, 3, last - 1, 5).getValues();  // เที่ยวบิน..สถานะ
    vals.forEach(function (row) {
      var flight = row[0], status = row[4];
      var key = nm + "|" + flight;
      var a = agg[key] || (agg[key] = { y: nm.slice(0, 4), m: nm.slice(5, 7), f: flight, total: 0, ok: 0, dup: 0, bad: 0 });
      a.total++;
      if (status === "ซ้ำ") a.dup++;
      else if (status === "ผิดเที่ยวบิน" || status === "ผิดวัน") a.bad++;
      else a.ok++;
    });
  });

  var out = Object.keys(agg).map(function (k) {
    var a = agg[k];
    return [a.y, a.m, a.f, a.total, a.ok, a.dup, a.bad];
  });
  out.sort(function (x, y) {
    return (x[0] + x[1] + x[2]).localeCompare(y[0] + y[1] + y[2]);
  });
  if (out.length) sh.getRange(2, 1, out.length, head.length).setValues(out);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
