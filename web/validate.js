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

  // ---------------------------------------------------------------------------
  // ตรวจบัตรซ้ำ (duplicate boarding) — ที่นั่งหรือ seq ซ้ำ = บัตรถูกใช้ไปแล้ว
  // ---------------------------------------------------------------------------

  // เลือก leg ที่เกี่ยวข้อง: ถ้าตั้งประตูไว้ใช้ leg ที่ตรงเที่ยวบิน ไม่งั้นใช้ leg แรก
  function pickLeg(parsed, cfg) {
    const legs = (parsed && parsed.legs) || [];
    if (!legs.length) return null;
    const wantCarrier = normCarrier(cfg && cfg.carrier);
    const wantFlight = normFlight(cfg && cfg.flight);
    if (wantCarrier || wantFlight) {
      const m = legs.find((l) =>
        (!wantCarrier || normCarrier(l.operatingCarrier) === wantCarrier) &&
        (!wantFlight || normFlight(l.flightNumber) === wantFlight));
      if (m) return m;
    }
    return legs[0];
  }

  /**
   * สร้างตัวติดตามบัตรที่บอร์ดแล้ว
   * .check(parsed, cfg) - ตรวจว่าซ้ำไหม แล้วบันทึก (ถ้าไม่ซ้ำ) คืนผลลัพธ์
   * .reset(), .size(), .toJSON()/.load() - จัดการรายการ
   */
  function createBoardTracker(initial) {
    const seats = new Map();   // seatKey -> record
    const seqs = new Map();    // seqKey  -> record

    function base(leg) {
      return normCarrier(leg.operatingCarrier) + "|" +
             normFlight(leg.flightNumber) + "|" + (leg.dateOfFlight || "");
    }

    const api = {
      reset() { seats.clear(); seqs.clear(); },
      size() { return Math.max(seats.size, seqs.size); },
      toJSON() { return { seats: [...seats], seqs: [...seqs] }; },
      load(data) {
        api.reset();
        if (!data) return;
        (data.seats || []).forEach(([k, v]) => seats.set(k, v));
        (data.seqs || []).forEach(([k, v]) => seqs.set(k, v));
      },
      /** ตรวจ + บันทึก; record=false เพื่อตรวจอย่างเดียวไม่บันทึก */
      check(parsed, cfg, record) {
        if (record === undefined) record = true;
        const leg = pickLeg(parsed, cfg);
        if (!leg) return { duplicate: false };
        const b = base(leg);
        const seat = leg.seatNumber || null;
        const seq = leg.checkInSequenceNumber || null;
        const seatKey = seat ? b + "|S|" + seat : null;
        const seqKey = seq ? b + "|Q|" + seq : null;
        const prevSeat = seatKey ? seats.get(seatKey) : null;
        const prevSeq = seqKey ? seqs.get(seqKey) : null;

        let result = { duplicate: false, seat, seq, leg };
        if (prevSeq && prevSeat) {
          result = { duplicate: true, kind: "same_pass",
            message: `บัตรนี้ถูกสแกนไปแล้ว (ที่นั่ง ${seat} · ลำดับ ${seq})`,
            prev: prevSeq, seat, seq, leg };
        } else if (prevSeq) {
          result = { duplicate: true, kind: "seq",
            message: `ลำดับเช็กอิน (seq) ${seq} ซ้ำ — เคยสแกนไปแล้ว`,
            prev: prevSeq, seat, seq, leg };
        } else if (prevSeat) {
          result = { duplicate: true, kind: "seat",
            message: `ที่นั่ง ${seat} ซ้ำ — มีบัตรอื่นใช้ที่นั่งนี้แล้ว`,
            prev: prevSeat, seat, seq, leg };
        }

        if (record && !result.duplicate) {
          const rec = { name: (parsed && parsed.passengerName) || null, seat, seq };
          if (seatKey) seats.set(seatKey, rec);
          if (seqKey) seqs.set(seqKey, rec);
        }
        return result;
      },
    };
    if (initial) api.load(initial);
    return api;
  }

  root.GateValidate = { validateAgainstGate, createBoardTracker, pickLeg };
  if (typeof module !== "undefined" && module.exports) module.exports = root.GateValidate;
})(typeof self !== "undefined" ? self : this);
