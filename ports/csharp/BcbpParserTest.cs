// BcbpParserTest.cs — ชุดทดสอบ parser ฝั่ง C# (self-contained, ไม่พึ่ง framework)
//
//   cd ports/csharp
//   dotnet run                      (ถ้าตั้งเป็น console project)
//   หรือรวมกับ xUnit/NUnit ตามที่โปรเจกต์คุณใช้
//
// ตัวอย่างข้อมูลตรงกับฝั่ง Python/Java เพื่อยืนยันว่าทุกพอร์ตให้ผลเท่ากัน

using System;
using Bcbp;

class BcbpParserTest
{
    const string SingleLeg =
        "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100";

    // 2 legs + conditional (version/repeated) + security
    const string MultiLeg =
        "M2DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 162>532 RY6180 " +
        "AC                                        2A0141234567890  AC AC 1234567890" +
        "       20K DEF456 FRAGVALH 3664 227C012C0002 12C2A0140987654321  LH        " +
        "             20K ^10DABC0123456789";

    static int passed = 0, failed = 0;

    static void Check(string name, bool cond)
    {
        if (cond) { passed++; Console.WriteLine("  PASS  " + name); }
        else { failed++; Console.WriteLine("  FAIL  " + name); }
    }

    static void Eq(string name, object a, object b) =>
        Check($"{name} ({a} == {b})", Equals(a, b));

    static int Main()
    {
        var d = BcbpParser.Parse(SingleLeg);
        Eq("formatCode", d.FormatCode, "M");
        Eq("numberOfLegs", d.NumberOfLegs, 1);
        Eq("passengerName", d.PassengerName, "DESMARAIS/LUC");
        Eq("electronicTicketIndicator", d.ElectronicTicketIndicator, "E");
        var leg = d.Legs[0];
        Eq("PNR", leg.OperatingCarrierPNR, "ABC123");
        Eq("fromCity", leg.FromCity, "YUL");
        Eq("toCity", leg.ToCity, "FRA");
        Eq("operatingCarrier", leg.OperatingCarrier, "AC");
        Eq("flightNumber", leg.FlightNumber, "0834");
        Eq("seatNumber", leg.SeatNumber, "001A");
        Eq("checkInSequenceNumber", leg.CheckInSequenceNumber, "0025");

        var d24 = BcbpParser.Parse(SingleLeg, 2024);
        Eq("julianDate2024", d24.Legs[0].FlightDate, new DateTime(2024, 8, 13));

        Check("noYearHintDateNull", d.Legs[0].FlightDate == null);
        Eq("rawJulianKept", d.Legs[0].DateOfFlight, "226");

        var m = BcbpParser.Parse(MultiLeg, 2024);
        Eq("multiLegCount", m.NumberOfLegs, 2);
        Check("multiLegSize", m.Legs.Count == 2);
        Eq("leg1From", m.Legs[0].FromCity, "YUL");
        Eq("leg2From", m.Legs[1].FromCity, "FRA");
        Eq("leg2To", m.Legs[1].ToCity, "GVA");
        Check("versionPresent", m.VersionNumber != null);
        Check("securityPresent", m.Security != null);
        Eq("securityType", m.Security["type"], "1");
        Eq("ffNumberLeg1", m.Legs[0].ConditionalRepeated["frequentFlyerNumber"], "1234567890");

        foreach (var bad in new[] { "HELLO WORLD", "X1ABC" })
        {
            bool threw = false;
            try { BcbpParser.Parse(bad); } catch (BcbpParseException) { threw = true; }
            Check($"reject[{bad}]", threw);
        }

        var t = BcbpParser.Parse("M1SHORT/NAME");
        Eq("truncatedName", t.PassengerName, "SHORT/NAME");

        Console.WriteLine($"\n{passed} passed, {failed} failed");
        return failed > 0 ? 1 : 0;
    }
}
