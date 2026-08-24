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
  Target
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
  // ── CRM & PIPELINE ───────────────────
  { id: 'dashboard',      label: 'Overview',             icon: LayoutDashboard, group: 'CRM' },
  { id: 'kanban',         label: 'Pipeline Tracker',     icon: Columns,         group: 'CRM' },
  { id: 'customers',      label: 'Customers',            icon: Users,           group: 'CRM' },
  { id: 'activity-log',   label: 'Activities',           icon: ClipboardList,   group: 'CRM' },

  // ── SALES & ORDERS ───────────────────
  { id: 'orders',         label: 'Quotations & Orders',  icon: ShoppingBag,     group: 'SALES' },
  { id: 'invoice',        label: 'Invoices',             icon: Receipt,         group: 'SALES' },
  { id: 'sales-target',   label: 'Sales Targets',        icon: Crosshair,       group: 'SALES' },

  // ── PRODUCTS & INVENTORY ─────────────
  { id: 'catalog',        label: 'Product Catalog',      icon: Grid,            group: 'INVENTORY' },
  { id: 'inventory',      label: 'Stock / Inventory',    icon: Package,         group: 'INVENTORY' },

  // ── MARKETING & ADS ──────────────────
  { id: 'marketing',      label: 'Marketing Hub',        icon: Megaphone,       group: 'MARKETING' },
  { id: 'ads-manager',    label: 'Meta Ads & Social',    icon: Target,          group: 'MARKETING', badge: 'ODDO' },
  { id: 'chat-history',   label: 'WhatsApp History',     icon: MessageCircle,   group: 'MARKETING' },
  { id: 'whatsapp-importer', label: 'WA Importer',       icon: MessageCircle,   group: 'MARKETING' },
  { id: 'drive-photo-linker', label: 'Drive Photos',     icon: HardDrive,       group: 'MARKETING' },

  // ── REPORTING & INTELLIGENCE ─────────
  { id: 'analytics',      label: 'Sales & RFM Analytics', icon: BarChart3,      group: 'REPORTING' },
  { id: 'finance-analytics', label: 'Financial Analysis', icon: TrendingUp,     group: 'REPORTING' },
  { id: 'birthday',       label: 'Birthday Tracker',     icon: Gift,            group: 'REPORTING' },
  { id: 'reports',        label: 'Monthly Reports',      icon: FileText,        group: 'REPORTING' },

  // ── CONFIGURATION ────────────────────
  { id: 'export',         label: 'Export & Backup',      icon: Download,        group: 'CONFIGURATION' },
  { id: 'settings',       label: 'Settings',             icon: Settings,        group: 'CONFIGURATION' },
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
                <div className="nav-section-label">
                  {item.group}
                </div>
              )}
              <button
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} className="nav-icon" />
                <span>{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="nav-badge">{badge}</span>
                )}
                {stringBadge && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                    background: 'var(--accent-teal)',
                    color: '#FFFFFF', padding: '1px 5px', borderRadius: 3,
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
