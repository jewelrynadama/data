// src/pages/CustomersPage.tsx
import { useState, useMemo } from 'react';
import { Search, Eye } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, parseDateToSortValue, getCustomerLabel } from '../utils/csvLoader';
import CustomerDrawer from '../components/CustomerDrawer';
import CustomerFormModal from '../components/CustomerFormModal';
import type { BirthdayAlert } from '../utils/birthday';
import BirthdayBanner from '../components/BirthdayBanner';
import { extractInstagramUsername, generateInstaLink } from '../utils/socialIntelligenceEngine';
import { calcLoyalty } from '../utils/loyaltyEngine';

interface Props {
  customers: Customer[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onAddCustomer: (data: Partial<Customer> & { nama: string }) => void;
  onEditCustomer: (id: string, patch: Partial<Customer>) => void;
  onDeleteCustomer: (id: string) => void;
  onAddOrder: (order: Partial<CustomerRow>) => void;
  onEditOrder: (id: string, patch: Partial<CustomerRow>) => void;
  onDeleteOrder: (id: string) => void;
  birthdayAlerts: BirthdayAlert[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (c: Customer | null) => void;
  settings?: any;
}

type SortKey = 'nama' | 'orderCount' | 'totalSpend' | 'lastOrder' | 'city';

const ROWS = [15, 25, 50];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const GRAD_COLORS = [
  'linear-gradient(135deg,#7c3aed,#4f46e5)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
];

export default function CustomersPage({
  customers,
  searchQuery,
  onSearchChange,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onAddOrder,
  onEditOrder,
  onDeleteOrder,
  birthdayAlerts,
  selectedCustomer,
  onSelectCustomer,
  settings,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('totalSpend');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync selected customer with updated data from props
  const activeCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find((c) => c.id === selectedCustomer.id) || null;
  }, [selectedCustomer, customers]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.nama.toLowerCase().includes(q) ||
        c.instagram.toLowerCase().includes(q) ||
        c.wa.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.alamat.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sortKey as keyof Customer] as string | number;
      let bv: string | number = b[sortKey as keyof Customer] as string | number;
      if (sortKey === 'lastOrder') {
        const ad = parseDateToSortValue(av as string);
        const bd = parseDateToSortValue(bv as string);
        if (ad < bd) return sortAsc ? -1 : 1;
        if (ad > bd) return sortAsc ? 1 : -1;
        return 0;
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageData = sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="sort-arrow">↕</span>;
    return <span className="sort-arrow" style={{ color: 'var(--accent-purple)' }}>{sortAsc ? '↑' : '↓'}</span>;
  }

  const pageNums = useMemo(() => {
    const nums: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (safePage > 3) nums.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) nums.push(i);
      if (safePage < totalPages - 2) nums.push('...');
      nums.push(totalPages);
    }
    return nums;
  }, [totalPages, safePage]);

  return (
    <>
      <div className="page-body">
        <BirthdayBanner alerts={birthdayAlerts} settings={settings} onSelectCustomer={onSelectCustomer} />
        <style>{`
          @media (max-width: 768px) {
            .customers-table-wrapper { display: none !important; }
            .customers-card-list { display: flex !important; }
            .table-toolbar { flex-wrap: wrap !important; gap: 8px !important; }
            .table-toolbar .search-box { flex: 1 1 100% !important; min-width: 0 !important; }
            .table-toolbar .btn-primary { flex: 1 1 100% !important; }
          }
          @media (min-width: 769px) {
            .customers-card-list { display: none !important; }
            .customers-table-wrapper { display: block !important; }
          }
          .customers-card-list {
            display: none;
            flex-direction: column;
            gap: 10px;
            padding: 4px 0;
          }
          .cust-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            cursor: pointer;
            transition: box-shadow 0.2s, border-color 0.2s;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }
          .cust-card:active {
            box-shadow: 0 0 0 2px rgba(124,58,237,0.35);
            border-color: rgba(124,58,237,0.4);
          }
          .cust-card-top {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .cust-card-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            color: white;
            flex-shrink: 0;
          }
          .cust-card-info {
            flex: 1;
            min-width: 0;
          }
          .cust-card-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .cust-card-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 3px;
            flex-wrap: wrap;
          }
          .cust-card-city {
            font-size: 11px;
            color: var(--text-muted);
          }
          .cust-card-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .cust-card-stat {
            background: var(--bg-tertiary);
            border-radius: 10px;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .cust-card-stat-label {
            font-size: 9px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .cust-card-stat-val {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-primary);
          }
          .cust-card-stat-val.green { color: var(--accent-green); }
          .cust-card-stat-val.purple { color: var(--accent-purple); }
          .cust-card-links {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .cust-card-link {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            text-decoration: none;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
          }
          .cust-card-link-ig {
            background: rgba(124,58,237,0.12);
            color: var(--text-accent);
          }
          .cust-card-link-wa {
            background: rgba(16,185,129,0.12);
            color: var(--accent-green);
          }
          .cust-card-link-view {
            background: rgba(100,116,139,0.12);
            color: var(--text-secondary);
            border: none;
            cursor: pointer;
            font-family: inherit;
            margin-left: auto;
          }
          [data-theme='light'] .cust-card {
            background: #ffffff;
            border-color: #e2e8f0;
          }
          [data-theme='light'] .cust-card-stat {
            background: #f1f5f9;
          }
        `}</style>
        <div className="card">
          {/* Toolbar */}
          <div className="table-toolbar" style={{ gap: 12 }}>
            <div className="search-box" style={{ minWidth: 240 }}>
              <Search size={15} className="search-icon" />
              <input
                value={searchQuery}
                onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
                placeholder="Search customers…"
              />
            </div>
            
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '0 16px', height: 38 }}>
              + Add Customer
            </button>

            <div className="toolbar-spacer" />
            <span className="result-count">{filtered.length} customers</span>
          </div>

          {/* Table - Desktop Only */}
          <div className="customers-table-wrapper table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th className={sortKey === 'nama' ? 'sorted' : ''} onClick={() => handleSort('nama')}>
                    <div className="th-inner">Customer <SortIcon col="nama" /></div>
                  </th>
                  <th>Instagram</th>
                  <th>WhatsApp</th>
                  <th className={sortKey === 'city' ? 'sorted' : ''} onClick={() => handleSort('city')}>
                    <div className="th-inner">City <SortIcon col="city" /></div>
                  </th>
                  <th className={sortKey === 'orderCount' ? 'sorted' : ''} onClick={() => handleSort('orderCount')}>
                    <div className="th-inner">Orders <SortIcon col="orderCount" /></div>
                  </th>
                  <th className={sortKey === 'totalSpend' ? 'sorted' : ''} onClick={() => handleSort('totalSpend')}>
                    <div className="th-inner">Total Spend <SortIcon col="totalSpend" /></div>
                  </th>
                  <th>Poin</th>
                  <th className={sortKey === 'lastOrder' ? 'sorted' : ''} onClick={() => handleSort('lastOrder')}>
                    <div className="th-inner">Last Order <SortIcon col="lastOrder" /></div>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <div className="empty-title">No customers found</div>
                        <div className="empty-text">Try adjusting your search query</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageData.map((c, i) => {
                    const colorIdx = c.nama.charCodeAt(0) % GRAD_COLORS.length;
                    return (
                      <tr key={c.id} onClick={() => onSelectCustomer(c)}>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {(safePage - 1) * rowsPerPage + i + 1}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: GRAD_COLORS[colorIdx],
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10.5, fontWeight: 700, color: 'white', flexShrink: 0,
                            }}>
                              {initials(c.nama)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="td-name" style={{ whiteSpace: 'nowrap' }}>{c.nama}</span>
                              {(() => {
                                const lbl = getCustomerLabel(c.totalSpend, c.orderCount, settings?.vipMinSpend, settings?.loyalMinOrders);
                                if (lbl === 'vip') return <span className="badge-customer-vip" style={{ fontSize: 9, padding: '1px 5px' }}>👑 VIP</span>;
                                if (lbl === 'loyal') return <span className="badge-customer-loyal" style={{ fontSize: 9, padding: '1px 5px' }}>⭐ Loyal</span>;
                                if (lbl === 'new') return <span className="badge-customer-new" style={{ fontSize: 9, padding: '1px 5px' }}>✨ Baru</span>;
                                return null;
                              })()}
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const igHandle = extractInstagramUsername(c.instagram);
                            const igUrl = generateInstaLink(c.instagram, c.nama);
                            return igHandle ? (
                              <a
                                href={igUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: 'var(--text-accent)',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12.5,
                                  transition: 'color 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#c4b5fd')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-accent)')}
                              >
                                @{igHandle}
                                <span style={{ fontSize: 9, opacity: 0.5 }}>↗</span>
                              </a>
                            ) : '—';
                          })()}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {c.wa ? (
                            <a
                              href={`https://wa.me/${c.wa.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: 'var(--accent-green)',
                                textDecoration: 'none',
                                fontSize: 12.5,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'opacity 0.15s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            >
                              {c.wa}
                              <span style={{ fontSize: 9, opacity: 0.5 }}>↗</span>
                            </a>
                          ) : '—'}
                        </td>
                        <td 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (c.city && c.city !== '—') {
                              onSearchChange(c.city);
                              setPage(1);
                            }
                          }}
                          style={{
                            color: (c.city && c.city !== '—') ? 'var(--text-accent)' : 'inherit',
                            cursor: (c.city && c.city !== '—') ? 'pointer' : 'default',
                            fontWeight: (c.city && c.city !== '—') ? 600 : 'normal'
                          }}
                          onMouseEnter={(e) => {
                            if (c.city && c.city !== '—') {
                              e.currentTarget.style.textDecoration = 'underline';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                          title={(c.city && c.city !== '—') ? `Klik untuk melihat customer di ${c.city}` : undefined}
                        >
                          {c.city || '—'}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 26, height: 26, borderRadius: 6,
                            background: 'rgba(124,58,237,0.15)', color: 'var(--accent-purple)',
                            fontSize: 12, fontWeight: 700,
                          }}>
                            {c.orderCount}
                          </span>
                        </td>
                        <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                          {c.totalSpend > 0 ? formatRupiah(c.totalSpend) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12 }}>💎</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{calcLoyalty(c).points}</span>
                          </div>
                        </td>
                        <td>{c.lastOrder || '—'}</td>
                        <td onClick={(e) => { e.stopPropagation(); onSelectCustomer(c); }}>
                          <button className="btn btn-secondary" style={{ padding: '4px 10px' }}>
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="customers-card-list">
            {pageData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No customers found</div>
                <div className="empty-text">Try adjusting your search query</div>
              </div>
            ) : (
              pageData.map((c, i) => {
                const colorIdx = c.nama.charCodeAt(0) % GRAD_COLORS.length;
                const lbl = getCustomerLabel(c.totalSpend, c.orderCount, settings?.vipMinSpend, settings?.loyalMinOrders);
                const igHandle = c.instagram
                  ? c.instagram.replace('https://www.instagram.com/', '').replace('https://www.instagram.com', '').replace(/^@/, '').split('\n')[0]
                  : null;
                const igUrl = c.instagram
                  ? (c.instagram.startsWith('http') ? c.instagram : `https://www.instagram.com/${c.instagram.replace('@', '')}`)
                  : null;
                const waUrl = c.wa
                  ? `https://wa.me/${c.wa.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
                  : null;

                return (
                  <div
                    key={c.id}
                    className="cust-card"
                    onClick={() => onSelectCustomer(c)}
                  >
                    {/* Top row: avatar + name + label */}
                    <div className="cust-card-top">
                      <div
                        className="cust-card-avatar"
                        style={{ background: GRAD_COLORS[colorIdx] }}
                      >
                        {initials(c.nama)}
                      </div>
                      <div className="cust-card-info">
                        <div className="cust-card-name">
                          <span style={{ marginRight: 4 }}>{(safePage - 1) * rowsPerPage + i + 1}.</span>
                          {c.nama}
                        </div>
                        <div className="cust-card-meta">
                          {lbl === 'vip' && <span className="badge-customer-vip" style={{ fontSize: 9, padding: '1px 5px' }}>👑 VIP</span>}
                          {lbl === 'loyal' && <span className="badge-customer-loyal" style={{ fontSize: 9, padding: '1px 5px' }}>⭐ Loyal</span>}
                          {lbl === 'new' && <span className="badge-customer-new" style={{ fontSize: 9, padding: '1px 5px' }}>✨ Baru</span>}
                          {c.city && c.city !== '—' && (
                            <span className="cust-card-city">📍 {c.city}</span>
                          )}
                          {c.lastOrder && (
                            <span className="cust-card-city">🕐 {c.lastOrder}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="cust-card-stats">
                      <div className="cust-card-stat">
                        <div className="cust-card-stat-label">Orders</div>
                        <div className="cust-card-stat-val purple">{c.orderCount}</div>
                      </div>
                      <div className="cust-card-stat">
                        <div className="cust-card-stat-label">Total Spend</div>
                        <div className="cust-card-stat-val green">
                          {c.totalSpend > 0 ? formatRupiah(c.totalSpend) : '—'}
                        </div>
                      </div>
                      <div className="cust-card-stat" style={{ gridColumn: '1 / -1' }}>
                        <div className="cust-card-stat-label">Poin Loyalitas</div>
                        <div className="cust-card-stat-val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12 }}>💎</span>
                          <span>{calcLoyalty(c).points} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Links + View */}
                    <div className="cust-card-links" onClick={(e) => e.stopPropagation()}>
                      {igHandle && igUrl && (
                        <a href={igUrl} target="_blank" rel="noopener noreferrer" className="cust-card-link cust-card-link-ig">
                          📸 @{igHandle.length > 12 ? igHandle.slice(0, 12) + '…' : igHandle}
                        </a>
                      )}
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer" className="cust-card-link cust-card-link-wa">
                          💬 WA
                        </a>
                      )}
                      <button
                        className="cust-card-link cust-card-link-view"
                        onClick={(e) => { e.stopPropagation(); onSelectCustomer(c); }}
                      >
                        👁 Detail
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="page-info">Rows per page:</span>
              <select
                className="rows-select"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(+e.target.value); setPage(1); }}
              >
                {ROWS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <span className="page-info">
              {(safePage - 1) * rowsPerPage + 1}–{Math.min(safePage * rowsPerPage, sorted.length)} of {sorted.length}
            </span>
            <div className="page-controls">
              <button className="page-btn" onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button className="page-btn" onClick={() => setPage((p) => p - 1)} disabled={safePage === 1}>‹</button>
              {pageNums.map((n, i) =>
                n === '...' ? (
                  <span key={`dots-${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>…</span>
                ) : (
                  <button key={n} className={`page-btn ${safePage === n ? 'active' : ''}`} onClick={() => setPage(n as number)}>
                    {n}
                  </button>
                )
              )}
              <button className="page-btn" onClick={() => setPage((p) => p + 1)} disabled={safePage === totalPages}>›</button>
              <button className="page-btn" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          </div>
        </div>
      </div>

      {activeCustomer && (
        <CustomerDrawer
          customer={activeCustomer}
          onClose={() => onSelectCustomer(null)}
          onEditCustomer={onEditCustomer}
          onDeleteCustomer={onDeleteCustomer}
          onAddOrder={onAddOrder}
          onEditOrder={onEditOrder}
          onDeleteOrder={onDeleteOrder}
          settings={settings}
        />
      )}

      {showAddModal && (
        <CustomerFormModal
          onSave={(data) => {
            onAddCustomer(data);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}
