import React, { useEffect, useState } from 'react';
import { CalendarPlus, Trash2, X } from 'lucide-react';
import {
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  PriorityLevel,
  RepeatPattern,
  ScheduleCategory,
  ScheduleItem,
  ScheduleItemDraft,
  UserPreferences,
} from '../types/schedule';
import {
  formatDurationVi,
  getDurationMinutes,
  getTodayISO,
  timeToMinutes,
} from '../utils/dateUtils';
import { exportItemToICS } from '../utils/icsExport';

interface ScheduleFormSheetProps {
  isOpen: boolean;
  editingItem: ScheduleItem | null;
  defaultDate: string;
  initialStartTime?: string;
  initialEndTime?: string;
  preferences: UserPreferences;
  onClose: () => void;
  onSave: (draft: ScheduleItemDraft, existingId?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onExported?: (title: string) => void;
}

const REMINDER_OPTIONS = [
  { value: 0, label: 'Đúng giờ (0p)' },
  { value: 5, label: 'Trước 5 phút' },
  { value: 15, label: 'Trước 15 phút' },
  { value: 30, label: 'Trước 30 phút' },
  { value: 60, label: 'Trước 1 giờ' },
];

const DURATION_PRESETS = [
  { minutes: 30, label: '30 phút' },
  { minutes: 45, label: '45 phút' },
  { minutes: 60, label: '1 giờ' },
  { minutes: 90, label: '1g 30p' },
  { minutes: 120, label: '2 giờ' },
];

function addMinutesToHHMM(startHHMM: string, addMin: number): string {
  const total = Math.min(23 * 60 + 59, timeToMinutes(startHHMM) + addMin);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export const ScheduleFormSheet: React.FC<ScheduleFormSheetProps> = ({
  isOpen,
  editingItem,
  defaultDate,
  initialStartTime,
  initialEndTime,
  preferences,
  onClose,
  onSave,
  onDelete,
  onExported,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<ScheduleCategory>('study');
  const [date, setDate] = useState(defaultDate || getTodayISO());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [repeat, setRepeat] = useState<RepeatPattern>('none');
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([15]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (editingItem) {
      setTitle(editingItem.title);
      setNotes(editingItem.notes ?? '');
      setCategory(editingItem.category);
      setDate(editingItem.date);
      setStartTime(editingItem.startTime);
      setEndTime(editingItem.endTime);
      setPriority(editingItem.priority);
      setRepeat(editingItem.repeat);
      setReminderMinutes(
        editingItem.reminderMinutes.length > 0 ? editingItem.reminderMinutes : [15]
      );
    } else {
      setTitle('');
      setNotes('');
      setCategory('study');
      setDate(defaultDate || getTodayISO());
      setStartTime(initialStartTime || '09:00');
      setEndTime(initialEndTime || '10:00');
      setPriority('medium');
      setRepeat('none');
      setReminderMinutes([preferences.smartLeadMedium]);
    }
  }, [
    isOpen,
    editingItem,
    defaultDate,
    initialStartTime,
    initialEndTime,
    preferences.smartLeadMedium,
  ]);

  if (!isOpen) return null;

  const currentDuration = getDurationMinutes(startTime, endTime);

  const handlePriorityChange = (nextPriority: PriorityLevel) => {
    setPriority(nextPriority);
    if (!editingItem) {
      if (nextPriority === 'high') {
        setReminderMinutes(
          Array.from(new Set([preferences.smartLeadHigh, 5])).slice(0, 5)
        );
      } else if (nextPriority === 'medium') {
        setReminderMinutes([preferences.smartLeadMedium]);
      } else {
        setReminderMinutes([preferences.smartLeadLow]);
      }
    }
  };

  const handleApplyDuration = (mins: number) => {
    setEndTime(addMinutesToHHMM(startTime, mins));
  };

  const toggleReminderOffset = (minutes: number) => {
    setReminderMinutes((prev) => {
      if (prev.includes(minutes)) {
        return prev.filter((m) => m !== minutes);
      }
      if (prev.length >= 5) return prev;
      return [...prev, minutes].sort((a, b) => b - a);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng nhập tên lịch học hoặc công việc.');
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setErrorMsg('Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          title: trimmed.slice(0, MAX_TITLE_LENGTH),
          notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
          category,
          date,
          startTime,
          endTime,
          priority,
          repeat,
          reminderMinutes,
          completed: editingItem ? editingItem.completed : false,
          snoozedUntil: editingItem ? editingItem.snoozedUntil ?? 0 : 0,
        },
        editingItem?.id
      );
      onClose();
    } catch {
      setErrorMsg('Không thể lưu lịch trình. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="ios-glass-sheet w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (mobile) & Self-explanatory Header */}
        <div className="px-5 pt-3 pb-3 border-b border-slate-100 dark:border-white/10 shrink-0">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2
                id="sheet-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {editingItem ? 'Chỉnh sửa chi tiết lịch' : 'Tạo lịch học & công việc mới'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Điền khung giờ và chọn mốc nhắc trước giờ hẹn
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {editingItem && (
                <button
                  type="button"
                  onClick={() => {
                    exportItemToICS(editingItem);
                    onExported?.(editingItem.title);
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-white/15 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  <CalendarPlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>+ iCloud</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ"
                className="min-h-[40px] min-w-[40px] -mr-1.5 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {errorMsg}
            </div>
          )}

          {/* Category segmented control */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              1. Chọn nhóm lịch trình
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setCategory('study')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  category === 'study'
                    ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lịch Học tập
              </button>
              <button
                type="button"
                onClick={() => setCategory('work')}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all ${
                  category === 'work'
                    ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Lịch Công việc
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="item-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              2. Tên môn học hoặc đầu việc cần làm
            </label>
            <input
              id="item-title"
              type="text"
              required
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Ôn thi Giải tích chương 3 / Họp thiết kế sản phẩm"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Date & Time Row + Quick Duration Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                3. Thời gian thực hiện
              </span>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                Thời lượng: {formatDurationVi(currentDuration)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="item-date"
                  className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                >
                  Ngày diễn ra
                </label>
                <input
                  id="item-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 text-sm font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div>
                <label
                  htmlFor="item-start"
                  className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                >
                  Giờ bắt đầu
                </label>
                <input
                  id="item-start"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 text-sm font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
              <div>
                <label
                  htmlFor="item-end"
                  className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                >
                  Giờ kết thúc
                </label>
                <input
                  id="item-end"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 text-sm font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>

            {/* Quick Duration Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">
                Chọn nhanh thời lượng:
              </span>
              {DURATION_PRESETS.map((preset) => {
                const isActive = currentDuration === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => handleApplyDuration(preset.minutes)}
                    className={`min-h-[32px] px-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-transparent font-semibold'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent)',
                          }
                        : undefined
                    }
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              4. Mức độ ưu tiên (tự động gợi ý giờ nhắc)
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
              {(
                [
                  { id: 'high', label: 'Ưu tiên cao' },
                  { id: 'medium', label: 'Trung bình' },
                  { id: 'low', label: 'Nhẹ nhàng' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePriorityChange(p.id)}
                  className={`min-h-[38px] rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    priority === p.id
                      ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Repeat */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              5. Chu kỳ lặp lại
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'none', label: 'Chỉ 1 lần' },
                  { id: 'daily', label: 'Mỗi ngày' },
                  { id: 'weekdays', label: 'Thứ 2 – Thứ 6' },
                  { id: 'weekly', label: 'Hằng tuần' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRepeat(r.id)}
                  className={`min-h-[38px] rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                    repeat === r.id
                      ? 'border-transparent font-semibold'
                      : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                  style={
                    repeat === r.id
                      ? {
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent)',
                          borderColor: 'var(--accent-border)',
                        }
                      : undefined
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Smart Reminder Lead Times */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              6. Nhắc nhở trước giờ hẹn (có thể chọn nhiều mốc)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((opt) => {
                const active = reminderMinutes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleReminderOffset(opt.value)}
                    className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-transparent font-semibold'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-fg)',
                          }
                        : undefined
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="item-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              7. Ghi chú chi tiết / Phòng học / Liên kết
            </label>
            <textarea
              id="item-notes"
              rows={2}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú tài liệu cần mang theo, địa điểm hoặc link phòng họp..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Sticky Footer Actions with clear Vietnamese labels */}
          <div className="pt-2 pb-safe flex items-center gap-2.5">
            {editingItem && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(editingItem.id);
                  onClose();
                }}
                className="min-h-[46px] inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl border border-rose-200 dark:border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" />
                <span>Xóa lịch</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] px-4 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[46px] rounded-xl text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {saving
                ? 'Đang lưu...'
                : editingItem
                ? 'Lưu thay đổi'
                : 'Lưu vào lịch trình'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
