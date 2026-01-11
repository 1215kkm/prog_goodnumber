import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>로또 분석기</Text>
          <Text style={styles.subtitle}>AI 기반 번호 추천</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>핫 넘버</Text>
          <View style={styles.numbersRow}>
            {[3, 13, 20, 27, 34, 39].map(num => (
              <View key={num} style={styles.ball}>
                <Text style={styles.ballText}>{num}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>콜드 넘버</Text>
          <View style={styles.numbersRow}>
            {[8, 15, 23, 28, 36, 44].map(num => (
              <View key={num} style={styles.ballCold}>
                <Text style={styles.ballText}>{num}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
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
    color: '#888888',
    marginTop: 5,
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
    color: '#ffffff',
    marginBottom: 15,
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ball: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#ff6b35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballCold: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#00bcd4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
