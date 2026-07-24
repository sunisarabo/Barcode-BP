// BcbpParser.java — ตัวถอดรหัส IATA BCBP (Resolution 792) ฝั่ง Java
//
// พอร์ตตรงจาก bcbp/parser.py — logic เดียวกัน สำหรับฝังในระบบเดิมของสนามบิน
//
//   BcbpParser.Result d = BcbpParser.parse(
//       "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100", 2026);
//   System.out.println(d.passengerName);          // DESMARAIS/LUC
//   System.out.println(d.legs.get(0).flightNumber); // 0834

package bcbp;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class BcbpParser {

    public static class BcbpParseException extends RuntimeException {
        public BcbpParseException(String m) { super(m); }
    }

    public static class Leg {
        public String operatingCarrierPNR, fromCity, toCity, operatingCarrier;
        public String flightNumber, dateOfFlight, compartmentCode, seatNumber;
        public String checkInSequenceNumber, passengerStatus, conditionalSize;
        public LocalDate flightDate;
        public Map<String, String> conditionalRepeated;
        public String airlineUse;
    }

    public static class Result {
        public String formatCode, passengerName, electronicTicketIndicator, versionNumber;
        public int numberOfLegs;
        public Map<String, String> conditionalUnique;
        public List<Leg> legs = new ArrayList<>();
        public Map<String, String> security;
    }

    // ---- นิยาม field ตามสเปก IATA ----
    private static final String[][] UNIQUE_MANDATORY = {
        {"formatCode","1"},{"numberOfLegs","1"},
        {"passengerName","20"},{"electronicTicketIndicator","1"} };
    private static final String[][] REPEATED_MANDATORY = {
        {"operatingCarrierPNR","7"},{"fromCity","3"},{"toCity","3"},
        {"operatingCarrier","3"},{"flightNumber","5"},{"dateOfFlight","3"},
        {"compartmentCode","1"},{"seatNumber","4"},{"checkInSequenceNumber","5"},
        {"passengerStatus","1"},{"conditionalSize","2"} };
    private static final String[][] CONDITIONAL_UNIQUE = {
        {"passengerDescription","1"},{"sourceOfCheckIn","1"},
        {"sourceOfBoardingPassIssuance","1"},{"dateOfIssueOfBoardingPass","4"},
        {"documentType","1"},{"airlineDesignatorOfBoardingPassIssuer","3"},
        {"baggageTagLicensePlateNumbers","13"},
        {"firstBaggageTagLicensePlateNumber","13"},
        {"secondBaggageTagLicensePlateNumber","13"} };
    private static final String[][] CONDITIONAL_REPEATED = {
        {"airlineNumericCode","3"},{"documentFormSerialNumber","10"},
        {"selecteeIndicator","1"},{"internationalDocumentVerification","1"},
        {"marketingCarrierDesignator","3"},{"frequentFlyerAirlineDesignator","3"},
        {"frequentFlyerNumber","16"},{"idAdIndicator","1"},
        {"freeBaggageAllowance","3"},{"fastTrack","1"} };

    private static final class Cursor {
        final String text; int pos = 0;
        Cursor(String t) { text = t; }
        int remaining() { return text.length() - pos; }
        String read(int length) {
            if (length <= 0) return null;
            String chunk;
            if (remaining() < length) { chunk = text.substring(pos); pos = text.length(); }
            else { chunk = text.substring(pos, pos + length); pos += length; }
            chunk = chunk.trim();
            return chunk.isEmpty() ? null : chunk;
        }
    }

    private static Map<String,String> readFields(Cursor cur, String[][] spec, Integer limit) {
        Map<String,String> out = new LinkedHashMap<>();
        int end = (limit == null) ? cur.text.length() : cur.pos + limit;
        for (String[] f : spec) {
            if (cur.pos >= end) break;
            int len = Math.min(Integer.parseInt(f[1]), end - cur.pos);
            out.put(f[0], cur.read(len));
        }
        return out;
    }

    private static int hexSize(String v) {
        if (v == null || v.isEmpty()) return 0;
        try { return Integer.parseInt(v, 16); } catch (NumberFormatException e) { return 0; }
    }

    private static LocalDate julianToDate(String julian, Integer yearHint) {
        if (julian == null || yearHint == null) return null;
        int day;
        try { day = Integer.parseInt(julian); } catch (NumberFormatException e) { return null; }
        if (day < 1 || day > 366) return null;
        LocalDate base = LocalDate.ofYearDay(yearHint, 1);
        if (day > (base.isLeapYear() ? 366 : 365)) return null;
        return LocalDate.ofYearDay(yearHint, day);
    }

    public static Result parse(String barcode) { return parse(barcode, null); }

    public static Result parse(String barcode, Integer yearHint) {
        if (barcode == null || barcode.isEmpty())
            throw new BcbpParseException("ต้องส่ง string ที่ไม่ว่าง");

        String text = barcode.replaceAll("[\\r\\n]+$", "");
        char first = text.charAt(0);
        if (first != 'M' && first != 'S')
            throw new BcbpParseException("ไม่ใช่รูปแบบ BCBP: ต้องขึ้นต้นด้วย 'M' แต่พบ '" + first + "'");

        Cursor cur = new Cursor(text);
        Map<String,String> head = readFields(cur, UNIQUE_MANDATORY, null);
        Result result = new Result();
        result.formatCode = head.get("formatCode");
        result.passengerName = head.get("passengerName");
        result.electronicTicketIndicator = head.get("electronicTicketIndicator");
        int numLegs;
        try { numLegs = Integer.parseInt(head.getOrDefault("numberOfLegs", "1")); }
        catch (NumberFormatException e) { numLegs = 1; }
        result.numberOfLegs = numLegs;

        for (int i = 0; i < numLegs; i++) {
            Map<String,String> f = readFields(cur, REPEATED_MANDATORY, null);
            Leg leg = new Leg();
            leg.operatingCarrierPNR = f.get("operatingCarrierPNR");
            leg.fromCity = f.get("fromCity");
            leg.toCity = f.get("toCity");
            leg.operatingCarrier = f.get("operatingCarrier");
            leg.flightNumber = f.get("flightNumber");
            leg.dateOfFlight = f.get("dateOfFlight");
            leg.compartmentCode = f.get("compartmentCode");
            leg.seatNumber = f.get("seatNumber");
            leg.checkInSequenceNumber = f.get("checkInSequenceNumber");
            leg.passengerStatus = f.get("passengerStatus");
            leg.conditionalSize = f.get("conditionalSize");

            int condSize = hexSize(leg.conditionalSize);
            if (condSize > 0) {
                int blockEnd = Math.min(cur.pos + condSize, cur.text.length());
                parseConditional(cur, blockEnd, result, leg, i == 0);
                cur.pos = blockEnd;
            }
            leg.flightDate = julianToDate(leg.dateOfFlight, yearHint);
            result.legs.add(leg);
        }

        if (cur.remaining() > 0 && cur.text.charAt(cur.pos) == '^') {
            cur.read(1);
            Map<String,String> sec = new LinkedHashMap<>();
            sec.put("type", cur.read(1));
            sec.put("length", cur.read(2));
            sec.put("data", cur.read(cur.remaining()));
            result.security = sec;
        }
        return result;
    }

    private static void parseConditional(Cursor cur, int blockEnd, Result result,
                                         Leg leg, boolean isFirstLeg) {
        if (isFirstLeg && cur.pos < blockEnd && cur.text.charAt(cur.pos) == '>') {
            cur.read(1);
            result.versionNumber = cur.read(1);
            int uniqSize = hexSize(cur.read(2));
            if (uniqSize > 0) {
                int uniqEnd = Math.min(cur.pos + uniqSize, blockEnd);
                result.conditionalUnique = readFields(cur, CONDITIONAL_UNIQUE, uniqEnd - cur.pos);
                cur.pos = uniqEnd;
            }
        }
        if (cur.pos < blockEnd) {
            int repSize = hexSize(cur.read(2));
            if (repSize > 0) {
                int repEnd = Math.min(cur.pos + repSize, blockEnd);
                leg.conditionalRepeated = readFields(cur, CONDITIONAL_REPEATED, repEnd - cur.pos);
                cur.pos = repEnd;
            }
        }
        if (cur.pos < blockEnd) {
            String airlineUse = cur.text.substring(cur.pos, blockEnd).trim();
            if (!airlineUse.isEmpty()) leg.airlineUse = airlineUse;
        }
    }

    // ---- ทดสอบเร็ว ๆ: javac BcbpParser.java && java bcbp.BcbpParser ----
    public static void main(String[] args) {
        String s = (args.length > 0) ? args[0]
            : "M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100";
        Result d = parse(s, 2026);
        System.out.println("passenger : " + d.passengerName);
        System.out.println("legs      : " + d.numberOfLegs);
        for (Leg leg : d.legs) {
            System.out.println("  " + leg.fromCity + "->" + leg.toCity + " "
                + leg.operatingCarrier + leg.flightNumber + " seat " + leg.seatNumber
                + " date " + leg.flightDate);
        }
    }
}
