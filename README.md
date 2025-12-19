# 로또 번호 분석기 (Lotto Analyzer)

통계 기반 로또 번호 분석 및 추천 WPF 애플리케이션

## 주요 기능

### 1. 번호 분석
- **전체 통계**: 1~45번까지 각 번호별 출현 빈도, 비율, 마지막 출현 회차 분석
- **월별 통계**: 1월~12월 각 월별로 자주 출현하는 TOP 10 번호
- **계절별 통계**: 봄/여름/가을/겨울 계절별 번호 출현 패턴 분석
- **연도별 통계**: 연도별 가장 많이 출현한 번호 추적

### 2. 패턴 분석
- **홀짝 비율**: 홀수/짝수 번호 조합 패턴 분석
- **고저 비율**: 저번호(1-22)/고번호(23-45) 분포 분석
- **합계 범위**: 당첨 번호 합계의 통계적 범위 분석
- **연속 번호**: 연속 번호 출현 패턴 분석
- **AC값 분석**: 번호 간 차이의 다양성 분석

### 3. 번호 추천
- **빈도 기반 추천**: 가장 많이 출현한 번호 기반
- **계절 기반 추천**: 현재 계절에 자주 나오는 번호
- **월별 추천**: 현재 월에 통계적으로 자주 출현하는 번호
- **미출현 기반 추천**: 오래 안 나온 번호 (Due Numbers)
- **균형 배분 추천**: 모든 구간에서 균형있게 선택
- **핫/콜드 콤보**: 자주 나오는 번호 + 적게 나오는 번호 조합

### 4. 최근 당첨 결과
- 최근 10회 당첨 번호 확인
- 보너스 번호 표시

## 기술 스택

- **Framework**: .NET 8.0 WPF
- **Architecture**: MVVM 패턴
- **Libraries**:
  - CommunityToolkit.Mvvm - MVVM 지원
  - Newtonsoft.Json - JSON 파싱
  - LiveChartsCore.SkiaSharpView.WPF - 차트 (선택적)

## 프로젝트 구조

```
LottoAnalyzer/
├── Models/
│   ├── LottoResult.cs          # 로또 결과 모델
│   └── NumberStatistics.cs     # 통계 모델들
├── Services/
│   ├── LottoDataService.cs     # 데이터 수집 서비스
│   ├── StatisticsService.cs    # 통계 분석 서비스
│   └── RecommendationService.cs # 번호 추천 서비스
├── ViewModels/
│   └── MainViewModel.cs        # 메인 뷰모델
├── Views/
│   ├── MainWindow.xaml         # 메인 UI
│   └── MainWindow.xaml.cs
├── Converters/
│   └── Converters.cs           # 값 변환기들
├── App.xaml                    # 앱 리소스 및 스타일
└── App.xaml.cs
```

## 설치 및 실행

### 요구 사항
- Windows 10/11
- .NET 8.0 SDK

### 빌드 및 실행
```bash
# 프로젝트 복원
dotnet restore

# 빌드
dotnet build

# 실행
dotnet run --project LottoAnalyzer
```

## 데이터 소스

- **동행복권 API**: 실시간 로또 당첨 번호 조회
- **샘플 데이터**: API 연결 실패 시 내장된 샘플 데이터 사용

## 스크린샷 (예정)

애플리케이션은 다음과 같은 탭으로 구성됩니다:
1. 추천 번호 - 다양한 알고리즘 기반 번호 추천
2. 번호별 통계 - 전체 번호 출현 빈도
3. 월별 통계 - 월별 인기 번호
4. 계절별 통계 - 계절별 번호 패턴
5. 연도별 통계 - 연도별 추세
6. 최근 당첨 - 최근 당첨 번호 목록

## 주의사항

이 프로그램은 과거 통계 데이터를 기반으로 한 참고용 도구입니다.
로또는 무작위 추첨이므로 과거 데이터가 미래 결과를 보장하지 않습니다.
책임감 있는 복권 구매를 권장합니다.

## 라이선스

MIT License
