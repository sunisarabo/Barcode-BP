"""
ทดสอบ parser ด้วยตัวอย่างข้อมูลจริงตามมาตรฐาน IATA BCBP

รันด้วย:  python -m pytest    หรือ    python tests/test_parser.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bcbp import parse, BCBPParseError  # noqa: E402


# ตัวอย่างเที่ยวบินเดี่ยว (single leg) - ไม่มีข้อมูล conditional
SINGLE_LEG = "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"

# ตัวอย่าง 2 legs + ข้อมูล conditional (version/repeated) + security data
# สร้างตามสเปกให้ field size ทุกช่วงถูกต้อง (ดู examples/ ประกอบ)
MULTI_LEG = (
    "M2DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 162>532 RY6180 "
    "AC                                        2A0141234567890  AC AC 1234567890"
    "       20K DEF456 FRAGVALH 3664 227C012C0002 12C2A0140987654321  LH        "
    "             20K ^10DABC0123456789"
)


def test_single_leg_mandatory():
    d = parse(SINGLE_LEG)
    assert d["formatCode"] == "M"
    assert d["numberOfLegs"] == 1
    assert d["passengerName"] == "DESMARAIS/LUC"
    assert d["electronicTicketIndicator"] == "E"

    leg = d["legs"][0]
    assert leg["operatingCarrierPNR"] == "ABC123"
    assert leg["fromCity"] == "YUL"
    assert leg["toCity"] == "FRA"
    assert leg["operatingCarrier"] == "AC"
    assert leg["flightNumber"] == "0834"
    assert leg["dateOfFlight"] == "226"
    assert leg["compartmentCode"] == "F"
    assert leg["seatNumber"] == "001A"
    assert leg["checkInSequenceNumber"] == "0025"
    assert leg["passengerStatus"] == "1"


def test_julian_date_conversion():
    d = parse(SINGLE_LEG, year_hint=2024)
    # วันที่ 226 ของปี 2024 (ปีอธิกสุรทิน) = 13 ส.ค. 2024
    assert d["legs"][0]["flightDate"] == "2024-08-13"


def test_no_year_hint_leaves_date_none():
    d = parse(SINGLE_LEG)
    assert d["legs"][0]["flightDate"] is None
    # แต่ยังเก็บเลข Julian ดิบไว้เสมอ
    assert d["legs"][0]["dateOfFlight"] == "226"


def test_multi_leg_count():
    d = parse(MULTI_LEG)
    assert d["numberOfLegs"] == 2
    assert len(d["legs"]) == 2
    assert d["legs"][0]["fromCity"] == "YUL"
    assert d["legs"][1]["fromCity"] == "FRA"
    assert d["legs"][1]["toCity"] == "GVA"


def test_conditional_version_present():
    d = parse(MULTI_LEG)
    # บล็อก conditional ของ leg แรกต้องมี version marker
    assert "versionNumber" in d


def test_security_data_parsed():
    d = parse(MULTI_LEG)
    assert "security" in d
    assert d["security"]["type"] == "1"


def test_rejects_non_bcbp():
    for bad in ["", "HELLO WORLD", "X1ABC"]:
        try:
            parse(bad)
            assert False, f"ควร reject: {bad!r}"
        except BCBPParseError:
            pass


def test_tolerates_short_truncated_string():
    # กระดาษพิมพ์เองที่ข้อมูลขาด ไม่ควร crash
    d = parse("M1SHORT/NAME")
    assert d["formatCode"] == "M"
    assert d["passengerName"] == "SHORT/NAME"


if __name__ == "__main__":
    passed = failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS  {name}")
                passed += 1
            except AssertionError as e:
                print(f"  FAIL  {name}: {e}")
                failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
