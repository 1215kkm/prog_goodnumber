/**
 * v4: v2의 핵심 로직(gap 범위 필터 + ratio*10 스케일링) 기반으로
 * 수백 가지 파라미터 조합 브루트포스
 * 목표: 5개 이상 적중 최대화
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

// v2 핵심 함수들 (검증됨)
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

function digitalRoot(n) { return n < 10 ? n : digitalRoot(n.toString().split('').reduce((a, d) => a + parseInt(d), 0)); }

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

function filterBySum(cands, scores, min, max, n = 6, att = 2000) {
    let best = cands.slice(0, n), bs = -1;
    for (let a = 0; a < att; a++) {
        const sh = [...cands].sort(() => Math.random() - 0.5).slice(0, n);
        const s = sh.reduce((x, y) => x + y, 0);
        if (s >= min && s <= max) {
            const sc = sh.reduce((x, y) => x + (scores[y] || 0), 0);
            if (sc > bs) { bs = sc; best = sh; }
        }
    }
    return best.sort((a, b) => a - b);
}

// ===== 전략 팩토리 =====
function createStrategies() {
    const strategies = [];

    // === 핵심 파라미터 변형 ===
    // gapWeight, hotWindow, hotWeight, compWeight, pm2Weight, pm1Penalty, modN, modWeight, lcgA, lcgC, lcgWeight, drWeight

    // 1. 간격 범위 변형
    for (let minR of [0.6, 0.7, 0.8, 0.9, 1.0]) {
        for (let maxR of [1.8, 2.0, 2.5, 3.0, 4.0]) {
            strategies.push({
                name: `gap_${minR}_${maxR}`,
                fn: (past, round) => {
                    const gap = getGapScores(past, minR, maxR);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 2. 간격+보수 가중치 변형
    for (let gW of [2, 3, 4, 5]) {
        for (let cW of [3, 4, 5, 6, 8, 10]) {
            strategies.push({
                name: `comp_g${gW}_c${cW}`,
                fn: (past, round) => {
                    const prev = past[past.length - 1].numbers;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * gW + hot[i];
                    prev.forEach(n => { const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += cW; });
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 3. 간격+±2 가중치 변형
    for (let gW of [2, 3, 4, 5]) {
        for (let p2W of [3, 4, 5, 6, 8]) {
            for (let p1P of [1, 2, 3, 5]) {
                strategies.push({
                    name: `pm2_g${gW}_p${p2W}_m${p1P}`,
                    fn: (past, round) => {
                        const prev = past[past.length - 1].numbers;
                        const gap = getGapScores(past);
                        const hot = getHot(past, 20);
                        const scores = {};
                        for (let i = 1; i <= 45; i++) scores[i] = gap[i] * gW + hot[i];
                        prev.forEach(n => {
                            [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += p2W; });
                            [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= p1P; });
                        });
                        return selectFromRanges(scores);
                    }
                });
            }
        }
    }

    // 4. mod N 변형
    for (let modN of [5, 6, 7, 8, 9, 11, 13]) {
        for (let mW of [3, 4, 5, 6, 8]) {
            strategies.push({
                name: `mod${modN}_w${mW}`,
                fn: (past, round) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    const rm = (nextRound % modN) + 1;
                    for (let i = 1; i <= 45; i++) if (i % modN === rm % modN) scores[i] += mW;
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 5. LCG 변형
    for (let a of [3, 5, 7, 9, 11, 13, 17, 19]) {
        for (let c of [7, 11, 13, 17, 23, 29, 31]) {
            strategies.push({
                name: `lcg_${a}_${c}`,
                fn: (past, round) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    for (let k = 0; k < 6; k++) {
                        const lcg = ((a * nextRound + c + k * 7) % 45) + 1;
                        scores[lcg] += 5;
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 6. 복합: 보수+±2+mod7
    for (let cW of [3, 4, 5, 6]) {
        for (let p2W of [3, 4, 5]) {
            for (let mW of [2, 3, 4]) {
                strategies.push({
                    name: `cpm_c${cW}_p${p2W}_m${mW}`,
                    fn: (past, round) => {
                        const prev = past[past.length - 1].numbers;
                        const nextRound = past[past.length - 1].round + 1;
                        const gap = getGapScores(past);
                        const hot = getHot(past, 20);
                        const scores = {};
                        for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                        prev.forEach(n => {
                            const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += cW;
                            [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += p2W; });
                            [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                        });
                        const rm = (nextRound % 7) + 1;
                        for (let i = 1; i <= 45; i++) if (i % 7 === rm % 7) scores[i] += mW;
                        return selectFromRanges(scores);
                    }
                });
            }
        }
    }

    // 7. 전체 조합 가중치 변형
    for (let cW of [3, 4, 5]) {
        for (let p2W of [2, 3, 4]) {
            for (let lcgW of [2, 3, 4]) {
                for (let mW of [2, 3]) {
                    strategies.push({
                        name: `all_c${cW}p${p2W}l${lcgW}m${mW}`,
                        fn: (past, round) => {
                            const prev = past[past.length - 1].numbers;
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            prev.forEach(n => {
                                const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += cW;
                                [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += p2W; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 1; });
                            });
                            for (let k = 0; k < 6; k++) {
                                const lcg = ((9 * nextRound + 11 + k * 7) % 45) + 1;
                                scores[lcg] += lcgW;
                            }
                            const rm = (nextRound % 7) + 1;
                            for (let i = 1; i <= 45; i++) {
                                if (i % 7 === rm % 7) scores[i] += mW;
                                if (digitalRoot(i) >= 7) scores[i] += 2;
                            }
                            return selectFromRanges(scores);
                        }
                    });
                }
            }
        }
    }

    // 8. hot window 변형
    for (let hw of [5, 10, 15, 20, 30, 50]) {
        for (let hW of [0.5, 1.0, 1.5, 2.0, 3.0]) {
            strategies.push({
                name: `hot_w${hw}_${hW}`,
                fn: (past, round) => {
                    const gap = getGapScores(past);
                    const hot = getHot(past, hw);
                    const prev = past[past.length - 1].numbers;
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i] * hW;
                    prev.forEach(n => {
                        const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 5;
                        [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 9. 합계 필터 + 전체조합 변형
    for (let sMin of [100, 110, 121, 130]) {
        for (let sMax of [155, 160, 170, 180]) {
            if (sMax - sMin < 30) continue;
            strategies.push({
                name: `sum_${sMin}_${sMax}`,
                fn: (past, round) => {
                    const prev = past[past.length - 1].numbers;
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    prev.forEach(n => {
                        const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 4;
                        [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 3; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 1; });
                    });
                    for (let k = 0; k < 6; k++) {
                        const lcg = ((9 * nextRound + 11 + k * 7) % 45) + 1;
                        scores[lcg] += 3;
                    }
                    const rm = (nextRound % 7) + 1;
                    for (let i = 1; i <= 45; i++) { if (i % 7 === rm % 7) scores[i] += 2; if (digitalRoot(i) >= 7) scores[i] += 2; }
                    const cands = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
                    return filterBySum(cands, scores, sMin, sMax);
                }
            });
        }
    }

    // 10. 이전 2~5회차 보수/±2 가중
    for (let depth of [2, 3, 4, 5]) {
        for (let decayFactor of [0.5, 0.7, 0.8]) {
            strategies.push({
                name: `depth${depth}_d${decayFactor}`,
                fn: (past, round) => {
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    for (let d = 1; d <= Math.min(depth, past.length); d++) {
                        const prev = past[past.length - d].numbers;
                        const w = Math.pow(decayFactor, d - 1) * 5;
                        prev.forEach(n => {
                            const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += w;
                            [-2, 2].forEach(off => { const t = n + off; if (t >= 1 && t <= 45) scores[t] += w * 0.7; });
                            [-1, 1].forEach(off => { const t = n + off; if (t >= 1 && t <= 45) scores[t] -= w * 0.3; });
                        });
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 11. XOR 패턴 + 간격
    for (let xv of [3, 5, 7, 11, 13, 17, 21, 31, 42]) {
        strategies.push({
            name: `xor${xv}`,
            fn: (past, round) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const prev = past[past.length - 1].numbers;
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                prev.forEach(p => {
                    let x = (p ^ xv);
                    x = ((x - 1 + 45) % 45) + 1;
                    scores[x] += 5;
                });
                return selectFromRanges(scores);
            }
        });
    }

    // 12. 피보나치 오프셋 + 간격
    const fibs = [1, 2, 3, 5, 8, 13, 21];
    for (let fc of [2, 3, 4, 5]) {
        for (let fw of [2, 3, 4, 5]) {
            strategies.push({
                name: `fib${fc}_w${fw}`,
                fn: (past, round) => {
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const prev = past[past.length - 1].numbers;
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    prev.forEach(p => {
                        for (let fi = 0; fi < fc; fi++) {
                            let t1 = ((p + fibs[fi] - 1) % 45) + 1;
                            let t2 = ((p - fibs[fi] - 1 + 45) % 45) + 1;
                            scores[t1] += fw;
                            scores[t2] += fw;
                        }
                    });
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 13. 회차 시드 기반
    for (let m of [3, 7, 11, 13, 17, 23, 29, 37, 41]) {
        for (let range of [3, 5, 7]) {
            strategies.push({
                name: `seed${m}_r${range}`,
                fn: (past, round) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const seed = ((nextRound * m) % 45) + 1;
                    const scores = {};
                    for (let i = 1; i <= 45; i++) {
                        scores[i] = gap[i] * 3 + hot[i];
                        const dist = Math.min(Math.abs(i - seed), 45 - Math.abs(i - seed));
                        if (dist <= range) scores[i] += (range + 1 - dist) * 2;
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 14. 소수 패턴
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
    for (let pw of [2, 3, 4, 5]) {
        strategies.push({
            name: `prime_w${pw}`,
            fn: (past, round) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) {
                    scores[i] = gap[i] * 3 + hot[i];
                    if (primes.includes(i)) scores[i] += pw;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 15. 확장 선택 (10, 15, 20)
    for (let pickN of [10, 15, 20]) {
        strategies.push({
            name: `pick${pickN}`,
            fn: (past, round) => {
                const prev = past[past.length - 1].numbers;
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => {
                    const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 5;
                    [-2, 2].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                });
                for (let k = 0; k < 6; k++) {
                    const lcg = ((9 * nextRound + 11 + k * 7) % 45) + 1;
                    scores[lcg] += 3;
                }
                const rm = (nextRound % 7) + 1;
                for (let i = 1; i <= 45; i++) { if (i % 7 === rm % 7) scores[i] += 3; if (digitalRoot(i) >= 7) scores[i] += 2; }
                return selectTopN(scores, pickN);
            }
        });
    }

    // 16. ±3, ±4, ±5 오프셋
    for (let off of [3, 4, 5]) {
        for (let w of [3, 4, 5, 6]) {
            strategies.push({
                name: `off${off}_w${w}`,
                fn: (past, round) => {
                    const prev = past[past.length - 1].numbers;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    prev.forEach(n => {
                        [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += w; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 17. 보너스번호 기반
    for (let bW of [3, 5, 7, 10]) {
        strategies.push({
            name: `bonus_w${bW}`,
            fn: (past, round) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                // 최근 5회 보너스번호 기반
                for (let d = 1; d <= 5; d++) {
                    const b = past[past.length - d].bonus;
                    const w = bW / d;
                    scores[b] += w;
                    const c = 46 - b; if (c >= 1 && c <= 45) scores[c] += w * 0.7;
                    [-2, 2].forEach(off => { const t = b + off; if (t >= 1 && t <= 45) scores[t] += w * 0.5; });
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 18. 곱셈 패턴
    for (let mult of [2, 3, 5, 7]) {
        strategies.push({
            name: `mult${mult}`,
            fn: (past, round) => {
                const prev = past[past.length - 1].numbers;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => {
                    const t = ((n * mult - 1) % 45) + 1;
                    scores[t] += 5;
                    const t2 = ((Math.floor(n / mult) + n) % 45) + 1;
                    scores[t2] += 3;
                });
                return selectFromRanges(scores);
            }
        });
    }

    return strategies;
}

// 백테스트 실행
console.log(`총 ${allResults.length}개 회차 | 테스트: 최근 ${TEST_COUNT}회\n`);

const strategies = createStrategies();
console.log(`총 ${strategies.length}개 전략 테스트 중...\n`);

const results = [];

for (const strategy of strategies) {
    let totalHit = 0;
    let hit3 = 0, hit4 = 0, hit5 = 0, hit6 = 0;
    const dist = [0, 0, 0, 0, 0, 0, 0];

    for (let i = testStart; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        const actual = allResults[i].numbers;

        try {
            const predicted = strategy.fn(past, allResults[i].round);
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
        try { return strategy.fn(allResults.slice(0, testStart), 999).length; } catch { return 6; }
    })();

    results.push({ name: strategy.name, avg, hit3, hit4, hit5, hit6, dist, pickSize });
}

// 6개 선택만
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.avg - a.avg);

console.log('=== 6개 선택 상위 40개 (평균 적중순) ===');
console.log('순위 | 전략                          | 평균   | 3+  | 4+  | 5+  | 6  | 분포');
console.log('-'.repeat(105));
for (let i = 0; i < Math.min(40, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | ${r.avg.toFixed(3)} | ${String(r.hit3).padStart(3)} | ${String(r.hit4).padStart(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${r.dist.join(':')}`);
}

// 5+ 기준
const by5 = [...six].sort((a, b) => b.hit5 - a.hit5 || b.hit4 - a.hit4 || b.avg - a.avg);
console.log('\n=== 5개+ 적중 기준 상위 20개 ===');
for (let i = 0; i < Math.min(20, by5.length); i++) {
    const r = by5[i];
    if (r.hit5 === 0 && i > 5) break;
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4} | 3+:${r.hit3} | 분포:${r.dist.join(':')}`);
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n=== 확장 선택 ===');
for (const r of multi) {
    console.log(`${r.name.padEnd(15)} (${r.pickSize}개) | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4} | 3+:${r.hit3} | 6:${r.hit6}`);
}

// 4+ 기준 (5+ 없을 경우를 대비)
const by4 = [...six].sort((a, b) => b.hit4 - a.hit4 || b.avg - a.avg);
console.log('\n=== 4개+ 적중 기준 상위 15개 ===');
for (let i = 0; i < Math.min(15, by4.length); i++) {
    const r = by4[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | avg:${r.avg.toFixed(3)} | 4+:${r.hit4} | 5+:${r.hit5} | 분포:${r.dist.join(':')}`);
}

// 1209회 추천
console.log('\n=== 1209회 추천 ===');
const tops = [...results].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg).slice(0, 10);
for (const r of tops) {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults, allResults[allResults.length - 1].round + 1);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 5+:${r.hit5}`);
        } catch (e) { }
    }
}
