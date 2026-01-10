export interface LotteryDraw {
  round: number;
  date: string;
  numbers: number[];
  bonus: number;
}

export interface NumberFrequency {
  number: number;
  frequency: number;
  percentage: number;
}

export interface RecommendedNumbers {
  algorithm: string;
  numbers: number[];
  description: string;
}

export interface NotificationSettings {
  enabled: boolean;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number;
  minute: number;
}
