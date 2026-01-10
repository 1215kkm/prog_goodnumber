import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { getHotNumbers, getColdNumbers, getDaysUntilDraw, getNextRound, getRecentDraws } from '../services/lotteryService';

export default function HomeScreen({ navigation }: any) {
  const hotNumbers = getHotNumbers(6);
  const coldNumbers = getColdNumbers(6);
  const daysUntil = getDaysUntilDraw();
  const nextRound = getNextRound();
  const recentDraws = getRecentDraws().slice(0, 5);

  const renderNumberBall = (num: number, isHot: boolean = false, isCold: boolean = false) => {
    let bgColor = '#6c757d';
    if (num <= 10) bgColor = '#ffc107';
    else if (num <= 20) bgColor = '#2196f3';
    else if (num <= 30) bgColor = '#e91e63';
    else if (num <= 40) bgColor = '#4caf50';
    else bgColor = '#9c27b0';

    if (isHot) bgColor = '#ff6b35';
    if (isCold) bgColor = '#00bcd4';

    return (
      <View key={num} style={[styles.ball, { backgroundColor: bgColor }]}>
        <Text style={styles.ballText}>{num}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>🎱 로또 분석기</Text>
        <Text style={styles.subtitle}>AI 기반 번호 추천</Text>
      </View>

      {/* 긴급 배너 */}
      <View style={styles.urgencyBanner}>
        <Text style={styles.urgencyText}>
          ⏰ {nextRound}회 추첨까지 {daysUntil}일 남음!
        </Text>
      </View>

      {/* 핫 넘버 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔥 핫 넘버</Text>
        <Text style={styles.cardSubtitle}>최근 자주 나온 번호</Text>
        <View style={styles.numbersRow}>
          {hotNumbers.map(num => renderNumberBall(num, true))}
        </View>
      </View>

      {/* 콜드 넘버 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>❄️ 콜드 넘버</Text>
        <Text style={styles.cardSubtitle}>오랫동안 안 나온 번호</Text>
        <View style={styles.numbersRow}>
          {coldNumbers.map(num => renderNumberBall(num, false, true))}
        </View>
      </View>

      {/* 최근 당첨번호 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 최근 당첨번호</Text>
        {recentDraws.map(draw => (
          <View key={draw.round} style={styles.drawRow}>
            <Text style={styles.roundText}>{draw.round}회</Text>
            <View style={styles.numbersRowSmall}>
              {draw.numbers.map(num => (
                <View key={num} style={[styles.ballSmall, { backgroundColor: getBallColor(num) }]}>
                  <Text style={styles.ballTextSmall}>{num}</Text>
                </View>
              ))}
              <Text style={styles.plusSign}>+</Text>
              <View style={[styles.ballSmall, styles.bonusBall]}>
                <Text style={styles.ballTextSmall}>{draw.bonus}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* CTA 버튼들 */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('추천')}
        >
          <Text style={styles.ctaButtonText}>🎯 AI 추천받기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaButton, styles.ctaButtonSecondary]}
          onPress={() => navigation.navigate('통계')}
        >
          <Text style={[styles.ctaButtonText, styles.ctaButtonTextSecondary]}>📊 통계분석</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

function getBallColor(num: number): string {
  if (num <= 10) return '#ffc107';
  if (num <= 20) return '#2196f3';
  if (num <= 30) return '#e91e63';
  if (num <= 40) return '#4caf50';
  return '#9c27b0';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 5,
  },
  urgencyBanner: {
    backgroundColor: '#ff6b35',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  urgencyText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ball: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  drawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  roundText: {
    color: '#888',
    width: 50,
    fontSize: 12,
  },
  numbersRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  ballSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  ballTextSmall: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  bonusBall: {
    backgroundColor: '#888',
    borderWidth: 2,
    borderColor: '#ff6b35',
  },
  plusSign: {
    color: '#888',
    marginHorizontal: 5,
  },
  ctaContainer: {
    padding: 20,
  },
  ctaButton: {
    backgroundColor: '#ff6b35',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ff6b35',
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ctaButtonTextSecondary: {
    color: '#ff6b35',
  },
  footer: {
    height: 30,
  },
});
