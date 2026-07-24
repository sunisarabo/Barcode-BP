# การ Deploy เว็บแอปให้สแกนได้จริง (GitHub Pages / HTTPS)

กล้องในเบราว์เซอร์ (`getUserMedia`) **เปิดได้เฉพาะบน HTTPS หรือ `localhost` เท่านั้น**
ดังนั้นถ้าเปิดไฟล์แบบ `file://` หรือเปิดผ่าน `http://<ไอพี>` บนมือถือ กล้องจะไม่ทำงาน
วิธีที่ง่ายที่สุดคือ deploy ขึ้น **GitHub Pages** ซึ่งได้ HTTPS ให้อัตโนมัติ

## ขั้นตอน (ทำครั้งเดียว)

1. เปิดหน้า repo บน GitHub → **Settings** → **Pages**
2. ที่ **Build and deployment → Source** เลือก **GitHub Actions**
3. เมื่อ merge/มี `main` แล้ว (หรือ push เข้า branch ที่ตั้งไว้) เวิร์กโฟลว์
   [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
   จะ deploy โฟลเดอร์ `web/` ให้อัตโนมัติ
4. รอ Action เสร็จ แล้วเปิด URL ที่ได้ (รูปแบบ):

   ```
   https://sunisarabo.github.io/Barcode-BP/
   ```

5. เปิด URL นั้นบน **มือถือ** → กด "📷 สแกนด้วยกล้อง" → อนุญาตกล้อง → สแกนได้เลย

> เวิร์กโฟลว์ตั้งค่าให้ทำงานเมื่อ push เข้า `main` หรือ branch พัฒนา และกดรันเองได้
> (**Actions → Deploy web app to GitHub Pages → Run workflow**)

## รันเองก่อน deploy จริง

- **บนคอมที่มีเว็บแคม (localhost ใช้ได้เลย ไม่ต้อง HTTPS):**
  ```bash
  cd web
  python3 -m http.server 8000
  # เปิด http://localhost:8000 แล้วกดสแกน
  ```

- **ทดสอบบนมือถือก่อน deploy** — ต้องมี HTTPS ทางใดทางหนึ่ง:
  - ใช้ URL ของ GitHub Pages (ง่ายสุด)
  - หรือเปิด tunnel ชั่วคราว เช่น `npx localtunnel --port 8000` / `cloudflared tunnel`
    แล้วเปิดลิงก์ `https://...` ที่ได้บนมือถือ

## เช็กลิสต์เมื่อสแกนไม่ขึ้น

| อาการ | สาเหตุ / วิธีแก้ |
|-------|-----------------|
| กดสแกนแล้วไม่มีอะไรเกิด | เปิดผ่าน `http`/`file://` — ต้องเป็น **HTTPS** หรือ `localhost` |
| ขึ้น "เปิดกล้องไม่สำเร็จ" | ยังไม่อนุญาตสิทธิ์กล้อง — กดอนุญาตในเบราว์เซอร์ |
| iOS/Safari สแกนช้า | ปกติ — iOS ใช้ ZXing (ไม่มี BarcodeDetector) จ่อให้นิ่ง/ใกล้ขึ้น |
| PDF417 บนกระดาษอ่านยาก | ให้แสงพอ ถือกล้องขนานกับบัตร ให้บาร์โค้ดเต็มกรอบเขียว |
| ยังไม่ได้จริง ๆ | ใช้ปุ่ม "🖼️ อัปโหลดไฟล์รูป/PDF" ถ่ายรูปบัตรแล้วอัปโหลดแทน |
