/**
 * 로또 패턴 백테스팅 스크립트
 * 다양한 추천 전략을 과거 데이터에 적용해서 적중률을 비교합니다.
 */

const fs = require('fs');
const path = require('path');

// 데이터 파일 파싱
const content = fs.readFileSync(path.join(__dirname, '../LottoAnalyzer.Core/Services/LottoDataService.cs'), 'utf8');
const regex = /\((\d+),\s*new\s+DateTime\((\d+),\s*(\d+),\s*(\d+)\),\s*new\[\]\s*\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\},\s*(\d+)\)/g;

const allResults = [];
let match;
while ((match = regex.exec(content)) !== null) {
    allResults.push({
        round: parseInt(match[1]),
        date: new Date(parseInt(match[2]), parseInt(match[3]) - 1, parseInt(match[4])),
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}

allResults.sort((a, b) => a.round - b.round);
console.log(`총 ${allResults.length}개 회차 데이터 로드\n`);

// === 전략 함수들 ===

/**
 * 전략 1: 핫넘버 Top6 (최근 N회 빈출)
 */
function strategyHotNumbers(pastResults, windowSize) {
    const recent = pastResults.slice(-windowSize);
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    recent.forEach(r => r.numbers.forEach(n => freq[n]++));
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => parseInt(e[0]))
        .sort((a, b) => a - b);
}

/**
 * 전략 2: 주기 초과 번호 (평균 간격 * 배수 초과한 번호)
 */
function strategyOverdue(pastResults, multiplier) {
    const lastSeen = {};
    const gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = -999; gaps[i] = []; }

    pastResults.forEach((r, idx) => {
        r.numbers.forEach(n => {
            if (lastSeen[n] >= 0) gaps[n].push(idx - lastSeen[n]);
            lastSeen[n] = idx;
        });
    });

    const currentRound = pastResults.length;
    const scores = [];
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 10;
        const currentGap = currentRound - lastSeen[i];
        const overdueRatio = currentGap / avgGap;
        if (overdueRatio >= multiplier) {
            scores.push({ num: i, ratio: overdueRatio });
        }
    }

    scores.sort((a, b) => b.ratio - a.ratio);
    if (scores.length < 6) {
        // 부족하면 빈도순으로 채우기
        const freq = {};
        for (let i = 1; i <= 45; i++) freq[i] = 0;
        pastResults.slice(-30).forEach(r => r.numbers.forEach(n => freq[n]++));
        const existing = new Set(scores.map(s => s.num));
        const extras = Object.entries(freq)
            .filter(([k]) => !existing.has(parseInt(k)))
            .sort((a, b) => b[1] - a[1]);
        while (scores.length < 6 && extras.length > 0) {
            scores.push({ num: parseInt(extras.shift()[0]), ratio: 0 });
        }
    }
    return scores.slice(0, 6).map(s => s.num).sort((a, b) => a - b);
}

/**
 * 전략 3: 가중 핫넘버 (최근 회차일수록 높은 가중치)
 */
function strategyWeightedHot(pastResults, decayFactor) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    const len = pastResults.length;
    pastResults.forEach((r, idx) => {
        const weight = Math.pow(decayFactor, len - 1 - idx);
        r.numbers.forEach(n => scores[n] += weight);
    });

    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => parseInt(e[0]))
        .sort((a, b) => a - b);
}

/**
 * 전략 4: 동반 출현 (최근 당첨번호와 함께 자주 나온 번호)
 */
function strategyCompanion(pastResults) {
    const lastResult = pastResults[pastResults.length - 1];
    const companion = {};
    for (let i = 1; i <= 45; i++) companion[i] = 0;

    for (let i = 0; i < pastResults.length - 1; i++) {
        const current = pastResults[i].numbers;
        const next = pastResults[i + 1].numbers;
        // current에 있는 번호가 lastResult에도 있으면, next의 번호에 점수
        const overlap = current.filter(n => lastResult.numbers.includes(n));
        if (overlap.length > 0) {
            next.forEach(n => companion[n] += overlap.length);
        }
    }

    // 최근 당첨번호 자체는 제외
    lastResult.numbers.forEach(n => companion[n] = 0);

    return Object.entries(companion)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => parseInt(e[0]))
        .sort((a, b) => a - b);
}

/**
 * 전략 5: 핫+주기 혼합 (핫 3개 + 주기초과 3개)
 */
function strategyHybridHotOverdue(pastResults) {
    const hot = strategyHotNumbers(pastResults, 20);
    const overdue = strategyOverdue(pastResults, 1.3);

    const selected = new Set();
    // 핫 3개
    for (const n of hot) { if (selected.size < 3) selected.add(n); }
    // 주기초과 3개 (핫과 겹치지 않는것)
    for (const n of overdue) { if (selected.size < 6 && !selected.has(n)) selected.add(n); }
    // 부족하면 핫에서 추가
    for (const n of hot) { if (selected.size < 6) selected.add(n); }

    return [...selected].sort((a, b) => a - b);
}

/**
 * 전략 6: 밸런스 최적화 (구간분포 + 홀짝 + 합계범위)
 */
function strategyBalanced(pastResults) {
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-30).forEach(r => r.numbers.forEach(n => freq[n]++));

    // 구간별로 상위 번호 선택
    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
    const candidates = [];

    ranges.forEach(([min, max]) => {
        const rangeNums = Object.entries(freq)
            .filter(([k]) => parseInt(k) >= min && parseInt(k) <= max)
            .sort((a, b) => b[1] - a[1]);
        if (rangeNums.length > 0) candidates.push(parseInt(rangeNums[0][0]));
        if (rangeNums.length > 1) candidates.push(parseInt(rangeNums[1][0]));
    });

    // 합계 100-175 범위 내에서 6개 선택
    // 빈도순으로 정렬 후 6개 선택
    const selected = candidates
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, 6)
        .sort((a, b) => a - b);

    return selected;
}

/**
 * 전략 7: 연속 출현 추적 (2회 이상 연속 나온 번호 우선)
 */
function strategyConsecutiveAppear(pastResults) {
    const last3 = pastResults.slice(-3);
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    last3.forEach(r => r.numbers.forEach(n => freq[n]++));

    // 2회 이상 나온 번호
    const repeating = Object.entries(freq)
        .filter(([, v]) => v >= 2)
        .map(([k]) => parseInt(k));

    // 부족하면 최근 30회 핫넘버로 채우기
    const hotFreq = {};
    for (let i = 1; i <= 45; i++) hotFreq[i] = 0;
    pastResults.slice(-30).forEach(r => r.numbers.forEach(n => hotFreq[n]++));

    const selected = [...repeating];
    const extras = Object.entries(hotFreq)
        .filter(([k]) => !selected.includes(parseInt(k)))
        .sort((a, b) => b[1] - a[1]);

    while (selected.length < 6 && extras.length > 0) {
        selected.push(parseInt(extras.shift()[0]));
    }

    return selected.slice(0, 6).sort((a, b) => a - b);
}

/**
 * 전략 8: 이전 회차 번호 ±3 범위 (인접 번호 패턴)
 */
function strategyAdjacent(pastResults) {
    const lastNums = pastResults[pastResults.length - 1].numbers;
    const candidates = new Set();

    lastNums.forEach(n => {
        for (let d = -3; d <= 3; d++) {
            const adj = n + d;
            if (adj >= 1 && adj <= 45 && !lastNums.includes(adj)) {
                candidates.add(adj);
            }
        }
    });

    // 빈도순 정렬
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-30).forEach(r => r.numbers.forEach(n => freq[n]++));

    return [...candidates]
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, 6)
        .sort((a, b) => a - b);
}

/**
 * 전략 9: 복합 최적화 (핫50% + 주기30% + 동반20%)
 */
function strategyComposite(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 핫넘버 점수 (50%)
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-20).forEach(r => r.numbers.forEach(n => freq[n]++));
    const maxFreq = Math.max(...Object.values(freq));
    for (let i = 1; i <= 45; i++) scores[i] += (freq[i] / maxFreq) * 50;

    // 주기 점수 (30%)
    const lastSeen = {};
    const gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    pastResults.forEach((r, idx) => {
        r.numbers.forEach(n => {
            if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
            lastSeen[n] = idx;
        });
    });
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
        const currentGap = pastResults.length - lastSeen[i];
        const ratio = currentGap / avgGap;
        if (ratio >= 1.0 && ratio <= 2.5) scores[i] += ratio * 12;
    }

    // 동반 출현 점수 (20%)
    const lastResult = pastResults[pastResults.length - 1];
    for (let i = 0; i < pastResults.length - 1; i++) {
        const overlap = pastResults[i].numbers.filter(n => lastResult.numbers.includes(n));
        if (overlap.length >= 2) {
            pastResults[i + 1].numbers.forEach(n => scores[n] += 2);
        }
    }

    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => parseInt(e[0]))
        .sort((a, b) => a - b);
}

/**
 * 전략 10: 최적 가중 복합 (핫30% + 가중핫30% + 주기20% + 연속출현20%)
 */
function strategyOptimalComposite(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 핫넘버 점수 (최근 10회)
    const freq10 = {};
    for (let i = 1; i <= 45; i++) freq10[i] = 0;
    pastResults.slice(-10).forEach(r => r.numbers.forEach(n => freq10[n]++));
    for (let i = 1; i <= 45; i++) scores[i] += freq10[i] * 5;

    // 가중 핫 (최근일수록 높은 점수)
    const len = Math.min(30, pastResults.length);
    for (let idx = pastResults.length - len; idx < pastResults.length; idx++) {
        const weight = (idx - (pastResults.length - len) + 1) / len;
        pastResults[idx].numbers.forEach(n => scores[n] += weight * 3);
    }

    // 주기 점수
    const lastSeen = {};
    const gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    pastResults.forEach((r, idx) => {
        r.numbers.forEach(n => {
            if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
            lastSeen[n] = idx;
        });
    });
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
        const currentGap = pastResults.length - lastSeen[i];
        if (currentGap >= avgGap * 1.2 && currentGap <= avgGap * 2.0) scores[i] += 8;
    }

    // 연속 출현 보너스
    const last2 = pastResults.slice(-2);
    const repeatNums = {};
    last2.forEach(r => r.numbers.forEach(n => { repeatNums[n] = (repeatNums[n] || 0) + 1; }));
    for (const [n, count] of Object.entries(repeatNums)) {
        if (count >= 2) scores[parseInt(n)] += 10;
    }

    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => parseInt(e[0]))
        .sort((a, b) => a - b);
}

// === 백테스팅 실행 ===

const strategies = [
    { name: '핫넘버 Top6 (10회)', fn: (past) => strategyHotNumbers(past, 10) },
    { name: '핫넘버 Top6 (20회)', fn: (past) => strategyHotNumbers(past, 20) },
    { name: '핫넘버 Top6 (30회)', fn: (past) => strategyHotNumbers(past, 30) },
    { name: '핫넘버 Top6 (5회)', fn: (past) => strategyHotNumbers(past, 5) },
    { name: '주기초과 (1.3배)', fn: (past) => strategyOverdue(past, 1.3) },
    { name: '주기초과 (1.5배)', fn: (past) => strategyOverdue(past, 1.5) },
    { name: '가중핫 (decay=1.02)', fn: (past) => strategyWeightedHot(past, 1.02) },
    { name: '가중핫 (decay=1.05)', fn: (past) => strategyWeightedHot(past, 1.05) },
    { name: '가중핫 (decay=1.1)', fn: (past) => strategyWeightedHot(past, 1.1) },
    { name: '동반출현', fn: strategyCompanion },
    { name: '핫+주기 혼합', fn: strategyHybridHotOverdue },
    { name: '밸런스 최적화', fn: strategyBalanced },
    { name: '연속출현 추적', fn: strategyConsecutiveAppear },
    { name: '인접번호 (±3)', fn: strategyAdjacent },
    { name: '복합 최적화', fn: strategyComposite },
    { name: '최적 가중 복합', fn: strategyOptimalComposite },
];

console.log('=== 백테스팅 결과 (최근 100회차 기준) ===\n');

const testRounds = 100;
const startIdx = allResults.length - testRounds;
const results = [];

for (const strategy of strategies) {
    let totalMatch = 0;
    let totalBonus = 0;
    let match3plus = 0;
    let match4plus = 0;
    let match5plus = 0;
    let matchDistribution = [0, 0, 0, 0, 0, 0, 0]; // 0~6개 적중

    for (let i = startIdx; i < allResults.length; i++) {
        const pastResults = allResults.slice(0, i);
        if (pastResults.length < 50) continue;

        const predicted = strategy.fn(pastResults);
        const actual = allResults[i];

        const matchCount = predicted.filter(n => actual.numbers.includes(n)).length;
        const bonusMatch = predicted.includes(actual.bonus);

        totalMatch += matchCount;
        if (bonusMatch) totalBonus++;
        if (matchCount >= 3) match3plus++;
        if (matchCount >= 4) match4plus++;
        if (matchCount >= 5) match5plus++;
        matchDistribution[matchCount]++;
    }

    const avgMatch = (totalMatch / testRounds).toFixed(3);
    results.push({
        name: strategy.name,
        avgMatch: parseFloat(avgMatch),
        totalMatch,
        bonus: totalBonus,
        match3plus,
        match4plus,
        match5plus,
        distribution: matchDistribution
    });
}

// 평균 적중 높은 순 정렬
results.sort((a, b) => b.avgMatch - a.avgMatch);

console.log('순위 | 전략                      | 평균적중 | 3+개 | 4+개 | 5+개 | 보너스 | 분포(0-6개)');
console.log('-'.repeat(110));

results.forEach((r, idx) => {
    const dist = r.distribution.map(d => d.toString().padStart(2)).join(' ');
    console.log(
        `${(idx + 1).toString().padStart(2)}위 | ${r.name.padEnd(22)} | ${r.avgMatch.toFixed(3)}  | ${r.match3plus.toString().padStart(3)}회 | ${r.match4plus.toString().padStart(2)}회 | ${r.match5plus.toString().padStart(2)}회 | ${r.bonus.toString().padStart(3)}회 | [${dist}]`
    );
});

console.log('\n\n=== 상위 5개 전략의 다음 회차 추천번호 ===\n');

const topStrategies = results.slice(0, 5);
topStrategies.forEach((r, idx) => {
    const strategy = strategies.find(s => s.name === r.name);
    const predicted = strategy.fn(allResults);
    console.log(`${idx + 1}. ${r.name} (평균 ${r.avgMatch}개 적중)`);
    console.log(`   추천번호: ${predicted.join(', ')}`);
    console.log('');
});

// 랜덤 대비 비교
console.log('\n=== 참고: 랜덤 확률 ===');
console.log('6개 중 6개 적중: 1/8,145,060');
console.log('6개 중 3개 적중 확률: 약 2.3%');
console.log('완전 랜덤 6개 선택 시 평균 적중: 0.800개');
