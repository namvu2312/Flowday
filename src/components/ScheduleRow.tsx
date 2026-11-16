import React from 'react';
import {
  BookOpen,
  Briefcase,
  CalendarPlus,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import { ScheduleItem } from '../types/schedule';
import {
  formatDurationVi,
  getDurationMinutes,
  getPriorityLabelVi,
  getReminderSummaryVi,
  getRepeatLabelVi,
} from '../utils/dateUtils';
import { exportItemToICS } from '../utils/icsExport';

interface ScheduleRowProps {
  item: ScheduleItem;
  onToggleComplete: (item: ScheduleItem) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onExported?: (title: string) => void;
  showDate?: boolean;
  isOngoing?: boolean;
  isLast?: boolean;
}

export const ScheduleRow: React.FC<ScheduleRowProps> = ({
  item,
  onToggleComplete,
  onEdit,
  onDelete,
  onExported,
  showDate = false,
  isOngoing = false,
  isLast = false,
}) => {
  const duration = getDurationMinutes(item.startTime, item.endTime);
  const categoryLabel = item.category === 'study' ? 'Học tập' : 'Công việc';
  const priorityLabel = getPriorityLabelVi(item.priority);
  const reminderLabel = getReminderSummaryVi(item.reminderMinutes);

  return (
    <div
      className={`group relative flex items-stretch gap-3 sm:gap-4 px-3.5 sm:px-4 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.02] ${
        !isLast ? 'border-b border-slate-100 dark:border-white/[0.06]' : ''
      } ${item.completed ? 'opacity-65' : ''}`}
    >
      {/* Left Column: Structured Time Block Axis (Tabular Numerals) */}
      <div className="w-[54px] shrink-0 flex flex-col items-end justify-start pt-0.5 text-right select-none">
        <span
          className={`text-xs sm:text-[13px] font-bold font-mono-num leading-none ${
            isOngoing
              ? ''
              : item.completed
              ? 'text-slate-400 dark:text-slate-500 line-through'
              : 'text-slate-900 dark:text-slate-100'
          }`}
          style={isOngoing ? { color: 'var(--accent)' } : undefined}
        >
          {item.startTime}
        </span>
        <span className="mt-1 text-[11px] font-mono-num text-slate-400 dark:text-slate-500 leading-none">
          {item.endTime}
        </span>
        <span className="mt-1.5 text-[10px] font-mono-num text-slate-400 dark:text-slate-500">
          {formatDurationVi(duration)}
        </span>
      </div>

      {/* Timeline Spine + Interactive Completion Checkbox (44x44px hitbox) */}
      <div className="relative flex flex-col items-center shrink-0">
        <button
          type="button"
          onClick={() => onToggleComplete(item)}
          title={
            item.completed
              ? 'Chạm để đánh dấu chưa hoàn thành'
              : 'Chạm để đánh dấu đã hoàn thành'
          }
          aria-label={
            item.completed
              ? `Đánh dấu chưa xong: ${item.title}`
              : `Hoàn thành: ${item.title}`
          }
          className="min-h-[44px] min-w-[44px] -my-2 flex items-center justify-center rounded-xl transition-transform active:scale-90 z-10"
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
              item.completed
                ? 'border-transparent'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111722] hover:border-slate-400'
            }`}
            style={
              item.completed
                ? {
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }
                : isOngoing
                ? { borderColor: 'var(--accent)' }
                : undefined
            }
          >
            {item.completed && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
          </span>
        </button>
        {!isLast && (
          <div
            className="w-px flex-1 bg-slate-200/80 dark:bg-white/[0.08] mt-1"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Right Column: Content + Self-Explanatory Action Bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="text-left flex-1 min-w-0 focus-visible:outline-none group/title"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="shrink-0 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              >
                {item.category === 'study' ? (
                  <BookOpen className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                ) : (
                  <Briefcase className="h-3.5 w-3.5" />
                )}
              </span>
              <h3
                className={`text-sm sm:text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover/title:underline truncate ${
                  item.completed
                    ? 'line-through text-slate-500 dark:text-slate-400'
                    : ''
                }`}
              >
                {item.title}
              </h3>
            </div>

            {/* Unboxed Inline Metadata with Typographic Separators */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{categoryLabel}</span>
              {showDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num font-medium text-slate-700 dark:text-slate-300">
                    Ngày {item.date}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span
                className={
                  item.priority === 'high' && !item.completed
                    ? 'font-semibold text-rose-600 dark:text-rose-400'
                    : ''
                }
              >
                {priorityLabel}
              </span>
              {item.repeat !== 'none' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Lặp: {getRepeatLabelVi(item.repeat)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>Nhắc: {reminderLabel}</span>
            </div>

            {item.notes && item.notes.trim().length > 0 && (
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {item.notes}
              </p>
            )}
          </button>
        </div>

        {/* Explicit Labeled Action Buttons (No mystery icons!) */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleComplete(item)}
            className="ios-glass-control min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Check className="h-3 w-3" style={{ color: 'var(--accent)' }} />
            <span>{item.completed ? 'Làm lại' : 'Hoàn thành'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportItemToICS(item);
              onExported?.(item.title);
            }}
            className="ios-glass-control min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <CalendarPlus className="h-3 w-3" style={{ color: 'var(--accent)' }} />
            <span>+ Lịch iCloud</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="ios-glass-control min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <Pencil className="h-3 w-3" />
            <span>Sửa</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="ios-glass-control min-h-[34px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap"
          >
            <Trash2 className="h-3 w-3" />
            <span>Xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
