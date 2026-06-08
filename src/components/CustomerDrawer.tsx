// src/components/CustomerDrawer.tsx
import { useState } from 'react';
import { X, Instagram, Phone, MapPin, Calendar, Package, CreditCard, Edit2, Trash2, Plus, Copy, Check, Printer } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, getJenisBadgeClass, getCustomerLabel } from '../utils/csvLoader';
import { printInvoice, printCustomerStatement } from '../utils/printHelper';
import { formatBirthday } from '../utils/birthday';
import CustomerFormModal from './CustomerFormModal';
import OrderFormModal from './OrderFormModal';
import ShippingLabelModal from './ShippingLabelModal';
import { calcLoyalty } from '../utils/loyaltyEngine';
import { extractInstagramUsername, generateInstaLink } from '../utils/socialIntelligenceEngine';

interface Props {
  customer: Customer;
  onClose: () => void;
  onEditCustomer: (id: string, patch: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
  onAddOrder: (order: Partial<CustomerRow>) => void;
  onEditOrder: (id: string, patch: Partial<CustomerRow>) => void;
  onDeleteOrder: (id: string) => void;
  settings?: any;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function getWhatsAppShareUrl(customer: Customer, order: CustomerRow, settings?: any) {
  const storeName = settings?.storeName || 'Pearl Store';
  const phone = customer.wa ? customer.wa.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';
  const template = settings?.shippingMessageTemplate || 'Halo Kak {customerName}! Terima kasih atas ordernya di toko kami. Pesanan perhiasan {productName} Kakak telah dikirim menggunakan kurir {courierName} dengan nomor resi *{resi}*. Semoga suka dengan perhiasannya! 💎✨';
  
  const productName = order.jenis || 'mutiara';
  const courierName = order.kurir || 'kurir';
  const resi = order.resi || '';
  
  const message = template
    .replace(/{customerName}/g, customer.nama)
    .replace(/{productName}/g, productName)
    .replace(/{courierName}/g, courierName)
    .replace(/{resi}/g, resi)
    .replace(/{storeName}/g, storeName);
    
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getWhatsAppBirthdayUrl(customer: Customer, settings?: any) {
  const storeName = settings?.storeName || 'Pearl Store';
  const voucherCode = settings?.voucherCode || 'BDAY10';
  const voucherType = settings?.voucherType || 'percent';
  const voucherValue = settings?.voucherValue || 10;
  const vipMinSpend = settings?.vipMinSpend || 15000000;
  const loyalMinOrders = settings?.loyalMinOrders || 3;

  const phone = customer.wa ? customer.wa.replace(/[^0-9]/g, '').replace(/^0/, '62') : '';
  const label = getCustomerLabel(customer.totalSpend, customer.orderCount, vipMinSpend, loyalMinOrders);
  
  const voucherText = voucherType === 'percent'
    ? `${voucherValue}%`
    : `Rp ${voucherValue.toLocaleString('id-ID')}`;

  const vipNote = label === 'vip' ? `\n\n🌟 Sebagai pelanggan VIP kami, Kakak mendapat diskon spesial *${voucherText}* untuk pembelian berikutnya! Cukup sebut kode: *${voucherCode}* saat order ya 🎁` : '';
  
  const template = settings?.birthdayMessageTemplate || '🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨{vipNote}\n\nSalam hangat,\n💎 {storeName}';
  
  const message = template
    .replace(/{customerName}/g, customer.nama)
    .replace(/{storeName}/g, storeName)
    .replace(/{vipNote}/g, vipNote);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '⏳ Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  dikirim:  { label: '🚚 Dikirim',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  selesai:  { label: '✅ Selesai',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  retur:    { label: '↩️ Retur',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

const GRAD_COLORS = [
  'linear-gradient(135deg,#7c3aed,#4f46e5)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
];

export default function CustomerDrawer({
  customer, onClose, onEditCustomer, onDeleteCustomer,
  onAddOrder, onEditOrder, onDeleteOrder, settings,
}: Props) {
  const [showEditCustomer, setShowEditCustomer]     = useState(false);
  const [copiedAddress, setCopiedAddress]           = useState(false);
  const [showAddOrder, setShowAddOrder]             = useState(false);
  const [editingOrder, setEditingOrder]             = useState<CustomerRow | null>(null);
  const [confirmDelete, setConfirmDelete]           = useState(false);
  const [showShippingLabel, setShowShippingLabel]   = useState<CustomerRow | null | undefined>(undefined);
  const customerLabel = getCustomerLabel(customer.totalSpend, customer.orderCount, settings?.vipMinSpend, settings?.loyalMinOrders);

  const colorIdx  = customer.nama.charCodeAt(0) % GRAD_COLORS.length;
  const avgOrder  = customer.orderCount > 0 ? customer.totalSpend / customer.orderCount : 0;
  const loyalty   = calcLoyalty(customer);

  const typeCount:  Record<string, number> = {};
  const pearlCount: Record<string, number> = {};
  for (const o of customer.orders) {
    if (o.jenis) typeCount[o.jenis]  = (typeCount[o.jenis]  || 0) + 1;
    if (o.type)  pearlCount[o.type]  = (pearlCount[o.type]  || 0) + 1;
  }
  const favType  = Object.entries(typeCount).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—';
  const favPearl = Object.entries(pearlCount).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—';

  function handleSaveCustomer(data: Partial<Customer> & { nama: string }) {
    onEditCustomer(customer.id, data);
    setShowEditCustomer(false);
  }

  function handleCopyAddress() {
    const text = `KEPADA: ${customer.nama}\nWA: ${customer.wa || '—'}\nKOTA: ${customer.city || '—'}\nALAMAT: ${customer.alamat || '—'}`;
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  }

  function handleSaveOrder(data: Partial<CustomerRow>) {
    if (editingOrder) {
      onEditOrder(editingOrder.id, data);
      setEditingOrder(null);
    } else {
      onAddOrder(data);
      setShowAddOrder(false);
    }
  }

  function handleDeleteCustomer() {
    onDeleteCustomer(customer.id);
    onClose();
  }

  const isLocal = customer.id.startsWith('local-');

  return (
    <>
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="customer-drawer">
          {/* Header */}
          <div className="drawer-header">
            <span className="drawer-title">Customer Profile</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn" title="Edit customer" onClick={() => setShowEditCustomer(true)}>
                <Edit2 size={14} />
              </button>
              <button
                className="icon-btn"
                title="Hapus customer"
                style={{ color: confirmDelete ? 'var(--accent-red)' : undefined }}
                onClick={() => {
                  if (confirmDelete) handleDeleteCustomer();
                  else setConfirmDelete(true);
                }}
              >
                <Trash2 size={14} />
              </button>
              <button className="icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          {confirmDelete && (
            <div style={{
              padding: '10px 16px', background: 'rgba(239,68,68,0.1)',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <span style={{ fontSize: 12.5, color: '#fca5a5' }}>Yakin hapus customer ini?</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setConfirmDelete(false)}>Batal</button>
                <button className="btn" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--accent-red)', color: 'white' }} onClick={handleDeleteCustomer}>Hapus</button>
              </div>
            </div>
          )}

          <div className="drawer-body">
            {/* Hero */}
            <div className="customer-hero">
              <div className="customer-avatar-lg" style={{ background: GRAD_COLORS[colorIdx] }}>
                {initials(customer.nama)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className="customer-hero-name" style={{ margin: 0 }}>{customer.nama}</div>
                  {customerLabel === 'vip' && (
                    <span className="badge-customer-vip">👑 VIP</span>
                  )}
                  {customerLabel === 'loyal' && (
                    <span className="badge-customer-loyal">⭐ Loyal</span>
                  )}
                  {customerLabel === 'new' && (
                    <span className="badge-customer-new">✨ Baru</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: loyalty.tierColor, background: `${loyalty.tierColor}18`, padding: '2px 8px', borderRadius: 20 }}>
                    {loyalty.tierEmoji} {loyalty.tier}
                  </span>
                </div>
                {(() => {
                  const igHandle = extractInstagramUsername(customer.instagram);
                  const igUrl = generateInstaLink(customer.instagram, customer.nama);
                  return igHandle ? (
                    <a
                      href={igUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="customer-hero-ig"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', cursor: 'pointer' }}
                    >
                      <Instagram size={12} />
                      @{igHandle}
                    </a>
                  ) : null;
                })()}
                {customer.wa && (
                  <a
                    href={`https://wa.me/${customer.wa.replace(/[^0-9]/g,'').replace(/^0/,'62')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="customer-hero-wa"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', cursor: 'pointer', marginTop: 2 }}
                  >
                    <Phone size={11} />
                    {customer.wa}
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                {isLocal && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(124,58,237,0.18)', color: 'var(--text-accent)', flexShrink: 0 }}>
                    Lokal
                  </span>
                )}
                {customer.alamat && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, height: 26 }}
                    onClick={() => setShowShippingLabel(customer.orders[0] ?? null)}
                    title="Cetak Label Pengiriman"
                  >
                    <Printer size={11} /> Cetak Label
                  </button>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Total Spend', value: formatRupiah(customer.totalSpend), color: 'var(--accent-green)' },
                { label: 'Orders',      value: customer.orderCount,               color: 'var(--accent-purple)' },
                { label: 'Avg Order',   value: formatRupiah(avgOrder),            color: 'var(--accent-cyan)' },
              ].map((m) => (
                <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius-sm)', padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Loyalty Points */}
            <div style={{ background: `${loyalty.tierColor}10`, border: `1px solid ${loyalty.tierColor}30`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>{loyalty.tierEmoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: loyalty.tierColor }}>{loyalty.tier} Member</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{loyalty.points.toLocaleString('id-ID')} poin</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-tertiary)', borderRadius: 3, marginBottom: 4 }}>
                  <div style={{ width: `${loyalty.progressPercent}%`, height: 5, background: loyalty.tierColor, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                {loyalty.nextTier ? (
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {loyalty.pointsToNext.toLocaleString('id-ID')} poin lagi untuk naik ke <strong>{loyalty.nextTier}</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 10.5, color: loyalty.tierColor, fontWeight: 600 }}>🎉 Tier tertinggi!</div>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="detail-section-title" style={{ margin: 0 }}>Contact &amp; Location</div>
                {customer.alamat && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, height: 26, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                    onClick={handleCopyAddress}
                    title="Salin Label Kirim"
                  >
                    {copiedAddress ? <Check size={11} style={{ color: 'var(--accent-green)' }} /> : <Copy size={11} />}
                    {copiedAddress ? 'Tersalin' : 'Salin Alamat'}
                  </button>
                )}
              </div>
              {customer.alamat && (
                <div className="detail-row">
                  <span className="detail-label"><MapPin size={12} style={{ display:'inline', marginRight:4 }} />Address</span>
                  <span className="detail-value" style={{ fontSize:11.5 }}>{customer.alamat}</span>
                </div>
              )}
              {customer.city && customer.city !== '—' && (
                <div className="detail-row">
                  <span className="detail-label">City</span>
                  <span className="detail-value">{customer.city}</span>
                </div>
              )}
              {customer.tanggalUlangTahun && (
                <div className="detail-row">
                  <span className="detail-label"><Calendar size={12} style={{ display:'inline', marginRight:4 }} />Birthday</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="detail-value">{formatBirthday(customer.tanggalUlangTahun)}</span>
                    {customer.wa && (
                      <a
                        href={getWhatsAppBirthdayUrl(customer, settings)}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(16,185,129,0.12)', color: '#10b981',
                          borderRadius: 5, padding: '2px 7px', fontSize: 10.5,
                          textDecoration: 'none', fontWeight: 600,
                        }}
                        title="Kirim ucapan HUT via WhatsApp"
                      >
                        🎂 Kirim WA HUT
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="detail-section">
              <div className="detail-section-title">Shopping Preferences</div>
              <div className="detail-row"><span className="detail-label">Favourite Type</span><span className="detail-value">{favType}</span></div>
              <div className="detail-row"><span className="detail-label">Favourite Pearl</span><span className="detail-value">{favPearl}</span></div>
              <div className="detail-row"><span className="detail-label">Last Order</span><span className="detail-value">{customer.lastOrder || '—'}</span></div>
            </div>

            {/* Order History */}
            <div className="detail-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="detail-section-title">
                  <Package size={11} style={{ display:'inline', marginRight:4 }} />
                  Order History ({customer.orders.length})
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {customer.orders.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, height: 26 }}
                      onClick={() => printCustomerStatement(customer, settings)}
                      title="Cetak Laporan Riwayat Transaksi Customer Ini"
                    >
                      <Printer size={11} /> Cetak Riwayat
                    </button>
                  )}
                  <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, height: 26 }} onClick={() => setShowAddOrder(true)}>
                    <Plus size={12} /> Tambah Order
                  </button>
                </div>
              </div>
              <div className="orders-list" style={{ marginTop: 8 }}>
                {customer.orders.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: '16px 0' }}>
                    Belum ada order
                  </div>
                )}
                {customer.orders.slice().reverse().map((o) => {
                  const statusCfg = o.orderStatus ? STATUS_CONFIG[o.orderStatus] : null;
                  return (
                    <div key={o.id} className="order-item" style={{ position: 'relative' }}>
                      <div>
                        <div className="order-date">{o.tanggalOrder || '—'}</div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {o.jenis && <span className={`badge ${getJenisBadgeClass(o.jenis)}`}>{o.jenis}</span>}
                          {statusCfg && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                              color: statusCfg.color, background: statusCfg.bg,
                            }}>{statusCfg.label}</span>
                          )}
                        </div>
                      </div>
                      <div className="order-type" style={{ fontSize:11.5, color:'var(--text-muted)' }}>
                        {o.type} {o.size && `· ${o.size}mm`} {o.color && `· ${o.color}`}
                        {o.keterangan && <div style={{ fontSize: 10.5, marginTop: 2, color: 'var(--text-muted)' }}>{o.keterangan}</div>}
                        {o.resi && (
                          <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-accent)', flexWrap: 'wrap' }}>
                            <span>Resi: <strong>{o.resi}</strong> {o.kurir && `(${o.kurir})`}</span>
                            {customer.wa && (
                              <a
                                href={getWhatsAppShareUrl(customer, o, settings)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="wa-resi-btn"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  color: '#10b981', background: 'rgba(16,185,129,0.1)',
                                  padding: '2px 6px', borderRadius: 4, fontSize: 10.5,
                                  textDecoration: 'none', fontWeight: 500
                                }}
                                title="Kirim Resi via WhatsApp"
                              >
                                <Phone size={10} /> Kirim Resi
                              </a>
                            )}
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, height: 20 }}
                              onClick={() => setShowShippingLabel(o)}
                              title="Cetak label pengiriman"
                            >
                              <Printer size={9} /> Label
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="order-price">
                        {o.totalBayar ? `Rp ${parseInt(o.totalBayar.replace(/\D/g,''),10).toLocaleString('id-ID')}` : '—'}
                      </div>
                      {/* Cetak / Edit / Delete order */}
                      <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
                        <button
                          className="icon-btn" style={{ width: 26, height: 26, color: 'var(--text-accent)' }}
                          title="Cetak Nota Order" onClick={() => printInvoice(customer, o, settings)}
                        ><Printer size={11} /></button>
                        <button
                          className="icon-btn" style={{ width:26, height:26 }}
                          title="Edit order" onClick={() => setEditingOrder(o)}
                        ><Edit2 size={11} /></button>
                        <button
                          className="icon-btn" style={{ width:26, height:26, color:'var(--accent-red)' }}
                          title="Hapus order" onClick={() => { if (window.confirm('Hapus order ini?')) onDeleteOrder(o.id); }}
                        ><Trash2 size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Methods */}
            {customer.orders.length > 0 && (
              <div className="detail-section">
                <div className="detail-section-title"><CreditCard size={11} style={{ display:'inline', marginRight:4 }} />Payment Methods</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[...new Set(customer.orders.map((o)=>o.paymentVia).filter(Boolean))].map((p)=>(
                    <span key={p} className="badge badge-default">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Customer modal */}
      {showEditCustomer && (
        <CustomerFormModal
          initial={customer}
          onSave={handleSaveCustomer}
          onClose={() => setShowEditCustomer(false)}
        />
      )}

      {/* Add / Edit Order modal */}
      {(showAddOrder || editingOrder) && (
        <OrderFormModal
          customerName={customer.nama}
          initial={editingOrder}
          onSave={handleSaveOrder}
          onClose={() => { setShowAddOrder(false); setEditingOrder(null); }}
        />
      )}

      {/* Shipping Label modal */}
      {showShippingLabel !== undefined && (
        <ShippingLabelModal
          customer={customer}
          order={showShippingLabel}
          onClose={() => setShowShippingLabel(undefined)}
          settings={settings}
        />
      )}
    </>
  );
}
