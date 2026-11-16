import React, { useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarPlus,
  Cloud,
  CloudCheck,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
  Sunrise,
  Sun,
  Moon,
} from 'lucide-react';
import { DateScroller } from './components/DateScroller';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ReminderBanner } from './components/ReminderBanner';
import { RemindersView } from './components/RemindersView';
import { ScheduleFormSheet } from './components/ScheduleFormSheet';
import { ScheduleRow } from './components/ScheduleRow';
import { SettingsView } from './components/SettingsView';
import { TodayWidgets } from './components/TodayWidgets';
import { useReminderEngine } from './hooks/useReminderEngine';
import { useScheduleStore } from './hooks/useScheduleStore';
import {
  ScheduleCategory,
  ScheduleItem,
  ScheduleItemDraft,
  TabKey,
} from './types/schedule';
import {
  addDaysISO,
  formatDurationVi,
  getDurationMinutes,
  getFullDateLabelVi,
  getTodayISO,
  occursOnDate,
  sortItemsByTime,
  timeToMinutes,
} from './utils/dateUtils';
import { exportAllToICS } from './utils/icsExport';

type CategoryFilter = 'all' | ScheduleCategory;
type CompletionFilter = 'pending' | 'completed' | 'all';

const NAV_TABS: { key: TabKey; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'today', label: 'Hôm nay', Icon: LayoutGrid },
  { key: 'schedule', label: 'Lịch trình', Icon: Calendar },
  { key: 'reminders', label: 'Nhắc nhở', Icon: Bell },
  { key: 'settings', label: 'Tùy chỉnh', Icon: SlidersHorizontal },
];

export default function App() {
  const {
    user,
    cloudTarget,
    authLoading,
    cloudLoading,
    syncError,
    items,
    preferences,
    signInWithGoogle,
    signInWithGoogleRedirect,
    connectWithSyncCode,
    signOut,
    addItem,
    updateItem,
    toggleComplete,
    snoozeItem,
    deleteItem,
    updatePreferences,
    importBackupItems,
  } = useScheduleStore();

  const {
    permission,
    activeAlerts,
    requestPermission,
    dismissAlert,
    sendTestNotification,
  } = useReminderEngine(items, preferences);

  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayISO());
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [slotPreset, setSlotPreset] = useState<{ start: string; end: string }>({
    start: '09:00',
    end: '10:00',
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const todayISO = getTodayISO();

  const itemCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = -14; i <= 21; i++) {
      const iso = addDaysISO(selectedDate, i);
      counts[iso] = items.filter((it) => occursOnDate(it, iso) && !it.completed).length;
    }
    return counts;
  }, [items, selectedDate]);

  const selectedDayItems = useMemo(() => {
    return sortItemsByTime(
      items.filter((it) => {
        if (!occursOnDate(it, selectedDate)) return false;
        if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
        return true;
      })
    );
  }, [items, selectedDate, categoryFilter]);

  // Group daily items into Morning (<12:00), Afternoon (12:00-17:59), Evening (>=18:00)
  const dayPeriods = useMemo(() => {
    const morning: ScheduleItem[] = [];
    const afternoon: ScheduleItem[] = [];
    const evening: ScheduleItem[] = [];

    for (const item of selectedDayItems) {
      const startMin = timeToMinutes(item.startTime);
      if (startMin < 12 * 60) {
        morning.push(item);
      } else if (startMin < 18 * 60) {
        afternoon.push(item);
      } else {
        evening.push(item);
      }
    }

    return [
      {
        id: 'morning',
        title: 'Buổi sáng',
        rangeLabel: '06:00 – 12:00',
        defaultStart: '08:30',
        defaultEnd: '10:00',
        Icon: Sunrise,
        items: morning,
      },
      {
        id: 'afternoon',
        title: 'Buổi chiều',
        rangeLabel: '12:00 – 18:00',
        defaultStart: '14:00',
        defaultEnd: '15:30',
        Icon: Sun,
        items: afternoon,
      },
      {
        id: 'evening',
        title: 'Buổi tối',
        rangeLabel: '18:00 – 23:00',
        defaultStart: '19:30',
        defaultEnd: '21:00',
        Icon: Moon,
        items: evening,
      },
    ];
  }, [selectedDayItems]);

  const categoryCountsForDay = useMemo(() => {
    const allForDay = items.filter((it) => occursOnDate(it, selectedDate));
    const study = allForDay.filter((it) => it.category === 'study').length;
    const work = allForDay.filter((it) => it.category === 'work').length;
    const totalMinutes = allForDay.reduce(
      (sum, it) => sum + getDurationMinutes(it.startTime, it.endTime),
      0
    );
    return {
      all: allForDay.length,
      study,
      work,
      totalMinutes,
    };
  }, [items, selectedDate]);

  const filteredAllItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...items]
      .filter((it) => {
        if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
        if (completionFilter === 'pending' && it.completed) return false;
        if (completionFilter === 'completed' && !it.completed) return false;
        if (q) {
          const hay = `${it.title} ${it.notes ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      });
  }, [items, categoryFilter, completionFilter, searchQuery]);

  const handleOpenCreate = (startTime = '09:00', endTime = '10:00') => {
    setEditingItem(null);
    setSlotPreset({ start: startTime, end: endTime });
    setSheetOpen(true);
  };

  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setSheetOpen(true);
  };

  const handleSaveItem = async (draft: ScheduleItemDraft, existingId?: string) => {
    if (existingId) {
      await updateItem(existingId, draft);
      showToast('Đã cập nhật lịch trình.');
    } else {
      await addItem(draft);
      showToast('Đã thêm vào lịch trình.');
    }
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id);
    showToast('Đã xóa lịch trình.');
  };

  const handleExportAllICS = () => {
    const count = exportAllToICS(items);
    if (count === 0) {
      showToast('Chưa có lịch hẹn nào để xuất sang Lịch iCloud.');
      return;
    }
    showToast(`Đã tải tệp .ics (${count} lịch hẹn) cho Lịch iCloud.`);
  };

  const activeTabTitle =
    NAV_TABS.find((t) => t.key === activeTab)?.label ?? 'FlowDay';

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="min-h-dvh flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Top Bar (Strict 3-Zone Contract) */}
      <header className="ios-glass-header hidden lg:block sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 font-display"
          >
            FlowDay
          </button>

          {/* Zone 2: 4 Single-line Navigation Links */}
          <nav className="flex items-center gap-6" aria-label="Điều hướng chính">
            {NAV_TABS.map(({ key, label }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`min-h-[40px] px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'text-slate-900 dark:text-slate-100 font-semibold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  style={active ? { borderColor: 'var(--accent)' } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleOpenCreate('09:00', '10:00')}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-transform active:scale-[0.98] whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-fg)',
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Thêm lịch mới</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Sticky Header (52px) */}
      <header className="ios-glass-header lg:hidden sticky top-0 z-30 pt-safe">
        <div className="h-[52px] px-4 flex items-center justify-between gap-3">
          <span className="text-base font-bold tracking-tight font-display whitespace-nowrap shrink-0">
            FlowDay
          </span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
            {activeTabTitle}
          </span>
          <button
            type="button"
            onClick={() => handleOpenCreate('09:00', '10:00')}
            aria-label="Thêm lịch mới"
            className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold whitespace-nowrap shrink-0 active:scale-95 transition-transform"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-fg)',
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Thêm lịch</span>
          </button>
        </div>
      </header>

      {/* Smart In-App Reminder Alert Banner */}
      <ReminderBanner
        alerts={activeAlerts}
        onComplete={(it) => void toggleComplete(it)}
        onSnooze={(it, mins) => {
          void snoozeItem(it, mins);
          showToast(`Đã hoãn nhắc nhở thêm ${mins} phút.`);
        }}
        onDismiss={dismissAlert}
      />

      {/* Main Workspace */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 pt-5 pb-24 lg:pb-12">
        {/* Contextual Workspace Header & Self-Explanatory Utility Bar */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/70 dark:border-white/[0.07]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-display text-balance">
              {activeTab === 'today' && getFullDateLabelVi(selectedDate)}
              {activeTab === 'schedule' && 'Danh mục Lịch học tập & Công việc'}
              {activeTab === 'reminders' && 'Cài đặt Nhắc nhở Thông minh'}
              {activeTab === 'settings' && 'Tùy chỉnh Chủ đề & Đồng bộ'}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {cloudLoading
                ? 'Đang đồng bộ dữ liệu đám mây...'
                : cloudTarget
                ? `Đang đồng bộ đám mây (${cloudTarget.displayLabel})`
                : 'Đang lưu trên thiết bị · Chọn "Kết nối Đồng bộ" để liên kết iPhone & Laptop'}
            </p>
          </div>

          {/* Clear Labeled Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton variant="compact" />

            <button
              type="button"
              onClick={handleExportAllICS}
              className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <CalendarPlus className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span>Đồng bộ Lịch iCloud (.ics)</span>
            </button>

            {cloudTarget ? (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                <CloudCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đã đồng bộ: {cloudTarget.displayLabel}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white/85 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                <Cloud className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                <span>Kết nối Đồng bộ (iPhone & Laptop)</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: HÔM NAY (Widgets + Structured Daily Timeline) */}
        {activeTab === 'today' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: iOS Today Overview Widgets */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4">
              <TodayWidgets
                items={items}
                onToggleComplete={(it) => void toggleComplete(it)}
                onEditItem={handleOpenEdit}
                onQuickCreateSlot={(start, end) => {
                  setSelectedDate(todayISO);
                  handleOpenCreate(start, end);
                }}
                onExported={(title) =>
                  showToast(`Đã tải tệp .ics cho "${title}".`)
                }
              />
            </div>

            {/* Right Column: 7-Day Strip + Filter + Structured Time-of-Day Timeline */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <DateScroller
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                itemCountByDate={itemCountByDate}
              />

              {/* Filter Bar with Counts & Total Day Duration */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-white/[0.07]"
                  role="group"
                  aria-label="Lọc theo phân loại"
                >
                  {(
                    [
                      {
                        id: 'all',
                        label: `Tất cả (${categoryCountsForDay.all})`,
                      },
                      {
                        id: 'study',
                        label: `Học tập (${categoryCountsForDay.study})`,
                      },
                      {
                        id: 'work',
                        label: `Công việc (${categoryCountsForDay.work})`,
                      },
                    ] as const
                  ).map((f) => {
                    const active = categoryFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCategoryFilter(f.id)}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Tổng quỹ giờ:{' '}
                    <strong className="font-mono-num text-slate-800 dark:text-slate-200">
                      {categoryCountsForDay.totalMinutes > 0
                        ? formatDurationVi(categoryCountsForDay.totalMinutes)
                        : '0 phút'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Chronological Time-of-Day Sections (Buổi sáng / Buổi chiều / Buổi tối) */}
              {selectedDayItems.length === 0 ? (
                <div className="ios-glass-card rounded-2xl p-8 text-center">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Chưa có lịch trình nào trong ngày này
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Chạm nút bên dưới để thêm buổi học hoặc đầu việc đầu tiên cho ngày {selectedDate}.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCreate('08:30', '10:00')}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-transform active:scale-[0.98]"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--accent-fg)',
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      <span>+ Thêm ca sáng (08:30)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCreate('14:00', '15:30')}
                      className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Thêm ca chiều (14:00)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {dayPeriods.map((period) => {
                    if (period.items.length === 0) return null;
                    const PeriodIcon = period.Icon;
                    return (
                      <section
                        key={period.id}
                        aria-label={period.title}
                        className="ios-glass-card rounded-2xl overflow-hidden"
                      >
                        {/* Period Header Bar with Quick Add Button */}
                        <div className="px-4 py-2.5 bg-white/40 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <PeriodIcon
                              className="h-4 w-4 shrink-0"
                              style={{ color: 'var(--accent)' }}
                            />
                            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {period.title}
                            </h3>
                            <span
                              className="text-xs text-slate-400 dark:text-slate-500"
                              aria-hidden="true"
                            >
                              ·
                            </span>
                            <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                              {period.rangeLabel}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleOpenCreate(period.defaultStart, period.defaultEnd)
                            }
                            className="min-h-[30px] inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                            style={{ color: 'var(--accent)' }}
                          >
                            <Plus className="h-3 w-3" />
                            <span>Thêm vào {period.title.toLowerCase()}</span>
                          </button>
                        </div>

                        {/* Grouped Timeline Rows */}
                        <div>
                          {period.items.map((item, idx) => {
                            const startMin = timeToMinutes(item.startTime);
                            const endMin = timeToMinutes(item.endTime);
                            const isOngoing =
                              selectedDate === todayISO &&
                              !item.completed &&
                              nowMinutes >= startMin &&
                              nowMinutes < endMin;

                            return (
                              <ScheduleRow
                                key={item.id}
                                item={item}
                                isOngoing={isOngoing}
                                isLast={idx === period.items.length - 1}
                                onToggleComplete={(it) => void toggleComplete(it)}
                                onEdit={handleOpenEdit}
                                onDelete={(id) => void handleDeleteItem(id)}
                                onExported={(title) =>
                                  showToast(`Đã tải tệp .ics cho "${title}".`)
                                }
                              />
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LỊCH TRÌNH (Full Search & Filter Explorer) */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên môn học, công việc hoặc ghi chú..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#111722] pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-white/[0.07]">
                  {(
                    [
                      { id: 'all', label: 'Tất cả nhóm' },
                      { id: 'study', label: 'Học tập' },
                      { id: 'work', label: 'Công việc' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCategoryFilter(f.id)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap ${
                        categoryFilter === f.id
                          ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/75 dark:bg-white/[0.07]">
                  {(
                    [
                      { id: 'all', label: 'Mọi trạng thái' },
                      { id: 'pending', label: 'Chưa xong' },
                      { id: 'completed', label: 'Đã xong' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCompletionFilter(st.id)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-medium whitespace-nowrap ${
                        completionFilter === st.id
                          ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredAllItems.length === 0 ? (
              <div className="ios-glass-card rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Không tìm thấy lịch học hoặc công việc nào khớp bộ lọc hiện tại.
              </div>
            ) : (
              <div className="ios-glass-card rounded-2xl overflow-hidden">
                {filteredAllItems.map((item, idx) => (
                  <ScheduleRow
                    key={item.id}
                    item={item}
                    showDate
                    isLast={idx === filteredAllItems.length - 1}
                    onToggleComplete={(it) => void toggleComplete(it)}
                    onEdit={handleOpenEdit}
                    onDelete={(id) => void handleDeleteItem(id)}
                    onExported={(title) =>
                      showToast(`Đã tải tệp .ics cho "${title}".`)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NHẮC NHỞ */}
        {activeTab === 'reminders' && (
          <RemindersView
            items={items}
            preferences={preferences}
            permission={permission}
            onUpdatePreferences={updatePreferences}
            onRequestPermission={requestPermission}
            onSendTestNotification={sendTestNotification}
          />
        )}

        {/* TAB 4: TÙY CHỈNH & ĐỒNG BỘ */}
        {activeTab === 'settings' && (
          <SettingsView
            user={user}
            cloudTarget={cloudTarget}
            authLoading={authLoading}
            syncError={syncError}
            items={items}
            preferences={preferences}
            onUpdatePreferences={updatePreferences}
            onSignIn={signInWithGoogle}
            onSignInRedirect={signInWithGoogleRedirect}
            onConnectSyncCode={connectWithSyncCode}
            onSignOut={signOut}
            onImportBackup={importBackupItems}
            onToast={showToast}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar (Thumb Zone) */}
      <nav
        aria-label="Thanh điều hướng di động"
        className="ios-glass-header lg:hidden fixed bottom-0 left-0 right-0 z-30 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-16">
          {NAV_TABS.map(({ key, label, Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                  active
                    ? 'font-semibold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                style={active ? { color: 'var(--accent)' } : undefined}
              >
                <Icon className="h-[21px] w-[21px]" />
                <span className="mt-1 text-[11px] tracking-tight whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Create / Edit Bottom Sheet */}
      <ScheduleFormSheet
        isOpen={sheetOpen}
        editingItem={editingItem}
        defaultDate={selectedDate}
        initialStartTime={slotPreset.start}
        initialEndTime={slotPreset.end}
        preferences={preferences}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onExported={(title) => showToast(`Đã tải tệp .ics cho "${title}".`)}
      />

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />

      {/* Action Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 z-50 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 text-xs font-medium shadow-lg"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
