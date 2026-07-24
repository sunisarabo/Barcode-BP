#!/usr/bin/env python3
"""
ตัวอย่าง: ถอดรหัส BCBP จาก raw string (พิมพ์ผลลัพธ์อ่านง่าย)

วิธีใช้:
    python examples/decode_string.py "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"
    python examples/decode_string.py            # ใช้ตัวอย่าง default
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bcbp import parse, BCBPParseError
from bcbp.fields import LABELS_TH

DEFAULT = "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    try:
        data = parse(raw, year_hint=2026)
    except BCBPParseError as e:
        print(f"อ่านไม่สำเร็จ: {e}")
        return 1

    print("=" * 50)
    print("ข้อมูลผู้โดยสาร")
    print("=" * 50)
    for key in ("passengerName", "electronicTicketIndicator", "numberOfLegs"):
        print(f"  {LABELS_TH.get(key, key):<28} {data.get(key)}")

    for i, leg in enumerate(data["legs"], 1):
        print("-" * 50)
        print(f"เที่ยวบินช่วงที่ {i}")
        print("-" * 50)
        for key in ("operatingCarrierPNR", "fromCity", "toCity",
                    "operatingCarrier", "flightNumber", "dateOfFlight",
                    "compartmentCode", "seatNumber", "checkInSequenceNumber"):
            print(f"  {LABELS_TH.get(key, key):<28} {leg.get(key)}")
        if leg.get("flightDate"):
            print(f"  {'วันเดินทาง (แปลงแล้ว)':<28} {leg['flightDate']}")

    print("=" * 50)
    print("\nJSON:")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
