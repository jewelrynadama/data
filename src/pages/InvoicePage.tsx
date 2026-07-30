// src/pages/InvoicePage.tsx
import { useMemo, useState } from 'react';
import { Search, Printer, FileText, X } from 'lucide-react';
import type { Customer } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { printInvoice, printCustomerStatement } from '../utils/printHelper';

interface Props {
  customers: Customer[];
  settings?: any;
}

export default function InvoicePage({ customers, settings }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filtered = useMemo(() =>
    customers
      .filter((c) => c.orders.length > 0)
      .filter((c) => !search || c.nama.toLowerCase().includes(search.toLowerCase()) || c.instagram.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50),
    [customers, search]
  );

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null;
  const selectedOrderGroup = selectedCustomer?.orders.filter((o) => (o.tanggalOrder || '—') === selectedOrderId) ?? [];

  return (
    <div className="page-body">
      <style>{`
        .invoice-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 20px;
          align-items: start;
        }
        .mobile-close-btn {
          display: none !important;
        }
        @media (max-width: 768px) {
          .invoice-layout {
            grid-template-columns: 1fr;
            display: flex;
            flex-direction: column;
          }
          .invoice-right-panel {
            display: none;
          }
          .invoice-right-panel.mobile-active {
            display: flex;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9999;
            padding: 16px;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(2px);
          }
          .invoice-right-panel.mobile-active > .card {
            width: 100%;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            margin: 0;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          .invoice-right-panel.mobile-active .card-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }
          .invoice-right-panel.mobile-active .card-header .btn-primary {
            justify-content: center;
          }
          .invoice-right-panel.mobile-active .card-body {
            overflow-y: auto;
          }
          .mobile-close-btn {
            display: flex !important;
          }
        }
      `}</style>
      <div className="invoice-layout">
        {/* Left: Customer picker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">👤 Pilih Pelanggan</div>
            </div>
            <div className="card-body" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', marginBottom: 10 }}>
                <Search size={13} color="var(--text-muted)" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedCustomerId(null); setSelectedOrderId(null); }} placeholder="Cari nama / instagram…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12.5, width: '100%' }} />
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomerId(c.id); setSelectedOrderId(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 8, border: selectedCustomerId === c.id ? '1px solid var(--accent-purple)' : '1px solid transparent',
                      background: selectedCustomerId === c.id ? 'rgba(124,58,237,0.1)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {c.nama[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nama}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.orderCount} order · {formatRupiah(c.totalSpend)}</div>
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 20, fontSize: 13, color: 'var(--text-muted)' }}>Tidak ada pelanggan ditemukan</div>}
              </div>
            </div>
          </div>

          {/* Customer Statement print */}
          {selectedCustomer && (
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 13 }} onClick={() => printCustomerStatement(selectedCustomer, settings)}>
              <FileText size={14} /> Cetak Riwayat Lengkap
            </button>
          )}
        </div>

        {/* Right: Order picker + action */}
        <div className={`invoice-right-panel ${selectedCustomer ? 'mobile-active' : ''}`}>
          {!selectedCustomer ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Pilih pelanggan di sebelah kiri</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Setelah pilih pelanggan, kamu bisa generate invoice per transaksi</div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header" style={{ position: 'relative', flexShrink: 0 }}>
                <button 
                  className="mobile-close-btn" 
                  onClick={() => setSelectedCustomerId(null)} 
                  style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, color: 'var(--text-secondary)' }}
                >
                  <X size={16} />
                </button>
                <div style={{ paddingRight: 36 }}>
                  <div className="card-title">🧾 Order dari {selectedCustomer.nama}</div>
                  <div className="card-subtitle">{selectedCustomer.orderCount} transaksi · Total {formatRupiah(selectedCustomer.totalSpend)}</div>
                </div>
                {selectedOrderGroup.length > 0 && (
                  <button className="btn btn-primary" style={{ gap: 8 }} onClick={() => printInvoice(selectedCustomer, selectedOrderGroup, settings)}>
                    <Printer size={14} /> Cetak Invoice
                  </button>
                )}
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>Pilih</th>
                        <th>Tanggal</th>
                        <th>Produk</th>
                        <th>Kurir</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grouped = new Map<string, typeof selectedCustomer.orders>();
                        selectedCustomer.orders.forEach(o => {
                          const dt = o.tanggalOrder || '—';
                          if (!grouped.has(dt)) grouped.set(dt, []);
                          grouped.get(dt)!.push(o);
                        });
                        return Array.from(grouped.entries())
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateStr, items]) => {
                            const isSelected = selectedOrderId === dateStr;
                            const first = items[0];
                            const grandTotal = items.reduce((sum, curr) => sum + parseInt((curr.totalBayar || '0').replace(/\D/g, '') || '0', 10), 0);
                            return (
                              <tr
                                key={dateStr}
                                onClick={() => setSelectedOrderId(isSelected ? null : dateStr)}
                                style={{ cursor: 'pointer', background: isSelected ? 'rgba(124,58,237,0.08)' : undefined }}
                              >
                                <td>
                                  <input type="radio" readOnly checked={isSelected} style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer' }} />
                                </td>
                                <td style={{ fontSize: 12 }}>{dateStr}</td>
                                <td>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{items.length} Item Pesanan</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{items.map(i => i.jenis || 'Perhiasan').join(', ')}</div>
                                </td>
                                <td style={{ fontSize: 12 }}>
                                  {(() => {
                                    const isNumericCourier = first.kurir ? /^\\d+$/.test(first.kurir.trim().replace(/[\\s\\.\\,\\-]/g, '')) : false;
                                    return first.kurir && !isNumericCourier ? first.kurir : 'JNE/J&T';
                                  })()}
                                </td>
                                <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                                  {formatRupiah(grandTotal)}
                                </td>
                              </tr>
                            );
                          });
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-card-list">
                  {(() => {
                    const grouped = new Map<string, typeof selectedCustomer.orders>();
                    selectedCustomer.orders.forEach(o => {
                      const dt = o.tanggalOrder || '—';
                      if (!grouped.has(dt)) grouped.set(dt, []);
                      grouped.get(dt)!.push(o);
                    });
                    return Array.from(grouped.entries())
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([dateStr, items]) => {
                        const isSelected = selectedOrderId === dateStr;
                        const first = items[0];
                        const grandTotal = items.reduce((sum, curr) => sum + parseInt((curr.totalBayar || '0').replace(/\D/g, '') || '0', 10), 0);
                        const isNumericCourier = first.kurir ? /^\\d+$/.test(first.kurir.trim().replace(/[\\s\\.\\,\\-]/g, '')) : false;
                        const kurirVal = first.kurir && !isNumericCourier ? first.kurir : 'JNE/J&T';

                        return (
                          <div
                            key={dateStr}
                            className="inv-card"
                            onClick={() => setSelectedOrderId(isSelected ? null : dateStr)}
                            style={{ cursor: 'pointer', ...(isSelected ? { background: 'rgba(124,58,237,0.08)', borderColor: 'var(--accent-purple)' } : {}) }}
                          >
                            <div className="inv-card-header">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="radio" readOnly checked={isSelected} style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer', margin: 0 }} />
                                <div className="inv-card-title">{dateStr}</div>
                              </div>
                            </div>
                            <div className="inv-card-body">
                              <div className="inv-detail-row">
                                <span>Total:</span>
                                <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(grandTotal)}</span>
                              </div>
                              <div className="inv-detail-row">
                                <span>Item Pesanan:</span>
                                <span>{items.length} Item</span>
                              </div>
                              <div className="inv-detail-row">
                                <span>Produk:</span>
                                <span>{items.map(i => i.jenis || 'Perhiasan').join(', ')}</span>
                              </div>
                              <div className="inv-detail-row">
                                <span>Kurir:</span>
                                <span>{kurirVal}</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
                {selectedOrderGroup.length === 0 && (
                  <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Klik baris order di atas untuk memilih, lalu klik "Cetak Invoice"
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
