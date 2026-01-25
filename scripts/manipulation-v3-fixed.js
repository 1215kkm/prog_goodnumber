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

// 유틸리티: 갭 정보 (history 배열 기반)
function getGapInfo(history) {
    const gaps = {};
    for (let n = 1; n <= 45; n++) {
        let lastSeen = -1;
        let gapSum = 0, gapCount = 0;
        for (let i = 0; i < history.length; i++) {
            if (history[i].numbers.includes(n)) {
                if (lastSeen >= 0) {
                    gapSum += (i - lastSeen);
                    gapCount++;
                }
                lastSeen = i;
            }
        }
        const avgGap = gapCount > 0 ? gapSum / gapCount : 7.5;
        const currentGap = lastSeen >= 0 ? (history.length - lastSeen) : 10;
        gaps[n] = { avgGap, currentGap, ratio: currentGap / avgGap };
    }
    return gaps;
}

// 최근 빈도
function getRecentFreq(history, window) {
    const freq = {};
    for (let n = 1; n <= 45; n++) freq[n] = 0;
    const start = Math.max(0, history.length - window);
    for (let i = start; i < history.length; i++) {
        history[i].numbers.forEach(n => freq[n]++);
    }
    return freq;
}

function getComplement(n) { return 46 - n; }
function getDigitalRoot(n) { while (n > 9) { n = String(n).split('').reduce((s, d) => s + parseInt(d), 0); } return n; }

// 구간 선택
function selectFromRanges(scores) {
    const ranges = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 45]];
    const selected = [];

    for (const [min, max] of ranges) {
        let bestNum = min, bestScore = -999;
        for (let n = min; n <= max; n++) {
            if (scores[n] !== undefined && scores[n] > bestScore) {
                bestScore = scores[n];
                bestNum = n;
            }
        }
        selected.push(bestNum);
    }

    // 나머지 1개
    const remaining = [];
    for (let n = 1; n <= 45; n++) {
        if (!selected.includes(n)) remaining.push({ n, s: scores[n] || 0 });
    }
    remaining.sort((a, b) => b.s - a.s);
    if (remaining.length > 0) selected.push(remaining[0].n);

    return selected.sort((a, b) => a - b);
}

// 합계 필터 구간 선택
function selectWithSumFilter(scores, sumMin, sumMax) {
    const base = selectFromRanges(scores);
    const sum = base.reduce((s, n) => s + n, 0);
    if (sum >= sumMin && sum <= sumMax) return base;

    // 합계 맞추기: 번호 교체
    const sorted = [];
    for (let n = 1; n <= 45; n++) sorted.push({ n, s: scores[n] || 0 });
    sorted.sort((a, b) => b.s - a.s);

    // 상위 15개에서 6개 조합 찾기
    const top = sorted.slice(0, 18).map(x => x.n);
    let best = base, bestDiff = Math.abs(sum - (sumMin + sumMax) / 2);

    for (let a = 0; a < top.length - 5; a++) {
        for (let b = a + 1; b < top.length - 4; b++) {
            for (let c = b + 1; c < top.length - 3; c++) {
                const partial = top[a] + top[b] + top[c];
                for (let d = c + 1; d < top.length - 2; d++) {
                    for (let e = d + 1; e < top.length - 1; e++) {
                        for (let f = e + 1; f < top.length; f++) {
                            const s = partial + top[d] + top[e] + top[f];
                            if (s >= sumMin && s <= sumMax) {
                                const combo = [top[a], top[b], top[c], top[d], top[e], top[f]].sort((x, y) => x - y);
                                // 구간 다양성 체크
                                const ranges = new Set(combo.map(n => Math.floor((n - 1) / 10)));
                                if (ranges.size >= 4) return combo;
                                const diff = Math.abs(s - (sumMin + sumMax) / 2);
                                if (diff < bestDiff) { bestDiff = diff; best = combo; }
                            }
                        }
                    }
                }
            }
        }
    }
    return best;
}

// ===== 전략 생성 =====
function createStrategies() {
    const strategies = [];

    // 1. mod N + 간격 (다양한 파라미터)
    for (let modN of [5, 6, 7, 8, 9, 10, 11, 13]) {
        for (let mW of [1.5, 2.0, 2.5, 3.0, 4.0]) {
            strategies.push({
                name: `mod${modN}_w${mW}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const modTarget = round % modN;
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        scores[n] = gaps[n].ratio + (n % modN === modTarget ? mW : 0);
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 2. LCG 변형
    for (let a of [3, 5, 7, 9, 11, 13, 17]) {
        for (let c of [7, 11, 13, 17, 23, 31]) {
            strategies.push({
                name: `LCG${a}_${c}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const prev = history[history.length - 1].numbers;
                    const lcg = new Set();
                    prev.forEach(n => {
                        lcg.add(((n * a + c) % 45) + 1);
                        lcg.add(((n * a * 2 + c) % 45) + 1);
                    });
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        scores[n] = gaps[n].ratio + (lcg.has(n) ? 2.5 : 0);
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 3. 보수 + 오프셋
    for (let off of [-3, -2, 2, 3, 4, 5]) {
        for (let w of [1.5, 2.0, 2.5, 3.0]) {
            strategies.push({
                name: `comp_o${off}_w${w}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const prev = history[history.length - 1].numbers;
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        let s = gaps[n].ratio;
                        if (prev.includes(46 - n)) s += w;
                        for (const p of prev) {
                            const target = ((p + off - 1 + 45) % 45) + 1;
                            if (n === target) s += w * 0.7;
                        }
                        // ±1 회피
                        for (const p of prev) {
                            if (Math.abs(n - p) === 1) s -= w * 0.5;
                        }
                        scores[n] = s;
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 4. 디지털루트
    for (let drg of [[7, 8, 9], [1, 4, 7], [2, 5, 8], [3, 6, 9], [7, 8], [8, 9], [1, 5, 9]]) {
        for (let w of [1.5, 2.0, 3.0]) {
            strategies.push({
                name: `DR${drg.join('')}_${w}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        scores[n] = gaps[n].ratio + (drg.includes(getDigitalRoot(n)) ? w : 0);
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 5. 복합: mod + LCG + 보수 + 회피
    for (let modN of [7, 9, 11]) {
        for (let a of [9, 11, 13]) {
            for (let c of [11, 17]) {
                strategies.push({
                    name: `full_m${modN}_${a}_${c}`,
                    fn: (history, round) => {
                        const gaps = getGapInfo(history);
                        const prev = history[history.length - 1].numbers;
                        const modT = round % modN;
                        const lcg = new Set();
                        prev.forEach(n => lcg.add(((n * a + c) % 45) + 1));
                        const scores = {};
                        for (let n = 1; n <= 45; n++) {
                            let s = gaps[n].ratio;
                            if (n % modN === modT) s += 1.5;
                            if (lcg.has(n)) s += 1.5;
                            if (prev.includes(46 - n)) s += 1.0;
                            for (const p of prev) { if (Math.abs(n - p) === 1) s -= 2.0; }
                            for (const p of prev) { if (Math.abs(n - p) === 2) s += 0.8; }
                            scores[n] = s;
                        }
                        return selectFromRanges(scores);
                    }
                });
            }
        }
    }

    // 6. 핫번호 회피 (cold)
    for (let w of [5, 10, 15, 20, 30]) {
        for (let cw of [1.0, 2.0, 3.0, 5.0]) {
            strategies.push({
                name: `cold${w}_${cw}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const freq = getRecentFreq(history, w);
                    const maxF = Math.max(...Object.values(freq), 1);
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        scores[n] = gaps[n].ratio - (freq[n] / maxF) * cw;
                    }
                    return selectFromRanges(scores);
                }
            });
        }
    }

    // 7. XOR 패턴
    for (let xv of [3, 7, 13, 21, 31, 42]) {
        strategies.push({
            name: `xor${xv}`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const prev = history[history.length - 1].numbers;
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;
                prev.forEach(p => {
                    let x = (p ^ xv);
                    if (x < 1) x += 45;
                    if (x > 45) x = ((x - 1) % 45) + 1;
                    scores[x] += 2.5;
                });
                return selectFromRanges(scores);
            }
        });
    }

    // 8. 피보나치
    const fibs = [1, 2, 3, 5, 8, 13, 21, 34];
    for (let fc of [2, 3, 4, 5, 6]) {
        strategies.push({
            name: `fib${fc}`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const prev = history[history.length - 1].numbers;
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;
                prev.forEach(p => {
                    for (let i = 0; i < fc; i++) {
                        let t = ((p + fibs[i] - 1) % 45) + 1;
                        scores[t] += 1.5;
                        t = ((p - fibs[i] - 1 + 45) % 45) + 1;
                        scores[t] += 1.5;
                    }
                });
                return selectFromRanges(scores);
            }
        });
    }

    // 9. 회차 시드
    for (let m of [3, 7, 11, 13, 17, 23, 29, 37]) {
        strategies.push({
            name: `seed${m}`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const seed = ((round * m) % 45) + 1;
                const scores = {};
                for (let n = 1; n <= 45; n++) {
                    const dist = Math.min(Math.abs(n - seed), 45 - Math.abs(n - seed));
                    scores[n] = gaps[n].ratio + (dist <= 5 ? (3.0 - dist * 0.5) : 0);
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 10. 이전 N회차 복합
    for (let depth of [2, 3, 4, 5, 7, 10]) {
        strategies.push({
            name: `prev${depth}`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const scores = {};
                for (let n = 1; n <= 45; n++) scores[n] = gaps[n].ratio;
                for (let d = 1; d <= Math.min(depth, history.length); d++) {
                    const prev = history[history.length - d].numbers;
                    const w = 1.0 / d;
                    prev.forEach(p => {
                        const comp = 46 - p;
                        if (comp >= 1 && comp <= 45) scores[comp] += w;
                        const p2 = ((p + 1) % 45) + 1;
                        scores[p2] += w * 0.6;
                        const m2 = ((p - 3 + 45) % 45) + 1;
                        scores[m2] += w * 0.6;
                    });
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 11. 합계 필터 변형
    for (let modN of [7, 9]) {
        for (let sumR of [[100, 170], [110, 160], [115, 155], [121, 160], [130, 180]]) {
            strategies.push({
                name: `sum${sumR[0]}_${sumR[1]}_m${modN}`,
                fn: (history, round) => {
                    const gaps = getGapInfo(history);
                    const modT = round % modN;
                    const scores = {};
                    for (let n = 1; n <= 45; n++) {
                        scores[n] = gaps[n].ratio + (n % modN === modT ? 2.0 : 0);
                    }
                    return selectWithSumFilter(scores, sumR[0], sumR[1]);
                }
            });
        }
    }

    // 12. 메타 전략: 상위 전략 투표
    strategies.push({
        name: 'meta_vote3',
        fn: (history, round) => {
            const gaps = getGapInfo(history);
            const prev = history[history.length - 1].numbers;
            const modT7 = round % 7;
            const lcg9 = new Set();
            prev.forEach(n => lcg9.add(((n * 9 + 11) % 45) + 1));

            const votes = {};
            for (let n = 1; n <= 45; n++) votes[n] = 0;

            // sub1: mod7 + gap
            const s1 = {};
            for (let n = 1; n <= 45; n++) s1[n] = gaps[n].ratio + (n % 7 === modT7 ? 2.5 : 0);
            selectFromRanges(s1).forEach(n => votes[n] += 3);

            // sub2: LCG + gap
            const s2 = {};
            for (let n = 1; n <= 45; n++) s2[n] = gaps[n].ratio + (lcg9.has(n) ? 2.5 : 0);
            selectFromRanges(s2).forEach(n => votes[n] += 3);

            // sub3: 보수+±2
            const s3 = {};
            for (let n = 1; n <= 45; n++) {
                let sc = gaps[n].ratio;
                if (prev.includes(46 - n)) sc += 2.0;
                for (const p of prev) { if (Math.abs(n - p) === 2) sc += 1.5; }
                for (const p of prev) { if (Math.abs(n - p) === 1) sc -= 2.0; }
                s3[n] = sc;
            }
            selectFromRanges(s3).forEach(n => votes[n] += 3);

            // 합산
            const finalScores = {};
            for (let n = 1; n <= 45; n++) finalScores[n] = votes[n] + gaps[n].ratio * 0.5;
            return selectFromRanges(finalScores);
        }
    });

    // 13. 확장 선택 (10개, 15개)
    for (let pickN of [8, 10, 12, 15, 20]) {
        strategies.push({
            name: `pick${pickN}_best`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const prev = history[history.length - 1].numbers;
                const modT = round % 7;
                const lcg = new Set();
                prev.forEach(n => {
                    lcg.add(((n * 9 + 11) % 45) + 1);
                    lcg.add(((n * 11 + 17) % 45) + 1);
                });
                const scores = {};
                for (let n = 1; n <= 45; n++) {
                    let s = gaps[n].ratio;
                    if (n % 7 === modT) s += 2.0;
                    if (lcg.has(n)) s += 2.0;
                    if (prev.includes(46 - n)) s += 1.5;
                    for (const p of prev) { if (Math.abs(n - p) === 2) s += 1.0; }
                    for (const p of prev) { if (Math.abs(n - p) === 1) s -= 2.0; }
                    scores[n] = s;
                }
                const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
                return sorted.slice(0, pickN).map(([n]) => parseInt(n)).sort((a, b) => a - b);
            }
        });
    }

    // 14. 가중 랜덤 (여러 시드)
    for (let seedAdd of [0, 1, 2, 3, 5, 7, 11]) {
        strategies.push({
            name: `wrand${seedAdd}`,
            fn: (history, round) => {
                const gaps = getGapInfo(history);
                const prev = history[history.length - 1].numbers;
                const modT = (round + seedAdd) % 7;
                const scores = {};
                for (let n = 1; n <= 45; n++) {
                    let s = gaps[n].ratio;
                    if (n % 7 === modT) s += 2.0;
                    if (prev.includes(46 - n)) s += 1.5;
                    for (const p of prev) { if (Math.abs(n - p) === 2) s += 1.0; }
                    for (const p of prev) { if (Math.abs(n - p) === 1) s -= 1.5; }
                    // 시드 기반 추가 가중
                    const hash = ((n * (round + seedAdd)) % 45);
                    if (hash < 10) s += 0.5;
                    scores[n] = s;
                }
                return selectFromRanges(scores);
            }
        });
    }

    // 15. 쌍 패턴 (이전 당첨 번호 쌍의 차이)
    strategies.push({
        name: 'pair_diff',
        fn: (history, round) => {
            const gaps = getGapInfo(history);
            const prev = history[history.length - 1].numbers;
            const diffs = new Set();
            for (let i = 0; i < prev.length; i++) {
                for (let j = i + 1; j < prev.length; j++) {
                    diffs.add(Math.abs(prev[i] - prev[j]));
                }
            }
            const scores = {};
            for (let n = 1; n <= 45; n++) {
                let s = gaps[n].ratio;
                for (const p of prev) {
                    if (diffs.has(Math.abs(n - p))) s += 1.0;
                }
                scores[n] = s;
            }
            return selectFromRanges(scores);
        }
    });

    // 16. 역 핫/콜드 (핫번호 완전 회피, 콜드 선호)
    for (let w of [10, 20, 30]) {
        strategies.push({
            name: `anticold${w}`,
            fn: (history, round) => {
                const freq = getRecentFreq(history, w);
                const gaps = getGapInfo(history);
                const scores = {};
                // 완전히 역으로: 빈도 낮을수록 높은 점수
                const maxF = Math.max(...Object.values(freq), 1);
                for (let n = 1; n <= 45; n++) {
                    scores[n] = gaps[n].ratio + (maxF - freq[n]) / maxF * 3.0;
                }
                return selectFromRanges(scores);
            }
        });
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

    for (let i = testStart; i < allResults.length; i++) {
        const targetRound = allResults[i].round;
        const actual = allResults[i].numbers;
        const history = allResults.slice(0, i);

        try {
            const predicted = strategy.fn(history, targetRound);
            if (!predicted || predicted.length < 6) continue;
            const hits = predicted.filter(n => actual.includes(n)).length;
            totalHit += hits;
            if (hits < dist.length) dist[hits]++;
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
        try {
            const p = strategy.fn(allResults.slice(0, testStart), allResults[testStart].round);
            return p ? p.length : 6;
        } catch { return 6; }
    })();

    results.push({
        name: strategy.name,
        avg, hit3, hit4, hit5, hit6, dist, pickSize
    });
}

// 평균 적중순 정렬 (6개 선택만)
const six = results.filter(r => r.pickSize === 6);
six.sort((a, b) => b.avg - a.avg);

console.log('=== 6개 선택 상위 30개 ===');
console.log('순위 | 전략                          | 평균   | 3+  | 4+  | 5+  | 6  | 분포');
console.log('-'.repeat(100));
for (let i = 0; i < Math.min(30, six.length); i++) {
    const r = six[i];
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | ${r.avg.toFixed(3)} | ${String(r.hit3).padStart(3)} | ${String(r.hit4).padStart(3)} | ${String(r.hit5).padStart(3)} | ${String(r.hit6).padStart(2)} | ${r.dist.join(':')}`);
}

// 5+ 기준
const by5 = [...six].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg);
console.log('\n=== 6개 선택 - 5개+ 적중 기준 상위 20개 ===');
for (let i = 0; i < Math.min(20, by5.length); i++) {
    const r = by5[i];
    if (r.hit5 === 0 && i > 5) break;
    console.log(`${String(i + 1).padStart(3)}  | ${r.name.padEnd(30)} | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4} | 3+:${r.hit3}`);
}

// 확장 선택
const multi = results.filter(r => r.pickSize > 6);
multi.sort((a, b) => b.avg - a.avg);
console.log('\n=== 확장 선택 전략 ===');
for (const r of multi) {
    console.log(`${r.name.padEnd(20)} (${r.pickSize}개) | avg:${r.avg.toFixed(3)} | 5+:${r.hit5} | 4+:${r.hit4} | 3+:${r.hit3} | 6:${r.hit6}`);
}

// 1209회 추천
console.log('\n=== 1209회 추천 ===');
const topAll = [...results].sort((a, b) => b.hit5 - a.hit5 || b.avg - a.avg).slice(0, 15);
for (const r of topAll) {
    const s = strategies.find(x => x.name === r.name);
    if (s) {
        try {
            const pred = s.fn(allResults, allResults[allResults.length - 1].round + 1);
            console.log(`${r.name} (${r.pickSize}개): ${JSON.stringify(pred)} | avg:${r.avg.toFixed(3)} 5+:${r.hit5}`);
        } catch (e) { }
    }
}
