// src/pages/KanbanPage.tsx
import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Clock, Truck, CheckCircle, Search } from 'lucide-react';
import type { CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { printInvoice } from '../utils/printHelper';
import type { Customer } from '../types';

interface Props {
  rows: CustomerRow[];
  customers: Customer[];
  settings?: any;
  onEditOrder: (id: string, patch: Partial<CustomerRow>) => void;
}

type KanbanStatus = 'pending' | 'proses' | 'dikirim' | 'selesai';

const COLUMNS: { status: KanbanStatus; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { status: 'pending',  label: 'Masuk',   icon: <Clock size={14} />,       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { status: 'proses',   label: 'Diproses', icon: <ChevronRight size={14} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
  { status: 'dikirim',  label: 'Dikirim',  icon: <Truck size={14} />,       color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  { status: 'selesai',  label: 'Selesai',  icon: <CheckCircle size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
];

// Map existing orderStatus values to kanban statuses
function toKanban(status: string | undefined): KanbanStatus {
  if (status === 'pending') return 'pending';
  if (status === 'dikirim') return 'dikirim';
  if (status === 'selesai' || status === 'retur') return 'selesai';
  return 'proses'; // default unset orders go to "proses"
}

function toOrderStatus(kanban: KanbanStatus): CustomerRow['orderStatus'] {
  if (kanban === 'pending') return 'pending';
  if (kanban === 'dikirim') return 'dikirim';
  if (kanban === 'selesai') return 'selesai';
  return undefined; // "proses" = no status (default)
}

export default function KanbanPage({ rows, customers, settings, onEditOrder }: Props) {
  const [search, setSearch] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);

  // Only show recent 200 orders to keep kanban manageable
  const recentRows = useMemo(() =>
    rows
      .slice()
      .sort((a, b) => b.tanggalOrder.localeCompare(a.tanggalOrder))
      .slice(0, 200)
      .filter((r) => !search || r.namaInstagram.toLowerCase().includes(search.toLowerCase()) || (r.resi || '').toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const columns = useMemo(() => {
    const map: Record<KanbanStatus, CustomerRow[]> = { pending: [], proses: [], dikirim: [], selesai: [] };
    for (const r of recentRows) {
      map[toKanban(r.orderStatus)].push(r);
    }
    return map;
  }, [recentRows]);

  const handleMove = useCallback((orderId: string, direction: 'forward' | 'back') => {
    const order = rows.find((r) => r.id === orderId);
    if (!order) return;

    const currentKanban = toKanban(order.orderStatus);
    const colIndex = COLUMNS.findIndex((c) => c.status === currentKanban);
    const newIndex = direction === 'forward' ? colIndex + 1 : colIndex - 1;
    if (newIndex < 0 || newIndex >= COLUMNS.length) return;

    const newKanban = COLUMNS[newIndex].status;
    setMovingId(orderId);
    onEditOrder(orderId, { orderStatus: toOrderStatus(newKanban) });
    setTimeout(() => setMovingId(null), 500);
  }, [rows, onEditOrder]);

  const totalValue = useMemo(() => rows.reduce((s, r) => s + (parseInt((r.totalBayar || '').replace(/\D/g, ''), 10) || 0), 0), [rows]);

  return (
    <div className="page-body">
      {/* Top Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 200 }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama pelanggan / resi…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Menampilkan <strong>{recentRows.length}</strong> order terbaru · Total: <strong style={{ color: 'var(--accent-green)' }}>{formatRupiah(totalValue)}</strong>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }} className="kanban-grid">
        {COLUMNS.map((col) => {
          const colRows = columns[col.status];
          const colValue = colRows.reduce((s, r) => s + (parseInt((r.totalBayar || '').replace(/\D/g, ''), 10) || 0), 0);

          return (
            <div key={col.status} style={{ background: col.bg, border: `1px solid ${col.color}33`, borderRadius: 14, overflow: 'hidden', minHeight: 200 }}>
              {/* Column Header */}
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${col.color}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: col.color }}>{col.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{col.label}</span>
                <span style={{ marginLeft: 'auto', background: `${col.color}22`, color: col.color, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>{colRows.length}</span>
              </div>
              {colValue > 0 && (
                <div style={{ padding: '6px 14px', fontSize: 11, color: col.color, fontWeight: 600, background: `${col.color}11`, borderBottom: `1px solid ${col.color}22` }}>
                  {formatRupiah(colValue)}
                </div>
              )}

              {/* Cards */}
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 600, overflowY: 'auto' }}>
                {colRows.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>Kosong</div>
                )}
                {colRows.map((order) => {
                  const colIdx = COLUMNS.findIndex((c) => c.status === col.status);
                  const isMoving = movingId === order.id;
                  const total = parseInt((order.totalBayar || '').replace(/\D/g, ''), 10) || 0;
                  return (
                    <div key={order.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', opacity: isMoving ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                      {/* Customer */}
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 4 }}>{order.namaInstagram || '—'}</div>
                      {/* Product */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{order.jenis || order.type || 'Perhiasan'}{order.size ? ` · ${order.size}mm` : ''}</div>
                      {/* Date & Resi */}
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                        📅 {order.tanggalOrder || '—'}
                        {order.resi && <span style={{ marginLeft: 8 }}>📦 {order.resi}</span>}
                      </div>
                      {/* Amount */}
                      {total > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>{formatRupiah(total)}</div>}
                      {/* Action & Move Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 10, padding: '4px 0', justifyContent: 'center', gap: 4 }} onClick={() => {
                          const c = customers.find(x => x.instagram === order.namaInstagram || x.nama === order.namaInstagram);
                          if (c) printInvoice(c, order, settings);
                          else alert('Customer tidak ditemukan untuk pesanan ini.');
                        }}>
                          🖨️ Cetak Invoice
                        </button>
                        <div style={{ display: 'flex', gap: 6 }}>
                        {colIdx > 0 && (
                          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center', gap: 3 }} onClick={() => handleMove(order.id, 'back')}>
                            <ChevronLeft size={11} /> {COLUMNS[colIdx - 1].label}
                          </button>
                        )}
                        {colIdx < COLUMNS.length - 1 && (
                          <button className="btn btn-primary" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center', gap: 3 }} onClick={() => handleMove(order.id, 'forward')}>
                            {COLUMNS[colIdx + 1].label} <ChevronRight size={11} />
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @media (max-width: 900px) { .kanban-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px) { .kanban-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
