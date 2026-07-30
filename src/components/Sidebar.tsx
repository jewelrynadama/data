// src/components/Sidebar.tsx
import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  BarChart3,
  Download,
  LogOut,
  Sun,
  Moon,
  Settings,
  Bell,
  Megaphone,
  Inbox,
  X,
  Gift,
  FileText,
  Receipt,
  Package,
  Columns,
  Sparkles,
  MessageCircle,
  HardDrive,
  Grid,
  TrendingUp,
  Crosshair,
  ClipboardList,
  Search,
  Calendar,
  Brain,
  DollarSign,
  Layers,
} from 'lucide-react';

interface SidebarProps {
  page: string;
  onNavigate: (p: string) => void;
  totalCustomers: number;
  totalOrders: number;
  onLogout?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  settings?: any;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  pendingCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { id: 'dashboard',      label: 'Overview',             icon: LayoutDashboard, group: 'MAIN' },
  { id: 'customers',      label: 'Customers',            icon: Users,           group: 'MAIN' },
  { id: 'orders',         label: 'All Orders',           icon: ShoppingBag,     group: 'MAIN' },
  { id: 'inbox',          label: 'Order Inbox',          icon: Inbox,           group: 'MAIN' },
  { id: 'kanban',         label: 'Kanban Tracker',       icon: Columns,         group: 'MAIN' },
  { id: 'command-center', label: '⚡ PearlMind™',         icon: Brain,           group: 'AI_MIND', badge: 'NEW' },
  { id: 'affinity-matrix', label: 'Product Affinity',     icon: Grid,            group: 'AI_MIND', badge: 'NEW' },
  { id: 'profit-optimizer',label: 'Profit Optimizer',     icon: DollarSign,      group: 'AI_MIND', badge: 'NEW' },
  { id: 'demand-forecast', label: 'Demand Forecast',      icon: TrendingUp,      group: 'AI_MIND', badge: 'NEW' },
  { id: 'bundle-recommender',label: 'Smart Bundles',      icon: Layers,          group: 'AI_MIND', badge: 'NEW' },
  { id: 'marketing',  label: 'Marketing Hub',    icon: Megaphone,       group: 'INSIGHTS' },
  { id: 'ai-trends',  label: 'AI Market Radar',  icon: Sparkles,        group: 'INSIGHTS' },
  { id: 'social',     label: 'Kalender Momen',   icon: Calendar,        group: 'INSIGHTS' },
  { id: 'analytics',  label: 'Analytics',        icon: BarChart3,       group: 'INSIGHTS' },
  { id: 'rfm-analytics', label: 'RFM Analytics', icon: Sparkles,        group: 'INSIGHTS' },
  { id: 'finance-analytics', label: 'Analisis Keuangan', icon: TrendingUp, group: 'INSIGHTS' },
  { id: 'birthday',   label: 'Birthday Tracker', icon: Gift,            group: 'INSIGHTS' },
  { id: 'reports',    label: 'Laporan Bulanan',  icon: FileText,        group: 'INSIGHTS' },
  { id: 'sales-target', label: 'Sales Target',   icon: Crosshair,       group: 'INSIGHTS' },
  { id: 'activity-log', label: 'Activity Log',   icon: ClipboardList,   group: 'INSIGHTS' },
  { id: 'ig-analyzer',  label: 'IG Analyzer',    icon: Search,          group: 'TOOLS' },
  { id: 'chat-history', label: 'WA Chat History', icon: MessageCircle,   group: 'TOOLS', badge: 'NEW' },
  { id: 'whatsapp-importer',    label: 'WA Importer',     icon: MessageCircle, group: 'TOOLS' },
  { id: 'drive-photo-linker',   label: 'Drive Photos',    icon: HardDrive,     group: 'TOOLS' },
  { id: 'invoice',    label: 'Invoice',          icon: Receipt,         group: 'TOOLS' },
  { id: 'catalog',    label: 'Katalog Produk',   icon: Grid,            group: 'TOOLS' },
  { id: 'inventory',  label: 'Stok / Inventory', icon: Package,         group: 'TOOLS' },
  { id: 'export',     label: 'Export Data',      icon: Download,        group: 'TOOLS' },
  { id: 'settings',   label: 'Settings',         icon: Settings,        group: 'TOOLS' },
];

export default function Sidebar({ page, onNavigate, totalCustomers, totalOrders, onLogout, theme, onToggleTheme, settings, unreadCount = 0, onOpenNotifications, pendingCount = 0, isOpen, onClose }: SidebarProps) {
  const badgeMap: Record<string, number> = {
    customers: totalCustomers,
    orders: totalOrders,
    inbox: pendingCount,
  };

  let lastGroup = '';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo-icon">{settings?.loginLogoEmoji || '💎'}</div>
          <div>
            <div className="sidebar-logo-text">{settings?.appName || 'PearlCRM'}</div>
            <div className="sidebar-logo-sub">Customer Intelligence</div>
          </div>
        </div>
        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          title={unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Notifikasi'}
          style={{
            position: 'relative',
            background: unreadCount > 0 ? 'rgba(124,58,237,0.15)' : 'none',
            border: unreadCount > 0 ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            borderRadius: 10,
            padding: 7,
            cursor: 'pointer',
            color: unreadCount > 0 ? '#a78bfa' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.2)';
            e.currentTarget.style.color = '#a78bfa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = unreadCount > 0 ? 'rgba(124,58,237,0.15)' : 'none';
            e.currentTarget.style.color = unreadCount > 0 ? '#a78bfa' : 'var(--text-muted)';
          }}
        >
          <Bell size={16} style={unreadCount > 0 ? { animation: 'bellRing 2s ease-in-out infinite' } : undefined} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              borderRadius: 10,
              background: '#ef4444',
              color: 'white',
              fontSize: 9.5,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '1.5px solid var(--bg-secondary)',
              animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              fontFamily: 'Inter, sans-serif',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const showGroup = item.group !== lastGroup;
          lastGroup = item.group;
          const Icon = item.icon;
          const badge = badgeMap[item.id];
          const stringBadge = (item as any).badge as string | undefined;
          return (
            <React.Fragment key={item.id}>
              {showGroup && (
                <div
                  className="nav-section-label"
                  style={item.group === 'AI_MIND' ? {
                    background: 'linear-gradient(90deg,#7c3aed,#06b6d4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                  } : undefined}
                >
                  {item.group === 'AI_MIND' ? '✦ AI COMMAND' : item.group}
                </div>
              )}
              <button
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                style={item.group === 'AI_MIND' ? {
                  background: page === item.id
                    ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(6,182,212,0.15))'
                    : 'linear-gradient(135deg,rgba(124,58,237,0.08),rgba(6,182,212,0.05))',
                  border: '1px solid rgba(124,58,237,0.25)',
                  marginBottom: 4,
                } : undefined}
              >
                <Icon size={17} className="nav-icon" style={item.group === 'AI_MIND' ? { color: '#7c3aed' } : undefined} />
                {item.label}
                {badge !== undefined && badge > 0 && (
                  <span className="nav-badge">{badge}</span>
                )}
                {stringBadge && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 800,
                    background: 'linear-gradient(90deg,#7c3aed,#06b6d4)',
                    color: 'white', padding: '1px 5px', borderRadius: 4,
                    letterSpacing: '0.3px',
                  }}>
                    {stringBadge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sidebar-user">
          <div className="user-avatar">A</div>
          <div className="user-info" style={{ flex: 1 }}>
            <div className="user-name">Admin</div>
            <div className="user-role">Administrator</div>
          </div>
          <button
            onClick={onToggleTheme}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 6,
              transition: 'background-color 0.2s, color 0.2s',
              marginRight: 2,
            }}
            title={theme === 'dark' ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-red)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                borderRadius: 6,
                transition: 'background-color 0.2s',
              }}
              title="Keluar / Logout"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
