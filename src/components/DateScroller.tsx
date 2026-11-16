import React, { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import {
  addDaysISO,
  getShortWeekdayVi,
  getTodayISO,
  parseISODate,
} from '../utils/dateUtils';

interface DateScrollerProps {
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
  itemCountByDate?: Record<string, number>;
}

export const DateScroller: React.FC<DateScrollerProps> = ({
  selectedDate,
  onSelectDate,
  itemCountByDate = {},
}) => {
  const todayISO = getTodayISO();

  // Center the 7-day strip around the currently selected week
  const selectedDt = parseISODate(selectedDate);
  const dayOfWeek = selectedDt.getDay(); // 0 (Sun) .. 6 (Sat)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartISO = addDaysISO(selectedDate, mondayOffset);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, idx) => {
      const iso = addDaysISO(weekStartISO, idx);
      const dt = parseISODate(iso);
      return {
        iso,
        weekday: getShortWeekdayVi(iso),
        dayNum: dt.getDate(),
        monthNum: dt.getMonth() + 1,
        isToday: iso === todayISO,
      };
    });
  }, [weekStartISO, todayISO]);

  const monthHeaderLabel = useMemo(() => {
    const dt = parseISODate(selectedDate);
    return `Tháng ${dt.getMonth() + 1}, ${dt.getFullYear()}`;
  }, [selectedDate]);

  const handleShiftWeek = (deltaDays: number) => {
    onSelectDate(addDaysISO(selectedDate, deltaDays));
  };

  return (
    <div className="ios-glass-card rounded-2xl p-3.5">
      {/* Top Calendar Control Bar with explicit, self-explanatory labels */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/60 dark:border-white/[0.07]">
        <div className="flex items-center gap-2">
          <CalendarDays
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--accent)' }}
          />
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {monthHeaderLabel}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500" aria-hidden="true">
            ·
          </span>
          <label className="relative inline-flex items-center cursor-pointer text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            <span>Chọn ngày bất kỳ</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              aria-label="Chọn ngày cụ thể trên lịch"
              className="sr-only"
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          {selectedDate !== todayISO && (
            <button
              type="button"
              onClick={() => onSelectDate(todayISO)}
              className="min-h-[36px] inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <RotateCcw className="h-3 w-3" />
              <span>Về hôm nay</span>
            </button>
          )}

          <div className="ios-glass-control inline-flex items-center rounded-xl">
            <button
              type="button"
              onClick={() => handleShiftWeek(-7)}
              aria-label="Tuần trước"
              title="Xem tuần trước"
              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tuần trước</span>
            </button>
            <span className="h-4 w-px bg-slate-200/80 dark:bg-white/10" aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleShiftWeek(7)}
              aria-label="Tuần sau"
              title="Xem tuần sau"
              className="min-h-[36px] inline-flex items-center gap-1 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Tuần sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Interactive Strip */}
      <div
        className="grid grid-cols-7 gap-1.5"
        role="listbox"
        aria-label="Chọn ngày trong tuần"
      >
        {days.map((d) => {
          const isSelected = d.iso === selectedDate;
          const count = itemCountByDate[d.iso] ?? 0;

          return (
            <button
              key={d.iso}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectDate(d.iso)}
              className={`min-h-[68px] flex flex-col items-center justify-between rounded-xl px-1 py-2 transition-all active:scale-[0.97] ${
                isSelected
                  ? 'shadow-sm'
                  : d.isToday
                  ? 'bg-slate-100/90 dark:bg-white/[0.07] text-slate-900 dark:text-slate-100'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }
                  : undefined
              }
            >
              <span
                className={`text-[11px] font-medium whitespace-nowrap ${
                  isSelected
                    ? 'opacity-95 font-semibold'
                    : d.isToday
                    ? 'font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                style={!isSelected && d.isToday ? { color: 'var(--accent)' } : undefined}
              >
                {d.isToday ? 'H.nay' : d.weekday}
              </span>

              <span className="text-base sm:text-lg font-bold font-mono-num leading-none my-0.5">
                {d.dayNum}
              </span>

              <span
                className={`text-[10px] font-mono-num whitespace-nowrap leading-none ${
                  isSelected
                    ? 'opacity-90 font-medium'
                    : count > 0
                    ? 'text-slate-500 dark:text-slate-400 font-medium'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {count > 0 ? `${count} việc` : 'Trống'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
