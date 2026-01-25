/**
 * v7: 새로운 패턴 탐색
 *
 * 새로운 아이디어:
 * 1. 연속 출현 패턴 (같은 번호가 연속 회차에 나오는 경향)
 * 2. 거울 패턴 (이전 회차 번호들의 대칭)
 * 3. 합/차 패턴 (이전 번호들의 합/차로 생성)
 * 4. 골든비율 오프셋
 * 5. 번호 간격 패턴 (당첨번호 6개 사이의 간격)
 * 6. 끝자리 패턴
 * 7. 소수 vs 합성수 비율
 * 8. 홀짝 교대 패턴
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
        numbers: [parseInt(match[5]), parseInt(match[6]), parseInt(match[7]), parseInt(match[8]), parseInt(match[9]), parseInt(match[10])],
        bonus: parseInt(match[11])
    });
}
allResults.sort((a, b) => a.round - b.round);

const TEST_COUNT = 100;
const testStart = allResults.length - TEST_COUNT;

// 기본 유틸리티
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

// ========== 새로운 패턴 전략들 ==========

function createStrategies() {
    const strategies = [];
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
    const golden = 1.618;

    // 1. 연속 출현 보너스 (같은 번호가 최근 N회 연속 출현하면 가점)
    for (let window of [3, 5, 7, 10]) {
        for (let bonus of [3, 5, 7, 10]) {
            strategies.push({
                name: `repeat_w${window}_b${bonus}`,
                fn: (past) => {
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                    // 최근 window회 연속 출현 체크
                    const recent = past.slice(-window);
                    const streaks = {};
                    for (let i = 1; i <= 45; i++) {
                        streaks[i] = recent.filter(r => r.numbers.includes(i)).length;
                        if (streaks[i] >= 2) scores[i] += bonus * (streaks[i] - 1);
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 2. 끝자리 패턴 (특정 끝자리가 더 많이 나오는지)
    for (let targetDigit of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        strategies.push({
            name: `digit_${targetDigit}`,
            fn: (past) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) {
                    scores[i] = gap[i] * 3 + hot[i];
                    if (i % 10 === targetDigit) scores[i] += 5;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 3. 골든비율 오프셋
    for (let mult of [1, 2, 3]) {
        strategies.push({
            name: `golden_m${mult}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                prev.forEach(n => {
                    const g1 = Math.round(n * golden * mult) % 45 + 1;
                    const g2 = Math.round(n / golden * mult) % 45 + 1;
                    if (g1 >= 1 && g1 <= 45) scores[g1] += 4;
                    if (g2 >= 1 && g2 <= 45) scores[g2] += 4;
                });
                return selectFromRanges(scores);
            }
        });
    }

    // 4. 합/차 패턴 (이전 번호 쌍의 합/차)
    for (let sumW of [2, 3, 4, 5]) {
        for (let diffW of [2, 3, 4, 5]) {
            strategies.push({
                name: `sumdiff_s${sumW}_d${diffW}`,
                fn: (past) => {
                    const prev = past[past.length - 1].numbers;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                    for (let i = 0; i < prev.length; i++) {
                        for (let j = i + 1; j < prev.length; j++) {
                            const sum = (prev[i] + prev[j]) % 45 + 1;
                            const diff = Math.abs(prev[i] - prev[j]);
                            if (sum >= 1 && sum <= 45) scores[sum] += sumW;
                            if (diff >= 1 && diff <= 45) scores[diff] += diffW;
                        }
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 5. 번호 간격 패턴 (당첨번호 6개 사이의 간격이 비슷하게 유지되는 경향)
    strategies.push({
        name: `spacing_even`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // 이상적인 간격: 45/6 ≈ 7.5
            // 1, 8, 15, 22, 29, 36 근처에 가점
            const idealSpacing = [1, 8, 15, 22, 29, 36, 43];
            idealSpacing.forEach(n => {
                if (n >= 1 && n <= 45) scores[n] += 4;
                if (n + 1 <= 45) scores[n + 1] += 2;
                if (n - 1 >= 1) scores[n - 1] += 2;
            });
            return selectFromRanges(scores);
        }
    });

    // 6. 소수 비율 강제 (보통 2~3개의 소수가 포함됨)
    for (let primeBonus of [3, 5, 7]) {
        strategies.push({
            name: `prime_b${primeBonus}`,
            fn: (past) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) {
                    scores[i] = gap[i] * 3 + hot[i];
                    if (primes.includes(i)) scores[i] += primeBonus;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 7. 홀짝 교대 선호
    for (let altBonus of [2, 3, 4, 5]) {
        strategies.push({
            name: `oddeven_alt_${altBonus}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // 이전 회차 홀짝 비율 계산
                const oddCount = prev.filter(n => n % 2 === 1).length;
                // 3:3 균형 선호, 현재와 반대로 가점
                if (oddCount > 3) {
                    // 홀수가 많았으면 짝수에 가점
                    for (let i = 2; i <= 44; i += 2) scores[i] += altBonus;
                } else if (oddCount < 3) {
                    // 짝수가 많았으면 홀수에 가점
                    for (let i = 1; i <= 45; i += 2) scores[i] += altBonus;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 8. 거울 패턴 (23을 기준으로 대칭)
    for (let mirrorW of [3, 4, 5, 6]) {
        strategies.push({
            name: `mirror_${mirrorW}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // 거울: 23을 중심으로 대칭
                prev.forEach(n => {
                    const mirror = 46 - n; // 이건 보수
                    const center23 = 46 - n; // 23 중심
                    if (mirror >= 1 && mirror <= 45) scores[mirror] += mirrorW;
                });
                return selectFromRanges(scores);
            }
        });
    }

    // 9. 이전 회차 번호 간격 유지
    for (let gapKeepW of [3, 4, 5]) {
        strategies.push({
            name: `keepgap_${gapKeepW}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers.sort((a, b) => a - b);
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // 이전 번호들 간의 간격 계산
                const gaps = [];
                for (let i = 1; i < prev.length; i++) {
                    gaps.push(prev[i] - prev[i - 1]);
                }

                // 비슷한 간격을 유지하는 번호 조합에 가점
                // 첫 번호 후보들
                for (let start = 1; start <= 10; start++) {
                    let valid = true;
                    let current = start;
                    for (const g of gaps) {
                        current += g;
                        if (current > 45) { valid = false; break; }
                    }
                    if (valid) {
                        let c = start;
                        scores[c] += gapKeepW;
                        for (const g of gaps) {
                            c += g;
                            if (c >= 1 && c <= 45) scores[c] += gapKeepW;
                        }
                    }
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 10. 평균 회귀 (평균에서 많이 벗어난 번호는 돌아올 가능성)
    for (let regW of [3, 5, 7]) {
        strategies.push({
            name: `regression_${regW}`,
            fn: (past) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 50);
                const scores = {};

                // 전체 기대 출현 횟수
                const expected = past.length * 6 / 45;
                const freq = {};
                for (let i = 1; i <= 45; i++) freq[i] = 0;
                past.forEach(r => r.numbers.forEach(n => freq[n]++));

                for (let i = 1; i <= 45; i++) {
                    scores[i] = gap[i] * 3;
                    // 기대값보다 적게 나온 번호에 가점
                    const diff = expected - freq[i];
                    if (diff > 0) scores[i] += Math.min(diff, 10) * regW / 10;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 11. 최근 미출현 + ±3 + 보수 조합 (v6 베스트에 변형)
    for (let noShowW of [5, 10, 15]) {
        for (let off3W of [4, 5, 6]) {
            strategies.push({
                name: `noshow${noShowW}_off${off3W}`,
                fn: (past) => {
                    const prev = past[past.length - 1].numbers;
                    const gap = getGapScores(past);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3;

                    // 최근 noShowW회 미출현 번호
                    const recent = past.slice(-noShowW);
                    const appeared = new Set();
                    recent.forEach(r => r.numbers.forEach(n => appeared.add(n)));
                    for (let i = 1; i <= 45; i++) {
                        if (!appeared.has(i)) scores[i] += 5;
                    }

                    // ±3 오프셋
                    prev.forEach(n => {
                        [-3, 3].forEach(d => {
                            const t = n + d;
                            if (t >= 1 && t <= 45) scores[t] += off3W;
                        });
                        [-1, 1].forEach(d => {
                            const t = n + d;
                            if (t >= 1 && t <= 45) scores[t] -= 2;
                        });
                    });

                    // 보수
                    prev.forEach(n => {
                        const c = 46 - n;
                        if (c >= 1 && c <= 45) scores[c] += 4;
                    });

                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 12. 구간 로테이션 (어떤 구간이 오래 안 나왔으면 그 구간 선호)
    strategies.push({
        name: `range_rotation`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
            const rangeLastSeen = [0, 0, 0, 0, 0];

            // 각 구간이 마지막으로 많이 나온 회차
            past.forEach((r, idx) => {
                ranges.forEach(([min, max], ri) => {
                    const count = r.numbers.filter(n => n >= min && n <= max).length;
                    if (count >= 2) rangeLastSeen[ri] = idx;
                });
            });

            // 오래 안 나온 구간에 가점
            const maxIdx = past.length - 1;
            ranges.forEach(([min, max], ri) => {
                const gap = maxIdx - rangeLastSeen[ri];
                if (gap > 5) {
                    for (let n = min; n <= max; n++) scores[n] += gap * 0.5;
                }
            });

            return selectFromRanges(scores);
        }
    });

    // 13. 번호 쌍 추적 (자주 같이 나오는 쌍)
    strategies.push({
        name: `pair_tracking`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const prev = past[past.length - 1].numbers;
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // 쌍 빈도 계산
            const pairFreq = {};
            past.forEach(r => {
                for (let i = 0; i < r.numbers.length; i++) {
                    for (let j = i + 1; j < r.numbers.length; j++) {
                        const key = `${Math.min(r.numbers[i], r.numbers[j])}_${Math.max(r.numbers[i], r.numbers[j])}`;
                        pairFreq[key] = (pairFreq[key] || 0) + 1;
                    }
                }
            });

            // 이전 번호와 자주 같이 나온 번호에 가점
            prev.forEach(p => {
                for (let n = 1; n <= 45; n++) {
                    if (n === p) continue;
                    const key = `${Math.min(p, n)}_${Math.max(p, n)}`;
                    const freq = pairFreq[key] || 0;
                    if (freq >= 3) scores[n] += freq * 0.5;
                }
            });

            return selectFromRanges(scores);
        }
    });

    // 14. 연속번호 회피/선호
    for (let consec of [-3, -2, 2, 3]) {
        strategies.push({
            name: `consecutive_${consec > 0 ? 'p' : 'm'}${Math.abs(consec)}`,
            fn: (past) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // 연속번호 쌍에 가점/감점
                for (let i = 1; i < 45; i++) {
                    if (scores[i] > 5 && scores[i + 1] > 5) {
                        scores[i] += consec;
                        scores[i + 1] += consec;
                    }
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 15. 확장 선택 버전
    for (let pickN of [8, 10, 12, 15]) {
        strategies.push({
            name: `ext_best_${pickN}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // LCG
                for (let k = 0; k < 6; k++) {
                    const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                    scores[lcg] += 4;
                }

                // ±3
                prev.forEach(n => {
                    [-3, 3].forEach(d => {
                        const t = n + d;
                        if (t >= 1 && t <= 45) scores[t] += 5;
                    });
                    [-1, 1].forEach(d => {
                        const t = n + d;
                        if (t >= 1 && t <= 45) scores[t] -= 2;
                    });
                });

                // 보수
                prev.forEach(n => {
                    const c = 46 - n;
                    if (c >= 1 && c <= 45) scores[c] += 4;
                });

                // 미출현 보너스
                const recent10 = past.slice(-10);
                const appeared = new Set();
                recent10.forEach(r => r.numbers.forEach(n => appeared.add(n)));
                for (let i = 1; i <= 45; i++) {
                    if (!appeared.has(i)) scores[i] += 3;
                }

                return selectTopN(scores, pickN);
            }
        });
    }

    // 16. v6 최강 전략 + 새 요소 조합
    for (let noShowW of [5, 10]) {
        for (let pairW of [2, 3]) {
            strategies.push({
                name: `v6plus_ns${noShowW}_pw${pairW}`,
                fn: (past) => {
                    const prev = past[past.length - 1].numbers;
                    const nextRound = past[past.length - 1].round + 1;
                    const gap = getGapScores(past);
                    const hot = getHot(past, 20);
                    const scores = {};
                    for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                    // v6 Triple 요소들
                    // LCG
                    for (let k = 0; k < 6; k++) {
                        const lcg = ((13 * nextRound + 31 + k * 7) % 45) + 1;
                        scores[lcg] += 4;
                    }
                    // ±3, ±1회피
                    prev.forEach(n => {
                        [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                        [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    });
                    // depth 보수
                    for (let d = 2; d <= 3; d++) {
                        const prevD = past[past.length - d].numbers;
                        const w = Math.pow(0.6, d - 1) * 4;
                        prevD.forEach(n => {
                            const comp = 46 - n;
                            if (comp >= 1 && comp <= 45) scores[comp] += w;
                        });
                    }

                    // 새 요소: 미출현
                    const recent = past.slice(-noShowW);
                    const appeared = new Set();
                    recent.forEach(r => r.numbers.forEach(n => appeared.add(n)));
                    for (let i = 1; i <= 45; i++) {
                        if (!appeared.has(i)) scores[i] += 3;
                    }

                    // 새 요소: 쌍 추적
                    const pairFreq = {};
                    past.slice(-50).forEach(r => {
                        for (let i = 0; i < r.numbers.length; i++) {
                            for (let j = i + 1; j < r.numbers.length; j++) {
                                const key = `${Math.min(r.numbers[i], r.numbers[j])}_${Math.max(r.numbers[i], r.numbers[j])}`;
                                pairFreq[key] = (pairFreq[key] || 0) + 1;
                            }
                        }
                    });
                    prev.forEach(p => {
                        for (let n = 1; n <= 45; n++) {
                            if (n === p) continue;
                            const key = `${Math.min(p, n)}_${Math.max(p, n)}`;
                            if ((pairFreq[key] || 0) >= 3) scores[n] += pairW;
                        }
                    });

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
console.log(`총 ${strategies.length}개 전략 테스트\n`);

const results = [];

for (const strategy of strategies) {
    let totalHit = 0;
    let hit3 = 0, hit4 = 0, hit5 = 0, hit6 = 0;
    const dist = [0, 0, 0, 0, 0, 0, 0];
    const hit5rounds = [];

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
            if (hits >= 5) { hit5++; hit5rounds.push(allResults[i].round); }
            if (hits >= 6) hit6++;
        } catch (e) {
            continue;
        }
    }

    const avg = totalHit / TEST_COUNT;
    const pickSize = (() => {
        try { return strategy.fn(allResults.slice(0, testStart)).length; } catch { return 6; }
    })();

    results.push({ name: strategy.name, avg, hit3, hit4, hit5, hit6, dist, pickSize, hit5rounds });
}

// 결과 출력
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);

console.log('=== 6개 선택 - 5+적중 기준 상위 30개 ===');
console.log('순위 | 전략                         | 평균   | 5+  | 6  | 4+  | 3+  | 분포');
console.log('-'.repeat(100));
for (let i = 0; i < Math.min(30, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(28)} | ${r.avg.toFixed(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${String(r.hit4).padStart(3)} | ${String(r.hit3).padStart(3)} | ${r.dist.join(':')}`);
}

// 6개 적중 있는 전략
const has6 = six.filter(r => r.hit6 > 0);
if (has6.length > 0) {
    console.log('\n=== 6개(1등!) 적중 전략 ===');
    has6.forEach(r => console.log(`${r.name}: 6개 ${r.hit6}회, 5+ ${r.hit5}회, avg ${r.avg.toFixed(3)}`));
}

// 평균 최고
six.sort((a, b) => b.avg - a.avg);
console.log('\n=== 평균 적중 기준 상위 15개 ===');
for (let i = 0; i < Math.min(15, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(28)} | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4}`);
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n=== 확장 선택 ===');
multi.forEach(r => console.log(`${r.name.padEnd(20)} (${r.pickSize}개) | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 6:${r.hit6} | 4+:${r.hit4}`));

// 1209회 추천
console.log('\n=== 1209회 추천 (5+ 기준 상위) ===');
const tops = [...results].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg).slice(0, 10);
tops.forEach(r => {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 5+:${r.hit5} 6:${r.hit6}`);
        } catch (e) {}
    }
});
