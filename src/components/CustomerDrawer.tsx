// src/components/CustomerDrawer.tsx
import { useState } from 'react';
import { X, Instagram, Phone, MapPin, Calendar, Package, CreditCard, Edit2, Trash2, Plus, Copy, Check, Printer, Star, MessageCircle, Clock } from 'lucide-react';
import type { Customer, CustomerRow, CustomerCRMData } from '../types';
import { saveCustomerCRMState } from '../utils/localStore';
import { formatRupiah, getJenisBadgeClass, getCustomerLabel, resolveImageUrl } from '../utils/csvLoader';
import { printInvoice, printCustomerStatement } from '../utils/printHelper';
import { formatBirthday } from '../utils/birthday';
import CustomerFormModal from './CustomerFormModal';
import OrderFormModal from './OrderFormModal';
import ShippingLabelModal from './ShippingLabelModal';
import { calcLoyalty } from '../utils/loyaltyEngine';
import { extractInstagramUsername, generateInstaLink } from '../utils/socialIntelligenceEngine';
import { generateUpsellRecommendations, generateSmartCopy } from '../utils/aiEngines';
import { Wand2 } from 'lucide-react';
import ChatHistoryViewer from './ChatHistoryViewer';

const isGooglePhotos = (url?: string | null) => {
  if (!url) return false;
  return url.includes('photos.google.com') || url.includes('photos.app.goo.gl');
};

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
  // BUG-ST4 fix: return null if no phone number so caller can disable/hide the button
  if (!customer.wa) return null;
  const phone = customer.wa.replace(/[^0-9]/g, '').replace(/^0/, '62');
  if (!phone) return null;

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

function getWAFollowUpTemplate(customer: Customer, stage: string) {
  if (!customer.wa) return null;
  const phone = customer.wa.replace(/[^0-9]/g, '').replace(/^0/, '62');
  if (!phone) return null;

  const name = customer.nama;
  let text = '';
  switch (stage) {
    case 'new':
      text = `Halo Kak ${name}, terima kasih sudah menghubungi PearlCRM. Ada koleksi mutiara yang sedang dicari?`;
      break;
    case 'qualified':
      text = `Halo Kak ${name}, mutiaranya sudah kami siapkan nih, apakah mau lanjut proses?`;
      break;
    case 'proposition':
      text = `Halo Kak ${name}, ini penawaran untuk mutiara yang kemarin ya. Apakah ada yang kurang pas?`;
      break;
    case 'won':
      text = `Halo Kak ${name}, terima kasih sudah berbelanja. Paket akan segera kami proses dan kirim! 💎`;
      break;
    case 'lost':
      text = `Halo Kak ${name}, maaf jika belum berjodoh kali ini. Jika butuh mutiara lagi, jangan ragu hubungi kami ya!`;
      break;
    default:
      text = `Halo Kak ${name}, ada yang bisa kami bantu hari ini?`;
      break;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function getWhatsAppBirthdayUrl(customer: Customer, settings?: any) {
  const storeName = settings?.storeName || 'Pearl Store';
  const voucherCode = settings?.voucherCode || 'BDAY10';
  const voucherType = settings?.voucherType || 'percent';
  const voucherValue = settings?.voucherValue || 10;
  const vipMinSpend = settings?.vipMinSpend || 15000000;
  const loyalMinOrders = settings?.loyalMinOrders || 3;

  // BUG-ST4 fix: return null if no phone number
  if (!customer.wa) return null;
  const phone = customer.wa.replace(/[^0-9]/g, '').replace(/^0/, '62');
  if (!phone) return null;

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
  const [showAIWriter, setShowAIWriter]             = useState(false);
  const [aiTone, setAiTone]                         = useState<'casual'|'formal'|'empathic'>('casual');
  const [aiContext, setAiContext]                   = useState('Ulang Tahun');
  const customerLabel = getCustomerLabel(customer.totalSpend, customer.orderCount, settings?.vipMinSpend, settings?.loyalMinOrders);

  const colorIdx  = customer.nama.charCodeAt(0) % GRAD_COLORS.length;
  const avgOrder  = customer.orderCount > 0 ? customer.totalSpend / customer.orderCount : 0;
  const loyalty   = calcLoyalty(customer);
  const upsellRecs = generateUpsellRecommendations(customer);

  const typeCount:  Record<string, number> = {};
  const pearlCount: Record<string, number> = {};
  for (const o of customer.orders) {
    if (o.jenis) typeCount[o.jenis]  = (typeCount[o.jenis]  || 0) + 1;
    if (o.type)  pearlCount[o.type]  = (pearlCount[o.type]  || 0) + 1;
  }
  const favType  = Object.entries(typeCount).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—';
  const favPearl = Object.entries(pearlCount).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? '—';

  const [localCrm, setLocalCrm] = useState<Partial<CustomerCRMData>>(customer.crm || { stage: 'new', priority: 0 });

  function updateCrm(patch: Partial<any>) {
    const updated = { ...localCrm, ...patch };
    setLocalCrm(updated);
    saveCustomerCRMState(customer.id, patch);
  }

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
      <div className="modal-overlay odoo-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="odoo-modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="odoo-form-pane">
            <div className="odoo-stages-bar">
              <div className="odoo-priority-stars">
                {[1, 2, 3].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={`star ${(localCrm.priority || 0) >= star ? 'active' : ''}`}
                    fill={(localCrm.priority || 0) >= star ? '#fbbf24' : 'none'}
                    onClick={() => updateCrm({ priority: localCrm.priority === star ? 0 : star })}
                  />
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {['new', 'qualified', 'proposition', 'won', 'lost'].map((s) => (
                <div
                  key={s}
                  className={`odoo-stage ${localCrm.stage === s ? 'active' : ''}`}
                  onClick={() => updateCrm({ stage: s })}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
              ))}
            </div>
            {/* Action Bar (1-Click Follow Up) */}
            <div style={{ display: 'flex', padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              {customer.wa ? (
                <a 
                  href={getWAFollowUpTemplate(customer, localCrm.stage || 'new') || '#'}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ background: '#25D366', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <MessageCircle size={14} /> Kirim WA (Follow Up)
                </a>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nomor WA tidak tersedia</span>
              )}
            </div>
            <div className="customer-drawer" style={{ width: '100%', height: 'auto', border: 'none', background: 'transparent' }}>
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
                        href={getWhatsAppBirthdayUrl(customer, settings) || undefined}
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

            {/* AI Predictive Upselling */}
            <div className="detail-section" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(79,70,229,0.05))', borderColor: 'rgba(124,58,237,0.2)' }}>
              <div className="detail-section-title" style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wand2 size={14} /> AI Recommendations
              </div>
              {upsellRecs.map((rec, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{rec.product}</strong>
                    <span style={{ fontSize: 11, background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{rec.confidence}% Match</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{rec.reason}</div>
                </div>
              ))}
              
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: 8, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', gap: 6 }}
                onClick={() => setShowAIWriter(!showAIWriter)}
              >
                <Wand2 size={14} /> AI Generate Message
              </button>

              {showAIWriter && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="ai-writer-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <select value={aiTone} onChange={e => setAiTone(e.target.value as any)} className="form-control" style={{ flex: 1, fontSize: 12, padding: 6, minWidth: 120 }}>
                      <option value="casual">Santai / Casual</option>
                      <option value="formal">Profesional</option>
                      <option value="empathic">Penuh Empati</option>
                    </select>
                    <select value={aiContext} onChange={e => setAiContext(e.target.value)} className="form-control" style={{ flex: 1, fontSize: 12, padding: 6, minWidth: 120 }}>
                      <option value="Ulang Tahun">Ulang Tahun</option>
                      <option value="Follow-up Order">Follow-up Order</option>
                      <option value="Promo Spesial">Promo Spesial</option>
                    </select>
                  </div>
                  <textarea 
                    readOnly 
                    value={generateSmartCopy(aiContext, aiTone)} 
                    style={{ width: '100%', minHeight: 100, padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', fontSize: 12, color: 'var(--text-primary)', resize: 'vertical' }}
                  />
                  <a
                    href={`https://wa.me/${customer.wa.replace(/[^0-9]/g,'').replace(/^0/,'62')}?text=${encodeURIComponent(generateSmartCopy(aiContext, aiTone))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 8, justifyContent: 'center', background: '#25D366', color: 'white', border: 'none' }}
                  >
                    Kirim via WhatsApp
                  </a>
                </div>
              )}
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
                    <div key={o.id} className="order-item" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      {/* Top Row: Date & Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                        {/* Cetak / Edit / Delete order */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="icon-btn" style={{ width: 26, height: 26, color: 'var(--accent-purple)' }}
                            title="Cetak Invoice Order" onClick={() => printInvoice(customer, o, settings)}
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

                      {/* Middle Row: Details & Price */}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div className="order-type" style={{ flex: 1, fontSize: 11.5, color: 'var(--text-muted)' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{o.type}</strong> {o.size && `· ${o.size}mm`} {o.color && `· ${o.color}`}
                          
                          {o.keterangan && (
                            <div style={{ 
                              fontSize: 10.5, marginTop: 6, color: 'var(--text-secondary)', 
                              padding: '8px 10px', background: 'rgba(0,0,0,0.03)', 
                              borderRadius: 6, border: '1px solid var(--border)',
                              fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.4
                            }}>
                              {o.keterangan.split(' | ').join('\n')}
                            </div>
                          )}

                          {o.resi && (
                            <div style={{ fontSize: 11, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-accent)', flexWrap: 'wrap' }}>
                              <span>
                                Resi: <a href={`https://cekresi.com/?noresi=${o.resi}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 'bold', color: 'var(--accent-blue)', textDecoration: 'underline' }}>{o.resi}</a> {o.kurir && `(${o.kurir})`}
                              </span>
                              {customer.wa && (
                                <a
                                  href={getWhatsAppShareUrl(customer, o, settings) || undefined}
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
                        <div className="order-price" style={{ textAlign: 'right' }}>
                          {o.totalBayar ? `Rp ${parseInt(o.totalBayar.replace(/\D/g,''),10).toLocaleString('id-ID')}` : '—'}
                        </div>
                      </div>

                      {/* Bottom Row: Images */}
                      {(() => {
                        const images: { url: string; isGoogle: boolean; label: string }[] = [];
                        if (o.gambar && o.gambar.trim() && o.gambar !== '-' && o.gambar !== '—') {
                          images.push({ url: o.gambar, isGoogle: isGooglePhotos(o.gambar), label: 'Foto Utama' });
                        }
                        if (o.attachments && Array.isArray(o.attachments)) {
                          o.attachments.forEach((att, attIdx) => {
                            if (att && att.trim()) {
                              images.push({ url: att, isGoogle: isGooglePhotos(att), label: `Lampiran ${attIdx + 1}` });
                            }
                          });
                        }
                        if (images.length === 0) return null;
                        
                        return (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {images.map((img, i) => {
                              const resolved = resolveImageUrl(img.url);
                              return img.isGoogle ? (
                                <a 
                                  key={i} 
                                  href={img.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 6,
                                    border: '1px dashed var(--border)',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 18,
                                    textDecoration: 'none',
                                    transition: 'border-color 0.2s'
                                  }}
                                  title={`${img.label} (Google Photos)`}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                  🖼️
                                </a>
                              ) : (
                                <a key={i} href={resolved} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={resolved} 
                                    alt={`${img.label} ${i}`} 
                                    style={{ 
                                      width: 44, 
                                      height: 44, 
                                      objectFit: 'cover', 
                                      borderRadius: 6, 
                                      border: '1px solid var(--border)',
                                      transition: 'border-color 0.2s',
                                      background: 'var(--bg-tertiary)'
                                    }}
                                    onError={(e) => {
                                      // fallback for broken images
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="%23eee"/><text x="50%" y="50%" fill="%23999" font-size="10" font-family="sans-serif" dominant-baseline="middle" text-anchor="middle">No Img</text></svg>';
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                  />
                                </a>
                              );
                            })}
                          </div>
                        );
                      })()}
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
      
      <div className="odoo-chatter-pane">
        <div style={{ padding: 16, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock size={16} color="var(--text-secondary)" />
            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>Jadwal Follow-Up (Next Activity)</h4>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input 
              type="date" 
              className="input" 
              style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} 
              value={localCrm.nextActivityDate || ''} 
              onChange={(e) => updateCrm({ nextActivityDate: e.target.value })} 
            />
            <select 
              className="input" 
              style={{ flex: 1, padding: '6px 10px', fontSize: 13 }} 
              value={localCrm.nextActivityType || ''} 
              onChange={(e) => updateCrm({ nextActivityType: e.target.value as any })}
            >
              <option value="">- Tipe -</option>
              <option value="Call">📞 Telepon</option>
              <option value="Email">📧 Email</option>
              <option value="To-Do">✅ To-Do</option>
            </select>
          </div>
          <input 
            type="text" 
            className="input" 
            placeholder="Ringkasan (Misal: Tawarkan bundling kalung)" 
            style={{ width: '100%', padding: '6px 10px', fontSize: 13 }} 
            value={localCrm.nextActivitySummary || ''} 
            onChange={(e) => updateCrm({ nextActivitySummary: e.target.value })} 
          />
        </div>
        <ChatHistoryViewer 
          waNumber={customer.wa} 
          customerName={customer.nama}
        />
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
