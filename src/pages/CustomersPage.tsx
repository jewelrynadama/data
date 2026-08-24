// src/pages/CustomersPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Eye, Wand2, Clock } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah, parseDateToSortValue, getActivityStatus } from '../utils/csvLoader';
import CustomerDrawer from '../components/CustomerDrawer';
import CustomerFormModal from '../components/CustomerFormModal';
import AIMagicPasteModal from '../components/AIMagicPasteModal';
import type { BirthdayAlert } from '../utils/birthday';
import BirthdayBanner from '../components/BirthdayBanner';
import { extractInstagramUsername, generateInstaLink } from '../utils/socialIntelligenceEngine';
import { calcLoyalty } from '../utils/loyaltyEngine';
import Customer360Modal from '../components/Customer360Modal';

interface Props {
  customers: Customer[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onAddCustomer: (data: Partial<Customer> & { nama: string; orders?: CustomerRow[] }) => void;
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

export default React.memo(function CustomersPage({
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
  const [showMagicPaste, setShowMagicPaste] = useState(false);
  const [show360Customer, setShow360Customer] = useState<Customer | null>(null);

  // Local search state for immediate UI updates while typing
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync with external prop if it changes outside (e.g. from global command center)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce the call to App.tsx's state to prevent global re-renders
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  // Sync selected customer with updated data from props
  const activeCustomer = useMemo(() => {
    if (!selectedCustomer) return null;
    return customers.find((c) => c.id === selectedCustomer.id) || null;
  }, [selectedCustomer, customers]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (q.includes(' or ')) {
      const qs = q.split(' or ').map(x => x.trim()).filter(Boolean);
      return customers.filter(c => qs.some(query => 
        c.nama.toLowerCase().includes(query) ||
        c.wa.toLowerCase().includes(query)
      ));
    }
    return customers.filter(
      (c) =>
        c.nama.toLowerCase().includes(q) ||
        c.instagram.toLowerCase().includes(q) ||
        c.wa.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.alamat.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const handleFindDuplicates = () => {
    const waMap = new Map<string, Customer[]>();
    for (const c of customers) {
      if (!c.wa) continue;
      const normalized = c.wa.replace(/\D/g, '');
      if (normalized.length < 5) continue;
      if (!waMap.has(normalized)) waMap.set(normalized, []);
      waMap.get(normalized)!.push(c);
    }
    const dupes = Array.from(waMap.values()).filter(group => group.length > 1).flat().map(c => c.wa);
    if (dupes.length === 0) {
      alert('Tidy! Tidak ada duplikat berdasarkan nomor WA.');
    } else {
      onSearchChange(Array.from(new Set(dupes)).join(' OR '));
    }
  };

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

  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

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
        <div className="card">
          {/* Toolbar */}
          <div className="table-toolbar" style={{ gap: 12 }}>
            <div className="search-box" style={{ minWidth: 240 }}>
              <Search size={15} className="search-icon" />
              <input
                value={localSearch}
                onChange={(e) => { setLocalSearch(e.target.value); setPage(1); }}
                placeholder="Search customers…"
              />
            </div>
            
            <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', gap: 6 }} onClick={() => setShowMagicPaste(true)}>
              <Wand2 size={15} /> AI Magic Paste
            </button>
            <button className="btn btn-secondary" onClick={handleFindDuplicates} style={{ gap: 6 }}>
              🔍 Cari Duplikat
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <button 
                onClick={() => setViewMode('list')}
                style={{ padding: '6px 12px', border: 'none', background: viewMode === 'list' ? 'var(--accent)' : 'var(--bg-primary)', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)' }}
              >List</button>
              <button 
                onClick={() => setViewMode('kanban')}
                style={{ padding: '6px 12px', border: 'none', borderLeft: '1px solid var(--border)', background: viewMode === 'kanban' ? 'var(--accent)' : 'var(--bg-primary)', color: viewMode === 'kanban' ? '#fff' : 'var(--text-secondary)' }}
              >Kanban</button>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Add Customer
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                if(window.confirm('PERINGATAN: Semua customer & pesanan yang ditambahkan manual (bukan dari Google Sheets) akan dihapus secara permanen. Anda yakin ingin mereset sesuai Spreadsheet?')) {
                  import('../utils/localStore').then(({ clearManualAdditions }) => {
                    clearManualAdditions();
                    import('../utils/firebaseSync').then(({ clearManualAdditionsInFirestore }) => {
                      clearManualAdditionsInFirestore().finally(() => {
                        window.location.reload();
                      });
                    });
                  });
                }
              }} 
              style={{ background: '#ef4444', color: 'white', border: 'none' }}>
              Reset to Spreadsheet
            </button>

            <div className="toolbar-spacer" />
            <span className="result-count">{filtered.length} customers</span>
          </div>

          {viewMode === 'kanban' ? (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '16px', minHeight: '500px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
              {['new', 'qualified', 'proposition', 'won', 'lost'].map(stage => {
                const colCusts = sorted.filter(c => (c.crm?.stage || 'new') === stage);
                return (
                  <div key={stage} style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{stage}</span>
                      <span style={{ background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>{colCusts.length}</span>
                    </div>
                    {colCusts.map(c => {
                      const colorIdx = c.nama.charCodeAt(0) % GRAD_COLORS.length;
                      return (
                        <div key={c.id} onClick={() => onSelectCustomer(c)} style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: GRAD_COLORS[colorIdx], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 600 }}>
                              {initials(c.nama)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nama}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.city || 'No City'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>
                              {formatRupiah(c.totalSpend)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {c.orderCount} Orders
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {/* Table - Desktop Only */}
          <div className="customers-table-wrapper table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th className={sortKey === 'nama' ? 'sorted' : ''} onClick={() => handleSort('nama')}>
                    <div className="th-inner">Customer <SortIcon col="nama" /></div>
                  </th>
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
                  <th>Activity</th>
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className="td-name" style={{ whiteSpace: 'nowrap' }}>{c.nama}</span>
                                {(() => {
                                  const igHandle = extractInstagramUsername(c.instagram);
                                  const igUrl = generateInstaLink(c.instagram, c.nama);
                                  return igHandle ? (
                                    <a href={igUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-accent)', textDecoration: 'none' }} title={`@${igHandle}`}>📸</a>
                                  ) : null;
                                })()}
                                {c.wa ? (
                                  <a href={`https://wa.me/${c.wa.replace(/[^0-9]/g, '').replace(/^0/, '62')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', textDecoration: 'none' }} title={c.wa}>💬</a>
                                ) : null}
                              </div>
                              {(() => {
                                const ltvLabel = c.totalSpend > 20000000 ? 'High LTV' : c.totalSpend > 5000000 ? 'Med LTV' : null;
                                const tier = calcLoyalty(c).tier;
                                return (
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                    <span style={{ 
                                      fontSize: 9.5, 
                                      padding: '1px 5px', 
                                      borderRadius: 2,
                                      fontWeight: 600,
                                      background: tier === 'VIP' ? '#FEF3C7' : tier === 'Gold' ? '#FEF9C3' : '#F1F5F9', 
                                      color: tier === 'VIP' ? '#92400E' : tier === 'Gold' ? '#854D0E' : '#475569',
                                      border: tier === 'VIP' ? '1px solid #FDE68A' : '1px solid #E2E8F0'
                                    }}>
                                      {calcLoyalty(c).tierEmoji} {tier}
                                    </span>
                                    {ltvLabel && (
                                      <span style={{ 
                                        fontSize: 9.5, 
                                        padding: '1px 5px', 
                                        borderRadius: 2,
                                        fontWeight: 600,
                                        background: '#DCFCE7', 
                                        color: '#166534',
                                        border: '1px solid #BBF7D0'
                                      }}>
                                        {ltvLabel}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
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
                            background: 'rgba(24,119,242,0.12)', color: 'var(--accent-purple)',
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
                            <span style={{ fontSize: 12 }}>🪙</span>
                            <span style={{ fontWeight: 600 }}>{formatRupiah(calcLoyalty(c).points).replace('Rp ', '')}</span>
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const actDate = c.crm?.nextActivityDate;
                            const actType = c.crm?.nextActivityType;
                            const actSummary = c.crm?.nextActivitySummary;
                            if (!actDate && !actType && !actSummary) return <span style={{color: 'var(--text-muted)'}}>-</span>;
                            
                            const status = getActivityStatus(actDate);
                            const color = status === 'overdue' ? '#dc2626' : status === 'today' ? '#d97706' : status === 'future' ? '#16a34a' : 'var(--text-muted)';
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color }}>
                                <Clock size={14} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: 600 }}>{actType || 'Activity'} - {actDate ? new Date(actDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : 'No Date'}</span>
                                  {actSummary && <span style={{ fontSize: 11, opacity: 0.8, maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actSummary}</span>}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>{c.lastOrder || '-'}</td>
                        <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px', background: 'linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.1))', border: '1px solid rgba(124,58,237,0.3)', minWidth: 32 }}
                              onClick={() => setShow360Customer(c)}
                              title="Customer 360° View"
                            >
                              🧬
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '4px', minWidth: 32 }} onClick={() => onSelectCustomer(c)} title="View Customer Details">
                              <Eye size={13} />
                            </button>
                          </div>
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
                const loyalty = calcLoyalty(c);
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
                          <span className="badge-customer-vip" style={{ fontSize: 9, padding: '1px 5px', background: loyalty.tier === 'VIP' ? 'linear-gradient(135deg, #FFD700, #FDB931)' : 'var(--bg-secondary)', color: loyalty.tier === 'VIP' ? 'black' : 'var(--text-primary)' }}>
                            {loyalty.tierEmoji} {loyalty.tier}
                          </span>
                          {(() => {
                            const actDate = c.crm?.nextActivityDate;
                            if (actDate || c.crm?.nextActivityType) {
                              const status = getActivityStatus(actDate);
                              const color = status === 'overdue' ? '#dc2626' : status === 'today' ? '#d97706' : status === 'future' ? '#16a34a' : 'var(--text-muted)';
                              return (
                                <span title={`${c.crm?.nextActivityType || 'Activity'}: ${c.crm?.nextActivitySummary || ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${color}15`, color, padding: '2px 6px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: `1px solid ${color}30` }}>
                                  <Clock size={10} />
                                  {actDate ? new Date(actDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : 'No Date'}
                                </span>
                              );
                            }
                            return null;
                          })()}
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
            </>
          )}

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

      {showMagicPaste && (
        <AIMagicPasteModal
          onClose={() => setShowMagicPaste(false)}
          onAdd={(customerPatch, orderPatch) => {
            onAddCustomer({
              ...customerPatch,
              orders: [{...orderPatch, id: `local-order-${Date.now()}`} as CustomerRow]
            });
            setShowMagicPaste(false);
          }}
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

      {show360Customer && (
        <Customer360Modal
          customer={show360Customer}
          allCustomers={customers}
          onClose={() => setShow360Customer(null)}
          onNavigateToCustomer={(c) => {
            setShow360Customer(null);
            onSelectCustomer(c);
          }}
        />
      )}
    </>
  );
});
