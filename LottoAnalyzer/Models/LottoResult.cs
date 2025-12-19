using System;

namespace LottoAnalyzer.Models
{
    /// <summary>
    /// 로또 당첨 결과 모델
    /// </summary>
    public class LottoResult
    {
        /// <summary>
        /// 회차 번호
        /// </summary>
        public int Round { get; set; }

        /// <summary>
        /// 추첨일
        /// </summary>
        public DateTime DrawDate { get; set; }

        /// <summary>
        /// 당첨 번호 6개
        /// </summary>
        public int[] Numbers { get; set; } = new int[6];

        /// <summary>
        /// 보너스 번호
        /// </summary>
        public int BonusNumber { get; set; }

        /// <summary>
        /// 1등 당첨금
        /// </summary>
        public long FirstPrize { get; set; }

        /// <summary>
        /// 1등 당첨자 수
        /// </summary>
        public int FirstWinnerCount { get; set; }

        /// <summary>
        /// 추첨 월
        /// </summary>
        public int Month => DrawDate.Month;

        /// <summary>
        /// 추첨 년도
        /// </summary>
        public int Year => DrawDate.Year;

        /// <summary>
        /// 계절 (봄:3-5, 여름:6-8, 가을:9-11, 겨울:12-2)
        /// </summary>
        public Season Season => Month switch
        {
            3 or 4 or 5 => Season.Spring,
            6 or 7 or 8 => Season.Summer,
            9 or 10 or 11 => Season.Fall,
            _ => Season.Winter
        };
    }

    /// <summary>
    /// 계절 열거형
    /// </summary>
    public enum Season
    {
        Spring,  // 봄
        Summer,  // 여름
        Fall,    // 가을
        Winter   // 겨울
    }

    /// <summary>
    /// 계절 확장 메서드
    /// </summary>
    public static class SeasonExtensions
    {
        public static string ToKorean(this Season season)
        {
            return season switch
            {
                Season.Spring => "봄 (3-5월)",
                Season.Summer => "여름 (6-8월)",
                Season.Fall => "가을 (9-11월)",
                Season.Winter => "겨울 (12-2월)",
                _ => ""
            };
        }
    }
}
