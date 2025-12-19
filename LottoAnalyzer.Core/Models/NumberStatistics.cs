namespace LottoAnalyzer.Core.Models
{
    public class NumberStatistics
    {
        public int Number { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }
        public int LastAppearanceRound { get; set; }
        public int GapSinceLastAppearance { get; set; }
        public int BonusCount { get; set; }

        public string ColorGroup => Number switch
        {
            >= 1 and <= 10 => "Yellow",
            >= 11 and <= 20 => "Blue",
            >= 21 and <= 30 => "Red",
            >= 31 and <= 40 => "Gray",
            _ => "Green"
        };

        public string ColorHex => Number switch
        {
            >= 1 and <= 10 => "#FBC400",
            >= 11 and <= 20 => "#69C8F2",
            >= 21 and <= 30 => "#FF7272",
            >= 31 and <= 40 => "#AAAAAA",
            _ => "#B0D840"
        };
    }

    public class MonthlyStatistics
    {
        public int Month { get; set; }
        public string MonthName => $"{Month}월";
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    public class YearlyStatistics
    {
        public int Year { get; set; }
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    public class SeasonalStatistics
    {
        public Season Season { get; set; }
        public string SeasonName => Season.ToKorean();
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    public class NumberFrequency
    {
        public int Number { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }

        public string ColorGroup => Number switch
        {
            >= 1 and <= 10 => "Yellow",
            >= 11 and <= 20 => "Blue",
            >= 21 and <= 30 => "Red",
            >= 31 and <= 40 => "Gray",
            _ => "Green"
        };

        public string ColorHex => Number switch
        {
            >= 1 and <= 10 => "#FBC400",
            >= 11 and <= 20 => "#69C8F2",
            >= 21 and <= 30 => "#FF7272",
            >= 31 and <= 40 => "#AAAAAA",
            _ => "#B0D840"
        };
    }

    public class RecommendedNumbers
    {
        public string RecommendationType { get; set; } = "";
        public string Description { get; set; } = "";
        public int[] Numbers { get; set; } = new int[6];
        public int Confidence { get; set; }
    }

    public class RangeStatistics
    {
        public string RangeName { get; set; } = "";
        public int MinNumber { get; set; }
        public int MaxNumber { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    public class ConsecutivePattern
    {
        public int ConsecutiveCount { get; set; }
        public int Occurrences { get; set; }
        public double Percentage { get; set; }
    }

    public class NumberPair
    {
        public int Number1 { get; set; }
        public int Number2 { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }
        public string Display => $"{Number1} - {Number2}";
    }

    public class NumberTriple
    {
        public int Number1 { get; set; }
        public int Number2 { get; set; }
        public int Number3 { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }
        public string Display => $"{Number1} - {Number2} - {Number3}";
    }

    public class NumberCycle
    {
        public int Number { get; set; }
        public double AverageGap { get; set; }
        public int MinGap { get; set; }
        public int MaxGap { get; set; }
        public int CurrentGap { get; set; }
        public bool IsOverdue => CurrentGap > AverageGap * 1.5;
    }

    public static class NumberColorHelper
    {
        public static string GetColorHex(int number) => number switch
        {
            >= 1 and <= 10 => "#FBC400",
            >= 11 and <= 20 => "#69C8F2",
            >= 21 and <= 30 => "#FF7272",
            >= 31 and <= 40 => "#AAAAAA",
            _ => "#B0D840"
        };
    }
}
