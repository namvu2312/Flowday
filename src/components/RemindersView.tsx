import React, { useMemo, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Moon, Send } from 'lucide-react';
import { NotificationSupportStatus } from '../hooks/useReminderEngine';
import { ScheduleItem, UserPreferences } from '../types/schedule';
import {
  getReminderSummaryVi,
  getTodayISO,
  occursOnDate,
  sortItemsByTime,
} from '../utils/dateUtils';

interface RemindersViewProps {
  items: ScheduleItem[];
  preferences: UserPreferences;
  permission: NotificationSupportStatus;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  onRequestPermission: () => Promise<NotificationSupportStatus>;
  onSendTestNotification: () => Promise<boolean>;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  items,
  preferences,
  permission,
  onUpdatePreferences,
  onRequestPermission,
  onSendTestNotification,
}) => {
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const todayISO = getTodayISO();

  const todayQueue = useMemo(() => {
    return sortItemsByTime(
      items.filter(
        (it) =>
          !it.completed &&
          occursOnDate(it, todayISO) &&
          it.reminderMinutes.length > 0
      )
    );
  }, [items, todayISO]);

  const handleTogglePush = async () => {
    if (!preferences.pushEnabled) {
      const status =
        permission === 'granted' ? 'granted' : await onRequestPermission();
      if (status === 'granted') {
        await onUpdatePreferences({ pushEnabled: true });
        setTestFeedback('Đã bật thông báo nhắc nhở trước giờ hẹn.');
      } else if (status === 'denied') {
        setTestFeedback(
          'Quyền thông báo đang bị chặn trong cài đặt Safari/trình duyệt.'
        );
      } else {
        setTestFeedback(
          'Trên iPhone, hãy chạm Chia sẻ → Thêm vào Màn hình chính (iOS 16.4+) để nhận thông báo đẩy.'
        );
      }
    } else {
      await onUpdatePreferences({ pushEnabled: false });
      setTestFeedback('Đã tắt thông báo đẩy trên thiết bị này.');
    }
  };

  const handleTest = async () => {
    const ok = await onSendTestNotification();
    if (ok) {
      setTestFeedback('Đã gửi thông báo thử nghiệm.');
    } else {
      setTestFeedback(
        'Trình duyệt chưa cấp quyền hoặc cần mở từ ứng dụng đã cài trên Màn hình chính iPhone.'
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Push Notification Status Card */}
        <section className="ios-glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                {preferences.pushEnabled && permission === 'granted' ? (
                  <Bell className="h-5 w-5" />
                ) : (
                  <BellOff className="h-5 w-5" />
                )}
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Thông báo đẩy iOS & Trình duyệt
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tự động nhắc trước giờ học và lịch họp. Trên iPhone, thông báo đẩy hoạt động khi bạn thêm FlowDay vào Màn hình chính (iOS 16.4+).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleTogglePush}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-transform active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              {preferences.pushEnabled && permission === 'granted'
                ? 'Đang bật thông báo · Chạm để tắt'
                : 'Bật thông báo nhắc nhở'}
            </button>

            <button
              type="button"
              onClick={handleTest}
              className="ios-glass-control min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Gửi thông báo thử</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Trạng thái quyền hiện tại:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {permission === 'granted'
                ? 'Đã cấp phép'
                : permission === 'denied'
                ? 'Đang bị từ chối'
                : permission === 'unsupported'
                ? 'Cần mở từ PWA trên Màn hình chính iOS'
                : 'Chưa hỏi quyền'}
            </span>
          </div>

          {testFeedback && (
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 rounded-xl px-3 py-2">
              {testFeedback}
            </p>
          )}
        </section>

        {/* Quiet Hours & Smart Lead Times */}
        <section className="ios-glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200">
                <Moon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Giờ yên lặng thông minh
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tạm ẩn nhắc nhở mức Trung bình/Nhẹ vào ban đêm
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.quietHoursEnabled}
              onClick={() =>
                onUpdatePreferences({
                  quietHoursEnabled: !preferences.quietHoursEnabled,
                })
              }
              className={`min-h-[32px] w-12 rounded-full p-1 transition-colors flex items-center ${
                preferences.quietHoursEnabled
                  ? ''
                  : 'bg-slate-200 dark:bg-white/15'
              }`}
              style={
                preferences.quietHoursEnabled
                  ? { backgroundColor: 'var(--accent)' }
                  : undefined
              }
            >
              <span
                className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  preferences.quietHoursEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {preferences.quietHoursEnabled && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="quiet-start"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Bắt đầu yên lặng
                </label>
                <input
                  id="quiet-start"
                  type="time"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    onUpdatePreferences({ quietHoursStart: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 text-sm font-mono-num text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="quiet-end"
                  className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Kết thúc lúc
                </label>
                <input
                  id="quiet-end"
                  type="time"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    onUpdatePreferences({ quietHoursEnd: e.target.value })
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-3 text-sm font-mono-num text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-white/10">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
              Thời gian nhắc mặc định khi tạo lịch mới
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    key: 'smartLeadHigh',
                    label: 'Ưu tiên cao',
                    val: preferences.smartLeadHigh,
                    opts: [15, 30, 60],
                  },
                  {
                    key: 'smartLeadMedium',
                    label: 'Trung bình',
                    val: preferences.smartLeadMedium,
                    opts: [5, 15, 30],
                  },
                  {
                    key: 'smartLeadLow',
                    label: 'Nhẹ nhàng',
                    val: preferences.smartLeadLow,
                    opts: [0, 5, 15],
                  },
                ] as const
              ).map((group) => (
                <div key={group.key}>
                  <label
                    htmlFor={group.key}
                    className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 truncate"
                  >
                    {group.label}
                  </label>
                  <select
                    id={group.key}
                    value={group.val}
                    onChange={(e) =>
                      onUpdatePreferences({
                        [group.key]: Number(e.target.value),
                      })
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 px-2 text-xs font-medium text-slate-900 dark:text-slate-100"
                  >
                    {group.opts.map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? 'Đúng giờ' : `${m} phút`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Upcoming reminder queue for today */}
      <section className="ios-glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/10">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Hàng đợi nhắc nhở hôm nay
          </h3>
          <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            {todayQueue.length} lịch hẹn
          </span>
        </div>

        {todayQueue.length === 0 ? (
          <div className="py-6 flex flex-col items-center text-center text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-6 w-6 mb-2 text-slate-300 dark:text-slate-600" />
            Không còn nhắc nhở nào đang chờ trong ngày hôm nay.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {todayQueue.map((item) => (
              <li
                key={item.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.category === 'study' ? 'Học tập' : 'Công việc'}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{getReminderSummaryVi(item.reminderMinutes)}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold font-mono-num text-slate-700 dark:text-slate-300">
                  {item.startTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
