/**
 * 로또 당첨번호 자동 업데이트 스크립트
 * 동행복권 API에서 최신 당첨번호를 가져와 LottoDataService.cs 파일을 업데이트합니다.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const DATA_SERVICE_PATH = path.join(__dirname, '../LottoAnalyzer.Core/Services/LottoDataService.cs');

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
 * C# 코드에서 기존 데이터 파싱
 */
function parseExistingData(content) {
    const regex = /\((\d+),\s*new\s+DateTime\((\d+),\s*(\d+),\s*(\d+)\),\s*new\[\]\s*\{\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\},\s*(\d+)\)/g;
    const rounds = new Set();
    let match;

    while ((match = regex.exec(content)) !== null) {
        rounds.add(parseInt(match[1]));
    }

    return rounds;
}

/**
 * 새 데이터를 C# 형식으로 변환
 */
function formatDataToCSharp(result) {
    const date = new Date(result.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const nums = result.numbers.join(', ');

    return `                (${result.round}, new DateTime(${year}, ${month}, ${day}), new[] { ${nums} }, ${result.bonus}),`;
}

/**
 * LottoDataService.cs 파일 업데이트
 */
function updateDataService(content, newEntries) {
    // GetReal2025Data 메서드 내 return 문 찾기
    const methodStart = content.indexOf('private List<(int, DateTime, int[], int)> GetReal2025Data()');
    if (methodStart === -1) {
        throw new Error('GetReal2025Data method not found');
    }

    const returnStart = content.indexOf('return new List<(int, DateTime, int[], int)>', methodStart);
    if (returnStart === -1) {
        throw new Error('Return statement not found in GetReal2025Data');
    }

    const listStart = content.indexOf('{', returnStart);
    const commentLine = content.indexOf('//', listStart);

    // 첫 번째 데이터 항목 바로 전에 새 데이터 삽입
    const insertPoint = content.indexOf('(', listStart);

    // 새 데이터 문자열 생성
    const newDataStr = newEntries.map(formatDataToCSharp).join('\n') + '\n';

    // 새 주석 추가
    const today = new Date();
    const yearMonth = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    const newComment = `                // ${yearMonth} - 자동 업데이트\n`;

    // 기존 데이터에 새 데이터 삽입
    const updatedContent =
        content.slice(0, insertPoint) +
        newComment +
        newDataStr +
        '                ' +
        content.slice(insertPoint);

    return updatedContent;
}

/**
 * 메인 실행
 */
async function main() {
    console.log('=== 로또 데이터 자동 업데이트 시작 ===');
    console.log(`시간: ${new Date().toISOString()}`);

    // 1. 현재 데이터 파일 읽기
    console.log('\n1. LottoDataService.cs 파일 읽는 중...');
    const content = fs.readFileSync(DATA_SERVICE_PATH, 'utf8');
    const existingRounds = parseExistingData(content);
    console.log(`   기존 데이터: ${existingRounds.size}개 회차`);

    // 2. 최신 회차 확인
    console.log('\n2. 최신 회차 확인 중...');
    const latestRound = await findLatestRound();

    // 3. 누락된 회차 확인
    console.log('\n3. 누락된 회차 확인 중...');
    const missingRounds = [];
    for (let i = Math.max(...existingRounds) + 1; i <= latestRound; i++) {
        if (!existingRounds.has(i)) {
            missingRounds.push(i);
        }
    }

    if (missingRounds.length === 0) {
        console.log('   이미 최신 데이터입니다. 업데이트가 필요하지 않습니다.');
        return false;
    }

    console.log(`   누락된 회차: ${missingRounds.join(', ')}`);

    // 4. 누락된 데이터 가져오기
    console.log('\n4. 새 데이터 가져오는 중...');
    const newEntries = [];
    for (const round of missingRounds) {
        const result = await getLottoResult(round);
        if (result) {
            console.log(`   회차 ${round}: ${result.numbers.join(', ')} + ${result.bonus}`);
            newEntries.push(result);
        }
        // API 요청 간 대기
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (newEntries.length === 0) {
        console.log('   가져올 새 데이터가 없습니다.');
        return false;
    }

    // 5. 파일 업데이트
    console.log('\n5. 파일 업데이트 중...');
    const updatedContent = updateDataService(content, newEntries.sort((a, b) => b.round - a.round));
    fs.writeFileSync(DATA_SERVICE_PATH, updatedContent, 'utf8');
    console.log('   LottoDataService.cs 업데이트 완료!');

    console.log('\n=== 업데이트 완료 ===');
    console.log(`추가된 회차: ${newEntries.map(e => e.round).join(', ')}`);

    return true;
}

// 스크립트 실행
main()
    .then(updated => {
        process.exit(updated ? 0 : 0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
