import { useState, useEffect, useMemo } from 'react';
import {
  Globe, Send, Check, ExternalLink,
  Plane, Award, HeartHandshake, Gift, ShieldAlert,
  Copy, RefreshCw, Trash2, Settings,
  Calendar, ChevronLeft, ChevronRight, User
} from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import {
  scanSocialFeeds,
  generateInstaLink,
  generateSuggestedMessage,
  logSocialEvent,
  dismissSocialEvent,
  extractInstagramUsername,
  type SocialEvent
} from '../utils/socialIntelligenceEngine';
import { parseBirthdayMonth, parseBirthdayDay } from '../utils/birthday';
import { TAMPERMONKEY_SCRIPT_CODE } from '../utils/instagramUserScript';

interface Props {
  customers: Customer[];
  settings?: any;
  onSelectCustomer?: (c: Customer | null) => void;
}

// Utility to copy text
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

function parseDayMonth(dateStr: string | undefined): { day: number; month: number; year?: number } | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length >= 2) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parts[2] ? parseInt(parts[2], 10) : undefined;

    // Handle YYYY-MM-DD format
    if (day > 1000) {
      year = day;
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2] || '0', 10);
    }

    if (!isNaN(day) && !isNaN(month) && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year };
    }
  }
  return null;
}

const DEFAULT_BIRTHDAY_TEMPLATE = `🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨\n\nSalam hangat,\n💎 {storeName}`;

const DEFAULT_ANNIVERSARY_TEMPLATE = `Halo Kak {customerName}! Salam hangat dari {storeName}. Hari ini bertepatan dengan {yearsStr} sejak Kakak mengorder {productName} di toko kami lho. 😍\n\nSemoga perhiasannya awet, selalu berkilau, dan menemani hari-hari indah Kakak ya! Terima kasih banyak sudah menjadi pelanggan setia kami. ✨💎`;

export default function SocialIntelligencePage({ customers, settings, onSelectCustomer }: Props) {
  const [activeTab, setActiveTab] = useState<'radar' | 'calendar' | 'automation'>('radar');
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [isScanning, setIsScanning] = useState(true);
  const [scriptCopied, setScriptCopied] = useState(false);

  const storeName = settings?.storeName || 'Pearl Store';

  // Calendar state
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-11

  const INDO_MONTHS = useMemo(() => [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ], []);

  const WEEKDAYS = useMemo(() => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], []);

  const calendarEvents = useMemo(() => {
    const list: {
      type: 'birthday' | 'anniversary';
      customer: Customer;
      day: number;
      label: string;
      detail: string;
      message: string;
      orderRow?: CustomerRow;
    }[] = [];
    const targetMonth = currentMonth + 1; // 1-indexed

    customers.forEach(customer => {
      // 1. Birthday check
      const bdMonth = parseBirthdayMonth(customer.tanggalUlangTahun);
      const bdDay = parseBirthdayDay(customer.tanggalUlangTahun);
      if (bdMonth === targetMonth && bdDay !== null) {
        const bdayTemplate = settings?.birthdayMessageTemplate || DEFAULT_BIRTHDAY_TEMPLATE;
        const bdayMessage = bdayTemplate
          .replace(/{customerName}/g, customer.nama)
          .replace(/{storeName}/g, storeName)
          .replace(/{vipNote}/g, customer.totalSpend >= (settings?.vipMinSpend || 15000000) ? ' (Pelanggan VIP 👑)' : '');

        list.push({
          type: 'birthday',
          customer,
          day: bdDay,
          label: 'Ulang Tahun 🎂',
          detail: `Ulang Tahun Kak ${customer.nama}`,
          message: bdayMessage
        });
      }

      // 2. Order Anniversary check
      customer.orders.forEach(order => {
        const od = parseDayMonth(order.tanggalOrder);
        if (od && od.month === targetMonth) {
          const exists = list.some(e => e.type === 'anniversary' && e.customer.id === customer.id && e.day === od.day);
          if (!exists) {
            const orderYear = od.year || currentYear;
            const yearsDiff = currentYear - orderYear;
            const label = yearsDiff > 0 ? `Peringatan ${yearsDiff} Tahun Order 🎉` : 'Order Anniversary 🎉';
            const yearsStr = yearsDiff > 0 ? `${yearsDiff} tahun` : '';
            const pName = `${order.jenis || ''} ${order.type || ''}`.trim() || 'perhiasan';
            
            let annivMessage = DEFAULT_ANNIVERSARY_TEMPLATE
              .replace(/{customerName}/g, customer.nama)
              .replace(/{storeName}/g, storeName)
              .replace(/{yearsStr}/g, yearsStr ? `${yearsStr}` : 'order pertama')
              .replace(/{productName}/g, pName);

            list.push({
              type: 'anniversary',
              customer,
              day: od.day,
              label,
              detail: `Order ${pName} (${yearsDiff > 0 ? yearsDiff + ' tahun lalu' : 'hari ini'})`,
              message: annivMessage,
              orderRow: order
            });
          }
        }
      });
    });

    return list;
  }, [customers, currentMonth, currentYear, storeName, settings]);

  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    day: number;
    events: typeof calendarEvents;
  } | null>(null);

  // Auto-select today or first day with events when month/year changes
  useEffect(() => {
    const t = new Date();
    if (currentMonth === t.getMonth() && currentYear === t.getFullYear()) {
      const todayEvents = calendarEvents.filter(e => e.day === t.getDate());
      setSelectedDayEvents({
        day: t.getDate(),
        events: todayEvents
      });
    } else {
      const firstDayWithEvents = calendarEvents.find(e => e.day > 0)?.day;
      if (firstDayWithEvents) {
        setSelectedDayEvents({
          day: firstDayWithEvents,
          events: calendarEvents.filter(e => e.day === firstDayWithEvents)
        });
      } else {
        setSelectedDayEvents({
          day: 1,
          events: []
        });
      }
    }
  }, [currentMonth, currentYear, calendarEvents]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (dayNum: number) => {
    const dayEvents = calendarEvents.filter(e => e.day === dayNum);
    setSelectedDayEvents({
      day: dayNum,
      events: dayEvents
    });
  };

  // Load events
  const reloadEvents = () => {
    const results = scanSocialFeeds(customers, storeName);
    setEvents(results);
  };

  useEffect(() => {
    setIsScanning(true);
    const timer = setTimeout(() => {
      reloadEvents();
      setIsScanning(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [customers, storeName]);



  // Listen to incoming events injected by Tampermonkey
  useEffect(() => {
    const handleInjectedEvents = (e: Event) => {
      const customEvent = e as CustomEvent;
      const injectedList = customEvent.detail;
      if (!Array.isArray(injectedList)) return;

      let hasNew = false;
      injectedList.forEach((ev: any) => {
        const logged = logSocialEvent(
          customers,
          ev.customerId,
          ev.type,
          ev.title,
          ev.detail ? `Keterangan: ${ev.detail} (Deteksi Instagram Web)` : 'Terdeteksi dari Instagram Web.',
          generateSuggestedMessage(
            customers.find(c => c.id === ev.customerId)?.nama || '',
            ev.type,
            ev.detail,
            storeName
          ),
          ev.riskLevel || 'low'
        );
        if (logged) hasNew = true;
      });

      if (hasNew) {
        reloadEvents();
      }
    };

    window.addEventListener('pearlcrm:inject_events', handleInjectedEvents);
    return () => {
      window.removeEventListener('pearlcrm:inject_events', handleInjectedEvents);
    };
  }, [customers, storeName]);

  // Trigger OSINT scan
  const triggerSimulation = async () => {
    setIsScanning(true);
    // Clear cache first to force seeding
    localStorage.removeItem('pearlcrm_social_events_cache');
    
    // Call OSINT
    const engine = await import('../utils/socialIntelligenceEngine');
    const newEvents = await engine.performOSINTScan(customers, storeName);
    
    engine.saveEventsToStorage(newEvents);
    
    setEvents(newEvents);
    setIsScanning(false);
  };

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
    }
  }

  const handleDismiss = (id: string) => {
    const updated = dismissSocialEvent(id, customers);
    setEvents(updated);
  };

  const copyScriptCode = async () => {
    const ok = await copyText(TAMPERMONKEY_SCRIPT_CODE);
    if (ok) {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    }
  };

  const EVENT_META = {
    vacation:    { icon: <Plane size={20} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    achievement: { icon: <Award size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    birthday:    { icon: <Gift size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    grieving:    { icon: <HeartHandshake size={20} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };

  return (
    <div className="page-container-scroll" style={{ flex: 1, overflowY: 'auto' }}>
      <div className="page-body" style={{ position: 'relative' }}>
        
        <style>{`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .pulse-dot {
            width: 12px;
            height: 12px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
            box-shadow: 0 0 8px #10b981;
          }
          .calendar-layout {
            display: grid;
            grid-template-columns: 1.3fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
          }
          .calendar-container {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
          }
          .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 12px;
          }
          .calendar-month-title {
            font-size: 16px;
            font-weight: 800;
            color: var(--text-primary);
            min-width: 120px;
            text-align: center;
          }
          .calendar-nav-btn {
            background: var(--bg-input);
            border: 1px solid var(--border);
            color: var(--text-primary);
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }
          .calendar-nav-btn:hover {
            border-color: #7c3aed;
            background: var(--bg-secondary);
          }
          .calendar-grid-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            text-align: center;
            font-weight: 700;
            font-size: 11.5px;
            color: var(--text-muted);
            margin-bottom: 8px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
          }
          .calendar-day-cell {
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 10px;
            min-height: 90px;
            padding: 6px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
            overflow: hidden;
          }
          .calendar-day-cell:hover {
            background: var(--bg-secondary);
            border-color: #7c3aed;
          }
          .calendar-day-cell.selected {
            background: rgba(124,58,237,0.06);
            border-color: #7c3aed;
            box-shadow: 0 0 0 1px #7c3aed;
          }
          .calendar-day-cell.today {
            border-color: #7c3aed;
            background: rgba(124,58,237,0.03);
          }
          .calendar-day-number {
            font-size: 11px;
            font-weight: 800;
            align-self: flex-end;
            color: var(--text-muted);
            margin-bottom: 4px;
          }
          .calendar-day-cell.today .calendar-day-number {
            color: #7c3aed;
            background: rgba(124,58,237,0.15);
            padding: 1px 5px;
            border-radius: 4px;
          }
          .calendar-day-cell.empty {
            background: transparent;
            border: none;
            cursor: default;
            pointer-events: none;
          }
          .calendar-legend {
            display: flex;
            gap: 16px;
            font-size: 11px;
            color: var(--text-muted);
            flex-wrap: wrap;
          }
          .calendar-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
          }
          @media (max-width: 992px) {
            .calendar-layout {
              grid-template-columns: 1fr !important;
            }
            .calendar-day-cell {
              min-height: 70px !important;
            }
          }
        `}</style>
        
        {/* ── Tabs Navigator Header ── */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: 12, border: '1px solid rgba(124,58,237,0.3)' }}>
              🟢 RADAR ACTIVE
            </span>
          </div>

          {/* Tabs Navigation */}
          <div style={{ display: 'flex', background: 'var(--bg-input)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('radar')}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                cursor: 'pointer',
                background: activeTab === 'radar' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'radar' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === 'radar' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Momen Sosial
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                cursor: 'pointer',
                background: activeTab === 'calendar' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === 'calendar' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Calendar size={14} /> Kalender Momen
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                cursor: 'pointer',
                background: activeTab === 'automation' ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab === 'automation' ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: activeTab === 'automation' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Settings size={14} /> Auto-Scan (Tampermonkey)
            </button>
          </div>
        </div>

        {/* ── Tab Content: Radar Momen ── */}
        {activeTab === 'radar' && (
          <div>
            {/* Action Toolbar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button onClick={triggerSimulation} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '10px 16px' }}>
                <RefreshCw size={15} /> Simulasikan Scan AI
              </button>
            </div>

            {isScanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 350, gap: 16 }}>
                <div className="spinner" style={{ width: 36, height: 36, border: '4px solid var(--border)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Menganalisis radar media sosial...</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Mencari sinyal liburan, perayaan, duka, dan ulang tahun.</div>
              </div>
            ) : events.length === 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
                
                {/* Receiver telemetry status card */}
                <div className="card" style={{ padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>

                  
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.1)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)', marginBottom: 20 }}>
                    <div className="pulse-dot" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', letterSpacing: 0.5, textTransform: 'uppercase' }}>Receiver Active</span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Mendengarkan Sinyal Tampermonkey</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
                    Ketika Anda membuka Instagram Web dan berselancar di profil pelanggan terdaftar, momen sosial yang Anda catat akan otomatis ditangkap di sini secara instan.
                  </p>
                  
                  <div style={{ marginTop: 24, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    Menunggu pengiriman data dari <code>instagram.com</code>...
                  </div>
                </div>

                {/* Monitored customers list card */}
                <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 300 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Daftar Akun yang Dipantau ({customers.filter(c => c.instagram && c.instagram.trim() !== '' && c.instagram !== '-').length})
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                    Klik pada akun pelanggan di bawah untuk membuka Instagram mereka dan mencatat momen sosial secara langsung via banner extension.
                  </p>
                  
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 200, paddingRight: 6 }}>
                    {customers
                      .filter(c => c.instagram && c.instagram.trim() !== '' && c.instagram !== '-')
                      .map(c => {
                        const username = extractInstagramUsername(c.instagram);
                        return (
                          <a
                            key={c.id}
                            href={generateInstaLink(c.instagram, c.nama)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11,
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                              padding: '5px 10px',
                              borderRadius: 6,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.borderColor = '#7c3aed';
                              e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
                              e.currentTarget.style.color = 'var(--accent-purple)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.background = 'var(--bg-input)';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            @{username} <ExternalLink size={10} />
                          </a>
                        );
                      })}
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
                {events.map((ev) => {
                  const meta = EVENT_META[ev.type] || { icon: <Globe size={20} />, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' };
                  return (
                    <div key={ev.id} className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderTop: ev.riskLevel === 'high' ? '3px solid #ef4444' : undefined }}>
                      
                      {/* Close/Dismiss Button */}
                      <button
                        onClick={() => handleDismiss(ev.id)}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4
                        }}
                        title="Hapus Momen"
                      >
                        <Trash2 size={16} />
                      </button>

                      {/* Card Body */}
                      <div className="card-body" style={{ padding: '16px', flex: 1 }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid ' + meta.color + '33' }}>
                            {meta.icon}
                          </div>
                          
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{ev.customer.nama}</div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Dideteksi: {ev.dateDetected}</div>
                            
                            <div style={{ fontSize: 13, fontWeight: 700, color: meta.color, marginBottom: 4 }}>{ev.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev.context}</div>

                            {ev.riskLevel === 'high' && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, color: '#ef4444', fontSize: 10, fontWeight: 700 }}>
                                <ShieldAlert size={12} />
                                AUTO-MUTE PROMO 30 HARI
                              </div>
                            )}
                          </div>
                        </div>

                        {/* AI Suggested Message */}
                        <div style={{ marginTop: 16, padding: '12px', background: 'var(--bg-input)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Draft Pesan Empati</div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                            "{ev.suggestedMessage}"
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Bar */}
                      <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, borderRadius: '0 0 16px 16px' }}>
                        <a
                          href={generateInstaLink(ev.customer.instagram, ev.customer.nama)}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: 12, padding: '8px', justifyContent: 'center' }}
                        >
                          <ExternalLink size={14} /> Buka Instagram
                        </a>
                        
                        {ev.customer.wa ? (
                          <a
                            href={'https://wa.me/' + ev.customer.wa.replace(/\D/g, '') + '?text=' + encodeURIComponent(ev.suggestedMessage)}
                            target="_blank" rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ flex: 1.5, fontSize: 12, padding: '8px', justifyContent: 'center', background: '#25D366', color: '#fff', border: 'none' }}
                          >
                            <Send size={14} /> Kirim WhatsApp
                          </a>
                        ) : (
                          <button
                            onClick={() => handleCopy(ev.id, ev.suggestedMessage)}
                            className="btn btn-primary"
                            style={{ flex: 1.5, fontSize: 12, padding: '8px', justifyContent: 'center' }}
                          >
                            {copied[ev.id] ? <Check size={14} /> : <Send size={14} />} 
                            {copied[ev.id] ? 'Tersalin' : 'Salin Pesan'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Content: Kalender Momen ── */}
        {activeTab === 'calendar' && (
          <div className="calendar-layout">
            
            {/* Left Box: Calendar Grid */}
            <div className="calendar-container">
              <div className="calendar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={handlePrevMonth} className="calendar-nav-btn" title="Bulan Sebelumnya">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="calendar-month-title">
                    {INDO_MONTHS[currentMonth]} {currentYear}
                  </span>
                  <button onClick={handleNextMonth} className="calendar-nav-btn" title="Bulan Selanjutnya">
                    <ChevronRight size={16} />
                  </button>
                </div>
                
                {/* Legend */}
                <div className="calendar-legend">
                  <div className="calendar-legend-item">
                    <span style={{ color: '#f59e0b' }}>🎂</span>
                    <span>Ulang Tahun</span>
                  </div>
                  <div className="calendar-legend-item">
                    <span style={{ color: '#10b981' }}>🎉</span>
                    <span>Anniversary Order</span>
                  </div>
                </div>
              </div>

              {/* Grid Header */}
              <div className="calendar-grid-header">
                {WEEKDAYS.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>

              {/* Grid Days */}
              <div className="calendar-grid">
                {(() => {
                  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                  const startDay = new Date(currentYear, currentMonth, 1).getDay();
                  const cells = [];
                  
                  // Empty padding cells
                  for (let i = 0; i < startDay; i++) {
                    cells.push(
                      <div key={`empty-${i}`} className="calendar-day-cell empty" />
                    );
                  }
                  
                  const t = new Date();
                  const isCurrentMonthYear = currentMonth === t.getMonth() && currentYear === t.getFullYear();
                  
                  // Actual day cells
                  for (let d = 1; d <= daysInMonth; d++) {
                    const cellEvents = calendarEvents.filter(e => e.day === d);
                    const isToday = isCurrentMonthYear && d === t.getDate();
                    const isSelected = selectedDayEvents?.day === d;
                    
                    cells.push(
                      <div
                        key={`day-${d}`}
                        className={`calendar-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleDayClick(d)}
                      >
                        <span className="calendar-day-number">{d}</span>
                        
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {cellEvents.slice(0, 2).map((ev, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 4px',
                                borderRadius: 4,
                                background: ev.type === 'birthday' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                                color: ev.type === 'birthday' ? '#d97706' : '#059669',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                              title={ev.detail}
                            >
                              <span>{ev.type === 'birthday' ? '🎂' : '🎉'}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.customer.nama}</span>
                            </div>
                          ))}
                          {cellEvents.length > 2 && (
                            <div style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 800, paddingLeft: 4 }}>
                              +{cellEvents.length - 2} lagi
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  
                  return cells;
                })()}
              </div>
            </div>

            {/* Right Box: Detail Momen */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={18} style={{ color: '#7c3aed' }} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Detail Momen: {selectedDayEvents ? `${selectedDayEvents.day} ${INDO_MONTHS[currentMonth]} ${currentYear}` : 'Pilih Tanggal'}
                  </span>
                </div>
                {selectedDayEvents && selectedDayEvents.events.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                    {selectedDayEvents.events.length} Momen
                  </span>
                )}
              </div>

              {!selectedDayEvents || selectedDayEvents.events.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🏖️</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>Tidak ada Momen Khusus</div>
                  <div style={{ fontSize: 11 }}>Tidak ada ulang tahun atau anniversary order terdaftar untuk tanggal ini.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '500px', overflowY: 'auto', paddingRight: 4 }}>
                  {selectedDayEvents.events.map((ev, index) => {
                    const initials = ev.customer.nama.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                    const waClean = ev.customer.wa.replace(/\D/g, '');
                    const waLink = `https://wa.me/${waClean}?text=${encodeURIComponent(ev.message)}`;
                    const igUrl = generateInstaLink(ev.customer.instagram, ev.customer.nama);
                    const copiedKey = `cal-${ev.customer.id}-${ev.type}-${index}`;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12
                        }}
                      >
                        {/* Header info */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: ev.type === 'birthday' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#10b981,#059669)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span>{ev.customer.nama}</span>
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: ev.type === 'birthday' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                                color: ev.type === 'birthday' ? '#d97706' : '#059669'
                              }}>
                                {ev.type === 'birthday' ? '🎂 Birthday' : '🎉 Anniv'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {ev.detail}
                            </div>
                          </div>
                        </div>

                        {/* Template Box */}
                        <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, border: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Draft Pesan WA</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {ev.message}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {ev.customer.wa ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary"
                              style={{ flex: '1 1 auto', fontSize: 11, padding: '6px 10px', background: '#25D366', color: 'white', border: 'none', gap: 4, height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Send size={12} /> WhatsApp
                            </a>
                          ) : (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                              ⚠️ No WA
                            </div>
                          )}

                          <button
                            onClick={() => handleCopy(copiedKey, ev.message)}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '6px 10px', gap: 4, height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {copied[copiedKey] ? <Check size={12} /> : <Copy size={12} />}
                            {copied[copiedKey] ? 'Tersalin' : 'Salin'}
                          </button>

                          {ev.customer.instagram && (
                            <a
                              href={igUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '6px 10px', gap: 4, height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ExternalLink size={12} /> Instagram
                            </a>
                          )}

                          {onSelectCustomer && (
                            <button
                              onClick={() => onSelectCustomer(ev.customer)}
                              className="btn btn-secondary"
                              style={{ fontSize: 11, padding: '6px 10px', gap: 4, height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}
                            >
                              <User size={12} /> Lihat Detail
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Tab Content: Tampermonkey Automation Settings ── */}
        {activeTab === 'automation' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
            
            {/* Guide Card */}
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>🤖 Petunjuk Pemasangan Auto-Scan</h2>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <p>Ikuti langkah mudah ini untuk mengaktifkan pemindaian otomatis di latar belakang browser Anda:</p>
                <ol style={{ paddingLeft: 20, margin: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <li>
                    <strong>Install Ekstensi Tampermonkey:</strong><br />
                    Download ekstensi gratis Tampermonkey di Chrome/Edge Web Store Anda.
                  </li>
                  <li>
                    <strong>Buat Script Baru:</strong><br />
                    Buka dashboard Tampermonkey di browser Anda, lalu klik tombol <strong>Create a new script (+)</strong>.
                  </li>
                  <li>
                    <strong>Salin & Simpan Kode Script:</strong><br />
                    Klik tombol <strong>"Salin Kode UserScript"</strong> di sebelah kanan, paste-kan seluruh kodenya ke editor Tampermonkey, lalu klik <strong>File - Save</strong> di menu editor.
                  </li>
                  <li>
                    <strong>Buka Instagram Web:</strong><br />
                    Buka Instagram Web di tab browser Anda (pastikan Anda login). Script akan berjalan secara sunyi dan lambat memantau profil pelanggan yang terdaftar.
                  </li>
                </ol>
                <div style={{ padding: 12, background: 'rgba(124,58,237,0.08)', borderLeft: '3px solid #7c3aed', borderRadius: '0 8px 8px 0', marginTop: 16 }}>
                  <strong>Keamanan Data Terjamin:</strong> Script ini berjalan lokal di browser Anda. Tidak ada data yang dikirim ke server luar. Semua sinkronisasi terjadi langsung antara tab Instagram dan tab CRM Pearl Store.
                </div>
              </div>
            </div>

            {/* Script Viewer Card */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>📄 Kode UserScript</h2>
                <button
                  onClick={copyScriptCode}
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {scriptCopied ? <Check size={14} /> : <Copy size={14} />}
                  {scriptCopied ? 'Tersalin!' : 'Salin Kode UserScript'}
                </button>
              </div>
              
              <div style={{ flex: 1, minHeight: 300, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, overflow: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#f1f5f9', whiteSpace: 'pre' }}>
                {TAMPERMONKEY_SCRIPT_CODE}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

