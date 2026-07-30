// src/utils/activityLogger.ts
// Extracted from ActivityLogPage.tsx to break the static+dynamic import cycle.

export interface ActivityEntry {
  id: string;
  type: 'add' | 'edit' | 'delete';
  entity: 'customer' | 'order';
  label: string;      // e.g. "Siti (order #123)"
  details?: string;   // what changed
  timestamp: number;  // Date.now()
  user?: string;
}

const STORAGE_KEY = 'pearlcrm_activity_log';

export function getActivityLog(): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function logActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): void {
  const log = getActivityLog();
  log.unshift({
    ...entry,
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  });
  // Keep max 500 entries
  if (log.length > 500) log.length = 500;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export function clearActivityLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}
