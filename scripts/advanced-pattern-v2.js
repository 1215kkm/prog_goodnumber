/**
 * 고급 패턴 분석 v2: 구간강제+간격 변형 및 최적화
 * 이전 분석에서 구간강제+간격이 6개 선택 중 최고 (1.550 avg, 5+ 6회)
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
        month: parseInt(match[3]),
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}
allResults.sort((a, b) => a.round - b.round);
console.log(`총 ${allResults.length}개 회차 분석\n`);

// 공통 함수
function getGapInfo(pastResults) {
    const lastSeen = {};
    const gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    pastResults.forEach((r, idx) => {
        r.numbers.forEach(n => {
            if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
            lastSeen[n] = idx;
        });
    });
    const result = {};
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
        const currentGap = pastResults.length - lastSeen[i];
        result[i] = { avgGap, currentGap, ratio: currentGap / avgGap };
    }
    return result;
}

function getHotScores(past, window) {
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    past.slice(-window).forEach(r => r.numbers.forEach(n => freq[n]++));
    return freq;
}

// ============================
// 구간강제 변형 전략들
// ============================

// V1: 구간강제 + 간격 (기본)
function strategyRangeGapV1(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.8 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.5;
    }
    return selectFromRanges(scores);
}

// V2: 구간강제 + 간격 + 보너스
function strategyRangeGapBonus(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.8 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.5;
    }
    // 보너스 추가
    for (let i = Math.max(0, past.length - 5); i < past.length; i++) {
        scores[past[i].bonus] += 5 - (past.length - 1 - i);
    }
    return selectFromRanges(scores);
}

// V3: 구간에서 2개씩 선택 (총 10개에서 합계필터로 6개)
function strategyRange2Each(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.7 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.2;
        if (gapInfo[i].currentGap <= 3) scores[i] += 3;
    }

    const ranges = [[1,9], [10,19], [20,29], [30,39], [40,45]];
    const candidates = [];
    ranges.forEach(([min, max]) => {
        const rangeNums = [];
        for (let n = min; n <= max; n++) rangeNums.push({ n, score: scores[n] });
        rangeNums.sort((a, b) => b.score - a.score);
        candidates.push(...rangeNums.slice(0, 2).map(x => x.n));
    });

    // 합계 필터로 6개 선택
    let best = candidates.slice(0, 6);
    let bestScore = -1;
    for (let a = 0; a < 1000; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((s, n) => s + n, 0);
        if (sum >= 121 && sum <= 160) {
            const score = combo.reduce((s, n) => s + scores[n], 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }
    return best.sort((a, b) => a - b);
}

// V4: 구간 가중치 다르게 (중간 구간에 더 많이)
function strategyRangeWeighted(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.8 && ratio <= 2.0) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.5;
        if (gapInfo[i].currentGap <= 3) scores[i] += 4;
    }

    // 구간별 가중 선택: 1-9:1개, 10-19:2개, 20-29:1개, 30-39:1개, 40-45:1개
    const ranges = [[1,9,1], [10,19,2], [20,29,1], [30,39,1], [40,45,1]];
    const selected = [];
    ranges.forEach(([min, max, count]) => {
        const rangeNums = [];
        for (let n = min; n <= max; n++) rangeNums.push({ n, score: scores[n] });
        rangeNums.sort((a, b) => b.score - a.score);
        selected.push(...rangeNums.slice(0, count).map(x => x.n));
    });
    return selected.sort((a, b) => a - b);
}

// V5: 구간강제 + 합계조건부
function strategyRangeSumConditional(past) {
    const prevSum = past[past.length - 1].numbers.reduce((a, b) => a + b, 0);
    let targetMin, targetMax;
    if (prevSum < 120) { targetMin = 130; targetMax = 170; }
    else if (prevSum < 145) { targetMin = 120; targetMax = 160; }
    else { targetMin = 105; targetMax = 150; }

    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.8 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.5;
    }

    const ranges = [[1,9], [10,19], [20,29], [30,39], [40,45]];
    const candidates = [];
    ranges.forEach(([min, max]) => {
        const rangeNums = [];
        for (let n = min; n <= max; n++) rangeNums.push({ n, score: scores[n] });
        rangeNums.sort((a, b) => b.score - a.score);
        candidates.push(...rangeNums.slice(0, 3).map(x => x.n));
    });

    let best = candidates.slice(0, 6);
    let bestScore = -1;
    for (let a = 0; a < 1500; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((s, n) => s + n, 0);
        if (sum >= targetMin && sum <= targetMax) {
            const score = combo.reduce((s, n) => s + scores[n], 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }
    return best.sort((a, b) => a - b);
}

// V6: 구간강제 + 동반출현
function strategyRangeCompanion(past) {
    const gapInfo = getGapInfo(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.8 && ratio <= 2.5) ? ratio * 10 : 0;
    }

    // 동반출현 점수
    const lastNums = past[past.length - 1].numbers;
    for (let i = 0; i < past.length - 1; i++) {
        const overlap = past[i].numbers.filter(n => lastNums.includes(n));
        if (overlap.length >= 2) {
            past[i + 1].numbers.forEach(n => scores[n] += overlap.length * 2);
        }
    }

    return selectFromRanges(scores);
}

// V7: 최적화된 구간강제 (간격 + 핫 + 보너스 + 합계필터)
function strategyRangeOptimized(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 15);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio, currentGap } = gapInfo[i];
        // 간격 점수 (핵심)
        if (ratio >= 0.8 && ratio <= 2.5) scores[i] = ratio * 12;
        else scores[i] = 0;
        // 최근 출현 보너스
        if (currentGap <= 3) scores[i] += 5;
        // 핫 점수
        scores[i] += hot[i] * 2;
    }
    // 보너스 번호
    for (let i = Math.max(0, past.length - 3); i < past.length; i++) {
        scores[past[i].bonus] += 4;
    }

    const ranges = [[1,9], [10,19], [20,29], [30,39], [40,45]];
    const candidates = [];
    ranges.forEach(([min, max]) => {
        const rangeNums = [];
        for (let n = min; n <= max; n++) rangeNums.push({ n, score: scores[n] });
        rangeNums.sort((a, b) => b.score - a.score);
        candidates.push(...rangeNums.slice(0, 3).map(x => x.n));
    });

    let best = candidates.slice(0, 6);
    let bestScore = -1;
    for (let a = 0; a < 2000; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((s, n) => s + n, 0);
        const odds = combo.filter(n => n % 2 === 1).length;
        if (sum >= 115 && sum <= 165 && odds >= 2 && odds <= 4) {
            const score = combo.reduce((s, n) => s + scores[n], 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }
    return best.sort((a, b) => a - b);
}

// V8: 넓은 간격 + 구간강제 + 계절보정
function strategyRangeSeasonal(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const currentMonth = past[past.length - 1].month;
    const sameMonth = past.filter(r => r.month === currentMonth);
    const monthFreq = {};
    for (let i = 1; i <= 45; i++) monthFreq[i] = 0;
    sameMonth.forEach(r => r.numbers.forEach(n => monthFreq[n]++));
    const maxMF = Math.max(...Object.values(monthFreq)) || 1;

    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        scores[i] = (ratio >= 0.7 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.5;
        scores[i] += (monthFreq[i] / maxMF) * 5; // 계절 보정
    }

    return selectFromRanges(scores);
}

// V9: 간격 정밀 조정 (ratio 1.0~1.8에 최고점, 나머지 감쇠)
function strategyPreciseGap(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio, currentGap } = gapInfo[i];
        // 가우시안 형태의 점수: 1.3 근처가 최고점
        const dist = Math.abs(ratio - 1.3);
        scores[i] = dist < 1.0 ? (1.0 - dist) * 15 : 0;
        scores[i] += hot[i] * 1.5;
        if (currentGap <= 2) scores[i] += 3;
    }
    return selectFromRanges(scores);
}

// V10: 간격 + 이전2회 겹침 번호 배제
function strategyGapExcludeRecent(past) {
    const gapInfo = getGapInfo(past);
    const hot = getHotScores(past, 20);
    const recent2 = new Set();
    past.slice(-2).forEach(r => r.numbers.forEach(n => recent2.add(n)));

    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const { ratio } = gapInfo[i];
        if (recent2.has(i)) { scores[i] = 0; continue; } // 최근 2회 출현은 배제
        scores[i] = (ratio >= 1.0 && ratio <= 2.5) ? ratio * 10 : 0;
        scores[i] += hot[i] * 1.0;
    }
    return selectFromRanges(scores);
}

// V11: 메타 전략 (V1~V10의 결과에서 가장 많이 나온 번호)
function strategyMeta(past) {
    const subFns = [
        strategyRangeGapV1, strategyRangeGapBonus, strategyRange2Each,
        strategyRangeWeighted, strategyRangeSumConditional,
        strategyRangeCompanion, strategyRangeOptimized,
        strategyRangeSeasonal, strategyPreciseGap, strategyGapExcludeRecent
    ];

    const votes = {};
    for (let i = 1; i <= 45; i++) votes[i] = 0;
    subFns.forEach(fn => {
        try {
            fn(past).forEach(n => votes[n]++);
        } catch(e) {}
    });

    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// V12: 메타 + 합계필터
function strategyMetaFiltered(past) {
    const subFns = [
        strategyRangeGapV1, strategyRangeGapBonus, strategyRange2Each,
        strategyRangeWeighted, strategyRangeSumConditional,
        strategyRangeCompanion, strategyRangeOptimized,
        strategyRangeSeasonal, strategyPreciseGap, strategyGapExcludeRecent
    ];

    const votes = {};
    for (let i = 1; i <= 45; i++) votes[i] = 0;
    subFns.forEach(fn => {
        try {
            fn(past).forEach(n => votes[n]++);
        } catch(e) {}
    });

    const candidates = Object.entries(votes).sort((a, b) => b[1] - a[1])
        .slice(0, 12).map(e => parseInt(e[0]));

    let best = candidates.slice(0, 6);
    let bestScore = -1;
    for (let a = 0; a < 1500; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((s, n) => s + n, 0);
        if (sum >= 121 && sum <= 160) {
            const score = combo.reduce((s, n) => s + (votes[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }
    return best.sort((a, b) => a - b);
}

function selectFromRanges(scores) {
    const ranges = [[1,9], [10,19], [20,29], [30,39], [40,45]];
    const selected = [];
    ranges.forEach(([min, max]) => {
        let best = -1, bestScore = -1;
        for (let n = min; n <= max; n++) {
            if (scores[n] > bestScore) { bestScore = scores[n]; best = n; }
        }
        if (best > 0) selected.push(best);
    });
    // 6번째는 전체에서 최고점 (미선택)
    const remaining = Object.entries(scores)
        .filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);
    while (selected.length < 6 && remaining.length > 0) {
        selected.push(parseInt(remaining.shift()[0]));
    }
    return selected.sort((a, b) => a - b);
}

// ============================
// 백테스팅
// ============================
const strategies = [
    { name: '구간+간격(기본)', fn: strategyRangeGapV1 },
    { name: '구간+간격+보너스', fn: strategyRangeGapBonus },
    { name: '구간2개씩+합계', fn: strategyRange2Each },
    { name: '구간가중(10-19강조)', fn: strategyRangeWeighted },
    { name: '구간+합계조건부', fn: strategyRangeSumConditional },
    { name: '구간+동반출현', fn: strategyRangeCompanion },
    { name: '구간최적화(종합)', fn: strategyRangeOptimized },
    { name: '구간+계절보정', fn: strategyRangeSeasonal },
    { name: '정밀간격(1.3중심)', fn: strategyPreciseGap },
    { name: '간격+최근2회배제', fn: strategyGapExcludeRecent },
    { name: '메타전략(투표)', fn: strategyMeta },
    { name: '메타+합계필터', fn: strategyMetaFiltered },
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('순위 | 전략               | 평균적중 | 3+개 | 4+개 | 5+개 | 분포(0~6개)');
console.log('-'.repeat(95));

const results = [];
for (const strategy of strategies) {
    let totalMatch = 0, m3 = 0, m4 = 0, m5 = 0;
    const dist = [0,0,0,0,0,0,0];

    for (let i = startIdx; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        if (past.length < 50) continue;
        try {
            const predicted = strategy.fn(past);
            const actual = allResults[i].numbers;
            const matches = predicted.filter(n => actual.includes(n)).length;
            totalMatch += matches;
            if (matches < 7) dist[matches]++;
            if (matches >= 3) m3++;
            if (matches >= 4) m4++;
            if (matches >= 5) m5++;
        } catch (e) {}
    }

    const avg = (totalMatch / testRounds).toFixed(3);
    results.push({ name: strategy.name, avg: parseFloat(avg), m3, m4, m5, dist });
}

results.sort((a, b) => b.m3 === a.m3 ? b.avg - a.avg : b.m3 - a.m3);
results.forEach((r, idx) => {
    const distStr = r.dist.map((d, i) => `${i}:${d}`).join(' ');
    console.log(`${(idx+1).toString().padStart(2)}위 | ${r.name.padEnd(16)} | ${r.avg.toFixed(3).padStart(6)} | ${r.m3.toString().padStart(3)}회 | ${r.m4.toString().padStart(3)}회 | ${r.m5.toString().padStart(3)}회 | ${distStr}`);
});

// 최고 전략 1209회 추천
console.log('\n\n============================================');
console.log('1209회 추천 번호:');
const top3 = results.slice(0, 3);
top3.forEach(r => {
    const fn = strategies.find(s => s.name === r.name).fn;
    const pred = fn(allResults);
    console.log(`  ${r.name}: ${pred.join(', ')} (3+: ${r.m3}%, 평균 ${r.avg.toFixed(3)})`);
});
