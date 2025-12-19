using System;
using System.Collections.Generic;

namespace LottoAnalyzer.Models
{
    /// <summary>
    /// 번호별 통계 모델
    /// </summary>
    public class NumberStatistics
    {
        /// <summary>
        /// 번호 (1-45)
        /// </summary>
        public int Number { get; set; }

        /// <summary>
        /// 출현 횟수
        /// </summary>
        public int Count { get; set; }

        /// <summary>
        /// 출현 비율 (%)
        /// </summary>
        public double Percentage { get; set; }

        /// <summary>
        /// 마지막 출현 회차
        /// </summary>
        public int LastAppearanceRound { get; set; }

        /// <summary>
        /// 미출현 회차 수
        /// </summary>
        public int GapSinceLastAppearance { get; set; }

        /// <summary>
        /// 보너스로 출현한 횟수
        /// </summary>
        public int BonusCount { get; set; }

        /// <summary>
        /// 번호 색상 그룹
        /// </summary>
        public string ColorGroup => Number switch
        {
            >= 1 and <= 10 => "Yellow",
            >= 11 and <= 20 => "Blue",
            >= 21 and <= 30 => "Red",
            >= 31 and <= 40 => "Gray",
            _ => "Green"
        };
    }

    /// <summary>
    /// 월별 통계 모델
    /// </summary>
    public class MonthlyStatistics
    {
        public int Month { get; set; }
        public string MonthName => $"{Month}월";
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    /// <summary>
    /// 연도별 통계 모델
    /// </summary>
    public class YearlyStatistics
    {
        public int Year { get; set; }
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    /// <summary>
    /// 계절별 통계 모델
    /// </summary>
    public class SeasonalStatistics
    {
        public Season Season { get; set; }
        public string SeasonName => Season.ToKorean();
        public List<NumberFrequency> TopNumbers { get; set; } = new();
        public int TotalDraws { get; set; }
    }

    /// <summary>
    /// 번호 빈도 모델
    /// </summary>
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
    }

    /// <summary>
    /// 추천 번호 세트
    /// </summary>
    public class RecommendedNumbers
    {
        /// <summary>
        /// 추천 유형
        /// </summary>
        public string RecommendationType { get; set; } = "";

        /// <summary>
        /// 추천 설명
        /// </summary>
        public string Description { get; set; } = "";

        /// <summary>
        /// 추천 번호 6개
        /// </summary>
        public int[] Numbers { get; set; } = new int[6];

        /// <summary>
        /// 신뢰도 (0-100)
        /// </summary>
        public int Confidence { get; set; }
    }

    /// <summary>
    /// 구간별 통계 모델
    /// </summary>
    public class RangeStatistics
    {
        public string RangeName { get; set; } = "";
        public int MinNumber { get; set; }
        public int MaxNumber { get; set; }
        public int Count { get; set; }
        public double Percentage { get; set; }
    }

    /// <summary>
    /// 연속 번호 패턴 통계
    /// </summary>
    public class ConsecutivePattern
    {
        public int ConsecutiveCount { get; set; }
        public int Occurrences { get; set; }
        public double Percentage { get; set; }
    }
}
