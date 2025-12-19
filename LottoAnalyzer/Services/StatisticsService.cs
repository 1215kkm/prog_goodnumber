using System;
using System.Collections.Generic;
using System.Linq;
using LottoAnalyzer.Models;

namespace LottoAnalyzer.Services
{
    /// <summary>
    /// 로또 통계 분석 서비스
    /// </summary>
    public class StatisticsService
    {
        /// <summary>
        /// 전체 번호별 통계 계산
        /// </summary>
        public List<NumberStatistics> CalculateOverallStatistics(List<LottoResult> results)
        {
            var statistics = new List<NumberStatistics>();
            int totalDraws = results.Count;
            int latestRound = results.Max(r => r.Round);

            for (int num = 1; num <= 45; num++)
            {
                var appearances = results.Where(r => r.Numbers.Contains(num)).ToList();
                var bonusAppearances = results.Count(r => r.BonusNumber == num);
                var lastAppearance = appearances.OrderByDescending(r => r.Round).FirstOrDefault();

                statistics.Add(new NumberStatistics
                {
                    Number = num,
                    Count = appearances.Count,
                    Percentage = Math.Round((double)appearances.Count / totalDraws * 100, 2),
                    LastAppearanceRound = lastAppearance?.Round ?? 0,
                    GapSinceLastAppearance = lastAppearance != null ? latestRound - lastAppearance.Round : latestRound,
                    BonusCount = bonusAppearances
                });
            }

            return statistics.OrderByDescending(s => s.Count).ToList();
        }

        /// <summary>
        /// 월별 통계 계산
        /// </summary>
        public List<MonthlyStatistics> CalculateMonthlyStatistics(List<LottoResult> results)
        {
            var monthlyStats = new List<MonthlyStatistics>();

            for (int month = 1; month <= 12; month++)
            {
                var monthResults = results.Where(r => r.Month == month).ToList();
                if (monthResults.Count == 0) continue;

                var numberCounts = new Dictionary<int, int>();
                for (int num = 1; num <= 45; num++)
                {
                    numberCounts[num] = monthResults.Sum(r => r.Numbers.Count(n => n == num));
                }

                var topNumbers = numberCounts
                    .OrderByDescending(kv => kv.Value)
                    .Take(10)
                    .Select(kv => new NumberFrequency
                    {
                        Number = kv.Key,
                        Count = kv.Value,
                        Percentage = Math.Round((double)kv.Value / (monthResults.Count * 6) * 100, 2)
                    })
                    .ToList();

                monthlyStats.Add(new MonthlyStatistics
                {
                    Month = month,
                    TopNumbers = topNumbers,
                    TotalDraws = monthResults.Count
                });
            }

            return monthlyStats;
        }

        /// <summary>
        /// 연도별 통계 계산
        /// </summary>
        public List<YearlyStatistics> CalculateYearlyStatistics(List<LottoResult> results)
        {
            var years = results.Select(r => r.Year).Distinct().OrderByDescending(y => y);
            var yearlyStats = new List<YearlyStatistics>();

            foreach (var year in years)
            {
                var yearResults = results.Where(r => r.Year == year).ToList();
                if (yearResults.Count == 0) continue;

                var numberCounts = new Dictionary<int, int>();
                for (int num = 1; num <= 45; num++)
                {
                    numberCounts[num] = yearResults.Sum(r => r.Numbers.Count(n => n == num));
                }

                var topNumbers = numberCounts
                    .OrderByDescending(kv => kv.Value)
                    .Take(10)
                    .Select(kv => new NumberFrequency
                    {
                        Number = kv.Key,
                        Count = kv.Value,
                        Percentage = Math.Round((double)kv.Value / (yearResults.Count * 6) * 100, 2)
                    })
                    .ToList();

                yearlyStats.Add(new YearlyStatistics
                {
                    Year = year,
                    TopNumbers = topNumbers,
                    TotalDraws = yearResults.Count
                });
            }

            return yearlyStats;
        }

        /// <summary>
        /// 계절별 통계 계산
        /// </summary>
        public List<SeasonalStatistics> CalculateSeasonalStatistics(List<LottoResult> results)
        {
            var seasonalStats = new List<SeasonalStatistics>();

            foreach (Season season in Enum.GetValues(typeof(Season)))
            {
                var seasonResults = results.Where(r => r.Season == season).ToList();
                if (seasonResults.Count == 0) continue;

                var numberCounts = new Dictionary<int, int>();
                for (int num = 1; num <= 45; num++)
                {
                    numberCounts[num] = seasonResults.Sum(r => r.Numbers.Count(n => n == num));
                }

                var topNumbers = numberCounts
                    .OrderByDescending(kv => kv.Value)
                    .Take(10)
                    .Select(kv => new NumberFrequency
                    {
                        Number = kv.Key,
                        Count = kv.Value,
                        Percentage = Math.Round((double)kv.Value / (seasonResults.Count * 6) * 100, 2)
                    })
                    .ToList();

                seasonalStats.Add(new SeasonalStatistics
                {
                    Season = season,
                    TopNumbers = topNumbers,
                    TotalDraws = seasonResults.Count
                });
            }

            return seasonalStats;
        }

        /// <summary>
        /// 구간별 통계 계산 (1-10, 11-20, 21-30, 31-40, 41-45)
        /// </summary>
        public List<RangeStatistics> CalculateRangeStatistics(List<LottoResult> results)
        {
            var ranges = new[]
            {
                (1, 10, "1~10"),
                (11, 20, "11~20"),
                (21, 30, "21~30"),
                (31, 40, "31~40"),
                (41, 45, "41~45")
            };

            int totalNumbers = results.Count * 6;
            var rangeStats = new List<RangeStatistics>();

            foreach (var (min, max, name) in ranges)
            {
                int count = results.Sum(r => r.Numbers.Count(n => n >= min && n <= max));
                rangeStats.Add(new RangeStatistics
                {
                    RangeName = name,
                    MinNumber = min,
                    MaxNumber = max,
                    Count = count,
                    Percentage = Math.Round((double)count / totalNumbers * 100, 2)
                });
            }

            return rangeStats;
        }

        /// <summary>
        /// 연속 번호 패턴 분석
        /// </summary>
        public List<ConsecutivePattern> AnalyzeConsecutivePatterns(List<LottoResult> results)
        {
            var patterns = new Dictionary<int, int>();

            foreach (var result in results)
            {
                var sorted = result.Numbers.OrderBy(n => n).ToArray();
                int consecutiveCount = 0;
                int maxConsecutive = 0;

                for (int i = 1; i < sorted.Length; i++)
                {
                    if (sorted[i] == sorted[i - 1] + 1)
                    {
                        consecutiveCount++;
                        maxConsecutive = Math.Max(maxConsecutive, consecutiveCount + 1);
                    }
                    else
                    {
                        consecutiveCount = 0;
                    }
                }

                if (maxConsecutive < 2) maxConsecutive = 0;

                if (!patterns.ContainsKey(maxConsecutive))
                    patterns[maxConsecutive] = 0;
                patterns[maxConsecutive]++;
            }

            return patterns
                .OrderByDescending(p => p.Key)
                .Select(p => new ConsecutivePattern
                {
                    ConsecutiveCount = p.Key == 0 ? 0 : p.Key,
                    Occurrences = p.Value,
                    Percentage = Math.Round((double)p.Value / results.Count * 100, 2)
                })
                .ToList();
        }

        /// <summary>
        /// 홀짝 비율 분석
        /// </summary>
        public Dictionary<string, int> AnalyzeOddEvenRatio(List<LottoResult> results)
        {
            var ratios = new Dictionary<string, int>();

            foreach (var result in results)
            {
                int oddCount = result.Numbers.Count(n => n % 2 == 1);
                int evenCount = 6 - oddCount;
                string ratio = $"{oddCount}:{evenCount}";

                if (!ratios.ContainsKey(ratio))
                    ratios[ratio] = 0;
                ratios[ratio]++;
            }

            return ratios.OrderByDescending(r => r.Value).ToDictionary(r => r.Key, r => r.Value);
        }

        /// <summary>
        /// 고저 비율 분석 (1-22: 저, 23-45: 고)
        /// </summary>
        public Dictionary<string, int> AnalyzeHighLowRatio(List<LottoResult> results)
        {
            var ratios = new Dictionary<string, int>();

            foreach (var result in results)
            {
                int lowCount = result.Numbers.Count(n => n <= 22);
                int highCount = 6 - lowCount;
                string ratio = $"저{lowCount}:고{highCount}";

                if (!ratios.ContainsKey(ratio))
                    ratios[ratio] = 0;
                ratios[ratio]++;
            }

            return ratios.OrderByDescending(r => r.Value).ToDictionary(r => r.Key, r => r.Value);
        }

        /// <summary>
        /// 합계 범위 분석
        /// </summary>
        public (int Min, int Max, double Average, int MostCommonRangeStart, int MostCommonRangeEnd) AnalyzeSumRange(List<LottoResult> results)
        {
            var sums = results.Select(r => r.Numbers.Sum()).ToList();

            int min = sums.Min();
            int max = sums.Max();
            double average = sums.Average();

            // 가장 흔한 합계 범위 (10단위)
            var rangeGroups = sums.GroupBy(s => s / 10 * 10)
                .OrderByDescending(g => g.Count())
                .First();

            return (min, max, Math.Round(average, 1), rangeGroups.Key, rangeGroups.Key + 9);
        }

        /// <summary>
        /// AC값 분석 (번호 간 차이의 다양성)
        /// </summary>
        public Dictionary<int, int> AnalyzeACValues(List<LottoResult> results)
        {
            var acValues = new Dictionary<int, int>();

            foreach (var result in results)
            {
                var sorted = result.Numbers.OrderBy(n => n).ToArray();
                var differences = new HashSet<int>();

                for (int i = 0; i < sorted.Length; i++)
                {
                    for (int j = i + 1; j < sorted.Length; j++)
                    {
                        differences.Add(sorted[j] - sorted[i]);
                    }
                }

                int ac = differences.Count - 5; // AC = 차이 개수 - 5

                if (!acValues.ContainsKey(ac))
                    acValues[ac] = 0;
                acValues[ac]++;
            }

            return acValues.OrderBy(a => a.Key).ToDictionary(a => a.Key, a => a.Value);
        }
    }
}
