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

      <div style={{
        background: todayAlerts.length ? '#FEF2F2' : '#FFFBEB',
        border: `1px solid ${todayAlerts.length ? '#FECACA' : '#FDE68A'}`,
        borderRadius: '4px',
        padding: '8px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: todayAlerts.length ? '#991B1B' : '#92400E' }}>
          <span>{todayAlerts.length ? '🎂' : '🎉'}</span>
          <strong>{todayAlerts.length ? `${todayAlerts.length} Ulang Tahun Hari Ini!` : `${alerts.length} Ulang Tahun Bulan Ini:`}</strong>
          {alerts[activeIndex] && (
            <span 
              onClick={() => onSelectCustomer && onSelectCustomer(alerts[activeIndex].customer)}
              style={{ cursor: onSelectCustomer ? 'pointer' : 'default', textDecoration: onSelectCustomer ? 'underline' : 'none', fontWeight: 600 }}
            >
              {alerts[activeIndex].customer.nama} ({formatBirthday(alerts[activeIndex].customer.tanggalUlangTahun)})
            </span>
          )}
          {alerts[activeIndex] && alerts[activeIndex].daysUntil !== 0 && (
            <span style={{ fontSize: '11px', opacity: 0.8 }}>
              · {alerts[activeIndex].daysUntil < 0 ? `Lewat ${Math.abs(alerts[activeIndex].daysUntil)} hari` : `${alerts[activeIndex].daysUntil} hari lagi`}
            </span>
          )}
        </div>

        {/* Action + Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {alerts[activeIndex]?.customer.wa && (
            <a
              href={getWhatsAppBirthdayUrl(alerts[activeIndex].customer)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <button
                style={{
                  background: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Kirim WA
              </button>
            </a>
          )}
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '2px', display: 'flex' }}
            title="Tutup banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
