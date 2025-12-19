using System;
using System.Collections.Generic;
using System.Linq;
using LottoAnalyzer.Models;

namespace LottoAnalyzer.Services
{
    /// <summary>
    /// 번호 추천 서비스
    /// </summary>
    public class RecommendationService
    {
        private readonly StatisticsService _statisticsService;
        private readonly Random _random = new();

        public RecommendationService(StatisticsService statisticsService)
        {
            _statisticsService = statisticsService;
        }

        /// <summary>
        /// 다양한 추천 번호 세트 생성
        /// </summary>
        public List<RecommendedNumbers> GenerateRecommendations(List<LottoResult> results)
        {
            var recommendations = new List<RecommendedNumbers>();

            // 1. 빈도 기반 추천 (가장 많이 나온 번호)
            recommendations.Add(GenerateFrequencyBasedRecommendation(results));

            // 2. 현재 계절 기반 추천
            recommendations.Add(GenerateSeasonalRecommendation(results));

            // 3. 현재 월 기반 추천
            recommendations.Add(GenerateMonthlyRecommendation(results));

            // 4. 미출현 기반 추천 (오래 안 나온 번호)
            recommendations.Add(GenerateDueNumbersRecommendation(results));

            // 5. 균형 잡힌 추천 (구간별 균등)
            recommendations.Add(GenerateBalancedRecommendation(results));

            // 6. 핫/콜드 콤보 추천
            recommendations.Add(GenerateHotColdComboRecommendation(results));

            return recommendations;
        }

        /// <summary>
        /// 빈도 기반 추천
        /// </summary>
        private RecommendedNumbers GenerateFrequencyBasedRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);
            var topNumbers = stats.Take(15).ToList();

            // 상위 15개 중 무작위로 6개 선택
            var selected = topNumbers.OrderBy(_ => _random.Next()).Take(6).Select(s => s.Number).OrderBy(n => n).ToArray();

            return new RecommendedNumbers
            {
                RecommendationType = "🔥 빈도 기반 추천",
                Description = $"최근 {results.Count}회 중 가장 많이 출현한 번호들",
                Numbers = selected,
                Confidence = 75
            };
        }

        /// <summary>
        /// 계절 기반 추천
        /// </summary>
        private RecommendedNumbers GenerateSeasonalRecommendation(List<LottoResult> results)
        {
            var currentSeason = GetCurrentSeason();
            var seasonalStats = _statisticsService.CalculateSeasonalStatistics(results);
            var currentSeasonStats = seasonalStats.FirstOrDefault(s => s.Season == currentSeason);

            int[] selected;
            if (currentSeasonStats != null && currentSeasonStats.TopNumbers.Count >= 6)
            {
                var topNumbers = currentSeasonStats.TopNumbers.Take(12).ToList();
                selected = topNumbers.OrderBy(_ => _random.Next()).Take(6).Select(n => n.Number).OrderBy(n => n).ToArray();
            }
            else
            {
                selected = GenerateRandomNumbers();
            }

            return new RecommendedNumbers
            {
                RecommendationType = $"🌸 {currentSeason.ToKorean()} 추천",
                Description = $"현재 계절({currentSeason.ToKorean()})에 자주 출현하는 번호",
                Numbers = selected,
                Confidence = 65
            };
        }

        /// <summary>
        /// 월별 기반 추천
        /// </summary>
        private RecommendedNumbers GenerateMonthlyRecommendation(List<LottoResult> results)
        {
            int currentMonth = DateTime.Now.Month;
            var monthlyStats = _statisticsService.CalculateMonthlyStatistics(results);
            var currentMonthStats = monthlyStats.FirstOrDefault(m => m.Month == currentMonth);

            int[] selected;
            if (currentMonthStats != null && currentMonthStats.TopNumbers.Count >= 6)
            {
                var topNumbers = currentMonthStats.TopNumbers.Take(12).ToList();
                selected = topNumbers.OrderBy(_ => _random.Next()).Take(6).Select(n => n.Number).OrderBy(n => n).ToArray();
            }
            else
            {
                selected = GenerateRandomNumbers();
            }

            return new RecommendedNumbers
            {
                RecommendationType = $"📅 {currentMonth}월 추천",
                Description = $"{currentMonth}월에 통계적으로 자주 출현하는 번호",
                Numbers = selected,
                Confidence = 60
            };
        }

        /// <summary>
        /// 미출현 기반 추천 (Due Numbers)
        /// </summary>
        private RecommendedNumbers GenerateDueNumbersRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);
            var dueNumbers = stats.OrderByDescending(s => s.GapSinceLastAppearance).Take(15).ToList();

            var selected = dueNumbers.OrderBy(_ => _random.Next()).Take(6).Select(s => s.Number).OrderBy(n => n).ToArray();

            int maxGap = dueNumbers.Max(d => d.GapSinceLastAppearance);

            return new RecommendedNumbers
            {
                RecommendationType = "⏰ 미출현 번호 추천",
                Description = $"최근 {maxGap}회 이상 출현하지 않은 번호 (나올 때가 된 번호)",
                Numbers = selected,
                Confidence = 55
            };
        }

        /// <summary>
        /// 균형 잡힌 추천 (구간별 균등 배분)
        /// </summary>
        private RecommendedNumbers GenerateBalancedRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);

            // 각 구간에서 인기 번호 선택
            var ranges = new[]
            {
                stats.Where(s => s.Number >= 1 && s.Number <= 10).OrderByDescending(s => s.Count).Take(3),
                stats.Where(s => s.Number >= 11 && s.Number <= 20).OrderByDescending(s => s.Count).Take(3),
                stats.Where(s => s.Number >= 21 && s.Number <= 30).OrderByDescending(s => s.Count).Take(3),
                stats.Where(s => s.Number >= 31 && s.Number <= 40).OrderByDescending(s => s.Count).Take(3),
                stats.Where(s => s.Number >= 41 && s.Number <= 45).OrderByDescending(s => s.Count).Take(3)
            };

            var candidates = ranges.SelectMany(r => r).ToList();
            var selected = new List<int>();

            // 각 구간에서 최소 1개씩 선택
            foreach (var range in ranges)
            {
                var rangeList = range.ToList();
                if (rangeList.Count > 0 && selected.Count < 5)
                {
                    var pick = rangeList[_random.Next(rangeList.Count)];
                    selected.Add(pick.Number);
                }
            }

            // 나머지 채우기
            while (selected.Count < 6)
            {
                var remaining = candidates.Where(c => !selected.Contains(c.Number)).ToList();
                if (remaining.Count > 0)
                {
                    selected.Add(remaining[_random.Next(remaining.Count)].Number);
                }
                else
                {
                    // 새로운 번호 추가
                    int newNum;
                    do { newNum = _random.Next(1, 46); } while (selected.Contains(newNum));
                    selected.Add(newNum);
                }
            }

            return new RecommendedNumbers
            {
                RecommendationType = "⚖️ 균형 배분 추천",
                Description = "모든 번호 구간(1-10, 11-20, 21-30, 31-40, 41-45)에서 균형있게 선택",
                Numbers = selected.OrderBy(n => n).ToArray(),
                Confidence = 70
            };
        }

        /// <summary>
        /// 핫/콜드 콤보 추천
        /// </summary>
        private RecommendedNumbers GenerateHotColdComboRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);

            // 핫 넘버 (상위 15)
            var hotNumbers = stats.Take(15).ToList();
            // 콜드 넘버 (하위 15)
            var coldNumbers = stats.TakeLast(15).ToList();

            // 핫에서 4개, 콜드에서 2개
            var hotPicks = hotNumbers.OrderBy(_ => _random.Next()).Take(4).Select(s => s.Number);
            var coldPicks = coldNumbers.OrderBy(_ => _random.Next()).Take(2).Select(s => s.Number);

            var selected = hotPicks.Concat(coldPicks).Distinct().OrderBy(n => n).ToArray();

            // 중복 제거 후 부족하면 채우기
            while (selected.Length < 6)
            {
                var all = hotNumbers.Concat(coldNumbers).ToList();
                int newNum = all[_random.Next(all.Count)].Number;
                if (!selected.Contains(newNum))
                {
                    selected = selected.Append(newNum).OrderBy(n => n).ToArray();
                }
            }

            return new RecommendedNumbers
            {
                RecommendationType = "🎯 핫/콜드 콤보",
                Description = "자주 나오는 번호 4개 + 적게 나오는 번호 2개 조합",
                Numbers = selected.Take(6).ToArray(),
                Confidence = 68
            };
        }

        /// <summary>
        /// 사용자 정의 추천 (특정 조건 기반)
        /// </summary>
        public RecommendedNumbers GenerateCustomRecommendation(
            List<LottoResult> results,
            int? year = null,
            int? month = null,
            Season? season = null,
            bool includeHotNumbers = true,
            bool includeColdNumbers = false,
            int oddCount = 3)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);
            var candidates = new List<NumberStatistics>();

            // 연도 필터
            if (year.HasValue)
            {
                var yearResults = results.Where(r => r.Year == year.Value).ToList();
                stats = _statisticsService.CalculateOverallStatistics(yearResults);
            }

            // 월 필터
            if (month.HasValue)
            {
                var monthResults = results.Where(r => r.Month == month.Value).ToList();
                stats = _statisticsService.CalculateOverallStatistics(monthResults);
            }

            // 계절 필터
            if (season.HasValue)
            {
                var seasonResults = results.Where(r => r.Season == season.Value).ToList();
                stats = _statisticsService.CalculateOverallStatistics(seasonResults);
            }

            // 핫/콜드 선택
            if (includeHotNumbers)
                candidates.AddRange(stats.Take(20));
            if (includeColdNumbers)
                candidates.AddRange(stats.TakeLast(20));

            if (candidates.Count < 6)
                candidates = stats.ToList();

            // 홀짝 비율 맞추기
            var oddNumbers = candidates.Where(c => c.Number % 2 == 1).ToList();
            var evenNumbers = candidates.Where(c => c.Number % 2 == 0).ToList();

            var selected = new List<int>();
            int targetOdd = Math.Min(oddCount, oddNumbers.Count);
            int targetEven = Math.Min(6 - oddCount, evenNumbers.Count);

            // 홀수 선택
            selected.AddRange(oddNumbers.OrderBy(_ => _random.Next()).Take(targetOdd).Select(s => s.Number));
            // 짝수 선택
            selected.AddRange(evenNumbers.OrderBy(_ => _random.Next()).Take(targetEven).Select(s => s.Number));

            // 부족하면 채우기
            while (selected.Count < 6)
            {
                var remaining = candidates.Where(c => !selected.Contains(c.Number)).ToList();
                if (remaining.Count > 0)
                    selected.Add(remaining[_random.Next(remaining.Count)].Number);
                else
                {
                    int newNum;
                    do { newNum = _random.Next(1, 46); } while (selected.Contains(newNum));
                    selected.Add(newNum);
                }
            }

            string description = "사용자 정의 조건: ";
            if (year.HasValue) description += $"{year}년 ";
            if (month.HasValue) description += $"{month}월 ";
            if (season.HasValue) description += $"{season.Value.ToKorean()} ";
            description += $"홀{oddCount}:짝{6-oddCount}";

            return new RecommendedNumbers
            {
                RecommendationType = "⚙️ 사용자 정의 추천",
                Description = description,
                Numbers = selected.OrderBy(n => n).ToArray(),
                Confidence = 50
            };
        }

        private Season GetCurrentSeason()
        {
            int month = DateTime.Now.Month;
            return month switch
            {
                3 or 4 or 5 => Season.Spring,
                6 or 7 or 8 => Season.Summer,
                9 or 10 or 11 => Season.Fall,
                _ => Season.Winter
            };
        }

        private int[] GenerateRandomNumbers()
        {
            var numbers = new HashSet<int>();
            while (numbers.Count < 6)
            {
                numbers.Add(_random.Next(1, 46));
            }
            return numbers.OrderBy(n => n).ToArray();
        }
    }
}
