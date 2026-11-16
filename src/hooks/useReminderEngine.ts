import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveReminderAlert,
  ScheduleItem,
  UserPreferences,
} from '../types/schedule';
import {
  getTodayISO,
  isWithinQuietHours,
  occursOnDate,
  timeToMinutes,
} from '../utils/dateUtils';

export type NotificationSupportStatus =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

export function getNotificationPermissionStatus(): NotificationSupportStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function dispatchSystemNotification(
  title: string,
  body: string,
  tag?: string
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: tag || `flowday-${Date.now()}`,
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: tag || `flowday-${Date.now()}`,
    });
    return true;
  } catch {
    return false;
  }
}

export function useReminderEngine(
  items: ScheduleItem[],
  preferences: UserPreferences
) {
  const [permission, setPermission] = useState<NotificationSupportStatus>(() =>
    getNotificationPermissionStatus()
  );
  const [activeAlerts, setActiveAlerts] = useState<ActiveReminderAlert[]>([]);
  const firedKeysRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return 'unsupported' as const;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const dismissAlert = useCallback((itemId: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.item.id !== itemId));
  }, []);

  const sendTestNotification = useCallback(async () => {
    let status = getNotificationPermissionStatus();
    if (status === 'default') {
      status = await requestPermission();
    }
    if (status === 'granted') {
      return dispatchSystemNotification(
        'FlowDay · Nhắc nhở thông minh',
        'Thông báo đẩy đã sẵn sàng trên thiết bị của bạn.',
        'flowday-test'
      );
    }
    return false;
  }, [requestPermission]);

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayISO = getTodayISO();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const quietActive =
        preferences.quietHoursEnabled &&
        isWithinQuietHours(
          now,
          preferences.quietHoursStart,
          preferences.quietHoursEnd
        );

      for (const item of items) {
        if (item.completed) continue;
        if (!occursOnDate(item, todayISO)) continue;
        if (quietActive && item.priority !== 'high') continue;

        // Check active snooze
        if (item.snoozedUntil && item.snoozedUntil > 0) {
          const snoozeKey = `${item.id}:snooze:${item.snoozedUntil}`;
          if (Date.now() >= item.snoozedUntil && !firedKeysRef.current.has(snoozeKey)) {
            firedKeysRef.current.add(snoozeKey);
            setActiveAlerts((prev) => {
              const filtered = prev.filter((a) => a.item.id !== item.id);
              return [
                ...filtered,
                { item, offsetMinutes: 0, triggeredAt: Date.now() },
              ];
            });
            if (preferences.pushEnabled && permission === 'granted') {
              void dispatchSystemNotification(
                `Nhắc lại: ${item.title}`,
                `${item.startTime} – ${item.endTime} · Đến giờ thực hiện`,
                snoozeKey
              );
            }
          }
          continue;
        }

        const startMin = timeToMinutes(item.startTime);
        const offsets =
          item.reminderMinutes && item.reminderMinutes.length > 0
            ? item.reminderMinutes
            : [];

        for (const offset of offsets) {
          const triggerMin = startMin - offset;
          // Trigger within a 2-minute window of the target reminder minute
          if (nowMinutes >= triggerMin && nowMinutes <= triggerMin + 1) {
            const key = `${todayISO}:${item.id}:${offset}`;
            if (!firedKeysRef.current.has(key)) {
              firedKeysRef.current.add(key);
              setActiveAlerts((prev) => {
                const filtered = prev.filter((a) => a.item.id !== item.id);
                return [
                  ...filtered,
                  { item, offsetMinutes: offset, triggeredAt: Date.now() },
                ];
              });

              if (preferences.pushEnabled && permission === 'granted') {
                const whenText =
                  offset === 0
                    ? 'Bắt đầu ngay bây giờ'
                    : `Còn ${offset} phút nữa bắt đầu (${item.startTime})`;
                void dispatchSystemNotification(
                  item.title,
                  `${item.category === 'study' ? 'Học tập' : 'Công việc'} · ${whenText}`,
                  key
                );
              }
            }
          }
        }
      }
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 15000);
    return () => window.clearInterval(timer);
  }, [items, preferences, permission]);

  return {
    permission,
    activeAlerts,
    requestPermission,
    dismissAlert,
    sendTestNotification,
  };
}
