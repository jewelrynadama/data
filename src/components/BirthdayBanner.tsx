// src/components/BirthdayBanner.tsx
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { type BirthdayAlert, formatBirthday } from '../utils/birthday';
import { getCustomerLabel } from '../utils/csvLoader';

interface Props {
  alerts: BirthdayAlert[];
  settings?: any;
  onSelectCustomer?: (customer: any) => void;
}

export default function BirthdayBanner({ alerts, settings, onSelectCustomer }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (alerts.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % alerts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [alerts.length]);

  if (!alerts.length || dismissed) return null;

  const todayAlerts = alerts.filter((a) => a.daysUntil === 0);

  const getWhatsAppBirthdayUrl = (customer: typeof alerts[0]['customer']) => {
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
  };

  return (
    <>
      <style>{`
        @keyframes blink-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); border-color: rgba(245,158,11,0.3); }
          50%       { box-shadow: 0 0 18px 4px rgba(245,158,11,0.25); border-color: rgba(245,158,11,0.7); }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes slideFade {
          0% { opacity: 0; transform: translateY(4px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes pulse-today {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); border-color: rgba(239,68,68,0.35); }
          50%       { box-shadow: 0 0 22px 6px rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.8); }
        }
        .birthday-actions-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .birthday-actions-group {
            flex-direction: column;
            align-items: flex-end;
            gap: 6px;
          }
        }
        
        /* Theme-aware contrast styles */
        .birthday-banner-container {
          margin: 0 0 16px 0;
          border-radius: 12px;
          overflow: hidden;
        }
        .birthday-banner-container.today {
          border: 1px solid rgba(239,68,68,0.35);
          background: linear-gradient(135deg, rgba(239,68,68,0.07), rgba(245,158,11,0.05));
          animation: pulse-today 1.8s ease-in-out infinite;
        }
        .birthday-banner-container.upcoming {
          border: 1px solid rgba(245,158,11,0.3);
          background: linear-gradient(135deg, rgba(245,158,11,0.07), rgba(251,191,36,0.04));
          animation: blink-glow 2.4s ease-in-out infinite;
        }
        [data-theme='light'] .birthday-banner-container.today {
          border: 1px solid rgba(220,38,38,0.45);
          background: linear-gradient(135deg, rgba(239,68,68,0.07), rgba(245,158,11,0.05));
        }
        [data-theme='light'] .birthday-banner-container.upcoming {
          border: 1px solid rgba(217,119,6,0.4);
          background: linear-gradient(135deg, rgba(245,158,11,0.07), rgba(251,191,36,0.04));
        }

        .birthday-header-text {
          font-size: 12.5px;
          font-weight: 700;
        }
        .birthday-header-text.today {
          color: #fca5a5;
        }
        .birthday-header-text.upcoming {
          color: #fcd34d;
        }
        [data-theme='light'] .birthday-header-text.today {
          color: #b91c1c;
        }
        [data-theme='light'] .birthday-header-text.upcoming {
          color: #b45309;
        }

        .birthday-badge-day {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 99px;
          white-space: nowrap;
        }
        .birthday-badge-day.today {
          background: rgba(239,68,68,0.2);
          color: #fca5a5;
          animation: blink-dot 1.2s ease-in-out infinite;
        }
        .birthday-badge-day.past {
          background: rgba(255,255,255,0.06);
          color: var(--text-muted);
        }
        .birthday-badge-day.upcoming {
          background: rgba(245,158,11,0.15);
          color: #fcd34d;
        }

        [data-theme='light'] .birthday-badge-day.today {
          background: rgba(220,38,38,0.12);
          color: #b91c1c;
        }
        [data-theme='light'] .birthday-badge-day.past {
          background: rgba(0,0,0,0.06);
          color: var(--text-muted);
        }
        [data-theme='light'] .birthday-badge-day.upcoming {
          background: rgba(217,119,6,0.12);
          color: #b45309;
        }
      `}</style>

      <div className={`birthday-banner-container ${todayAlerts.length ? 'today' : 'upcoming'}`}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 16px',
          borderBottom: alerts.length > 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Blinking dot */}
            <span style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
              background: todayAlerts.length ? '#ef4444' : '#f59e0b',
              animation: 'blink-dot 1.2s ease-in-out infinite',
              display: 'inline-block',
            }} />
            <span className={`birthday-header-text ${todayAlerts.length ? 'today' : 'upcoming'}`}>
              {todayAlerts.length
                ? `🎂 ${todayAlerts.length} customer ulang tahun HARI INI!`
                : `🎉 ${alerts.length} customer akan ulang tahun di bulan ini`}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 4 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Customer list (Carousel) */}
        <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 64, position: 'relative' }}>
          {alerts.map((alert, idx) => {
            if (idx !== activeIndex) return null;
            const isToday = alert.daysUntil === 0;
            return (
              <div key={`${alert.customer.id}-${activeIndex}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap',
                padding: '8px 12px',
                background: isToday ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${isToday ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}`,
                borderRadius: 8,
                animation: alerts.length > 1 ? 'slideFade 3s ease-in-out infinite' : 'fadeIn 0.5s ease-out'
              }}>
                {/* Clickable Area for Profile Selection */}
                <div
                  onClick={() => onSelectCustomer && onSelectCustomer(alert.customer)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flex: 1,
                    minWidth: 0,
                    cursor: onSelectCustomer ? 'pointer' : 'default',
                    borderRadius: 4,
                    transition: 'all 0.15s',
                  }}
                  title={onSelectCustomer ? "Klik untuk melihat profil pelanggan" : undefined}
                  onMouseEnter={(e) => {
                    if (onSelectCustomer) e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    if (onSelectCustomer) e.currentTarget.style.opacity = '1';
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isToday
                      ? 'linear-gradient(135deg,#ef4444,#f59e0b)'
                      : 'linear-gradient(135deg,#f59e0b,#fbbf24)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'white',
                    animation: isToday ? 'blink-dot 1.4s ease-in-out infinite' : 'none',
                  }}>
                    {alert.customer.nama.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {alert.customer.nama}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      🎂 {formatBirthday(alert.customer.tanggalUlangTahun)}
                    </div>
                  </div>
                </div>

                <div className="birthday-actions-group">
                  {/* WA quick contact */}
                  {alert.customer.wa && (
                    <a
                      href={getWhatsAppBirthdayUrl(alert.customer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ flexShrink: 0 }}
                      title="Kirim ucapan via WhatsApp"
                    >
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 11.5, gap: 5, background: '#25D366', borderColor: '#25D366', color: '#000' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.498 1.45 5.419 1.451 5.928 0 10.751-4.823 10.754-10.75.002-2.873-1.116-5.573-3.149-7.607C17.58 1.214 14.88.095 12.008.095c-5.93 0-10.753 4.821-10.756 10.75-.001 1.91.498 3.778 1.447 5.378L1.696 20.8l4.951-1.646zm11.516-7.391c-.307-.154-1.82-.9-2.1-.1-.28.1-.482.4-.592.512-.11.12-.224.13-.532-.024-.31-.154-1.307-.481-2.49-1.536-.919-.82-1.54-1.834-1.72-2.143-.18-.309-.019-.476.135-.629.14-.136.31-.36.465-.54.154-.18.206-.309.309-.514.103-.207.051-.386-.026-.54-.077-.154-.692-1.67-.949-2.29-.25-.603-.523-.518-.72-.528-.19-.01-.408-.01-.624-.01-.216 0-.57.08-.868.407-.299.329-1.14 1.114-1.14 2.717 0 1.603 1.167 3.153 1.328 3.367.162.215 2.297 3.51 5.565 4.916.777.334 1.385.534 1.859.684.78.248 1.49.213 2.051.129.626-.093 1.82-.743 2.077-1.462.257-.718.257-1.332.18-1.462-.077-.13-.284-.207-.592-.361z"/>
                        </svg>
                        Ucapkan
                      </button>
                    </a>
                  )}

                  {/* Day badge */}
                  <span className={`birthday-badge-day ${isToday ? 'today' : alert.daysUntil < 0 ? 'past' : 'upcoming'}`}>
                    {isToday ? '🔴 HARI INI' : alert.daysUntil < 0 ? `⌛ Lewat ${Math.abs(alert.daysUntil)} hari` : `${alert.daysUntil} hari lagi`}
                  </span>
                </div>
              </div>
            );
          })}

        </div>
      </div>
    </>
  );
}
