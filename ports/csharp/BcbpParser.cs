// BcbpParser.cs — ตัวถอดรหัส IATA BCBP (Resolution 792) ฝั่ง C#/.NET
//
// พอร์ตตรงจาก bcbp/parser.py — logic เดียวกัน สำหรับฝังในระบบเดิมของสนามบิน
//
//   var data = BcbpParser.Parse("M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100", 2026);
//   Console.WriteLine(data.PassengerName);            // DESMARAIS/LUC
//   Console.WriteLine(data.Legs[0].FlightNumber);     // 0834

using System;
using System.Collections.Generic;
using System.Globalization;

namespace Bcbp
{
    public class BcbpParseException : Exception
    {
        public BcbpParseException(string message) : base(message) { }
    }

    public class BcbpLeg
    {
        public string OperatingCarrierPNR;
        public string FromCity;
        public string ToCity;
        public string OperatingCarrier;
        public string FlightNumber;
        public string DateOfFlight;          // Julian ดิบ เช่น "226"
        public string CompartmentCode;
        public string SeatNumber;
        public string CheckInSequenceNumber;
        public string PassengerStatus;
        public string ConditionalSize;
        public DateTime? FlightDate;         // แปลงจาก Julian แล้ว (ถ้ามี yearHint)
        public Dictionary<string, string> ConditionalRepeated;
        public string AirlineUse;
    }

    public class BcbpResult
    {
        public string FormatCode;
        public int NumberOfLegs;
        public string PassengerName;
        public string ElectronicTicketIndicator;
        public string VersionNumber;
        public Dictionary<string, string> ConditionalUnique;
        public List<BcbpLeg> Legs = new List<BcbpLeg>();
        public Dictionary<string, string> Security;
    }

    public static class BcbpParser
    {
        private static readonly (string, int)[] UniqueMandatory = {
            ("formatCode", 1), ("numberOfLegs", 1),
            ("passengerName", 20), ("electronicTicketIndicator", 1),
        };
        private static readonly (string, int)[] RepeatedMandatory = {
            ("operatingCarrierPNR", 7), ("fromCity", 3), ("toCity", 3),
            ("operatingCarrier", 3), ("flightNumber", 5), ("dateOfFlight", 3),
            ("compartmentCode", 1), ("seatNumber", 4), ("checkInSequenceNumber", 5),
            ("passengerStatus", 1), ("conditionalSize", 2),
        };
        private static readonly (string, int)[] ConditionalUnique = {
            ("passengerDescription", 1), ("sourceOfCheckIn", 1),
            ("sourceOfBoardingPassIssuance", 1), ("dateOfIssueOfBoardingPass", 4),
            ("documentType", 1), ("airlineDesignatorOfBoardingPassIssuer", 3),
            ("baggageTagLicensePlateNumbers", 13),
            ("firstBaggageTagLicensePlateNumber", 13),
            ("secondBaggageTagLicensePlateNumber", 13),
        };
        private static readonly (string, int)[] ConditionalRepeated = {
            ("airlineNumericCode", 3), ("documentFormSerialNumber", 10),
            ("selecteeIndicator", 1), ("internationalDocumentVerification", 1),
            ("marketingCarrierDesignator", 3), ("frequentFlyerAirlineDesignator", 3),
            ("frequentFlyerNumber", 16), ("idAdIndicator", 1),
            ("freeBaggageAllowance", 3), ("fastTrack", 1),
        };

        private class Cursor
        {
            public string Text;
            public int Pos;
            public Cursor(string t) { Text = t; Pos = 0; }
            public int Remaining => Text.Length - Pos;

            public string Read(int length)
            {
                if (length <= 0) return null;
                string chunk;
                if (Remaining < length)
                {
                    chunk = Text.Substring(Pos);
                    Pos = Text.Length;
                }
                else
                {
                    chunk = Text.Substring(Pos, length);
                    Pos += length;
                }
                chunk = chunk.Trim();
                return chunk.Length == 0 ? null : chunk;
            }
        }

        private static Dictionary<string, string> ReadFields(
            Cursor cur, (string, int)[] spec, int? limit = null)
        {
            var outp = new Dictionary<string, string>();
            int end = limit.HasValue ? cur.Pos + limit.Value : cur.Text.Length;
            foreach (var (key, length) in spec)
            {
                if (cur.Pos >= end) break;
                outp[key] = cur.Read(Math.Min(length, end - cur.Pos));
            }
            return outp;
        }

        private static int HexSize(string value)
        {
            if (string.IsNullOrEmpty(value)) return 0;
            return int.TryParse(value, NumberStyles.HexNumber,
                CultureInfo.InvariantCulture, out int n) ? n : 0;
        }

        private static DateTime? JulianToDate(string julian, int? yearHint)
        {
            if (string.IsNullOrEmpty(julian) || !yearHint.HasValue) return null;
            if (!int.TryParse(julian, out int day) || day < 1 || day > 366) return null;
            int year = yearHint.Value;
            if (day > (DateTime.IsLeapYear(year) ? 366 : 365)) return null;
            return new DateTime(year, 1, 1).AddDays(day - 1);
        }

        public static BcbpResult Parse(string barcode, int? yearHint = null)
        {
            if (string.IsNullOrEmpty(barcode))
                throw new BcbpParseException("ต้องส่ง string ที่ไม่ว่าง");

            string text = barcode.TrimEnd('\r', '\n');
            if (text[0] != 'M' && text[0] != 'S')
                throw new BcbpParseException(
                    $"ไม่ใช่รูปแบบ BCBP: ต้องขึ้นต้นด้วย 'M' แต่พบ '{text[0]}'");

            var cur = new Cursor(text);
            var head = ReadFields(cur, UniqueMandatory);
            var result = new BcbpResult
            {
                FormatCode = head.GetValueOrDefault("formatCode"),
                PassengerName = head.GetValueOrDefault("passengerName"),
                ElectronicTicketIndicator = head.GetValueOrDefault("electronicTicketIndicator"),
            };
            if (!int.TryParse(head.GetValueOrDefault("numberOfLegs"), out int numLegs))
                numLegs = 1;
            result.NumberOfLegs = numLegs;

            for (int i = 0; i < numLegs; i++)
            {
                var f = ReadFields(cur, RepeatedMandatory);
                var leg = new BcbpLeg
                {
                    OperatingCarrierPNR = f.GetValueOrDefault("operatingCarrierPNR"),
                    FromCity = f.GetValueOrDefault("fromCity"),
                    ToCity = f.GetValueOrDefault("toCity"),
                    OperatingCarrier = f.GetValueOrDefault("operatingCarrier"),
                    FlightNumber = f.GetValueOrDefault("flightNumber"),
                    DateOfFlight = f.GetValueOrDefault("dateOfFlight"),
                    CompartmentCode = f.GetValueOrDefault("compartmentCode"),
                    SeatNumber = f.GetValueOrDefault("seatNumber"),
                    CheckInSequenceNumber = f.GetValueOrDefault("checkInSequenceNumber"),
                    PassengerStatus = f.GetValueOrDefault("passengerStatus"),
                    ConditionalSize = f.GetValueOrDefault("conditionalSize"),
                };

                int condSize = HexSize(leg.ConditionalSize);
                if (condSize > 0)
                {
                    int blockEnd = Math.Min(cur.Pos + condSize, cur.Text.Length);
                    ParseConditional(cur, blockEnd, result, leg, i == 0);
                    cur.Pos = blockEnd;
                }
                leg.FlightDate = JulianToDate(leg.DateOfFlight, yearHint);
                result.Legs.Add(leg);
            }

            if (cur.Remaining > 0 && cur.Text[cur.Pos] == '^')
            {
                cur.Read(1);
                result.Security = new Dictionary<string, string>
                {
                    ["type"] = cur.Read(1),
                    ["length"] = cur.Read(2),
                    ["data"] = cur.Read(cur.Remaining),
                };
            }
            return result;
        }

        private static void ParseConditional(
            Cursor cur, int blockEnd, BcbpResult result, BcbpLeg leg, bool isFirstLeg)
        {
            if (isFirstLeg && cur.Pos < blockEnd && cur.Text[cur.Pos] == '>')
            {
                cur.Read(1);
                result.VersionNumber = cur.Read(1);
                int uniqSize = HexSize(cur.Read(2));
                if (uniqSize > 0)
                {
                    int uniqEnd = Math.Min(cur.Pos + uniqSize, blockEnd);
                    result.ConditionalUnique = ReadFields(cur, ConditionalUnique, uniqEnd - cur.Pos);
                    cur.Pos = uniqEnd;
                }
            }
            if (cur.Pos < blockEnd)
            {
                int repSize = HexSize(cur.Read(2));
                if (repSize > 0)
                {
                    int repEnd = Math.Min(cur.Pos + repSize, blockEnd);
                    leg.ConditionalRepeated = ReadFields(cur, ConditionalRepeated, repEnd - cur.Pos);
                    cur.Pos = repEnd;
                }
            }
            if (cur.Pos < blockEnd)
            {
                string airlineUse = cur.Text.Substring(cur.Pos, blockEnd - cur.Pos).Trim();
                if (airlineUse.Length > 0) leg.AirlineUse = airlineUse;
            }
        }
    }
}
