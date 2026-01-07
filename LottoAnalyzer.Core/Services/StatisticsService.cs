using System;
using System.Collections.Generic;
using System.Linq;
using LottoAnalyzer.Core.Models;

namespace LottoAnalyzer.Core.Services
{
    /// <summary>
    /// 로또 통계 분석 서비스 (고급 분석 기능 포함)
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
        /// 구간별 통계 계산
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
        /// 동반 출현 번호 분석 (함께 자주 나오는 번호 쌍)
        /// </summary>
        public List<NumberPair> AnalyzeNumberPairs(List<LottoResult> results, int topCount = 20)
        {
            var pairCounts = new Dictionary<(int, int), int>();

            foreach (var result in results)
            {
                var sorted = result.Numbers.OrderBy(n => n).ToArray();
                for (int i = 0; i < sorted.Length; i++)
                {
                    for (int j = i + 1; j < sorted.Length; j++)
                    {
                        var pair = (sorted[i], sorted[j]);
                        if (!pairCounts.ContainsKey(pair))
                            pairCounts[pair] = 0;
                        pairCounts[pair]++;
                    }
                }
            }

            return pairCounts
                .OrderByDescending(p => p.Value)
                .Take(topCount)
                .Select(p => new NumberPair
                {
                    Number1 = p.Key.Item1,
                    Number2 = p.Key.Item2,
                    Count = p.Value,
                    Percentage = Math.Round((double)p.Value / results.Count * 100, 2)
                })
                .ToList();
        }

        /// <summary>
        /// 번호 트리플 분석 (함께 자주 나오는 3개 번호 조합)
        /// </summary>
        public List<NumberTriple> AnalyzeNumberTriples(List<LottoResult> results, int topCount = 15)
        {
            var tripleCounts = new Dictionary<(int, int, int), int>();

            foreach (var result in results)
            {
                var sorted = result.Numbers.OrderBy(n => n).ToArray();
                for (int i = 0; i < sorted.Length - 2; i++)
                {
                    for (int j = i + 1; j < sorted.Length - 1; j++)
                    {
                        for (int k = j + 1; k < sorted.Length; k++)
                        {
                            var triple = (sorted[i], sorted[j], sorted[k]);
                            if (!tripleCounts.ContainsKey(triple))
                                tripleCounts[triple] = 0;
                            tripleCounts[triple]++;
                        }
                    }
                }
            }

            return tripleCounts
                .OrderByDescending(t => t.Value)
                .Take(topCount)
                .Select(t => new NumberTriple
                {
                    Number1 = t.Key.Item1,
                    Number2 = t.Key.Item2,
                    Number3 = t.Key.Item3,
                    Count = t.Value,
                    Percentage = Math.Round((double)t.Value / results.Count * 100, 2)
                })
                .ToList();
        }

        /// <summary>
        /// 핫 넘버 분석 (최근 N회차 기준 자주 나오는 번호)
        /// </summary>
        public List<NumberStatistics> AnalyzeHotNumbers(List<LottoResult> results, int recentCount = 20)
        {
            var recentResults = results.OrderByDescending(r => r.Round).Take(recentCount).ToList();
            return CalculateOverallStatistics(recentResults).Take(10).ToList();
        }

        /// <summary>
        /// 콜드 넘버 분석 (최근 N회차 기준 잘 안 나오는 번호)
        /// </summary>
        public List<NumberStatistics> AnalyzeColdNumbers(List<LottoResult> results, int recentCount = 20)
        {
            var recentResults = results.OrderByDescending(r => r.Round).Take(recentCount).ToList();
            return CalculateOverallStatistics(recentResults).TakeLast(10).Reverse().ToList();
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
        /// 고저 비율 분석
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

            var rangeGroups = sums.GroupBy(s => s / 10 * 10)
                .OrderByDescending(g => g.Count())
                .First();

            return (min, max, Math.Round(average, 1), rangeGroups.Key, rangeGroups.Key + 9);
        }

        /// <summary>
        /// AC값 분석
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

                int ac = differences.Count - 5;

                if (!acValues.ContainsKey(ac))
                    acValues[ac] = 0;
                acValues[ac]++;
            }

            return acValues.OrderBy(a => a.Key).ToDictionary(a => a.Key, a => a.Value);
        }

        /// <summary>
        /// 끝자리 분석 (0-9)
        /// </summary>
        public Dictionary<int, int> AnalyzeLastDigits(List<LottoResult> results)
        {
            var lastDigits = new Dictionary<int, int>();
            for (int i = 0; i <= 9; i++)
                lastDigits[i] = 0;

            foreach (var result in results)
            {
                foreach (var num in result.Numbers)
                {
                    lastDigits[num % 10]++;
                }
            }

            return lastDigits.OrderByDescending(l => l.Value).ToDictionary(l => l.Key, l => l.Value);
        }

        /// <summary>
        /// 소수 포함 분석
        /// </summary>
        public Dictionary<int, int> AnalyzePrimeNumbers(List<LottoResult> results)
        {
            var primes = new HashSet<int> { 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43 };
            var primeCounts = new Dictionary<int, int>();

            foreach (var result in results)
            {
                int count = result.Numbers.Count(n => primes.Contains(n));
                if (!primeCounts.ContainsKey(count))
                    primeCounts[count] = 0;
                primeCounts[count]++;
            }

            return primeCounts.OrderBy(p => p.Key).ToDictionary(p => p.Key, p => p.Value);
        }

        /// <summary>
        /// 번호 출현 주기 분석
        /// </summary>
        public List<NumberCycle> AnalyzeNumberCycles(List<LottoResult> results)
        {
            var cycles = new List<NumberCycle>();
            var sortedResults = results.OrderBy(r => r.Round).ToList();

            for (int num = 1; num <= 45; num++)
            {
                var appearances = sortedResults
                    .Select((r, idx) => new { Round = r.Round, Index = idx, Contains = r.Numbers.Contains(num) })
                    .Where(x => x.Contains)
                    .ToList();

                if (appearances.Count < 2) continue;

                var gaps = new List<int>();
                for (int i = 1; i < appearances.Count; i++)
                {
                    gaps.Add(appearances[i].Round - appearances[i - 1].Round);
                }

                cycles.Add(new NumberCycle
                {
                    Number = num,
                    AverageGap = Math.Round(gaps.Average(), 1),
                    MinGap = gaps.Min(),
                    MaxGap = gaps.Max(),
                    CurrentGap = sortedResults.Last().Round - appearances.Last().Round
                });
            }

            return cycles.OrderBy(c => c.AverageGap).ToList();
        }

        /// <summary>
        /// 번호 조합 점수 계산
        /// </summary>
        public int CalculateCombinationScore(int[] numbers, List<LottoResult> results)
        {
            int score = 0;
            var stats = CalculateOverallStatistics(results);
            var pairs = AnalyzeNumberPairs(results, 100);

            // 1. 빈도 점수 (각 번호의 출현 빈도)
            foreach (var num in numbers)
            {
                var stat = stats.FirstOrDefault(s => s.Number == num);
                if (stat != null)
                {
                    score += (int)(stat.Percentage * 2);
                }
            }

            // 2. 페어 점수 (자주 함께 나오는 조합)
            var sorted = numbers.OrderBy(n => n).ToArray();
            for (int i = 0; i < sorted.Length; i++)
            {
                for (int j = i + 1; j < sorted.Length; j++)
                {
                    var pair = pairs.FirstOrDefault(p => p.Number1 == sorted[i] && p.Number2 == sorted[j]);
                    if (pair != null)
                    {
                        score += pair.Count;
                    }
                }
            }

            // 3. 균형 점수
            int oddCount = numbers.Count(n => n % 2 == 1);
            if (oddCount >= 2 && oddCount <= 4) score += 20;

            int lowCount = numbers.Count(n => n <= 22);
            if (lowCount >= 2 && lowCount <= 4) score += 20;

            // 4. 합계 범위 점수
            int sum = numbers.Sum();
            if (sum >= 100 && sum <= 170) score += 30;

            // 5. 구간 분포 점수
            var ranges = new[] { (1, 10), (11, 20), (21, 30), (31, 40), (41, 45) };
            int coveredRanges = ranges.Count(r => numbers.Any(n => n >= r.Item1 && n <= r.Item2));
            score += coveredRanges * 10;

            return Math.Min(100, score);
        }
    }
}
