import React, { useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleTrigger = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowIOSGuide(true);
  };

  if (variant === 'card') {
    return (
      <>
        <button
          type="button"
          onClick={handleTrigger}
          className="ios-glass-card w-full min-h-[48px] flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:bg-white/85 dark:hover:bg-white/[0.06] active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Smartphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {isIOS ? 'Cài đặt lên Màn hình chính iPhone' : 'Cài đặt ứng dụng (PWA)'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isIOS
                  ? 'Mở toàn màn hình và nhận thông báo đẩy iOS'
                  : 'Truy cập nhanh từ màn hình chính, hỗ trợ ngoại tuyến'}
              </div>
            </div>
          </div>
          <span
            className="shrink-0 text-xs font-semibold whitespace-nowrap"
            style={{ color: 'var(--accent)' }}
          >
            Hướng dẫn
          </span>
        </button>

        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />
        )}
      </>
    );
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        className="ios-glass-control min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-white/85 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
        <span>{isIOS ? 'Cài lên iPhone' : 'Cài đặt App'}</span>
      </button>

      {showIOSGuide && (
        <IOSInstallModal onClose={() => setShowIOSGuide(false)} isIOS={isIOS} />
      )}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void; isIOS: boolean }> = ({
  onClose,
  isIOS,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
    onClick={onClose}
  >
    <div
      className="ios-glass-sheet w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Cài đặt FlowDay lên iPhone
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isIOS
              ? 'Thực hiện 2 bước trong trình duyệt Safari để dùng như ứng dụng gốc:'
              : 'Mở trang này bằng Safari trên iPhone và thực hiện 2 bước sau:'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <ol className="mt-5 space-y-4">
        <li className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            <Share className="h-4 w-4" />
          </span>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              1. Chạm nút Chia sẻ (Share)
            </span>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Biểu tượng ô vuông có mũi tên hướng lên ở thanh công cụ dưới cùng của Safari.
            </p>
          </div>
        </li>
        <li className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            <PlusSquare className="h-4 w-4" />
          </span>
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              2. Chọn “Thêm vào Màn hình chính”
            </span>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Sau khi thêm, mở FlowDay từ Màn hình chính để bật thông báo đẩy iOS (iOS 16.4+).
            </p>
          </div>
        </li>
      </ol>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full min-h-[48px] rounded-xl font-medium text-sm transition-transform active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-fg)',
        }}
      >
        Đã hiểu
      </button>
    </div>
  </div>
);
