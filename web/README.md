# เว็บแอป / PWA — Boarding Pass Reader

เว็บแอปหน้าเดียวสำหรับสแกนและถอดรหัส Boarding Pass — ใช้ได้ทั้งบน **Gate PC**
(เดสก์ท็อป) และ **มือถือเจ้าหน้าที่** (ติดตั้งเป็นแอปได้ผ่าน PWA)

## จุดเด่น

- **ไม่พึ่ง library ภายนอก** — ใช้ `BarcodeDetector` API ในตัวเบราว์เซอร์
  ถอดบาร์โค้ด PDF417 / QR / Aztec ได้ (รองรับดีบน Chrome/Edge บน Android และเดสก์ท็อป)
- **สแกนผ่านกล้อง** หรือ **วางข้อความดิบ** ก็ได้
- **ทำงาน offline** — เป็น PWA มี service worker แคชไฟล์ไว้ (เหมาะกับจุด Gate ที่เน็ตไม่เสถียร)
- **ติดตั้งลงมือถือ** — เปิดใน Chrome แล้วเลือก "Add to Home screen"

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
| `manifest.webmanifest` | ข้อมูล PWA ให้ติดตั้งเป็นแอปได้ |
| `sw.js` | service worker แคชไฟล์เพื่อ offline |
| `icon.svg` | ไอคอนแอป |

## หมายเหตุความเข้ากันได้

`BarcodeDetector` รองรับดีบน Chrome/Edge (Android + เดสก์ท็อป) แต่ **Safari/iOS
ยังไม่รองรับ** — บน iOS ให้ใช้ช่อง "วางข้อความดิบ" หรือเสริมด้วยไลบรารี JS เช่น
`@zxing/browser` (โหลดเพิ่มได้) หากต้องรองรับ iOS ครบ
