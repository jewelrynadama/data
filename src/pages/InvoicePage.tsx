// src/pages/InvoicePage.tsx
import { useMemo, useState } from 'react';
import { Search, Printer, FileText } from 'lucide-react';
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
  const selectedOrder = selectedCustomer?.orders.find((o) => o.id === selectedOrderId) ?? null;

  return (
    <div className="page-body">
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }} className="invoice-layout">
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
        <div>
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
              <div className="card-header">
                <div>
                  <div className="card-title">🧾 Order dari {selectedCustomer.nama}</div>
                  <div className="card-subtitle">{selectedCustomer.orderCount} transaksi · Total {formatRupiah(selectedCustomer.totalSpend)}</div>
                </div>
                {selectedOrder && (
                  <button className="btn btn-primary" style={{ gap: 8 }} onClick={() => printInvoice(selectedCustomer, selectedOrder, settings)}>
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
                      {selectedCustomer.orders
                        .slice()
                        .sort((a, b) => b.tanggalOrder.localeCompare(a.tanggalOrder))
                        .map((order) => {
                          const isSelected = selectedOrderId === order.id;
                          return (
                            <tr
                              key={order.id}
                              onClick={() => setSelectedOrderId(isSelected ? null : order.id)}
                              style={{ cursor: 'pointer', background: isSelected ? 'rgba(124,58,237,0.08)' : undefined }}
                            >
                              <td>
                                <input type="radio" readOnly checked={isSelected} style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer' }} />
                              </td>
                              <td style={{ fontSize: 12 }}>{order.tanggalOrder || '—'}</td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{order.jenis || 'Perhiasan'}</div>
                                {order.type && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.type} {order.size ? `· ${order.size}mm` : ''}</div>}
                              </td>
                              <td style={{ fontSize: 12 }}>{order.kurir || '—'}</td>
                              <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                                {order.totalBayar ? formatRupiah(parseInt(order.totalBayar.replace(/\D/g, ''), 10)) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {!selectedOrder && (
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
