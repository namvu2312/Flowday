export type ScheduleCategory = 'study' | 'work';
export type PriorityLevel = 'high' | 'medium' | 'low';
export type RepeatPattern = 'none' | 'daily' | 'weekdays' | 'weekly';
export type ThemeMode = 'light' | 'dark' | 'system';
export type TabKey = 'today' | 'schedule' | 'reminders' | 'settings';

export const MAX_TITLE_LENGTH = 140;
export const MAX_NOTES_LENGTH = 500;
export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const TIME_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export interface ScheduleItem {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  category: ScheduleCategory;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  priority: PriorityLevel;
  repeat: RepeatPattern;
  reminderMinutes: number[]; // minutes before startTime, max 5
  completed: boolean;
  snoozedUntil?: number; // epoch ms
  createdAt?: number;
  updatedAt?: number;
}

export type ScheduleItemDraft = Omit<ScheduleItem, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export interface UserPreferences {
  themeMode: ThemeMode;
  accentColor: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  pushEnabled: boolean;
  smartLeadHigh: number;
  smartLeadMedium: number;
  smartLeadLow: number;
}

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  darkHex?: string;
}

export interface ActiveReminderAlert {
  item: ScheduleItem;
  offsetMinutes: number;
  triggeredAt: number;
}
