/**
 * 고급 패턴 분석: 3개 이상 적중하는 전략 탐색
 * - 앙상블 투표, 적응형 간격, 조건부 확률, 다중 시간창
 */

const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../LottoAnalyzer.Core/Services/LottoDataService.cs'), 'utf8');
const regex = /\((\d+),\s*new\s+DateTime\((\d+),\s*(\d+),\s*(\d+)\),\s*new\[\]\s*\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\},\s*(\d+)\)/g;

const allResults = [];
let match;
while ((match = regex.exec(content)) !== null) {
    allResults.push({
        round: parseInt(match[1]),
        year: parseInt(match[2]),
        month: parseInt(match[3]),
        day: parseInt(match[4]),
        date: new Date(parseInt(match[2]), parseInt(match[3]) - 1, parseInt(match[4])),
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}
allResults.sort((a, b) => a.round - b.round);
console.log(`총 ${allResults.length}개 회차 분석\n`);

// ============================
// 공통 유틸리티 함수들
// ============================
function getGapScores(pastResults, minRatio = 0.9, maxRatio = 2.0) {
    const lastSeen = {};
    const gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    pastResults.forEach((r, idx) => {
        r.numbers.forEach(n => {
            if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
            lastSeen[n] = idx;
        });
    });
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
        const currentGap = pastResults.length - lastSeen[i];
        const ratio = currentGap / avgGap;
        if (ratio >= minRatio && ratio <= maxRatio) {
            scores[i] = ratio * 10;
        } else {
            scores[i] = 0;
        }
    }
    return scores;
}

function getHotScores(pastResults, window = 20) {
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-window).forEach(r => r.numbers.forEach(n => freq[n]++));
    return freq;
}

function getBonusScores(pastResults, lookback = 5) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;
    for (let i = Math.max(0, pastResults.length - lookback); i < pastResults.length; i++) {
        scores[pastResults[i].bonus] += lookback - (pastResults.length - 1 - i);
    }
    return scores;
}

function getCompanionScores(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;
    const lastNums = pastResults[pastResults.length - 1].numbers;
    for (let i = 0; i < pastResults.length - 1; i++) {
        const overlap = pastResults[i].numbers.filter(n => lastNums.includes(n));
        if (overlap.length >= 2) {
            pastResults[i + 1].numbers.forEach(n => scores[n] += overlap.length);
        }
    }
    return scores;
}

function filterBySum(candidates, scores, minSum = 100, maxSum = 180, count = 6, attempts = 1000) {
    let best = candidates.slice(0, count);
    let bestScore = -1;
    for (let a = 0; a < attempts; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, count);
        const sum = combo.reduce((s, n) => s + n, 0);
        if (sum >= minSum && sum <= maxSum) {
            const score = combo.reduce((s, n) => s + (scores[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }
    return best.sort((a, b) => a - b);
}

// ============================
// 전략 정의: 다양한 변형 테스트
// ============================

// 전략 1: 간격 좁은 범위 (1.0-1.5배)
function strategyGapNarrow(past) {
    const scores = getGapScores(past, 1.0, 1.5);
    for (let i = 1; i <= 45; i++) {
        const lastSeen = getLastSeen(past, i);
        if (lastSeen <= 3) scores[i] += 2;
    }
    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 121, 160);
}

// 전략 2: 간격 넓은 범위 (0.8-2.5배) + 합계필터
function strategyGapWide(past) {
    const scores = getGapScores(past, 0.8, 2.5);
    for (let i = 1; i <= 45; i++) {
        const lastSeen = getLastSeen(past, i);
        if (lastSeen <= 2) scores[i] += 4;
    }
    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 165);
}

// 전략 3: 앙상블 투표 (6개 하위전략의 top10에서 겹치는 번호)
function strategyEnsemble(past) {
    const gapScores = getGapScores(past);
    const hotScores = getHotScores(past, 15);
    const bonusScores = getBonusScores(past);
    const companionScores = getCompanionScores(past);
    const gapNarrow = getGapScores(past, 1.0, 1.8);
    const hot30 = getHotScores(past, 30);

    const votes = {};
    for (let i = 1; i <= 45; i++) votes[i] = 0;

    // 각 전략의 상위 10개에 투표
    const strategies = [gapScores, hotScores, bonusScores, companionScores, gapNarrow, hot30];
    strategies.forEach(s => {
        Object.entries(s).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .forEach(([n]) => votes[parseInt(n)]++);
    });

    const candidates = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(e => parseInt(e[0]));
    return filterBySum(candidates, votes, 121, 160);
}

// 전략 4: 가중 앙상블 (간격 40% + 핫 25% + 보너스 20% + 동반 15%)
function strategyWeightedEnsemble(past) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    const gap = getGapScores(past);
    const hot = getHotScores(past, 20);
    const bonus = getBonusScores(past);
    const companion = getCompanionScores(past);

    // 정규화 후 가중합
    const maxGap = Math.max(...Object.values(gap)) || 1;
    const maxHot = Math.max(...Object.values(hot)) || 1;
    const maxBonus = Math.max(...Object.values(bonus)) || 1;
    const maxComp = Math.max(...Object.values(companion)) || 1;

    for (let i = 1; i <= 45; i++) {
        scores[i] = (gap[i] / maxGap) * 40 +
                    (hot[i] / maxHot) * 25 +
                    (bonus[i] / maxBonus) * 20 +
                    (companion[i] / maxComp) * 15;
    }

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 121, 160);
}

// 전략 5: 다중 시간창 핫넘버 (10회 + 20회 + 50회 교집합)
function strategyMultiWindow(past) {
    const hot10 = getHotScores(past, 10);
    const hot20 = getHotScores(past, 20);
    const hot50 = getHotScores(past, 50);

    const scores = {};
    for (let i = 1; i <= 45; i++) {
        // 각 시간창에서의 순위 기반 점수
        scores[i] = 0;
    }

    const rank10 = Object.entries(hot10).sort((a, b) => b[1] - a[1]);
    const rank20 = Object.entries(hot20).sort((a, b) => b[1] - a[1]);
    const rank50 = Object.entries(hot50).sort((a, b) => b[1] - a[1]);

    rank10.forEach(([n], idx) => { if (idx < 15) scores[parseInt(n)] += (15 - idx) * 2; });
    rank20.forEach(([n], idx) => { if (idx < 15) scores[parseInt(n)] += (15 - idx) * 1.5; });
    rank50.forEach(([n], idx) => { if (idx < 15) scores[parseInt(n)] += (15 - idx); });

    const gap = getGapScores(past, 0.8, 2.0);
    for (let i = 1; i <= 45; i++) scores[i] += gap[i] * 0.5;

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 165);
}

// 전략 6: 적응형 간격 (최근 5회 적중 패턴 기반 조정)
function strategyAdaptiveGap(past) {
    // 최근 5회 실제 당첨번호의 gap ratio 분석
    const recentGapRatios = [];
    for (let i = Math.max(5, past.length - 5); i < past.length; i++) {
        const prev = past.slice(0, i);
        const actual = past[i].numbers;
        actual.forEach(n => {
            const lastSeen = {};
            const gaps = {};
            for (let j = 1; j <= 45; j++) { lastSeen[j] = 0; gaps[j] = []; }
            prev.forEach((r, idx) => {
                r.numbers.forEach(num => {
                    if (lastSeen[num] > 0) gaps[num].push(idx - lastSeen[num]);
                    lastSeen[num] = idx;
                });
            });
            const avgGap = gaps[n] && gaps[n].length > 2 ? gaps[n].reduce((a, b) => a + b, 0) / gaps[n].length : 8;
            const currentGap = prev.length - (lastSeen[n] || 0);
            if (avgGap > 0) recentGapRatios.push(currentGap / avgGap);
        });
    }

    // 최근 당첨번호들의 평균 gap ratio 계산
    const avgRatio = recentGapRatios.length > 0 ?
        recentGapRatios.reduce((a, b) => a + b, 0) / recentGapRatios.length : 1.2;
    const minR = Math.max(0.5, avgRatio - 0.5);
    const maxR = avgRatio + 0.8;

    const scores = getGapScores(past, minR, maxR);
    for (let i = 1; i <= 45; i++) {
        const ls = getLastSeen(past, i);
        if (ls <= 3) scores[i] += 3;
    }
    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 170);
}

// 전략 7: 페어 기반 + 간격 (자주 같이 나오는 번호쌍 활용)
function strategyPairGap(past) {
    const pairCount = {};
    past.slice(-100).forEach(r => {
        for (let i = 0; i < r.numbers.length; i++) {
            for (let j = i + 1; j < r.numbers.length; j++) {
                const key = `${Math.min(r.numbers[i], r.numbers[j])}-${Math.max(r.numbers[i], r.numbers[j])}`;
                pairCount[key] = (pairCount[key] || 0) + 1;
            }
        }
    });

    // 상위 페어에서 번호 추출
    const topPairs = Object.entries(pairCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const pairScores = {};
    for (let i = 1; i <= 45; i++) pairScores[i] = 0;
    topPairs.forEach(([pair, count]) => {
        const [a, b] = pair.split('-').map(Number);
        pairScores[a] += count;
        pairScores[b] += count;
    });

    // 간격 점수 결합
    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        scores[i] = pairScores[i] * 2 + gap[i] * 3;
    }

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 121, 160);
}

// 전략 8: 번호 선택 10개 (6개 대신 10개 선택)
function strategyPick10(past) {
    const scores = getGapScores(past);
    const hot = getHotScores(past, 15);
    const bonus = getBonusScores(past);

    for (let i = 1; i <= 45; i++) {
        scores[i] += hot[i] * 1.5 + bonus[i] * 2;
        const ls = getLastSeen(past, i);
        if (ls <= 3) scores[i] += 4;
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 10).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// 전략 9: 번호 선택 12개
function strategyPick12(past) {
    const scores = getGapScores(past, 0.7, 2.2);
    const hot = getHotScores(past, 20);
    const bonus = getBonusScores(past);
    const companion = getCompanionScores(past);

    for (let i = 1; i <= 45; i++) {
        scores[i] += hot[i] * 1.2 + bonus[i] * 1.5 + companion[i] * 0.5;
        const ls = getLastSeen(past, i);
        if (ls <= 3) scores[i] += 3;
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 12).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// 전략 10: 구간 강제 + 간격 (각 구간에서 최소 1개)
function strategyRangeForced(past) {
    const scores = getGapScores(past);
    const hot = getHotScores(past, 20);
    for (let i = 1; i <= 45; i++) scores[i] += hot[i] * 1.5;

    const ranges = [[1,9], [10,19], [20,29], [30,39], [40,45]];
    const selected = [];

    // 각 구간에서 최고 점수 1개씩
    ranges.forEach(([min, max]) => {
        let best = -1, bestScore = -1;
        for (let n = min; n <= max; n++) {
            if (scores[n] > bestScore) { bestScore = scores[n]; best = n; }
        }
        if (best > 0) selected.push(best);
    });

    // 나머지는 전체에서 최고점
    const remaining = Object.entries(scores)
        .filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);

    while (selected.length < 6 && remaining.length > 0) {
        selected.push(parseInt(remaining.shift()[0]));
    }

    return selected.sort((a, b) => a - b);
}

// 전략 11: 연속번호 포함 전략
function strategyConsecutive(past) {
    const scores = getGapScores(past);
    const hot = getHotScores(past, 20);
    for (let i = 1; i <= 45; i++) scores[i] += hot[i] * 1.5;

    // 연속번호 쌍 중 점수 높은 것 선택
    let bestPair = [0, 0], bestPairScore = -1;
    for (let i = 1; i <= 44; i++) {
        const pairScore = scores[i] + scores[i + 1];
        if (pairScore > bestPairScore) { bestPairScore = pairScore; bestPair = [i, i + 1]; }
    }

    const selected = [...bestPair];
    const remaining = Object.entries(scores)
        .filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);

    while (selected.length < 6 && remaining.length > 0) {
        selected.push(parseInt(remaining.shift()[0]));
    }

    // 합계 필터
    const sum = selected.reduce((a, b) => a + b, 0);
    if (sum < 100 || sum > 180) {
        // 합계 안 맞으면 기본 간격 전략으로 폴백
        return Object.entries(scores).sort((a, b) => b[1] - a[1])
            .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
    }

    return selected.sort((a, b) => a - b);
}

// 전략 12: 이전 회차 반복 + 간격 (1-2개 반복 패턴 활용)
function strategyRepeatGap(past) {
    const lastNums = past[past.length - 1].numbers;
    const scores = getGapScores(past);

    // 이전 번호 중 간격 점수 높은 2개 유지
    const prevWithScores = lastNums.map(n => ({ n, score: scores[n] }))
        .sort((a, b) => b.score - a.score);

    const selected = prevWithScores.slice(0, 2).map(x => x.n);

    // 나머지는 간격 점수 + 핫넘버
    const hot = getHotScores(past, 15);
    for (let i = 1; i <= 45; i++) {
        if (!selected.includes(i)) scores[i] += hot[i] * 1.5;
    }

    const remaining = Object.entries(scores)
        .filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);

    while (selected.length < 6) {
        selected.push(parseInt(remaining.shift()[0]));
    }

    return selected.sort((a, b) => a - b);
}

// 전략 13: 합계 조건부 (이전 합계 기반 다음 합계 범위 예측)
function strategySumConditional(past) {
    const prevSum = past[past.length - 1].numbers.reduce((a, b) => a + b, 0);
    let targetMin, targetMax;

    if (prevSum < 120) { targetMin = 130; targetMax = 175; }      // 낮으면 높아질 확률
    else if (prevSum < 140) { targetMin = 115; targetMax = 165; }  // 중간이면 유지
    else { targetMin = 100; targetMax = 145; }                     // 높으면 낮아질 확률

    const scores = getGapScores(past);
    const hot = getHotScores(past, 20);
    for (let i = 1; i <= 45; i++) scores[i] += hot[i] * 1.2;

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 18).map(e => parseInt(e[0]));

    return filterBySum(candidates, scores, targetMin, targetMax, 6, 2000);
}

// 전략 14: 홀짝 조건부 (이전 홀짝 비율 기반)
function strategyOddEvenConditional(past) {
    const lastOdds = past[past.length - 1].numbers.filter(n => n % 2 === 1).length;
    // 평균 회귀: 홀수가 많았으면 짝수 쪽으로, 반대도
    const targetOdds = lastOdds >= 4 ? [2, 3] : lastOdds <= 2 ? [3, 4] : [2, 3, 4];

    const scores = getGapScores(past);
    const hot = getHotScores(past, 20);
    for (let i = 1; i <= 45; i++) scores[i] += hot[i] * 1.5;

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 18).map(e => parseInt(e[0]));

    let best = candidates.slice(0, 6);
    let bestScore = -1;

    for (let a = 0; a < 1000; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const odds = combo.filter(n => n % 2 === 1).length;
        const sum = combo.reduce((s, n) => s + n, 0);
        if (targetOdds.includes(odds) && sum >= 115 && sum <= 165) {
            const score = combo.reduce((s, n) => s + (scores[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }

    return best.sort((a, b) => a - b);
}

// 전략 15: 슈퍼 앙상블 (모든 전략의 결과를 모아서 투표)
function strategySuperEnsemble(past) {
    const subStrategies = [
        strategyGapNarrow, strategyGapWide, strategyWeightedEnsemble,
        strategyMultiWindow, strategyPairGap, strategyRangeForced,
        strategySumConditional, strategyRepeatGap
    ];

    const votes = {};
    for (let i = 1; i <= 45; i++) votes[i] = 0;

    subStrategies.forEach(fn => {
        try {
            const result = fn(past);
            result.forEach(n => votes[n] += 1);
        } catch (e) {}
    });

    // 가장 많은 투표를 받은 번호 선택
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const selected = sorted.slice(0, 6).map(e => parseInt(e[0]));
    return selected.sort((a, b) => a - b);
}

// 전략 16: 슈퍼 앙상블 10개 선택
function strategySuperEnsemble10(past) {
    const subStrategies = [
        strategyGapNarrow, strategyGapWide, strategyWeightedEnsemble,
        strategyMultiWindow, strategyPairGap, strategyRangeForced,
        strategySumConditional, strategyRepeatGap, strategyAdaptiveGap
    ];

    const votes = {};
    for (let i = 1; i <= 45; i++) votes[i] = 0;

    subStrategies.forEach(fn => {
        try {
            const result = fn(past);
            result.forEach(n => votes[n] += 1);
        } catch (e) {}
    });

    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 10).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// 전략 17: 최근 3회 미출현 + 간격 (최근 3회에 안 나온 번호 중 간격 적합한 것)
function strategyRecentAbsent(past) {
    const recent3 = new Set();
    past.slice(-3).forEach(r => r.numbers.forEach(n => recent3.add(n)));

    const scores = getGapScores(past, 0.9, 2.5);
    // 최근 3회 출현한 번호는 점수 감소
    for (const n of recent3) {
        scores[n] = (scores[n] || 0) * 0.3;
    }

    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 121, 160);
}

// 전략 18: 핫+콜드 하이브리드 (핫 3개 + 콜드에서 간격 적합 3개)
function strategyHotColdHybrid(past) {
    const hot = getHotScores(past, 15);
    const gap = getGapScores(past, 1.2, 2.5);

    // 핫에서 상위 3개
    const hotTop = Object.entries(hot).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0]));
    const selected = hotTop.slice(0, 3);

    // 콜드(최근 15회 0회 출현)에서 간격 적합한 3개
    const coldWithGap = Object.entries(gap)
        .filter(([n]) => hot[parseInt(n)] === 0 && !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(e => parseInt(e[0]));

    selected.push(...coldWithGap);

    // 부족하면 간격에서 추가
    if (selected.length < 6) {
        const remaining = Object.entries(gap)
            .filter(([n]) => !selected.includes(parseInt(n)))
            .sort((a, b) => b[1] - a[1]);
        while (selected.length < 6 && remaining.length > 0) {
            selected.push(parseInt(remaining.shift()[0]));
        }
    }

    return selected.sort((a, b) => a - b);
}

function getLastSeen(pastResults, number) {
    for (let i = pastResults.length - 1; i >= 0; i--) {
        if (pastResults[i].numbers.includes(number)) return pastResults.length - i;
    }
    return pastResults.length;
}

// ============================
// 백테스팅 실행
// ============================
const strategies = [
    { name: '간격좁은범위(1.0-1.5)', fn: strategyGapNarrow },
    { name: '간격넓은범위(0.8-2.5)', fn: strategyGapWide },
    { name: '앙상블투표', fn: strategyEnsemble },
    { name: '가중앙상블', fn: strategyWeightedEnsemble },
    { name: '다중시간창', fn: strategyMultiWindow },
    { name: '적응형간격', fn: strategyAdaptiveGap },
    { name: '페어+간격', fn: strategyPairGap },
    { name: '10개선택', fn: strategyPick10 },
    { name: '12개선택', fn: strategyPick12 },
    { name: '구간강제+간격', fn: strategyRangeForced },
    { name: '연속번호포함', fn: strategyConsecutive },
    { name: '이전반복+간격', fn: strategyRepeatGap },
    { name: '합계조건부', fn: strategySumConditional },
    { name: '홀짝조건부', fn: strategyOddEvenConditional },
    { name: '슈퍼앙상블6', fn: strategySuperEnsemble },
    { name: '슈퍼앙상블10', fn: strategySuperEnsemble10 },
    { name: '최근미출현+간격', fn: strategyRecentAbsent },
    { name: '핫콜드하이브리드', fn: strategyHotColdHybrid },
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('순위 | 전략               | 평균적중 | 3+개 | 4+개 | 5+개 | 선택수 | 분포');
console.log('-'.repeat(100));

const results = [];
for (const strategy of strategies) {
    let totalMatch = 0, m3 = 0, m4 = 0, m5 = 0;
    const dist = new Array(10).fill(0);
    let pickCount = 6;

    for (let i = startIdx; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        if (past.length < 50) continue;

        try {
            const predicted = strategy.fn(past);
            pickCount = predicted.length;
            const actual = allResults[i].numbers;
            const matches = predicted.filter(n => actual.includes(n)).length;
            totalMatch += matches;
            if (matches < dist.length) dist[matches]++;
            if (matches >= 3) m3++;
            if (matches >= 4) m4++;
            if (matches >= 5) m5++;
        } catch (e) {
            // 에러 발생시 스킵
        }
    }

    const avg = (totalMatch / testRounds).toFixed(3);
    results.push({ name: strategy.name, avg: parseFloat(avg), m3, m4, m5, pickCount, dist });
}

results.sort((a, b) => b.avg - a.avg);
results.forEach((r, idx) => {
    const distStr = r.dist.slice(0, 7).map((d, i) => `${i}:${d}`).join(' ');
    console.log(`${(idx + 1).toString().padStart(2)}위 | ${r.name.padEnd(16)} | ${r.avg.toFixed(3).padStart(6)} | ${r.m3.toString().padStart(3)}회 | ${r.m4.toString().padStart(3)}회 | ${r.m5.toString().padStart(3)}회 | ${r.pickCount.toString().padStart(4)}개 | ${distStr}`);
});

// 6개 선택 전략 중 3개 이상 적중이 가장 많은 전략
console.log('\n\n============================================');
console.log('6개 선택 전략 중 3+적중 최다:');
const pick6Results = results.filter(r => r.pickCount === 6);
pick6Results.sort((a, b) => b.m3 - a.m3);
pick6Results.slice(0, 5).forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.name}: ${r.m3}회/100회 (${r.m3}%) - 평균 ${r.avg.toFixed(3)}`);
});

console.log('\n최고 전략의 1209회 추천:');
const bestStrategy = strategies.find(s => s.name === results[0].name);
if (bestStrategy) {
    const prediction = bestStrategy.fn(allResults);
    console.log(`  ${results[0].name}: ${prediction.join(', ')}`);
}

// 6개 선택 중 최고도
const best6Strategy = strategies.find(s => s.name === pick6Results[0].name);
if (best6Strategy) {
    const prediction = best6Strategy.fn(allResults);
    console.log(`  ${pick6Results[0].name} (6개): ${prediction.join(', ')}`);
}
