// src/utils/notificationEngine.ts
import type { Customer, CustomerRow } from '../types';

export type NotifType = 'birthday' | 'resi' | 'inactive' | 'milestone';
export type NotifSeverity = 'critical' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  severity: NotifSeverity;
  customerId?: string;
  customerName?: string;
  waPhone?: string;
  orderId?: string;
  timestamp: number;
}

export interface BirthdayAlertInput {
  customer: Customer;
  daysUntil: number;
}

function parseOrderDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

export function computeNotifications(
  customers: Customer[],
  rows: CustomerRow[],
  birthdayAlerts: BirthdayAlertInput[]
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = new Date();

  // ─── 1. BIRTHDAY ALERTS ─────────────────────────────────────────────────────
  for (const alert of birthdayAlerts) {
    if (alert.daysUntil === 0) {
      notifications.push({
        id: `birthday-today-${alert.customer.id}`,
        type: 'birthday',
        title: `🎂 Ulang Tahun Hari Ini!`,
        body: `${alert.customer.nama} ulang tahun hari ini. Segera kirim ucapan spesial!`,
        severity: 'critical',
        customerId: alert.customer.id,
        customerName: alert.customer.nama,
        waPhone: alert.customer.wa,
        timestamp: Date.now(),
      });
    } else if (alert.daysUntil > 0 && alert.daysUntil <= 7) {
      notifications.push({
        id: `birthday-soon-${alert.customer.id}`,
        type: 'birthday',
        title: `🎉 ${alert.daysUntil} Hari Lagi Ulang Tahun`,
        body: `${alert.customer.nama} akan ulang tahun dalam ${alert.daysUntil} hari. Siapkan ucapan!`,
        severity: 'warning',
        customerId: alert.customer.id,
        customerName: alert.customer.nama,
        waPhone: alert.customer.wa,
        timestamp: Date.now() - alert.daysUntil * 1000,
      });
    }
  }

  // ─── 2. ORDERS WITHOUT RESI (> 2 days old) ──────────────────────────────────
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const rowsMissingResi = rows.filter(
    (r) =>
      r.jenis && // is a product row
      !r.resi?.trim() && // no tracking number
      r.orderStatus !== 'selesai' &&
      r.orderStatus !== 'retur'
  );

  for (const row of rowsMissingResi) {
    const orderDate = parseOrderDate(row.tanggalOrder);
    if (orderDate && orderDate <= twoDaysAgo) {
      const daysPassed = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `resi-missing-${row.id}`,
        type: 'resi',
        title: `📦 Resi Belum Diisi`,
        body: `Pesanan ${row.namaInstagram} (${row.jenis}) tgl ${row.tanggalOrder} — sudah ${daysPassed} hari belum ada nomor resi.`,
        severity: 'warning',
        customerName: row.namaInstagram,
        orderId: row.id,
        timestamp: orderDate.getTime(),
      });
    }
  }

  // ─── 3. INACTIVE CUSTOMERS (no order for 90+ days) ──────────────────────────
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const inactiveCustomers = customers.filter((c) => {
    if (!c.lastOrder) return false;
    const lastOrderDate = parseOrderDate(c.lastOrder);
    if (!lastOrderDate) return false;
    return lastOrderDate < ninetyDaysAgo && c.orderCount > 0;
  });

  if (inactiveCustomers.length > 0) {
    const topNames = inactiveCustomers
      .slice(0, 3)
      .map((c) => c.nama)
      .join(', ');
    const extra =
      inactiveCustomers.length > 3 ? ` +${inactiveCustomers.length - 3} lainnya` : '';
    notifications.push({
      id: `inactive-customers`,
      type: 'inactive',
      title: `🔁 ${inactiveCustomers.length} Pelanggan Tidak Aktif`,
      body: `${topNames}${extra} belum bertransaksi lebih dari 90 hari. Waktunya follow up!`,
      severity: 'info',
      timestamp: Date.now() - 10000,
    });
  }

  // ─── 4. ORDER MILESTONES ─────────────────────────────────────────────────────
  const MILESTONES = [5, 10, 20, 50];
  for (const customer of customers) {
    for (const milestone of MILESTONES) {
      if (customer.orderCount === milestone) {
        notifications.push({
          id: `milestone-${customer.id}-${milestone}`,
          type: 'milestone',
          title: `🏆 Milestone ${milestone} Pesanan!`,
          body: `${customer.nama} baru mencapai ${milestone} pesanan. Berikan apresiasi spesial!`,
          severity: 'info',
          customerId: customer.id,
          customerName: customer.nama,
          waPhone: customer.wa,
          timestamp: Date.now() - 20000,
        });
      }
    }
  }

  // Sort: critical → warning → info, then newest first within same severity
  const severityOrder: Record<NotifSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  notifications.sort((a, b) => {
    const diff = severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return b.timestamp - a.timestamp;
  });

  return notifications;
}
