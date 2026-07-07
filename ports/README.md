# พอร์ตภาษาอื่น — C# / Java

พอร์ตของ parser (`bcbp/parser.py`) ไปยังภาษาที่ระบบเดิมของสนามบินมักใช้
ตรรกะเหมือนกันทุกประการ — รับ raw string คืนโครงสร้างข้อมูลเดียวกัน

## Java

```bash
cd ports/java
javac BcbpParser.java
java bcbp.BcbpParser "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100"
```

เรียกใช้ในโค้ด:

```java
import bcbp.BcbpParser;

BcbpParser.Result d = BcbpParser.parse(rawString, 2026);
System.out.println(d.passengerName);
System.out.println(d.legs.get(0).flightNumber);
```

## C# / .NET

```csharp
using Bcbp;

BcbpResult d = BcbpParser.Parse(rawString, 2026);
Console.WriteLine(d.PassengerName);
Console.WriteLine(d.Legs[0].FlightNumber);
```

ต้องการ .NET Core 2.0+ / .NET 5+ (ใช้ `Dictionary.GetValueOrDefault`)

## สถานะการทดสอบ

- **Java** — คอมไพล์และรันผ่านแล้ว ผลตรงกับ reference (Python)
- **C#** — ตรรกะ mirror จาก Java แบบ field-per-field แต่ยังไม่ได้คอมไพล์
  ในสภาพแวดล้อมนี้ (ไม่มี .NET SDK) — แนะนำรัน unit test ฝั่งคุณก่อนขึ้นระบบจริง

## การเชื่อมกับตัวสแกน (ภาพ → string)

parser เหล่านี้รับ *ข้อความดิบ* ที่ถอดจากบาร์โค้ดแล้ว ส่วนการถอด "ภาพ → string"
ใช้ไลบรารีในแต่ละภาษา:

- **Java**: ZXing (`com.google.zxing`) — รองรับ PDF417/QR/Aztec
- **C#**: ZXing.Net — พอร์ต ZXing มายัง .NET
