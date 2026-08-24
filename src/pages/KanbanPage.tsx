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

function parseDateStr(str: string): number {
  if (!str) return NaN;
  const parts = str.split(/[-/]/);
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
  }
  return new Date(str).getTime();
}

function getSlaBadge(status: KanbanStatus, dateStr: string) {
  if (!dateStr) return null;
  const time = parseDateStr(dateStr);
  if (isNaN(time)) return null;
  const now = new Date('2026-07-30T19:00:06+07:00').getTime();
  const diffDays = Math.floor((now - time) / 86400000);
  
  if (diffDays < 1) return null;
  
  if (status === 'pending') {
    return <span style={{ fontSize: 10, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>{diffDays} hari</span>;
  }
  if (status === 'proses') {
    if (diffDays > 3) {
      return <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: 4 }}>🔴 {diffDays} hari</span>;
    } else if (diffDays > 2) {
      return <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '2px 6px', borderRadius: 4 }}>⚠️ {diffDays} hari</span>;
    } else {
      return <span style={{ fontSize: 10, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>{diffDays} hari</span>;
    }
  }
  if (status === 'dikirim') {
    return <span style={{ fontSize: 10, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>{diffDays} hari</span>;
  }
  return null;
}

export default function KanbanPage({ rows, customers, settings, onEditOrder }: Props) {
  const [search, setSearch] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [activeKurir, setActiveKurir] = useState<string>('Semua');
  const [waModalOrder, setWaModalOrder] = useState<CustomerRow | null>(null);

  const uniqueKurir = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach(r => {
      const k = (r as any).kurir || 'Lainnya';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const recentRows = useMemo(() =>
    rows
      .slice()
      .sort((a, b) => b.tanggalOrder.localeCompare(a.tanggalOrder))
      .slice(0, 200)
      .filter((r) => !search || r.namaInstagram.toLowerCase().includes(search.toLowerCase()) || (r.resi || '').toLowerCase().includes(search.toLowerCase()))
      .filter((r) => activeKurir === 'Semua' || ((r as any).kurir || 'Lainnya') === activeKurir),
    [rows, search, activeKurir]
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

      {/* Courier Filter Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        <button
          onClick={() => setActiveKurir('Semua')}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            border: '1px solid var(--border)',
            background: activeKurir === 'Semua' ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-card)',
            color: activeKurir === 'Semua' ? '#fff' : 'var(--text-primary)',
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Semua ({rows.length})
        </button>
        {Object.entries(uniqueKurir).sort((a, b) => b[1] - a[1]).map(([kurir, count]) => (
          <button
            key={kurir}
            onClick={() => setActiveKurir(kurir)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: '1px solid var(--border)',
              background: activeKurir === kurir ? 'var(--accent-blue, #3b82f6)' : 'var(--bg-card)',
              color: activeKurir === kurir ? '#fff' : 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {kurir} ({count})
          </button>
        ))}
      </div>

      <style>{`
        .kanban-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .kanban-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Odoo Kanban Board */}
      <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, alignItems: 'start' }}>
        {COLUMNS.map((col) => {
          const colRows = columns[col.status];
          const colValue = colRows.reduce((s, r) => s + (parseInt((r.totalBayar || '').replace(/\D/g, ''), 10) || 0), 0);

          return (
            <div key={col.status} className="kanban-col" style={{ 
              background: '#F8F9FA', 
              border: '1px solid var(--border)', 
              borderRadius: '4px', 
              overflow: 'hidden', 
              minHeight: 300,
              boxShadow: 'var(--shadow-sm)'
            }}>
              {/* Odoo Column Header */}
              <div style={{ 
                padding: '10px 12px', 
                background: '#FFFFFF',
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                borderTop: `3px solid ${col.color}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: col.color, display: 'flex' }}>{col.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{col.label}</span>
                </div>
                <span style={{ 
                  background: '#E9ECEF', 
                  color: '#495057', 
                  fontSize: 11, 
                  fontWeight: 700, 
                  padding: '1px 6px', 
                  borderRadius: 3 
                }}>
                  {colRows.length}
                </span>
              </div>

              {/* Odoo Stage Total Aggregate */}
              <div style={{ 
                padding: '6px 12px', 
                fontSize: 11, 
                color: '#6C757D', 
                fontWeight: 600, 
                background: '#F8F9FA', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>Expected Revenue:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatRupiah(colValue)}</span>
              </div>

              {/* Cards Container */}
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 640, overflowY: 'auto' }}>
                {colRows.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    No orders in this stage
                  </div>
                )}
                {colRows.map((order) => {
                  const colIdx = COLUMNS.findIndex((c) => c.status === col.status);
                  const isMoving = movingId === order.id;
                  const total = parseInt((order.totalBayar || '').replace(/\D/g, ''), 10) || 0;
                  const cObj = customers.find(x => x.instagram === order.namaInstagram || x.nama === order.namaInstagram);
                  const isVIP = (cObj?.totalSpend || 0) >= 10000000;

                  return (
                    <div 
                      key={order.id} 
                      style={{ 
                        background: '#FFFFFF', 
                        border: '1px solid var(--border)', 
                        borderRadius: '4px', 
                        padding: '10px 12px', 
                        opacity: isMoving ? 0.5 : 1, 
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Top Title & Stars */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {order.namaInstagram || '—'}
                        </span>
                        <span style={{ fontSize: 11, color: isVIP ? '#F0AD4E' : '#CED4DA' }} title={isVIP ? 'VIP Lead' : 'Priority'}>
                          {isVIP ? '★★★' : '★☆☆'}
                        </span>
                      </div>

                      {/* Product details */}
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {order.jenis || order.type || 'Jewelry Item'}{order.size ? ` · ${order.size}mm` : ''}
                      </div>

                      {/* Tags & Kurir */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {isVIP && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, background: 'rgba(240,173,78,0.15)', color: '#D97706', padding: '1px 5px', borderRadius: 2 }}>
                            VIP Partner
                          </span>
                        )}
                        {(order as any).kurir && (
                          <span style={{ fontSize: 9.5, background: '#E9ECEF', color: '#495057', padding: '1px 5px', borderRadius: 2 }}>
                            {(order as any).kurir}
                          </span>
                        )}
                      </div>

                      {/* Date, SLA & Resi */}
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={11} color="var(--accent-purple)" /> {order.tanggalOrder || '—'}
                        </span>
                        {getSlaBadge(col.status, order.tanggalOrder)}
                        {order.resi && <span>📦 {order.resi}</span>}
                      </div>

                      {/* Amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total:</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#017E84' }}>{formatRupiah(total)}</span>
                      </div>

                      {/* Action & Move Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button className="btn btn-secondary" style={{ fontSize: 10.5, padding: '3px 0', justifyContent: 'center', gap: 4, borderRadius: 3 }} onClick={() => {
                          if (cObj) printInvoice(cObj, order, settings);
                          else alert('Customer tidak ditemukan untuk pesanan ini.');
                        }}>
                          🖨️ Cetak Invoice
                        </button>
                        <div style={{ display: 'flex', gap: 4 }}>
                        {colIdx > 0 && (
                          <button className="btn btn-secondary" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center', gap: 3, borderRadius: 3 }} onClick={() => handleMove(order.id, 'back')}>
                            <ChevronLeft size={11} /> {COLUMNS[colIdx - 1].label}
                          </button>
                        )}
                        {colIdx < COLUMNS.length - 1 && (
                          <button className="btn btn-primary" style={{ flex: 1, fontSize: 10, padding: '3px 0', justifyContent: 'center', gap: 3, borderRadius: 3, background: '#017E84', borderColor: '#017E84' }} onClick={() => {
                            if (col.status === 'proses' && COLUMNS[colIdx + 1].status === 'dikirim') {
                              setWaModalOrder(order);
                            } else {
                              handleMove(order.id, 'forward');
                            }
                          }}>
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
      
      {/* WA Trigger Modal */}
      {waModalOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, width: '90%', maxWidth: 400, border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>📦 Kirim Notifikasi ke Customer?</h3>
            <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-primary)' }}>
              <strong>{waModalOrder.namaInstagram}</strong> - Resi: {waModalOrder.resi || 'Belum ada'}
            </div>
            <div style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', padding: 12, borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 16, fontFamily: 'monospace' }}>
{`Halo Kak *${waModalOrder.namaInstagram}* 👋

Pesanan Anda sudah dikirim! 📦

🚚 Kurir: ${(waModalOrder as any).kurir || '-'}
📋 No. Resi: *${waModalOrder.resi || '-'}*

Pantau paket Anda di website ekspedisi ya Kak!
Terima kasih sudah berbelanja! 💎✨`}
            </div>
            {!waModalOrder.resi && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>⚠️ Nomor resi belum diisi</div>}
            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button 
                className="btn btn-primary" 
                style={{ opacity: !waModalOrder.resi ? 0.5 : 1, cursor: !waModalOrder.resi ? 'not-allowed' : 'pointer', justifyContent: 'center' }}
                disabled={!waModalOrder.resi}
                onClick={() => {
                  if (!waModalOrder.resi) return;
                  const msg = `Halo Kak *${waModalOrder.namaInstagram}* 👋\n\nPesanan Anda sudah dikirim! 📦\n\n🚚 Kurir: ${(waModalOrder as any).kurir || '-'}\n📋 No. Resi: *${waModalOrder.resi || '-'}*\n\nPantau paket Anda di website ekspedisi ya Kak!\nTerima kasih sudah berbelanja! 💎✨`;
                  const c = customers.find(x => x.instagram === waModalOrder.namaInstagram || x.nama === waModalOrder.namaInstagram);
                  const phone = c?.wa || '';
                  const phoneFormat = phone.replace(/\D/g, '').replace(/^0/, '62');
                  if (phoneFormat) {
                    window.open(`https://wa.me/${phoneFormat}?text=${encodeURIComponent(msg)}`, '_blank');
                  } else {
                    alert('Nomor HP customer tidak ditemukan atau format salah.');
                  }
                  handleMove(waModalOrder.id, 'forward');
                  setWaModalOrder(null);
                }}
              >
                📱 Kirim WA + Pindahkan
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ justifyContent: 'center' }}
                onClick={() => {
                  handleMove(waModalOrder.id, 'forward');
                  setWaModalOrder(null);
                }}
              >
                Pindahkan Saja
              </button>
              <button 
                className="btn" 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', justifyContent: 'center' }}
                onClick={() => setWaModalOrder(null)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
