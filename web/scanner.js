/*
 * scanner.js — ชั้นถอด "ภาพบาร์โค้ด → ข้อความดิบ" สำหรับเว็บแอป
 *
 * เลือกเครื่องมือให้อัตโนมัติ:
 *   1) BarcodeDetector API ในตัวเบราว์เซอร์  (Chrome/Edge, Android) — เร็ว ไม่ต้องโหลด lib
 *   2) ZXing (vendor/zxing.min.js)            — fallback สำหรับ iOS/Safari ที่ไม่มี BarcodeDetector
 *
 * รองรับแหล่งภาพ 3 แบบ: กล้องสด, ไฟล์รูป (PNG/JPG), ไฟล์ PDF (ใช้ pdf.js เรนเดอร์หน้าเป็นภาพก่อน)
 *
 * ทั้งหมดทำงาน offline ได้ (ไลบรารีถูก vendor ไว้ในเครื่อง)
 */
(function (root) {
  "use strict";

  const has = (n) => n in window;
  const hasNative = () => has("BarcodeDetector");
  const hasZXing = () => typeof window.ZXing !== "undefined";

  function twoDFormats() {
    return [ZXing.BarcodeFormat.PDF_417, ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.AZTEC];
  }

  async function nativeDetector() {
    const supported = await BarcodeDetector.getSupportedFormats();
    const want = ["pdf417", "qr_code", "aztec"].filter((f) => supported.includes(f));
    return new BarcodeDetector({ formats: want.length ? want : supported });
  }

  function zxingReader() {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, twoDFormats());
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    return new ZXing.BrowserMultiFormatReader(hints);
  }

  /** ถอดบาร์โค้ดจาก element ที่เป็นภาพนิ่ง (<img> หรือ <canvas>) → คืน raw string */
  async function decodeFromElement(el) {
    // ทาง 1: ตัวตรวจในเบราว์เซอร์
    if (hasNative()) {
      try {
        const det = await nativeDetector();
        const codes = await det.detect(el);
        if (codes.length) return codes[0].rawValue;
      } catch (_) { /* ตกไปใช้ ZXing */ }
    }
    // ทาง 2: ZXing — วาดลง canvas แล้วสร้าง binary bitmap เอง
    // (createBinaryBitmap หาขนาดจาก <canvas> เปล่าไม่ได้ จึงต้องประกอบ luminance source ตรง ๆ)
    if (hasZXing()) {
      const canvas = (el.tagName === "CANVAS") ? el : toCanvas(el);
      const reader = zxingReader();
      try {
        const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
        const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
        return reader.decodeBitmap(bitmap).getText();
      } finally {
        if (reader.reset) reader.reset();
      }
    }
    throw new Error("ไม่พบเครื่องมือถอดบาร์โค้ด (ต้องมี BarcodeDetector หรือ ZXing)");
  }

  /** วาด <img> ลง canvas ใหม่ (ให้ ZXing อ่าน pixel ได้) */
  function toCanvas(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
      img.src = url;
    });
  }

  async function decodeImageFile(file) {
    const url = URL.createObjectURL(file);
    try {
      return await decodeFromElement(await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function decodePdfFile(file) {
    const pdfjs = await import("./vendor/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    // ลองทีละหน้า จนกว่าจะเจอบาร์โค้ด (บาง e-ticket มีหลายหน้า)
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 3 }); // ขยายให้บาร์โค้ดคมพอสแกน
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      try {
        const txt = await decodeFromElement(canvas);
        if (txt) return txt;
      } catch (_) { /* ลองหน้าถัดไป */ }
    }
    throw new Error("ไม่พบบาร์โค้ดในไฟล์ PDF");
  }

  /** ถอดจากไฟล์ที่ผู้ใช้อัปโหลด (รูปหรือ PDF) → คืน raw string */
  async function decodeFile(file) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    return isPdf ? decodePdfFile(file) : decodeImageFile(file);
  }

  /**
   * เปิดกล้องสแกนต่อเนื่อง
   * @returns ฟังก์ชัน stop() ไว้ปิดกล้อง
   */
  // ขอกล้องหลัง + ความละเอียดสูง (ช่วยอ่าน PDF417 บนกระดาษที่เส้นถี่)
  const CAMERA_CONSTRAINTS = {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  async function startCamera(videoEl, onResult, onError) {
    // ทาง 1: BarcodeDetector + จัดการ stream เอง
    if (hasNative()) {
      let stream, raf, active = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch (e) { onError(e); return () => {}; }
      videoEl.srcObject = stream;
      await videoEl.play();
      const det = await nativeDetector();
      const tick = async () => {
        if (!active) return;
        try {
          const codes = await det.detect(videoEl);
          if (codes.length) { onResult(codes[0].rawValue); return; }
        } catch (_) {}
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { active = false; if (raf) cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); };
    }

    // ทาง 2: ZXing (iOS/Safari) — ใช้ decodeFromConstraints เพื่อบังคับกล้องหลัง+ความละเอียด
    if (hasZXing()) {
      const reader = zxingReader();
      try {
        await reader.decodeFromConstraints(CAMERA_CONSTRAINTS, videoEl, (result) => {
          if (result) onResult(result.getText());
        });
      } catch (e) { onError(e); return () => {}; }
      return () => { reader.reset(); };
    }

    onError(new Error("เบราว์เซอร์นี้สแกนกล้องไม่ได้ — กรุณาอัปโหลดไฟล์หรือวางข้อความดิบ"));
    return () => {};
  }

  root.Scanner = { decodeFromElement, decodeFile, startCamera, hasNative, hasZXing };
})(typeof self !== "undefined" ? self : this);
