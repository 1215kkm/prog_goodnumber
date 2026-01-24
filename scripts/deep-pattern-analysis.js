/**
 * 로또 심층 패턴 분석 스크립트
 * 계절별, 간격별, 연속 패턴, 후속 번호 등 다양한 패턴 탐색
 */

const fs = require('fs');
const path = require('path');

// 데이터 파싱
const content = fs.readFileSync(path.join(__dirname, '../LottoAnalyzer.Core/Services/LottoDataService.cs'), 'utf8');
const regex = /\((\d+),\s*new\s+DateTime\((\d+),\s*(\d+),\s*(\d+)\),\s*new\[\]\s*\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\},\s*(\d+)\)/g;

const allResults = [];
let match;
while ((match = regex.exec(content)) !== null) {
    allResults.push({
        round: parseInt(match[1]),
        date: new Date(parseInt(match[2]), parseInt(match[3]) - 1, parseInt(match[4])),
        month: parseInt(match[3]),
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}
allResults.sort((a, b) => a.round - b.round);
console.log(`총 ${allResults.length}개 회차 분석\n`);

// ============================
// 분석 1: 계절별 번호 크기 패턴
// ============================
console.log('=' .repeat(60));
console.log('📊 분석 1: 계절별 번호 크기 패턴');
console.log('=' .repeat(60));

const seasons = { '봄(3-5월)': [3,4,5], '여름(6-8월)': [6,7,8], '가을(9-11월)': [9,10,11], '겨울(12-2월)': [12,1,2] };
for (const [name, months] of Object.entries(seasons)) {
    const seasonResults = allResults.filter(r => months.includes(r.month));
    const allNums = seasonResults.flatMap(r => r.numbers);
    const avg = (allNums.reduce((a, b) => a + b, 0) / allNums.length).toFixed(1);
    const sum = seasonResults.map(r => r.numbers.reduce((a, b) => a + b, 0));
    const avgSum = (sum.reduce((a, b) => a + b, 0) / sum.length).toFixed(1);

    // 구간별 분포
    const ranges = [0, 0, 0, 0, 0];
    allNums.forEach(n => {
        if (n <= 9) ranges[0]++;
        else if (n <= 19) ranges[1]++;
        else if (n <= 29) ranges[2]++;
        else if (n <= 39) ranges[3]++;
        else ranges[4]++;
    });
    const total = allNums.length;
    const pct = ranges.map(r => (r / total * 100).toFixed(1));

    console.log(`\n${name} (${seasonResults.length}회)`);
    console.log(`  평균 번호: ${avg} | 평균 합계: ${avgSum}`);
    console.log(`  구간분포: 1-9(${pct[0]}%) 10-19(${pct[1]}%) 20-29(${pct[2]}%) 30-39(${pct[3]}%) 40-45(${pct[4]}%)`);
}

// ============================
// 분석 2: 월별 가장 많이 나온 번호 TOP5
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 2: 월별 핫넘버 TOP5');
console.log('=' .repeat(60));

for (let m = 1; m <= 12; m++) {
    const monthResults = allResults.filter(r => r.month === m);
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    monthResults.forEach(r => r.numbers.forEach(n => freq[n]++));
    const top5 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`${m.toString().padStart(2)}월 (${monthResults.length}회): ${top5.map(([n, c]) => `${n}(${c}회)`).join(', ')}`);
}

// ============================
// 분석 3: 각 번호의 평균 출현 간격
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 3: 번호별 평균 출현 간격 (상위/하위 10개)');
console.log('=' .repeat(60));

const numberGaps = {};
for (let i = 1; i <= 45; i++) {
    const appearances = [];
    allResults.forEach((r, idx) => { if (r.numbers.includes(i)) appearances.push(idx); });
    const gaps = [];
    for (let j = 1; j < appearances.length; j++) gaps.push(appearances[j] - appearances[j - 1]);
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const currentGap = allResults.length - 1 - (appearances.length > 0 ? appearances[appearances.length - 1] : 0);
    numberGaps[i] = { avgGap: avgGap.toFixed(1), currentGap, count: appearances.length, overdue: currentGap / avgGap };
}

console.log('\n자주 나오는 번호 (간격 짧은):');
Object.entries(numberGaps).sort((a, b) => a[1].avgGap - b[1].avgGap).slice(0, 10)
    .forEach(([n, g]) => console.log(`  ${n.toString().padStart(2)}번: 평균 ${g.avgGap}회 간격 | 현재 ${g.currentGap}회째 안나옴 | 총 ${g.count}회 출현`));

console.log('\n현재 가장 오래 안 나온 번호:');
Object.entries(numberGaps).sort((a, b) => b[1].currentGap - a[1].currentGap).slice(0, 10)
    .forEach(([n, g]) => console.log(`  ${n.toString().padStart(2)}번: ${g.currentGap}회째 미출현 (평균간격 ${g.avgGap}) → 초과율 ${g.overdue.toFixed(1)}배`));

// ============================
// 분석 4: 이전 번호 → 다음 번호 연관성
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 4: "A번이 나온 후 다음 회차에 자주 나오는 번호"');
console.log('=' .repeat(60));

// 최근 당첨번호 기준으로 분석
const lastResult = allResults[allResults.length - 1];
console.log(`\n현재 최신 당첨번호: ${lastResult.numbers.join(', ')} (${lastResult.round}회)`);

const followUp = {};
for (let i = 1; i <= 45; i++) followUp[i] = 0;

for (let i = 0; i < allResults.length - 1; i++) {
    const current = allResults[i].numbers;
    const overlap = current.filter(n => lastResult.numbers.includes(n));
    if (overlap.length >= 2) {
        allResults[i + 1].numbers.forEach(n => followUp[n] += overlap.length);
    }
}

console.log('\n현재 번호 조합과 유사했던 과거 → 다음 회차 빈출 번호:');
Object.entries(followUp).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([n, s], idx) => console.log(`  ${idx + 1}. ${n}번 (연관점수: ${s})`));

// ============================
// 분석 5: 홀짝 비율별 적중 패턴
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 5: 홀짝 비율 분포');
console.log('=' .repeat(60));

const oddEvenDist = {};
allResults.forEach(r => {
    const odds = r.numbers.filter(n => n % 2 === 1).length;
    const key = `홀${odds}:짝${6 - odds}`;
    oddEvenDist[key] = (oddEvenDist[key] || 0) + 1;
});
Object.entries(oddEvenDist).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k} → ${v}회 (${(v / allResults.length * 100).toFixed(1)}%)`));

// ============================
// 분석 6: 합계 범위 분석
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 6: 당첨번호 합계 범위');
console.log('=' .repeat(60));

const sums = allResults.map(r => r.numbers.reduce((a, b) => a + b, 0));
sums.sort((a, b) => a - b);
console.log(`  최소: ${sums[0]} | 최대: ${sums[sums.length - 1]}`);
console.log(`  평균: ${(sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1)}`);
console.log(`  25%: ${sums[Math.floor(sums.length * 0.25)]} | 50%: ${sums[Math.floor(sums.length * 0.5)]} | 75%: ${sums[Math.floor(sums.length * 0.75)]}`);

const sumRanges = { '~80': 0, '81-100': 0, '101-120': 0, '121-140': 0, '141-160': 0, '161-180': 0, '181~': 0 };
allResults.forEach(r => {
    const s = r.numbers.reduce((a, b) => a + b, 0);
    if (s <= 80) sumRanges['~80']++;
    else if (s <= 100) sumRanges['81-100']++;
    else if (s <= 120) sumRanges['101-120']++;
    else if (s <= 140) sumRanges['121-140']++;
    else if (s <= 160) sumRanges['141-160']++;
    else if (s <= 180) sumRanges['161-180']++;
    else sumRanges['181~']++;
});
console.log('\n합계 구간별 분포:');
Object.entries(sumRanges).forEach(([k, v]) => {
    const bar = '█'.repeat(Math.round(v / allResults.length * 50));
    console.log(`  ${k.padStart(7)}: ${v.toString().padStart(3)}회 (${(v / allResults.length * 100).toFixed(1)}%) ${bar}`);
});

// ============================
// 분석 7: 연속번호 출현 패턴
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 7: 연속번호 패턴 (ex: 5,6 또는 23,24,25)');
console.log('=' .repeat(60));

let noConsec = 0, has2consec = 0, has3consec = 0;
allResults.forEach(r => {
    const sorted = [...r.numbers].sort((a, b) => a - b);
    let maxConsec = 1, curr = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) { curr++; maxConsec = Math.max(maxConsec, curr); }
        else curr = 1;
    }
    if (maxConsec >= 3) has3consec++;
    else if (maxConsec >= 2) has2consec++;
    else noConsec++;
});
console.log(`  연속 없음: ${noConsec}회 (${(noConsec / allResults.length * 100).toFixed(1)}%)`);
console.log(`  2연속 포함: ${has2consec}회 (${(has2consec / allResults.length * 100).toFixed(1)}%)`);
console.log(`  3연속 이상: ${has3consec}회 (${(has3consec / allResults.length * 100).toFixed(1)}%)`);

// ============================
// 분석 8: 끝자리 분포
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 8: 끝자리(일의 자리) 분포');
console.log('=' .repeat(60));

const lastDigit = {};
for (let d = 0; d <= 9; d++) lastDigit[d] = 0;
allResults.forEach(r => r.numbers.forEach(n => lastDigit[n % 10]++));
const totalNums = allResults.length * 6;
Object.entries(lastDigit).sort((a, b) => b[1] - a[1])
    .forEach(([d, c]) => {
        const bar = '█'.repeat(Math.round(c / totalNums * 80));
        console.log(`  끝자리 ${d}: ${c}회 (${(c / totalNums * 100).toFixed(1)}%) ${bar}`);
    });

// ============================
// 분석 9: 이전 회차 번호 반복 출현율
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 9: 이전 회차 번호가 다음에 또 나올 확률');
console.log('=' .repeat(60));

const repeatCounts = [0, 0, 0, 0, 0, 0, 0];
for (let i = 1; i < allResults.length; i++) {
    const prev = allResults[i - 1].numbers;
    const curr = allResults[i].numbers;
    const repeats = curr.filter(n => prev.includes(n)).length;
    repeatCounts[repeats]++;
}
repeatCounts.forEach((c, idx) => {
    console.log(`  ${idx}개 반복: ${c}회 (${(c / (allResults.length - 1) * 100).toFixed(1)}%)`);
});

// ============================
// 분석 10: 계절별 전략 백테스팅
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 10: 새 전략 백테스팅 (최근 100회)');
console.log('=' .repeat(60));

function strategySeasonalHot(pastResults) {
    const currentMonth = pastResults[pastResults.length - 1].date.getMonth() + 1;
    const sameMonthResults = pastResults.filter(r => r.date.getMonth() + 1 === currentMonth);
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    sameMonthResults.forEach(r => r.numbers.forEach(n => freq[n]++));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(e => parseInt(e[0])).sort((a, b) => a - b);
}

function strategyRepeatPrevious(pastResults) {
    // 이전 번호 중 일부 + 핫넘버 혼합
    const prev = pastResults[pastResults.length - 1].numbers;
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-20).forEach(r => r.numbers.forEach(n => freq[n]++));

    // 이전 번호 중 빈도 높은 2개
    const prevHot = prev.sort((a, b) => freq[b] - freq[a]).slice(0, 2);
    // 나머지 4개는 핫넘버에서
    const rest = Object.entries(freq)
        .filter(([k]) => !prevHot.includes(parseInt(k)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(e => parseInt(e[0]));
    return [...prevHot, ...rest].sort((a, b) => a - b);
}

function strategyLastDigitBalance(pastResults) {
    // 끝자리가 다양하게 분포되도록
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-20).forEach(r => r.numbers.forEach(n => freq[n]++));

    const selected = [];
    const usedDigits = new Set();
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

    for (const [n] of sorted) {
        const digit = parseInt(n) % 10;
        if (!usedDigits.has(digit) || usedDigits.size >= 6) {
            selected.push(parseInt(n));
            usedDigits.add(digit);
            if (selected.length >= 6) break;
        }
    }
    return selected.sort((a, b) => a - b);
}

function strategySumOptimized(pastResults) {
    // 합계가 100-160 범위에 들도록 최적화
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-30).forEach(r => r.numbers.forEach(n => freq[n]++));

    const candidates = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => parseInt(e[0]));

    // 합계 100-160 조합 찾기
    let bestCombo = candidates.slice(0, 6);
    let bestDiff = Math.abs(bestCombo.reduce((a, b) => a + b, 0) - 130);

    for (let attempt = 0; attempt < 200; attempt++) {
        const combo = [];
        const pool = [...candidates];
        while (combo.length < 6 && pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            combo.push(pool.splice(idx, 1)[0]);
        }
        const sum = combo.reduce((a, b) => a + b, 0);
        if (sum >= 100 && sum <= 160) {
            const diff = Math.abs(sum - 130);
            if (diff < bestDiff) { bestDiff = diff; bestCombo = combo; }
        }
    }
    return bestCombo.sort((a, b) => a - b);
}

function strategyGapPattern(pastResults) {
    // 각 번호의 출현 간격 패턴으로 다음 출현 예측
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    for (let num = 1; num <= 45; num++) {
        const appearances = [];
        pastResults.forEach((r, idx) => { if (r.numbers.includes(num)) appearances.push(idx); });
        if (appearances.length < 3) continue;

        const gaps = [];
        for (let j = 1; j < appearances.length; j++) gaps.push(appearances[j] - appearances[j - 1]);

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const currentGap = pastResults.length - appearances[appearances.length - 1];

        // 평균 간격의 1.0~2.0배 사이면 높은 점수
        if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0) {
            scores[num] = (currentGap / avgGap) * 10;
        }
        // 최근에 나온 번호도 약간의 점수 (반복 패턴)
        if (currentGap <= 3) {
            scores[num] += 3;
        }
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

function strategyFollowUp(pastResults) {
    // 현재 번호와 동일한 번호가 있던 과거 → 그 다음 회차 번호 분석
    const lastNums = pastResults[pastResults.length - 1].numbers;
    const followScores = {};
    for (let i = 1; i <= 45; i++) followScores[i] = 0;

    for (let i = 0; i < pastResults.length - 1; i++) {
        const overlap = pastResults[i].numbers.filter(n => lastNums.includes(n));
        if (overlap.length >= 1) {
            pastResults[i + 1].numbers.forEach(n => followScores[n] += overlap.length);
        }
    }
    lastNums.forEach(n => followScores[n] *= 0.5); // 현재 번호 가중치 낮춤

    return Object.entries(followScores).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

const newStrategies = [
    { name: '계절별 핫넘버', fn: strategySeasonalHot },
    { name: '이전번호 반복+핫', fn: strategyRepeatPrevious },
    { name: '끝자리 다양화', fn: strategyLastDigitBalance },
    { name: '합계 최적화(100-160)', fn: strategySumOptimized },
    { name: '간격패턴 예측', fn: strategyGapPattern },
    { name: '후속번호 분석', fn: strategyFollowUp },
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('\n순위 | 전략                  | 평균적중 | 3+개 | 보너스 | 분포(0-6개)');
console.log('-'.repeat(90));

const newResults = [];
for (const strategy of newStrategies) {
    let totalMatch = 0, totalBonus = 0, match3plus = 0;
    const dist = [0, 0, 0, 0, 0, 0, 0];

    for (let i = startIdx; i < allResults.length; i++) {
        const pastResults = allResults.slice(0, i);
        if (pastResults.length < 50) continue;
        const predicted = strategy.fn(pastResults);
        const actual = allResults[i];
        const matchCount = predicted.filter(n => actual.numbers.includes(n)).length;
        totalMatch += matchCount;
        if (predicted.includes(actual.bonus)) totalBonus++;
        if (matchCount >= 3) match3plus++;
        dist[matchCount]++;
    }

    const avgMatch = (totalMatch / testRounds).toFixed(3);
    newResults.push({ name: strategy.name, avgMatch: parseFloat(avgMatch), match3plus, bonus: totalBonus, dist });
}

newResults.sort((a, b) => b.avgMatch - a.avgMatch);
newResults.forEach((r, idx) => {
    const d = r.dist.map(v => v.toString().padStart(2)).join(' ');
    console.log(`${(idx + 1).toString().padStart(2)}위 | ${r.name.padEnd(18)} | ${r.avgMatch.toFixed(3)}  | ${r.match3plus.toString().padStart(2)}회 | ${r.bonus.toString().padStart(3)}회 | [${d}]`);
});

// 최종 종합
console.log('\n\n' + '=' .repeat(60));
console.log('🏆 종합 결론: 가장 유효한 패턴');
console.log('=' .repeat(60));
console.log('\n기준: 완전 랜덤 = 평균 0.800개 적중\n');
console.log('기존 1위: 주기초과 (0.950) - "안나온 번호가 곧 나온다"');
console.log('기존 2위: 복합 최적화 (0.930) - "핫+주기+동반 혼합"');
newResults.forEach((r, idx) => {
    const vs = r.avgMatch > 0.8 ? `+${((r.avgMatch - 0.8) / 0.8 * 100).toFixed(0)}%` : `${((r.avgMatch - 0.8) / 0.8 * 100).toFixed(0)}%`;
    console.log(`신규 ${idx + 1}위: ${r.name} (${r.avgMatch.toFixed(3)}) - 랜덤 대비 ${vs}`);
});
