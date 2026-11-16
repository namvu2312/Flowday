import { PriorityLevel, RepeatPattern, ScheduleItem } from '../types/schedule';

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISO(): string {
  return formatDateISO(new Date());
}

export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysISO(dateStr: string, offset: number): string {
  const dt = parseISODate(dateStr);
  dt.setDate(dt.getDate() + offset);
  return formatDateISO(dt);
}

const SHORT_WEEKDAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const FULL_WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export function getShortWeekdayVi(dateStr: string): string {
  const dt = parseISODate(dateStr);
  return SHORT_WEEKDAYS_VI[dt.getDay()];
}

export function getFullDateLabelVi(dateStr: string): string {
  const dt = parseISODate(dateStr);
  const today = getTodayISO();
  const tomorrow = addDaysISO(today, 1);
  const day = dt.getDate();
  const month = dt.getMonth() + 1;
  const weekday = FULL_WEEKDAYS_VI[dt.getDay()];
  if (dateStr === today) return `Hôm nay, ${weekday} ${day}/${month}`;
  if (dateStr === tomorrow) return `Ngày mai, ${weekday} ${day}/${month}`;
  return `${weekday}, ${day} tháng ${month}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getDurationMinutes(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return diff > 0 ? diff : 30;
}

export function formatDurationVi(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : `${h}g ${m}p`;
}

export function formatCountdownVi(minutesUntilStart: number, isOngoing: boolean): string {
  if (isOngoing) return 'Đang diễn ra';
  if (minutesUntilStart <= 0) return 'Sắp bắt đầu';
  if (minutesUntilStart < 60) return `Còn ${minutesUntilStart} phút`;
  const h = Math.floor(minutesUntilStart / 60);
  const m = minutesUntilStart % 60;
  return m === 0 ? `Còn ${h} giờ` : `Còn ${h}g ${m}p`;
}

export function occursOnDate(item: ScheduleItem, targetDateStr: string): boolean {
  if (item.date === targetDateStr) return true;
  if (targetDateStr < item.date) return false;
  if (item.repeat === 'none') return false;
  if (item.repeat === 'daily') return true;

  const targetDay = parseISODate(targetDateStr).getDay();
  if (item.repeat === 'weekdays') {
    return targetDay >= 1 && targetDay <= 5;
  }
  if (item.repeat === 'weekly') {
    const startDay = parseISODate(item.date).getDay();
    return targetDay === startDay;
  }
  return false;
}

export function sortItemsByTime(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    const prioRank: Record<PriorityLevel, number> = { high: 0, medium: 1, low: 2 };
    return prioRank[a.priority] - prioRank[b.priority];
  });
}

export function isWithinQuietHours(now: Date, startHHMM: string, endHHMM: string): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startHHMM);
  const end = timeToMinutes(endHHMM);
  if (start === end) return false;
  if (start < end) {
    return cur >= start && cur < end;
  }
  // Spans midnight (e.g., 22:30 to 06:30)
  return cur >= start || cur < end;
}

export function getRepeatLabelVi(repeat: RepeatPattern): string {
  switch (repeat) {
    case 'daily':
      return 'Hằng ngày';
    case 'weekdays':
      return 'Thứ 2 – Thứ 6';
    case 'weekly':
      return 'Hằng tuần';
    default:
      return 'Một lần';
  }
}

export function getPriorityLabelVi(priority: PriorityLevel): string {
  switch (priority) {
    case 'high':
      return 'Ưu tiên cao';
    case 'medium':
      return 'Trung bình';
    case 'low':
      return 'Nhẹ nhàng';
  }
}

export function getReminderSummaryVi(offsets: number[]): string {
  if (!offsets || offsets.length === 0) return 'Không nhắc';
  const sorted = [...offsets].sort((a, b) => b - a);
  return sorted
    .map((m) => (m === 0 ? 'Đúng giờ' : m >= 60 ? `${m / 60}g trước` : `${m}p trước`))
    .join(', ');
}

export function buildStarterSchedule(userId = 'local'): ScheduleItem[] {
  const today = getTodayISO();
  const tomorrow = addDaysISO(today, 1);
  return [
    {
      id: 'starter-1',
      userId,
      title: 'Ôn tập Cấu trúc Dữ liệu & Giải thuật',
      notes: 'Tập trung phần đồ thị và quy hoạch động (Chương 5)',
      category: 'study',
      date: today,
      startTime: '08:30',
      endTime: '10:00',
      priority: 'high',
      repeat: 'weekdays',
      reminderMinutes: [30, 5],
      completed: true,
      snoozedUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'starter-2',
      userId,
      title: 'Họp đồng bộ tiến độ dự án tuần',
      notes: 'Cập nhật roadmap Q4 và phân bổ đầu việc',
      category: 'work',
      date: today,
      startTime: '14:00',
      endTime: '15:00',
      priority: 'high',
      repeat: 'weekly',
      reminderMinutes: [15],
      completed: false,
      snoozedUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'starter-3',
      userId,
      title: 'Luyện nghe Tiếng Anh học thuật',
      notes: 'Podcast 20 phút + ghi chú từ vựng mới',
      category: 'study',
      date: today,
      startTime: '19:30',
      endTime: '20:15',
      priority: 'medium',
      repeat: 'daily',
      reminderMinutes: [15],
      completed: false,
      snoozedUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'starter-4',
      userId,
      title: 'Tổng kết báo cáo công việc cuối ngày',
      notes: 'Kiểm tra email và lập kế hoạch ngày mai',
      category: 'work',
      date: today,
      startTime: '20:30',
      endTime: '21:00',
      priority: 'low',
      repeat: 'weekdays',
      reminderMinutes: [5],
      completed: false,
      snoozedUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: 'starter-5',
      userId,
      title: 'Thực hành thiết kế giao diện di động',
      notes: 'Hoàn thiện wireframe và kiểm thử trên iPhone',
      category: 'work',
      date: tomorrow,
      startTime: '09:30',
      endTime: '11:30',
      priority: 'high',
      repeat: 'none',
      reminderMinutes: [30, 5],
      completed: false,
      snoozedUntil: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
}
