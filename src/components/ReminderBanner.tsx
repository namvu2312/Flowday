import React from 'react';
import { BellRing, Check, Clock, X } from 'lucide-react';
import { ActiveReminderAlert, ScheduleItem } from '../types/schedule';

interface ReminderBannerProps {
  alerts: ActiveReminderAlert[];
  onComplete: (item: ScheduleItem) => void;
  onSnooze: (item: ScheduleItem, minutes: number) => void;
  onDismiss: (itemId: string) => void;
}

export const ReminderBanner: React.FC<ReminderBannerProps> = ({
  alerts,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  if (alerts.length === 0) return null;

  const latest = alerts[alerts.length - 1];
  const { item, offsetMinutes } = latest;

  return (
    <div className="fixed top-14 lg:top-16 left-0 right-0 z-40 px-4 pt-2 pointer-events-none">
      <div className="ios-glass-sheet mx-auto max-w-lg pointer-events-auto rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {item.category === 'study' ? 'Học tập' : 'Công việc'}
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span className="font-mono-num">{item.startTime}</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>
                  {offsetMinutes === 0
                    ? 'Đến giờ bắt đầu'
                    : `Còn ${offsetMinutes} phút`}
                </span>
              </div>
              <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {item.title}
              </h4>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="Đóng nhắc nhở"
            className="min-h-[40px] min-w-[40px] -mr-1.5 -mt-1.5 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onComplete(item);
              onDismiss(item.id);
            }}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Check className="h-3.5 w-3.5" />
            <span>Đã xong</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSnooze(item, 10);
              onDismiss(item.id);
            }}
            className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Hoãn 10p</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSnooze(item, 30);
              onDismiss(item.id);
            }}
            className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10"
          >
            <span>Hoãn 30p</span>
          </button>
        </div>
      </div>
    </div>
  );
};
