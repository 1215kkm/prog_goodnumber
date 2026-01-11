import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NotificationSettings } from '../types/lottery';
import { getHotNumbers, getNextRound } from './lotteryService';

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 알림 권한 요청
export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('실제 기기에서만 알림이 작동합니다');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('알림 권한이 거부되었습니다');
    return false;
  }

  // Android 채널 설정
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('lotto-recommendations', {
      name: '로또 추천번호',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }

  return true;
}

// 알림 설정 저장
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));

  if (settings.enabled) {
    await scheduleWeeklyNotification(settings);
  } else {
    await cancelAllNotifications();
  }
}

// 알림 설정 불러오기
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  // 기본 설정: 토요일 오후 7시
  return {
    enabled: false,
    dayOfWeek: 6, // Saturday
    hour: 19,
    minute: 0,
  };
}

// 주간 알림 예약
export async function scheduleWeeklyNotification(settings: NotificationSettings): Promise<void> {
  // 기존 알림 취소
  await cancelAllNotifications();

  if (!settings.enabled) return;

  const hotNumbers = getHotNumbers(6);
  const nextRound = getNextRound();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎱 ${nextRound}회 로또 추천번호`,
      body: `이번 주 핫넘버: ${hotNumbers.join(', ')}`,
      data: { type: 'weekly_recommendation' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: settings.dayOfWeek + 1, // Expo는 1=일요일
      hour: settings.hour,
      minute: settings.minute,
    },
  });

  console.log(`알림 예약: 매주 ${getDayName(settings.dayOfWeek)} ${settings.hour}:${settings.minute.toString().padStart(2, '0')}`);
}

// 즉시 알림 테스트
export async function sendTestNotification(): Promise<void> {
  const hotNumbers = getHotNumbers(6);
  const nextRound = getNextRound();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎱 ${nextRound}회 로또 추천번호 (테스트)`,
      body: `이번 주 핫넘버: ${hotNumbers.join(', ')}`,
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}

// 모든 알림 취소
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// 예약된 알림 조회
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

// 요일 이름
function getDayName(day: number): string {
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[day];
}
