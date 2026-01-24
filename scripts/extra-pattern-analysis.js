/**
 * 추가 패턴 분석: 날짜, 클러스터, 미러번호, 합계 트렌드 등
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
// 분석 A: 날짜 숫자와 당첨번호 관계
// ============================
console.log('=' .repeat(60));
console.log('📊 분석 A: 추첨일 날짜와 당첨번호 관계');
console.log('=' .repeat(60));

// 추첨일(일) 숫자가 당첨번호에 포함된 비율
let dayInNumbers = 0;
let monthInNumbers = 0;
let dayPlusMonthIn = 0;
allResults.forEach(r => {
    if (r.day <= 45 && r.numbers.includes(r.day)) dayInNumbers++;
    if (r.numbers.includes(r.month)) monthInNumbers++;
    const sum = r.day + r.month;
    if (sum <= 45 && r.numbers.includes(sum)) dayPlusMonthIn++;
});
console.log(`\n  추첨일(일)이 당첨번호에 포함: ${dayInNumbers}/${allResults.length}회 (${(dayInNumbers/allResults.length*100).toFixed(1)}%) - 기대확률 13.3%`);
console.log(`  추첨월이 당첨번호에 포함: ${monthInNumbers}/${allResults.length}회 (${(monthInNumbers/allResults.length*100).toFixed(1)}%) - 기대확률 13.3%`);
console.log(`  일+월 합이 당첨번호에 포함: ${dayPlusMonthIn}/${allResults.length}회 (${(dayPlusMonthIn/allResults.length*100).toFixed(1)}%) - 기대확률 13.3%`);

// 회차 끝자리와 당첨번호
let roundDigitIn = 0;
allResults.forEach(r => {
    const lastDigit = r.round % 10;
    if (lastDigit >= 1 && r.numbers.includes(lastDigit)) roundDigitIn++;
    const last2 = r.round % 45;
    if (last2 >= 1 && r.numbers.includes(last2)) roundDigitIn++;
});

// ============================
// 분석 B: 2~3회 전 번호 재출현
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 B: N회 전 번호가 다시 나오는 빈도');
console.log('=' .repeat(60));

for (let gap = 1; gap <= 5; gap++) {
    let totalRepeat = 0, count = 0;
    for (let i = gap; i < allResults.length; i++) {
        const prev = allResults[i - gap].numbers;
        const curr = allResults[i].numbers;
        totalRepeat += curr.filter(n => prev.includes(n)).length;
        count++;
    }
    const avg = (totalRepeat / count).toFixed(3);
    console.log(`  ${gap}회 전 번호 재출현: 평균 ${avg}개 (기대값 0.800)`);
}

// ============================
// 분석 C: 보너스 번호의 다음 출현
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 C: 보너스 번호가 다음 N회 안에 당첨번호로 나올 확률');
console.log('=' .repeat(60));

for (let within = 1; within <= 5; within++) {
    let bonusAppeared = 0;
    for (let i = 0; i < allResults.length - within; i++) {
        const bonus = allResults[i].bonus;
        for (let j = 1; j <= within; j++) {
            if (allResults[i + j].numbers.includes(bonus)) { bonusAppeared++; break; }
        }
    }
    const rate = (bonusAppeared / (allResults.length - within) * 100).toFixed(1);
    console.log(`  보너스 → ${within}회 내 당첨번호 출현: ${bonusAppeared}회 (${rate}%)`);
}

// ============================
// 분석 D: 번호 클러스터 (2~3회 연속 묶어서 패턴)
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 D: 3회 연속 세트에서 자주 나오는 번호 조합');
console.log('=' .repeat(60));

const pairFreq = {};
for (let i = 0; i < allResults.length - 2; i++) {
    const threeRounds = [...allResults[i].numbers, ...allResults[i+1].numbers, ...allResults[i+2].numbers];
    const unique = [...new Set(threeRounds)];
    // 3회 연속 모두 나온 번호
    for (const n of unique) {
        if (allResults[i].numbers.includes(n) && allResults[i+1].numbers.includes(n) && allResults[i+2].numbers.includes(n)) {
            pairFreq[n] = (pairFreq[n] || 0) + 1;
        }
    }
}
console.log('\n3회 연속 출현한 번호 (빈도순):');
Object.entries(pairFreq).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([n, c]) => console.log(`  ${n.toString().padStart(2)}번: ${c}회 연속출현`));

// ============================
// 분석 E: 합계 트렌드 (상승/하락 후 패턴)
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 E: 합계 트렌드 - 합계가 낮으면 다음엔?');
console.log('=' .repeat(60));

let lowThenUp = 0, lowThenDown = 0, highThenUp = 0, highThenDown = 0;
for (let i = 1; i < allResults.length; i++) {
    const prevSum = allResults[i-1].numbers.reduce((a,b) => a+b, 0);
    const currSum = allResults[i].numbers.reduce((a,b) => a+b, 0);
    if (prevSum < 130) {
        if (currSum > prevSum) lowThenUp++; else lowThenDown++;
    } else {
        if (currSum > prevSum) highThenUp++; else highThenDown++;
    }
}
console.log(`  합계 낮음(~130) → 다음 상승: ${lowThenUp}회 (${(lowThenUp/(lowThenUp+lowThenDown)*100).toFixed(1)}%)`);
console.log(`  합계 낮음(~130) → 다음 하락: ${lowThenDown}회 (${(lowThenDown/(lowThenUp+lowThenDown)*100).toFixed(1)}%)`);
console.log(`  합계 높음(130~) → 다음 상승: ${highThenUp}회 (${(highThenUp/(highThenUp+highThenDown)*100).toFixed(1)}%)`);
console.log(`  합계 높음(130~) → 다음 하락: ${highThenDown}회 (${(highThenDown/(highThenUp+highThenDown)*100).toFixed(1)}%)`);

// ============================
// 분석 F: 미러 번호 (12→21, 13→31 등)
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 F: 미러 번호 (12가 나오면 21이 다음에 나올까?)');
console.log('=' .repeat(60));

let mirrorHit = 0, mirrorTotal = 0;
for (let i = 0; i < allResults.length - 1; i++) {
    for (const n of allResults[i].numbers) {
        if (n >= 10 && n <= 45) {
            const mirror = parseInt(n.toString().split('').reverse().join(''));
            if (mirror >= 1 && mirror <= 45 && mirror !== n) {
                mirrorTotal++;
                if (allResults[i+1].numbers.includes(mirror)) mirrorHit++;
            }
        }
    }
}
console.log(`  미러번호 다음 회차 출현: ${mirrorHit}/${mirrorTotal} (${(mirrorHit/mirrorTotal*100).toFixed(1)}%) - 기대확률 13.3%`);

// ============================
// 분석 G: 구간 로테이션 (어떤 구간이 빈번히 나올 차례인가)
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('📊 분석 G: 구간별 연속 미출현 후 출현 확률');
console.log('=' .repeat(60));

const rangeNames = ['1-9', '10-19', '20-29', '30-39', '40-45'];
const rangeBounds = [[1,9], [10,19], [20,29], [30,39], [40,45]];

rangeBounds.forEach(([min, max], ri) => {
    let gapCounts = {};
    let lastAppear = -1;
    for (let i = 0; i < allResults.length; i++) {
        const hasRange = allResults[i].numbers.some(n => n >= min && n <= max);
        if (hasRange) {
            if (lastAppear >= 0) {
                const gap = i - lastAppear;
                gapCounts[gap] = (gapCounts[gap] || 0) + 1;
            }
            lastAppear = i;
        }
    }
    const totalGaps = Object.values(gapCounts).reduce((a,b) => a+b, 0);
    const avgGap = Object.entries(gapCounts).reduce((sum, [g, c]) => sum + parseInt(g) * c, 0) / totalGaps;
    const missRate = allResults.filter(r => !r.numbers.some(n => n >= min && n <= max)).length;
    console.log(`  ${rangeNames[ri]}: 평균 ${avgGap.toFixed(2)}회마다 출현 | 미출현 ${missRate}/${allResults.length}회 (${(missRate/allResults.length*100).toFixed(1)}%)`);
});

// ============================
// 백테스팅: 새 전략들
// ============================
console.log('\n\n' + '=' .repeat(60));
console.log('🧪 새 전략 백테스팅 (최근 100회)');
console.log('=' .repeat(60));

// 전략: 보너스 번호 활용
function strategyBonusFollow(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 최근 보너스 번호 자체에 높은 점수
    for (let i = Math.max(0, pastResults.length - 5); i < pastResults.length; i++) {
        scores[pastResults[i].bonus] += 5 - (pastResults.length - 1 - i);
    }

    // 간격패턴도 결합
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
        if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0) {
            scores[i] += (currentGap / avgGap) * 8;
        }
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// 전략: 날짜 기반 (추첨일 숫자 포함)
function strategyDateBased(pastResults) {
    const last = pastResults[pastResults.length - 1];
    const nextDay = last.day + 7 > 28 ? last.day + 7 - 28 + (last.month === 12 ? 1 : last.month) : last.day + 7;
    const nextMonth = last.month;

    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 날짜 숫자에 보너스
    if (nextDay >= 1 && nextDay <= 45) scores[nextDay] += 3;
    if (nextMonth >= 1 && nextMonth <= 45) scores[nextMonth] += 2;
    const dayMonth = nextDay + nextMonth;
    if (dayMonth >= 1 && dayMonth <= 45) scores[dayMonth] += 2;

    // 간격패턴 결합
    const freq = {};
    for (let i = 1; i <= 45; i++) freq[i] = 0;
    pastResults.slice(-15).forEach(r => r.numbers.forEach(n => freq[n]++));
    for (let i = 1; i <= 45; i++) scores[i] += freq[i] * 2;

    // 주기 결합
    const lastSeen = {};
    for (let i = 1; i <= 45; i++) lastSeen[i] = 0;
    pastResults.forEach((r, idx) => r.numbers.forEach(n => lastSeen[n] = idx));
    for (let i = 1; i <= 45; i++) {
        const gap = pastResults.length - lastSeen[i];
        if (gap >= 5 && gap <= 15) scores[i] += 3;
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

// 전략: 간격패턴 + 합계필터 (기존 최강에 합계 제약 추가)
function strategyGapWithSumFilter(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

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
        if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0) {
            scores[i] = (currentGap / avgGap) * 10;
        }
        if (currentGap <= 3) scores[i] += 3;
    }

    // 상위 15개 후보에서 합계 121-160 조합 찾기
    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 15).map(e => parseInt(e[0]));

    let best = candidates.slice(0, 6);
    let bestScore = -1;

    for (let attempt = 0; attempt < 500; attempt++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((a, b) => a + b, 0);
        if (sum >= 121 && sum <= 160) {
            const score = combo.reduce((s, n) => s + (scores[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }

    return best.sort((a, b) => a - b);
}

// 전략: 간격 + 보너스 + 합계 종합
function strategyUltimate(pastResults) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 1. 간격 패턴 (40%)
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
        if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0) {
            scores[i] += (currentGap / avgGap) * 12;
        }
        if (currentGap <= 3) scores[i] += 4;
    }

    // 2. 보너스 번호 (20%)
    for (let i = Math.max(0, pastResults.length - 5); i < pastResults.length; i++) {
        scores[pastResults[i].bonus] += 4 - Math.floor((pastResults.length - 1 - i) * 0.8);
    }

    // 3. 동반출현 (20%)
    const lastNums = pastResults[pastResults.length - 1].numbers;
    for (let i = 0; i < pastResults.length - 1; i++) {
        const overlap = pastResults[i].numbers.filter(n => lastNums.includes(n));
        if (overlap.length >= 2) {
            pastResults[i + 1].numbers.forEach(n => scores[n] += 1);
        }
    }

    // 4. 계절 보정 (10%)
    const currentMonth = pastResults[pastResults.length - 1].month;
    const sameMonthResults = pastResults.filter(r => r.month === currentMonth);
    const monthFreq = {};
    for (let i = 1; i <= 45; i++) monthFreq[i] = 0;
    sameMonthResults.forEach(r => r.numbers.forEach(n => monthFreq[n]++));
    const maxMonthFreq = Math.max(...Object.values(monthFreq));
    if (maxMonthFreq > 0) {
        for (let i = 1; i <= 45; i++) scores[i] += (monthFreq[i] / maxMonthFreq) * 3;
    }

    // 5. 홀짝 밸런스 체크 후 상위 10개에서 선택
    const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 12).map(e => parseInt(e[0]));

    // 합계 121-160, 홀짝 2:4~4:2
    let best = candidates.slice(0, 6);
    let bestScore = -1;

    for (let attempt = 0; attempt < 300; attempt++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const combo = shuffled.slice(0, 6);
        const sum = combo.reduce((a, b) => a + b, 0);
        const odds = combo.filter(n => n % 2 === 1).length;
        if (sum >= 121 && sum <= 160 && odds >= 2 && odds <= 4) {
            const score = combo.reduce((s, n) => s + (scores[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = combo; }
        }
    }

    return best.sort((a, b) => a - b);
}

// 전략: 클러스터 (최근 3회 데이터에서 2회 이상 나온 번호 + 간격)
function strategyCluster(pastResults) {
    const last3 = pastResults.slice(-3);
    const freq3 = {};
    for (let i = 1; i <= 45; i++) freq3[i] = 0;
    last3.forEach(r => r.numbers.forEach(n => freq3[n]++));

    const scores = {};
    for (let i = 1; i <= 45; i++) {
        scores[i] = freq3[i] >= 2 ? 15 : freq3[i] === 1 ? 3 : 0;
    }

    // 간격 보정
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
        if (currentGap >= avgGap * 1.2 && currentGap <= avgGap * 2.0) {
            scores[i] += 8;
        }
    }

    return Object.entries(scores).sort((a, b) => b[1] - a[1])
        .slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
}

const strategies = [
    { name: '간격패턴(기존최강)', fn: (past) => {
        const scores = {};
        for (let i = 1; i <= 45; i++) scores[i] = 0;
        const lastSeen = {};
        const gaps = {};
        for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
        past.forEach((r, idx) => {
            r.numbers.forEach(n => {
                if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
                lastSeen[n] = idx;
            });
        });
        for (let i = 1; i <= 45; i++) {
            const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
            const currentGap = past.length - lastSeen[i];
            if (currentGap >= avgGap * 0.9 && currentGap <= avgGap * 2.0) scores[i] = (currentGap / avgGap) * 10;
            if (currentGap <= 3) scores[i] += 3;
        }
        return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => parseInt(e[0])).sort((a, b) => a - b);
    }},
    { name: '보너스+간격 복합', fn: strategyBonusFollow },
    { name: '날짜기반+핫+주기', fn: strategyDateBased },
    { name: '간격+합계필터', fn: strategyGapWithSumFilter },
    { name: '종합 얼티밋', fn: strategyUltimate },
    { name: '클러스터+간격', fn: strategyCluster },
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('\n순위 | 전략               | 평균적중 | 3+개 | 4+개 | 5+개 | 보너스 | 분포(0-6개)');
console.log('-'.repeat(100));

const results = [];
for (const strategy of strategies) {
    let totalMatch = 0, bonus = 0, m3 = 0, m4 = 0, m5 = 0;
    const dist = [0,0,0,0,0,0,0];

    for (let i = startIdx; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        if (past.length < 50) continue;
        const predicted = strategy.fn(past);
        const actual = allResults[i];
        const mc = predicted.filter(n => actual.numbers.includes(n)).length;
        totalMatch += mc;
        if (predicted.includes(actual.bonus)) bonus++;
        if (mc >= 3) m3++;
        if (mc >= 4) m4++;
        if (mc >= 5) m5++;
        dist[mc]++;
    }

    const avg = (totalMatch / testRounds).toFixed(3);
    results.push({ name: strategy.name, avg: parseFloat(avg), m3, m4, m5, bonus, dist });
}

results.sort((a, b) => b.avg - a.avg);
results.forEach((r, idx) => {
    const d = r.dist.map(v => v.toString().padStart(2)).join(' ');
    console.log(`${(idx+1).toString().padStart(2)}위 | ${r.name.padEnd(16)} | ${r.avg.toFixed(3)}  | ${r.m3.toString().padStart(2)}회 | ${r.m4.toString().padStart(2)}회 | ${r.m5.toString().padStart(2)}회 | ${r.bonus.toString().padStart(3)}회 | [${d}]`);
});

// 최종 추천
console.log('\n\n' + '=' .repeat(60));
console.log('🎯 1209회 추천번호 (상위 전략)');
console.log('=' .repeat(60));

results.slice(0, 4).forEach((r, idx) => {
    const strategy = strategies.find(s => s.name === r.name);
    const predicted = strategy.fn(allResults);
    const sum = predicted.reduce((a,b) => a+b, 0);
    const odds = predicted.filter(n => n % 2 === 1).length;
    console.log(`\n${idx+1}. ${r.name} (평균 ${r.avg}개, 3+적중 ${r.m3}회)`);
    console.log(`   번호: ${predicted.join(', ')}`);
    console.log(`   합계: ${sum} | 홀짝: ${odds}:${6-odds}`);
});
