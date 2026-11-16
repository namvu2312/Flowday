import { ScheduleItem } from '../types/schedule';

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function toICSDateTime(dateStr: string, timeStr: string): string {
  const d = dateStr.replace(/-/g, '');
  const t = timeStr.replace(/:/g, '');
  return `${d}T${t}00`;
}

function toICSUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function buildRRule(item: ScheduleItem): string | null {
  switch (item.repeat) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'weekly':
      return 'RRULE:FREQ=WEEKLY';
    default:
      return null;
  }
}

function buildVEvent(item: ScheduleItem): string {
  const categoryLabel = item.category === 'study' ? 'Học tập' : 'Công việc';
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${item.id}@flowday.app`,
    `DTSTAMP:${toICSUtcStamp(new Date())}`,
    `DTSTART:${toICSDateTime(item.date, item.startTime)}`,
    `DTEND:${toICSDateTime(item.date, item.endTime)}`,
    `SUMMARY:${escapeICSText(`[${categoryLabel}] ${item.title}`)}`,
    `CATEGORIES:${escapeICSText(categoryLabel)}`,
  ];

  if (item.notes && item.notes.trim().length > 0) {
    lines.push(`DESCRIPTION:${escapeICSText(item.notes.trim())}`);
  }

  const rrule = buildRRule(item);
  if (rrule) {
    lines.push(rrule);
  }

  const reminders = item.reminderMinutes.length > 0 ? item.reminderMinutes : [15];
  for (const offset of reminders) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeICSText(`Nhắc nhở: ${item.title}`)}`);
    lines.push(`TRIGGER:-PT${Math.max(0, Math.round(offset))}M`);
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function triggerDownloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportItemToICS(item: ScheduleItem): void {
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FlowDay//Lich Hoc & Lam Viec//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FlowDay',
    buildVEvent(item),
    'END:VCALENDAR',
  ].join('\r\n');

  const safeSlug = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  triggerDownloadICS(calendar, `flowday-${safeSlug || 'lich-hen'}.ics`);
}

export function exportAllToICS(items: ScheduleItem[]): number {
  const activeItems = items.filter((item) => !item.completed || item.repeat !== 'none');
  if (activeItems.length === 0) return 0;

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FlowDay//Lich Hoc & Lam Viec//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FlowDay — Lịch Học & Làm việc',
    ...activeItems.map(buildVEvent),
    'END:VCALENDAR',
  ].join('\r\n');

  triggerDownloadICS(calendar, 'flowday-icloud-schedule.ics');
  return activeItems.length;
}
