// src/pages/BirthdayPage.tsx
import { useMemo, useState } from 'react';
import { Gift, Copy, Check, Phone, Instagram, Search, ChevronDown } from 'lucide-react';
import type { Customer } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { calcLoyalty } from '../utils/loyaltyEngine';
import { extractInstagramUsername } from '../utils/socialIntelligenceEngine';
import { parseBirthdayMonth, parseBirthdayDay } from '../utils/birthday';

interface Props {
  customers: Customer[];
  settings?: any;
}

const INDO_MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function BirthdayPage({ customers, settings }: Props) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const today = now.getDate();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const storeName = settings?.storeName || 'Pearl Store';
  const voucherCode = settings?.voucherCode || 'BDAY10';
  const template = settings?.birthdayMessageTemplate ||
    '🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎\n\nSalam hangat,\n💎 {storeName}';

  const allBirthdays = useMemo(() => {
    return customers
      .filter((c) => parseBirthdayMonth(c.tanggalUlangTahun) === selectedMonth)
      .map((c) => {
        const day = parseBirthdayDay(c.tanggalUlangTahun) ?? 0;
        const daysUntil = day - today;
        let status = '';
        if (selectedMonth === currentMonth) {
          if (daysUntil === 0) status = 'today';
          else if (daysUntil === 1) status = 'tomorrow';
          else if (daysUntil > 0) status = 'upcoming';
          else status = 'passed';
        } else {
          status = 'other-month';
        }
        return { customer: c, day, daysUntil, status };
      })
      .sort((a, b) => {
        const order = { today: 0, tomorrow: 1, upcoming: 2, 'other-month': 3, passed: 4 };
        if (order[a.status as keyof typeof order] !== order[b.status as keyof typeof order])
          return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
        return a.day - b.day;
      })
      .filter((item) =>
        !search || item.customer.nama.toLowerCase().includes(search.toLowerCase())
      );
  }, [customers, selectedMonth, today, currentMonth, search]);

  function buildMessage(customer: Customer): string {
    const loyalty = calcLoyalty(customer);
    const vipNote = customer.totalSpend >= (settings?.vipMinSpend || 15000000)
      ? `\n\nSebagai pelanggan VIP kami, dapatkan hadiah spesial dengan kode: *${voucherCode}*` : '';
    return template
      .replace(/{customerName}/g, customer.nama)
      .replace(/{storeName}/g, storeName)
      .replace(/{voucherCode}/g, voucherCode)
      .replace(/{vipNote}/g, vipNote)
      .replace(/{loyaltyTier}/g, loyalty.tier)
      .replace(/{loyaltyPoints}/g, String(loyalty.points));
  }

  function handleCopy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [key]: false })), 2000);
    });
  }

  const statusBadge = (status: string, daysUntil: number) => {
    if (status === 'today') return <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 700, animation: 'pulse 1.5s ease-in-out infinite' }}>🎂 Hari Ini!</span>;
    if (status === 'tomorrow') return <span style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🎉 Besok</span>;
    if (status === 'upcoming') return <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{daysUntil} hari lagi</span>;
    if (status === 'passed') return <span style={{ background: 'rgba(100,116,139,0.12)', color: '#94a3b8', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Lewat {Math.abs(daysUntil)}h</span>;
    return null;
  };

  const todayCount = allBirthdays.filter((b) => b.status === 'today').length;
  const upcomingCount = allBirthdays.filter((b) => b.status === 'upcoming' || b.status === 'tomorrow').length;

  return (
    <div className="page-body">
      {/* Stats bar */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card pink">
          <div className="stat-icon pink"><Gift size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Ulang Tahun Bulan Ini</div>
            <div className="stat-value">{allBirthdays.length}</div>
            <div className="stat-sub">bulan {INDO_MONTHS[selectedMonth - 1]}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><Gift size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Hari Ini</div>
            <div className="stat-value">{todayCount}</div>
            <div className="stat-sub">perlu pesan sekarang</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><Gift size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Akan Datang</div>
            <div className="stat-value">{upcomingCount}</div>
            <div className="stat-sub">dalam bulan ini</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 12px', flex: 1, minWidth: 200 }}>
            <Search size={14} color="var(--text-muted)" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pelanggan…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {INDO_MONTHS.map((m, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i + 1)}
                className={`btn ${selectedMonth === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11, padding: '5px 12px', position: 'relative' }}
              >
                {m.slice(0, 3)}
                {i + 1 === currentMonth && (
                  <span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%', background: '#ef4444', border: '1.5px solid var(--bg-card)' }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {allBirthdays.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎂</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Tidak ada ulang tahun bulan {INDO_MONTHS[selectedMonth - 1]}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Pilih bulan lain untuk melihat daftar ulang tahun pelanggan</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allBirthdays.map(({ customer: c, day, daysUntil, status }) => {
            const loyalty = calcLoyalty(c);
            const isExpanded = expandedId === c.id;
            const igHandle = extractInstagramUsername(c.instagram);
            const message = buildMessage(c);
            const waLink = c.wa ? `https://wa.me/${c.wa.replace(/\D/g, '')}` : null;

            return (
              <div key={c.id} className="card" style={{ border: status === 'today' ? '1px solid rgba(239,68,68,0.4)' : undefined, background: status === 'today' ? 'rgba(239,68,68,0.04)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: status === 'today' ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {status === 'today' ? '🎂' : status === 'tomorrow' ? '🎉' : '🎁'}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.nama}</span>
                      <span style={{ fontSize: 11, color: loyalty.tierColor, fontWeight: 700 }}>{loyalty.tierEmoji} {loyalty.tier}</span>
                      {statusBadge(status, daysUntil)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      🎂 {day} {INDO_MONTHS[selectedMonth - 1]}
                      {igHandle && <span style={{ marginLeft: 10 }}>📸 @{igHandle}</span>}
                      {c.wa && <span style={{ marginLeft: 10 }}>📱 {c.wa}</span>}
                    </div>
                  </div>
                  {/* Spend */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(c.totalSpend)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.orderCount} order</div>
                  </div>
                  <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </div>

                {/* Expanded: message preview */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preview Pesan WhatsApp</div>
                    <div style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {message}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" style={{ fontSize: 12, gap: 6 }} onClick={() => handleCopy(c.id, message)}>
                        {copied[c.id] ? <><Check size={13} /> Tersalin!</> : <><Copy size={13} /> Salin Pesan</>}
                      </button>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={13} /> Buka WA
                        </a>
                      )}
                      {igHandle && (
                        <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Instagram size={13} /> Buka IG
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
