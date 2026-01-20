import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { getNumberFrequenciesByYears, getTotalDrawsByYears } from '../services/lotteryService';

export default function StatisticsScreen() {
  const [selectedYears, setSelectedYears] = useState(5);

  const frequencies = getNumberFrequenciesByYears(selectedYears);
  const totalDraws = getTotalDrawsByYears(selectedYears);

  const renderFrequencyBar = (freq: { number: number; frequency: number; percentage: number }) => {
    const maxFreq = frequencies[0].frequency;
    const barWidth = maxFreq > 0 ? (freq.frequency / maxFreq) * 100 : 0;

    return (
      <View key={freq.number} style={styles.freqRow}>
        <View style={[styles.ball, { backgroundColor: getBallColor(freq.number) }]}>
          <Text style={styles.ballText}>{freq.number}</Text>
        </View>
        <View style={styles.barContainer}>
          <View style={[styles.bar, { width: `${barWidth}%` }]} />
        </View>
        <Text style={styles.freqText}>{freq.frequency}회</Text>
      </View>
    );
  };

  // 상위 10개, 하위 10개 분리
  const top10 = frequencies.slice(0, 10);
  const bottom10 = frequencies.slice(-10).reverse();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 번호 출현 통계</Text>
        <Text style={styles.subtitle}>{selectedYears}년치 ({totalDraws}회) 분석 결과</Text>
      </View>

      {/* 분석 기간 선택 */}
      <View style={styles.yearSelector}>
        <Text style={styles.yearLabel}>분석 기간:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearButtons}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(year => (
            <TouchableOpacity
              key={year}
              style={[
                styles.yearButton,
                selectedYears === year && styles.yearButtonActive
              ]}
              onPress={() => setSelectedYears(year)}
            >
              <Text style={[
                styles.yearButtonText,
                selectedYears === year && styles.yearButtonTextActive
              ]}>
                {year}년
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 핫 넘버 TOP 10 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔥 가장 많이 나온 번호 TOP 10</Text>
        {top10.map(renderFrequencyBar)}
      </View>

      {/* 콜드 넘버 BOTTOM 10 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>❄️ 가장 적게 나온 번호 10개</Text>
        {bottom10.map(renderFrequencyBar)}
      </View>

      {/* 전체 번호 빈도 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 전체 번호 빈도표</Text>

        {/* 간단한 그리드 */}
        <View style={styles.simpleGrid}>
          {Array.from({ length: 45 }, (_, i) => i + 1).map(num => {
            const freq = frequencies.find(f => f.number === num);
            return (
              <View key={num} style={styles.simpleCell}>
                <View style={[styles.simpleBall, { backgroundColor: getBallColor(num), opacity: freq ? 0.4 + (freq.frequency * 0.015) : 0.4 }]}>
                  <Text style={styles.simpleBallText}>{num}</Text>
                </View>
                <Text style={styles.simpleFreq}>{freq?.frequency || 0}</Text>
              </View>
            );
          })}
        </View>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  yearSelector: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 15,
  },
  yearLabel: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  yearButtons: {
    flexDirection: 'row',
  },
  yearButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
  },
  yearButtonActive: {
    backgroundColor: '#ff6b35',
  },
  yearButtonText: {
    color: '#888',
    fontWeight: 'bold',
  },
  yearButtonTextActive: {
    color: '#fff',
  },
  section: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ball: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ballText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#2a2a4a',
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 10,
  },
  bar: {
    height: '100%',
    backgroundColor: '#ff6b35',
    borderRadius: 10,
  },
  freqText: {
    color: '#888',
    width: 40,
    textAlign: 'right',
  },
  simpleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },
  simpleCell: {
    width: '11%',
    alignItems: 'center',
    marginBottom: 10,
  },
  simpleBall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleBallText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 11,
  },
  simpleFreq: {
    color: '#888',
    fontSize: 9,
    marginTop: 2,
  },
  footer: {
    height: 30,
  },
});
