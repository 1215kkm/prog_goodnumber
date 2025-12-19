using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LottoAnalyzer.Models;
using LottoAnalyzer.Services;
using System.Linq;
using System.Collections.Generic;

namespace LottoAnalyzer.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        private readonly LottoDataService _dataService;
        private readonly StatisticsService _statisticsService;
        private readonly RecommendationService _recommendationService;

        [ObservableProperty]
        private bool _isLoading;

        [ObservableProperty]
        private int _loadingProgress;

        [ObservableProperty]
        private string _statusMessage = "데이터를 불러와주세요.";

        [ObservableProperty]
        private int _totalDrawCount;

        [ObservableProperty]
        private int _selectedYears = 5;

        // 통계 데이터
        public ObservableCollection<NumberStatistics> OverallStatistics { get; } = new();
        public ObservableCollection<MonthlyStatistics> MonthlyStatistics { get; } = new();
        public ObservableCollection<YearlyStatistics> YearlyStatistics { get; } = new();
        public ObservableCollection<SeasonalStatistics> SeasonalStatistics { get; } = new();
        public ObservableCollection<RangeStatistics> RangeStatistics { get; } = new();
        public ObservableCollection<RecommendedNumbers> Recommendations { get; } = new();
        public ObservableCollection<LottoResult> RecentResults { get; } = new();

        // 고급 분석 데이터
        public ObservableCollection<NumberPair> TopPairs { get; } = new();
        public ObservableCollection<NumberTriple> TopTriples { get; } = new();
        public ObservableCollection<NumberStatistics> HotNumbers { get; } = new();
        public ObservableCollection<NumberStatistics> ColdNumbers { get; } = new();
        public ObservableCollection<NumberCycle> NumberCycles { get; } = new();

        // 패턴 분석 결과
        [ObservableProperty]
        private string _oddEvenRatioText = "";

        [ObservableProperty]
        private string _highLowRatioText = "";

        [ObservableProperty]
        private string _sumRangeText = "";

        [ObservableProperty]
        private string _consecutivePatternText = "";

        [ObservableProperty]
        private string _lastDigitsText = "";

        [ObservableProperty]
        private string _primeNumbersText = "";

        [ObservableProperty]
        private string _acValuesText = "";

        // 차트용 데이터
        public ObservableCollection<ChartData> FrequencyChartData { get; } = new();

        private List<LottoResult> _allResults = new();

        public MainViewModel()
        {
            _dataService = new LottoDataService();
            _statisticsService = new StatisticsService();
            _recommendationService = new RecommendationService(_statisticsService);
        }

        [RelayCommand]
        private async Task LoadDataFromApiAsync()
        {
            try
            {
                IsLoading = true;
                StatusMessage = "동행복권 API에서 데이터 로딩 중...";
                LoadingProgress = 0;

                var progress = new Progress<int>(p => LoadingProgress = p);
                _allResults = await _dataService.GetResultsForYearsAsync(SelectedYears, progress);

                if (_allResults.Count > 0)
                {
                    StatusMessage = $"API에서 {_allResults.Count}회차 데이터 로딩 완료!";
                    AnalyzeData();
                }
                else
                {
                    StatusMessage = "API 연결 실패. 샘플 데이터를 사용합니다.";
                    LoadSampleData();
                }
            }
            catch (Exception ex)
            {
                StatusMessage = $"오류 발생: {ex.Message}. 샘플 데이터를 사용합니다.";
                LoadSampleData();
            }
            finally
            {
                IsLoading = false;
            }
        }

        [RelayCommand]
        private void LoadSampleData()
        {
            IsLoading = true;
            StatusMessage = "실제 로또 데이터 (2020-2024년) 로딩 중...";

            try
            {
                _allResults = _dataService.GetSampleData();
                StatusMessage = $"실제 데이터 {_allResults.Count}회차 로딩 완료! (891회~1148회)";
                AnalyzeData();
            }
            catch (Exception ex)
            {
                StatusMessage = $"데이터 로딩 오류: {ex.Message}";
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void AnalyzeData()
        {
            TotalDrawCount = _allResults.Count;

            // 최근 결과
            RecentResults.Clear();
            foreach (var result in _allResults.Take(10))
            {
                RecentResults.Add(result);
            }

            // 전체 통계
            var overallStats = _statisticsService.CalculateOverallStatistics(_allResults);
            OverallStatistics.Clear();
            foreach (var stat in overallStats)
            {
                OverallStatistics.Add(stat);
            }

            // 월별 통계
            var monthlyStats = _statisticsService.CalculateMonthlyStatistics(_allResults);
            MonthlyStatistics.Clear();
            foreach (var stat in monthlyStats)
            {
                MonthlyStatistics.Add(stat);
            }

            // 연도별 통계
            var yearlyStats = _statisticsService.CalculateYearlyStatistics(_allResults);
            YearlyStatistics.Clear();
            foreach (var stat in yearlyStats)
            {
                YearlyStatistics.Add(stat);
            }

            // 계절별 통계
            var seasonalStats = _statisticsService.CalculateSeasonalStatistics(_allResults);
            SeasonalStatistics.Clear();
            foreach (var stat in seasonalStats)
            {
                SeasonalStatistics.Add(stat);
            }

            // 구간별 통계
            var rangeStats = _statisticsService.CalculateRangeStatistics(_allResults);
            RangeStatistics.Clear();
            foreach (var stat in rangeStats)
            {
                RangeStatistics.Add(stat);
            }

            // 고급 분석
            AnalyzeAdvanced();

            // 패턴 분석
            AnalyzePatterns();

            // 차트 데이터
            UpdateChartData(overallStats);

            // 추천 번호 생성
            GenerateRecommendations();
        }

        private void AnalyzeAdvanced()
        {
            // 동반 출현 번호 쌍
            var pairs = _statisticsService.AnalyzeNumberPairs(_allResults, 20);
            TopPairs.Clear();
            foreach (var pair in pairs)
            {
                TopPairs.Add(pair);
            }

            // 동반 출현 번호 트리플
            var triples = _statisticsService.AnalyzeNumberTriples(_allResults, 10);
            TopTriples.Clear();
            foreach (var triple in triples)
            {
                TopTriples.Add(triple);
            }

            // 핫 넘버
            var hotNumbers = _statisticsService.AnalyzeHotNumbers(_allResults, 30);
            HotNumbers.Clear();
            foreach (var hot in hotNumbers)
            {
                HotNumbers.Add(hot);
            }

            // 콜드 넘버
            var coldNumbers = _statisticsService.AnalyzeColdNumbers(_allResults, 30);
            ColdNumbers.Clear();
            foreach (var cold in coldNumbers)
            {
                ColdNumbers.Add(cold);
            }

            // 번호 출현 주기
            var cycles = _statisticsService.AnalyzeNumberCycles(_allResults);
            NumberCycles.Clear();
            foreach (var cycle in cycles.Where(c => c.IsOverdue).Take(15))
            {
                NumberCycles.Add(cycle);
            }
        }

        private void AnalyzePatterns()
        {
            // 홀짝 비율
            var oddEvenRatio = _statisticsService.AnalyzeOddEvenRatio(_allResults);
            OddEvenRatioText = string.Join("\n", oddEvenRatio.Take(5).Select(r =>
                $"홀{r.Key.Split(':')[0]}:짝{r.Key.Split(':')[1]} → {r.Value}회 ({(double)r.Value / _allResults.Count * 100:F1}%)"));

            // 고저 비율
            var highLowRatio = _statisticsService.AnalyzeHighLowRatio(_allResults);
            HighLowRatioText = string.Join("\n", highLowRatio.Take(5).Select(r =>
                $"{r.Key} → {r.Value}회 ({(double)r.Value / _allResults.Count * 100:F1}%)"));

            // 합계 범위
            var sumRange = _statisticsService.AnalyzeSumRange(_allResults);
            SumRangeText = $"최소: {sumRange.Min}\n최대: {sumRange.Max}\n평균: {sumRange.Average:F1}\n최다 구간: {sumRange.MostCommonRangeStart}~{sumRange.MostCommonRangeEnd}";

            // 연속 번호 패턴
            var consecutivePatterns = _statisticsService.AnalyzeConsecutivePatterns(_allResults);
            ConsecutivePatternText = string.Join("\n", consecutivePatterns.Select(p =>
                p.ConsecutiveCount == 0
                    ? $"연속 없음 → {p.Occurrences}회 ({p.Percentage}%)"
                    : $"{p.ConsecutiveCount}개 연속 → {p.Occurrences}회 ({p.Percentage}%)"));

            // 끝자리 분석
            var lastDigits = _statisticsService.AnalyzeLastDigits(_allResults);
            LastDigitsText = string.Join("\n", lastDigits.Take(5).Select(l =>
                $"끝자리 {l.Key} → {l.Value}회 ({(double)l.Value / (_allResults.Count * 6) * 100:F1}%)"));

            // 소수 포함 분석
            var primes = _statisticsService.AnalyzePrimeNumbers(_allResults);
            PrimeNumbersText = string.Join("\n", primes.Select(p =>
                $"소수 {p.Key}개 → {p.Value}회 ({(double)p.Value / _allResults.Count * 100:F1}%)"));

            // AC값 분석
            var acValues = _statisticsService.AnalyzeACValues(_allResults);
            AcValuesText = string.Join("\n", acValues.Take(5).Select(a =>
                $"AC {a.Key} → {a.Value}회 ({(double)a.Value / _allResults.Count * 100:F1}%)"));
        }

        private void UpdateChartData(List<NumberStatistics> stats)
        {
            FrequencyChartData.Clear();
            foreach (var stat in stats.OrderBy(s => s.Number))
            {
                FrequencyChartData.Add(new ChartData
                {
                    Label = stat.Number.ToString(),
                    Value = stat.Count,
                    Number = stat.Number
                });
            }
        }

        [RelayCommand]
        private void GenerateRecommendations()
        {
            if (_allResults.Count == 0) return;

            var recommendations = _recommendationService.GenerateRecommendations(_allResults);
            Recommendations.Clear();
            foreach (var rec in recommendations)
            {
                Recommendations.Add(rec);
            }

            StatusMessage = $"8가지 AI 추천 번호가 생성되었습니다! (분석 데이터: {_allResults.Count}회차)";
        }

        [RelayCommand]
        private void RefreshRecommendations()
        {
            GenerateRecommendations();
        }
    }

    /// <summary>
    /// 차트 데이터 모델
    /// </summary>
    public class ChartData
    {
        public string Label { get; set; } = "";
        public int Value { get; set; }
        public int Number { get; set; }

        public string ColorGroup => Number switch
        {
            >= 1 and <= 10 => "#FBC400",
            >= 11 and <= 20 => "#69C8F2",
            >= 21 and <= 30 => "#FF7272",
            >= 31 and <= 40 => "#AAAAAA",
            _ => "#B0D840"
        };
    }
}
