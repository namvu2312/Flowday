import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Briefcase,
  CalendarPlus,
  Check,
  Clock,
  Plus,
  Sparkles,
} from 'lucide-react';
import { ScheduleItem } from '../types/schedule';
import {
  formatCountdownVi,
  formatDurationVi,
  getDurationMinutes,
  getPriorityLabelVi,
  getTodayISO,
  occursOnDate,
  sortItemsByTime,
  timeToMinutes,
} from '../utils/dateUtils';
import { exportItemToICS } from '../utils/icsExport';

interface TodayWidgetsProps {
  items: ScheduleItem[];
  onToggleComplete: (item: ScheduleItem) => void;
  onEditItem: (item: ScheduleItem) => void;
  onQuickCreateSlot: (startTime: string, endTime: string) => void;
  onExported: (title: string) => void;
}

function minutesToHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMin));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export const TodayWidgets: React.FC<TodayWidgetsProps> = ({
  items,
  onToggleComplete,
  onEditItem,
  onQuickCreateSlot,
  onExported,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  const todayISO = getTodayISO();

  const todayItems = useMemo(() => {
    return sortItemsByTime(items.filter((it) => occursOnDate(it, todayISO)));
  }, [items, todayISO]);

  const metrics = useMemo(() => {
    const total = todayItems.length;
    const done = todayItems.filter((it) => it.completed).length;
    const studyItems = todayItems.filter((it) => it.category === 'study');
    const workItems = todayItems.filter((it) => it.category === 'work');

    const studyMinutes = studyItems.reduce(
      (acc, it) => acc + getDurationMinutes(it.startTime, it.endTime),
      0
    );
    const workMinutes = workItems.reduce(
      (acc, it) => acc + getDurationMinutes(it.startTime, it.endTime),
      0
    );
    const totalMinutes = studyMinutes + workMinutes;

    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      total,
      done,
      remaining: total - done,
      pct,
      studyTotal: studyItems.length,
      studyDone: studyItems.filter((it) => it.completed).length,
      studyMinutes,
      workTotal: workItems.length,
      workDone: workItems.filter((it) => it.completed).length,
      workMinutes,
      totalMinutes,
    };
  }, [todayItems]);

  const activeSession = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const pending = todayItems.filter((it) => !it.completed);
    const found = pending.find((it) => timeToMinutes(it.endTime) > nowMin);
    if (!found) return null;

    const startMin = timeToMinutes(found.startTime);
    const endMin = timeToMinutes(found.endTime);
    const duration = Math.max(15, endMin - startMin);
    const isOngoing = nowMin >= startMin && nowMin < endMin;
    const elapsedPct = isOngoing
      ? Math.min(100, Math.max(5, Math.round(((nowMin - startMin) / duration) * 100)))
      : 0;
    const minutesUntil = Math.max(0, startMin - nowMin);

    return {
      item: found,
      isOngoing,
      elapsedPct,
      duration,
      countdownText: formatCountdownVi(minutesUntil, isOngoing),
    };
  }, [todayItems, now]);

  // Calculate next open 1-hour free slot today between 08:00 and 21:00
  const suggestedFreeSlot = useMemo(() => {
    const nowMin = Math.max(8 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30);
    const sorted = todayItems
      .map((it) => ({
        start: timeToMinutes(it.startTime),
        end: timeToMinutes(it.endTime),
      }))
      .sort((a, b) => a.start - b.start);

    let cursor = nowMin;
    for (const block of sorted) {
      if (block.end <= cursor) continue;
      if (block.start - cursor >= 45) {
        const slotEnd = Math.min(block.start, cursor + 60);
        return {
          start: minutesToHHMM(cursor),
          end: minutesToHHMM(slotEnd),
          freeMinutes: block.start - cursor,
        };
      }
      cursor = Math.max(cursor, block.end);
    }

    if (cursor <= 21 * 60) {
      return {
        start: minutesToHHMM(cursor),
        end: minutesToHHMM(Math.min(22 * 60, cursor + 60)),
        freeMinutes: Math.max(60, 22 * 60 - cursor),
      };
    }
    return null;
  }, [todayItems, now]);

  // SVG Ring calculation
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (metrics.pct / 100) * circumference;

  return (
    <section
      aria-label="Bảng Widget Tổng quan Hôm nay"
      className="space-y-3.5"
    >
      {/* WIDGET 1: Live Focus / Next Up Session Card */}
      <div className="ios-glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/60 dark:border-white/[0.07]">
          <div className="flex items-center gap-2 min-w-0">
            <Clock
              className="h-4 w-4 shrink-0"
              style={{ color: 'var(--accent)' }}
            />
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeSession?.isOngoing
                ? 'Phiên đang diễn ra'
                : 'Tiêu điểm tiếp theo hôm nay'}
            </span>
          </div>
          {activeSession && (
            <span
              className="text-xs font-semibold font-mono-num shrink-0"
              style={{ color: 'var(--accent)' }}
            >
              {activeSession.countdownText}
            </span>
          )}
        </div>

        {activeSession ? (
          <div className="pt-3.5 space-y-3.5">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  {activeSession.item.category === 'study' ? (
                    <BookOpen className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  )}
                  <span>
                    {activeSession.item.category === 'study'
                      ? 'Lịch học tập'
                      : 'Công việc'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{getPriorityLabelVi(activeSession.item.priority)}</span>
                </span>
                <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100">
                  {activeSession.item.startTime} – {activeSession.item.endTime}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onEditItem(activeSession.item)}
                title="Chạm để xem hoặc chỉnh sửa chi tiết"
                className="mt-1.5 text-left w-full group focus-visible:outline-none"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:underline leading-snug">
                  {activeSession.item.title}
                </h3>
                {activeSession.item.notes && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {activeSession.item.notes}
                  </p>
                )}
              </button>

              {activeSession.isOngoing && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Tiến độ khung giờ hiện tại</span>
                    <span className="font-mono-num">{activeSession.elapsedPct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${activeSession.elapsedPct}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Self-explanatory Action Buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleComplete(activeSession.item)}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-transform active:scale-[0.98] whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Đánh dấu hoàn thành</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  exportItemToICS(activeSession.item);
                  onExported(activeSession.item.title);
                }}
                className="ios-glass-control min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <CalendarPlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>Lưu vào iCloud</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-3.5 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {todayItems.length === 0
                ? 'Hôm nay bạn chưa lên lịch buổi học hay công việc nào.'
                : 'Tất cả lịch trình trong ngày hôm nay đã được hoàn thành trọn vẹn.'}
            </p>
            {suggestedFreeSlot && (
              <button
                type="button"
                onClick={() =>
                  onQuickCreateSlot(suggestedFreeSlot.start, suggestedFreeSlot.end)
                }
                className="ios-glass-control w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>
                  Thêm lịch khung {suggestedFreeSlot.start} – {suggestedFreeSlot.end}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* WIDGET 2: Daily Progress & Study/Work Time Balance */}
      <div className="ios-glass-card rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Tiến độ & Phân bổ thời gian hôm nay
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono-num text-slate-900 dark:text-slate-100">
                {metrics.done}/{metrics.total}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                mục đã xong ({metrics.pct}%)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng thời lượng:{' '}
              <span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">
                {metrics.totalMinutes > 0
                  ? formatDurationVi(metrics.totalMinutes)
                  : '0 phút'}
              </span>
            </p>
          </div>

          <svg
            className="h-16 w-16 -rotate-90 shrink-0"
            viewBox="0 0 68 68"
            aria-hidden="true"
          >
            <circle
              cx="34"
              cy="34"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-slate-100 dark:text-white/10"
            />
            <circle
              cx="34"
              cy="34"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
        </div>

        {/* Hairline-divided Study vs Work Breakdown */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-white/[0.06] pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="pr-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <BookOpen className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>Học tập</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100">
                {metrics.studyDone}/{metrics.studyTotal} mục
              </span>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                {metrics.studyMinutes > 0
                  ? formatDurationVi(metrics.studyMinutes)
                  : '0p'}
              </span>
            </div>
          </div>

          <div className="pl-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Briefcase className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>Công việc</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100">
                {metrics.workDone}/{metrics.workTotal} mục
              </span>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                {metrics.workMinutes > 0
                  ? formatDurationVi(metrics.workMinutes)
                  : '0p'}
              </span>
            </div>
          </div>
        </div>

        {/* Smart Free Window Suggestion Bar */}
        {suggestedFreeSlot && activeSession && (
          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3 w-3 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="truncate">Khung giờ trống tiếp theo hôm nay</span>
              </div>
              <div className="text-xs font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                {suggestedFreeSlot.start} – {suggestedFreeSlot.end}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onQuickCreateSlot(suggestedFreeSlot.start, suggestedFreeSlot.end)
              }
              className="min-h-[36px] inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Lên lịch khung này</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
