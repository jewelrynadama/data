import { useState, useEffect, useMemo } from 'react';
import {
  Send, Check, ExternalLink, Copy,
  Calendar, ChevronLeft, ChevronRight, User, Plus, X, Loader2
} from 'lucide-react';

interface CustomReminder {
  id: string;
  customerId: string;
  date: string;
  type: string;
  note: string;
}
import type { Customer, CustomerRow } from '../types';
import { generateInstaLink } from '../utils/socialIntelligenceEngine';
import { parseBirthdayMonth, parseBirthdayDay } from '../utils/birthday';

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
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [reminders, setReminders] = useState<CustomReminder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pearlcrm_custom_reminders') || '[]');
    } catch {
      return [];
    }
  });
  const [showReminderForm, setShowReminderForm] = useState<{ customerId: string, customerName: string } | null>(null);
  const [reminderType, setReminderType] = useState('Service Perhiasan');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');

  useEffect(() => {
    localStorage.setItem('pearlcrm_custom_reminders', JSON.stringify(reminders));
  }, [reminders]);

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
      type: 'birthday' | 'anniversary' | 'reminder';
      customer: Customer;
      day: number;
      label: string;
      detail: string;
      message: string;
      orderRow?: CustomerRow;
      id?: string;
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

    reminders.forEach(r => {
      const rd = parseDayMonth(r.date);
      if (rd && rd.month === targetMonth && rd.year === currentYear) {
        const c = customers.find(c => c.id === r.customerId);
        if (c) {
          list.push({
            type: 'reminder',
            customer: c,
            day: rd.day,
            label: r.type,
            detail: r.note,
            message: `Halo Kak ${c.nama},\n\nMengingatkan tentang ${r.type}: ${r.note}.\n\nSalam hangat,\n💎 ${storeName}`,
            id: r.id
          });
        }
      }
    });

    return list;
  }, [customers, currentMonth, currentYear, storeName, settings, reminders]);

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

  async function handleCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
    }
  }

  return (
    <div className="page-body">
        
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
        
        {/* ── Kalender Momen ── */}
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
                                background: ev.type === 'birthday' ? 'rgba(245,158,11,0.12)' : ev.type === 'reminder' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                                color: ev.type === 'birthday' ? '#d97706' : ev.type === 'reminder' ? '#2563eb' : '#059669',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3
                              }}
                              title={ev.detail}
                            >
                              <span>{ev.type === 'birthday' ? '🎂' : ev.type === 'reminder' ? '⏰' : '🎉'}</span>
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
                        {/* Checkbox for Broadcast */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                          <input 
                            type="checkbox"
                            checked={selectedEvents.has(copiedKey)}
                            onChange={(e) => {
                              const newSet = new Set(selectedEvents);
                              if (e.target.checked) newSet.add(copiedKey);
                              else newSet.delete(copiedKey);
                              setSelectedEvents(newSet);
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#7c3aed' }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 600 }}>Pilih untuk broadcast</span>
                        </div>
                        {/* Header info */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: ev.type === 'birthday' ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : ev.type === 'reminder' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#10b981,#059669)',
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
                                background: ev.type === 'birthday' ? 'rgba(245,158,11,0.15)' : ev.type === 'reminder' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                color: ev.type === 'birthday' ? '#d97706' : ev.type === 'reminder' ? '#2563eb' : '#059669'
                              }}>
                                {ev.type === 'birthday' ? '🎂 Birthday' : ev.type === 'reminder' ? '⏰ Reminder' : '🎉 Anniv'}
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

                          <button
                            onClick={() => {
                              setShowReminderForm({ customerId: ev.customer.id, customerName: ev.customer.nama });
                              setReminderDate('');
                              setReminderNote('');
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '6px 10px', gap: 4, height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={12} /> Tambah Pengingat
                          </button>
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

      {/* Sticky Broadcast Footer */}
      {selectedEvents.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
          zIndex: 100
        }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {selectedEvents.size} event dipilih
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedEvents(new Set())}
            >
              Batalkan Pilihan
            </button>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const msgs: string[] = [];
                selectedEvents.forEach(key => {
                   const ev = selectedDayEvents?.events.find((e, idx) => `cal-${e.customer.id}-${e.type}-${idx}` === key);
                   if (ev) msgs.push(`Untuk: ${ev.customer.nama}\nPesan:\n${ev.message}`);
                });
                if (msgs.length > 0) {
                    await copyText(msgs.join('\n\n---\n\n'));
                    alert('Semua pesan berhasil disalin!');
                }
              }}
            >
              📋 Salin Semua Pesan
            </button>
            <button
              className="btn btn-primary"
              disabled={isProcessingQueue}
              onClick={async () => {
                setIsProcessingQueue(true);
                const evs = Array.from(selectedEvents).map(key => selectedDayEvents?.events.find((e, idx) => `cal-${e.customer.id}-${e.type}-${idx}` === key)).filter(Boolean);
                for (const ev of evs) {
                  if (ev && ev.customer.wa) {
                    const waClean = ev.customer.wa.replace(/\D/g, '');
                    const waLink = `https://wa.me/${waClean}?text=${encodeURIComponent(ev.message)}`;
                    window.open(waLink, '_blank');
                    await new Promise(r => setTimeout(r, 200));
                  }
                }
                setIsProcessingQueue(false);
              }}
            >
              {isProcessingQueue ? <Loader2 size={16} className="spin" /> : '🚀'} Buka Semua WA ({selectedEvents.size} orang)
            </button>
          </div>
        </div>
      )}

      {/* Reminder Form Modal */}
      {showReminderForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24, background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Tambah Pengingat Custom</h3>
              <button onClick={() => setShowReminderForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Pelanggan</label>
              <input type="text" className="input" value={showReminderForm.customerName} disabled style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Jenis Pengingat</label>
              <select className="input" value={reminderType} onChange={e => setReminderType(e.target.value)} style={{ width: '100%' }}>
                <option>Service Perhiasan</option>
                <option>Follow-up Pesanan</option>
                <option>Penagihan DP</option>
                <option>Custom</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Tanggal (YYYY-MM-DD)</label>
              <input type="date" className="input" value={reminderDate} onChange={e => setReminderDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Catatan</label>
              <textarea className="input" value={reminderNote} onChange={e => setReminderNote(e.target.value)} style={{ width: '100%', minHeight: 80 }} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => {
              if (!reminderDate) return alert('Tanggal harus diisi!');
              setReminders(prev => [...prev, {
                id: `rem-${Date.now()}`,
                customerId: showReminderForm.customerId,
                date: reminderDate,
                type: reminderType,
                note: reminderNote
              }]);
              setShowReminderForm(null);
            }}>Simpan Pengingat</button>
          </div>
        </div>
      )}

    </div>
  );
}

