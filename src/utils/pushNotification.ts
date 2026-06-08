// src/utils/pushNotification.ts
import type { Customer } from '../types';
import type { BirthdayAlert } from './birthday';

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: icon ?? '/favicon.ico',
      badge: '/favicon.ico',
    });
  } catch {
    // silently ignore if notification fails
  }
}

const NOTIFIED_KEY = 'pearlcrm_notified_today';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getNotifiedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    // Reset if it's a different day
    if (parsed.date !== getTodayKey()) return new Set();
    return new Set(parsed.ids as string[]);
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(ids: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ date: getTodayKey(), ids: [...ids] }));
}

export function sendBirthdayNotifications(alerts: BirthdayAlert[], storeName: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notified = getNotifiedSet();
  const todayAlerts = alerts.filter((a) => a.daysUntil === 0);

  for (const alert of todayAlerts) {
    const key = `bday-${alert.customer.id}`;
    if (notified.has(key)) continue;
    sendBrowserNotification(
      `🎂 Ulang Tahun: ${alert.customer.nama}`,
      `Jangan lupa kirim ucapan selamat ulang tahun dari ${storeName}!`,
    );
    notified.add(key);
  }
  saveNotifiedSet(notified);
}

export function sendVipInactiveNotifications(customers: Customer[], storeName: string, vipMinSpend = 15000000) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notified = getNotifiedSet();
  const now = Date.now();
  const ninety = 90 * 24 * 60 * 60 * 1000;

  const vipInactive = customers.filter((c) => {
    if (c.totalSpend < vipMinSpend) return false;
    if (!c.lastOrder) return false;
    const lastDate = new Date(c.lastOrder).getTime();
    return now - lastDate > ninety;
  });

  if (vipInactive.length === 0) return;

  const key = `vip-inactive-${getTodayKey()}`;
  if (notified.has(key)) return;

  sendBrowserNotification(
    `⚠️ ${vipInactive.length} Pelanggan VIP Tidak Aktif`,
    `${storeName}: Pelanggan VIP belum berbelanja > 90 hari. Cek Marketing Hub untuk re-engagement!`,
  );
  notified.add(key);
  saveNotifiedSet(notified);
}
