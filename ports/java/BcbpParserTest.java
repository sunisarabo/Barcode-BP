// BcbpParserTest.java — ชุดทดสอบ parser ฝั่ง Java (ไม่พึ่ง JUnit)
//
//   cd ports/java
//   javac BcbpParser.java BcbpParserTest.java
//   java bcbp.BcbpParserTest
//
// ตัวอย่างข้อมูลตรงกับฝั่ง Python (tests/test_parser.py) เพื่อยืนยันว่าทุกพอร์ตให้ผลเท่ากัน

package bcbp;

import java.time.LocalDate;

public class BcbpParserTest {

    static final String SINGLE_LEG =
        "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100";

    // 2 legs + conditional (version/repeated) + security
    static final String MULTI_LEG =
        "M2DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 162>532 RY6180 "
      + "AC                                        2A0141234567890  AC AC 1234567890"
      + "       20K DEF456 FRAGVALH 3664 227C012C0002 12C2A0140987654321  LH        "
      + "             20K ^10DABC0123456789";

    static int passed = 0, failed = 0;

    static void check(String name, boolean cond) {
        if (cond) { passed++; System.out.println("  PASS  " + name); }
        else { failed++; System.out.println("  FAIL  " + name); }
    }

    static void eq(String name, Object a, Object b) {
        check(name + " (" + a + " == " + b + ")", a == null ? b == null : a.equals(b));
    }

    public static void main(String[] args) {
        // --- single leg mandatory ---
        BcbpParser.Result d = BcbpParser.parse(SINGLE_LEG);
        eq("formatCode", d.formatCode, "M");
        eq("numberOfLegs", d.numberOfLegs, 1);
        eq("passengerName", d.passengerName, "DESMARAIS/LUC");
        eq("electronicTicketIndicator", d.electronicTicketIndicator, "E");
        BcbpParser.Leg leg = d.legs.get(0);
        eq("PNR", leg.operatingCarrierPNR, "ABC123");
        eq("fromCity", leg.fromCity, "YUL");
        eq("toCity", leg.toCity, "FRA");
        eq("operatingCarrier", leg.operatingCarrier, "AC");
        eq("flightNumber", leg.flightNumber, "0834");
        eq("dateOfFlight", leg.dateOfFlight, "226");
        eq("seatNumber", leg.seatNumber, "001A");
        eq("checkInSequenceNumber", leg.checkInSequenceNumber, "0025");

        // --- Julian date conversion (226 ของปี 2024 = 13 ส.ค.) ---
        BcbpParser.Result d24 = BcbpParser.parse(SINGLE_LEG, 2024);
        eq("julianDate2024", d24.legs.get(0).flightDate, LocalDate.of(2024, 8, 13));

        // --- ไม่มี yearHint => flightDate เป็น null แต่ยังเก็บ Julian ดิบ ---
        check("noYearHintDateNull", d.legs.get(0).flightDate == null);
        eq("rawJulianKept", d.legs.get(0).dateOfFlight, "226");

        // --- multi-leg ---
        BcbpParser.Result m = BcbpParser.parse(MULTI_LEG, 2024);
        eq("multiLegCount", m.numberOfLegs, 2);
        check("multiLegSize", m.legs.size() == 2);
        eq("leg1From", m.legs.get(0).fromCity, "YUL");
        eq("leg2From", m.legs.get(1).fromCity, "FRA");
        eq("leg2To", m.legs.get(1).toCity, "GVA");
        check("versionPresent", m.versionNumber != null);
        check("securityPresent", m.security != null);
        eq("securityType", m.security.get("type"), "1");
        eq("ffNumberLeg1", m.legs.get(0).conditionalRepeated.get("frequentFlyerNumber"), "1234567890");

        // --- reject non-BCBP ---
        for (String bad : new String[]{"HELLO WORLD", "X1ABC"}) {
            boolean threw = false;
            try { BcbpParser.parse(bad); } catch (BcbpParser.BcbpParseException e) { threw = true; }
            check("reject[" + bad + "]", threw);
        }

        // --- tolerate truncated ---
        BcbpParser.Result t = BcbpParser.parse("M1SHORT/NAME");
        eq("truncatedName", t.passengerName, "SHORT/NAME");

        System.out.println("\n" + passed + " passed, " + failed + " failed");
        if (failed > 0) System.exit(1);
    }
}
