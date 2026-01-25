/**
 * 조작 패턴 v2: 발견된 유의미한 패턴 조합 최적화
 *
 * 유의미한 패턴:
 * 1. 보수(46-n): 17.1% (기대 13.3%보다 28% 높음)
 * 2. 이전번호-2: 17.6% (32% 높음) - 반면 ±1은 오히려 낮음
 * 3. 회차 mod7: 18.3% (37% 높음)
 * 4. LCG(a=9,c=11): 18.0% (35% 높음)
 * 5. 디지털루트 7,8,9 선호 (12-13% vs 9-10%)
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
console.log(`총 ${allResults.length}개 회차 | 다음: ${allResults[allResults.length-1].round + 1}회\n`);

function getGapScores(past, minR=0.8, maxR=2.5) {
    const lastSeen = {}, gaps = {};
    for (let i = 1; i <= 45; i++) { lastSeen[i] = 0; gaps[i] = []; }
    past.forEach((r, idx) => r.numbers.forEach(n => {
        if (lastSeen[n] > 0) gaps[n].push(idx - lastSeen[n]);
        lastSeen[n] = idx;
    }));
    const scores = {};
    for (let i = 1; i <= 45; i++) {
        const avgGap = gaps[i].length > 2 ? gaps[i].reduce((a,b) => a+b,0) / gaps[i].length : 8;
        const currentGap = past.length - lastSeen[i];
        const ratio = currentGap / avgGap;
        scores[i] = (ratio >= minR && ratio <= maxR) ? ratio * 10 : 0;
    }
    return scores;
}

function getHot(past, w) {
    const f = {}; for(let i=1;i<=45;i++) f[i]=0;
    past.slice(-w).forEach(r => r.numbers.forEach(n => f[n]++));
    return f;
}

function digitalRoot(n) { return n<10 ? n : digitalRoot(n.toString().split('').reduce((a,d)=>a+parseInt(d),0)); }

function selectFromRanges(scores) {
    const ranges = [[1,9],[10,19],[20,29],[30,39],[40,45]];
    const sel = [];
    ranges.forEach(([min,max]) => {
        let b=-1,bs=-1;
        for(let n=min;n<=max;n++) if(scores[n]>bs){bs=scores[n];b=n;}
        if(b>0) sel.push(b);
    });
    const rem = Object.entries(scores).filter(([n])=>!sel.includes(parseInt(n))).sort((a,b)=>b[1]-a[1]);
    while(sel.length<6&&rem.length>0) sel.push(parseInt(rem.shift()[0]));
    return sel.sort((a,b)=>a-b);
}

function filterBySum(cands, scores, min, max, n=6, att=1500) {
    let best=cands.slice(0,n), bs=-1;
    for(let a=0;a<att;a++){
        const sh=[...cands].sort(()=>Math.random()-0.5).slice(0,n);
        const s=sh.reduce((x,y)=>x+y,0);
        if(s>=min&&s<=max){
            const sc=sh.reduce((x,y)=>x+(scores[y]||0),0);
            if(sc>bs){bs=sc;best=sh;}
        }
    }
    return best.sort((a,b)=>a-b);
}

// ============================
// 조작패턴 조합 전략들
// ============================

// S1: 보수+간격+구간 (46-n이 17.1% 유의미)
function S1(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) {
        scores[i] = gap[i] * 3 + hot[i] * 1.0;
    }
    prev.forEach(n => { const c=46-n; if(c>=1&&c<=45) scores[c]+=6; });
    return selectFromRanges(scores);
}

// S2: ±2+간격+구간 (±2가 15-17% 유의미, ±1은 회피)
function S2(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    prev.forEach(n => {
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=5; });
        [-1,1].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]-=2; }); // ±1 회피!
    });
    return selectFromRanges(scores);
}

// S3: LCG(9,11)+간격+구간 (18% 유의미)
function S3(past) {
    const nextRound = past[past.length-1].round + 1;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    for(let k=0;k<6;k++) {
        const lcg = ((9*nextRound + 11 + k*7) % 45) + 1;
        scores[lcg] += 5;
    }
    return selectFromRanges(scores);
}

// S4: mod7+간격+구간 (18.3% 유의미)
function S4(past) {
    const nextRound = past[past.length-1].round + 1;
    const roundMod7 = (nextRound % 7) + 1;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    // mod7 기반 번호에 가점
    for(let i=1;i<=45;i++) {
        if(i%7 === roundMod7%7) scores[i] += 4;
    }
    return selectFromRanges(scores);
}

// S5: 디지털루트(7,8,9)+간격+구간
function S5(past) {
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) {
        scores[i] = gap[i]*3 + hot[i]*1.0;
        const dr = digitalRoot(i);
        if(dr>=7) scores[i] += 3; // 디지털루트 7,8,9 선호
    }
    return selectFromRanges(scores);
}

// S6: 보수+±2+간격 (가장 유의미한 2개 조합)
function S6(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=5;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; });
        [-1,1].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]-=2; });
    });
    return selectFromRanges(scores);
}

// S7: 전체 조합 (보수+±2+LCG+mod7+DR+간격+구간)
function S7(past) {
    const prev = past[past.length-1].numbers;
    const nextRound = past[past.length-1].round + 1;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    // 보수
    prev.forEach(n => { const c=46-n; if(c>=1&&c<=45) scores[c]+=4; });
    // ±2
    prev.forEach(n => {
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=3; });
        [-1,1].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]-=1; });
    });
    // LCG
    for(let k=0;k<6;k++) {
        const lcg = ((9*nextRound + 11 + k*7) % 45) + 1;
        scores[lcg] += 3;
    }
    // mod7
    const rm7 = (nextRound%7)+1;
    for(let i=1;i<=45;i++) if(i%7===rm7%7) scores[i]+=2;
    // DR
    for(let i=1;i<=45;i++) { const dr=digitalRoot(i); if(dr>=7) scores[i]+=2; }
    return selectFromRanges(scores);
}

// S8: S7 + 합계필터
function S8(past) {
    const prev = past[past.length-1].numbers;
    const nextRound = past[past.length-1].round + 1;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=4;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=3; });
        [-1,1].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]-=1; });
    });
    for(let k=0;k<6;k++) {
        const lcg=((9*nextRound+11+k*7)%45)+1;
        scores[lcg]+=3;
    }
    for(let i=1;i<=45;i++) { if(i%7===(nextRound%7+1)%7) scores[i]+=2; if(digitalRoot(i)>=7) scores[i]+=2; }

    const cands = Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>parseInt(e[0]));
    return filterBySum(cands, scores, 121, 160);
}

// S9: 메타 + 조작패턴 (기존 최강 메타전략에 조작패턴 추가)
function S9(past) {
    const prev = past[past.length-1].numbers;
    const nextRound = past[past.length-1].round + 1;

    // 메타 전략의 투표
    const votes = {};
    for(let i=1;i<=45;i++) votes[i]=0;

    // 기존 메타 하위전략들
    const g1=getGapScores(past,0.9,2.0), g2=getGapScores(past,0.8,2.5), g3=getGapScores(past,1.0,1.8);
    const h15=getHot(past,15), h20=getHot(past,20);
    [g1,g2,g3,h15,h20].forEach(s => {
        Object.entries(s).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([n])=>votes[parseInt(n)]++);
    });

    // 조작 패턴 보너스
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) votes[c]+=2;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) votes[t]+=1.5; });
    });
    for(let k=0;k<6;k++) {
        const lcg=((9*nextRound+11+k*7)%45)+1;
        votes[lcg]+=1.5;
    }

    const cands = Object.entries(votes).sort((a,b)=>b[1]-a[1]).slice(0,12).map(e=>parseInt(e[0]));
    return filterBySum(cands, votes, 121, 160);
}

// S10: 구간강제 + 모든 조작패턴
function S10(past) {
    const prev = past[past.length-1].numbers;
    const nextRound = past[past.length-1].round + 1;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) {
        scores[i] = gap[i]*3 + hot[i]*1.5;
        if(digitalRoot(i)>=7) scores[i]+=2;
    }
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=5;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; });
        [-1,1].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]-=2; });
    });
    for(let k=0;k<6;k++) {
        const lcg=((9*nextRound+11+k*7)%45)+1;
        scores[lcg]+=3;
    }
    return selectFromRanges(scores);
}

// S11: 보수 + ±2 + 보너스추적 + 구간
function S11(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=5;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; });
    });
    // 보너스 추적
    for(let k=Math.max(0,past.length-5);k<past.length;k++) {
        scores[past[k].bonus] += 5-(past.length-1-k);
    }
    return selectFromRanges(scores);
}

// S12: 가중치 조합 실험 (보수*8, ±2*6, 간격*4)
function S12(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*4;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=8;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=6; });
    });
    const cands = Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>parseInt(e[0]));
    return filterBySum(cands, scores, 115, 170);
}

// S13: 보수 전용 (간격 없이 보수만)
function S13(past) {
    const prev = past[past.length-1].numbers;
    const prev2 = past.length>=2 ? past[past.length-2].numbers : [];
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = 0;
    prev.forEach(n => { const c=46-n; if(c>=1&&c<=45) scores[c]+=10; });
    prev2.forEach(n => { const c=46-n; if(c>=1&&c<=45) scores[c]+=5; });
    prev.forEach(n => { [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; }); });
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>parseInt(e[0])).sort((a,b)=>a-b);
}

// S14: 10개 선택 (보수+±2+간격+구간)
function S14(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.0;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=5;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; });
    });
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,10).map(e=>parseInt(e[0])).sort((a,b)=>a-b);
}

// S15: 15개 선택 (최대 커버리지)
function S15(past) {
    const prev = past[past.length-1].numbers;
    const gap = getGapScores(past);
    const hot = getHot(past, 20);
    const scores = {};
    for(let i=1;i<=45;i++) scores[i] = gap[i]*3 + hot[i]*1.5;
    prev.forEach(n => {
        const c=46-n; if(c>=1&&c<=45) scores[c]+=5;
        [-2,2].forEach(d => { const t=n+d; if(t>=1&&t<=45) scores[t]+=4; });
    });
    for(let k=Math.max(0,past.length-3);k<past.length;k++) scores[past[k].bonus]+=3;
    return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>parseInt(e[0])).sort((a,b)=>a-b);
}

// ============================
// 백테스팅
// ============================
const strategies = [
    {name:'보수+간격+구간', fn:S1},
    {name:'±2+간격+구간', fn:S2},
    {name:'LCG(9,11)+구간', fn:S3},
    {name:'mod7+간격+구간', fn:S4},
    {name:'DR789+간격+구간', fn:S5},
    {name:'보수+±2+간격', fn:S6},
    {name:'전체조합', fn:S7},
    {name:'전체+합계필터', fn:S8},
    {name:'메타+조작패턴', fn:S9},
    {name:'구간+모든조작', fn:S10},
    {name:'보수±2보너스구간', fn:S11},
    {name:'가중(보수8±2_6)', fn:S12},
    {name:'보수전용', fn:S13},
    {name:'10개선택(조작)', fn:S14},
    {name:'15개선택(조작)', fn:S15},
];

const testRounds = 100;
const startIdx = allResults.length - testRounds;

console.log('순위 | 전략               | 평균적중 | 3+개 | 4+개 | 5+개 | 선택수 | 분포');
console.log('-'.repeat(100));

const results = [];
for (const strategy of strategies) {
    let totalMatch = 0, m3=0, m4=0, m5=0;
    const dist = new Array(10).fill(0);
    let pickCount = 6;
    for (let i = startIdx; i < allResults.length; i++) {
        const past = allResults.slice(0, i);
        if (past.length < 50) continue;
        try {
            const pred = strategy.fn(past);
            pickCount = pred.length;
            const actual = allResults[i].numbers;
            const matches = pred.filter(n => actual.includes(n)).length;
            totalMatch += matches;
            if(matches<dist.length) dist[matches]++;
            if(matches>=3)m3++; if(matches>=4)m4++; if(matches>=5)m5++;
        } catch(e){}
    }
    results.push({name:strategy.name, avg:totalMatch/testRounds, m3, m4, m5, pickCount, dist});
}

results.sort((a,b) => b.avg - a.avg);
results.forEach((r, idx) => {
    const distStr = r.dist.slice(0,7).map((d,i)=>`${i}:${d}`).join(' ');
    console.log(`${(idx+1).toString().padStart(2)}위 | ${r.name.padEnd(16)} | ${r.avg.toFixed(3).padStart(6)} | ${r.m3.toString().padStart(3)}회 | ${r.m4.toString().padStart(3)}회 | ${r.m5.toString().padStart(3)}회 | ${r.pickCount.toString().padStart(4)}개 | ${distStr}`);
});

// 6개 선택 중 최고
console.log('\n\n6개 선택 전략 중 최고:');
const pick6 = results.filter(r=>r.pickCount===6).sort((a,b)=>b.m3===a.m3?b.avg-a.avg:b.m3-a.m3);
pick6.slice(0,5).forEach((r,i) => console.log(`  ${i+1}. ${r.name}: 평균${r.avg.toFixed(3)}, 3+:${r.m3}%, 4+:${r.m4}%, 5+:${r.m5}%`));

// 1209회 추천
console.log('\n1209회 추천:');
const topStrats = results.slice(0, 5);
topStrats.forEach(r => {
    const fn = strategies.find(s=>s.name===r.name).fn;
    const pred = fn(allResults);
    console.log(`  ${r.name} (${r.pickCount}개): [${pred.join(', ')}] 평균${r.avg.toFixed(3)}`);
});
