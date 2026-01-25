/**
 * 조작 가정 패턴 분석
 * 가정: 누군가가 번호를 의도적으로 선택한다면 어떤 패턴이 보일까?
 *
 * 분석 카테고리:
 * A. 인간 조작: 심리적 편향, 회피 패턴, "랜덤처럼 보이게" 하려는 시도
 * B. 프로그램 조작: 모듈러 연산, 시드 기반, 위치별 규칙
 * C. 넌센스 패턴: 별자리, 날짜 연산, 역수, 보수 등
 * D. 의도적 난해: 이전 당첨과 최대한 다르게, 인기번호 회피
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
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}
allResults.sort((a, b) => a.round - b.round);
console.log(`총 ${allResults.length}개 회차 분석\n`);

// ============================
// A. 위치별 패턴 (정렬된 번호의 각 위치에 규칙이 있나?)
// ============================
console.log('='.repeat(60));
console.log('A. 위치별 번호 패턴 (조작자가 각 위치별로 규칙을 적용?)');
console.log('='.repeat(60));

// 각 위치별 번호 변화 패턴
for (let pos = 0; pos < 6; pos++) {
    const diffs = [];
    for (let i = 1; i < allResults.length; i++) {
        diffs.push(allResults[i].numbers[pos] - allResults[i-1].numbers[pos]);
    }
    const avgDiff = (diffs.reduce((a,b) => a+b, 0) / diffs.length).toFixed(2);
    const posNums = allResults.slice(-20).map(r => r.numbers[pos]);
    console.log(`  위치${pos+1}: 평균변화=${avgDiff} | 최근20회: ${posNums.join(',')}`);
}

// 위치별 모듈러 패턴
console.log('\n  위치별 mod 패턴 (최근 10회):');
for (let pos = 0; pos < 6; pos++) {
    const mods = allResults.slice(-10).map(r => r.numbers[pos] % 7);
    const mods3 = allResults.slice(-10).map(r => r.numbers[pos] % 3);
    console.log(`  위치${pos+1} mod7: [${mods.join(',')}] | mod3: [${mods3.join(',')}]`);
}

// ============================
// B. 회차번호와의 관계 (프로그램이라면 회차를 시드로 쓸 수 있음)
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('B. 회차번호 기반 패턴 (프로그램이 회차를 시드로?)');
console.log('='.repeat(60));

// 회차 mod N이 번호에 반영되는지
for (let mod of [3, 5, 7, 9, 11, 13]) {
    let hits = 0;
    allResults.forEach(r => {
        const roundMod = (r.round % mod) + 1;
        if (r.numbers.includes(roundMod)) hits++;
        if (r.numbers.includes(roundMod + mod)) hits++;
    });
    const rate = (hits / allResults.length / 2 * 100).toFixed(1);
    console.log(`  회차 mod ${mod.toString().padStart(2)} → 번호에 포함: ${rate}% (기대 13.3%)`);
}

// 회차 XOR 패턴
console.log('\n  회차 XOR 패턴:');
let xorHits = 0;
for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    for (let shift = 1; shift <= 5; shift++) {
        const xorVal = (r.round ^ (r.round >> shift)) % 45 + 1;
        if (r.numbers.includes(xorVal)) xorHits++;
    }
}
console.log(`  회차 XOR 시프트(1-5) 적중: ${(xorHits / allResults.length / 5 * 100).toFixed(1)}% (기대 13.3%)`);

// ============================
// C. 이전 번호와의 수학적 관계
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('C. 이전 번호와의 수학적 관계');
console.log('='.repeat(60));

// 이전 번호의 보수 (46-n)
let complementHits = 0, complementCount = 0;
for (let i = 1; i < allResults.length; i++) {
    const prev = allResults[i-1].numbers;
    const curr = allResults[i].numbers;
    prev.forEach(n => {
        const comp = 46 - n;
        if (comp >= 1 && comp <= 45 && curr.includes(comp)) complementHits++;
        complementCount++;
    });
}
console.log(`  이전번호의 보수(46-n) 출현: ${(complementHits/complementCount*100).toFixed(1)}% (기대 13.3%)`);

// 이전 번호 ± 1, ± 2
for (let delta of [-2, -1, 1, 2]) {
    let hits = 0, total = 0;
    for (let i = 1; i < allResults.length; i++) {
        allResults[i-1].numbers.forEach(n => {
            const target = n + delta;
            if (target >= 1 && target <= 45) {
                total++;
                if (allResults[i].numbers.includes(target)) hits++;
            }
        });
    }
    console.log(`  이전번호 ${delta > 0 ? '+' : ''}${delta}: ${(hits/total*100).toFixed(1)}% (기대 13.3%)`);
}

// 이전 합계 mod 45
let sumModHits = 0;
for (let i = 1; i < allResults.length; i++) {
    const prevSum = allResults[i-1].numbers.reduce((a,b) => a+b, 0);
    const modVal = (prevSum % 45) + 1;
    if (allResults[i].numbers.includes(modVal)) sumModHits++;
}
console.log(`  이전합계 mod45+1 출현: ${(sumModHits/(allResults.length-1)*100).toFixed(1)}% (기대 13.3%)`);

// ============================
// D. 디지털 루트 / 수비학적 패턴
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('D. 수비학/디지털루트 패턴');
console.log('='.repeat(60));

function digitalRoot(n) { return n < 10 ? n : digitalRoot(n.toString().split('').reduce((a, d) => a + parseInt(d), 0)); }

// 디지털 루트 분포
const drDist = {};
allResults.forEach(r => {
    r.numbers.forEach(n => {
        const dr = digitalRoot(n);
        drDist[dr] = (drDist[dr] || 0) + 1;
    });
});
console.log('  디지털루트 분포:');
Object.entries(drDist).sort((a,b) => a[0] - b[0])
    .forEach(([dr, c]) => console.log(`    루트${dr}: ${c}회 (${(c/allResults.length/6*100).toFixed(1)}%)`));

// 연속 회차의 디지털 루트 합
let drSumPattern = 0;
for (let i = 1; i < allResults.length; i++) {
    const prevDR = digitalRoot(allResults[i-1].numbers.reduce((a,b) => a+b, 0));
    const currDR = digitalRoot(allResults[i].numbers.reduce((a,b) => a+b, 0));
    if ((prevDR + currDR) % 9 <= 3) drSumPattern++;
}
console.log(`\n  연속회차 디지털루트합 mod9 ≤ 3: ${(drSumPattern/(allResults.length-1)*100).toFixed(1)}% (기대 44.4%)`);

// ============================
// E. 프로그램 시뮬레이션: 내가 조작한다면?
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('E. "내가 조작 프로그램을 만든다면" 역추적');
console.log('='.repeat(60));

// 가설 1: LCG(선형합동생성기) 시드로 회차번호 사용
console.log('\n  가설1: LCG 유사 패턴 (a*round+c mod 45)');
let bestLCG = { a: 0, c: 0, hits: 0 };
for (let a = 1; a <= 20; a++) {
    for (let c = 0; c <= 20; c++) {
        let hits = 0;
        allResults.slice(-100).forEach(r => {
            for (let k = 0; k < 6; k++) {
                const predicted = ((a * r.round + c + k * 7) % 45) + 1;
                if (r.numbers.includes(predicted)) hits++;
            }
        });
        if (hits > bestLCG.hits) bestLCG = { a, c, hits };
    }
}
console.log(`  최적 LCG: a=${bestLCG.a}, c=${bestLCG.c} → 적중 ${bestLCG.hits}/600 (${(bestLCG.hits/600*100).toFixed(1)}%, 기대 13.3%)`);

// 가설 2: 이전 번호들의 특정 연산
console.log('\n  가설2: 이전번호 연산 패턴');
const operations = [
    { name: '(a+b)%45+1', fn: (a,b) => (a+b) % 45 + 1 },
    { name: '(a*b)%45+1', fn: (a,b) => (a*b) % 45 + 1 },
    { name: '|a-b|', fn: (a,b) => Math.abs(a-b) || 1 },
    { name: '(a^b)%45+1', fn: (a,b) => (a^b) % 45 + 1 },
    { name: '(a+b)/2 반올림', fn: (a,b) => Math.round((a+b)/2) },
];

for (const op of operations) {
    let hits = 0, total = 0;
    for (let i = 1; i < allResults.length; i++) {
        const prev = allResults[i-1].numbers;
        for (let j = 0; j < prev.length; j++) {
            for (let k = j+1; k < prev.length; k++) {
                const result = op.fn(prev[j], prev[k]);
                if (result >= 1 && result <= 45) {
                    total++;
                    if (allResults[i].numbers.includes(result)) hits++;
                }
            }
        }
    }
    console.log(`  ${op.name.padEnd(15)}: ${(hits/total*100).toFixed(1)}% (기대 13.3%)`);
}

// ============================
// F. 의도적 회피 패턴 (인기번호를 피하는가?)
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('F. 의도적 회피 패턴 (인기번호를 체계적으로 피하는가?)');
console.log('='.repeat(60));

// 각 번호가 "핫"할 때 다음에 나올 확률 vs "콜드"할 때
let hotFollowHit = 0, hotFollowTotal = 0;
let coldFollowHit = 0, coldFollowTotal = 0;
for (let i = 20; i < allResults.length; i++) {
    const recent20 = allResults.slice(i-20, i);
    const freq = {};
    for (let n = 1; n <= 45; n++) freq[n] = 0;
    recent20.forEach(r => r.numbers.forEach(n => freq[n]++));
    const avgFreq = 120 / 45; // 20회 * 6개 / 45

    const actual = allResults[i].numbers;
    for (let n = 1; n <= 45; n++) {
        if (freq[n] > avgFreq + 1) { // 핫
            hotFollowTotal++;
            if (actual.includes(n)) hotFollowHit++;
        } else if (freq[n] < avgFreq - 1) { // 콜드
            coldFollowTotal++;
            if (actual.includes(n)) coldFollowHit++;
        }
    }
}
console.log(`  핫번호 → 다음 출현: ${(hotFollowHit/hotFollowTotal*100).toFixed(1)}% (기대 13.3%)`);
console.log(`  콜드번호 → 다음 출현: ${(coldFollowHit/coldFollowTotal*100).toFixed(1)}% (기대 13.3%)`);
console.log(`  → ${hotFollowHit/hotFollowTotal > coldFollowHit/coldFollowTotal ? '핫번호가 더 잘 나옴 (회피 아님)' : '콜드번호가 더 잘 나옴 (회피 가능성!)'}`);

// ============================
// G. 위치별 고정 오프셋 패턴
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('G. 위치별 고정 변화량 패턴');
console.log('='.repeat(60));

// 각 위치에서 이전과의 차이가 특정 값인 비율
for (let pos = 0; pos < 6; pos++) {
    const diffDist = {};
    for (let i = 1; i < allResults.length; i++) {
        const diff = allResults[i].numbers[pos] - allResults[i-1].numbers[pos];
        diffDist[diff] = (diffDist[diff] || 0) + 1;
    }
    const topDiffs = Object.entries(diffDist).sort((a,b) => b[1] - a[1]).slice(0, 3);
    console.log(`  위치${pos+1}: 최빈변화량 ${topDiffs.map(([d,c]) => `${d}(${c}회)`).join(', ')}`);
}

// ============================
// H. 종합 백테스팅: 조작 패턴 기반 전략들
// ============================
console.log('\n\n' + '='.repeat(60));
console.log('H. 조작 패턴 기반 전략 백테스팅');
console.log('='.repeat(60));

// 전략: 보수(46-n) 기반
function strategyComplement(past) {
    const prev = past[past.length - 1].numbers;
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 이전 번호의 보수에 가점
    prev.forEach(n => { const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 5; });
    // 2회전 보수
    if (past.length >= 2) {
        past[past.length-2].numbers.forEach(n => { const c = 46-n; if(c>=1&&c<=45) scores[c] += 3; });
    }
    // 간격 보정
    const gap = getGapScores(past);
    for (let i = 1; i <= 45; i++) scores[i] += gap[i] * 2;

    return Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,6).map(e => parseInt(e[0])).sort((a,b) => a-b);
}

// 전략: 이전번호 ±1,±2 + 간격
function strategyAdjacentGap(past) {
    const prev = past[past.length - 1].numbers;
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    prev.forEach(n => {
        [-2,-1,1,2].forEach(d => {
            const t = n + d;
            if (t >= 1 && t <= 45) scores[t] += 4;
        });
    });
    const gap = getGapScores(past);
    for (let i = 1; i <= 45; i++) scores[i] += gap[i] * 3;

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 165);
}

// 전략: 위치별 예측 (각 위치의 평균 변화량 적용)
function strategyPositional(past) {
    const recent = past.slice(-10);
    const predicted = [];

    for (let pos = 0; pos < 6; pos++) {
        // 최근 10회의 위치별 변화량 평균
        const diffs = [];
        for (let i = 1; i < recent.length; i++) {
            diffs.push(recent[i].numbers[pos] - recent[i-1].numbers[pos]);
        }
        const avgDiff = diffs.reduce((a,b) => a+b, 0) / diffs.length;
        let pred = Math.round(past[past.length-1].numbers[pos] + avgDiff);
        pred = Math.max(1, Math.min(45, pred));
        predicted.push(pred);
    }

    // 중복 제거
    const unique = [...new Set(predicted)];
    while (unique.length < 6) {
        const gap = getGapScores(past);
        const next = Object.entries(gap).filter(([n]) => !unique.includes(parseInt(n)))
            .sort((a,b) => b[1]-a[1])[0];
        if (next) unique.push(parseInt(next[0]));
        else break;
    }
    return unique.slice(0, 6).sort((a, b) => a - b);
}

// 전략: 합계 역이용 (이전 합계와 반대 방향)
function strategySumReverse(past) {
    const prevSum = past[past.length-1].numbers.reduce((a,b) => a+b, 0);
    const prev2Sum = past.length >= 2 ? past[past.length-2].numbers.reduce((a,b) => a+b, 0) : 135;

    // 합계가 올라갔으면 낮은쪽, 내려갔으면 높은쪽
    let targetMin, targetMax;
    if (prevSum > prev2Sum) { targetMin = 100; targetMax = 135; }
    else { targetMin = 140; targetMax = 180; }

    const gap = getGapScores(past);
    const hot = {};
    for (let i = 1; i <= 45; i++) hot[i] = 0;
    past.slice(-15).forEach(r => r.numbers.forEach(n => hot[n]++));

    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i] * 1.5;

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,18).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, targetMin, targetMax);
}

// 전략: 끝자리 강제 분산 (조작자가 끝자리를 다양하게?)
function strategyLastDigitForce(past) {
    const gap = getGapScores(past);
    const hot = {};
    for (let i = 1; i <= 45; i++) hot[i] = 0;
    past.slice(-20).forEach(r => r.numbers.forEach(n => hot[n]++));

    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i] * 1.5;

    // 끝자리 0~9에서 각각 최고점 선택
    const selected = [];
    const usedDigits = new Set();
    const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);

    for (const [n, s] of sorted) {
        const digit = parseInt(n) % 10;
        if (!usedDigits.has(digit) && selected.length < 6) {
            selected.push(parseInt(n));
            usedDigits.add(digit);
        }
    }
    while (selected.length < 6) {
        const remaining = sorted.filter(([n]) => !selected.includes(parseInt(n)));
        if (remaining.length > 0) selected.push(parseInt(remaining[0][0]));
        else break;
    }
    return selected.sort((a, b) => a - b);
}

// 전략: 홀짝 교대 강제 (조작자가 홀짝을 교대?)
function strategyAlternateOddEven(past) {
    const prevOdds = past[past.length-1].numbers.filter(n => n%2===1).length;
    // 이전에 홀수 많으면 짝수 위주, 반대도
    const targetOddCount = prevOdds >= 4 ? 2 : prevOdds <= 2 ? 4 : 3;

    const gap = getGapScores(past);
    const hot = {};
    for (let i = 1; i <= 45; i++) hot[i] = 0;
    past.slice(-20).forEach(r => r.numbers.forEach(n => hot[n]++));
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i] * 1.5;

    const odds = Object.entries(scores).filter(([n]) => parseInt(n)%2===1).sort((a,b) => b[1]-a[1]);
    const evens = Object.entries(scores).filter(([n]) => parseInt(n)%2===0).sort((a,b) => b[1]-a[1]);

    const selected = [];
    selected.push(...odds.slice(0, targetOddCount).map(e => parseInt(e[0])));
    selected.push(...evens.slice(0, 6 - targetOddCount).map(e => parseInt(e[0])));
    return selected.sort((a, b) => a - b);
}

// 전략: 피보나치 + 간격 (조작자가 피보나치 수열 선호?)
function strategyFibonacciGap(past) {
    const fibs = [1,2,3,5,8,13,21,34]; // 45이하 피보나치
    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3;
    fibs.forEach(f => { if (f <= 45) scores[f] += 5; });

    // 피보나치 + gap 조합
    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,12).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 100, 170);
}

// 전략: 소수 + 간격 (조작자가 소수 선호?)
function strategyPrimeGap(past) {
    const primes = [2,3,5,7,11,13,17,19,23,29,31,37,41,43];
    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3;
    primes.forEach(p => scores[p] += 4);

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,12).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 165);
}

// 전략: 거울수(12→21) + 간격
function strategyMirrorGap(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3;

    prev.forEach(n => {
        if (n >= 10) {
            const mirror = parseInt(n.toString().split('').reverse().join(''));
            if (mirror >= 1 && mirror <= 45) scores[mirror] += 5;
        }
    });

    return Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,6).map(e => parseInt(e[0])).sort((a,b) => a-b);
}

// 전략: 차이값 패턴 (이전 번호간 차이가 다음에 출현)
function strategyDiffPattern(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 2;

    for (let i = 0; i < prev.length; i++) {
        for (let j = i+1; j < prev.length; j++) {
            const diff = Math.abs(prev[i] - prev[j]);
            if (diff >= 1 && diff <= 45) scores[diff] += 3;
            const sum = prev[i] + prev[j];
            if (sum >= 1 && sum <= 45) scores[sum] += 2;
        }
    }

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 100, 170);
}

// 전략: 양극단 회피 (조작자가 너무 크거나 작은 조합 회피)
function strategyAvoidExtremes(past) {
    const gap = getGapScores(past);
    const hot = {};
    for (let i = 1; i <= 45; i++) hot[i] = 0;
    past.slice(-20).forEach(r => r.numbers.forEach(n => hot[n]++));
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        scores[i] = gap[i] * 3 + hot[i] * 1.5;
        // 5~40 사이 번호에 보너스 (극단 회피)
        if (i >= 5 && i <= 40) scores[i] += 2;
    }

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,15).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 125, 155); // 좁은 합계 범위
}

// 전략: 이전 보너스 기반 시드 (보너스가 다음 회차의 키?)
function strategyBonusSeed(past) {
    const lastBonus = past[past.length-1].bonus;
    const prev2Bonus = past.length >= 2 ? past[past.length-2].bonus : 23;

    const gap = getGapScores(past);
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 2;

    // 보너스 기반 시드값
    const seeds = [
        lastBonus,
        (lastBonus * 2) % 45 + 1,
        (lastBonus * 3) % 45 + 1,
        (lastBonus + prev2Bonus) % 45 + 1,
        Math.abs(lastBonus - prev2Bonus) || 1,
        (lastBonus * prev2Bonus) % 45 + 1,
    ];
    seeds.forEach(s => { if (s >= 1 && s <= 45) scores[s] += 6; });

    return Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,6).map(e => parseInt(e[0])).sort((a,b) => a-b);
}

// 전략: 구간강제 + 이전번호 인접 (최강 기존전략 + 조작패턴)
function strategyRangeAdjacent(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = {};
    for (let i = 1; i <= 45; i++) hot[i] = 0;
    past.slice(-20).forEach(r => r.numbers.forEach(n => hot[n]++));

    const scores = {};
    for (let i = 1; i <= 45; i++) {
        scores[i] = gap[i] * 3 + hot[i] * 1.5;
    }
    // 이전번호 인접에 보너스
    prev.forEach(n => {
        [-1,1,-2,2].forEach(d => {
            const t = n + d;
            if (t >= 1 && t <= 45) scores[t] += 3;
        });
    });

    // 구간에서 선택
    return selectFromRanges(scores);
}

// 전략: N회전 특정위치 반복 (3회전 위치1이 반복?)
function strategyPositionRepeat(past) {
    const scores = {};
    for (let i = 1; i <= 45; i++) scores[i] = 0;

    // 3, 5, 7회전의 각 위치 번호에 가점
    [3, 5, 7].forEach(skip => {
        if (past.length > skip) {
            past[past.length - skip].numbers.forEach(n => scores[n] += 4);
        }
    });

    const gap = getGapScores(past);
    for (let i = 1; i <= 45; i++) scores[i] += gap[i] * 2;

    const candidates = Object.entries(scores).sort((a,b) => b[1]-a[1]).slice(0,12).map(e => parseInt(e[0]));
    return filterBySum(candidates, scores, 115, 165);
}

// 유틸리티
function getGapScores(pastResults) {
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
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a,b) => a+b, 0) / gaps[i].length : 8;
        const currentGap = pastResults.length - lastSeen[i];
        const ratio = currentGap / avgGap;
        scores[i] = (ratio >= 0.8 && ratio <= 2.5) ? ratio * 10 : 0;
    }
    return scores;
}

function filterBySum(candidates, scores, min, max) {
    let best = candidates.slice(0, 6);
    let bestScore = -1;
    for (let a = 0; a < 1000; a++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 6);
        const sum = shuffled.reduce((s, n) => s + n, 0);
        if (sum >= min && sum <= max) {
            const score = shuffled.reduce((s, n) => s + (scores[n] || 0), 0);
            if (score > bestScore) { bestScore = score; best = shuffled; }
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
    const remaining = Object.entries(scores).filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);
    while (selected.length < 6 && remaining.length > 0) selected.push(parseInt(remaining.shift()[0]));
    return selected.sort((a, b) => a - b);
}

// 백테스팅
const strategies = [
    { name: '보수(46-n)+간격', fn: strategyComplement },
    { name: '인접(±1,±2)+간격', fn: strategyAdjacentGap },
    { name: '위치별예측', fn: strategyPositional },
    { name: '합계역이용', fn: strategySumReverse },
    { name: '끝자리강제분산', fn: strategyLastDigitForce },
    { name: '홀짝교대', fn: strategyAlternateOddEven },
    { name: '피보나치+간격', fn: strategyFibonacciGap },
    { name: '소수+간격', fn: strategyPrimeGap },
    { name: '거울수+간격', fn: strategyMirrorGap },
    { name: '차이값패턴', fn: strategyDiffPattern },
    { name: '양극단회피', fn: strategyAvoidExtremes },
    { name: '보너스시드', fn: strategyBonusSeed },
    { name: '구간+인접', fn: strategyRangeAdjacent },
    { name: 'N회전반복', fn: strategyPositionRepeat },
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('\n순위 | 전략               | 평균적중 | 3+개 | 4+개 | 5+개 | 분포');
console.log('-'.repeat(95));

const testResults = [];
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
        } catch(e) {}
    }
    const avg = (totalMatch / testRounds).toFixed(3);
    testResults.push({ name: strategy.name, avg: parseFloat(avg), m3, m4, m5, dist });
}

testResults.sort((a, b) => b.avg - a.avg);
testResults.forEach((r, idx) => {
    const distStr = r.dist.map((d,i) => `${i}:${d}`).join(' ');
    console.log(`${(idx+1).toString().padStart(2)}위 | ${r.name.padEnd(16)} | ${r.avg.toFixed(3).padStart(6)} | ${r.m3.toString().padStart(3)}회 | ${r.m4.toString().padStart(3)}회 | ${r.m5.toString().padStart(3)}회 | ${distStr}`);
});

// 1209회 추천
console.log('\n\n1209회 추천:');
testResults.slice(0, 5).forEach(r => {
    const fn = strategies.find(s => s.name === r.name).fn;
    const pred = fn(allResults);
    console.log(`  ${r.name}: ${pred.join(', ')} (평균 ${r.avg}, 3+: ${r.m3}%)`);
});
