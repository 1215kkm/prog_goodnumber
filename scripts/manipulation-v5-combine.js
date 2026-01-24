/**
 * v5: 최고 전략 조합 최적화
 *
 * v4에서 발견된 최고 패턴들:
 * - lcg_13_17: 5+ 8회 (8%)
 * - lcg_13_31: 5+ 8회 (8%)
 * - depth4-5: 5+ 8회 (8%)
 * - off3_w3-6: 5+ 7회, 6+ 1회!
 * - off4_w4: 5+ 7회
 * - seed13_r3: 5+ 7회
 *
 * 이들을 다양하게 조합하여 5+ 적중률 10% 이상 목표
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

function createStrategies() {
    const strategies = [];

    // === A. LCG + off3 조합 ===
    for (let a of [11, 13, 17, 19]) {
        for (let c of [7, 11, 13, 17, 23, 29, 31]) {
            for (let off of [2, 3, 4]) {
                for (let lcgW of [3, 4, 5, 6]) {
                    for (let offW of [3, 4, 5]) {
                        strategies.push({
                            name: `L${a}_${c}_o${off}_lw${lcgW}_ow${offW}`,
                            fn: (past, round) => {
                                const prev = past[past.length - 1].numbers;
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
                                prev.forEach(n => {
                                    [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                                });
                                return selectFromRanges(scores);
                            }
                        });
                    }
                }
            }
        }
    }

    // === B. LCG + depth 조합 ===
    for (let a of [11, 13, 17]) {
        for (let c of [13, 17, 31]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.5, 0.7]) {
                    for (let lcgW of [3, 4, 5]) {
                        strategies.push({
                            name: `L${a}_${c}_d${depth}_${decay}_lw${lcgW}`,
                            fn: (past, round) => {
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
                                // depth
                                for (let d = 1; d <= Math.min(depth, past.length); d++) {
                                    const prev = past[past.length - d].numbers;
                                    const w = Math.pow(decay, d - 1) * 5;
                                    prev.forEach(n => {
                                        const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += w;
                                        [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] += w * 0.7; });
                                        [-1, 1].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) scores[t] -= w * 0.3; });
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

    // === C. off3 + depth 조합 ===
    for (let off of [3, 4]) {
        for (let offW of [3, 4, 5]) {
            for (let depth of [3, 4, 5]) {
                for (let decay of [0.5, 0.7, 0.8]) {
                    strategies.push({
                        name: `o${off}_w${offW}_d${depth}_${decay}`,
                        fn: (past, round) => {
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            // offset from prev
                            const prev0 = past[past.length - 1].numbers;
                            prev0.forEach(n => {
                                [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += offW; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            // depth complement/±2
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

    // === D. LCG + off3 + depth 3중 조합 ===
    for (let a of [13, 17]) {
        for (let c of [17, 31]) {
            for (let off of [3, 4]) {
                for (let depth of [3, 4, 5]) {
                    for (let lcgW of [3, 4, 5]) {
                        for (let offW of [3, 4]) {
                            strategies.push({
                                name: `T_${a}_${c}_o${off}_d${depth}_l${lcgW}_o${offW}`,
                                fn: (past, round) => {
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
                                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 1.5; });
                                    });
                                    // depth
                                    for (let d = 2; d <= Math.min(depth, past.length); d++) {
                                        const prev = past[past.length - d].numbers;
                                        const w = Math.pow(0.6, d - 1) * 4;
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

    // === E. seed13 + LCG + off3 ===
    for (let seedM of [13, 17, 23]) {
        for (let sRange of [3, 5]) {
            for (let a of [13, 17]) {
                for (let off of [3, 4]) {
                    strategies.push({
                        name: `S${seedM}_r${sRange}_L${a}_o${off}`,
                        fn: (past, round) => {
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const prev = past[past.length - 1].numbers;
                            const seed = ((nextRound * seedM) % 45) + 1;
                            const scores = {};
                            for (let i = 1; i <= 45; i++) {
                                scores[i] = gap[i] * 3 + hot[i];
                                const dist = Math.min(Math.abs(i - seed), 45 - Math.abs(i - seed));
                                if (dist <= sRange) scores[i] += (sRange + 1 - dist) * 1.5;
                            }
                            // LCG
                            for (let k = 0; k < 6; k++) {
                                const lcg = ((a * nextRound + 17 + k * 7) % 45) + 1;
                                scores[lcg] += 4;
                            }
                            // offset
                            prev.forEach(n => {
                                [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 3; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            return selectFromRanges(scores);
                        }
                    });
                }
            }
        }
    }

    // === F. LCG + off3 + 보수 + mod7 전체조합 ===
    for (let a of [13, 17]) {
        for (let c of [17, 31]) {
            for (let off of [3, 4]) {
                for (let cW of [3, 4, 5]) {
                    strategies.push({
                        name: `Full_${a}_${c}_o${off}_c${cW}`,
                        fn: (past, round) => {
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const prev = past[past.length - 1].numbers;
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            // LCG
                            for (let k = 0; k < 6; k++) {
                                const lcg = ((a * nextRound + c + k * 7) % 45) + 1;
                                scores[lcg] += 4;
                            }
                            // offset
                            prev.forEach(n => {
                                [-off, off].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                            });
                            // 보수
                            prev.forEach(n => { const comp = 46 - n; if (comp >= 1 && comp <= 45) scores[comp] += cW; });
                            // mod7
                            const rm = (nextRound % 7) + 1;
                            for (let i = 1; i <= 45; i++) if (i % 7 === rm % 7) scores[i] += 2;
                            return selectFromRanges(scores);
                        }
                    });
                }
            }
        }
    }

    // === G. 투표 메타: 상위 전략들의 투표 ===
    for (let threshold of [2, 3, 4]) {
        strategies.push({
            name: `vote_t${threshold}`,
            fn: (past, round) => {
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const prev = past[past.length - 1].numbers;
                const votes = {};
                for (let i = 1; i <= 45; i++) votes[i] = 0;

                // sub1: lcg_13_17
                const s1 = {};
                for (let i = 1; i <= 45; i++) s1[i] = gap[i] * 3 + hot[i];
                for (let k = 0; k < 6; k++) { const l = ((13 * nextRound + 17 + k * 7) % 45) + 1; s1[l] += 5; }
                selectFromRanges(s1).forEach(n => votes[n] += 2);

                // sub2: off3
                const s2 = {};
                for (let i = 1; i <= 45; i++) s2[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => {
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s2[t] += 4; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s2[t] -= 2; });
                });
                selectFromRanges(s2).forEach(n => votes[n] += 2);

                // sub3: depth4
                const s3 = {};
                for (let i = 1; i <= 45; i++) s3[i] = gap[i] * 3 + hot[i];
                for (let d = 1; d <= 4; d++) {
                    const p = past[past.length - d].numbers;
                    const w = Math.pow(0.5, d - 1) * 5;
                    p.forEach(n => {
                        const c = 46 - n; if (c >= 1 && c <= 45) s3[c] += w;
                        [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) s3[t] += w * 0.7; });
                        [-1, 1].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) s3[t] -= w * 0.3; });
                    });
                }
                selectFromRanges(s3).forEach(n => votes[n] += 2);

                // sub4: seed13
                const s4 = {};
                const seed = ((nextRound * 13) % 45) + 1;
                for (let i = 1; i <= 45; i++) {
                    s4[i] = gap[i] * 3 + hot[i];
                    const dist = Math.min(Math.abs(i - seed), 45 - Math.abs(i - seed));
                    if (dist <= 3) s4[i] += (4 - dist) * 2;
                }
                selectFromRanges(s4).forEach(n => votes[n] += 2);

                // sub5: off4
                const s5 = {};
                for (let i = 1; i <= 45; i++) s5[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => {
                    [-4, 4].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s5[t] += 4; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s5[t] -= 2; });
                });
                selectFromRanges(s5).forEach(n => votes[n] += 2);

                // 투표 + 갭 가중
                const final = {};
                for (let i = 1; i <= 45; i++) {
                    final[i] = votes[i] >= threshold ? votes[i] * 3 + gap[i] * 2 : gap[i];
                }
                return selectFromRanges(final);
            }
        });
    }

    // === H. 투표 메타: 확장 선택 ===
    for (let pickN of [8, 10, 12, 15]) {
        strategies.push({
            name: `vote_pick${pickN}`,
            fn: (past, round) => {
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const prev = past[past.length - 1].numbers;
                const votes = {};
                for (let i = 1; i <= 45; i++) votes[i] = 0;

                // 5개 하위전략 투표
                // sub1: lcg_13_17
                const s1 = {};
                for (let i = 1; i <= 45; i++) s1[i] = gap[i] * 3 + hot[i];
                for (let k = 0; k < 6; k++) { s1[((13 * nextRound + 17 + k * 7) % 45) + 1] += 5; }
                selectTopN(s1, 10).forEach(n => votes[n] += 2);

                // sub2: off3
                const s2 = {};
                for (let i = 1; i <= 45; i++) s2[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => { [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s2[t] += 5; }); });
                selectTopN(s2, 10).forEach(n => votes[n] += 2);

                // sub3: depth5
                const s3 = {};
                for (let i = 1; i <= 45; i++) s3[i] = gap[i] * 3 + hot[i];
                for (let d = 1; d <= 5; d++) {
                    past[past.length - d].numbers.forEach(n => {
                        const c = 46 - n; if (c >= 1 && c <= 45) s3[c] += 5 / d;
                        [-2, 2].forEach(o => { const t = n + o; if (t >= 1 && t <= 45) s3[t] += 3 / d; });
                    });
                }
                selectTopN(s3, 10).forEach(n => votes[n] += 2);

                // sub4: lcg_13_31
                const s4 = {};
                for (let i = 1; i <= 45; i++) s4[i] = gap[i] * 3 + hot[i];
                for (let k = 0; k < 6; k++) { s4[((13 * nextRound + 31 + k * 7) % 45) + 1] += 5; }
                selectTopN(s4, 10).forEach(n => votes[n] += 2);

                // sub5: off4
                const s5 = {};
                for (let i = 1; i <= 45; i++) s5[i] = gap[i] * 3 + hot[i];
                prev.forEach(n => { [-4, 4].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) s5[t] += 5; }); });
                selectTopN(s5, 10).forEach(n => votes[n] += 2);

                const final = {};
                for (let i = 1; i <= 45; i++) final[i] = votes[i] * 3 + gap[i] * 2 + hot[i];
                return selectTopN(final, pickN);
            }
        });
    }

    // === I. 합계 필터 + 최고 조합 ===
    for (let sMin of [100, 110, 121]) {
        for (let sMax of [160, 170, 180]) {
            strategies.push({
                name: `sum${sMin}_${sMax}_best`,
                fn: (past, round) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const prev = past[past.length - 1].numbers;
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                    // LCG 13,17
                    for (let k = 0; k < 6; k++) { scores[((13 * nextRound + 17 + k * 7) % 45) + 1] += 5; }
                    // off3
                    prev.forEach(n => {
                        [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    // depth3
                    for (let d = 1; d <= 3; d++) {
                        const p = past[past.length - d].numbers;
                        const w = 4 / d;
                        p.forEach(n => { const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += w; });
                    }
                    const cands = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => parseInt(e[0]));
                    return filterBySum(cands, scores, sMin, sMax);
                }
            });
        }
    }

    // === J. LCG k값 변형 ===
    for (let a of [13, 17]) {
        for (let c of [17, 31]) {
            for (let kStep of [3, 5, 7, 9, 11, 13]) {
                for (let nK of [4, 6, 8, 10]) {
                    strategies.push({
                        name: `LK_${a}_${c}_s${kStep}_n${nK}`,
                        fn: (past, round) => {
                            const nextRound = past[past.length - 1].round + 1;
                            const gap = getGapScores(past);
                            const hot = getHot(past, 20);
                            const scores = {};
                            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];
                            for (let k = 0; k < nK; k++) {
                                const lcg = ((a * nextRound + c + k * kStep) % 45) + 1;
                                scores[lcg] += 5;
                            }
                            return selectFromRanges(scores);
                        }
                    });
                }
            }
        }
    }

    // === K. 다중 LCG (서로 다른 파라미터) ===
    const lcgPairs = [[13, 17], [13, 31], [17, 7], [17, 29], [11, 7], [19, 31]];
    for (let i = 0; i < lcgPairs.length - 1; i++) {
        for (let j = i + 1; j < lcgPairs.length; j++) {
            strategies.push({
                name: `ML_${lcgPairs[i].join('_')}_${lcgPairs[j].join('_')}`,
                fn: (past, round) => {
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i2 = 1; i2 <= 45; i2++) scores[i2] = gap[i2] * 3 + hot[i2];
                    // First LCG
                    for (let k = 0; k < 6; k++) {
                        scores[((lcgPairs[i][0] * nextRound + lcgPairs[i][1] + k * 7) % 45) + 1] += 4;
                    }
                    // Second LCG
                    for (let k = 0; k < 6; k++) {
                        scores[((lcgPairs[j][0] * nextRound + lcgPairs[j][1] + k * 7) % 45) + 1] += 4;
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    return strategies;
}

// 백테스트
console.log(`총 ${allResults.length}개 회차 | 테스트: 최근 ${TEST_COUNT}회\n`);

const strategies = createStrategies();
console.log(`총 ${strategies.length}개 전략 테스트 중...\n`);

const results = [];

for (const strategy of strategies) {
    let totalHit = 0;
    let hit3 = 0, hit4 = 0, hit5 = 0, hit6 = 0;
    const dist = [0, 0, 0, 0, 0, 0, 0];
    let fiveRounds = [];

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
            if (hits >= 5) { hit5++; fiveRounds.push(allResults[i].round); }
            if (hits >= 6) hit6++;
        } catch (e) {
            continue;
        }
    }

    const avg = totalHit / TEST_COUNT;
    const pickSize = (() => {
        try { return strategy.fn(allResults.slice(0, testStart), 999).length; } catch { return 6; }
    })();

    results.push({ name: strategy.name, avg, hit3, hit4, hit5, hit6, dist, pickSize, fiveRounds });
}

// 6개 선택
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.avg - a.avg);

console.log('=== 6개 선택 상위 30개 (평균순) ===');
console.log('순위 | 전략                              | 평균   | 3+  | 4+  | 5+  | 6  | 분포');
console.log('-'.repeat(110));
for (let i = 0; i < Math.min(30, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(34)} | ${r.avg.toFixed(3)} | ${String(r.hit3).padStart(3)} | ${String(r.hit4).padStart(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${r.dist.join(':')}`);
}

// 5+ 기준
const by5 = [...six].sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);
console.log('\n=== 5개+ 적중 기준 상위 20개 ===');
for (let i = 0; i < Math.min(20, by5.length); i++) {
    const r = by5[i];
    if (r.hit5 === 0 && i > 3) break;
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(34)} | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 6:${r.hit6} | 4+:${r.hit4} | 회차:${r.fiveRounds.join(',')}`);
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n=== 확장 선택 ===');
for (const r of multi) {
    console.log(`${r.name.padEnd(20)} (${r.pickSize}개) | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4} | 6:${r.hit6}`);
}

// 1209회 추천
console.log('\n=== 1209회 추천 (상위 전략) ===');
const tops = [...results].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg).slice(0, 12);
for (const r of tops) {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults, allResults[allResults.length - 1].round + 1);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 5+:${r.hit5} 6:${r.hit6}`);
        } catch (e) { }
    }
}
