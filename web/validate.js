/*
 * validate.js — ตรวจว่า Boarding Pass ที่สแกน "ตรงกับเที่ยวบิน/วันที่ที่ประตูกำลังเปิดบอร์ด" ไหม
 *
 * ใช้คู่กับ bcbp.parse(): ป้อนผลลัพธ์ที่ parse แล้ว + ค่าที่ตั้งไว้ที่ประตู (gate config)
 * คืนสถานะเพื่อให้ UI เตือน:
 *   "ok"          - ตรงเที่ยวบินและวันที่ → อนุญาต
 *   "wrong_flight"- ไม่มี leg ไหนตรงเที่ยวบินที่เปิด → เตือนแดง
 *   "wrong_date"  - เที่ยวบินตรง แต่วันไม่ตรง → เตือนแดง
 *   "off"         - ไม่ได้ตั้งค่าไว้ → ไม่ตรวจ
 *
 * BCBP เก็บวันเป็น Julian (วันที่เท่าไรของปี) ไม่มีปี — จึงแปลงเป็น เดือน/วัน โดยใช้ปีจากวันที่
 * ที่ตั้งไว้ที่ประตู เพื่อให้เทียบได้ถูกต้องทั้งปีปกติและปีอธิกสุรทิน
 */
(function (root) {
  "use strict";

  function julianToMonthDay(julian, year) {
    const day = parseInt(julian, 10);
    if (!day || day < 1 || day > 366) return null;
    const dt = new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000);
    return { m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function normCarrier(s) { return (s || "").trim().toUpperCase(); }
  function normFlight(s) {
    const n = parseInt(String(s == null ? "" : s).replace(/\D/g, ""), 10);
    return Number.isNaN(n) ? "" : String(n); // ตัด 0 นำหน้า: "0727" -> "727"
  }

  /**
   * @param parsed ผลจาก BCBP.parse()
   * @param cfg    { carrier, flight, dateISO } — ค่าที่ตั้งไว้ที่ประตู (ว่างได้)
   * @returns { status, message, expected, matchedLeg }
   */
  function validateAgainstGate(parsed, cfg) {
    cfg = cfg || {};
    const wantCarrier = normCarrier(cfg.carrier);
    const wantFlight = normFlight(cfg.flight);
    const dateISO = (cfg.dateISO || "").trim();
    const hasFlight = !!(wantCarrier || wantFlight);
    const hasDate = !!dateISO;

    if (!hasFlight && !hasDate) return { status: "off" };

    const legs = parsed.legs || [];
    let year = null, wantM = null, wantD = null;
    if (hasDate) {
      const parts = dateISO.split("-").map(Number);
      year = parts[0]; wantM = parts[1]; wantD = parts[2];
    }

    const flightLegs = [];       // leg ที่ตรงเที่ยวบิน
    let anyDateMatch = false;

    legs.forEach((leg) => {
      const cCarrier = normCarrier(leg.operatingCarrier);
      const cFlight = normFlight(leg.flightNumber);
      const fMatch = (!wantCarrier || cCarrier === wantCarrier) &&
                     (!wantFlight || cFlight === wantFlight);

      let dMatch = true;
      if (hasDate) {
        const md = julianToMonthDay(leg.dateOfFlight, year);
        dMatch = !!md && md.m === wantM && md.d === wantD;
        if (dMatch) anyDateMatch = true;
      }
      if (fMatch) flightLegs.push({ leg, dMatch });
    });

    const expected = {
      flight: (wantCarrier + (wantFlight ? " " + wantFlight : "")).trim() || null,
      date: hasDate ? dateISO : null,
    };

    // ตรวจเที่ยวบินก่อน
    if (hasFlight && flightLegs.length === 0) {
      return {
        status: "wrong_flight",
        message: "ผิดเที่ยวบิน! บัตรนี้ไม่ใช่เที่ยวบินที่กำลังเปิดบอร์ด",
        expected,
      };
    }

    // มี leg ตรงเที่ยวบิน → เช็กวันของ leg เหล่านั้น
    if (hasFlight) {
      const okLeg = flightLegs.find((x) => x.dMatch);
      if (hasDate && !okLeg) {
        return {
          status: "wrong_date",
          message: "ผิดวัน! เที่ยวบินตรง แต่ไม่ใช่วันที่กำลังเปิดบอร์ด",
          expected,
          matchedLeg: flightLegs[0].leg,
        };
      }
      return { status: "ok", message: "ตรงเที่ยวบินและวันที่ — อนุญาตขึ้นเครื่อง", expected, matchedLeg: (okLeg || flightLegs[0]).leg };
    }

    // ตั้งเฉพาะวันที่ (ไม่ระบุเที่ยวบิน)
    if (hasDate) {
      if (anyDateMatch) return { status: "ok", message: "ตรงวันที่ที่เปิดบอร์ด", expected };
      return { status: "wrong_date", message: "ผิดวัน! ไม่ใช่วันที่กำลังเปิดบอร์ด", expected };
    }

    return { status: "off" };
  }

  root.GateValidate = { validateAgainstGate };
  if (typeof module !== "undefined" && module.exports) module.exports = root.GateValidate;
})(typeof self !== "undefined" ? self : this);
