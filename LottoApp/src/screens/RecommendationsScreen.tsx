import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { getRecommendations, getNextRound, getDaysUntilDraw } from '../services/lotteryService';

export default function RecommendationsScreen() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const recommendations = getRecommendations();
  const nextRound = getNextRound();
  const daysUntil = getDaysUntilDraw();

  const handleShare = async (rec: { algorithm: string; numbers: number[] }) => {
    try {
      await Share.share({
        message: `🎱 ${nextRound}회 로또 추천번호 (${rec.algorithm})\n\n${rec.numbers.join(', ')}\n\n로또 분석기 앱에서 추천받은 번호입니다!`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const renderNumberBall = (num: number) => {
    return (
      <View key={num} style={[styles.ball, { backgroundColor: getBallColor(num) }]}>
        <Text style={styles.ballText}>{num}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 AI 추천번호</Text>
        <Text style={styles.subtitle}>8가지 알고리즘 분석 결과</Text>
        <View style={styles.roundBadge}>
          <Text style={styles.roundText}>{nextRound}회 | D-{daysUntil}</Text>
        </View>
      </View>

      {/* 추천 카드들 */}
      {recommendations.map((rec, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.card,
            selectedIndex === index && styles.cardSelected
          ]}
          onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{rec.algorithm}</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(rec)}
            >
              <Text style={styles.shareIcon}>📤</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDescription}>{rec.description}</Text>
          <View style={styles.numbersRow}>
            {rec.numbers.map(renderNumberBall)}
          </View>
          {selectedIndex === index && (
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📋 복사</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => handleShare(rec)}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>📤 공유</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {/* 면책 조항 */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚠️ 본 추천번호는 통계 분석에 기반한 참고용이며, 당첨을 보장하지 않습니다.
          로또는 무작위 추첨이므로 책임감 있는 구매를 권장합니다.
        </Text>
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
  roundBadge: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 15,
  },
  roundText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#16213e',
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#ff6b35',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  shareButton: {
    padding: 5,
  },
  shareIcon: {
    fontSize: 20,
  },
  cardDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 15,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ball: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    marginHorizontal: 5,
  },
  actionButtonPrimary: {
    backgroundColor: '#ff6b35',
  },
  actionButtonText: {
    color: '#888',
    fontWeight: 'bold',
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },
  disclaimer: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 15,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  disclaimerText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    height: 30,
  },
});
