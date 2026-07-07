"""
คำนิยาม field ตามมาตรฐาน IATA BCBP (Resolution 792, Version 6)

โครงสร้างข้อมูลในบาร์โค้ด Boarding Pass แบ่งเป็น 3 กลุ่มหลัก
  1. Mandatory (unique)   - ปรากฏครั้งเดียวต่อบัตร   เช่น ชื่อผู้โดยสาร
  2. Mandatory (repeated) - ปรากฏซ้ำต่อ "เที่ยวบิน (leg)" เช่น เที่ยวบิน/ที่นั่ง
  3. Conditional          - ข้อมูลเสริม ความยาวไม่คงที่ (variable) มี field size กำกับ

ทุก field กำหนดด้วย (key, length) เพื่อให้ parser เดินอ่านทีละช่วงด้วย cursor
"""

# ---------------------------------------------------------------------------
# 1) Mandatory (unique) - อ่านครั้งเดียวที่หัวของ string
# ---------------------------------------------------------------------------
UNIQUE_MANDATORY = [
    ("formatCode", 1),                 # "M"
    ("numberOfLegs", 1),               # จำนวนเที่ยวบินที่เข้ารหัส (1-9)
    ("passengerName", 20),             # นามสกุล/ชื่อ  เช่น SMITH/JOHNMR
    ("electronicTicketIndicator", 1),  # "E" = ตั๋วอิเล็กทรอนิกส์
]

# ---------------------------------------------------------------------------
# 2) Mandatory (repeated) - อ่านซ้ำต่อ leg
# ---------------------------------------------------------------------------
REPEATED_MANDATORY = [
    ("operatingCarrierPNR", 7),        # รหัสสำรองที่นั่ง (PNR / Booking Ref)
    ("fromCity", 3),                   # สนามบินต้นทาง  เช่น BKK
    ("toCity", 3),                     # สนามบินปลายทาง เช่น HKG
    ("operatingCarrier", 3),           # รหัสสายการบิน เช่น TG
    ("flightNumber", 5),               # หมายเลขเที่ยวบิน เช่น 0692
    ("dateOfFlight", 3),               # วันเดินทางแบบ Julian (วันที่เท่าไรของปี)
    ("compartmentCode", 1),            # ชั้นโดยสาร Y=ประหยัด C=ธุรกิจ F=เฟิร์สคลาส
    ("seatNumber", 4),                 # เลขที่นั่ง เช่น 024A
    ("checkInSequenceNumber", 5),      # ลำดับการเช็กอิน
    ("passengerStatus", 1),            # สถานะผู้โดยสาร
    ("conditionalSize", 2),            # ขนาด (hex) ของบล็อก conditional ของ leg นี้
]

# ---------------------------------------------------------------------------
# 3a) Conditional (unique) - อยู่ในบล็อก conditional ของ leg แรก
# ---------------------------------------------------------------------------
CONDITIONAL_UNIQUE = [
    ("passengerDescription", 1),
    ("sourceOfCheckIn", 1),
    ("sourceOfBoardingPassIssuance", 1),
    ("dateOfIssueOfBoardingPass", 4),  # Julian (มีหลักปีนำหน้า)
    ("documentType", 1),
    ("airlineDesignatorOfBoardingPassIssuer", 3),
    ("baggageTagLicensePlateNumbers", 13),
    ("firstBaggageTagLicensePlateNumber", 13),
    ("secondBaggageTagLicensePlateNumber", 13),
]

# ---------------------------------------------------------------------------
# 3b) Conditional (repeated) - อยู่ในบล็อก conditional ของทุก leg
# ---------------------------------------------------------------------------
CONDITIONAL_REPEATED = [
    ("airlineNumericCode", 3),
    ("documentFormSerialNumber", 10),
    ("selecteeIndicator", 1),
    ("internationalDocumentVerification", 1),
    ("marketingCarrierDesignator", 3),
    ("frequentFlyerAirlineDesignator", 3),
    ("frequentFlyerNumber", 16),
    ("idAdIndicator", 1),
    ("freeBaggageAllowance", 3),
    ("fastTrack", 1),
]

# ป้ายกำกับภาษาไทยสำหรับแสดงผลให้อ่านง่าย
LABELS_TH = {
    "formatCode": "รหัสฟอร์แมต",
    "numberOfLegs": "จำนวนเที่ยวบิน (legs)",
    "passengerName": "ชื่อผู้โดยสาร",
    "electronicTicketIndicator": "ตัวบ่งชี้ตั๋วอิเล็กทรอนิกส์",
    "operatingCarrierPNR": "รหัสสำรองที่นั่ง (PNR)",
    "fromCity": "สนามบินต้นทาง",
    "toCity": "สนามบินปลายทาง",
    "operatingCarrier": "สายการบินที่ให้บริการ",
    "flightNumber": "หมายเลขเที่ยวบิน",
    "dateOfFlight": "วันเดินทาง (Julian)",
    "compartmentCode": "ชั้นโดยสาร",
    "seatNumber": "หมายเลขที่นั่ง",
    "checkInSequenceNumber": "ลำดับการเช็กอิน",
    "passengerStatus": "สถานะผู้โดยสาร",
}
