#!/usr/bin/env python3
"""
ตัวอย่าง: อ่านบาร์โค้ด Boarding Pass จากไฟล์ "ภาพ" (PDF417 / QR / Aztec)
แล้วส่งต่อให้ parser ถอดรหัส

นี่คือการต่อจิ๊กซอว์ตามที่คุยไว้:
    [ภาพบาร์โค้ด] --(ZBar/OpenCV ถอดเส้นบาร์โค้ด)--> [raw string] --(bcbp.parse)--> [ข้อมูล]

ต้องติดตั้ง library ถอดภาพก่อน (เลือกอย่างใดอย่างหนึ่ง):
    pip install pyzbar pillow          # ZBar - เร็ว ดีกับ QR/Aztec
    # หรือใช้ opencv ช่วย pre-process ภาพที่สแกนจากจอมือถือ/กระดาษยับ

หมายเหตุ: pyzbar อ่าน QR/Aztec ได้ดี ส่วน PDF417 บนกระดาษ
แนะนำใช้ zxing-cpp (pip install zxing-cpp) ซึ่งรองรับ PDF417 ครบกว่า

วิธีใช้:
    python examples/scan_image.py path/to/boardingpass.png
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bcbp import parse, BCBPParseError


def decode_barcode(image_path):
    """ลองถอดบาร์โค้ดด้วย zxing-cpp ก่อน (รองรับ PDF417) แล้ว fallback ไป pyzbar"""
    # --- ทางเลือก 1: zxing-cpp (รองรับ PDF417/QR/Aztec ครบ) ---
    try:
        import zxingcpp
        from PIL import Image

        img = Image.open(image_path)
        results = zxingcpp.read_barcodes(img)
        if results:
            return results[0].text
    except ImportError:
        pass

    # --- ทางเลือก 2: pyzbar (ดีกับ QR/Aztec) ---
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image

        results = decode(Image.open(image_path))
        if results:
            return results[0].data.decode("utf-8", errors="replace")
    except ImportError:
        pass

    raise RuntimeError(
        "ไม่พบ library ถอดภาพบาร์โค้ด — ติดตั้งด้วย:\n"
        "    pip install zxing-cpp pillow      (แนะนำ รองรับ PDF417)\n"
        "  หรือ\n"
        "    pip install pyzbar pillow"
    )


def main():
    if len(sys.argv) < 2:
        print("วิธีใช้: python examples/scan_image.py <ไฟล์ภาพ>")
        return 1

    try:
        raw = decode_barcode(sys.argv[1])
    except (RuntimeError, FileNotFoundError) as e:
        print(f"ถอดภาพไม่สำเร็จ: {e}")
        return 1

    print(f"raw string:\n  {raw!r}\n")
    try:
        data = parse(raw, year_hint=2026)
    except BCBPParseError as e:
        print(f"parse ไม่สำเร็จ: {e}")
        return 1

    import json
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
