/**
 * v6: 최고 조합 극한 최적화
 *
 * v5 결과:
 * - o3+depth3(0.8): 5+ 10회(10%), 6개 1회
 * - T(LCG+off3+depth): 5+ 10회
 * - L13_31+off3: 5+ 9회, 6개 2회!
 *
 * 목표: 5+ 적중률 15% 이상 또는 6개 적중 횟수 증가
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

const TEST_COUNT = 100;
const testStart = allResults.length - TEST_COUNT;

function getGapScores(past, minR = 0.8, maxR = 2.5) {
    const lastSeen = {}, gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    past.forEach((r, idx) => r.numbers.forEach(n => {
        if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
        lastSeen[n] = idx;
    }));
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : 8;
        const currentGap = past.length - lastSeen[i];
        const ratio = currentGap / avgGap;
        scores[i] = (ratio >= minR && ratio <= maxR) ? ratio * 10 : 0;
    }
    return scores;
}

function getHot(past, w) {
    const f = {}; for (let i = 1; i <= 45; i++) f[i] = 0;
    past.slice(-w).forEach(r => r.numbers.forEach(n => f[n]++));
    return f;
}

function selectFromRanges(scores) {
    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
    const sel = [];
    ranges.forEach(([min, max]) => {
        let b = -1, bs = -1;
        for (let n = min; n <= max; n++) if (scores[n] > bs) { bs = scores[n]; b = n; }
        if (b > 0) sel.push(b);
    });
    const rem = Object.entries(scores).filter(([n]) => !sel.includes(parseInt(n))).sort((a, b) => b[1] - a[1]);
    while (sel.length < 6 && rem.length > 0) sel.push(parseInt(rem.shift()[0]));
    return sel.sort((a, b) => a - b);
}

function selectTopN(scores, n) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => parseInt(k)).sort((a, b) => a - b);
}

function createStrategies() {
    const strategies = [];

    // ====== A. off3 + depth 미세 조정 ======
    for (let offVal of [2, 3, 4, 5]) {
        for (let offW of [3, 4, 5, 6, 7, 8]) {
            for (let depth of [2, 3, 4, 5, 6, 7]) {
                for (let decay of [0.5, 0.6, 0.7, 0.8, 0.9]) {
                    for (let p1P of [1, 2, 3]) {
                        strategies.push({
                            name: `O${offVal}_w${offW}_d${depth}_${decay}_p${p1P}`,
                            fn: (past) => {
                                const gap = getGapScores(past);
                                const hot = getHot(past, 20);
                                const scores = {};
                                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                                // offset
                                const prev0 = past[past.length - 1].numbers;
                                prev0.forEach(n => {
                                    [-offVal, offVal].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= p1P; });
                                });
                                // depth
                                for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                    const prev = past[past.length - d].numbers;
                                    const w = Math.pow(decay, d - 1) * 5;
                                    prev.forEach(n => {
                                        const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                                        [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                                    });
                                }
                                return selectFromRanges(scores);
                            }
                        });
                    }
                }
            }
        }
    }

    // ====== B. Triple(LCG+off+depth) 미세 조정 ======
    for (let a of [13, 17]) {
        for (let c of [17, 31]) {
            for (let off of [3, 4]) {
                for (let depth of [3, 4, 5]) {
                    for (let lcgW of [2, 3, 4, 5]) {
                        for (let offW of [3, 4, 5]) {
                            for (let decay of [0.5, 0.6, 0.7, 0.8]) {
                                strategies.push({
                                    name: `T${a}${c}_o${off}_d${depth}_l${lcgW}_w${offW}_${decay}`,
                                    fn: (past) => {
                                        const nextRound = past[past.length - 1].round + 1;
                                        const gap = getGapScores(past);
                                        const hot = getHot(past, 20);
                                        const scores = {};
                                        for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                                        // LCG
                                        for (let k = 0; k < 6; k++) {
                                            const lcg = ((a * nextRound + c + k * 7) % 45) + 1;
                                            scores[lcg] += lcgW;
                                        }
                                        // offset
                                        const prev0 = past[past.length - 1].numbers;
                                        prev0.forEach(n => {
                                            [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                            [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                                        });
                                        // depth
                                        for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                            const prev = past[past.length - d].numbers;
                                            const w = Math.pow(decay, d - 1) * 4;
                                            prev.forEach(n => {
                                                const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                                                [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                                            });
                                        }
                                        return selectFromRanges(scores);
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // ====== C. 확장 선택 (8~15개) ======
    for (let pickN of [7, 8, 9, 10, 12, 15]) {
        for (let offVal of [3, 4]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.7, 0.8]) {
                    strategies.push({
                        name: `P${pickN}_o${offVal}_d${depth}_${decay}`,
                        fn: (past) => {
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const prev = past[past.length - 1].numbers;
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            prev.forEach(n => {
                                [-offVal, offVal].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 5; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                const p = past[past.length - d].numbers;
                                const w = Math.pow(decay, d - 1) * 4;
                                p.forEach(n => {
                                    const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += w;
                                    [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                                });
                            }
                            // LCG 추가
                            const nextR = past[past.length - 1].round + 1;
                            for (let k = 0; k < 6; k++) {
                                scores[((13 * nextR + 31 + k * 7) % 45) + 1] += 3;
                            }
                            return selectTopN(scores, pickN);
                        }
                    });
                }
            }
        }
    }

    return strategies;
}

// 백테스트 (too many strategies - sample first check)
console.log(`총 ${allResults.length}개 회차 | 테스트: 최근 ${TEST_COUNT}회\n`);

const strategies = createStrategies();
// 너무 많으면 제한
const maxStrategies = 3000;
const testStrategies = strategies.length > maxStrategies ? strategies.slice(0, maxStrategies) : strategies;
console.log(`총 ${strategies.length}개 중 ${testStrategies.length}개 테스트\n`);

const results = [];

for (const strategy of testStrategies) {
    let totalHit = 0;
    let hit3 = 0, hit4 = 0, hit5 = 0, hit6 = 0;
    const dist = [0, 0, 0, 0, 0, 0, 0];

    for (let i = testStart; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        const actual = allResults[i].numbers;

        try {
            const predicted = strategy.fn(past);
            if (!predicted || predicted.length < 6) continue;
            const hits = predicted.filter(n => actual.includes(n)).length;
            totalHit += hits;
            if (hits < 7) dist[hits]++;
            if (hits >= 3) hit3++;
            if (hits >= 4) hit4++;
            if (hits >= 5) hit5++;
            if (hits >= 6) hit6++;
        } catch (e) {
            continue;
        }
    }

    const avg = totalHit / TEST_COUNT;
    const pickSize = (() => {
        try { return strategy.fn(allResults.slice(0, testStart)).length; } catch { return 6; }
    })();

    results.push({ name: strategy.name, avg, hit3, hit4, hit5, hit6, dist, pickSize });
}

// 6개 선택 - 5+ 기준 정렬
const six = results.filter(r => r.pickSize === 6);
const by5 = [...six].sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);

console.log('=== 6개 선택 - 5개+ 적중 기준 상위 30개 ===');
console.log('순위 | 전략                                    | 평균   | 5+  | 6  | 4+  | 3+  | 분포');
console.log('-'.repeat(120));
for (let i = 0; i < Math.min(30, by5.length); i++) {
    const r = by5[i];
    if (r.hit5 === 0 && i > 5) break;
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(40)} | ${r.avg.toFixed(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${String(r.hit4).padStart(3)} | ${String(r.hit3).padStart(3)} | ${r.dist.join(':')}`);
}

// 6개 적중(1등) 있는 전략들
const has6 = six.filter(r => r.hit6 > 0).sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5);
if (has6.length > 0) {
    console.log('\n=== 6개 적중(1등!) 달성 전략들 ===');
    for (const r of has6.slice(0, 20)) {
        console.log(`${r.name.padEnd(40)} | avg:${r.avg.toFixed(3)} | 6:${r.hit6} | 5+:${r.hit5} | 4+:${r.hit4}`);
    }
}

// 평균 최고
six.sort((a, b) => b.avg - a.avg);
console.log('\n=== 6개 선택 - 평균 기준 상위 15개 ===');
for (let i = 0; i < Math.min(15, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(40)} | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 6:${r.hit6} | 4+:${r.hit4}`);
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);
console.log('\n=== 확장 선택 상위 20개 ===');
for (let i = 0; i < Math.min(20, multi.length); i++) {
    const r = multi[i];
    console.log(`${r.name.padEnd(30)} (${String(r.pickSize).padStart(2)}개) | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 6:${r.hit6} | 4+:${r.hit4} | 분포:${r.dist.join(':')}`);
}

// 1209회 추천
console.log('\n=== 1209회 추천 ===');
const tops = [...results].sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg).slice(0, 10);
for (const r of tops) {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 5+:${r.hit5} 6:${r.hit6}`);
        } catch (e) { }
    }
}
