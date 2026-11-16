import React, { useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CalendarPlus,
  Check,
  Cloud,
  Copy,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Sun,
  Upload,
} from 'lucide-react';
import { ActiveCloudTarget } from '../hooks/useScheduleStore';
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
  cloudTarget: ActiveCloudTarget | null;
  authLoading: boolean;
  syncError: string | null;
  items: ScheduleItem[];
  preferences: UserPreferences;
  onUpdatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignInRedirect: () => Promise<void>;
  onConnectSyncCode: (code: string) => boolean;
  onSignOut: () => Promise<void>;
  onImportBackup: (items: ScheduleItemDraft[]) => Promise<number>;
  onToast: (message: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  cloudTarget,
  authLoading,
  syncError,
  items,
  preferences,
  onUpdatePreferences,
  onSignIn,
  onSignInRedirect,
  onConnectSyncCode,
  onSignOut,
  onImportBackup,
  onToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customHex, setCustomHex] = useState(preferences.accentColor);
  const [syncInput, setSyncInput] = useState('');

  const handleConnectCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onConnectSyncCode(syncInput);
    if (ok) {
      onToast(`Đã kết nối đồng bộ đám mây với "${syncInput.trim()}".`);
      setSyncInput('');
    }
  };

  const handleGenerateRandomCode = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    const generated = `flowday-${num}`;
    setSyncInput(generated);
  };

  const handleCopySyncLabel = async () => {
    if (!cloudTarget) return;
    try {
      await navigator.clipboard.writeText(cloudTarget.displayLabel);
      onToast(`Đã sao chép mã "${cloudTarget.displayLabel}". Hãy nhập mã này trên thiết bị kia.`);
    } catch {
      onToast(`Mã đồng bộ của bạn là: ${cloudTarget.displayLabel}`);
    }
  };

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
        {/* Cloud Sync + iCloud .ics Integration */}
        <section className="ios-glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Cloud className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Đồng bộ Đám mây (iPhone & Laptop)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đồng bộ lịch trình và giao diện theo thời gian thực qua Cloud Firestore
              </p>
            </div>
          </div>

          {cloudTarget ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Đang kết nối & đồng bộ thời gian thực
                  </div>
                  <div className="mt-1 text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 truncate">
                    {cloudTarget.displayLabel}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Nhập chính xác mã/email <strong>{cloudTarget.displayLabel}</strong> trên thiết bị còn lại (iPhone hoặc Laptop) để đồng bộ tức thì.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySyncLabel}
                  className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-white/10"
                >
                  <Copy className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <span>Sao chép Mã đồng bộ</span>
                </button>

                <button
                  type="button"
                  disabled={authLoading}
                  onClick={onSignOut}
                  className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Ngắt kết nối</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Method 1: Instant Sync via Email or Sync Code (Works 100% on iPhone PWA, Safari & Preview Iframe without Popups) */}
              <form
                onSubmit={handleConnectCodeSubmit}
                className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <KeyRound className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>Cách 1: Đồng bộ nhanh bằng Email / Mã đồng bộ (Khuyên dùng)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateRandomCode}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Tạo mã ngẫu nhiên</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Nhập cùng một địa chỉ <strong>Email</strong> (ví dụ: <code>tenban@gmail.com</code>) hoặc một <strong>Mã tự chọn</strong> trên cả iPhone và Laptop để đồng bộ trực tiếp qua Cloud Firestore mà không bị trình duyệt chặn cửa sổ Popup.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={syncInput}
                    onChange={(e) => setSyncInput(e.target.value)}
                    placeholder="Nhập Email hoặc mã (VD: borutosolo23@gmail.com)"
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-xl text-xs font-semibold transition-transform active:scale-[0.98] whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-fg)',
                    }}
                  >
                    Kết nối & Đồng bộ ngay
                  </button>
                </div>
              </form>

              {/* Method 2: Google OAuth (Popup + Redirect) */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Cách 2: Đăng nhập bằng tài khoản Google
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={onSignIn}
                    className="ios-glass-control min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/90 dark:hover:bg-white/10 transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                    <span>
                      {authLoading ? 'Đang kết nối...' : 'Đăng nhập Google (Cửa sổ)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={onSignInRedirect}
                    className="ios-glass-control min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-white/10 transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>Đăng nhập chuyển trang (Safari)</span>
                  </button>
                </div>

                {syncError && (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400 leading-relaxed pt-1">
                    {syncError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* iCloud .ics Export & JSON Backup */}
          <div className="space-y-2.5 pt-1 border-t border-slate-200/60 dark:border-white/[0.07]">
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
                <span>Sao lưu tệp JSON</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ios-glass-control min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Khôi phục tệp JSON</span>
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
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-white/5">
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
                        ? 'border-slate-900 dark:border-white bg-white/80 dark:bg-white/10'
                        : 'border-slate-200/80 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/5'
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
      </div>

      {/* iPhone PWA Install Card */}
      <PWAInstallButton variant="card" />
    </div>
  );
};
