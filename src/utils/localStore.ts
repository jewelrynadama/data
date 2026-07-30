// src/utils/localStore.ts
import type { Customer, CustomerRow } from '../types';
import { formatAddress } from './addressHelper';
import { cleanPrice, extractCity, formatWhatsApp } from './csvLoader';

const STORE_KEY = 'pearlcrm_local_v1';

export interface LocalStore {
  newCustomers: Customer[];          // customers added manually
  editedCustomers: Record<string, Partial<Customer>>;  // id → patch
  deletedCustomerIds: string[];
  newOrders: CustomerRow[];          // orders added manually
  editedOrders: Record<string, Partial<CustomerRow>>;  // id → patch
  deletedOrderIds: string[];
  inventoryLogs: any[];              // global inventory logs to sync
}

function emptyStore(): LocalStore {
  return {
    newCustomers: [],
    editedCustomers: {},
    deletedCustomerIds: [],
    newOrders: [],
    editedOrders: {},
    deletedOrderIds: [],
    inventoryLogs: [],
  };
}

export function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return { ...emptyStore(), ...parsed };
  } catch {
    return emptyStore();
  }
}

function writeStore(s: LocalStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

// ── Customer ops ────────────────────────────────────────────────

export function saveNewCustomer(c: Customer): void {
  const s = readStore();
  s.newCustomers = [...s.newCustomers.filter((x) => x.id !== c.id), c];
  writeStore(s);
}

export function saveCustomerEdit(id: string, patch: Partial<Customer>): void {
  const s = readStore();
  s.editedCustomers[id] = { ...(s.editedCustomers[id] ?? {}), ...patch };
  writeStore(s);
}

export function deleteCustomer(id: string): void {
  const s = readStore();
  s.deletedCustomerIds = [...new Set([...s.deletedCustomerIds, id])];
  s.newCustomers = s.newCustomers.filter((c) => c.id !== id);
  writeStore(s);
}

export function saveInventoryLogs(logs: any[]): void {
  const s = readStore();
  s.inventoryLogs = logs;
  writeStore(s);
}

// ── Order ops ────────────────────────────────────────────────────

export function saveNewOrder(order: CustomerRow): void {
  const s = readStore();
  s.newOrders = [...s.newOrders.filter((x) => x.id !== order.id), order];
  writeStore(s);
}

export function saveOrderEdit(id: string, patch: Partial<CustomerRow>): void {
  const s = readStore();
  s.editedOrders[id] = { ...(s.editedOrders[id] ?? {}), ...patch };
  writeStore(s);
}

export function deleteOrder(id: string): void {
  const s = readStore();
  s.deletedOrderIds = [...new Set([...s.deletedOrderIds, id])];
  s.newOrders = s.newOrders.filter((o) => o.id !== id);
  writeStore(s);
}

export function restoreDeletedOrders() {
  const s = readStore();
  s.deletedOrderIds = [];
  writeStore(s);
}

export function clearManualAdditions() {
  const s = readStore();
  s.newCustomers = [];
  s.newOrders = [];
  s.deletedCustomerIds = [];
  s.deletedOrderIds = [];
  s.editedCustomers = {};
  s.editedOrders = {};
  s.inventoryLogs = [];
  writeStore(s);
}

// ── Merge Sheets data + local store ──────────────────────────────

export function mergeData(
  sheetsCustomers: Customer[],
  sheetsRows: CustomerRow[],
  storeOverride?: LocalStore,
): { customers: Customer[]; rows: CustomerRow[] } {
  const s = storeOverride || readStore();

  // Apply order deletions
  const deletedOrderSet = new Set(s.deletedOrderIds);
  // Apply order edits
  let allRows: CustomerRow[] = [
    ...sheetsRows.filter((r) => !deletedOrderSet.has(r.id)),
    ...s.newOrders.filter((r) => !deletedOrderSet.has(r.id)),
  ].map((r) => {
    const patch = s.editedOrders[r.id];
    return patch ? { ...r, ...patch } : r;
  });

  // Apply customer deletions
  const deletedCustSet = new Set(s.deletedCustomerIds);

  // Apply customer edits to sheets customers
  let allCustomers: Customer[] = sheetsCustomers
    .filter((c) => !deletedCustSet.has(c.id))
    .map((c) => {
      const patch = s.editedCustomers[c.id];
      return patch ? { ...c, ...patch } : c;
    });

  // Add new customers
  const newCusts = s.newCustomers.filter((c) => !deletedCustSet.has(c.id)).map((c) => {
    let patch = s.editedCustomers[c.id];
    let cust = patch ? { ...c, ...patch } : c;
    if (cust.city === 'Unknown' || cust.city === '—' || !cust.city) {
      const city = extractCity(cust.alamat);
      if (city && city !== '—') {
        cust = { ...cust, city };
      }
    }
    return cust;
  });

  // Helper to match order to customer (case-insensitive name OR matching WA number)
  function isOrderMatch(o: CustomerRow, cName: string, cWa?: string): boolean {
    const oName = (o.namaInstagram || o.namaPengiriman || '').trim().toLowerCase();
    const targetName = cName.trim().toLowerCase();
    if (oName && targetName && oName === targetName) return true;
    if (o.wa && cWa) {
      const cleanOWa = formatWhatsApp(o.wa);
      const cleanCWa = formatWhatsApp(cWa);
      if (cleanOWa && cleanCWa && cleanOWa === cleanCWa) return true;
    }
    return false;
  }

  // Attach new orders to their customers and apply edits to existing orders
  const newOrdersForExisting = s.newOrders.filter((o) => !deletedOrderSet.has(o.id));
  allCustomers = allCustomers.map((c) => {
    // 1. Apply edits to existing orders from sheets
    let existingOrders = c.orders
      .filter((o) => !deletedOrderSet.has(o.id))
      .map((o) => {
        const patch = s.editedOrders[o.id];
        return patch ? { ...o, ...patch } : o;
      });

    // 2. Add new orders (case-insensitive or WA matching)
    const extra = newOrdersForExisting.filter((o) => isOrderMatch(o, c.nama, c.wa));
    const editedExtra = extra.map((o) => {
      const patch = s.editedOrders[o.id];
      return patch ? { ...o, ...patch } : o;
    });

    const allOrders = [...existingOrders, ...editedExtra];
    const newTotalSpend = allOrders.reduce((sum, o) => sum + cleanPrice(o.totalBayar), 0);

    return {
      ...c,
      orders: allOrders,
      orderCount: allOrders.length,
      totalSpend: newTotalSpend,
    };
  });

  // Build new customer orders
  newCusts.forEach((nc) => {
    const orders = newOrdersForExisting
      .filter((o) => !deletedOrderSet.has(o.id) && isOrderMatch(o, nc.nama, nc.wa))
      .map((o) => {
        const patch = s.editedOrders[o.id];
        return patch ? { ...o, ...patch } : o;
      });
    const totalSpend = orders.reduce((sum, o) => sum + cleanPrice(o.totalBayar), 0);
    allCustomers.push({ ...nc, orders, orderCount: orders.length, totalSpend });
  });

  // Final pass to format all addresses and wa
  allRows = allRows.map((r) => {
    if (r.alamat) r.alamat = formatAddress(r.alamat);
    if (r.wa) r.wa = formatWhatsApp(r.wa);
    return r;
  });

  allCustomers = allCustomers.map((c) => {
    if (c.alamat) c.alamat = formatAddress(c.alamat);
    if (c.wa) c.wa = formatWhatsApp(c.wa);
    c.orders = c.orders.map((o) => {
      if (o.alamat) o.alamat = formatAddress(o.alamat);
      if (o.wa) o.wa = formatWhatsApp(o.wa);
      return o;
    });
    return c;
  });

  return { customers: allCustomers, rows: allRows };
}

// ── Export / Import ────────────────────────────────────────────

export function exportLocalStore(): void {
  const s = readStore();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pearlcrm_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLocalStore(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const merged: LocalStore = { ...emptyStore(), ...parsed };
        writeStore(merged);
        resolve();
      } catch {
        reject(new Error('Invalid backup file'));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function clearLocalStore(): void {
  localStorage.removeItem(STORE_KEY);
}
