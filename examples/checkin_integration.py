#!/usr/bin/env python3
"""
ตัวอย่างโครง: เชื่อม parser เข้ากับระบบเช็กอิน (DCS)

จุดประสงค์คือแสดง "จุดต่อ" ให้ชัด — parser ให้ข้อมูล, ตัว DcsClient คือส่วนที่คุณ
เอาไปต่อกับ API จริงของสายการบิน/แพลตฟอร์ม Common-Use ที่สนามบินใช้

โค้ดนี้ใช้ FakeDcsClient จำลองการตอบกลับ เพื่อให้รันดู flow ได้โดยไม่ต้องมี DCS จริง
ดูรายละเอียดสถาปัตยกรรมที่ INTEGRATION.md
"""

import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bcbp import parse, BCBPParseError


@dataclass
class BoardingDecision:
    accepted: bool
    reason: str


class DcsClient:
    """
    interface สำหรับคุยกับระบบเช็กอิน — แทนที่ด้วย implementation จริง
    (REST/SOAP ของ DCS, IATA Type B, หรือ API ของแพลตฟอร์ม CUPPS)
    """

    def board_passenger(self, carrier, flight, date_julian, sequence, pnr):
        raise NotImplementedError


class FakeDcsClient(DcsClient):
    """ตัวจำลองไว้ทดสอบ flow — ในระบบจริงเปลี่ยนเป็นการเรียก API"""

    def __init__(self):
        self._boarded = set()  # จำลอง "บัตรที่ถูกใช้ไปแล้ว"

    def board_passenger(self, carrier, flight, date_julian, sequence, pnr):
        key = (carrier, flight, date_julian, sequence)

        if not sequence:
            return BoardingDecision(False, "ยังเช็กอินไม่เสร็จ — เชิญที่เคาน์เตอร์")
        if key in self._boarded:
            return BoardingDecision(False, "บัตรนี้ถูกใช้ขึ้นเครื่องไปแล้ว (duplicate)")

        self._boarded.add(key)
        return BoardingDecision(True, f"ผ่าน — {carrier}{flight} ลำดับ {sequence}")


def board_from_barcode(raw_string, dcs, year_hint=None):
    """ถอดรหัสบัตร → ตรวจเบื้องต้น → ยิงถาม DCS → คืนผลการบอร์ด"""
    # 1) ถอดรหัส (pre-validate ระดับ format)
    try:
        data = parse(raw_string, year_hint=year_hint)
    except BCBPParseError as e:
        return BoardingDecision(False, f"บัตรอ่านไม่ได้: {e}")

    leg = data["legs"][0]

    # 2) ตรวจลายเซ็นดิจิทัล (ถ้าสายการบินเซ็นบัตรมา) — กันบัตรปลอม
    if data.get("security"):
        # TODO: verify data["security"]["data"] ด้วย public key ของสายการบิน
        pass

    # 3) ยิงถามระบบเช็กอิน
    return dcs.board_passenger(
        carrier=leg.get("operatingCarrier"),
        flight=leg.get("flightNumber"),
        date_julian=leg.get("dateOfFlight"),
        sequence=leg.get("checkInSequenceNumber"),
        pnr=leg.get("operatingCarrierPNR"),
    )


if __name__ == "__main__":
    dcs = FakeDcsClient()
    sample = "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"

    print("ครั้งที่ 1:", board_from_barcode(sample, dcs, year_hint=2026))
    print("ครั้งที่ 2:", board_from_barcode(sample, dcs, year_hint=2026),
          "  <- ตรวจจับการใช้บัตรซ้ำ")
