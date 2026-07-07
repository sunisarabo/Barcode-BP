"""
IATA BCBP (Bar-Coded Boarding Pass) parser - Resolution 792

รับ "raw string" ที่ได้จากการสแกนบาร์โค้ด (PDF417 / QR / Aztec) แล้วถอดออกมา
เป็นโครงสร้างข้อมูล (dict) ที่ใช้งานต่อได้

การใช้งาน:
    from bcbp import parse
    data = parse("M1SMITH/JOHN         EBKKHKG TG 0692 180Y024A0012 100")
    print(data["passengerName"])          -> "SMITH/JOHN"
    print(data["legs"][0]["flightNumber"]) -> "0692"

ตัว parser นี้:
  * รองรับหลาย leg (เที่ยวบินต่อเครื่อง)
  * รองรับข้อมูล conditional ที่ความยาวไม่คงที่ (variable field)
  * ทนต่อกระดาษพิมพ์เองที่มักเว้นวรรค (space padding) หรือข้อมูลขาดหาย
    โดยไม่ throw error กลางคัน แต่จะข้าม field ที่อ่านไม่ครบ
"""

from datetime import date, timedelta

from .fields import (
    UNIQUE_MANDATORY,
    REPEATED_MANDATORY,
    CONDITIONAL_UNIQUE,
    CONDITIONAL_REPEATED,
)


class BCBPParseError(ValueError):
    """ยกขึ้นเมื่อ string ไม่ใช่รูปแบบ BCBP ที่รู้จัก"""


class _Cursor:
    """ตัวช่วยเดินอ่าน string ทีละช่วงตามความยาวที่กำหนด"""

    def __init__(self, text):
        self.text = text
        self.pos = 0

    @property
    def remaining(self):
        return len(self.text) - self.pos

    def read(self, length):
        """อ่าน length ตัวอักษร (คืน None ถ้าเหลือไม่พอ) และ strip ช่องว่าง"""
        if length <= 0 or self.remaining < length:
            chunk = self.text[self.pos:]
            self.pos = len(self.text)
            return chunk.strip() or None if length > 0 else None
        chunk = self.text[self.pos:self.pos + length]
        self.pos += length
        return chunk.strip() or None


def _read_fields(cursor, spec, limit=None):
    """อ่านชุด field ตาม spec ภายในขอบเขต limit ตัวอักษร"""
    out = {}
    end = cursor.pos + limit if limit is not None else len(cursor.text)
    for key, length in spec:
        if cursor.pos >= end:
            break
        take = min(length, end - cursor.pos)
        out[key] = cursor.read(take)
    return out


def _hex_size(value):
    """แปลง field size (เลขฐาน 16 2 หลัก) เป็น int; คืน 0 หากอ่านไม่ได้"""
    if not value:
        return 0
    try:
        return int(value, 16)
    except ValueError:
        return 0


def parse(barcode, year_hint=None):
    """
    ถอดรหัส BCBP string เป็น dict

    :param barcode:   raw string จากบาร์โค้ด
    :param year_hint: ปี ค.ศ. ไว้ช่วยแปลง Julian date -> วันที่จริง
                      (BCBP ไม่เก็บปีในเที่ยวบิน จึงต้องใส่ context)
    :raises BCBPParseError: ถ้า string ไม่ขึ้นต้นด้วย format code ที่รู้จัก
    """
    if not barcode or not isinstance(barcode, str):
        raise BCBPParseError("ต้องส่ง string ที่ไม่ว่าง")

    text = barcode.rstrip("\r\n")
    if text[:1] not in ("M", "S"):  # M=ปกติ, S=รูปแบบเก่าบางกรณี
        raise BCBPParseError(
            f"ไม่ใช่รูปแบบ BCBP: ต้องขึ้นต้นด้วย 'M' แต่พบ {text[:1]!r}"
        )

    cur = _Cursor(text)

    # --- 1) mandatory ที่ปรากฏครั้งเดียว ---
    result = _read_fields(cur, UNIQUE_MANDATORY)

    try:
        num_legs = int(result.get("numberOfLegs") or "1")
    except ValueError:
        num_legs = 1
    result["numberOfLegs"] = num_legs

    # --- 2) วนอ่านแต่ละ leg ---
    legs = []
    for leg_index in range(num_legs):
        leg = _read_fields(cur, REPEATED_MANDATORY)
        cond_size = _hex_size(leg.get("conditionalSize"))

        if cond_size > 0:
            block_end = min(cur.pos + cond_size, len(cur.text))
            _parse_conditional(cur, block_end, result, leg, leg_index == 0)
            # ข้ามให้ถึงท้ายบล็อก conditional ของ leg นี้เสมอ
            cur.pos = block_end

        legs.append(leg)

    result["legs"] = legs

    # --- 3) security data (ถ้ามี) ---
    if cur.remaining and cur.text[cur.pos] == "^":
        cur.read(1)  # "^"
        result["security"] = {
            "type": cur.read(1),
            "length": cur.read(2),
            "data": cur.read(cur.remaining),
        }

    # --- ทำให้ข้อมูลอ่านง่ายขึ้น ---
    result["passengerName"] = _clean_name(result.get("passengerName"))
    for leg in legs:
        leg["flightDate"] = _julian_to_date(leg.get("dateOfFlight"), year_hint)

    return result


def _parse_conditional(cur, block_end, result, leg, is_first_leg):
    """อ่านบล็อก conditional ภายในขอบเขต [cur.pos, block_end)"""
    # version marker ">" + version number (เฉพาะ leg แรก)
    if is_first_leg and cur.pos < block_end and cur.text[cur.pos] == ">":
        cur.read(1)
        result["versionNumber"] = cur.read(1)

        # โครงสร้าง unique conditional
        uniq_size = _hex_size(cur.read(2))
        if uniq_size:
            uniq_end = min(cur.pos + uniq_size, block_end)
            result["conditionalUnique"] = _read_fields(
                cur, CONDITIONAL_UNIQUE, limit=uniq_end - cur.pos
            )
            cur.pos = uniq_end

    # โครงสร้าง repeated conditional (มีในทุก leg)
    if cur.pos < block_end:
        rep_size = _hex_size(cur.read(2))
        if rep_size:
            rep_end = min(cur.pos + rep_size, block_end)
            leg["conditionalRepeated"] = _read_fields(
                cur, CONDITIONAL_REPEATED, limit=rep_end - cur.pos
            )
            cur.pos = rep_end

    # ที่เหลือในบล็อก = ข้อมูลเฉพาะสายการบิน (airline use)
    if cur.pos < block_end:
        airline_use = cur.text[cur.pos:block_end].strip()
        if airline_use:
            leg["airlineUse"] = airline_use


def _clean_name(name):
    """SMITH/JOHNMR -> 'SMITH/JOHNMR' (ตัดช่องว่างท้าย, คงรูปแบบ นามสกุล/ชื่อ)"""
    return name.strip() if name else None


def _julian_to_date(julian, year_hint):
    """
    แปลง Julian date (วันที่เท่าไรของปี เช่น '180') เป็น datetime.date

    BCBP ไม่เก็บ "ปี" ในช่องวันเดินทาง จึงต้องอาศัย year_hint
    ถ้าไม่ระบุ จะคืน None พร้อมเก็บเลข Julian ดิบไว้ให้แล้ว
    """
    if not julian or not year_hint:
        return None
    try:
        day_of_year = int(julian)
    except ValueError:
        return None
    if not 1 <= day_of_year <= 366:
        return None
    try:
        return (date(year_hint, 1, 1) + timedelta(days=day_of_year - 1)).isoformat()
    except ValueError:
        return None
