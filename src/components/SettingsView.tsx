import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CalendarPlus,
  Check,
  Cloud,
  Download,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Sun,
  Upload,
} from 'lucide-react';
import {
  ScheduleItem,
  ScheduleItemDraft,
  ThemeMode,
  UserPreferences,
} from '../types/schedule';
import { exportAllToICS } from '../utils/icsExport';
import { ACCENT_PRESETS } from '../utils/themeUtils';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsViewProps {
  user: User | null;
  authLoading: boolean;
  syncError: string | null;
  items: ScheduleItem[];
  preferences: UserPreferences;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onImportBackup: (items: ScheduleItemDraft[]) => Promise<number>;
  onToast: (message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  authLoading,
  syncError,
  items,
  preferences,
  onUpdatePreferences,
  onSignIn,
  onSignOut,
  onImportBackup,
  onToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customHex, setCustomHex] = useState(preferences.accentColor);

  const handleExportICS = () => {
    const count = exportAllToICS(items);
    if (count === 0) {
      onToast('Chưa có lịch hẹn nào để xuất sang Lịch iCloud.');
      return;
    }
    onToast(`Đã xuất ${count} lịch hẹn sang tệp .ics cho Lịch iCloud.`);
  };

  const handleExportJSON = () => {
    const payload = JSON.stringify({ items, preferences }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowday-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast('Đã tải tệp sao lưu JSON.');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.items;
      if (!Array.isArray(list)) {
        onToast('Tệp sao lưu không hợp lệ.');
        return;
      }
      const imported = await onImportBackup(list);
      onToast(`Đã khôi phục ${imported} lịch trình.`);
    } catch {
      onToast('Không thể đọc tệp sao lưu JSON.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Theme & Custom Color Studio */}
        <section className="ios-glass-card rounded-3xl p-5 space-y-5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Palette className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Màu sắc chủ đề & Giao diện
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tùy chỉnh màu nhấn áp dụng cho toàn bộ thẻ widget và nút bấm
              </p>
            </div>
          </div>

          {/* Light / Dark / System Switcher */}
          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Chế độ hiển thị
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5">
              {(
                [
                  { id: 'light', label: 'Sáng', Icon: Sun },
                  { id: 'dark', label: 'Tối', Icon: Moon },
                  { id: 'system', label: 'Hệ thống', Icon: Monitor },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = preferences.themeMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({ themeMode: id as ThemeMode })
                    }
                    className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Swatches + Custom Color Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Bảng màu chủ đề
              </span>
              <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                {preferences.accentColor.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected =
                  preferences.accentColor.toUpperCase() === preset.hex.toUpperCase();
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCustomHex(preset.hex);
                      void onUpdatePreferences({ accentColor: preset.hex });
                    }}
                    className={`min-h-[60px] flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-white/5'
                        : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span
                      className="h-6 w-6 rounded-full flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                    </span>
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-full">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Picker */}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-white/10 px-3.5 py-2.5">
              <label
                htmlFor="custom-accent-picker"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Chọn màu tùy ý theo sở thích
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-accent-picker"
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    const hex = e.target.value;
                    setCustomHex(hex);
                    void onUpdatePreferences({ accentColor: hex });
                  }}
                  className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Cloud Sync + iCloud .ics Integration */}
        <section className="ios-glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200">
              <Cloud className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Đồng bộ Đám mây & Lịch iCloud
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đồng bộ đa thiết bị theo thời gian thực và xuất sang Apple Calendar
              </p>
            </div>
          </div>

          {/* Firebase Google Auth Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] p-4">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Đang đồng bộ đám mây
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user.displayName || user.email}
                  </div>
                  {user.displayName && user.email && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={onSignOut}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#131A26] px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Hiện tại dữ liệu đang lưu trên thiết bị này. Đăng nhập Google để tự động đồng bộ lịch học, việc làm và màu chủ đề giữa iPhone và máy tính.
                </p>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={onSignIn}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-transform active:scale-[0.98]"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-fg)',
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  <span>
                    {authLoading
                      ? 'Đang kết nối...'
                      : 'Đăng nhập Google để đồng bộ đám mây'}
                  </span>
                </button>
              </div>
            )}

            {syncError && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                {syncError}
              </p>
            )}
          </div>

          {/* iCloud .ics Export */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleExportICS}
              className="ios-glass-control w-full min-h-[48px] flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-white/85 dark:hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CalendarPlus
                  className="h-5 w-5 shrink-0"
                  style={{ color: 'var(--accent)' }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    Xuất toàn bộ lịch sang iCloud (.ics)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Chạm trên iPhone để nhập trực tiếp vào Lịch Apple kèm báo thức
                  </div>
                </div>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJSON}
                className="ios-glass-control min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Sao lưu JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ios-glass-control min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Khôi phục JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </div>
          </div>
        </section>
      </div>

      {/* iPhone PWA Install Card */}
      <PWAInstallButton variant="card" />
    </div>
  );
};
