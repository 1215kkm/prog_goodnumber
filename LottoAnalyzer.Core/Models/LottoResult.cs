namespace LottoAnalyzer.Core.Models
{
    /// <summary>
    /// 로또 당첨 결과 모델
    /// </summary>
    public class LottoResult
    {
        public int Round { get; set; }
        public DateTime DrawDate { get; set; }
        public int[] Numbers { get; set; } = new int[6];
        public int BonusNumber { get; set; }
        public long FirstPrize { get; set; }
        public int FirstWinnerCount { get; set; }
        public int Month => DrawDate.Month;
        public int Year => DrawDate.Year;

        public Season Season => Month switch
        {
            3 or 4 or 5 => Season.Spring,
            6 or 7 or 8 => Season.Summer,
            9 or 10 or 11 => Season.Fall,
            _ => Season.Winter
        };
    }

    public enum Season
    {
        Spring,
        Summer,
        Fall,
        Winter
    }

    public static class SeasonExtensions
    {
        public static string ToKorean(this Season season) => season switch
        {
            Season.Spring => "봄 (3-5월)",
            Season.Summer => "여름 (6-8월)",
            Season.Fall => "가을 (9-11월)",
            Season.Winter => "겨울 (12-2월)",
            _ => ""
        };

        public static string ToShortKorean(this Season season) => season switch
        {
            Season.Spring => "봄",
            Season.Summer => "여름",
            Season.Fall => "가을",
            Season.Winter => "겨울",
            _ => ""
        };
    }
}
