// src/components/NotificationCenter.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Bell, CheckCheck, BellOff } from 'lucide-react';
import type { AppNotification, NotifType } from '../utils/notificationEngine';

interface Props {
  notifications: AppNotification[];
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
  open: boolean;
  settings?: any;
}

const TYPE_LABELS: Record<NotifType, string> = {
  birthday: 'Ulang Tahun',
  resi: 'Resi',
  inactive: 'Pelanggan',
  milestone: 'Milestone',
};

const TYPE_ICONS: Record<NotifType, string> = {
  birthday: '🎂',
  resi: '📦',
  inactive: '🔁',
  milestone: '🏆',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#6366f1',
};

const TYPE_BG: Record<NotifType, string> = {
  birthday: 'rgba(239,68,68,0.12)',
  resi: 'rgba(245,158,11,0.12)',
  inactive: 'rgba(99,102,241,0.12)',
  milestone: 'rgba(16,185,129,0.12)',
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Baru saja';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

type FilterTab = 'all' | NotifType;

const FILTER_TABS: { id: FilterTab; label: string; icon: string }[] = [
  { id: 'all', label: 'Semua', icon: '🔔' },
  { id: 'birthday', label: 'Ulang Tahun', icon: '🎂' },
  { id: 'resi', label: 'Resi', icon: '📦' },
  { id: 'inactive', label: 'Pelanggan', icon: '🔁' },
  { id: 'milestone', label: 'Milestone', icon: '🏆' },
];

export default function NotificationCenter({
  notifications,
  readIds,
  onMarkRead,
  onMarkAllRead,
  onClose,
  open,
  settings,
}: Props) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open, onClose]);

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const countByType = (type: NotifType) =>
    notifications.filter((n) => n.type === type && !readIds.has(n.id)).length;

  if (!open) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1099,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 400,
          maxWidth: '95vw',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.35)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.28s cubic-bezier(0.4,0,0.2,1)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: unreadCount > 0
                ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                : 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: unreadCount > 0 ? '0 0 14px rgba(124,58,237,0.4)' : 'none',
              transition: 'all 0.3s',
            }}>
              <Bell size={16} color={unreadCount > 0 ? 'white' : 'var(--text-muted)'} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifikasi
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 8,
                  padding: '5px 10px',
                  color: '#818cf8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                }}
                title="Tandai semua sudah dibaca"
              >
                <CheckCheck size={12} />
                Semua Dibaca
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {FILTER_TABS.map((tab) => {
            const tabCount = tab.id === 'all'
              ? unreadCount
              : countByType(tab.id as NotifType);
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.2))'
                    : 'var(--bg-card)',
                  border: isActive
                    ? '1px solid rgba(124,58,237,0.4)'
                    : '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '4px 12px',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#a78bfa' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.2s',
                  fontFamily: 'Inter, sans-serif',
                  flexShrink: 0,
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tabCount > 0 && (
                  <span style={{
                    background: isActive ? '#7c3aed' : 'var(--bg-card-hover)',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 18,
                    textAlign: 'center',
                  }}>
                    {tabCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Notification List ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        }}>
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              padding: 40,
              color: 'var(--text-muted)',
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}>
                <BellOff size={26} color="var(--text-muted)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tidak ada notifikasi
              </div>
              <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
                {filter === 'all'
                  ? 'Semua berjalan dengan baik! 🎉'
                  : `Tidak ada notifikasi ${TYPE_LABELS[filter as NotifType] || ''}`}
              </div>
            </div>
          ) : (
            filtered.map((notif) => {
              const isRead = readIds.has(notif.id);
              const isHovered = hoveredId === notif.id;
              return (
                <div
                  key={notif.id}
                  onMouseEnter={() => setHoveredId(notif.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onMarkRead(notif.id)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 16px',
                    margin: '2px 8px',
                    borderRadius: 12,
                    background: isHovered
                      ? 'var(--bg-card-hover)'
                      : isRead
                      ? 'transparent'
                      : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderLeft: `3px solid ${isRead ? 'transparent' : SEVERITY_COLORS[notif.severity]}`,
                    position: 'relative',
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: isRead ? 'var(--bg-card)' : TYPE_BG[notif.type],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}>
                    {TYPE_ICONS[notif.type]}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isRead ? 500 : 700,
                      color: isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                      marginBottom: 3,
                      lineHeight: 1.3,
                    }}>
                      {notif.title}
                    </div>
                    <div style={{
                      fontSize: 11.5,
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                      marginBottom: 6,
                    }}>
                      {notif.body}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {notif.waPhone && notif.type === 'birthday' && (
                        <a
                          href={`https://wa.me/${notif.waPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `🎂 Selamat Ulang Tahun Kak ${notif.customerName}! Semoga hari spesialnya penuh kebahagiaan! 💎✨\n\nSalam hangat,\n${settings?.storeName || 'Pearl Store'}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notif.id);
                          }}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: 'rgba(37,211,102,0.15)',
                            border: '1px solid rgba(37,211,102,0.3)',
                            color: '#22c55e',
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#22c55e">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.507 3.934 1.399 5.61L0 24l6.549-1.374A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.01-1.374l-.36-.214-3.728.981.998-3.645-.234-.376A9.818 9.818 0 1112 21.818z"/>
                          </svg>
                          Kirim WA
                        </a>
                      )}
                      {notif.type === 'milestone' && notif.waPhone && (
                        <a
                          href={`https://wa.me/${notif.waPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Halo Kak ${notif.customerName}! 🏆 Terima kasih sudah menjadi pelanggan setia ${settings?.storeName || 'Pearl Store'}! Kakak sudah ${notif.title.match(/\d+/)?.[0]} kali berbelanja bersama kami 💎 Sebagai apresiasi, kami memiliki penawaran spesial untuk Kakak!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkRead(notif.id);
                          }}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: 'rgba(16,185,129,0.15)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            color: '#10b981',
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          🎁 Apresiasi WA
                        </a>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div style={{
                      fontSize: 10.5,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      opacity: 0.7,
                    }}>
                      {timeAgo(notif.timestamp)}
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!isRead && (
                    <div style={{
                      position: 'absolute',
                      top: 14,
                      right: 16,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: SEVERITY_COLORS[notif.severity],
                      boxShadow: `0 0 6px ${SEVERITY_COLORS[notif.severity]}`,
                      animation: notif.severity === 'critical' ? 'pulse 1.5s infinite' : 'none',
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {notifications.length > 0 && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            {notifications.length} total notifikasi • Klik untuk tandai dibaca
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
