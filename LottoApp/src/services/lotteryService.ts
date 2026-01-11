import { LotteryDraw, NumberFrequency, RecommendedNumbers } from '../types/lottery';

// 캐시된 데이터
let cachedDraws: LotteryDraw[] = [];
let lastFetchTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 30; // 30분 캐시

// 동행복권 API에서 특정 회차 데이터 가져오기
async function fetchDrawFromAPI(round: number): Promise<LotteryDraw | null> {
  try {
    const response = await fetch(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`
    );
    const data = await response.json();

    if (data.returnValue === 'success') {
      return {
        round: data.drwNo,
        date: data.drwNoDate,
        numbers: [
          data.drwtNo1,
          data.drwtNo2,
          data.drwtNo3,
          data.drwtNo4,
          data.drwtNo5,
          data.drwtNo6,
        ].sort((a, b) => a - b),
        bonus: data.bnusNo,
      };
    }
    return null;
  } catch (error) {
    console.error('API 호출 실패:', error);
    return null;
  }
}

// 최신 회차 번호 찾기
async function findLatestRound(): Promise<number> {
  // 현재 날짜 기준으로 대략적인 회차 계산
  // 로또 1회차: 2002년 12월 7일
  const startDate = new Date('2002-12-07');
  const today = new Date();
  const weeksDiff = Math.floor((today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  let estimatedRound = weeksDiff + 1;

  // 실제 최신 회차 확인
  let draw = await fetchDrawFromAPI(estimatedRound);
  if (!draw) {
    // 추정치가 너무 높으면 하나씩 낮춤
    while (!draw && estimatedRound > 1) {
      estimatedRound--;
      draw = await fetchDrawFromAPI(estimatedRound);
    }
  }

  return draw ? draw.round : estimatedRound;
}

// 최근 N개 회차 데이터 가져오기
export async function fetchRecentDraws(count: number = 10): Promise<LotteryDraw[]> {
  const now = Date.now();

  // 캐시가 유효하면 캐시 반환
  if (cachedDraws.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedDraws;
  }

  try {
    const latestRound = await findLatestRound();
    const draws: LotteryDraw[] = [];

    // 최근 N개 회차 데이터 가져오기
    const fetchPromises = [];
    for (let i = 0; i < count; i++) {
      fetchPromises.push(fetchDrawFromAPI(latestRound - i));
    }

    const results = await Promise.all(fetchPromises);
    results.forEach(draw => {
      if (draw) draws.push(draw);
    });

    // 회차 순으로 정렬 (최신순)
    draws.sort((a, b) => b.round - a.round);

    cachedDraws = draws;
    lastFetchTime = now;

    return draws;
  } catch (error) {
    console.error('데이터 가져오기 실패:', error);
    return cachedDraws.length > 0 ? cachedDraws : getDefaultDraws();
  }
}

// 기본 데이터 (API 실패 시 폴백) - 2024년~2025년 실제 당첨번호
function getDefaultDraws(): LotteryDraw[] {
  return [
    // 2024년 12월 실제 당첨번호
    { round: 1152, date: '2024-12-28', numbers: [30, 31, 32, 35, 36, 37], bonus: 19 },
    { round: 1151, date: '2024-12-21', numbers: [2, 3, 9, 15, 27, 29], bonus: 8 },
    { round: 1150, date: '2024-12-14', numbers: [8, 9, 18, 35, 39, 45], bonus: 25 },
    { round: 1149, date: '2024-12-07', numbers: [8, 15, 19, 21, 32, 36], bonus: 38 },
    // 2024년 11월
    { round: 1148, date: '2024-11-30', numbers: [3, 6, 13, 15, 16, 22], bonus: 32 },
    { round: 1147, date: '2024-11-23', numbers: [7, 11, 24, 26, 27, 37], bonus: 32 },
    { round: 1146, date: '2024-11-16', numbers: [6, 11, 17, 19, 40, 43], bonus: 28 },
    { round: 1145, date: '2024-11-09', numbers: [2, 11, 31, 33, 37, 44], bonus: 32 },
    { round: 1144, date: '2024-11-02', numbers: [5, 15, 17, 25, 28, 34], bonus: 40 },
    // 2024년 10월
    { round: 1143, date: '2024-10-26', numbers: [10, 16, 17, 27, 28, 36], bonus: 6 },
  ];
}

// 동기식 데이터 (초기 로딩용)
let syncDraws: LotteryDraw[] = getDefaultDraws();

// 데이터 초기화 (앱 시작 시 호출)
export async function initializeLotteryData(): Promise<void> {
  // 앱에서는 CORS 제한으로 API 직접 호출 불가
  // 기본 데이터(실제 2024년 당첨번호) 사용
  syncDraws = getDefaultDraws();
}

// 번호별 출현 빈도 계산
export function getNumberFrequencies(): NumberFrequency[] {
  const frequencyMap = new Map<number, number>();

  // 1-45 모든 번호 초기화
  for (let i = 1; i <= 45; i++) {
    frequencyMap.set(i, 0);
  }

  // 빈도 계산
  syncDraws.forEach(draw => {
    draw.numbers.forEach(num => {
      frequencyMap.set(num, (frequencyMap.get(num) || 0) + 1);
    });
  });

  const totalDraws = syncDraws.length;
  const frequencies: NumberFrequency[] = [];

  frequencyMap.forEach((freq, num) => {
    frequencies.push({
      number: num,
      frequency: freq,
      percentage: (freq / totalDraws) * 100
    });
  });

  return frequencies.sort((a, b) => b.frequency - a.frequency);
}

// 핫 넘버 (자주 나오는 번호)
export function getHotNumbers(count: number = 6): number[] {
  const frequencies = getNumberFrequencies();
  return frequencies.slice(0, count).map(f => f.number).sort((a, b) => a - b);
}

// 콜드 넘버 (안 나오는 번호)
export function getColdNumbers(count: number = 6): number[] {
  const frequencies = getNumberFrequencies();
  return frequencies.slice(-count).map(f => f.number).sort((a, b) => a - b);
}

// 추첨까지 남은 일수 계산
export function getDaysUntilDraw(): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  return daysUntilSaturday;
}

// 다음 회차 번호
export function getNextRound(): number {
  return syncDraws.length > 0 ? syncDraws[0].round + 1 : 1207;
}

// AI 추천 알고리즘들
export function getRecommendations(): RecommendedNumbers[] {
  return [
    {
      algorithm: '🔥 핫넘버 분석',
      numbers: getHotNumbers(6),
      description: '최근 10회차에서 가장 자주 나온 번호'
    },
    {
      algorithm: '❄️ 콜드넘버 역발상',
      numbers: getColdNumbers(6),
      description: '오랫동안 안 나와 출현 확률이 높은 번호'
    },
    {
      algorithm: '⚖️ 균형 조합',
      numbers: generateBalancedNumbers(),
      description: '고저, 홀짝 균형을 맞춘 번호'
    },
    {
      algorithm: '📊 구간 분포',
      numbers: generateSectionNumbers(),
      description: '1-45를 구간별로 균등 분배'
    },
    {
      algorithm: '🎯 연속번호 패턴',
      numbers: generateConsecutivePattern(),
      description: '연속 번호 포함 패턴'
    },
    {
      algorithm: '🔮 델타 시스템',
      numbers: generateDeltaNumbers(),
      description: '번호 간격을 분석한 델타 시스템'
    },
    {
      algorithm: '✨ 행운의 조합',
      numbers: generateLuckyNumbers(),
      description: '통계 기반 행운의 조합'
    },
    {
      algorithm: '🎲 스마트 랜덤',
      numbers: generateSmartRandom(),
      description: '통계를 반영한 스마트 랜덤'
    },
  ];
}

// 균형 조합 생성
function generateBalancedNumbers(): number[] {
  const hot = getHotNumbers(10);
  const low = hot.filter(n => n <= 22).slice(0, 3);
  const high = hot.filter(n => n > 22).slice(0, 3);

  if (low.length < 3) {
    for (let i = 1; low.length < 3; i++) {
      if (!low.includes(i) && i <= 22) low.push(i);
    }
  }
  if (high.length < 3) {
    for (let i = 23; high.length < 3; i++) {
      if (!high.includes(i) && i <= 45) high.push(i);
    }
  }

  return [...low.slice(0, 3), ...high.slice(0, 3)].sort((a, b) => a - b);
}

// 구간별 분포
function generateSectionNumbers(): number[] {
  const frequencies = getNumberFrequencies();
  const sections = [
    frequencies.filter(f => f.number >= 1 && f.number <= 9).sort((a, b) => b.frequency - a.frequency)[0]?.number || 5,
    frequencies.filter(f => f.number >= 10 && f.number <= 18).sort((a, b) => b.frequency - a.frequency)[0]?.number || 14,
    frequencies.filter(f => f.number >= 19 && f.number <= 27).sort((a, b) => b.frequency - a.frequency)[0]?.number || 21,
    frequencies.filter(f => f.number >= 28 && f.number <= 36).sort((a, b) => b.frequency - a.frequency)[0]?.number || 28,
    frequencies.filter(f => f.number >= 37 && f.number <= 45).sort((a, b) => b.frequency - a.frequency)[0]?.number || 35,
  ];

  // 6개로 맞추기
  const hot = getHotNumbers(10).filter(n => !sections.includes(n));
  if (hot.length > 0) sections.push(hot[0]);
  else sections.push(42);

  return sections.sort((a, b) => a - b);
}

// 연속번호 패턴
function generateConsecutivePattern(): number[] {
  const hot = getHotNumbers(10);
  const base = hot[0] || 7;
  const consecutive = [base, base + 1].filter(n => n <= 45);
  const others = hot.filter(n => n !== base && n !== base + 1).slice(0, 4);

  return [...consecutive, ...others].slice(0, 6).sort((a, b) => a - b);
}

// 델타 시스템
function generateDeltaNumbers(): number[] {
  const base = Math.floor(Math.random() * 5) + 1;
  const deltas = [0, 3, 5, 8, 11, 14];
  let current = base;
  const numbers: number[] = [];

  deltas.forEach(d => {
    current = base + d + Math.floor(Math.random() * 3);
    if (current <= 45 && !numbers.includes(current)) {
      numbers.push(current);
    }
  });

  while (numbers.length < 6) {
    const rand = Math.floor(Math.random() * 45) + 1;
    if (!numbers.includes(rand)) numbers.push(rand);
  }

  return numbers.slice(0, 6).sort((a, b) => a - b);
}

// 행운의 조합
function generateLuckyNumbers(): number[] {
  const hot = getHotNumbers(6);
  const lucky = [7, 11, 17, 21, 33, 44];
  const mixed = [...hot.slice(0, 3), ...lucky.slice(0, 3)];
  const unique = [...new Set(mixed)];

  while (unique.length < 6) {
    const rand = Math.floor(Math.random() * 45) + 1;
    if (!unique.includes(rand)) unique.push(rand);
  }

  return unique.slice(0, 6).sort((a, b) => a - b);
}

// 스마트 랜덤
function generateSmartRandom(): number[] {
  const frequencies = getNumberFrequencies();
  const topHalf = frequencies.slice(0, 23).map(f => f.number);
  const selected: number[] = [];

  while (selected.length < 6) {
    const idx = Math.floor(Math.random() * topHalf.length);
    const num = topHalf[idx];
    if (!selected.includes(num)) {
      selected.push(num);
    }
  }

  return selected.sort((a, b) => a - b);
}

// 최근 당첨 결과 가져오기 (동기)
export function getRecentDraws(): LotteryDraw[] {
  return syncDraws;
}

// 최근 당첨 결과 가져오기 (비동기)
export async function getRecentDrawsAsync(): Promise<LotteryDraw[]> {
  return await fetchRecentDraws(10);
}
