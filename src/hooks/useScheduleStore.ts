import {
  User,
  onAuthStateChanged,
  signInWithPopup,
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
import { useCallback, useEffect, useRef, useState } from 'react';
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

function tsToMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function useScheduleStore() {
  const [user, setUser] = useState<User | null>(null);
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
  const hasMigratedLocalRef = useRef<string | null>(null);

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

  // Persist locally when signed out (and keep local cache warm)
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(LOCAL_ITEMS_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [items, user]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota errors
    }
  }, [preferences]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        prefsDocExistsRef.current = false;
        setItems(loadLocalItems());
        setPreferences(loadLocalPrefs());
        setCloudLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners once authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    setCloudLoading(true);
    setSyncError(null);

    const itemsPath = `users/${user.uid}/items`;
    const itemsQuery = query(
      collection(db, itemsPath),
      where('userId', '==', user.uid)
    );

    const unsubItems = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const remoteItems: ScheduleItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId ?? user.uid),
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

        // If user signs in for the first time and cloud is empty, migrate local items once
        if (
          remoteItems.length === 0 &&
          hasMigratedLocalRef.current !== user.uid
        ) {
          hasMigratedLocalRef.current = user.uid;
          const localDrafts = loadLocalItems();
          if (localDrafts.length > 0) {
            const batch = writeBatch(db);
            for (const localItem of localDrafts) {
              const cleanId = ID_REGEX.test(localItem.id)
                ? localItem.id
                : generateSafeId();
              const clean = sanitizeDraft(localItem);
              batch.set(doc(db, itemsPath, cleanId), {
                ...clean,
                userId: user.uid,
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
        setSyncError('Không thể đồng bộ dữ liệu đám mây.');
        handleFirestoreError(error, OperationType.LIST, itemsPath);
      }
    );

    const prefPath = `users/${user.uid}/settings/preferences`;
    const prefDocRef = doc(db, `users/${user.uid}/settings`, 'preferences');
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
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setSyncError('Đăng nhập Google không thành công. Vui lòng thử lại.');
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    try {
      await firebaseSignOut(auth);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const addItem = useCallback(
    async (draft: ScheduleItemDraft) => {
      const clean = sanitizeDraft(draft);
      const id = generateSafeId();

      if (!user) {
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

      const path = `users/${user.uid}/items/${id}`;
      try {
        await setDoc(doc(db, `users/${user.uid}/items`, id), {
          ...clean,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const updateItem = useCallback(
    async (id: string, draft: ScheduleItemDraft) => {
      const clean = sanitizeDraft(draft);

      if (!user) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, ...clean, updatedAt: Date.now() } : item
          )
        );
        return;
      }

      const safeId = ID_REGEX.test(id) ? id : generateSafeId();
      const path = `users/${user.uid}/items/${safeId}`;
      try {
        await updateDoc(doc(db, `users/${user.uid}/items`, safeId), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const toggleComplete = useCallback(
    async (item: ScheduleItem) => {
      const nextCompleted = !item.completed;

      if (!user) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, completed: nextCompleted, snoozedUntil: 0, updatedAt: Date.now() }
              : it
          )
        );
        return;
      }

      const path = `users/${user.uid}/items/${item.id}`;
      try {
        await updateDoc(doc(db, `users/${user.uid}/items`, item.id), {
          completed: nextCompleted,
          snoozedUntil: 0,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const snoozeItem = useCallback(
    async (item: ScheduleItem, minutes: number) => {
      const snoozedUntil = Math.floor(Date.now() + minutes * 60 * 1000);

      if (!user) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, snoozedUntil, updatedAt: Date.now() } : it
          )
        );
        return;
      }

      const path = `users/${user.uid}/items/${item.id}`;
      try {
        await updateDoc(doc(db, `users/${user.uid}/items`, item.id), {
          snoozedUntil,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!user) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        return;
      }

      const path = `users/${user.uid}/items/${id}`;
      try {
        await deleteDoc(doc(db, `users/${user.uid}/items`, id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      const merged = sanitizePreferences({ ...preferences, ...partial });
      setPreferences(merged);

      if (!user) return;

      const path = `users/${user.uid}/settings/preferences`;
      const ref = doc(db, `users/${user.uid}/settings`, 'preferences');
      try {
        if (prefsDocExistsRef.current) {
          await updateDoc(ref, {
            ...merged,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            ...merged,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          });
          prefsDocExistsRef.current = true;
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [preferences, user]
  );

  const importBackupItems = useCallback(
    async (incomingItems: ScheduleItemDraft[]) => {
      const validDrafts = incomingItems.slice(0, 100).map(sanitizeDraft);

      if (!user) {
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

      const itemsPath = `users/${user.uid}/items`;
      const batch = writeBatch(db);
      for (const draft of validDrafts) {
        const id = generateSafeId();
        batch.set(doc(db, itemsPath, id), {
          ...draft,
          userId: user.uid,
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
    [user]
  );

  return {
    user,
    authReady,
    authLoading,
    cloudLoading,
    syncError,
    items,
    preferences,
    isDark,
    signInWithGoogle,
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
