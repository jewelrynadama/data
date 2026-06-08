// src/utils/localStore.ts
import type { Customer, CustomerRow } from '../types';
import { formatAddress } from './addressHelper';

const STORE_KEY = 'pearlcrm_local_v1';

export interface LocalStore {
  newCustomers: Customer[];          // customers added manually
  editedCustomers: Record<string, Partial<Customer>>;  // id → patch
  deletedCustomerIds: string[];
  newOrders: CustomerRow[];          // orders added manually
  editedOrders: Record<string, Partial<CustomerRow>>;  // id → patch
  deletedOrderIds: string[];
}

function emptyStore(): LocalStore {
  return {
    newCustomers: [],
    editedCustomers: {},
    deletedCustomerIds: [],
    newOrders: [],
    editedOrders: {},
    deletedOrderIds: [],
  };
}

export function readStore(): LocalStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
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
    const patch = s.editedCustomers[c.id];
    return patch ? { ...c, ...patch } : c;
  });

  // Attach new orders to their customers
  const newOrdersForExisting = s.newOrders.filter((o) => !deletedOrderSet.has(o.id));
  allCustomers = allCustomers.map((c) => {
    const extra = newOrdersForExisting.filter((o) => o.namaInstagram === c.nama);
    if (!extra.length) return c;
    const editedExtra = extra.map((o) => {
      const patch = s.editedOrders[o.id];
      return patch ? { ...o, ...patch } : o;
    });
    const addSpend = editedExtra.reduce((sum, o) => sum + parseInt(o.totalBayar.replace(/\D/g, '') || '0', 10), 0);
    return {
      ...c,
      orders: [...c.orders, ...editedExtra],
      orderCount: c.orderCount + editedExtra.length,
      totalSpend: c.totalSpend + addSpend,
    };
  });

  // Build new customer orders
  newCusts.forEach((nc) => {
    const orders = newOrdersForExisting.filter((o) => !deletedOrderSet.has(o.id) && o.namaInstagram === nc.nama)
      .map((o) => {
        const patch = s.editedOrders[o.id];
        return patch ? { ...o, ...patch } : o;
      });
    const totalSpend = orders.reduce((sum, o) => sum + parseInt(o.totalBayar.replace(/\D/g, '') || '0', 10), 0);
    allCustomers.push({ ...nc, orders, orderCount: orders.length, totalSpend });
  });

  // Final pass to format all addresses
  allRows = allRows.map((r) => {
    if (r.alamat) r.alamat = formatAddress(r.alamat);
    return r;
  });

  allCustomers = allCustomers.map((c) => {
    if (c.alamat) c.alamat = formatAddress(c.alamat);
    c.orders = c.orders.map((o) => {
      if (o.alamat) o.alamat = formatAddress(o.alamat);
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
