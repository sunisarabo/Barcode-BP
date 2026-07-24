/*
 * samples.js — ตัวอย่างบัตรจำลองสำหรับปุ่ม "ทดสอบ" ในเว็บแอป
 *
 * แต่ละตัวอย่างคือ BCBP string จริงตามสเปก IATA (ข้อมูลจำลอง/mock)
 * ปุ่มทดสอบจะ "สร้างบาร์โค้ดขึ้นมาจริง → แล้วถอดกลับผ่าน pipeline เดียวกับของจริง"
 * (ภาพ → ZXing ถอด → BCBP.parse) เพื่อสาธิตครบวงจร ไม่ใช่แค่ parse ข้อความ
 *
 * หมายเหตุ: บาร์โค้ดที่สร้างสดบนเครื่องเป็น QR (ตัว encoder ที่ vendor ไว้รองรับ QR)
 * ส่วนบัตรกระดาษจริงมักเป็น PDF417 ซึ่งแอปนี้ "อ่านได้" เช่นกัน — ลองอัปโหลดรูปบัตรจริงดู
 */
(function (root) {
  "use strict";

  const SAMPLES = [
    {
      label: "TONGGAMKAEW/USUPHON — MU727 → NRT",
      note: "เที่ยวบิน MU727 ปลายทาง NRT (โตเกียว) · mock",
      raw: "M1TONGGAMKAEW/USUPHON ER2D3E4 PVGNRTMU 727  059R052B158  100",
    },
    {
      label: "BOONYOUNG/SUNISARA — E9696 → CDG",
      note: "เที่ยวบิน E9696 ปลายทาง CDG (ปารีส) · mock",
      raw: "M1BOONYOUNG/SUNISARA  EAB12CD HKTCDGE9 696  068Y014A001  100",
    },
  ];

  /** สร้าง canvas บาร์โค้ด QR จากข้อความ (ใช้ ZXing encoder ที่ vendor ไว้) */
  function makeBarcodeCanvas(text, size) {
    size = size || 320;
    const matrix = new ZXing.MultiFormatWriter()
      .encode(text, ZXing.BarcodeFormat.QR_CODE, size, size, new Map());
    const w = matrix.getWidth(), h = matrix.getHeight();
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (matrix.get(x, y)) ctx.fillRect(x, y, 1, 1);
    return canvas;
  }

  root.Samples = { list: SAMPLES, makeBarcodeCanvas };
})(typeof self !== "undefined" ? self : this);
