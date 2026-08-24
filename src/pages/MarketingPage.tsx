// src/pages/MarketingPage.tsx
import { useState, useMemo, useCallback } from 'react';
import {
  Megaphone, Zap, RotateCcw, ShoppingCart,
  Copy, Check, Send, Download, ExternalLink,
  ChevronDown, ChevronRight, Users,
  TrendingUp, Package, MessageSquare, Star,
  Layers, Plus, Trash2
} from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { extractInstagramUsername, generateInstaLink } from '../utils/socialIntelligenceEngine';
import {
  getCustomerSegments,
  getBundleRecommendations,
  getInactiveCustomers,
  generateFlashSaleContent,
  formatRupiah,
  type InactiveLevel,
  type FlashSaleStyle,
} from '../utils/marketingEngine';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  settings?: any;
}

type MarketingTab = 'broadcast' | 'flashsale' | 'reengagement' | 'bundle' | 'rfm';

interface CampaignRecord {
  id: string;
  name: string;
  date: string;
  segmentLabels: string[];
  recipientCount: number;
  templatePreview: string;
}

// ── Utility ──────────────────────────────────────────────────────────────────
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

const INACTIVE_META: Record<InactiveLevel, { label: string; color: string; bg: string; icon: string }> = {
  warning:  { label: 'Perlu Perhatian', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🟡' },
  high:     { label: 'Risiko Tinggi',   color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: '🟠' },
  critical: { label: 'Kritis',          color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '🔴' },
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function MarketingPage({ customers, rows, settings }: Props) {
  const [activeTab, setActiveTab] = useState<MarketingTab>('broadcast');

  const [csNumbers, setCsNumbers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pearlcrm_cs_numbers');
      return saved ? JSON.parse(saved) : [settings?.storePhone || '081234567890'];
    } catch {
      return [settings?.storePhone || '081234567890'];
    }
  });

  const [csFilter, setCsFilter] = useState<string>('all');

  const handleAddCS = (num: string) => {
    const cleanNum = num.replace(/\D/g, '');
    if (cleanNum.length >= 9) {
      const next = [...csNumbers.filter(x => x !== cleanNum), cleanNum];
      setCsNumbers(next);
      localStorage.setItem('pearlcrm_cs_numbers', JSON.stringify(next));
    }
  };

  const handleRemoveCS = (num: string) => {
    const next = csNumbers.filter(x => x !== num);
    setCsNumbers(next);
    localStorage.setItem('pearlcrm_cs_numbers', JSON.stringify(next));
  };

  const getDaysElapsed = useCallback((dateStr: string): number => {
    if (!dateStr) return 999;
    try {
      let date: Date | null = null;
      if (dateStr.includes('/') || dateStr.includes('-')) {
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          } else {
            // DD/MM/YYYY or DD-MM-YYYY
            date = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          }
        }
      }
      if (!date || isNaN(date.getTime())) {
        date = new Date(dateStr);
      }
      if (isNaN(date.getTime())) return 999;
      const diffTime = Math.abs(Date.now() - date.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }, []);

  const rfmGroups = useMemo(() => {
    const vipThreshold = settings?.vipMinSpend || 15000000;
    const loyalThreshold = settings?.loyalMinOrders || 3;
    
    const groups = {
      champions: {
        id: 'champions',
        label: '🏆 Champions (VIP & Loyal Aktif)',
        desc: 'Belanja besar & baru-baru ini melakukan transaksi. Pertahankan hubungan dengan reward khusus!',
        color: 'var(--rfm-champions-color)',
        bg: 'var(--rfm-champions-bg)',
        border: 'var(--rfm-champions-border)',
        customers: [] as Customer[],
      },
      atRisk: {
        id: 'atRisk',
        label: '⚠️ At Risk (VIP/Loyal Inaktif)',
        desc: 'Pernah belanja besar tapi sudah lama tidak bertransaksi. Butuh re-engagement hangat!',
        color: 'var(--rfm-atrisk-color)',
        bg: 'var(--rfm-atrisk-bg)',
        border: 'var(--rfm-atrisk-border)',
        customers: [] as Customer[],
      },
      newRecent: {
        id: 'newRecent',
        label: '🌱 New & Rising (Belanja Baru)',
        desc: 'Baru bertransaksi dengan nominal kecil. Berikan diskon produk pelengkap (upsell)!',
        color: 'var(--rfm-newrecent-color)',
        bg: 'var(--rfm-newrecent-bg)',
        border: 'var(--rfm-newrecent-border)',
        customers: [] as Customer[],
      },
      cold: {
        id: 'cold',
        label: '❄️ Cold / Dormant (Pelanggan Dingin)',
        desc: 'Belanja kecil & sudah lama tidak aktif. Kirimkan voucher kejutan promo cuci gudang!',
        color: 'var(--rfm-cold-color)',
        bg: 'var(--rfm-cold-bg)',
        border: 'var(--rfm-cold-border)',
        customers: [] as Customer[],
      }
    };
    
    for (const c of customers) {
      const days = getDaysElapsed(c.lastOrder);
      const isHighValue = c.totalSpend >= vipThreshold || c.orderCount >= loyalThreshold;
      const isRecent = days <= 120;
      
      if (isHighValue && isRecent) {
        groups.champions.customers.push(c);
      } else if (isHighValue && !isRecent) {
        groups.atRisk.customers.push(c);
      } else if (!isHighValue && isRecent) {
        groups.newRecent.customers.push(c);
      } else {
        groups.cold.customers.push(c);
      }
    }
    
    return groups;
  }, [customers, settings, getDaysElapsed]);

  const [selectedRfmGroup, setSelectedRfmGroup] = useState<string | null>(null);

  // ── Broadcast State ─────────────────────────────────────────────────────────
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [broadcastTemplate, setBroadcastTemplate] = useState(
    'Halo Kak {customerName}! 💎\n\n{storeName} punya koleksi terbaru nih yang cantik-cantik banget ✨\n\nYuk intip katalog kami sekarang, mumpung lagi ada promo spesial buat Kakak! 💕\n\nSalam hangat,\n💎 {storeName}'
  );
  const [showContacts, setShowContacts] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignHistory, setCampaignHistory] = useState<CampaignRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('pearlcrm_campaigns') || '[]'); } catch { return []; }
  });
  const [generatedLinks, setGeneratedLinks] = useState<{ name: string; wa: string; link: string; csAssigned: string }[]>([]);
  const [showLinks, setShowLinks] = useState(false);
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  // ── Flash Sale State ─────────────────────────────────────────────────────────
  const [fsProduct, setFsProduct] = useState('');
  const [fsDiscountType, setFsDiscountType] = useState<'percent' | 'flat'>('percent');
  const [fsDiscountValue, setFsDiscountValue] = useState('');
  const [fsTimeLimit, setFsTimeLimit] = useState('24 jam');
  const [fsStyle, setFsStyle] = useState<FlashSaleStyle>('luxury');
  const [fsGenerated, setFsGenerated] = useState(false);
  const [fsContent, setFsContent] = useState<{ waBroadcast: string; igCaption: string; igStory: string } | null>(null);

  // ── Re-engagement State ───────────────────────────────────────────────────────
  const [inactiveFilter, setInactiveFilter] = useState<'all' | InactiveLevel>('all');
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);

  // ── Computed Data ────────────────────────────────────────────────────────────
  const segments = useMemo(() => getCustomerSegments(customers, settings), [customers, settings]);
  const bundles = useMemo(() => getBundleRecommendations(rows), [rows]);
  const inactiveCustomers = useMemo(() => getInactiveCustomers(customers, rows, settings), [customers, rows, settings]);

  const selectedCustomers = useMemo(() => {
    if (selectedSegmentIds.length === 0) return [];
    const seen = new Set<string>();
    const result: Customer[] = [];
    for (const segId of selectedSegmentIds) {
      const seg = segments.find((s) => s.id === segId);
      if (!seg) continue;
      for (const c of seg.customers) {
        if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
      }
    }
    return result;
  }, [selectedSegmentIds, segments]);

  const storeName = settings?.storeName || 'Pearl Store';

  // ── Broadcast Handlers ───────────────────────────────────────────────────────
  const toggleSegment = useCallback((id: string) => {
    setSelectedSegmentIds((prev: string[]) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const previewMessage = useMemo(() => {
    return broadcastTemplate
      .replace(/{customerName}/g, 'Nama Pelanggan')
      .replace(/{storeName}/g, storeName)
      .replace(/{vipNote}/g, '\n\n🎁 Sebagai pelanggan VIP, dapatkan voucher BDAY10 untuk diskon 10%!');
  }, [broadcastTemplate, storeName]);

  function handleGenerateLinks() {
    const csList = csNumbers.length > 0 ? csNumbers : [settings?.storePhone || '081234567890'];
    const links = selectedCustomers
      .filter((c) => c.wa)
      .map((c, index) => {
        const csAssigned = csList[index % csList.length];
        const msg = broadcastTemplate
          .replace(/{customerName}/g, c.nama)
          .replace(/{storeName}/g, storeName)
          .replace(/{vipNote}/g, '');
        return { 
          name: c.nama, 
          wa: c.wa, 
          csAssigned,
          link: `https://wa.me/${c.wa.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` 
        };
      });
    setGeneratedLinks(links);
    setCsFilter('all');
    setShowLinks(true);
  }

  function handleSaveCampaign() {
    if (!campaignName.trim()) return;
    const segLabels = selectedSegmentIds.map((id) => segments.find((s) => s.id === id)?.label || id);
    const record: CampaignRecord = {
      id: `campaign-${Date.now()}`,
      name: campaignName,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      segmentLabels: segLabels,
      recipientCount: selectedCustomers.length,
      templatePreview: broadcastTemplate.slice(0, 80) + '...',
    };
    const updated = [record, ...campaignHistory].slice(0, 20);
    setCampaignHistory(updated);
    localStorage.setItem('pearlcrm_campaigns', JSON.stringify(updated));
    setCampaignName('');
    handleCopy('campaign-saved', '✅ Campaign tersimpan!');
  }

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied((prev: Record<string, boolean>) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev: Record<string, boolean>) => ({ ...prev, [key]: false })), 2000);
    }
  }

  function handleGenerateFlashSale() {
    if (!fsProduct.trim() || !fsDiscountValue) return;
    const content = generateFlashSaleContent({
      productName: fsProduct,
      discountType: fsDiscountType,
      discountValue: Number(fsDiscountValue.replace(/\D/g, '')),
      timeLimit: fsTimeLimit,
      style: fsStyle,
      storeName,
      storeInstagram: settings?.storeInstagram || 'pearlstore',
    });
    setFsContent(content);
    setFsGenerated(true);
  }

  // ── Tab Navigation ───────────────────────────────────────────────────────────
  const TABS: { id: MarketingTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'broadcast',    label: 'Broadcast Manager',   icon: <Megaphone size={15} />,   badge: customers.length },
    { id: 'flashsale',   label: 'Flash Sale Generator', icon: <Zap size={15} /> },
    { id: 'reengagement',label: 'Re-engagement',        icon: <RotateCcw size={15} />,   badge: inactiveCustomers.length },
    { id: 'bundle',      label: 'Bundle & Upsell',      icon: <ShoppingCart size={15} />, badge: bundles.length },
    { id: 'rfm',         label: 'Matriks RFM',         icon: <Layers size={15} /> },
  ];

  const inactiveCounts = useMemo(() => ({
    warning:  inactiveCustomers.filter((x) => x.level === 'warning').length,
    high:     inactiveCustomers.filter((x) => x.level === 'high').length,
    critical: inactiveCustomers.filter((x) => x.level === 'critical').length,
  }), [inactiveCustomers]);

  const filteredInactive = inactiveFilter === 'all'
    ? inactiveCustomers
    : inactiveCustomers.filter((x) => x.level === inactiveFilter);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-body">
        {/* ── Tab Navigator ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                borderRadius: '10px 10px 0 0',
                background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
                borderBottom: activeTab === tab.id ? '2px solid #7c3aed' : '1px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                transition: 'all 0.18s',
                fontFamily: 'Inter, sans-serif',
                marginBottom: -1,
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{ background: activeTab === tab.id ? '#7c3aed' : 'var(--bg-card)', color: activeTab === tab.id ? 'white' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99 }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1 — BROADCAST MANAGER
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'broadcast' && (
          <div className="marketing-grid">

            {/* Left Column: Target Pelanggan & WhatsApp Rotator */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Left: Segment Selector */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">🎯 Target Pelanggan</div>
                    <div className="card-subtitle">{selectedCustomers.length} pelanggan dipilih</div>
                  </div>
                  {selectedSegmentIds.length > 0 && (
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setSelectedSegmentIds([])}>
                      Reset
                    </button>
                  )}
                </div>
                <div className="card-body" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {segments.map((seg) => {
                      const isSelected = selectedSegmentIds.includes(seg.id);
                      return (
                        <button
                          key={seg.id}
                          onClick={() => toggleSegment(seg.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                            background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--bg-card)',
                            border: isSelected ? '1px solid rgba(124,58,237,0.25)' : '1px solid var(--border)',
                            textAlign: 'left', width: '100%', transition: 'all 0.18s',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{seg.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {seg.label}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{seg.description}</div>
                          </div>
                          <span style={{ background: seg.color, color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                            {seg.customers.length}
                          </span>
                          {isSelected && <Check size={14} color={seg.color} />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Contact Preview */}
                  {selectedCustomers.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <button
                        onClick={() => setShowContacts(!showContacts)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif', padding: 0 }}
                      >
                        {showContacts ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        Lihat {selectedCustomers.length} kontak
                      </button>
                      {showContacts && (
                        <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                          {selectedCustomers.map((c) => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                {c.nama[0]?.toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nama}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.wa || '—'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CS Rotator Settings Card */}
              <div className="card">
                <div className="card-header" style={{ padding: '12px 16px' }}>
                  <div>
                    <div className="card-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Megaphone size={14} style={{ color: '#8b5cf6' }} /> Pembagian CS (WhatsApp Rotator)</div>
                    <div className="card-subtitle" style={{ fontSize: 10.5 }}>Daftarkan beberapa nomor WA CS Anda</div>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        id="new-cs-input"
                        placeholder="Contoh: 081234567890"
                        style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '7px 10px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              handleAddCS(val);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0 10px', height: 32, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => {
                          const input = document.getElementById('new-cs-input') as HTMLInputElement;
                          if (input && input.value.trim()) {
                            handleAddCS(input.value.trim());
                            input.value = '';
                          }
                        }}
                      >
                        <Plus size={12} /> Tambah
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, maxHeight: 160, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                      {csNumbers.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>Belum ada nomor CS terdaftar</div>
                      ) : (
                        csNumbers.map((num, idx) => (
                          <div key={num} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>CS {idx + 1}: <strong style={{ color: 'var(--text-primary)' }}>{num}</strong></span>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 2 }}
                              onClick={() => handleRemoveCS(num)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Template + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">✍️ Template Pesan</div>
                    <div className="card-subtitle">Gunakan token untuk personalisasi</div>
                  </div>
                </div>
                <div className="card-body">
                  {/* Token chips */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    {['{customerName}', '{storeName}', '{vipNote}'].map((token) => (
                      <button
                        key={token}
                        onClick={() => setBroadcastTemplate((prev: string) => prev + token)}
                        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa', fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                      >
                        {token}
                      </button>
                    ))}
                    <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
                    <button
                      onClick={() => setBroadcastTemplate('Halo Kak {customerName}! 💎\n\n{storeName} punya koleksi terbaru nih yang cantik-cantik banget ✨\n\nYuk intip katalog kami sekarang, mumpung lagi ada promo spesial buat Kakak! 💕\n\nSalam hangat,\n💎 {storeName}')}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      Promo Baru
                    </button>
                    <button
                      onClick={() => setBroadcastTemplate(settings?.birthdayMessageTemplate || 'Selamat Ulang Tahun Kak {customerName}! 🎂🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨\n\n🎁 Sebagai kado kecil dari kami, dapatkan tambahan diskon 10% untuk pembelian perhiasan impian Kakak hari ini.\n\nSalam hangat,\n💎 {storeName}')}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      Ulang Tahun
                    </button>
                    <button
                      onClick={() => setBroadcastTemplate('Halo Kak {customerName}! 💎\n\nTerima kasih ya Kak sudah menjadi salah satu pelanggan kesayangan {storeName} 🥰\n\nSebagai tanda terima kasih, Kakak berhak mendapatkan penawaran eksklusif ini:\n{vipNote}\n\nJangan sampai terlewat ya Kak! 💕\n\nSalam hangat,\n💎 {storeName}')}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      Sapaan VIP
                    </button>
                  </div>
                  <textarea
                    value={broadcastTemplate}
                    onChange={(e) => setBroadcastTemplate(e.target.value)}
                    rows={7}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, padding: '10px 14px', resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, boxSizing: 'border-box' }}
                    placeholder="Tulis template pesan broadcast..."
                  />
                  <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>👁️ Preview</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{previewMessage}</div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="card">
                <div className="card-body" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Nama campaign (opsional)..."
                      style={{ flex: 1, minWidth: 160, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12.5, padding: '7px 12px', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={handleSaveCampaign}
                      disabled={selectedCustomers.length === 0}
                    >
                      <Star size={13} /> Simpan Campaign
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12 }}
                      onClick={handleGenerateLinks}
                      disabled={selectedCustomers.length === 0}
                    >
                      <Send size={13} /> Generate {selectedCustomers.length} Link WA
                    </button>
                  </div>

                  {selectedCustomers.length === 0 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                      ← Pilih minimal satu segmen pelanggan untuk memulai
                    </div>
                  )}
                </div>
              </div>

              {/* Generated WA Links */}
              {showLinks && generatedLinks.length > 0 && (
                <div className="card">
                  <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div className="card-title">📱 Link WA Siap Kirim</div>
                      <div className="card-subtitle">{generatedLinks.length} link berhasil dibuat</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className="filter-select"
                        value={csFilter}
                        onChange={(e) => setCsFilter(e.target.value)}
                        style={{ fontSize: 11.5, padding: '4px 28px 4px 10px', height: 30 }}
                      >
                        <option value="all">Semua CS</option>
                        {csNumbers.map((num, idx) => (
                          <option key={num} value={num}>CS {idx + 1} ({num})</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, height: 30, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => {
                          const listToCopy = generatedLinks.filter(l => csFilter === 'all' || l.csAssigned === csFilter);
                          handleCopy('all-links', listToCopy.map((l) => `${l.name}: ${l.link}`).join('\n\n'));
                        }}
                      >
                        {copied['all-links'] ? <Check size={12} /> : <Copy size={12} />}
                        {copied['all-links'] ? 'Tersalin!' : 'Salin Terfilter'}
                      </button>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: '8px 14px', maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                    {generatedLinks
                      .filter(l => csFilter === 'all' || l.csAssigned === csFilter)
                      .map((link, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 700, flexShrink: 0 }}>
                            {link.name[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{link.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(124,58,237,0.12)', color: '#a78bfa', padding: '1px 6px', borderRadius: 4 }}>
                                CS {csNumbers.indexOf(link.csAssigned) !== -1 ? csNumbers.indexOf(link.csAssigned) + 1 : '1'}
                              </span>
                            </div>
                            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{link.wa} | CS: {link.csAssigned}</div>
                          </div>
                          <a href={link.link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', color: '#22c55e', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                            <ExternalLink size={10} /> Buka
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Campaign History */}
              {campaignHistory.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">📋 Riwayat Campaign</div>
                  </div>
                  <div className="card-body" style={{ padding: '8px 14px' }}>
                    {campaignHistory.slice(0, 5).map((c) => (
                      <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.date}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}><Users size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {c.recipientCount} penerima</span>
                          {c.segmentLabels.map((s) => (
                            <span key={s} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 10, padding: '1px 7px', borderRadius: 99, color: 'var(--text-muted)' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2 — FLASH SALE GENERATOR
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'flashsale' && (
          <div className="marketing-grid-flash">

            {/* Form */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">⚡ Buat Promo Flash Sale</div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Product */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Nama Produk / Koleksi</label>
                  <input className="form-input" value={fsProduct} onChange={(e) => setFsProduct(e.target.value)} placeholder="Contoh: Kalung Mutiara Southsea" />
                </div>
                {/* Discount */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Jenis & Nilai Diskon</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="form-input filter-select" value={fsDiscountType} onChange={(e) => setFsDiscountType(e.target.value as 'percent' | 'flat')} style={{ width: 100, flexShrink: 0 }}>
                      <option value="percent">Persen (%)</option>
                      <option value="flat">Nominal (Rp)</option>
                    </select>
                    <input
                      className="form-input"
                      value={fsDiscountValue}
                      onChange={(e) => setFsDiscountValue(e.target.value)}
                      placeholder={fsDiscountType === 'percent' ? 'Contoh: 20' : 'Contoh: 500000'}
                      type="text"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                {/* Time Limit */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Batas Waktu</label>
                  <select className="form-input filter-select" value={fsTimeLimit} onChange={(e) => setFsTimeLimit(e.target.value)}>
                    {['6 jam', '12 jam', '24 jam', '2 hari', '3 hari', '7 hari', 'Hari ini saja', 'Weekend ini'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {/* Style */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Gaya Bahasa</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {([
                      { id: 'luxury', label: '💎 Luxury', desc: 'Elegan & eksklusif' },
                      { id: 'casual', label: '🌟 Casual', desc: 'Santai & akrab' },
                      { id: 'formal', label: '📢 Formal', desc: 'Profesional' },
                      { id: 'trendy', label: '⚡ Trendy', desc: 'Kekinian & gaul' },
                    ] as const).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setFsStyle(s.id as FlashSaleStyle)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${fsStyle === s.id ? '#7c3aed' : 'var(--border)'}`, background: fsStyle === s.id ? 'rgba(124,58,237,0.12)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: fsStyle === s.id ? '#a78bfa' : 'var(--text-primary)' }}>{s.label}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                  onClick={handleGenerateFlashSale}
                  disabled={!fsProduct.trim() || !fsDiscountValue}
                >
                  <Zap size={14} /> Generate Konten Promo
                </button>
              </div>
            </div>

            {/* Generated Content */}
            {fsGenerated && fsContent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { key: 'waBroadcast', label: '💬 WhatsApp Broadcast', icon: '📱', color: '#25D366', content: fsContent.waBroadcast },
                  { key: 'igCaption',   label: '📸 Instagram Caption',  icon: '📷', color: '#e1306c', content: fsContent.igCaption },
                  { key: 'igStory',     label: '📖 Instagram Story',    icon: '🔖', color: '#f77737', content: fsContent.igStory },
                ] as const).map(({ key, label, icon, color, content }) => (
                  <div className="card" key={key}>
                    <div className="card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <div className="card-title" style={{ color }}>{label}</div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 11, gap: 5 }}
                        onClick={() => handleCopy(key, content)}
                      >
                        {copied[key] ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        {copied[key] ? 'Tersalin!' : 'Salin Teks'}
                      </button>
                    </div>
                    <div className="card-body">
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, fontFamily: 'Inter, sans-serif', background: 'var(--bg-card)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {content}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--text-muted)', gap: 12 }}>
                <div style={{ fontSize: 48 }}>⚡</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Konten promo akan muncul di sini</div>
                <div style={{ fontSize: 13 }}>Isi form dan klik "Generate" untuk membuat konten siap pakai</div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3 — RE-ENGAGEMENT ENGINE
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'reengagement' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Summary Stats */}
            <div className="grid-3-col" style={{ gap: 14 }}>
              {(Object.entries(INACTIVE_META) as [InactiveLevel, typeof INACTIVE_META[InactiveLevel]][]).map(([level, meta]) => (
                <button
                  key={level}
                  onClick={() => setInactiveFilter(inactiveFilter === level ? 'all' : level)}
                  style={{ background: inactiveFilter === level ? meta.bg : 'var(--bg-secondary)', border: `2px solid ${inactiveFilter === level ? meta.color : 'var(--border)'}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}
                >
                  <div style={{ fontSize: 22 }}>{meta.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: meta.color, letterSpacing: '-0.5px', marginTop: 6 }}>
                    {inactiveCounts[level]}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{meta.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {level === 'warning' ? '90–120 hari' : level === 'high' ? '120–180 hari' : '180+ hari'}
                  </div>
                </button>
              ))}
            </div>

            {/* Export Action */}
            {inactiveCustomers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{filteredInactive.length}</span> pelanggan tidak aktif{inactiveFilter !== 'all' ? ` (${INACTIVE_META[inactiveFilter].label})` : ''}
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12 }}
                  onClick={() => handleCopy('export-wa', filteredInactive.filter((x) => x.customer.wa).map((x) => `${x.customer.nama}: wa.me/${x.customer.wa.replace(/\D/g, '')}`).join('\n'))}
                >
                  {copied['export-wa'] ? <Check size={12} /> : <Download size={12} />}
                  {copied['export-wa'] ? 'Tersalin!' : 'Export Nomor WA'}
                </button>
              </div>
            )}

            {/* Customer List */}
            {filteredInactive.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Tidak ada pelanggan tidak aktif</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Semua pelanggan masih aktif bertransaksi</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredInactive.map((item) => {
                  const meta = INACTIVE_META[item.level];
                  const isExpanded = expandedMsg === item.customer.id;
                  return (
                    <div key={item.customer.id} className="card" style={{ borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Avatar */}
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: meta.bg, border: `2px solid ${meta.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: meta.color, flexShrink: 0 }}>
                            {item.customer.nama[0]?.toUpperCase()}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.customer.nama}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}44` }}>
                                {meta.icon} {meta.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <span>⏰ {item.daysInactive} hari tidak aktif</span>
                              <span>📦 Terakhir: {item.lastProduct}</span>
                              <span>📅 {item.lastOrderDate}</span>
                              <span>💰 {formatRupiah(item.customer.totalSpend)}</span>
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => setExpandedMsg(isExpanded ? null : item.customer.id)}
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif' }}
                            >
                              <MessageSquare size={11} /> Pesan
                            </button>
                            {item.customer.wa && (
                              <a
                                href={`https://wa.me/${item.customer.wa.replace(/\D/g, '')}?text=${encodeURIComponent(item.suggestedMessage)}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#22c55e', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Send size={11} /> Kirim WA
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Expanded message */}
                        {isExpanded && (
                          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saran Pesan</div>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: 10.5, padding: '3px 8px' }}
                                onClick={() => handleCopy(`msg-${item.customer.id}`, item.suggestedMessage)}
                              >
                                {copied[`msg-${item.customer.id}`] ? <Check size={10} /> : <Copy size={10} />}
                                {copied[`msg-${item.customer.id}`] ? 'Tersalin' : 'Salin'}
                              </button>
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                              {item.suggestedMessage}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4 — BUNDLE & UPSELL SUGGESTOR
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'bundle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header Stats */}
            <div className="grid-3-col" style={{ gap: 14 }}>
              <div className="stat-card purple">
                <div className="stat-icon purple"><Package size={18} /></div>
                <div className="stat-info">
                  <div className="stat-label">Bundle Ditemukan</div>
                  <div className="stat-value">{bundles.length}</div>
                  <div className="stat-sub">Dari analisis historis order</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green"><TrendingUp size={18} /></div>
                <div className="stat-info">
                  <div className="stat-label">Avg Confidence</div>
                  <div className="stat-value">
                    {bundles.length > 0 ? Math.round(bundles.reduce((s, b) => s + b.confidence, 0) / bundles.length) : 0}%
                  </div>
                  <div className="stat-sub">Tingkat akurasi rekomendasi</div>
                </div>
              </div>
              <div className="stat-card amber">
                <div className="stat-icon amber"><Star size={18} /></div>
                <div className="stat-info">
                  <div className="stat-label">Potensi Revenue Tambahan</div>
                  <div className="stat-value" style={{ fontSize: 15 }}>
                    {formatRupiah(bundles.reduce((s, b) => s + b.estimatedUplift, 0))}
                  </div>
                  <div className="stat-sub">Estimasi dari semua bundle</div>
                </div>
              </div>
            </div>

            {bundles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Belum cukup data untuk analisis bundle</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Diperlukan minimal beberapa pelanggan yang membeli lebih dari satu jenis produk</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {bundles.map((bundle, i) => {
                  const upsellMsg = `Halo Kak {customerName}! 💎\n\nTerima kasih sudah membeli *${bundle.product1}* dari ${storeName}! 🥰\n\nFYI, banyak pelanggan setia kami yang juga menyukai *${bundle.product2}* sebagai padanan yang sempurna! Keduanya akan terlihat sangat cantik dipakai bersamaan ✨\n\nMau intip koleksi ${bundle.product2} kami? Ada penawaran spesial untuk Kakak! 💕`;
                  const msgKey = `bundle-${i}`;
                  return (
                    <div key={i} className="card">
                      <div className="card-body">
                        {/* Bundle pair */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                          <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: '#a78bfa' }}>
                            {bundle.product1}
                          </div>
                          <div style={{ fontSize: 18, color: 'var(--text-muted)', flexShrink: 0 }}>+</div>
                          <div style={{ flex: 1, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: '#10b981' }}>
                            {bundle.product2}
                          </div>
                        </div>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{bundle.count}</span> pelanggan membeli keduanya
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Potensi: <span style={{ fontWeight: 700, color: '#10b981' }}>{formatRupiah(bundle.estimatedUplift)}</span>
                          </div>
                        </div>
                        {/* Confidence bar */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                            <span>Confidence Score</span>
                            <span style={{ fontWeight: 700, color: bundle.confidence >= 50 ? '#10b981' : bundle.confidence >= 25 ? '#f59e0b' : '#94a3b8' }}>{bundle.confidence}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div style={{ height: '100%', width: `${bundle.confidence}%`, background: bundle.confidence >= 50 ? 'linear-gradient(90deg,#059669,#10b981)' : bundle.confidence >= 25 ? 'linear-gradient(90deg,#d97706,#f59e0b)' : 'linear-gradient(90deg,#4f46e5,#7c3aed)', borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                          </div>
                        </div>
                        {/* Customers */}
                        {bundle.customerNames.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                            Contoh: {bundle.customerNames.join(', ')}{bundle.customerNames.length >= 5 ? ', ...' : ''}
                          </div>
                        )}
                        {/* Copy upsell message */}
                        <button
                          className="btn btn-secondary"
                          style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                          onClick={() => handleCopy(msgKey, upsellMsg)}
                        >
                          {copied[msgKey] ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          {copied[msgKey] ? 'Tersalin!' : 'Salin Pesan Upsell'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 5 — RFM MATRIX SEGMENTATION
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'rfm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Explanatory Header */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>📊 Pemetaan Pelanggan berbasis Matriks RFM</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Matriks RFM mengklasifikasikan database pelanggan Anda berdasarkan **Recency** (Kesegaran transaksi terakhir) dan **Monetary** (Total nilai belanja).
                Batas pengelompokan menggunakan nilai VIP Spend (Rp {(settings?.vipMinSpend || 15000000).toLocaleString('id-ID')}) dan batas waktu aktif 120 hari terakhir.
              </div>
            </div>

            {/* The 2x2 Grid Matrix */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Champions */}
              <div className="card" style={{ background: rfmGroups.champions.bg, border: `1px solid ${rfmGroups.champions.border}` }}>
                <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="card-title" style={{ color: rfmGroups.champions.color }}>{rfmGroups.champions.label}</div>
                    <div className="card-subtitle" style={{ fontSize: 11, marginTop: 4 }}>{rfmGroups.champions.desc}</div>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jumlah Pelanggan:</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{rfmGroups.champions.customers.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setSelectedRfmGroup(selectedRfmGroup === 'champions' ? null : 'champions')}>
                      {selectedRfmGroup === 'champions' ? 'Tutup Detail' : 'Lihat Detail'}
                    </button>
                    <button
                      className="btn btn-primary btn-rfm-champions"
                      style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => handleCopy('champions-wa', rfmGroups.champions.customers.filter(c => c.wa).map(c => c.wa).join('\n'))}
                      disabled={rfmGroups.champions.customers.length === 0}
                    >
                      {copied['champions-wa'] ? 'Tersalin!' : 'Salin Semua WA'}
                    </button>
                  </div>
                </div>
              </div>

              {/* At Risk */}
              <div className="card" style={{ background: rfmGroups.atRisk.bg, border: `1px solid ${rfmGroups.atRisk.border}` }}>
                <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="card-title" style={{ color: rfmGroups.atRisk.color }}>{rfmGroups.atRisk.label}</div>
                    <div className="card-subtitle" style={{ fontSize: 11, marginTop: 4 }}>{rfmGroups.atRisk.desc}</div>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jumlah Pelanggan:</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{rfmGroups.atRisk.customers.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setSelectedRfmGroup(selectedRfmGroup === 'atRisk' ? null : 'atRisk')}>
                      {selectedRfmGroup === 'atRisk' ? 'Tutup Detail' : 'Lihat Detail'}
                    </button>
                    <button
                      className="btn btn-primary btn-rfm-atrisk"
                      style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => handleCopy('atrisk-wa', rfmGroups.atRisk.customers.filter(c => c.wa).map(c => c.wa).join('\n'))}
                      disabled={rfmGroups.atRisk.customers.length === 0}
                    >
                      {copied['atrisk-wa'] ? 'Tersalin!' : 'Salin Semua WA'}
                    </button>
                  </div>
                </div>
              </div>

              {/* New & Rising */}
              <div className="card" style={{ background: rfmGroups.newRecent.bg, border: `1px solid ${rfmGroups.newRecent.border}` }}>
                <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="card-title" style={{ color: rfmGroups.newRecent.color }}>{rfmGroups.newRecent.label}</div>
                    <div className="card-subtitle" style={{ fontSize: 11, marginTop: 4 }}>{rfmGroups.newRecent.desc}</div>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jumlah Pelanggan:</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{rfmGroups.newRecent.customers.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setSelectedRfmGroup(selectedRfmGroup === 'newRecent' ? null : 'newRecent')}>
                      {selectedRfmGroup === 'newRecent' ? 'Tutup Detail' : 'Lihat Detail'}
                    </button>
                    <button
                      className="btn btn-primary btn-rfm-newrecent"
                      style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => handleCopy('newrecent-wa', rfmGroups.newRecent.customers.filter(c => c.wa).map(c => c.wa).join('\n'))}
                      disabled={rfmGroups.newRecent.customers.length === 0}
                    >
                      {copied['newrecent-wa'] ? 'Tersalin!' : 'Salin Semua WA'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cold / Dormant */}
              <div className="card" style={{ background: rfmGroups.cold.bg, border: `1px solid ${rfmGroups.cold.border}` }}>
                <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <div className="card-title" style={{ color: rfmGroups.cold.color }}>{rfmGroups.cold.label}</div>
                    <div className="card-subtitle" style={{ fontSize: 11, marginTop: 4 }}>{rfmGroups.cold.desc}</div>
                  </div>
                </div>
                <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Jumlah Pelanggan:</span>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{rfmGroups.cold.customers.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => setSelectedRfmGroup(selectedRfmGroup === 'cold' ? null : 'cold')}>
                      {selectedRfmGroup === 'cold' ? 'Tutup Detail' : 'Lihat Detail'}
                    </button>
                    <button
                      className="btn btn-primary btn-rfm-cold"
                      style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => handleCopy('cold-wa', rfmGroups.cold.customers.filter(c => c.wa).map(c => c.wa).join('\n'))}
                      disabled={rfmGroups.cold.customers.length === 0}
                    >
                      {copied['cold-wa'] ? 'Tersalin!' : 'Salin Semua WA'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected RFM Group Detail List */}
            {selectedRfmGroup && (
              <div className="card" style={{ borderLeft: `4px solid ${rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].color}` }}>
                <div className="card-header">
                  <div className="card-title">👥 Daftar Pelanggan - {rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].label.split('(')[0]}</div>
                  <span className="result-count">{rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].customers.length} orang</span>
                </div>
                <div className="card-body" style={{ padding: '10px 14px' }}>
                  {/* Desktop: table */}
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nama Pelanggan</th>
                          <th>Instagram</th>
                          <th>WhatsApp</th>
                          <th>Total Belanja</th>
                          <th>Transaksi Terakhir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].customers.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>Tidak ada pelanggan di klaster ini</td>
                          </tr>
                        ) : (
                          rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].customers.map((c) => (
                            <tr key={c.id}>
                              <td className="td-name">{c.nama}</td>
                              <td>
                                {(() => {
                                  const igHandle = extractInstagramUsername(c.instagram);
                                  const igUrl = generateInstaLink(c.instagram, c.nama);
                                  return igHandle ? (
                                    <a
                                      href={igUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: 'var(--accent-purple)',
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                      onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                    >
                                      @{igHandle}
                                      <ExternalLink size={10} style={{ opacity: 0.6 }} />
                                    </a>
                                  ) : '—';
                                })()}
                              </td>
                              <td>{c.wa || '—'}</td>
                              <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(c.totalSpend)}</td>
                              <td>{c.lastOrder || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile: cards */}
                  <div className="mobile-card-list">
                    {rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].customers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>Tidak ada pelanggan di klaster ini</div>
                    ) : (
                      rfmGroups[selectedRfmGroup as keyof typeof rfmGroups].customers.map((c) => {
                        const igHandle = extractInstagramUsername(c.instagram);
                        const igUrl = generateInstaLink(c.instagram, c.nama);
                        return (
                          <div key={c.id} className="inv-card">
                            <div className="inv-card-header">
                              <div className="inv-card-title">{c.nama}</div>
                            </div>
                            <div className="inv-card-body">
                              <div className="inv-detail-row">
                                <span>Total Belanja:</span>
                                <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatRupiah(c.totalSpend)}</span>
                              </div>
                              <div className="inv-detail-row">
                                <span>Instagram:</span>
                                <span>
                                  {igHandle ? (
                                    <a href={igUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>@{igHandle}</a>
                                  ) : '—'}
                                </span>
                              </div>
                              <div className="inv-detail-row">
                                <span>WhatsApp:</span>
                                <span>{c.wa || '—'}</span>
                              </div>
                              <div className="inv-detail-row">
                                <span>Trx Terakhir:</span>
                                <span>{c.lastOrder || '—'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

