/*
 * bcbp.js — ตัวถอดรหัส IATA BCBP (Resolution 792) ฝั่ง JavaScript
 *
 * พอร์ตตรงจาก bcbp/parser.py — logic เดียวกัน ใช้ได้ทั้งในเบราว์เซอร์และ Node.js
 *
 *   const data = BCBP.parse("M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100",
 *                           { yearHint: 2026 });
 */
(function (root) {
  "use strict";

  // ---- นิยาม field ตามสเปก IATA ----
  const UNIQUE_MANDATORY = [
    ["formatCode", 1], ["numberOfLegs", 1],
    ["passengerName", 20], ["electronicTicketIndicator", 1],
  ];
  const REPEATED_MANDATORY = [
    ["operatingCarrierPNR", 7], ["fromCity", 3], ["toCity", 3],
    ["operatingCarrier", 3], ["flightNumber", 5], ["dateOfFlight", 3],
    ["compartmentCode", 1], ["seatNumber", 4], ["checkInSequenceNumber", 5],
    ["passengerStatus", 1], ["conditionalSize", 2],
  ];
  const CONDITIONAL_UNIQUE = [
    ["passengerDescription", 1], ["sourceOfCheckIn", 1],
    ["sourceOfBoardingPassIssuance", 1], ["dateOfIssueOfBoardingPass", 4],
    ["documentType", 1], ["airlineDesignatorOfBoardingPassIssuer", 3],
    ["baggageTagLicensePlateNumbers", 13],
    ["firstBaggageTagLicensePlateNumber", 13],
    ["secondBaggageTagLicensePlateNumber", 13],
  ];
  const CONDITIONAL_REPEATED = [
    ["airlineNumericCode", 3], ["documentFormSerialNumber", 10],
    ["selecteeIndicator", 1], ["internationalDocumentVerification", 1],
    ["marketingCarrierDesignator", 3], ["frequentFlyerAirlineDesignator", 3],
    ["frequentFlyerNumber", 16], ["idAdIndicator", 1],
    ["freeBaggageAllowance", 3], ["fastTrack", 1],
  ];

  const LABELS_TH = {
    formatCode: "รหัสฟอร์แมต",
    numberOfLegs: "จำนวนเที่ยวบิน (legs)",
    passengerName: "ชื่อผู้โดยสาร",
    electronicTicketIndicator: "ตัวบ่งชี้ตั๋วอิเล็กทรอนิกส์",
    operatingCarrierPNR: "รหัสสำรองที่นั่ง (PNR)",
    fromCity: "สนามบินต้นทาง",
    toCity: "สนามบินปลายทาง",
    operatingCarrier: "สายการบินที่ให้บริการ",
    flightNumber: "หมายเลขเที่ยวบิน",
    dateOfFlight: "วันเดินทาง (Julian)",
    compartmentCode: "ชั้นโดยสาร",
    seatNumber: "หมายเลขที่นั่ง",
    checkInSequenceNumber: "ลำดับการเช็กอิน",
    passengerStatus: "สถานะผู้โดยสาร",
    flightDate: "วันเดินทาง (แปลงแล้ว)",
  };

  class BCBPParseError extends Error {}

  // ---- cursor เดินอ่าน string ทีละช่วง ----
  class Cursor {
    constructor(text) { this.text = text; this.pos = 0; }
    get remaining() { return this.text.length - this.pos; }
    read(length) {
      if (length <= 0) return null;
      if (this.remaining < length) {
        const chunk = this.text.slice(this.pos);
        this.pos = this.text.length;
        return chunk.trim() || null;
      }
      const chunk = this.text.slice(this.pos, this.pos + length);
      this.pos += length;
      return chunk.trim() || null;
    }
  }

  function readFields(cursor, spec, limit) {
    const out = {};
    const end = limit == null ? cursor.text.length : cursor.pos + limit;
    for (const [key, length] of spec) {
      if (cursor.pos >= end) break;
      out[key] = cursor.read(Math.min(length, end - cursor.pos));
    }
    return out;
  }

  function hexSize(value) {
    if (!value) return 0;
    const n = parseInt(value, 16);
    return Number.isNaN(n) ? 0 : n;
  }

  function julianToDate(julian, yearHint) {
    if (!julian || !yearHint) return null;
    const day = parseInt(julian, 10);
    if (Number.isNaN(day) || day < 1 || day > 366) return null;
    const d = new Date(Date.UTC(yearHint, 0, 1));
    d.setUTCDate(d.getUTCDate() + day - 1);
    if (d.getUTCFullYear() !== yearHint && day <= 366) {
      // day-of-year เกินจำนวนวันของปี (เช่น 366 ในปีปกติ)
      if (d.getUTCFullYear() > yearHint) return null;
    }
    return d.toISOString().slice(0, 10);
  }

  function parseConditional(cur, blockEnd, result, leg, isFirstLeg) {
    if (isFirstLeg && cur.pos < blockEnd && cur.text[cur.pos] === ">") {
      cur.read(1);
      result.versionNumber = cur.read(1);
      const uniqSize = hexSize(cur.read(2));
      if (uniqSize) {
        const uniqEnd = Math.min(cur.pos + uniqSize, blockEnd);
        result.conditionalUnique = readFields(cur, CONDITIONAL_UNIQUE, uniqEnd - cur.pos);
        cur.pos = uniqEnd;
      }
    }
    if (cur.pos < blockEnd) {
      const repSize = hexSize(cur.read(2));
      if (repSize) {
        const repEnd = Math.min(cur.pos + repSize, blockEnd);
        leg.conditionalRepeated = readFields(cur, CONDITIONAL_REPEATED, repEnd - cur.pos);
        cur.pos = repEnd;
      }
    }
    if (cur.pos < blockEnd) {
      const airlineUse = cur.text.slice(cur.pos, blockEnd).trim();
      if (airlineUse) leg.airlineUse = airlineUse;
    }
  }

  function parse(barcode, opts) {
    opts = opts || {};
    const yearHint = opts.yearHint || null;
    if (!barcode || typeof barcode !== "string")
      throw new BCBPParseError("ต้องส่ง string ที่ไม่ว่าง");

    const text = barcode.replace(/[\r\n]+$/, "");
    if (text[0] !== "M" && text[0] !== "S")
      throw new BCBPParseError(
        "ไม่ใช่รูปแบบ BCBP: ต้องขึ้นต้นด้วย 'M' แต่พบ " + JSON.stringify(text[0] || ""));

    const cur = new Cursor(text);
    const result = readFields(cur, UNIQUE_MANDATORY);

    let numLegs = parseInt(result.numberOfLegs || "1", 10);
    if (Number.isNaN(numLegs)) numLegs = 1;
    result.numberOfLegs = numLegs;

    const legs = [];
    for (let i = 0; i < numLegs; i++) {
      const leg = readFields(cur, REPEATED_MANDATORY);
      const condSize = hexSize(leg.conditionalSize);
      if (condSize > 0) {
        const blockEnd = Math.min(cur.pos + condSize, cur.text.length);
        parseConditional(cur, blockEnd, result, leg, i === 0);
        cur.pos = blockEnd;
      }
      legs.push(leg);
    }
    result.legs = legs;

    if (cur.remaining && cur.text[cur.pos] === "^") {
      cur.read(1);
      result.security = { type: cur.read(1), length: cur.read(2), data: cur.read(cur.remaining) };
    }

    for (const leg of legs) leg.flightDate = julianToDate(leg.dateOfFlight, yearHint);
    return result;
  }

  const BCBP = { parse, BCBPParseError, LABELS_TH };
  if (typeof module !== "undefined" && module.exports) module.exports = BCBP;
  else root.BCBP = BCBP;
})(typeof self !== "undefined" ? self : this);
