/**
 * v8: 더 창의적인 패턴 탐색
 *
 * 새로운 아이디어:
 * 1. 번호 클러스터 (근접 번호 그룹핑)
 * 2. 역발상 패턴 (최근 자주 나온 패턴 회피)
 * 3. 번호 합의 법칙 (특정 합계 범위 강제)
 * 4. 끝자리 분산 (끝자리가 고르게)
 * 5. 10단위 밸런스
 * 6. 최근 N회 완전 미출현 번호만
 * 7. v6 최강 + 강화된 요소들
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

// 합계 필터링된 선택
function selectWithSum(scores, minSum, maxSum, attempts = 2000) {
    const base = selectFromRanges(scores);
    const sum = base.reduce((a, b) => a + b, 0);
    if (sum >= minSum && sum <= maxSum) return base;

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([n]) => parseInt(n));
    let best = base, bestScore = -1;

    for (let att = 0; att < attempts; att++) {
        const shuffled = [...sorted].sort(() => Math.random() - 0.5).slice(0, 6);
        const s = shuffled.reduce((a, b) => a + b, 0);
        if (s >= minSum && s <= maxSum) {
            const sc = shuffled.reduce((a, b) => a + (scores[b] || 0), 0);
            if (sc > bestScore) { bestScore = sc; best = shuffled; }
        }
    }
    return best.sort((a, b) => a - b);
}

function createStrategies() {
    const strategies = [];

    // ===== 1. 완전 미출현 기반 =====
    for (let noShowWindow of [7, 10, 12, 15, 20]) {
        strategies.push({
            name: `pure_noshow_${noShowWindow}`,
            fn: (past) => {
                const recent = past.slice(-noShowWindow);
                const appeared = new Set();
                recent.forEach(r => r.numbers.forEach(n => appeared.add(n)));

                const gap = getGapScores(past);
                const scores = {};
                for (let i = 1; i <= 45; i++) {
                    if (!appeared.has(i)) {
                        scores[i] = gap[i] * 3 + 10; // 미출현 번호에 큰 보너스
                    } else {
                        scores[i] = 0; // 출현한 번호는 제외
                    }
                }
                return selectFromRanges(scores);
            }
        });
    }

    // ===== 2. 끝자리 분산 (0~9 중 6개 다르게) =====
    strategies.push({
        name: `digit_diverse`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // 끝자리별로 그룹핑
            const byDigit = {};
            for (let d = 0; d <= 9; d++) byDigit[d] = [];
            for (let i = 1; i <= 45; i++) byDigit[i % 10].push({ n: i, s: scores[i] });

            // 각 끝자리에서 최고점 1개씩 (6개 선택)
            const selected = [];
            const digitOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
            for (const d of digitOrder) {
                if (selected.length >= 6) break;
                const best = byDigit[d].sort((a, b) => b.s - a.s)[0];
                if (best && best.s > 0) selected.push(best.n);
            }
            // 부족하면 남은 것 중 최고점
            if (selected.length < 6) {
                const remaining = Object.values(byDigit).flat()
                    .filter(x => !selected.includes(x.n))
                    .sort((a, b) => b.s - a.s);
                while (selected.length < 6 && remaining.length > 0) {
                    selected.push(remaining.shift().n);
                }
            }
            return selected.sort((a, b) => a - b);
        }
    });

    // ===== 3. 합계 강제 (다양한 범위) =====
    for (let sumRange of [[100, 150], [110, 160], [120, 170], [130, 180], [115, 155], [125, 165]]) {
        strategies.push({
            name: `sum_${sumRange[0]}_${sumRange[1]}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // v6 패턴 적용
                prev.forEach(n => {
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 3;
                });

                return selectWithSum(scores, sumRange[0], sumRange[1]);
            }
        });
    }

    // ===== 4. 클러스터 회피 (연속 3개 이상 방지) =====
    strategies.push({
        name: `no_cluster`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const prev = past[past.length - 1].numbers;
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // v6 패턴
            prev.forEach(n => {
                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
            });

            // 상위 15개 후보
            const candidates = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([n]) => parseInt(n));

            // 클러스터 없는 6개 조합 찾기
            for (let att = 0; att < 1000; att++) {
                const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 6).sort((a, b) => a - b);
                let hasCluster = false;
                for (let i = 0; i < shuffled.length - 2; i++) {
                    if (shuffled[i + 1] - shuffled[i] === 1 && shuffled[i + 2] - shuffled[i + 1] === 1) {
                        hasCluster = true;
                        break;
                    }
                }
                if (!hasCluster) return shuffled;
            }
            return selectFromRanges(scores);
        }
    });

    // ===== 5. 이전 당첨번호와 겹침 최소화 =====
    for (let avoidW of [3, 5, 7]) {
        strategies.push({
            name: `avoid_recent_${avoidW}`,
            fn: (past) => {
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // 최근 N회 당첨번호는 감점
                const recent = past.slice(-avoidW);
                recent.forEach((r, idx) => {
                    const penalty = (avoidW - idx) * 3;
                    r.numbers.forEach(n => scores[n] -= penalty);
                });

                // 대신 보수와 ±3에 가점
                const prev = past[past.length - 1].numbers;
                prev.forEach(n => {
                    const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 5;
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                });

                return selectFromRanges(scores);
            }
        });
    }

    // ===== 6. v6 Triple 강화 버전 =====
    for (let lcgW of [5, 6, 7]) {
        for (let off3W of [5, 6, 7]) {
            for (let compW of [4, 5, 6]) {
                strategies.push({
                    name: `v6_boost_l${lcgW}_o${off3W}_c${compW}`,
                    fn: (past) => {
                        const prev = past[past.length - 1].numbers;
                        const nextRound = past[past.length - 1].round + 1;
                        const gap = getGapScores(past);
                        const hot = getHot(past, 20);
                        const scores = {};
                        for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                        // LCG 강화
                        for (let k = 0; k < 8; k++) {
                            const lcg = ((13 * nextRound + 31 + k * 5) % 45) + 1;
                            scores[lcg] += lcgW;
                        }

                        // ±3 강화
                        prev.forEach(n => {
                            [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += off3W; });
                            [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 3; });
                        });

                        // 보수 강화
                        prev.forEach(n => {
                            const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += compW;
                        });

                        // depth 2~4
                        for (let d = 2; d <= Math.min(4, past.length); d++) {
                            const prevD = past[past.length - d].numbers;
                            const w = Math.pow(0.5, d - 1) * 5;
                            prevD.forEach(n => {
                                const comp = 46 - n;
                                if (comp >= 1 && comp <= 45) scores[comp] += w;
                            });
                        }

                        return selectFromRanges(scores);
                    }
                });
            }
        }
    }

    // ===== 7. 쌍 빈도 기반 =====
    for (let pairThreshold of [4, 5, 6, 7]) {
        strategies.push({
            name: `pair_freq_${pairThreshold}`,
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

                // 이전 번호와 자주 같이 나온 번호
                prev.forEach(p => {
                    for (let n = 1; n <= 45; n++) {
                        if (n === p) continue;
                        const key = `${Math.min(p, n)}_${Math.max(p, n)}`;
                        if ((pairFreq[key] || 0) >= pairThreshold) {
                            scores[n] += (pairFreq[key] - pairThreshold + 1) * 2;
                        }
                    }
                });

                return selectFromRanges(scores);
            }
        });
    }

    // ===== 8. 역 패턴 (최근 패턴 반대로) =====
    strategies.push({
        name: `anti_pattern`,
        fn: (past) => {
            const gap = getGapScores(past);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3;

            // 최근 10회에서 가장 많이 나온 번호는 감점
            const hot10 = getHot(past, 10);
            const maxHot = Math.max(...Object.values(hot10));
            for (let i = 1; i <= 45; i++) {
                scores[i] -= (hot10[i] / maxHot) * 10;
            }

            // 이전 번호의 ±1, ±2, ±3 모두 회피
            const prev = past[past.length - 1].numbers;
            prev.forEach(n => {
                for (let d = -3; d <= 3; d++) {
                    if (d === 0) continue;
                    const t = n + d;
                    if (t >= 1 && t <= 45) scores[t] -= 3;
                }
                // 대신 보수에만 가점
                const c = 46 - n;
                if (c >= 1 && c <= 45) scores[c] += 5;
            });

            return selectFromRanges(scores);
        }
    });

    // ===== 9. 홀짝 3:3 강제 =====
    strategies.push({
        name: `odd_even_33`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const prev = past[past.length - 1].numbers;
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // v6 패턴
            prev.forEach(n => {
                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 3;
            });

            // 홀수 상위 3개, 짝수 상위 3개
            const odds = Object.entries(scores).filter(([n]) => parseInt(n) % 2 === 1).sort((a, b) => b[1] - a[1]);
            const evens = Object.entries(scores).filter(([n]) => parseInt(n) % 2 === 0).sort((a, b) => b[1] - a[1]);

            const selected = [
                ...odds.slice(0, 3).map(([n]) => parseInt(n)),
                ...evens.slice(0, 3).map(([n]) => parseInt(n))
            ];
            return selected.sort((a, b) => a - b);
        }
    });

    // ===== 10. 확장 선택 (7~15개) =====
    for (let pickN of [7, 8, 9, 10, 12, 15]) {
        strategies.push({
            name: `ext_v8_${pickN}`,
            fn: (past) => {
                const prev = past[past.length - 1].numbers;
                const nextRound = past[past.length - 1].round + 1;
                const gap = getGapScores(past);
                const hot = getHot(past, 20);
                const scores = {};
                for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

                // LCG 확장
                for (let k = 0; k < 10; k++) {
                    const lcg = ((13 * nextRound + 31 + k * 5) % 45) + 1;
                    scores[lcg] += 4;
                }

                // ±3 + 보수
                prev.forEach(n => {
                    [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 5; });
                    [-1, 1].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] -= 2; });
                    const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 4;
                });

                // depth 보수
                for (let d = 2; d <= 4; d++) {
                    if (past.length < d) break;
                    const prevD = past[past.length - d].numbers;
                    const w = Math.pow(0.5, d - 1) * 4;
                    prevD.forEach(n => {
                        const comp = 46 - n;
                        if (comp >= 1 && comp <= 45) scores[comp] += w;
                    });
                }

                // 미출현 보너스
                const recent = past.slice(-10);
                const appeared = new Set();
                recent.forEach(r => r.numbers.forEach(n => appeared.add(n)));
                for (let i = 1; i <= 45; i++) {
                    if (!appeared.has(i)) scores[i] += 3;
                }

                return selectTopN(scores, pickN);
            }
        });
    }

    // ===== 11. 이전 N회 당첨번호의 평균/중앙값 근처 =====
    strategies.push({
        name: `near_avg`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // 최근 10회 평균 계산
            const recent = past.slice(-10);
            let sum = 0, count = 0;
            recent.forEach(r => r.numbers.forEach(n => { sum += n; count++; }));
            const avg = sum / count; // 약 23 근처

            // 평균 근처 번호에 가점
            for (let i = 1; i <= 45; i++) {
                const dist = Math.abs(i - avg);
                if (dist <= 5) scores[i] += (6 - dist) * 2;
            }

            return selectFromRanges(scores);
        }
    });

    // ===== 12. 구간 밸런스 (1-15, 16-30, 31-45에서 2개씩) =====
    strategies.push({
        name: `thirds_balance`,
        fn: (past) => {
            const gap = getGapScores(past);
            const hot = getHot(past, 20);
            const prev = past[past.length - 1].numbers;
            const scores = {};
            for (let i = 1; i <= 45; i++) scores[i] = gap[i] * 3 + hot[i];

            // v6 패턴
            prev.forEach(n => {
                [-3, 3].forEach(d => { const t = n + d; if (t >= 1 && t <= 45) scores[t] += 4; });
                const c = 46 - n; if (c >= 1 && c <= 45) scores[c] += 3;
            });

            // 3등분 구간에서 각 2개씩
            const thirds = [[1, 15], [16, 30], [31, 45]];
            const selected = [];
            thirds.forEach(([min, max]) => {
                const rangeScores = [];
                for (let n = min; n <= max; n++) rangeScores.push({ n, s: scores[n] });
                rangeScores.sort((a, b) => b.s - a.s);
                selected.push(rangeScores[0].n, rangeScores[1].n);
            });

            return selected.sort((a, b) => a - b);
        }
    });

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

// 결과 출력
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.hit5 - a.hit5 || b.hit6 - a.hit6 || b.avg - a.avg);

console.log('=== 6개 선택 - 5+적중 기준 상위 25개 ===');
console.log('순위 | 전략                         | 평균   | 5+  | 6  | 4+  | 3+  | 분포');
console.log('-'.repeat(100));
for (let i = 0; i < Math.min(25, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(28)} | ${r.avg.toFixed(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${String(r.hit4).padStart(3)} | ${String(r.hit3).padStart(3)} | ${r.dist.join(':')}`);
}

// 6개 적중 있는 전략
const has6 = six.filter(r => r.hit6 > 0);
if (has6.length > 0) {
    console.log('\n=== 6개(1등!) 적중 전략 ===');
    has6.sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5);
    has6.slice(0, 15).forEach(r => console.log(`${r.name}: 6개 ${r.hit6}회, 5+ ${r.hit5}회, avg ${r.avg.toFixed(3)}`));
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n=== 확장 선택 (6개 적중 기준) ===');
multi.forEach(r => console.log(`${r.name.padEnd(20)} (${r.pickSize}개) | avg:${r.avg.toFixed(3)} | 6:${r.hit6} | 5+:${r.hit5} | 4+:${r.hit4}`));

// 1209회 추천
console.log('\n=== 1209회 추천 ===');
const tops = [...results].sort((a, b) => b.hit6 - a.hit6 || b.hit5 - a.hit5 || b.avg - a.avg).slice(0, 10);
tops.forEach(r => {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults);
            console.log(`${r.name} (${pred.length}개): [${pred.join(',')}] | avg:${r.avg.toFixed(3)} 6:${r.hit6} 5+:${r.hit5}`);
        } catch (e) {}
    }
});
