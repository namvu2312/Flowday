import {
  User,
  browserPopupRedirectResolver,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  DATE_REGEX,
  HEX_COLOR_REGEX,
  ID_REGEX,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  ScheduleItem,
  ScheduleItemDraft,
  TIME_REGEX,
  UserPreferences,
} from '../types/schedule';
import { buildStarterSchedule, getTodayISO } from '../utils/dateUtils';
import { DEFAULT_PREFERENCES, applyThemeToDocument } from '../utils/themeUtils';

const LOCAL_ITEMS_KEY = 'flowday_items_v1';
const LOCAL_PREFS_KEY = 'flowday_prefs_v1';
const LOCAL_SYNC_CODE_KEY = 'flowday_sync_code_v1';

export function normalizeToSyncKey(rawInput: string): string {
  const cleaned = rawInput
    .trim()
    .toLowerCase()
    .replace(/@/g, '_at_')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (cleaned.length < 4) return '';
  return `sync_${cleaned}`;
}

function generateSafeId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `item_${ts}_${rand}`;
}

function sanitizeDraft(draft: ScheduleItemDraft): ScheduleItemDraft {
  const title = draft.title.trim().slice(0, MAX_TITLE_LENGTH) || 'Lịch hẹn mới';
  const notes = (draft.notes ?? '').trim().slice(0, MAX_NOTES_LENGTH);
  const date = DATE_REGEX.test(draft.date) ? draft.date : getTodayISO();
  const startTime = TIME_REGEX.test(draft.startTime) ? draft.startTime : '09:00';
  const endTime = TIME_REGEX.test(draft.endTime) ? draft.endTime : '10:00';
  const reminderMinutes = Array.from(
    new Set(
      (draft.reminderMinutes ?? [])
        .map((m) => Math.max(0, Math.min(1440, Math.round(m))))
        .filter((m) => Number.isFinite(m))
    )
  ).slice(0, 5);

  return {
    title,
    notes,
    category: draft.category === 'work' ? 'work' : 'study',
    date,
    startTime,
    endTime,
    priority:
      draft.priority === 'high' || draft.priority === 'low' ? draft.priority : 'medium',
    repeat:
      draft.repeat === 'daily' ||
      draft.repeat === 'weekdays' ||
      draft.repeat === 'weekly'
        ? draft.repeat
        : 'none',
    reminderMinutes,
    completed: Boolean(draft.completed),
    snoozedUntil: Math.max(0, Math.round(draft.snoozedUntil ?? 0)),
  };
}

function sanitizePreferences(prefs: UserPreferences): UserPreferences {
  return {
    themeMode:
      prefs.themeMode === 'light' || prefs.themeMode === 'dark'
        ? prefs.themeMode
        : 'system',
    accentColor: HEX_COLOR_REGEX.test(prefs.accentColor)
      ? prefs.accentColor
      : DEFAULT_PREFERENCES.accentColor,
    quietHoursEnabled: Boolean(prefs.quietHoursEnabled),
    quietHoursStart: TIME_REGEX.test(prefs.quietHoursStart)
      ? prefs.quietHoursStart
      : DEFAULT_PREFERENCES.quietHoursStart,
    quietHoursEnd: TIME_REGEX.test(prefs.quietHoursEnd)
      ? prefs.quietHoursEnd
      : DEFAULT_PREFERENCES.quietHoursEnd,
    pushEnabled: Boolean(prefs.pushEnabled),
    smartLeadHigh: Math.max(0, Math.min(1440, Math.round(prefs.smartLeadHigh))),
    smartLeadMedium: Math.max(0, Math.min(1440, Math.round(prefs.smartLeadMedium))),
    smartLeadLow: Math.max(0, Math.min(1440, Math.round(prefs.smartLeadLow))),
  };
}

function loadLocalItems(): ScheduleItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_ITEMS_KEY);
    if (!raw) {
      const starter = buildStarterSchedule('local');
      localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(starter));
      return starter;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return buildStarterSchedule('local');
  }
}

function loadLocalPrefs(): UserPreferences {
  try {
    const raw = localStorage.getItem(LOCAL_PREFS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return sanitizePreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function loadSavedSyncCode(): string {
  try {
    return localStorage.getItem(LOCAL_SYNC_CODE_KEY) || '';
  } catch {
    return '';
  }
}

function tsToMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function describeAuthErrorVi(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/popup-blocked') {
    return 'Trình duyệt trên thiết bị đã chặn cửa sổ bật lên (Popup). Bạn có thể bấm "Đăng nhập chuyển trang" hoặc nhập trực tiếp Email / Mã đồng bộ ở khung bên dưới để đồng bộ ngay giữa iPhone và Laptop.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Cửa sổ Google đã đóng hoặc bị khung xem trước chặn kết nối. Hãy dùng khung "Đồng bộ nhanh bằng Email / Mã đồng bộ" ngay bên dưới để đồng bộ trực tiếp không cần cửa sổ bật lên.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Tên miền truy cập hiện tại hạn chế cửa sổ Google OAuth. Hãy nhập trực tiếp Email hoặc Mã đồng bộ của bạn ở khung bên dưới để đồng bộ thời gian thực qua Cloud Firestore.';
  }
  if (code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/web-storage-unsupported') {
    return 'Môi trường trình duyệt hiện tại không hỗ trợ cửa sổ Google Popup. Vui lòng nhập Email / Mã đồng bộ ở khung bên dưới để đồng bộ trực tiếp.';
  }
  return `Không mở được cửa sổ Google (${code || 'lỗi kết nối'}). Bạn hãy nhập trực tiếp Email hoặc Mã đồng bộ ở khung bên dưới để đồng bộ giữa điện thoại và máy tính.`;
}

export interface ActiveCloudTarget {
  mode: 'google' | 'syncKey';
  ownerId: string; // Firestore userId field value
  basePath: string; // e.g. 'syncRooms/sync_...' or 'users/uid'
  displayLabel: string; // e.g. 'borutosolo23@gmail.com'
}

export function useScheduleStore() {
  const [user, setUser] = useState<User | null>(null);
  const [syncCodeLabel, setSyncCodeLabel] = useState<string>(() => loadSavedSyncCode());
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [items, setItems] = useState<ScheduleItem[]>(() => loadLocalItems());
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadLocalPrefs());
  const [isDark, setIsDark] = useState<boolean>(() =>
    applyThemeToDocument(loadLocalPrefs().themeMode, loadLocalPrefs().accentColor)
  );
  const [cloudLoading, setCloudLoading] = useState(false);

  const prefsDocExistsRef = useRef(false);
  const hasMigratedRef = useRef<string | null>(null);

  // Determine active cloud target (either via Google Sign-In or Direct Sync Code/Email)
  const cloudTarget = useMemo<ActiveCloudTarget | null>(() => {
    if (user) {
      if (user.email) {
        const key = normalizeToSyncKey(user.email);
        if (key) {
          return {
            mode: 'google',
            ownerId: key,
            basePath: `syncRooms/${key}`,
            displayLabel: user.email,
          };
        }
      }
      return {
        mode: 'google',
        ownerId: user.uid,
        basePath: `users/${user.uid}`,
        displayLabel: user.displayName || user.email || 'Tài khoản Google',
      };
    }

    if (syncCodeLabel.trim()) {
      const key = normalizeToSyncKey(syncCodeLabel);
      if (key) {
        return {
          mode: 'syncKey',
          ownerId: key,
          basePath: `syncRooms/${key}`,
          displayLabel: syncCodeLabel.trim(),
        };
      }
    }

    return null;
  }, [user, syncCodeLabel]);

  // Apply theme CSS custom properties and dark mode whenever preferences or OS scheme changes
  useEffect(() => {
    setIsDark(applyThemeToDocument(preferences.themeMode, preferences.accentColor));

    if (preferences.themeMode === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        setIsDark(applyThemeToDocument('system', preferences.accentColor));
      };
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
  }, [preferences.themeMode, preferences.accentColor]);

  // Keep local storage cache updated so offline mode always has the latest schedule
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota errors
    }
  }, [preferences]);

  // Listen to Firebase Auth state & redirect results
  useEffect(() => {
    getRedirectResult(auth)
      .then((res) => {
        if (res?.user) {
          setSyncError(null);
        }
      })
      .catch((err) => {
        console.warn('Redirect sign-in check:', err);
      });

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser?.email) {
        setSyncError(null);
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners whenever cloudTarget is active
  useEffect(() => {
    if (!authReady) return;
    if (!cloudTarget) {
      prefsDocExistsRef.current = false;
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    const { basePath, ownerId } = cloudTarget;
    const itemsPath = `${basePath}/items`;
    const itemsQuery = query(
      collection(db, itemsPath),
      where('userId', '==', ownerId)
    );

    const unsubItems = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const remoteItems: ScheduleItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? ownerId),
            title: String(data.title ?? ''),
            notes: typeof data.notes === 'string' ? data.notes : '',
            category: data.category === 'work' ? 'work' : 'study',
            date: String(data.date ?? getTodayISO()),
            startTime: String(data.startTime ?? '09:00'),
            endTime: String(data.endTime ?? '10:00'),
            priority:
              data.priority === 'high' || data.priority === 'low'
                ? data.priority
                : 'medium',
            repeat:
              data.repeat === 'daily' ||
              data.repeat === 'weekdays' ||
              data.repeat === 'weekly'
                ? data.repeat
                : 'none',
            reminderMinutes: Array.isArray(data.reminderMinutes)
              ? data.reminderMinutes.map(Number)
              : [15],
            completed: Boolean(data.completed),
            snoozedUntil: typeof data.snoozedUntil === 'number' ? data.snoozedUntil : 0,
            createdAt: tsToMillis(data.createdAt),
            updatedAt: tsToMillis(data.updatedAt),
          };
        });

        // First-time migration of local items into the cloud room
        if (hasMigratedRef.current !== ownerId) {
          hasMigratedRef.current = ownerId;
          const localDrafts = loadLocalItems();
          const remoteIds = new Set(remoteItems.map((r) => r.id));

          // If cloud is completely empty, upload all local items;
          // if cloud already has items, only upload custom user-created items not yet on cloud
          const toUpload =
            remoteItems.length === 0
              ? localDrafts
              : localDrafts.filter(
                  (it) => !it.id.startsWith('starter-') && !remoteIds.has(it.id)
                );

          if (toUpload.length > 0) {
            const batch = writeBatch(db);
            for (const localItem of toUpload) {
              const cleanId = ID_REGEX.test(localItem.id)
                ? localItem.id
                : generateSafeId();
              const clean = sanitizeDraft(localItem);
              batch.set(doc(db, itemsPath, cleanId), {
                ...clean,
                userId: ownerId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            batch.commit().catch((err) => {
              handleFirestoreError(err, OperationType.WRITE, itemsPath);
            });
          }
        }

        setItems(remoteItems);
        setCloudLoading(false);
      },
      (error) => {
        setCloudLoading(false);
        setSyncError('Không thể đọc dữ liệu đồng bộ từ đám mây.');
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      }
    );

    const prefPath = `${basePath}/settings/preferences`;
    const prefDocRef = doc(db, `${basePath}/settings`, 'preferences');
    const unsubPrefs = onSnapshot(
      prefDocRef,
      (snap) => {
        if (snap.exists()) {
          prefsDocExistsRef.current = true;
          const data = snap.data();
          setPreferences(
            sanitizePreferences({
              ...DEFAULT_PREFERENCES,
              themeMode: data.themeMode ?? DEFAULT_PREFERENCES.themeMode,
              accentColor: data.accentColor ?? DEFAULT_PREFERENCES.accentColor,
              quietHoursEnabled:
                data.quietHoursEnabled ?? DEFAULT_PREFERENCES.quietHoursEnabled,
              quietHoursStart:
                data.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
              quietHoursEnd: data.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
              pushEnabled: data.pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
              smartLeadHigh: data.smartLeadHigh ?? DEFAULT_PREFERENCES.smartLeadHigh,
              smartLeadMedium:
                data.smartLeadMedium ?? DEFAULT_PREFERENCES.smartLeadMedium,
              smartLeadLow: data.smartLeadLow ?? DEFAULT_PREFERENCES.smartLeadLow,
            })
          );
        } else {
          prefsDocExistsRef.current = false;
          // Seed initial preferences to cloud room so other devices get the current theme
          const currentLocalPrefs = loadLocalPrefs();
          setDoc(prefDocRef, {
            ...currentLocalPrefs,
            userId: ownerId,
            updatedAt: serverTimestamp(),
          })
            .then(() => {
              prefsDocExistsRef.current = true;
            })
            .catch(() => {
              // Ignore initial preference seed error
            });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, prefPath);
      }
    );

    return () => {
      unsubItems();
      unsubPrefs();
    };
  }, [authReady, cloudTarget]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (err) {
      setSyncError(describeAuthErrorVi(err));
      console.error('Google Sign-In Popup Error:', err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signInWithGoogleRedirect = useCallback(async () => {
    setAuthLoading(true);
    setSyncError(null);
    try {
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    } catch (err) {
      setSyncError(describeAuthErrorVi(err));
      setAuthLoading(false);
    }
  }, []);

  const connectWithSyncCode = useCallback((rawCode: string): boolean => {
    const trimmed = rawCode.trim();
    const key = normalizeToSyncKey(trimmed);
    if (!key) {
      setSyncError('Vui lòng nhập Email hoặc Mã đồng bộ tối thiểu 4 ký tự (chữ hoặc số).');
      return false;
    }
    setSyncError(null);
    hasMigratedRef.current = null;
    prefsDocExistsRef.current = false;
    setSyncCodeLabel(trimmed);
    try {
      localStorage.setItem(LOCAL_SYNC_CODE_KEY, trimmed);
    } catch {
      // Ignore storage error
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    try {
      if (user) {
        await firebaseSignOut(auth);
      }
      setSyncCodeLabel('');
      hasMigratedRef.current = null;
      prefsDocExistsRef.current = false;
      try {
        localStorage.removeItem(LOCAL_SYNC_CODE_KEY);
      } catch {
        // Ignore
      }
    } finally {
      setAuthLoading(false);
    }
  }, [user]);

  const addItem = useCallback(
    async (draft: ScheduleItemDraft) => {
      const clean = sanitizeDraft(draft);
      const id = generateSafeId();

      if (!cloudTarget) {
        const now = Date.now();
        const next: ScheduleItem = {
          ...clean,
          id,
          userId: 'local',
          createdAt: now,
          updatedAt: now,
        };
        setItems((prev) => [...prev, next]);
        return;
      }

      const path = `${cloudTarget.basePath}/items/${id}`;
      try {
        await setDoc(doc(db, `${cloudTarget.basePath}/items`, id), {
          ...clean,
          userId: cloudTarget.ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [cloudTarget]
  );

  const updateItem = useCallback(
    async (id: string, draft: ScheduleItemDraft) => {
      const clean = sanitizeDraft(draft);

      if (!cloudTarget) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, ...clean, updatedAt: Date.now() } : item
          )
        );
        return;
      }

      const safeId = ID_REGEX.test(id) ? id : generateSafeId();
      const path = `${cloudTarget.basePath}/items/${safeId}`;
      try {
        await updateDoc(doc(db, `${cloudTarget.basePath}/items`, safeId), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [cloudTarget]
  );

  const toggleComplete = useCallback(
    async (item: ScheduleItem) => {
      const nextCompleted = !item.completed;

      if (!cloudTarget) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, completed: nextCompleted, snoozedUntil: 0, updatedAt: Date.now() }
              : it
          )
        );
        return;
      }

      const path = `${cloudTarget.basePath}/items/${item.id}`;
      try {
        await updateDoc(doc(db, `${cloudTarget.basePath}/items`, item.id), {
          completed: nextCompleted,
          snoozedUntil: 0,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [cloudTarget]
  );

  const snoozeItem = useCallback(
    async (item: ScheduleItem, minutes: number) => {
      const snoozedUntil = Math.floor(Date.now() + minutes * 60 * 1000);

      if (!cloudTarget) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, snoozedUntil, updatedAt: Date.now() } : it
          )
        );
        return;
      }

      const path = `${cloudTarget.basePath}/items/${item.id}`;
      try {
        await updateDoc(doc(db, `${cloudTarget.basePath}/items`, item.id), {
          snoozedUntil,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [cloudTarget]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!cloudTarget) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        return;
      }

      const path = `${cloudTarget.basePath}/items/${id}`;
      try {
        await deleteDoc(doc(db, `${cloudTarget.basePath}/items`, id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [cloudTarget]
  );

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const merged = sanitizePreferences({ ...preferences, ...partial });
      setPreferences(merged);

      if (!cloudTarget) return;

      const path = `${cloudTarget.basePath}/settings/preferences`;
      const ref = doc(db, `${cloudTarget.basePath}/settings`, 'preferences');
      try {
        if (prefsDocExistsRef.current) {
          await updateDoc(ref, {
            ...merged,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            ...merged,
            userId: cloudTarget.ownerId,
            updatedAt: serverTimestamp(),
          });
          prefsDocExistsRef.current = true;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [preferences, cloudTarget]
  );

  const importBackupItems = useCallback(
    async (incomingItems: ScheduleItemDraft[]) => {
      const validDrafts = incomingItems.slice(0, 100).map(sanitizeDraft);

      if (!cloudTarget) {
        const now = Date.now();
        const mapped: ScheduleItem[] = validDrafts.map((d) => ({
          ...d,
          id: generateSafeId(),
          userId: 'local',
          createdAt: now,
          updatedAt: now,
        }));
        setItems((prev) => [...prev, ...mapped]);
        return mapped.length;
      }

      const itemsPath = `${cloudTarget.basePath}/items`;
      const batch = writeBatch(db);
      for (const draft of validDrafts) {
        const id = generateSafeId();
        batch.set(doc(db, itemsPath, id), {
          ...draft,
          userId: cloudTarget.ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
        return validDrafts.length;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, itemsPath);
      }
    },
    [cloudTarget]
  );

  return {
    user,
    cloudTarget,
    authReady,
    authLoading,
    cloudLoading,
    syncError,
    items,
    preferences,
    isDark,
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
  };
}
