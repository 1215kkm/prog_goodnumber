const fs = require('fs');

// 데이터 로드
const dataPath = './LottoAnalyzer.Core/Services/LottoDataService.cs';
const content = fs.readFileSync(dataPath, 'utf8');

const regex = /\((\d+),\s*new DateTime\(\d+,\s*\d+,\s*\d+\),\s*new\[\]\s*\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\},\s*(\d+)\)/g;
let match;
const allResults = [];
while ((match = regex.exec(content)) !== null) {
    allResults.push({
        round: parseInt(match[1]),
        numbers: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5]), parseInt(match[6]), parseInt(match[7])],
        bonus: parseInt(match[8])
    });
}
allResults.sort((a, b) => a.round - b.round);

const TEST_COUNT = 100;
const testStart = allResults.length - TEST_COUNT;

// 유틸리티 함수들
function getGapInfo(results, targetRound) {
    const gaps = {};
    for (let n = 1; n <= 45; n++) {
        let lastSeen = -1;
        let gapSum = 0, gapCount = 0;
        for (let i = 0; i < results.length; i++) {
            if (results[i].round >= targetRound) break;
            if (results[i].numbers.includes(n)) {
                if (lastSeen >= 0) {
                    gapSum += (i - lastSeen);
                    gapCount++;
                }
                lastSeen = i;
            }
        }
        const avgGap = gapCount > 0 ? gapSum / gapCount : 7.5;
        const currentGap = lastSeen >= 0 ? (results.findIndex(r => r.round >= targetRound) - lastSeen) : 10;
        gaps[n] = { avgGap, currentGap, ratio: currentGap / avgGap };
    }
    return gaps;
}

function getRecentFreq(results, targetRound, window) {
    const freq = {};
    for (let n = 1; n <= 45; n++) freq[n] = 0;
    const endIdx = results.findIndex(r => r.round >= targetRound);
    const startIdx = Math.max(0, endIdx - window);
    for (let i = startIdx; i < endIdx; i++) {
        results[i].numbers.forEach(n => freq[n]++);
    }
    return freq;
}

function getComplement(n) { return 46 - n; }
function getDigitalRoot(n) { while (n > 9) { n = String(n).split('').reduce((s, d) => s + parseInt(d), 0); } return n; }

// 전략 생성 함수들 - 수십 가지 변형
function createStrategies() {
    const strategies = [];

    // === 파라미터 변형: mod N + 간격 ===
    for (let modN = 5; modN <= 11; modN++) {
        for (let gapWeight of [0.5, 1.0, 1.5, 2.0]) {
            for (let modWeight of [1.0, 1.5, 2.0, 3.0]) {
                strategies.push({
                    name: `mod${modN}_gW${gapWeight}_mW${modWeight}`,
                    generate: (results, targetRound) => {
                        const gaps = getGapInfo(results, targetRound);
                        const modTarget = targetRound % modN;
                        const scores = {};
                        for (let n = 1; n <= 45; n++) {
                            let score = gaps[n].ratio * gapWeight;
                            if (n % modN === modTarget) score += modWeight;
                            scores[n] = score;
                        }
                        return selectFromRanges(scores, targetRound);
                    }
                });
            }
        }
    }

    // === LCG 변형 ===
    for (let a of [3, 5, 7, 9, 11, 13]) {
        for (let c of [7, 11, 13, 17, 23]) {
            strategies.push({
                name: `LCG_a${a}_c${c}`,
                generate: (results, targetRound) => {
                    const gaps = getGapInfo(results, targetRound);
                    const endIdx = results.findIndex(r => r.round >= targetRound);
                    const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                    const lcgNums = new Set();
                    prevNums.forEach(n => {
                        lcgNums.add(((n * a + c) % 45) + 1);
                        lcgNums.add(((n * a + c + a) % 45) + 1);
                    });
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let score = gaps[n].ratio;
                        if (lcgNums.has(n)) score += 2.0;
                        scores[n] = score;
                    }
                    return selectFromRanges(scores, targetRound);
                }
            });
        }
    }

    // === 보수 + 오프셋 조합 ===
    for (let offset of [-3, -2, -1, 2, 3, 4, 5]) {
        for (let compWeight of [1.0, 1.5, 2.0, 3.0]) {
            strategies.push({
                name: `comp_off${offset}_w${compWeight}`,
                generate: (results, targetRound) => {
                    const gaps = getGapInfo(results, targetRound);
                    const endIdx = results.findIndex(r => r.round >= targetRound);
                    const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let score = gaps[n].ratio;
                        // 보수
                        if (prevNums.includes(getComplement(n))) score += compWeight;
                        // 오프셋
                        for (const pn of prevNums) {
                            if (n === ((pn + offset - 1 + 45) % 45) + 1) score += compWeight * 0.8;
                        }
                        scores[n] = score;
                    }
                    return selectFromRanges(scores, targetRound);
                }
            });
        }
    }

    // === 디지털루트 + 간격 ===
    for (let drGroup of [[1,2,3], [4,5,6], [7,8,9], [1,4,7], [2,5,8], [3,6,9], [7,8], [8,9], [1,5,9]]) {
        for (let drWeight of [1.0, 1.5, 2.0, 3.0]) {
            strategies.push({
                name: `DR${drGroup.join('')}_w${drWeight}`,
                generate: (results, targetRound) => {
                    const gaps = getGapInfo(results, targetRound);
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let score = gaps[n].ratio;
                        if (drGroup.includes(getDigitalRoot(n))) score += drWeight;
                        scores[n] = score;
                    }
                    return selectFromRanges(scores, targetRound);
                }
            });
        }
    }

    // === ±1 회피 + 다른 패턴 ===
    for (let avoidWeight of [1.0, 2.0, 3.0, 5.0]) {
        strategies.push({
            name: `avoid1_w${avoidWeight}`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const endIdx = results.findIndex(r => r.round >= targetRound);
                const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                const scores = {};
                for (let n = 1; n <= 45; n++) {
                    let score = gaps[n].ratio;
                    // ±1 회피 (패널티)
                    for (const pn of prevNums) {
                        if (Math.abs(n - pn) === 1) score -= avoidWeight;
                    }
                    // ±2 보너스
                    for (const pn of prevNums) {
                        if (Math.abs(n - pn) === 2) score += avoidWeight * 0.5;
                    }
                    scores[n] = score;
                }
                return selectFromRanges(scores, targetRound);
            }
        });
    }

    // === 복합 조합: mod + LCG + 보수 ===
    for (let modN of [7, 9, 11]) {
        for (let lcgA of [9, 11]) {
            for (let lcgC of [11, 17]) {
                strategies.push({
                    name: `combo_m${modN}_a${lcgA}_c${lcgC}`,
                    generate: (results, targetRound) => {
                        const gaps = getGapInfo(results, targetRound);
                        const endIdx = results.findIndex(r => r.round >= targetRound);
                        const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                        const modTarget = targetRound % modN;
                        const lcgNums = new Set();
                        prevNums.forEach(n => {
                            lcgNums.add(((n * lcgA + lcgC) % 45) + 1);
                        });
                        const scores = {};
                        for (let n = 1; n <= 45; n++) {
                            let score = gaps[n].ratio;
                            if (n % modN === modTarget) score += 1.5;
                            if (lcgNums.has(n)) score += 1.5;
                            if (prevNums.includes(getComplement(n))) score += 1.0;
                            // ±1 회피
                            for (const pn of prevNums) {
                                if (Math.abs(n - pn) === 1) score -= 2.0;
                            }
                            scores[n] = score;
                        }
                        return selectFromRanges(scores, targetRound);
                    }
                });
            }
        }
    }

    // === 핫번호 회피 전략 (cold selection) ===
    for (let window of [5, 10, 15, 20, 30]) {
        for (let coldWeight of [1.0, 2.0, 3.0]) {
            strategies.push({
                name: `cold_w${window}_cw${coldWeight}`,
                generate: (results, targetRound) => {
                    const gaps = getGapInfo(results, targetRound);
                    const freq = getRecentFreq(results, targetRound, window);
                    const maxFreq = Math.max(...Object.values(freq));
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let score = gaps[n].ratio;
                        // 핫번호 회피: 빈도 높을수록 감점
                        score -= (freq[n] / Math.max(maxFreq, 1)) * coldWeight;
                        scores[n] = score;
                    }
                    return selectFromRanges(scores, targetRound);
                }
            });
        }
    }

    // === 합계 범위 + mod 패턴 ===
    for (let sumMin of [100, 110, 121, 130, 140]) {
        for (let sumMax of [150, 160, 170, 180, 190]) {
            if (sumMax <= sumMin + 20) continue;
            strategies.push({
                name: `sum${sumMin}_${sumMax}_mod7`,
                generate: (results, targetRound) => {
                    const gaps = getGapInfo(results, targetRound);
                    const modTarget = targetRound % 7;
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let score = gaps[n].ratio;
                        if (n % 7 === modTarget) score += 2.0;
                        scores[n] = score;
                    }
                    return selectFromRangesWithSum(scores, targetRound, sumMin, sumMax);
                }
            });
        }
    }

    // === 이전 2회차 패턴 ===
    for (let depth of [2, 3, 4, 5]) {
        strategies.push({
            name: `prev${depth}_pattern`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const endIdx = results.findIndex(r => r.round >= targetRound);
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;

                for (let d = 1; d <= depth; d++) {
                    if (endIdx - d < 0) continue;
                    const prevNums = results[endIdx - d].numbers;
                    const weight = 1.0 / d;
                    prevNums.forEach(pn => {
                        // 보수
                        const comp = getComplement(pn);
                        if (comp >= 1 && comp <= 45) scores[comp] += weight;
                        // ±2
                        const plus2 = ((pn + 1) % 45) + 1;
                        const minus2 = ((pn - 3 + 45) % 45) + 1;
                        scores[plus2] += weight * 0.8;
                        scores[minus2] += weight * 0.8;
                    });
                }
                return selectFromRanges(scores, targetRound);
            }
        });
    }

    // === 피보나치 오프셋 ===
    const fibs = [1, 2, 3, 5, 8, 13, 21, 34];
    for (let fibCount of [3, 4, 5, 6]) {
        strategies.push({
            name: `fib${fibCount}`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const endIdx = results.findIndex(r => r.round >= targetRound);
                const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;

                prevNums.forEach(pn => {
                    for (let i = 0; i < fibCount; i++) {
                        const target = ((pn + fibs[i] - 1) % 45) + 1;
                        scores[target] += 1.5;
                        const target2 = ((pn - fibs[i] - 1 + 45) % 45) + 1;
                        scores[target2] += 1.5;
                    }
                });
                return selectFromRanges(scores, targetRound);
            }
        });
    }

    // === 소수 패턴 ===
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
    strategies.push({
        name: `prime_gap`,
        generate: (results, targetRound) => {
            const gaps = getGapInfo(results, targetRound);
            const scores = {};
            for (let n = 1; n <= 45; n++) {
                let score = gaps[n].ratio;
                if (primes.includes(n)) score += 1.0;
                scores[n] = score;
            }
            return selectFromRanges(scores, targetRound);
        }
    });

    // === XOR 패턴 ===
    for (let xorVal of [7, 13, 21, 31, 42]) {
        strategies.push({
            name: `xor${xorVal}`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const endIdx = results.findIndex(r => r.round >= targetRound);
                const prevNums = endIdx > 0 ? results[endIdx - 1].numbers : [1, 10, 20, 30, 40, 45];
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;

                prevNums.forEach(pn => {
                    const xored = (pn ^ xorVal) % 45 + 1;
                    if (xored >= 1 && xored <= 45) scores[xored] += 2.0;
                });
                return selectFromRanges(scores, targetRound);
            }
        });
    }

    // === 회차 기반 시드 ===
    for (let seedMult of [3, 7, 11, 13, 17, 23]) {
        strategies.push({
            name: `seed${seedMult}`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const seed = (targetRound * seedMult) % 45;
                const scores = {};
                for (let n = 1; n <= 45; n++) {
                    let score = gaps[n].ratio;
                    // 시드 기반 선호
                    const dist = Math.min(Math.abs(n - seed - 1), 45 - Math.abs(n - seed - 1));
                    if (dist <= 3) score += 2.0 - dist * 0.5;
                    scores[n] = score;
                }
                return selectFromRanges(scores, targetRound);
            }
        });
    }

    // === 홀짝 강제 패턴 ===
    for (let oddCount of [2, 3, 4]) {
        strategies.push({
            name: `odd${oddCount}`,
            generate: (results, targetRound) => {
                const gaps = getGapInfo(results, targetRound);
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;

                const oddNums = Object.entries(scores).filter(([n]) => parseInt(n) % 2 === 1)
                    .sort((a, b) => b[1] - a[1]).slice(0, 20);
                const evenNums = Object.entries(scores).filter(([n]) => parseInt(n) % 2 === 0)
                    .sort((a, b) => b[1] - a[1]).slice(0, 20);

                const selected = [];
                const oddSorted = oddNums.sort((a, b) => b[1] - a[1]);
                const evenSorted = evenNums.sort((a, b) => b[1] - a[1]);

                for (let i = 0; i < oddCount && i < oddSorted.length; i++) {
                    selected.push(parseInt(oddSorted[i][0]));
                }
                for (let i = 0; i < 6 - oddCount && i < evenSorted.length; i++) {
                    selected.push(parseInt(evenSorted[i][0]));
                }
                return selected.sort((a, b) => a - b).slice(0, 6);
            }
        });
    }

    return strategies;
}

function selectFromRanges(scores, round) {
    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
    const selected = [];

    // 각 구간에서 최고점 1개
    for (const [min, max] of ranges) {
        let bestNum = min, bestScore = -999;
        for (let n = min; n <= max; n++) {
            if (scores[n] > bestScore) {
                bestScore = scores[n];
                bestNum = n;
            }
        }
        selected.push(bestNum);
    }

    // 나머지 1개: 선택되지 않은 것 중 최고점
    const remaining = Object.entries(scores)
        .filter(([n]) => !selected.includes(parseInt(n)))
        .sort((a, b) => b[1] - a[1]);
    if (remaining.length > 0) selected.push(parseInt(remaining[0][0]));

    return selected.sort((a, b) => a - b);
}

function selectFromRangesWithSum(scores, round, sumMin, sumMax) {
    const base = selectFromRanges(scores, round);
    const sum = base.reduce((s, n) => s + n, 0);
    if (sum >= sumMin && sum <= sumMax) return base;

    // 합계 조정 시도
    const sorted = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([n]) => parseInt(n));

    for (let attempt = 0; attempt < 100; attempt++) {
        const candidate = [];
        const used = new Set();
        for (let i = 0; i < 6 && i + attempt < sorted.length; i++) {
            const idx = (i * 7 + attempt * 3) % sorted.length;
            const n = sorted[idx];
            if (!used.has(n)) {
                candidate.push(n);
                used.add(n);
            }
        }
        if (candidate.length === 6) {
            const cSum = candidate.reduce((s, n) => s + n, 0);
            if (cSum >= sumMin && cSum <= sumMax) return candidate.sort((a, b) => a - b);
        }
    }
    return base;
}

// 백테스트 실행
console.log(`총 ${allResults.length}개 회차 | 테스트: 최근 ${TEST_COUNT}회\n`);

const strategies = createStrategies();
console.log(`총 ${strategies.length}개 전략 테스트 중...\n`);

const results = [];

for (const strategy of strategies) {
    let totalHit = 0;
    let hit3 = 0, hit4 = 0, hit5 = 0, hit6 = 0;

    for (let i = testStart; i < allResults.length; i++) {
        const targetRound = allResults[i].round;
        const actual = allResults[i].numbers;
        const historyBefore = allResults.slice(0, i);

        try {
            const predicted = strategy.generate(historyBefore, targetRound);
            if (!predicted || predicted.length < 6) continue;
            const hits = predicted.filter(n => actual.includes(n)).length;
            totalHit += hits;
            if (hits >= 3) hit3++;
            if (hits >= 4) hit4++;
            if (hits >= 5) hit5++;
            if (hits >= 6) hit6++;
        } catch (e) {
            continue;
        }
    }

    const avg = totalHit / TEST_COUNT;
    results.push({
        name: strategy.name,
        avg,
        hit3: hit3,
        hit4: hit4,
        hit5: hit5,
        hit6: hit6,
        hit3pct: (hit3 / TEST_COUNT * 100).toFixed(0),
        hit5pct: (hit5 / TEST_COUNT * 100).toFixed(0)
    });
}

// 평균 적중순 정렬
results.sort((a, b) => b.avg - a.avg);

// 상위 50개 출력
console.log('=== 상위 50개 전략 ===');
console.log('순위 | 전략                          | 평균   | 3+  | 4+  | 5+  | 6');
console.log('-'.repeat(85));
for (let i = 0; i < Math.min(50, results.length); i++) {
    const r = results[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | ${r.avg.toFixed(3)} | ${String(r.hit3).padStart(3)} | ${String(r.hit4).padStart(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(3)}`);
}

// 5+ 적중 기준 상위
const by5plus = [...results].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n\n=== 5개 이상 적중 기준 상위 30개 ===');
console.log('순위 | 전략                          | 평균   | 3+  | 4+  | 5+  | 6');
console.log('-'.repeat(85));
for (let i = 0; i < Math.min(30, by5plus.length); i++) {
    const r = by5plus[i];
    if (r.hit5 === 0) break;
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | ${r.avg.toFixed(3)} | ${String(r.hit3).padStart(3)} | ${String(r.hit4).padStart(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(3)}`);
}

// 최고 5+ 전략의 1209회 추천
console.log('\n\n=== 1209회 추천 (5+ 적중 최고 전략들) ===');
const top5strategies = by5plus.slice(0, 10);
for (const r of top5strategies) {
    if (r.hit5 === 0) break;
    const strategy = strategies.find(s => s.name === r.name);
    if (strategy) {
        try {
            const predicted = strategy.generate(allResults, allResults[allResults.length - 1].round + 1);
            console.log(`${r.name}: ${JSON.stringify(predicted)} (avg:${r.avg.toFixed(3)}, 5+:${r.hit5}회)`);
        } catch (e) {
            console.log(`${r.name}: 생성 실패`);
        }
    }
}
