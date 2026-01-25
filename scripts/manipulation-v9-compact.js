/**
 * v9: 6~7개 선택으로 제한
 *
 * v8 최고 결과:
 * - v6_boost: 6개 2%, 5+ 8%
 * - 확장 선택은 10-15개가 효과적이나 사용자가 7개로 제한 요청
 *
 * 목표: 6~7개 선택으로 5+ 15%, 6개 3% 이상
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

// 범위 기반 + 상위 추가로 7개 선택
function selectRangesPlusTop(scores) {
    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
    const sel = [];
    ranges.forEach(([min, max]) => {
        let b = -1, bs = -1;
        for (let n = min; n <= max; n++) if (scores[n] > bs) { bs = scores[n]; b = n; }
        if (b > 0) sel.push(b);
    });
    // 나머지 중 상위 2개 추가 (총 7개)
    const rem = Object.entries(scores).filter(([n]) => !sel.includes(parseInt(n))).sort((a, b) => b[1] - a[1]);
    while (sel.length < 7 && rem.length > 0) sel.push(parseInt(rem.shift()[0]));
    return sel.sort((a, b) => a - b);
}

function createStrategies() {
    const strategies = [];

    // ====== A. v6 기반 미세 조정 (6개) ======
    for (let lcgW of [3, 4, 5, 6]) {
        for (let offW of [3, 4, 5, 6]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.6, 0.7, 0.8, 0.9]) {
                    for (let p1P of [1, 2, 3]) {
                        strategies.push({
                            name: `v6_l${lcgW}_o${offW}_d${depth}_${decay}_p${p1P}`,
                            fn: (past) => {
                                const nextRound = past[past.length - 1].round + 1;
                                const gap = getGapScores(past);
                                const hot = getHot(past, 20);
                                const scores = {};
                                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                                // LCG
                                for (let k = 0; k < 6; k++) {
                                    const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                                    scores[lcg] += lcgW;
                                }
                                // offset
                                const prev0 = past[past.length - 1].numbers;
                                prev0.forEach(n => {
                                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
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

    // ====== B. v6+7개 확장 (같은 로직, 7개 선택) ======
    for (let lcgW of [3, 4, 5, 6]) {
        for (let offW of [3, 4, 5, 6]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.6, 0.7, 0.8]) {
                    strategies.push({
                        name: `v6x7_l${lcgW}_o${offW}_d${depth}_${decay}`,
                        fn: (past) => {
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            for (let k = 0; k < 6; k++) {
                                const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                                scores[lcg] += lcgW;
                            }
                            const prev0 = past[past.length - 1].numbers;
                            prev0.forEach(n => {
                                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                const prev = past[past.length - d].numbers;
                                const w = Math.pow(decay, d - 1) * 5;
                                prev.forEach(n => {
                                    const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                                    [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                                });
                            }
                            return selectRangesPlusTop(scores);
                        }
                    });
                }
            }
        }
    }

    // ====== C. Top7 선택 (범위 무시) ======
    for (let lcgW of [3, 4, 5, 6]) {
        for (let offW of [3, 4, 5, 6]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.6, 0.7, 0.8]) {
                    strategies.push({
                        name: `top7_l${lcgW}_o${offW}_d${depth}_${decay}`,
                        fn: (past) => {
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            for (let k = 0; k < 6; k++) {
                                const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                                scores[lcg] += lcgW;
                            }
                            const prev0 = past[past.length - 1].numbers;
                            prev0.forEach(n => {
                                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                const prev = past[past.length - d].numbers;
                                const w = Math.pow(decay, d - 1) * 5;
                                prev.forEach(n => {
                                    const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                                    [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                                });
                            }
                            return selectTopN(scores, 7);
                        }
                    });
                }
            }
        }
    }

    // ====== D. 새로운 아이디어: 구간별 가중치 다르게 ======
    for (let lowW of [1.0, 1.2, 1.5]) {
        for (let highW of [0.8, 1.0, 1.2]) {
            for (let depth of [3, 4, 5]) {
                strategies.push({
                    name: `zone_l${lowW}_h${highW}_d${depth}`,
                    fn: (past) => {
                        const nextRound = past[past.length - 1].round + 1;
                        const gap = getGapScores(past);
                        const hot = getHot(past, 20);
                        const scores = {};
                        for (let i = 1; i <= 45; i++) {
                            const zoneW = i <= 22 ? lowW : highW;
                            scores[i] = (gap[i] * 3 + hot[i]) * zoneW;
                        }
                        for (let k = 0; k < 6; k++) {
                            const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                            scores[lcg] += 4;
                        }
                        const prev0 = past[past.length - 1].numbers;
                        prev0.forEach(n => {
                            [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 5; });
                            [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                        });
                        for (let d = 2; d <= Math.min(depth, past.length); d++) {
                            const prev = past[past.length - d].numbers;
                            const w = Math.pow(0.7, d - 1) * 5;
                            prev.forEach(n => {
                                const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                            });
                        }
                        return selectFromRanges(scores);
                    }
                });
            }
        }
    }

    // ====== E. 합계 조정 전략 ======
    for (let targetSum of [130, 135, 140, 145, 150]) {
        strategies.push({
            name: `sum${targetSum}`,
            fn: (past) => {
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                for (let k = 0; k < 6; k++) {
                    const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                    scores[lcg] += 4;
                }
                const prev0 = past[past.length - 1].numbers;
                prev0.forEach(n => {
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 5; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                });

                // 기본 6개 선택
                let sel = selectFromRanges(scores);
                let sum = sel.reduce((a, b) => a + b, 0);

                // 합계가 목표보다 작으면 작은 수를 큰 수로 교체
                if (sum < targetSum - 10) {
                    const unused = Object.entries(scores)
                        .filter(([n]) => !sel.includes(parseInt(n)) && parseInt(n) > 30)
                        .sort((a, b) => b[1] - a[1]);
                    if (unused.length > 0) {
                        const minIdx = sel.indexOf(Math.min(...sel));
                        sel[minIdx] = parseInt(unused[0][0]);
                    }
                }
                // 합계가 목표보다 크면 큰 수를 작은 수로 교체
                if (sum > targetSum + 10) {
                    const unused = Object.entries(scores)
                        .filter(([n]) => !sel.includes(parseInt(n)) && parseInt(n) < 20)
                        .sort((a, b) => b[1] - a[1]);
                    if (unused.length > 0) {
                        const maxIdx = sel.indexOf(Math.max(...sel));
                        sel[maxIdx] = parseInt(unused[0][0]);
                    }
                }

                return sel.sort((a, b) => a - b);
            }
        });
    }

    // ====== F. 2개 LCG 파라미터 조합 ======
    for (let a of [11, 13, 17, 19]) {
        for (let c of [23, 31, 37, 41]) {
            strategies.push({
                name: `lcg_${a}_${c}`,
                fn: (past) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    for (let k = 0; k < 6; k++) {
                        const lcg = ((a * nextRound + c + k * 7) % 45) + 1;
                        scores[lcg] += 5;
                    }
                    const prev0 = past[past.length - 1].numbers;
                    prev0.forEach(n => {
                        [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    for (let d = 2; d <= 4; d++) {
                        const prev = past[past.length - d].numbers;
                        const w = Math.pow(0.7, d - 1) * 5;
                        prev.forEach(n => {
                            const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                        });
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // ====== G. 회차 mod 패턴 ======
    for (let mod of [5, 7, 9, 11, 13]) {
        strategies.push({
            name: `mod${mod}`,
            fn: (past) => {
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) {
                    scores[i] = gap[i] * 3 + hot[i];
                    if ((i + nextRound) % mod === 0) scores[i] += 3;
                }
                for (let k = 0; k < 6; k++) {
                    const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                    scores[lcg] += 4;
                }
                const prev0 = past[past.length - 1].numbers;
                prev0.forEach(n => {
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                });
                return selectFromRanges(scores);
            }
        });
    }

    // ====== H. 보너스 번호 활용 ======
    strategies.push({
        name: `bonus_track`,
        fn: (past) => {
            const nextRound = past[past.length - 1].round + 1;
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // 최근 5회 보너스 번호 ±3 가중치
            for (let d = 1; d <= 5; d++) {
                const bonus = past[past.length - d].bonus;
                [-3, 3].forEach(off => {
                    const t = bonus + off;
                    if (t >= 1 && t <= 45) scores[t] += (6 - d);
                });
                // 보너스의 보수
                const comp = 46 - bonus;
                if (comp >= 1 && comp <= 45) scores[comp] += (6 - d) * 0.5;
            }

            for (let k = 0; k < 6; k++) {
                const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                scores[lcg] += 4;
            }
            const prev0 = past[past.length - 1].numbers;
            prev0.forEach(n => {
                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
            });
            return selectFromRanges(scores);
        }
    });

    // ====== I. 연속 미출현 추적 ======
    strategies.push({
        name: `cold_hunter`,
        fn: (past) => {
            const lastSeen = {};
            for (let i = 1; i <= 45; i++) lastSeen[i] = 0;
            past.forEach((r, idx) => r.numbers.forEach(n => lastSeen[n] = idx));

            const cold = [];
            for (let i = 1; i <= 45; i++) {
                const gap = past.length - lastSeen[i];
                if (gap >= 8 && gap <= 15) cold.push({ n: i, gap });
            }
            cold.sort((a, b) => b.gap - a.gap);

            const nextRound = past[past.length - 1].round + 1;
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // cold 번호 가중치
            cold.forEach((c, idx) => scores[c.n] += 10 - idx);

            for (let k = 0; k < 6; k++) {
                const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                scores[lcg] += 4;
            }
            const prev0 = past[past.length - 1].numbers;
            prev0.forEach(n => {
                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
            });
            return selectFromRanges(scores);
        }
    });

    // ====== J. v6 최적화 후보 7개 버전 ======
    for (let gapW of [2, 3, 4]) {
        for (let hotW of [0.5, 1, 1.5]) {
            strategies.push({
                name: `v6opt7_g${gapW}_h${hotW}`,
                fn: (past) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * gapW + hot[i] * hotW;
                    for (let k = 0; k < 6; k++) {
                        const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                        scores[lcg] += 4;
                    }
                    const prev0 = past[past.length - 1].numbers;
                    prev0.forEach(n => {
                        [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 5; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    for (let d = 2; d <= 4; d++) {
                        const prev = past[past.length - d].numbers;
                        const w = Math.pow(0.7, d - 1) * 5;
                        prev.forEach(n => {
                            const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                            [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                        });
                    }
                    return selectTopN(scores, 7);
                }
            });
        }
    }

    return strategies;
}

console.log(`총 ${allResults.length}개 회차 | 테스트: 최근 ${TEST_COUNT}회\n`);

const strategies = createStrategies();
console.log(`총 ${strategies.length}개 전략 테스트\n`);

const results = [];

for (const strategy of strategies) {
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

// 6개 선택
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);

console.log('=== 6개 선택 - 5개+ 기준 상위 30개 ===');
console.log('순위 | 전략                                    | 평균   | 5+  | 6  | 4+  | 3+  | 분포');
console.log('-'.repeat(120));
for (let i = 0; i < Math.min(30, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(40)} | ${r.avg.toFixed(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${String(r.hit4).padStart(3)} | ${String(r.hit3).padStart(3)} | ${r.dist.join(':')}`);
}

// 6개 적중 있는 전략
const has6 = six.filter(r => r.hit6 > 0).sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5);
if (has6.length > 0) {
    console.log('\n=== 6개 적중(1등!) 달성 전략들 ===');
    for (const r of has6.slice(0, 20)) {
        console.log(`${r.name.padEnd(40)} | avg:${r.avg.toFixed(3)} | 6:${r.hit6} | 5+:${r.hit5} | 4+:${r.hit4}`);
    }
}

// 7개 선택
const seven = results.filter(r => r.pickSize === 7);
seven.sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);

console.log('\n=== 7개 선택 상위 30개 ===');
console.log('순위 | 전략                                    | 평균   | 5+  | 6  | 4+  | 3+  | 분포');
console.log('-'.repeat(120));
for (let i = 0; i < Math.min(30, seven.length); i++) {
    const r = seven[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(40)} | ${r.avg.toFixed(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${String(r.hit4).padStart(3)} | ${String(r.hit3).padStart(3)} | ${r.dist.join(':')}`);
}

// 7개 선택 중 6개 적중 있는 전략
const has6_7 = seven.filter(r => r.hit6 > 0).sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5);
if (has6_7.length > 0) {
    console.log('\n=== 7개 선택 - 6개 적중 달성 전략들 ===');
    for (const r of has6_7.slice(0, 20)) {
        console.log(`${r.name.padEnd(40)} | avg:${r.avg.toFixed(3)} | 6:${r.hit6} | 5+:${r.hit5} | 4+:${r.hit4}`);
    }
}

// 1209회 추천
console.log('\n=== 다음 회차 추천 ===');
const allTops = [...results].sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg).slice(0, 10);
for (const r of allTops) {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 5+:${r.hit5} 6:${r.hit6}`);
        } catch (e) { }
    }
}
