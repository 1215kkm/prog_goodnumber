using System;
using System.Collections.Generic;
using System.Linq;
using LottoAnalyzer.Core.Models;

namespace LottoAnalyzer.Core.Services
{
    /// <summary>
    /// 고급 번호 추천 서비스 (AI 기반 알고리즘)
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

            // 1. AI 종합 추천 (최고 신뢰도)
            recommendations.Add(GenerateAISmartRecommendation(results));

            // 2. 동반 출현 기반 추천
            recommendations.Add(GeneratePairBasedRecommendation(results));

            // 3. 출현 주기 기반 추천 (Due Numbers)
            recommendations.Add(GenerateCycleBasedRecommendation(results));

            // 4. 현재 계절 + 월 복합 추천
            recommendations.Add(GenerateSeasonMonthComboRecommendation(results));

            // 5. 핫 넘버 기반 추천
            recommendations.Add(GenerateHotNumberRecommendation(results));

            // 6. 균형 최적화 추천
            recommendations.Add(GenerateOptimalBalanceRecommendation(results));

            // 7. 트렌드 기반 추천 (최근 상승세)
            recommendations.Add(GenerateTrendBasedRecommendation(results));

            // 8. 역발상 추천 (콜드 넘버 위주)
            recommendations.Add(GenerateContrarianRecommendation(results));

            return recommendations;
        }

        /// <summary>
        /// AI 종합 추천 (모든 요소 고려)
        /// </summary>
        private RecommendedNumbers GenerateAISmartRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);
            var pairs = _statisticsService.AnalyzeNumberPairs(results, 50);
            var cycles = _statisticsService.AnalyzeNumberCycles(results);
            var hotNumbers = _statisticsService.AnalyzeHotNumbers(results, 30);

            // 각 번호에 AI 점수 부여
            var numberScores = new Dictionary<int, double>();

            for (int num = 1; num <= 45; num++)
            {
                double score = 0;

                // 1. 기본 빈도 점수 (30%)
                var stat = stats.FirstOrDefault(s => s.Number == num);
                if (stat != null)
                {
                    score += stat.Percentage * 3;
                }

                // 2. 최근 핫 점수 (25%)
                var hot = hotNumbers.FirstOrDefault(h => h.Number == num);
                if (hot != null)
                {
                    int rank = hotNumbers.IndexOf(hot) + 1;
                    score += (11 - rank) * 2.5;
                }

                // 3. 출현 주기 점수 (20%)
                var cycle = cycles.FirstOrDefault(c => c.Number == num);
                if (cycle != null && cycle.IsOverdue)
                {
                    score += 15; // 출현 예정 번호 보너스
                }

                // 4. 동반 출현 점수 (15%)
                var pairCount = pairs.Count(p => p.Number1 == num || p.Number2 == num);
                score += pairCount * 1.5;

                // 5. 구간 균형 보너스 (10%)
                // 중간 구간 번호에 약간의 보너스
                if (num >= 15 && num <= 30)
                {
                    score += 5;
                }

                numberScores[num] = score;
            }

            // 점수 순으로 정렬 후 상위에서 균형있게 선택
            var sortedNumbers = numberScores.OrderByDescending(kv => kv.Value).ToList();

            var selected = new List<int>();
            var usedRanges = new HashSet<int>();

            // 각 구간에서 최소 1개씩 선택하면서 점수 높은 번호 우선
            foreach (var kv in sortedNumbers)
            {
                if (selected.Count >= 6) break;

                int range = (kv.Key - 1) / 10;

                // 아직 5개 미만이면 구간 균형 고려
                if (selected.Count < 5)
                {
                    if (!usedRanges.Contains(range) || usedRanges.Count >= 4)
                    {
                        selected.Add(kv.Key);
                        usedRanges.Add(range);
                    }
                }
                else
                {
                    // 마지막 번호는 점수만 고려
                    if (!selected.Contains(kv.Key))
                    {
                        selected.Add(kv.Key);
                    }
                }
            }

            // 6개 미만이면 채우기
            while (selected.Count < 6)
            {
                var remaining = sortedNumbers.Where(kv => !selected.Contains(kv.Key)).ToList();
                if (remaining.Count > 0)
                {
                    selected.Add(remaining.First().Key);
                }
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected.OrderBy(n => n).ToArray(), results);

            return new RecommendedNumbers
            {
                RecommendationType = "AI 종합 추천",
                Description = "빈도, 주기, 동반출현, 트렌드를 종합 분석한 최적의 조합",
                Numbers = selected.OrderBy(n => n).ToArray(),
                Confidence = Math.Min(95, confidence + 15)
            };
        }

        /// <summary>
        /// 동반 출현 기반 추천
        /// </summary>
        private RecommendedNumbers GeneratePairBasedRecommendation(List<LottoResult> results)
        {
            var pairs = _statisticsService.AnalyzeNumberPairs(results, 30);
            var triples = _statisticsService.AnalyzeNumberTriples(results, 10);

            var selected = new List<int>();

            // 가장 자주 나오는 트리플에서 시작
            if (triples.Count > 0)
            {
                var bestTriple = triples[_random.Next(Math.Min(3, triples.Count))];
                selected.Add(bestTriple.Number1);
                selected.Add(bestTriple.Number2);
                selected.Add(bestTriple.Number3);
            }

            // 나머지는 페어에서 선택
            foreach (var pair in pairs)
            {
                if (selected.Count >= 6) break;

                if (selected.Contains(pair.Number1) && !selected.Contains(pair.Number2))
                {
                    selected.Add(pair.Number2);
                }
                else if (selected.Contains(pair.Number2) && !selected.Contains(pair.Number1))
                {
                    selected.Add(pair.Number1);
                }
            }

            // 부족하면 빈도 높은 번호로 채우기
            if (selected.Count < 6)
            {
                var stats = _statisticsService.CalculateOverallStatistics(results);
                foreach (var stat in stats)
                {
                    if (selected.Count >= 6) break;
                    if (!selected.Contains(stat.Number))
                    {
                        selected.Add(stat.Number);
                    }
                }
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected.OrderBy(n => n).ToArray(), results);

            return new RecommendedNumbers
            {
                RecommendationType = "동반 출현 추천",
                Description = "함께 자주 당첨되는 번호 조합 기반",
                Numbers = selected.Take(6).OrderBy(n => n).ToArray(),
                Confidence = confidence
            };
        }

        /// <summary>
        /// 핫 넘버 기반 추천
        /// </summary>
        private RecommendedNumbers GenerateHotNumberRecommendation(List<LottoResult> results)
        {
            var hotNumbers = _statisticsService.AnalyzeHotNumbers(results, 30);
            var top15 = hotNumbers.Take(15).ToList();

            var selected = top15
                .OrderBy(_ => _random.Next())
                .Take(6)
                .Select(h => h.Number)
                .OrderBy(n => n)
                .ToArray();

            int confidence = _statisticsService.CalculateCombinationScore(selected, results);

            return new RecommendedNumbers
            {
                RecommendationType = "핫 넘버 추천",
                Description = "최근 30회 동안 가장 자주 나온 번호 중심",
                Numbers = selected,
                Confidence = Math.Min(90, confidence + 10)
            };
        }

        /// <summary>
        /// 출현 주기 기반 추천
        /// </summary>
        private RecommendedNumbers GenerateCycleBasedRecommendation(List<LottoResult> results)
        {
            var cycles = _statisticsService.AnalyzeNumberCycles(results);
            var overdueNumbers = cycles.Where(c => c.IsOverdue).OrderByDescending(c => c.CurrentGap / c.AverageGap).ToList();

            var selected = new List<int>();

            // 출현 예정 번호들
            foreach (var cycle in overdueNumbers.Take(8))
            {
                if (selected.Count >= 4) break;
                selected.Add(cycle.Number);
            }

            // 나머지는 빈도 높은 번호로
            var stats = _statisticsService.CalculateOverallStatistics(results);
            foreach (var stat in stats)
            {
                if (selected.Count >= 6) break;
                if (!selected.Contains(stat.Number))
                {
                    selected.Add(stat.Number);
                }
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected.OrderBy(n => n).ToArray(), results);

            return new RecommendedNumbers
            {
                RecommendationType = "주기 분석 추천",
                Description = "평균 출현 주기를 초과한 '나올 때 된' 번호 중심",
                Numbers = selected.Take(6).OrderBy(n => n).ToArray(),
                Confidence = confidence
            };
        }

        /// <summary>
        /// 계절 + 월 복합 추천
        /// </summary>
        private RecommendedNumbers GenerateSeasonMonthComboRecommendation(List<LottoResult> results)
        {
            var currentSeason = GetCurrentSeason();
            int currentMonth = DateTime.Now.Month;

            var seasonalStats = _statisticsService.CalculateSeasonalStatistics(results);
            var monthlyStats = _statisticsService.CalculateMonthlyStatistics(results);

            var seasonNumbers = seasonalStats
                .FirstOrDefault(s => s.Season == currentSeason)?
                .TopNumbers ?? new List<NumberFrequency>();

            var monthNumbers = monthlyStats
                .FirstOrDefault(m => m.Month == currentMonth)?
                .TopNumbers ?? new List<NumberFrequency>();

            // 계절과 월 모두에서 높은 순위인 번호 찾기
            var commonNumbers = seasonNumbers
                .Where(sn => monthNumbers.Any(mn => mn.Number == sn.Number))
                .Take(4)
                .Select(n => n.Number)
                .ToList();

            // 나머지는 계절 또는 월에서 선택
            var remaining = seasonNumbers.Concat(monthNumbers)
                .Where(n => !commonNumbers.Contains(n.Number))
                .DistinctBy(n => n.Number)
                .OrderByDescending(n => n.Count)
                .Select(n => n.Number);

            var selected = commonNumbers.Concat(remaining).Take(6).OrderBy(n => n).ToArray();

            int confidence = _statisticsService.CalculateCombinationScore(selected, results);

            return new RecommendedNumbers
            {
                RecommendationType = $"{currentSeason.ToKorean().Split(' ')[0]} + {currentMonth}월 추천",
                Description = $"현재 계절과 월에 공통으로 자주 나오는 번호",
                Numbers = selected,
                Confidence = confidence
            };
        }

        /// <summary>
        /// 균형 최적화 추천
        /// </summary>
        private RecommendedNumbers GenerateOptimalBalanceRecommendation(List<LottoResult> results)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);

            // 각 구간에서 빈도 높은 번호 선택
            var ranges = new[]
            {
                stats.Where(s => s.Number >= 1 && s.Number <= 9).Take(3).ToList(),
                stats.Where(s => s.Number >= 10 && s.Number <= 19).Take(3).ToList(),
                stats.Where(s => s.Number >= 20 && s.Number <= 29).Take(3).ToList(),
                stats.Where(s => s.Number >= 30 && s.Number <= 39).Take(3).ToList(),
                stats.Where(s => s.Number >= 40 && s.Number <= 45).Take(2).ToList()
            };

            var selected = new List<int>();

            // 각 구간에서 1개씩 선택
            foreach (var range in ranges)
            {
                if (range.Count > 0 && selected.Count < 5)
                {
                    var pick = range[_random.Next(range.Count)];
                    selected.Add(pick.Number);
                }
            }

            // 6번째는 모든 후보 중에서
            var allCandidates = ranges.SelectMany(r => r).Where(s => !selected.Contains(s.Number)).ToList();
            if (allCandidates.Count > 0)
            {
                selected.Add(allCandidates[_random.Next(allCandidates.Count)].Number);
            }

            // 홀짝 균형 조정
            int oddCount = selected.Count(n => n % 2 == 1);
            if (oddCount < 2 || oddCount > 4)
            {
                // 불균형하면 조정
                var needOdd = oddCount < 2;
                var candidates = stats.Where(s =>
                    !selected.Contains(s.Number) &&
                    (needOdd ? s.Number % 2 == 1 : s.Number % 2 == 0))
                    .Take(5)
                    .ToList();

                if (candidates.Count > 0)
                {
                    // 가장 불균형한 번호 교체
                    var toReplace = needOdd
                        ? selected.First(n => n % 2 == 0)
                        : selected.First(n => n % 2 == 1);

                    selected.Remove(toReplace);
                    selected.Add(candidates[0].Number);
                }
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected.OrderBy(n => n).ToArray(), results);

            return new RecommendedNumbers
            {
                RecommendationType = "균형 최적화 추천",
                Description = "번호 구간, 홀짝, 합계를 최적 균형으로 배분",
                Numbers = selected.OrderBy(n => n).ToArray(),
                Confidence = Math.Min(85, confidence + 5)
            };
        }

        /// <summary>
        /// 트렌드 기반 추천 (최근 상승세 번호)
        /// </summary>
        private RecommendedNumbers GenerateTrendBasedRecommendation(List<LottoResult> results)
        {
            // 최근 20회와 이전 20회 비교
            var recent20 = results.OrderByDescending(r => r.Round).Take(20).ToList();
            var prev20 = results.OrderByDescending(r => r.Round).Skip(20).Take(20).ToList();

            var recentStats = _statisticsService.CalculateOverallStatistics(recent20);
            var prevStats = _statisticsService.CalculateOverallStatistics(prev20);

            // 상승세 번호 찾기
            var risingNumbers = new List<(int Number, double Rise)>();

            for (int num = 1; num <= 45; num++)
            {
                var recentStat = recentStats.FirstOrDefault(s => s.Number == num);
                var prevStat = prevStats.FirstOrDefault(s => s.Number == num);

                double recentPct = recentStat?.Percentage ?? 0;
                double prevPct = prevStat?.Percentage ?? 0;

                if (recentPct > prevPct)
                {
                    risingNumbers.Add((num, recentPct - prevPct));
                }
            }

            var selected = risingNumbers
                .OrderByDescending(r => r.Rise)
                .Take(10)
                .OrderBy(_ => _random.Next())
                .Take(6)
                .Select(r => r.Number)
                .OrderBy(n => n)
                .ToArray();

            // 6개 미만이면 채우기
            if (selected.Length < 6)
            {
                var additional = recentStats
                    .Where(s => !selected.Contains(s.Number))
                    .Take(6 - selected.Length)
                    .Select(s => s.Number);
                selected = selected.Concat(additional).OrderBy(n => n).ToArray();
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected, results);

            return new RecommendedNumbers
            {
                RecommendationType = "트렌드 추천",
                Description = "최근 출현 빈도가 상승 중인 번호",
                Numbers = selected,
                Confidence = confidence
            };
        }

        /// <summary>
        /// 역발상 추천 (콜드 넘버 위주)
        /// </summary>
        private RecommendedNumbers GenerateContrarianRecommendation(List<LottoResult> results)
        {
            var coldNumbers = _statisticsService.AnalyzeColdNumbers(results, 30);
            var cycles = _statisticsService.AnalyzeNumberCycles(results);

            // 콜드하면서 출현 주기 초과한 번호
            var candidates = coldNumbers
                .Where(c => cycles.Any(cy => cy.Number == c.Number && cy.IsOverdue))
                .ToList();

            var selected = new List<int>();

            // 콜드 + 주기 초과 번호 우선
            selected.AddRange(candidates.Take(3).Select(c => c.Number));

            // 나머지 콜드 번호
            selected.AddRange(coldNumbers
                .Where(c => !selected.Contains(c.Number))
                .Take(3)
                .Select(c => c.Number));

            // 부족하면 일반 통계에서
            if (selected.Count < 6)
            {
                var stats = _statisticsService.CalculateOverallStatistics(results);
                selected.AddRange(stats
                    .Where(s => !selected.Contains(s.Number))
                    .Take(6 - selected.Count)
                    .Select(s => s.Number));
            }

            int confidence = _statisticsService.CalculateCombinationScore(selected.OrderBy(n => n).ToArray(), results);

            return new RecommendedNumbers
            {
                RecommendationType = "역발상 추천",
                Description = "최근 잘 안 나왔지만 곧 나올 것 같은 번호",
                Numbers = selected.Take(6).OrderBy(n => n).ToArray(),
                Confidence = Math.Max(50, confidence - 10)
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

        /// <summary>
        /// 과거 회차에 대한 시뮬레이션 추천 (해당 회차 이전 데이터만 사용)
        /// 회차 번호를 시드로 사용해서 일관된 결과 생성
        /// </summary>
        public List<RecommendedNumbers> GenerateHistoricalRecommendations(List<LottoResult> allResults, int targetRound)
        {
            // 해당 회차 이전 데이터만 사용
            var pastResults = allResults.Where(r => r.Round < targetRound).ToList();

            if (pastResults.Count < 50)
            {
                // 데이터가 너무 적으면 빈 리스트 반환
                return new List<RecommendedNumbers>();
            }

            // 회차 번호를 시드로 사용해서 일관된 랜덤 생성
            var seededRandom = new Random(targetRound * 12345);

            var recommendations = new List<RecommendedNumbers>
            {
                GenerateSeededAIRecommendation(pastResults, seededRandom, "AI 종합"),
                GenerateSeededHotRecommendation(pastResults, seededRandom, "핫넘버"),
                GenerateSeededCycleRecommendation(pastResults, seededRandom, "주기분석"),
                GenerateSeededBalanceRecommendation(pastResults, seededRandom, "균형최적화"),
                GenerateSeededTrendRecommendation(pastResults, seededRandom, "트렌드")
            };

            return recommendations;
        }

        /// <summary>
        /// 추천 번호와 실제 당첨 번호 비교 (보너스 포함)
        /// </summary>
        public (int MatchCount, bool BonusMatch) CompareWithActual(int[] recommended, LottoResult actual)
        {
            int matchCount = recommended.Count(r => actual.Numbers.Contains(r));
            bool bonusMatch = recommended.Contains(actual.BonusNumber);
            return (matchCount, bonusMatch);
        }

        private RecommendedNumbers GenerateSeededAIRecommendation(List<LottoResult> results, Random random, string name)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);
            var hotNumbers = _statisticsService.AnalyzeHotNumbers(results, 30);
            var cycles = _statisticsService.AnalyzeNumberCycles(results);

            var numberScores = new Dictionary<int, double>();
            for (int num = 1; num <= 45; num++)
            {
                double score = 0;
                var stat = stats.FirstOrDefault(s => s.Number == num);
                if (stat != null) score += stat.Percentage * 3;

                var hot = hotNumbers.FirstOrDefault(h => h.Number == num);
                if (hot != null)
                {
                    int rank = hotNumbers.IndexOf(hot) + 1;
                    score += (11 - rank) * 2.5;
                }

                var cycle = cycles.FirstOrDefault(c => c.Number == num);
                if (cycle != null && cycle.IsOverdue) score += 15;

                numberScores[num] = score + random.NextDouble() * 5; // 시드 기반 랜덤 요소
            }

            var selected = numberScores.OrderByDescending(kv => kv.Value).Take(6).Select(kv => kv.Key).OrderBy(n => n).ToArray();

            return new RecommendedNumbers
            {
                RecommendationType = name,
                Numbers = selected,
                Confidence = 85
            };
        }

        private RecommendedNumbers GenerateSeededHotRecommendation(List<LottoResult> results, Random random, string name)
        {
            var hotNumbers = _statisticsService.AnalyzeHotNumbers(results, 30);
            var top15 = hotNumbers.Take(15).ToList();

            var selected = top15
                .OrderBy(_ => random.Next())
                .Take(6)
                .Select(h => h.Number)
                .OrderBy(n => n)
                .ToArray();

            return new RecommendedNumbers
            {
                RecommendationType = name,
                Numbers = selected,
                Confidence = 80
            };
        }

        private RecommendedNumbers GenerateSeededCycleRecommendation(List<LottoResult> results, Random random, string name)
        {
            var cycles = _statisticsService.AnalyzeNumberCycles(results);
            var overdueNumbers = cycles.Where(c => c.IsOverdue).OrderByDescending(c => c.CurrentGap / c.AverageGap).ToList();

            var selected = new List<int>();
            foreach (var cycle in overdueNumbers.Take(8))
            {
                if (selected.Count >= 4) break;
                selected.Add(cycle.Number);
            }

            var stats = _statisticsService.CalculateOverallStatistics(results);
            foreach (var stat in stats.OrderBy(_ => random.Next()))
            {
                if (selected.Count >= 6) break;
                if (!selected.Contains(stat.Number)) selected.Add(stat.Number);
            }

            return new RecommendedNumbers
            {
                RecommendationType = name,
                Numbers = selected.Take(6).OrderBy(n => n).ToArray(),
                Confidence = 75
            };
        }

        private RecommendedNumbers GenerateSeededBalanceRecommendation(List<LottoResult> results, Random random, string name)
        {
            var stats = _statisticsService.CalculateOverallStatistics(results);

            var ranges = new[]
            {
                stats.Where(s => s.Number >= 1 && s.Number <= 9).Take(3).ToList(),
                stats.Where(s => s.Number >= 10 && s.Number <= 19).Take(3).ToList(),
                stats.Where(s => s.Number >= 20 && s.Number <= 29).Take(3).ToList(),
                stats.Where(s => s.Number >= 30 && s.Number <= 39).Take(3).ToList(),
                stats.Where(s => s.Number >= 40 && s.Number <= 45).Take(2).ToList()
            };

            var selected = new List<int>();
            foreach (var range in ranges)
            {
                if (range.Count > 0 && selected.Count < 5)
                {
                    var pick = range[random.Next(range.Count)];
                    selected.Add(pick.Number);
                }
            }

            var allCandidates = ranges.SelectMany(r => r).Where(s => !selected.Contains(s.Number)).ToList();
            if (allCandidates.Count > 0)
            {
                selected.Add(allCandidates[random.Next(allCandidates.Count)].Number);
            }

            return new RecommendedNumbers
            {
                RecommendationType = name,
                Numbers = selected.OrderBy(n => n).ToArray(),
                Confidence = 78
            };
        }

        private RecommendedNumbers GenerateSeededTrendRecommendation(List<LottoResult> results, Random random, string name)
        {
            var recent20 = results.OrderByDescending(r => r.Round).Take(20).ToList();
            var prev20 = results.OrderByDescending(r => r.Round).Skip(20).Take(20).ToList();

            var recentStats = _statisticsService.CalculateOverallStatistics(recent20);
            var prevStats = _statisticsService.CalculateOverallStatistics(prev20);

            var risingNumbers = new List<(int Number, double Rise)>();
            for (int num = 1; num <= 45; num++)
            {
                var recentStat = recentStats.FirstOrDefault(s => s.Number == num);
                var prevStat = prevStats.FirstOrDefault(s => s.Number == num);

                double recentPct = recentStat?.Percentage ?? 0;
                double prevPct = prevStat?.Percentage ?? 0;

                if (recentPct > prevPct)
                {
                    risingNumbers.Add((num, recentPct - prevPct + random.NextDouble()));
                }
            }

            var selected = risingNumbers
                .OrderByDescending(r => r.Rise)
                .Take(10)
                .OrderBy(_ => random.Next())
                .Take(6)
                .Select(r => r.Number)
                .OrderBy(n => n)
                .ToArray();

            if (selected.Length < 6)
            {
                var additional = recentStats
                    .Where(s => !selected.Contains(s.Number))
                    .Take(6 - selected.Length)
                    .Select(s => s.Number);
                selected = selected.Concat(additional).OrderBy(n => n).ToArray();
            }

            return new RecommendedNumbers
            {
                RecommendationType = name,
                Numbers = selected,
                Confidence = 72
            };
        }
    }
}
