/**
 * 로또 당첨번호 자동 업데이트 스크립트
 * 동행복권 API에서 최신 당첨번호를 가져와 C# + TypeScript 파일을 모두 업데이트합니다.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const CS_PATH = path.join(__dirname, '../LottoAnalyzer.Core/Services/LottoDataService.cs');
const TS_PATH = path.join(__dirname, '../LottoApp/src/services/lotteryService.ts');

/**
 * HTTP GET 요청
 */
function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * 최신 회차 번호 계산
 */
function estimateLatestRound() {
    const startDate = new Date(2002, 11, 7); // 2002년 12월 7일 1회
    const today = new Date();
    const weeks = Math.floor((today - startDate) / (7 * 24 * 60 * 60 * 1000));
    return weeks + 1;
}

/**
 * 특정 회차 데이터 가져오기
 */
async function getLottoResult(round) {
    try {
        const data = await fetchData(API_URL + round);
        if (data.returnValue !== 'success') return null;

        return {
            round: round,
            date: data.drwNoDate,
            numbers: [
                data.drwtNo1, data.drwtNo2, data.drwtNo3,
                data.drwtNo4, data.drwtNo5, data.drwtNo6
            ],
            bonus: data.bnusNo
        };
    } catch (e) {
        console.error(`Failed to fetch round ${round}:`, e.message);
        return null;
    }
}

/**
 * 실제 최신 회차 찾기
 */
async function findLatestRound() {
    const estimated = estimateLatestRound();

    for (let i = estimated + 5; i >= estimated - 10; i--) {
        const result = await getLottoResult(i);
        if (result) {
            console.log(`Found latest round: ${i}`);
            return i;
        }
    }

    return estimated;
}

/**
 * C# 코드에서 기존 회차 파싱
 */
function parseExistingRoundsCS(content) {
    const regex = /\((\d+),\s*new\s+DateTime/g;
    const rounds = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
        rounds.add(parseInt(match[1]));
    }
    return rounds;
}

/**
 * TypeScript 코드에서 기존 회차 파싱
 */
function parseExistingRoundsTS(content) {
    const regex = /round:\s*(\d+)/g;
    const rounds = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
        rounds.add(parseInt(match[1]));
    }
    return rounds;
}

/**
 * C# 형식으로 데이터 변환
 */
function formatToCS(result) {
    const date = new Date(result.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const nums = result.numbers.join(', ');
    return `                (${result.round}, new DateTime(${year}, ${month}, ${day}), new[] { ${nums} }, ${result.bonus}),`;
}

/**
 * TypeScript 형식으로 데이터 변환
 */
function formatToTS(result) {
    const nums = `[${result.numbers.join(', ')}]`;
    return `    { round: ${result.round}, date: '${result.date}', numbers: ${nums}, bonus: ${result.bonus} },`;
}

/**
 * C# LottoDataService.cs 업데이트
 */
function updateCSFile(content, newEntries) {
    // GetReal2025Data 메서드의 첫 번째 데이터 항목 찾기
    const marker = '// 2026년';
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) {
        throw new Error('2026년 marker not found in C# file');
    }

    // 마커 줄의 시작 위치 찾기
    const lineStart = content.lastIndexOf('\n', markerIdx) + 1;

    // 새 데이터 + 새 주석
    const today = new Date();
    const monthStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    const newLines = newEntries.map(formatToCS).join('\n');
    const insertion = `                // ${monthStr} - 자동 업데이트\n${newLines}\n\n`;

    return content.slice(0, lineStart) + insertion + content.slice(lineStart);
}

/**
 * TypeScript lotteryService.ts 업데이트
 */
function updateTSFile(content, newEntries) {
    // get2025Data 함수의 return [ 다음 줄 찾기
    const marker = 'function get2025Data(): LotteryDraw[]';
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) {
        throw new Error('get2025Data function not found in TS file');
    }

    const returnBracket = content.indexOf('return [', markerIdx);
    if (returnBracket === -1) {
        throw new Error('return [ not found in TS file');
    }

    const insertPoint = content.indexOf('\n', returnBracket) + 1;

    const newLines = newEntries.map(formatToTS).join('\n') + '\n';

    return content.slice(0, insertPoint) + newLines + content.slice(insertPoint);
}

/**
 * 메인 실행
 */
async function main() {
    console.log('=== 로또 데이터 자동 업데이트 시작 ===');
    console.log(`시간: ${new Date().toISOString()}`);

    // 1. 현재 데이터 파일 읽기
    console.log('\n1. 데이터 파일 읽는 중...');
    const csContent = fs.readFileSync(CS_PATH, 'utf8');
    const tsContent = fs.readFileSync(TS_PATH, 'utf8');

    const existingCS = parseExistingRoundsCS(csContent);
    const existingTS = parseExistingRoundsTS(tsContent);
    const maxExisting = Math.max(...existingCS, ...existingTS);
    console.log(`   C# 기존: ${existingCS.size}개 회차 (최신 ${Math.max(...existingCS)})`);
    console.log(`   TS 기존: ${existingTS.size}개 회차 (최신 ${Math.max(...existingTS)})`);

    // 2. 최신 회차 확인
    console.log('\n2. 최신 회차 확인 중...');
    const latestRound = await findLatestRound();

    // 3. 누락된 회차 확인 (두 파일 모두 기준)
    console.log('\n3. 누락된 회차 확인 중...');
    const missingCS = [];
    const missingTS = [];
    for (let i = maxExisting + 1; i <= latestRound; i++) {
        if (!existingCS.has(i)) missingCS.push(i);
        if (!existingTS.has(i)) missingTS.push(i);
    }

    const allMissing = [...new Set([...missingCS, ...missingTS])].sort((a, b) => a - b);

    if (allMissing.length === 0) {
        console.log('   이미 최신 데이터입니다. 업데이트가 필요하지 않습니다.');
        return false;
    }

    console.log(`   누락된 회차: ${allMissing.join(', ')}`);

    // 4. 누락된 데이터 가져오기
    console.log('\n4. 새 데이터 가져오는 중...');
    const newEntries = [];
    for (const round of allMissing) {
        const result = await getLottoResult(round);
        if (result) {
            console.log(`   회차 ${round}: ${result.numbers.join(', ')} + ${result.bonus}`);
            newEntries.push(result);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (newEntries.length === 0) {
        console.log('   가져올 새 데이터가 없습니다.');
        return false;
    }

    // 내림차순 정렬 (최신이 위로)
    newEntries.sort((a, b) => b.round - a.round);

    // 5. C# 파일 업데이트
    const csNew = newEntries.filter(e => !existingCS.has(e.round));
    if (csNew.length > 0) {
        console.log('\n5a. C# 파일 업데이트 중...');
        const updatedCS = updateCSFile(csContent, csNew);
        fs.writeFileSync(CS_PATH, updatedCS, 'utf8');
        console.log(`   LottoDataService.cs 업데이트 완료 (+${csNew.length}회차)`);
    }

    // 6. TypeScript 파일 업데이트
    const tsNew = newEntries.filter(e => !existingTS.has(e.round));
    if (tsNew.length > 0) {
        console.log('\n5b. TypeScript 파일 업데이트 중...');
        const updatedTS = updateTSFile(tsContent, tsNew);
        fs.writeFileSync(TS_PATH, updatedTS, 'utf8');
        console.log(`   lotteryService.ts 업데이트 완료 (+${tsNew.length}회차)`);
    }

    console.log('\n=== 업데이트 완료 ===');
    console.log(`추가된 회차: ${newEntries.map(e => e.round).join(', ')}`);

    return true;
}

// 스크립트 실행
main()
    .then(updated => {
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
