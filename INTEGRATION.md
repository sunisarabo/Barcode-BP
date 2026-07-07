# การเชื่อมต่อกับระบบเช็คอิน (DCS Integration)

เอกสารนี้ตอบคำถาม **"ถอดรหัส Boarding Pass ได้แล้ว จะเอาไปลิงก์กับระบบเช็คอินยังไง"**

ตัว parser (`bcbp/`) ทำหน้าที่แค่ **แปลงบาร์โค้ด → ข้อมูล** เท่านั้น มันไม่รู้ว่า
ผู้โดยสารคนนี้เช็กอินจริงไหม/ขึ้นเครื่องได้ไหม — ข้อมูลนั้นอยู่ที่ **ระบบเช็กอิน
(DCS – Departure Control System)** ของสายการบิน เช่น Amadeus Altéa, SITA, Navitaire

## ภาพรวมสถาปัตยกรรม

```
   ผู้โดยสาร                 เครื่อง Reader (Gate/Kiosk)              ระบบเช็กอิน (DCS)
  ┌──────────┐   สแกน     ┌──────────────────────────┐   ตรวจสอบ   ┌──────────────────┐
  │ Boarding │ ────────►  │ 1. ถอดภาพ→string (ZXing)  │ ─────────► │ Passenger List   │
  │  Pass    │            │ 2. bcbp.parse() → ข้อมูล  │            │ (PNL/รายชื่อ)     │
  └──────────┘            │ 3. pre-validate ในเครื่อง │ ◄───────── │ ตอบ: OK / ปฏิเสธ  │
                          │ 4. เรียก DCS boarding API │   ผลลัพธ์   └──────────────────┘
                          │ 5. แสดงไฟเขียว/แดง + บันทึก│
                          └──────────────────────────┘
```

**ประเด็นสำคัญ:** parser ให้ "กุญแจ" ที่ใช้ค้นในระบบเช็กอิน — คือ
`operatingCarrier + flightNumber + dateOfFlight + checkInSequenceNumber`
(บางระบบใช้ e-ticket number ในบล็อก conditional ด้วย) เอาชุดนี้ไปยิงถาม DCS

## ขั้นตอนการเชื่อม (Boarding flow ที่ Gate)

1. **สแกน & ถอดรหัส** — ได้ข้อมูลผู้โดยสาร + เที่ยวบิน + sequence number
2. **ตรวจเบื้องต้นในเครื่อง (offline pre-check)** ก่อนยิง DCS เพื่อลดโหลด/จับผิดง่าย ๆ:
   - บาร์โค้ดถูก format ไหม (parser ไม่ throw)
   - เที่ยวบิน/วันที่ ตรงกับ Gate นี้และวันนี้ไหม
   - ตรวจ **ลายเซ็นดิจิทัล** (บล็อก `security` ที่ขึ้นต้นด้วย `^`) ถ้าสายการบินเซ็นบัตรมา
     → กันบัตรปลอม (ต้องมี public key ของสายการบิน) — parser ดึงบล็อกนี้ให้แล้ว
3. **เรียก DCS** ด้วยกุญแจข้างต้น — DCS ตอบสถานะ เช่น
   - ✅ ผ่าน (boarded) — เพิ่มยอด boarded count
   - ⛔ เช็กอินยังไม่เสร็จ / ที่นั่งถูกเปลี่ยน / standby ยังไม่ได้ยืนยัน
   - 🔁 บัตรถูกใช้ไปแล้ว (duplicate / already boarded)
   - 🛂 selectee — ต้องตรวจเพิ่ม (secondary screening)
   - ➡️ ให้ไปเคาน์เตอร์
4. **แสดงผล & บันทึก** — ไฟเขียว/แดงให้เจ้าหน้าที่ + ส่ง reconciliation กลับ DCS

## วิธีเชื่อมเชิงเทคนิค (เลือกตามระบบที่สนามบินใช้)

| วิธี | เหมาะกับ | หมายเหตุ |
|------|----------|----------|
| **REST/SOAP API ของ DCS** | ระบบสมัยใหม่ | ยิง HTTP ถาม/บันทึก boarding แบบเรียลไทม์ |
| **IATA Type B / PADIS EDIFACT** | สายการบิน/ระบบเดิม | ข้อความมาตรฐาน เช่น BSM (Boarding Security Message), PNL |
| **CUTE / CUPPS platform** | สนามบิน Common-Use (หลายสายการบินใช้ Gate ร่วมกัน) | แอปต้องรันบนแพลตฟอร์ม CUPPS ของสนามบิน และคุยกับ DCS ผ่าน API ของแพลตฟอร์ม |
| **Store-and-forward (offline)** | เน็ตที่ Gate ไม่เสถียร | โหลด PNL (รายชื่อผู้โดยสาร) มาแคชในเครื่อง reconcile ทีหลัง |

> หมายเหตุสำหรับสนามบิน Common-Use (เช่นในไทยส่วนใหญ่): Gate/Kiosk มักเป็นระบบ
> **CUPPS/CUSS** ที่สนามบินจัดให้ แอปของคุณอาจต้องผ่านการรับรองและเรียก DCS
> ผ่าน API กลางของผู้ให้บริการ Common-Use ไม่ได้ต่อตรงกับ DCS ของแต่ละสายการบิน

## จุดต่อในโค้ด

ออกแบบให้ parser แยกจากตัวเชื่อม DCS ชัดเจน — เห็นได้จาก
[`examples/checkin_integration.py`](examples/checkin_integration.py) ซึ่งแสดง
interface `DcsClient` ที่คุณเอาไปต่อกับ API จริงของสายการบิน/แพลตฟอร์มที่ใช้

```python
data = parse(raw_string, year_hint=2026)
leg = data["legs"][0]
status = dcs.board_passenger(
    carrier=leg["operatingCarrier"],
    flight=leg["flightNumber"],
    date_julian=leg["dateOfFlight"],
    sequence=leg["checkInSequenceNumber"],
    pnr=leg["operatingCarrierPNR"],
)   # -> BoardingDecision(accepted=..., reason=...)
```

## อ้างอิงมาตรฐาน

- IATA Resolution 792 — Bar Coded Boarding Pass (BCBP)
- IATA PADIS EDIFACT / Type B messaging — การสื่อสารระหว่างระบบ
- IATA RP 1797 — Common Use Passenger Processing Systems (CUPPS)
