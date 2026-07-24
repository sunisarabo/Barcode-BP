"""
bcbp - ตัวถอดรหัส Boarding Pass ตามมาตรฐาน IATA BCBP (Resolution 792)

    from bcbp import parse
    data = parse(raw_string, year_hint=2026)
"""

from .parser import parse, BCBPParseError

__all__ = ["parse", "BCBPParseError"]
__version__ = "0.1.0"
