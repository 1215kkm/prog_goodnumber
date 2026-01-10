import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  requestPermissions,
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
} from '../services/notificationService';
import { NotificationSettings } from '../types/lottery';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    dayOfWeek: 6,
    hour: 19,
    minute: 0,
  });
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const saved = await getNotificationSettings();
    setSettings(saved);
    const permission = await requestPermissions();
    setHasPermission(permission);
  };

  const handleToggle = async (enabled: boolean) => {
    if (enabled && !hasPermission) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          '알림 권한 필요',
          '설정에서 알림 권한을 허용해주세요.',
          [{ text: '확인' }]
        );
        return;
      }
      setHasPermission(true);
    }

    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const handleDayChange = async (day: number) => {
    const newSettings = { ...settings, dayOfWeek: day };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const handleHourChange = async (hour: number) => {
    const newSettings = { ...settings, hour };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  const handleTestNotification = async () => {
    const permission = await requestPermissions();
    if (!permission) {
      Alert.alert('알림 권한이 필요합니다');
      return;
    }
    await sendTestNotification();
    Alert.alert('테스트 알림', '3초 후 알림이 도착합니다!');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ 설정</Text>
        <Text style={styles.subtitle}>알림 및 앱 설정</Text>
      </View>

      {/* 알림 설정 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔔 푸시 알림</Text>

        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>추천번호 알림</Text>
            <Text style={styles.settingDescription}>매주 설정한 시간에 알림</Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={handleToggle}
            trackColor={{ false: '#3a3a5a', true: '#ff6b35' }}
            thumbColor={settings.enabled ? '#fff' : '#888'}
          />
        </View>

        {settings.enabled && (
          <>
            {/* 요일 선택 */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>알림 요일</Text>
              <View style={styles.dayPicker}>
                {DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayButton,
                      settings.dayOfWeek === index && styles.dayButtonActive
                    ]}
                    onPress={() => handleDayChange(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      settings.dayOfWeek === index && styles.dayButtonTextActive
                    ]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 시간 선택 */}
            <View style={styles.pickerSection}>
              <Text style={styles.pickerLabel}>알림 시간</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.hourPicker}>
                  {HOURS.map(hour => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.hourButton,
                        settings.hour === hour && styles.hourButtonActive
                      ]}
                      onPress={() => handleHourChange(hour)}
                    >
                      <Text style={[
                        styles.hourButtonText,
                        settings.hour === hour && styles.hourButtonTextActive
                      ]}>
                        {hour.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* 현재 설정 요약 */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                📅 매주 {DAYS[settings.dayOfWeek]}요일 {settings.hour.toString().padStart(2, '0')}:00에 알림
              </Text>
            </View>
          </>
        )}
      </View>

      {/* 테스트 알림 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧪 알림 테스트</Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestNotification}
        >
          <Text style={styles.testButtonText}>테스트 알림 보내기</Text>
        </TouchableOpacity>
        <Text style={styles.testDescription}>
          3초 후에 테스트 알림이 도착합니다
        </Text>
      </View>

      {/* 앱 정보 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ 앱 정보</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>개발자</Text>
          <Text style={styles.infoValue}>LottoApp Team</Text>
        </View>
      </View>

      {/* 면책 조항 */}
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
    color: '#888',
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
    color: '#fff',
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
    color: '#fff',
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pickerSection: {
    marginTop: 20,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#888',
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
    color: '#888',
    fontWeight: 'bold',
  },
  dayButtonTextActive: {
    color: '#fff',
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
    color: '#888',
    fontSize: 14,
  },
  hourButtonTextActive: {
    color: '#fff',
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
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testDescription: {
    color: '#888',
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
    color: '#888',
  },
  infoValue: {
    color: '#fff',
  },
  disclaimer: {
    marginHorizontal: 20,
    padding: 15,
  },
  disclaimerText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    height: 30,
  },
});
