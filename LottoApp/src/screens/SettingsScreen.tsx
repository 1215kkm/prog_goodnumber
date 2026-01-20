import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface NotificationSettings {
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  minute: number;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    dayOfWeek: 6,
    hour: 19,
    minute: 0,
  });

  const handleToggle = (enabled: boolean) => {
    setSettings({ ...settings, enabled });
    if (enabled) {
      Alert.alert('알림 설정', '알림이 활성화되었습니다.');
    }
  };

  const handleDayChange = (day: number) => {
    setSettings({ ...settings, dayOfWeek: day });
  };

  const handleHourChange = (hour: number) => {
    setSettings({ ...settings, hour });
  };

  const handleTestNotification = () => {
    Alert.alert('테스트 알림', '🎱 1155회 로또 추천번호\n이번 주 핫넘버: 3, 13, 20, 27, 34, 39');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>설정</Text>
        <Text style={styles.subtitle}>알림 및 앱 설정</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>푸시 알림</Text>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>추천번호 알림</Text>
            <Text style={styles.settingDescription}>매주 설정한 시간에 알림</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#3a3a5a', true: '#ff6b35' }}
            thumbColor={settings.enabled ? '#ffffff' : '#888888'}
          />
        </View>

        {settings.enabled ? (
          <View>
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>알림 요일</Text>
              <View style={styles.dayPicker}>
                {DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      settings.dayOfWeek === index ? styles.dayButtonActive : undefined
                    ]}
                    onPress={() => handleDayChange(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      settings.dayOfWeek === index ? styles.dayButtonTextActive : undefined
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>알림 시간</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.hourPicker}>
                  {HOURS.map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.hourButton,
                        settings.hour === hour ? styles.hourButtonActive : undefined
                      ]}
                      onPress={() => handleHourChange(hour)}
                    >
                      <Text style={[
                        styles.hourButtonText,
                        settings.hour === hour ? styles.hourButtonTextActive : undefined
                      ]}>
                        {hour.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                매주 {DAYS[settings.dayOfWeek]}요일 {settings.hour.toString().padStart(2, '0')}:00에 알림
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>알림 테스트</Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestNotification}
        >
          <Text style={styles.testButtonText}>테스트 알림 보내기</Text>
        </TouchableOpacity>
        <Text style={styles.testDescription}>
          알림 미리보기를 확인합니다
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>개발자</Text>
          <Text style={styles.infoValue}>LottoApp Team</Text>
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          본 앱은 통계 분석 참고용이며 당첨을 보장하지 않습니다.
          책임감 있는 로또 구매를 권장합니다.
        </Text>
      </View>

      <View style={styles.footer} />
    </ScrollView>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 5,
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
    color: '#ffffff',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: '#ffffff',
  },
  settingDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  pickerSection: {
    marginTop: 20,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 10,
  },
  dayPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#ff6b35',
  },
  dayButtonText: {
    color: '#888888',
    fontWeight: 'bold',
  },
  dayButtonTextActive: {
    color: '#ffffff',
  },
  hourPicker: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  hourButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    marginRight: 8,
  },
  hourButtonActive: {
    backgroundColor: '#ff6b35',
  },
  hourButtonText: {
    color: '#888888',
    fontSize: 14,
  },
  hourButtonTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  summaryText: {
    color: '#ff6b35',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#ff6b35',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testDescription: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  infoLabel: {
    color: '#888888',
  },
  infoValue: {
    color: '#ffffff',
  },
  disclaimer: {
    marginHorizontal: 20,
    padding: 15,
  },
  disclaimerText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    height: 30,
  },
});
