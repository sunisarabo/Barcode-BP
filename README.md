# Barcode-BP — ตัวถอดรหัส Boarding Pass (IATA BCBP)

ไลบรารีภาษา Python สำหรับ **ถอดรหัส Boarding Pass** ตามมาตรฐาน
**IATA BCBP (Bar-Coded Boarding Pass) — Resolution 792** ซึ่งเป็นรูปแบบข้อมูล
ที่ระบบสนามบินทั่วโลกยอมรับ (บาร์โค้ด 2 มิติ: PDF417 / QR Code / Aztec)

นี่คือส่วน **"หัวใจสำคัญ"** ของระบบ Reader ที่ต้องพัฒนาเอง — คือการ *Parse*
(หั่น) ข้อความดิบที่อ่านได้จากบาร์โค้ด ให้กลายเป็นข้อมูลที่ใช้งานต่อได้
ส่วนการถอด "ภาพบาร์โค้ด → ข้อความ" ใช้ไลบรารีฟรี (ZXing / ZBar) ได้เลย

## ทำไมต้องเขียน Parser เอง

เมื่อเครื่องสแกนอ่านบาร์โค้ดสำเร็จ คุณจะได้ **ข้อความดิบ (raw string)** 1 ชุด เช่น

```
M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100
```

ข้อความนี้ถูกจัดฟอร์แมตตามตำแหน่งที่ IATA กำหนดแบบตายตัว (fixed-width) หน้าที่
ของซอฟต์แวร์คือหั่นออกเป็นช่อง ๆ ให้ถูกต้อง — รวมถึงกรณีที่ยากคือ
**เที่ยวบินต่อเครื่องหลายช่วง (multi-leg)** และ **ข้อมูลเสริม (conditional)**
ที่มีความยาวไม่คงที่ ซึ่ง library ถอดภาพทั่วไปไม่ได้ทำให้

## ความสามารถ

- ✅ ถอด mandatory fields ครบ (ชื่อ, เที่ยวบิน, ที่นั่ง, PNR, ลำดับเช็กอิน ฯลฯ)
- ✅ รองรับหลาย leg (เที่ยวบินต่อเครื่อง)
- ✅ ถอดข้อมูล conditional ทั้งแบบ unique และ repeated (version, เลข FF, สัมภาระ ฯลฯ)
- ✅ ถอด security data (`^`)
- ✅ แปลง Julian date → วันที่จริง (`226` → `2026-08-14`)
- ✅ ทนทานต่อกระดาษพิมพ์เองที่ข้อมูลขาด/เว้นวรรค โดยไม่ crash
- ✅ ไม่พึ่งพา dependency ภายนอกสำหรับส่วน parser (pure Python)

## การติดตั้ง

ส่วน parser ใช้ Python มาตรฐานล้วน ไม่ต้องติดตั้งอะไรเพิ่ม (Python 3.8+)

```bash
git clone <repo-url>
cd Barcode-BP
```

ถ้าต้องการอ่านจาก **ไฟล์ภาพ** ด้วย ให้ติดตั้งไลบรารีถอดภาพ (เลือกอย่างใดอย่างหนึ่ง):

```bash
pip install zxing-cpp pillow     # แนะนำ — รองรับ PDF417 ครบที่สุด
# หรือ
pip install pyzbar pillow        # ZBar — เร็ว ดีกับ QR/Aztec
```

## วิธีใช้งาน

### 1. ถอดจากข้อความดิบ (โค้ด)

```python
from bcbp import parse

data = parse("M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100",
             year_hint=2026)

print(data["passengerName"])            # DESMARAIS/LUC
leg = data["legs"][0]
print(leg["operatingCarrier"], leg["flightNumber"])   # AC 0834
print(leg["seatNumber"], leg["flightDate"])           # 001A 2026-08-14
```

### 2. ถอดจากข้อความดิบ (บรรทัดคำสั่ง)

```bash
python examples/decode_string.py "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"
```

### 3. ถอดจากไฟล์ภาพบาร์โค้ด

```bash
python examples/scan_image.py boardingpass.png
```

## รูปแบบที่รองรับ (ตามมาตรฐาน IATA)

| สื่อ | บาร์โค้ด | หมายเหตุ |
|------|----------|----------|
| กระดาษจากเคาน์เตอร์ (ATB) | PDF417 | มาตรฐานหลัก |
| พิมพ์เองที่บ้าน / A4 | PDF417 | ต้องคอนทราสต์ชัด |
| มือถือ (Wallet / แอป / PDF) | QR Code / Aztec | นิยมบนหน้าจอ |

> ⚠️ บาร์โค้ด 1 มิติ (แบบสินค้าทั่วไป) **ไม่รองรับ** — เก็บข้อมูลไม่พอตามสเปก IATA

## รูปแบบการใช้งาน (Deployment)

parser ตัวเดียวกันถูกพอร์ตไปหลายแพลตฟอร์ม เลือกใช้ตามจุดติดตั้ง:

| จุดติดตั้ง | ใช้ | โฟลเดอร์ |
|-----------|-----|----------|
| Backend / Kiosk / สคริปต์ | Python | `bcbp/` |
| **Gate PC (เดสก์ท็อป)** | เว็บแอป (สแกนผ่านกล้อง) | `web/` |
| **มือถือเจ้าหน้าที่** | เว็บแอปแบบ PWA (ติดตั้งลงเครื่องได้ offline) | `web/` |
| **ระบบเดิมของสนามบิน** | พอร์ต C# / Java | `ports/` |

- **เว็บแอป / PWA** (`web/`) — หน้าเดียวจบ สแกนบาร์โค้ดผ่านกล้องด้วย `BarcodeDetector`
  ในตัวเบราว์เซอร์ (PDF417/QR/Aztec) ทำงาน offline ได้ ติดตั้งลงมือถือได้ — ดู [`web/README.md`](web/README.md)
- **C# / Java** (`ports/`) — parser ตรรกะเดียวกันสำหรับฝังในระบบเดิม — ดู [`ports/README.md`](ports/README.md)

## โครงสร้างโปรเจกต์

```
bcbp/                 # ไลบรารี Python (reference implementation)
  __init__.py         #   public API: parse(), BCBPParseError
  fields.py           #   นิยาม field ตามสเปก IATA (mandatory / conditional)
  parser.py           #   ตัว parser หลัก (cursor-based)
examples/
  decode_string.py    # ถอดจาก raw string + แสดงผลภาษาไทย
  scan_image.py       # ถอดจากไฟล์ภาพ (ZXing/ZBar) แล้วส่งต่อ parser
tests/
  test_parser.py      # ชุดทดสอบ single-leg / multi-leg / conditional / security
web/                  # เว็บแอป / PWA (Gate PC + มือถือ)
  index.html, bcbp.js, sw.js, manifest.webmanifest, icon.svg
ports/                # พอร์ต parser ภาษาอื่น
  csharp/BcbpParser.cs
  java/BcbpParser.java
```

## การทดสอบ

```bash
python tests/test_parser.py      # หรือ  python -m pytest
```

## อ้างอิง

- IATA Resolution 792 — Bar Coded Boarding Pass (BCBP)
- IATA Passenger Services Conference Resolutions Manual (PSCRM)
