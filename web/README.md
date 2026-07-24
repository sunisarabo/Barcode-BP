# เว็บแอป / PWA — Boarding Pass Reader

เว็บแอปหน้าเดียวสำหรับสแกนและถอดรหัส Boarding Pass — ใช้ได้ทั้งบน **Gate PC**
(เดสก์ท็อป) และ **มือถือเจ้าหน้าที่** (ติดตั้งเป็นแอปได้ผ่าน PWA)

## จุดเด่น

- **ตั้งค่าประตู (Gate) + แจ้งเตือน** — ระบุเที่ยวบิน/วันที่ที่กำลังเปิดบอร์ด
  ถ้าสแกนบัตรที่ **ผิดเที่ยวบิน** หรือ **ผิดวัน** จะขึ้นแถบ **สีแดง + เสียงเตือน** ทันที
  (จำค่าไว้ใน localStorage · เว้นว่าง = ไม่ตรวจ) — ตรรกะอยู่ใน `validate.js`
- **ตรวจบัตรซ้ำ** — ถ้าสแกน **ที่นั่ง** หรือ **ลำดับเช็กอิน (seq)** ที่เคยสแกนไปแล้ว
  จะเตือน **"⛔ บัตรซ้ำ!"** (กันการใช้บัตร/บอร์ดซ้ำ) พร้อมบอกว่าเคยสแกนโดยใคร
- **เก็บ log ที่สแกนทั้งหมด** — บันทึกทุกบัตร (เวลา/ชื่อ/เที่ยวบิน/ที่นั่ง/seq/สถานะ)
  เก็บใน localStorage · **ดาวน์โหลด CSV** และ **ล้างรายการ** ได้
- **ส่งเข้า Google Sheet** — ปุ่ม 📤 Sheet ส่ง log ไปที่ Google Apps Script Web App
  ที่จัดข้อมูล **ตามปี-เดือน (แท็บ) + ตามเที่ยวบิน (กลุ่ม) + แท็บสรุป** — ดู [`../gas/README.md`](../gas/README.md)

- **สแกนผ่านกล้อง** — เลือกเครื่องมือให้อัตโนมัติ:
  - `BarcodeDetector` API ในตัวเบราว์เซอร์ (Chrome/Edge, Android/เดสก์ท็อป) — เร็ว
  - **ZXing** (vendor ไว้ในเครื่อง) — fallback สำหรับ **iOS/Safari** ที่ไม่มี BarcodeDetector
- **อัปโหลดไฟล์** — รูป (PNG/JPG) หรือ **PDF** (ใช้ pdf.js เรนเดอร์หน้าเป็นภาพก่อนถอด)
- **วางข้อความดิบ** ก็ได้
- **ทำงาน offline** — เป็น PWA มี service worker แคชไฟล์ทั้งหมด (รวมไลบรารีที่ vendor ไว้)
- **ติดตั้งลงมือถือ** — เปิดในเบราว์เซอร์แล้วเลือก "Add to Home screen"

รองรับ **iOS/Safari** และ Chrome/Edge ครบ — ไม่ต้องต่อเน็ต (ไลบรารีอยู่ใน `vendor/`)

## วิธีรัน

ต้องเสิร์ฟผ่าน HTTP (กล้อง/PWA ต้องใช้ secure context — `localhost` ถือว่าปลอดภัย):

```bash
cd web
python3 -m http.server 8000
# เปิด http://localhost:8000
```

สำหรับใช้งานจริงบนมือถือ ต้องเสิร์ฟผ่าน **HTTPS** (กล้องทำงานเฉพาะบน https หรือ localhost)

## ไฟล์

| ไฟล์ | หน้าที่ |
|------|---------|
| `index.html` | UI + ตรรกะสแกน/แสดงผล |
| `bcbp.js` | parser (พอร์ตจาก Python) ใช้ได้ทั้งเบราว์เซอร์และ Node.js |
| `scanner.js` | ชั้นถอดภาพ→string (เลือก BarcodeDetector/ZXing, รองรับกล้อง/รูป/PDF) |
| `vendor/zxing.min.js` | ZXing สำหรับ iOS/Safari (vendor ไว้ offline) |
| `vendor/pdf.min.mjs`, `vendor/pdf.worker.min.mjs` | pdf.js สำหรับอ่านไฟล์ PDF |
| `manifest.webmanifest` | ข้อมูล PWA ให้ติดตั้งเป็นแอปได้ |
| `sw.js` | service worker แคชไฟล์เพื่อ offline |
| `icon.svg` | ไอคอนแอป |

## หมายเหตุความเข้ากันได้

- Chrome/Edge (Android/เดสก์ท็อป): ใช้ `BarcodeDetector` — เร็วสุด
- iOS/Safari: ไม่มี `BarcodeDetector` → ระบบ fallback ไป **ZXing** อัตโนมัติ (ทั้งกล้องและไฟล์)
- ไฟล์ PDF: ใช้ pdf.js เรนเดอร์หน้าเป็นภาพก่อนถอด (สแกนทุกหน้าจนกว่าจะเจอบาร์โค้ด)
