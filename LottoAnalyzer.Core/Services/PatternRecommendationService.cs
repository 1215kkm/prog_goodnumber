using System;
using System.Collections.Generic;
using System.Linq;
using LottoAnalyzer.Core.Models;

namespace LottoAnalyzer.Core.Services
{
    /// <summary>
    /// 패턴 기반 추천 서비스 - 백테스트에서 검증된 최고 성능 전략들
    /// 간격+합계필터(1.380), 간격패턴(1.340), 종합얼티밋(1.330), 보너스+간격(1.310)
    /// </summary>
    public class PatternRecommendationService
    {
        private readonly Random _random = new();

        /// <summary>
        /// 패턴 기반 추천 번호 세트 생성
        /// </summary>
        public List<PatternRecommendation> GeneratePatternRecommendations(List<LottoResult> results)
        {
            var sortedResults = results.OrderBy(r => r.Round).ToList();
            var recommendations = new List<PatternRecommendation>();

            // 1. 간격+합계필터 (최고 성능: 평균 1.380 적중)
            recommendations.Add(GenerateGapWithSumFilter(sortedResults));

            // 2. 간격패턴 (평균 1.340 적중)
            recommendations.Add(GenerateGapPattern(sortedResults));

            // 3. 종합 얼티밋 (평균 1.330 적중)
            recommendations.Add(GenerateUltimateComposite(sortedResults));

            // 4. 보너스+간격 (평균 1.310 적중)
            recommendations.Add(GenerateBonusGapCombo(sortedResults));

            return recommendations;
        }

        /// <summary>
        /// 간격+합계필터 전략 (백테스트 1위: 평균 1.380 적중)
        /// 각 번호의 평균 출현 간격을 분석하고, 현재 간격이 적정 범위인 번호를 선택
        /// 합계 121~160 범위로 필터링
        /// </summary>
        private PatternRecommendation GenerateGapWithSumFilter(List<LottoResult> results)
        {
            var scores = CalculateGapScores(results);

            // 최근 3회 이내 출현 번호에 보너스
            for (int i = 1; i <= 45; i++)
            {
                int lastSeen = GetLastSeenIndex(results, i);
                int currentGap = results.Count - lastSeen;
                if (currentGap <= 3) scores[i] += 3;
            }

            // 상위 15개 후보에서 합계 121-160 조합 찾기
            var candidates = scores.OrderByDescending(kv => kv.Value)
                .Take(15).Select(kv => kv.Key).ToList();

            var best = FindBestSumCombination(candidates, scores, 121, 160);

            return new PatternRecommendation
            {
                StrategyName = "간격+합계필터",
                Description = "번호별 출현 주기를 분석하여 '나올 때 된' 번호를 선택하고, 합계를 최적 범위(121~160)로 조정",
                BacktestScore = 1.380,
                Numbers = best.OrderBy(n => n).ToArray(),
                StrategyDetail = "평균 간격 대비 현재 간격이 0.9~2.0배인 번호에 높은 점수 부여 → 상위 15개에서 합계 필터링"
            };
        }

        /// <summary>
        /// 간격패턴 전략 (백테스트 2위: 평균 1.340 적중)
        /// 순수하게 출현 간격만으로 예측
        /// </summary>
        private PatternRecommendation GenerateGapPattern(List<LottoResult> results)
        {
            var scores = CalculateGapScores(results);

            // 최근 3회 이내 출현 보너스
            for (int i = 1; i <= 45; i++)
            {
                int lastSeen = GetLastSeenIndex(results, i);
                int currentGap = results.Count - lastSeen;
                if (currentGap <= 3) scores[i] += 3;
            }

            var selected = scores.OrderByDescending(kv => kv.Value)
                .Take(6).Select(kv => kv.Key).OrderBy(n => n).ToArray();

            return new PatternRecommendation
            {
                StrategyName = "간격패턴",
                Description = "각 번호의 평균 출현 주기를 계산하여, 다음에 나올 확률이 높은 번호를 선택",
                BacktestScore = 1.340,
                Numbers = selected,
                StrategyDetail = "번호별 평균 간격 vs 현재 미출현 기간 비교 → 0.9~2.0배 범위의 번호 선택"
            };
        }

        /// <summary>
        /// 종합 얼티밋 전략 (백테스트 3위: 평균 1.330 적중)
        /// 간격(40%) + 보너스(20%) + 동반출현(20%) + 계절(10%) + 균형필터
        /// </summary>
        private PatternRecommendation GenerateUltimateComposite(List<LottoResult> results)
        {
            var scores = new Dictionary<int, double>();
            for (int i = 1; i <= 45; i++) scores[i] = 0;

            // 1. 간격 패턴 (40%)
            var gapScores = CalculateGapScores(results);
            foreach (var kv in gapScores)
            {
                scores[kv.Key] += kv.Value * 1.2; // 40% 가중
            }

            // 최근 3회 이내 출현 보너스
            for (int i = 1; i <= 45; i++)
            {
                int lastSeen = GetLastSeenIndex(results, i);
                int currentGap = results.Count - lastSeen;
                if (currentGap <= 3) scores[i] += 4;
            }

            // 2. 보너스 번호 (20%)
            var recentResults = results.Skip(Math.Max(0, results.Count - 5)).ToList();
            for (int i = 0; i < recentResults.Count; i++)
            {
                int bonus = recentResults[i].BonusNumber;
                scores[bonus] += 4 - (int)((recentResults.Count - 1 - i) * 0.8);
            }

            // 3. 동반출현 (20%)
            var lastNumbers = results.Last().Numbers;
            for (int i = 0; i < results.Count - 1; i++)
            {
                int overlap = results[i].Numbers.Count(n => lastNumbers.Contains(n));
                if (overlap >= 2)
                {
                    foreach (var n in results[i + 1].Numbers)
                    {
                        scores[n] += 1;
                    }
                }
            }

            // 4. 계절 보정 (10%)
            int currentMonth = results.Last().DrawDate.Month;
            var sameMonthResults = results.Where(r => r.DrawDate.Month == currentMonth).ToList();
            var monthFreq = new Dictionary<int, int>();
            for (int i = 1; i <= 45; i++) monthFreq[i] = 0;
            foreach (var r in sameMonthResults)
                foreach (var n in r.Numbers)
                    monthFreq[n]++;

            int maxMonthFreq = monthFreq.Values.Max();
            if (maxMonthFreq > 0)
            {
                for (int i = 1; i <= 45; i++)
                    scores[i] += (double)monthFreq[i] / maxMonthFreq * 3;
            }

            // 상위 12개 후보에서 합계+홀짝 필터
            var candidates = scores.OrderByDescending(kv => kv.Value)
                .Take(12).Select(kv => kv.Key).ToList();

            var best = FindBestBalancedCombination(candidates, scores);

            return new PatternRecommendation
            {
                StrategyName = "종합 얼티밋",
                Description = "간격패턴(40%) + 보너스추적(20%) + 동반출현(20%) + 계절보정(10%)의 종합 분석",
                BacktestScore = 1.330,
                Numbers = best.OrderBy(n => n).ToArray(),
                StrategyDetail = "4가지 패턴을 가중 합산 → 합계 121~160 & 홀짝 2:4~4:2 필터 적용"
            };
        }

        /// <summary>
        /// 보너스+간격 전략 (백테스트 4위: 평균 1.310 적중)
        /// 최근 보너스 번호가 다음 당첨번호로 나올 확률 활용
        /// </summary>
        private PatternRecommendation GenerateBonusGapCombo(List<LottoResult> results)
        {
            var scores = new Dictionary<int, double>();
            for (int i = 1; i <= 45; i++) scores[i] = 0;

            // 최근 5회 보너스 번호에 높은 점수
            var recent5 = results.Skip(Math.Max(0, results.Count - 5)).ToList();
            for (int i = 0; i < recent5.Count; i++)
            {
                int bonus = recent5[i].BonusNumber;
                scores[bonus] += 5 - (recent5.Count - 1 - i);
            }

            // 간격 패턴 결합
            var lastSeenMap = new Dictionary<int, int>();
            var gapsMap = new Dictionary<int, List<int>>();
            for (int i = 1; i <= 45; i++) { lastSeenMap[i] = 0; gapsMap[i] = new List<int>(); }

            for (int idx = 0; idx < results.Count; idx++)
            {
                foreach (var n in results[idx].Numbers)
                {
                    if (lastSeenMap[n] > 0) gapsMap[n].Add(idx - lastSeenMap[n]);
                    lastSeenMap[n] = idx;
                }
            }

            for (int i = 1; i <= 45; i++)
            {
                double avgGap = gapsMap[i].Count > 2
                    ? gapsMap[i].Average()
                    : 8.0;
                int currentGap = results.Count - lastSeenMap[i];
                if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0)
                {
                    scores[i] += (currentGap / avgGap) * 8;
                }
            }

            var selected = scores.OrderByDescending(kv => kv.Value)
                .Take(6).Select(kv => kv.Key).OrderBy(n => n).ToArray();

            return new PatternRecommendation
            {
                StrategyName = "보너스+간격",
                Description = "보너스 번호가 5회 이내 당첨번호로 나올 확률(46.3%)을 활용 + 간격 패턴",
                BacktestScore = 1.310,
                Numbers = selected,
                StrategyDetail = "최근 5회 보너스 번호 + 출현 주기 적정 범위 번호 조합"
            };
        }

        /// <summary>
        /// 간격 점수 계산 (공통 로직)
        /// </summary>
        private Dictionary<int, double> CalculateGapScores(List<LottoResult> results)
        {
            var scores = new Dictionary<int, double>();
            var lastSeen = new Dictionary<int, int>();
            var gaps = new Dictionary<int, List<int>>();

            for (int i = 1; i <= 45; i++)
            {
                scores[i] = 0;
                lastSeen[i] = 0;
                gaps[i] = new List<int>();
            }

            for (int idx = 0; idx < results.Count; idx++)
            {
                foreach (var n in results[idx].Numbers)
                {
                    if (lastSeen[n] > 0) gaps[n].Add(idx - lastSeen[n]);
                    lastSeen[n] = idx;
                }
            }

            for (int i = 1; i <= 45; i++)
            {
                double avgGap = gaps[i].Count > 2
                    ? gaps[i].Average()
                    : 8.0;
                int currentGap = results.Count - lastSeen[i];
                if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0)
                {
                    scores[i] = (currentGap / avgGap) * 10;
                }
            }

            return scores;
        }

        /// <summary>
        /// 특정 번호의 마지막 출현 인덱스
        /// </summary>
        private int GetLastSeenIndex(List<LottoResult> results, int number)
        {
            for (int i = results.Count - 1; i >= 0; i--)
            {
                if (results[i].Numbers.Contains(number))
                    return i;
            }
            return 0;
        }

        /// <summary>
        /// 합계 범위에 맞는 최적 조합 찾기
        /// </summary>
        private List<int> FindBestSumCombination(List<int> candidates, Dictionary<int, double> scores, int minSum, int maxSum)
        {
            var best = candidates.Take(6).ToList();
            double bestScore = -1;

            for (int attempt = 0; attempt < 500; attempt++)
            {
                var shuffled = candidates.OrderBy(_ => _random.Next()).Take(6).ToList();
                int sum = shuffled.Sum();
                if (sum >= minSum && sum <= maxSum)
                {
                    double score = shuffled.Sum(n => scores.ContainsKey(n) ? scores[n] : 0);
                    if (score > bestScore)
                    {
                        bestScore = score;
                        best = shuffled;
                    }
                }
            }

            return best;
        }

        /// <summary>
        /// 합계 + 홀짝 균형 조합 찾기
        /// </summary>
        private List<int> FindBestBalancedCombination(List<int> candidates, Dictionary<int, double> scores)
        {
            var best = candidates.Take(6).ToList();
            double bestScore = -1;

            for (int attempt = 0; attempt < 300; attempt++)
            {
                var shuffled = candidates.OrderBy(_ => _random.Next()).Take(6).ToList();
                int sum = shuffled.Sum();
                int odds = shuffled.Count(n => n % 2 == 1);
                if (sum >= 121 && sum <= 160 && odds >= 2 && odds <= 4)
                {
                    double score = shuffled.Sum(n => scores.ContainsKey(n) ? scores[n] : 0);
                    if (score > bestScore)
                    {
                        bestScore = score;
                        best = shuffled;
                    }
                }
            }

            return best;
        }
    }

    /// <summary>
    /// 패턴 추천 결과 모델
    /// </summary>
    public class PatternRecommendation
    {
        public string StrategyName { get; set; } = "";
        public string Description { get; set; } = "";
        public double BacktestScore { get; set; }
        public int[] Numbers { get; set; } = new int[6];
        public string StrategyDetail { get; set; } = "";
    }
}
