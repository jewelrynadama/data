// src/components/Sidebar.tsx
import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  BarChart3,
  Download,
  Settings,
  Megaphone,
  X,
  Gift,
  FileText,
  Receipt,
  Package,
  Columns,
  ClipboardList,
  MessageCircle,
  HardDrive,
  Grid,
  TrendingUp,
  Crosshair,
  Target,
  QrCode,
  MessageSquare,
} from 'lucide-react';

interface SidebarProps {
  page: string;
  onNavigate: (p: string) => void;
  totalCustomers: number;
  totalOrders: number;
  pendingCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { id: 'dashboard',      label: 'Overview',             icon: LayoutDashboard, group: 'MAIN' },
  { id: 'customers',      label: 'Customers',            icon: Users,           group: 'MAIN' },
  { id: 'orders',         label: 'All Orders',           icon: ShoppingBag,     group: 'MAIN' },
  { id: 'kanban',         label: 'Kanban Tracker',       icon: Columns,         group: 'MAIN' },
  { id: 'marketing',      label: 'Marketing Hub',        icon: Megaphone,       group: 'INSIGHTS' },
  { id: 'ads-manager',    label: 'Ads & Social',         icon: Target,          group: 'INSIGHTS', badge: 'NEW' },
  { id: 'analytics',      label: 'Analytics',            icon: BarChart3,       group: 'INSIGHTS' },
  { id: 'finance-analytics', label: 'Analisis Keuangan', icon: TrendingUp,      group: 'INSIGHTS' },
  { id: 'birthday',       label: 'Birthday Tracker',     icon: Gift,            group: 'INSIGHTS' },
  { id: 'reports',        label: 'Laporan Bulanan',      icon: FileText,        group: 'INSIGHTS' },
  { id: 'sales-target',   label: 'Sales Target',         icon: Crosshair,       group: 'INSIGHTS' },
  { id: 'activity-log',   label: 'Activity Log',         icon: ClipboardList,   group: 'INSIGHTS' },
  { id: 'chat-history', label: 'WA Chat History', icon: MessageCircle,   group: 'TOOLS', badge: 'NEW' },
  { id: 'whatsapp-scanner',     label: 'Hubungkan WA',    icon: QrCode, group: 'TOOLS', isNew: true },
  { id: 'whatsapp-inbox',       label: 'WA Live Inbox',   icon: MessageSquare, group: 'TOOLS', isNew: true },
  { id: 'whatsapp-importer',    label: 'WA Importer',     icon: MessageCircle, group: 'TOOLS' },
  { id: 'drive-photo-linker',   label: 'Drive Photos',    icon: HardDrive,     group: 'TOOLS' },
  { id: 'invoice',    label: 'Invoice',          icon: Receipt,         group: 'TOOLS' },
  { id: 'catalog',    label: 'Katalog Produk',   icon: Grid,            group: 'TOOLS' },
  { id: 'inventory',  label: 'Stok / Inventory', icon: Package,         group: 'TOOLS' },
  { id: 'export',     label: 'Export Data',      icon: Download,        group: 'TOOLS' },
  { id: 'settings',   label: 'Settings',         icon: Settings,        group: 'TOOLS' },
];

export default function Sidebar({ page, onNavigate, totalCustomers, totalOrders, pendingCount = 0, isOpen, onClose }: SidebarProps) {
  const badgeMap: Record<string, number> = {
    customers: totalCustomers,
    orders: totalOrders,
    inbox: pendingCount,
  };

  let lastGroup = '';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Mobile close button (only visible on mobile via CSS usually, or just render it if onClose exists) */}
      {onClose && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px' }} className="hide-on-desktop">
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      )}

      <nav className="sidebar-nav" style={{ paddingTop: onClose ? '0' : '16px' }}>
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
    </aside>
  );
}
