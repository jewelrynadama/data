// src/pages/OrdersPage.tsx
import { useState, useMemo } from 'react';
import { Search, Printer, Edit2, Trash2 } from 'lucide-react';
import type { CustomerRow, Customer } from '../types';
import { getJenisBadgeClass, getPearlBadgeClass, parseDateToSortValue } from '../utils/csvLoader';
import OrderFormModal from '../components/OrderFormModal';
import { printInvoice } from '../utils/printHelper';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '⏳ Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  dikirim:  { label: '🚚 Dikirim',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  selesai:  { label: '✅ Selesai',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  retur:    { label: '↩️ Retur',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

interface Props {
  rows: CustomerRow[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onAddOrder: (order: Partial<CustomerRow>) => void;
  onEditOrder: (id: string, patch: Partial<CustomerRow>) => void;
  onDeleteOrder: (id: string) => void;
  onBatchEditOrders: (ids: string[], patch: Partial<CustomerRow>) => void;
  onBatchDeleteOrders: (ids: string[]) => void;
  customers: Customer[];
}

type SortKey = 'tanggalOrder' | 'namaInstagram' | 'jenis' | 'type' | 'totalBayar' | 'paymentVia' | 'grade' | 'size' | 'color' | 'orderStatus';

const ROWS_OPTIONS = [15, 25, 50, 100];

export default function OrdersPage({ rows, searchQuery, onSearchChange, onAddOrder, onEditOrder, onDeleteOrder, onBatchEditOrders, onBatchDeleteOrders, customers }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tanggalOrder');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterPearl, setFilterPearl] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [focusType, setFocusType] = useState('');
  const [focusPearl, setFocusPearl] = useState('');
  const [focusPayment, setFocusPayment] = useState('');
  const [focusGrade, setFocusGrade] = useState('');
  const [focusSize, setFocusSize] = useState('');
  const [focusColor, setFocusColor] = useState('');

  // Only rows with actual order data
  const orderRows = useMemo(() => rows.filter((r) => r.jenis), [rows]);

  // Calculate frequencies/counts for each value
  const typeFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.jenis) map[r.jenis] = (map[r.jenis] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const pearlFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.type) map[r.type] = (map[r.type] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const paymentFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.paymentVia) map[r.paymentVia] = (map[r.paymentVia] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const gradeFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.grade) map[r.grade] = (map[r.grade] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const sizeFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.size) map[r.size] = (map[r.size] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const colorFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      if (r.color) map[r.color] = (map[r.color] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  const statusFreq = useMemo(() => {
    const map: Record<string, number> = {};
    orderRows.forEach((r) => {
      const s = r.orderStatus || 'pending';
      map[s] = (map[s] || 0) + 1;
    });
    return map;
  }, [orderRows]);

  // Unique filter values sorted alphabetically or numerically
  const allTypes = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.jenis).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [orderRows]);

  const allPearls = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.type).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [orderRows]);

  const allPayments = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.paymentVia).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [orderRows]);

  const allGrades = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.grade).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [orderRows]);

  const allSizes = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.size).filter(Boolean))];
    const parseSize = (s: string) => {
      const match = s.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[0]) : 9999;
    };
    return unique.sort((a, b) => parseSize(a) - parseSize(b));
  }, [orderRows]);

  const allColors = useMemo(() => {
    const unique = [...new Set(orderRows.map((r) => r.color).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [orderRows]);

  // Filter rows by search query AND strict dropdown filters
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orderRows.filter((r) => {
      const matchesSearch = !q ||
        r.namaInstagram.toLowerCase().includes(q) ||
        r.jenis.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q) ||
        r.tanggalOrder.includes(q) ||
        r.totalBayar.includes(q);

      if (!matchesSearch) return false;

      if (filterType && r.jenis !== filterType) return false;
      if (filterPearl && r.type !== filterPearl) return false;
      if (filterSize && r.size !== filterSize) return false;
      if (filterColor && r.color !== filterColor) return false;
      if (filterGrade && r.grade !== filterGrade) return false;
      if (filterPayment && r.paymentVia !== filterPayment) return false;
      if (filterStatus && (r.orderStatus || 'pending') !== filterStatus) return false;

      return true;
    });
  }, [orderRows, searchQuery, filterType, filterPearl, filterSize, filterColor, filterGrade, filterPayment, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // 1. Priority grouping check (selected variants placed at the top)
      if (sortKey === 'jenis' && focusType) {
        const aMatch = a.jenis === focusType;
        const bMatch = b.jenis === focusType;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      if (sortKey === 'type' && focusPearl) {
        const aMatch = a.type === focusPearl;
        const bMatch = b.type === focusPearl;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      if (sortKey === 'grade' && focusGrade) {
        const aMatch = a.grade === focusGrade;
        const bMatch = b.grade === focusGrade;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      if (sortKey === 'paymentVia' && focusPayment) {
        const aMatch = a.paymentVia === focusPayment;
        const bMatch = b.paymentVia === focusPayment;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      if (sortKey === 'size' && focusSize) {
        const aMatch = a.size === focusSize;
        const bMatch = b.size === focusSize;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      if (sortKey === 'color' && focusColor) {
        const aMatch = a.color === focusColor;
        const bMatch = b.color === focusColor;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // 2. Standard sort comparison (frequencies for categorical, normal for total/date/strings)
      let av: string | number = (a[sortKey as keyof CustomerRow] as string) || '';
      let bv: string | number = (b[sortKey as keyof CustomerRow] as string) || '';

      if (sortKey === 'totalBayar') {
        av = parseInt((av as string).replace(/\D/g, '') || '0', 10);
        bv = parseInt((bv as string).replace(/\D/g, '') || '0', 10);
      } else if (sortKey === 'tanggalOrder') {
        av = parseDateToSortValue(av as string);
        bv = parseDateToSortValue(bv as string);
      } else if (sortKey === 'orderStatus') {
        av = (a.orderStatus || 'pending').toLowerCase();
        bv = (b.orderStatus || 'pending').toLowerCase();
      } else if (sortKey === 'jenis') {
        av = typeFreq[a.jenis] || 0;
        bv = typeFreq[b.jenis] || 0;
        if (av === bv) {
          av = (a.jenis || '').toLowerCase();
          bv = (b.jenis || '').toLowerCase();
        }
      } else if (sortKey === 'type') {
        av = pearlFreq[a.type] || 0;
        bv = pearlFreq[b.type] || 0;
        if (av === bv) {
          av = (a.type || '').toLowerCase();
          bv = (b.type || '').toLowerCase();
        }
      } else if (sortKey === 'paymentVia') {
        av = paymentFreq[a.paymentVia] || 0;
        bv = paymentFreq[b.paymentVia] || 0;
        if (av === bv) {
          av = (a.paymentVia || '').toLowerCase();
          bv = (b.paymentVia || '').toLowerCase();
        }
      } else if (sortKey === 'grade') {
        av = gradeFreq[a.grade] || 0;
        bv = gradeFreq[b.grade] || 0;
        if (av === bv) {
          av = (a.grade || '').toLowerCase();
          bv = (b.grade || '').toLowerCase();
        }
      } else if (sortKey === 'size') {
        av = sizeFreq[a.size] || 0;
        bv = sizeFreq[b.size] || 0;
        if (av === bv) {
          av = (a.size || '').toLowerCase();
          bv = (b.size || '').toLowerCase();
        }
      } else if (sortKey === 'color') {
        av = colorFreq[a.color] || 0;
        bv = colorFreq[b.color] || 0;
        if (av === bv) {
          av = (a.color || '').toLowerCase();
          bv = (b.color || '').toLowerCase();
        }
      } else {
        av = (av as string).toLowerCase();
        bv = (bv as string).toLowerCase();
      }

      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc, focusType, focusPearl, focusGrade, focusPayment, focusSize, focusColor, typeFreq, pearlFreq, paymentFreq, gradeFreq, sizeFreq, colorFreq]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const pageData = sorted.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(false); }
    setPage(1);
  }

  function cycleFocus(current: string, allValues: string[], setFocus: (val: string) => void, key: SortKey) {
    const idx = allValues.indexOf(current);
    let nextVal = '';
    if (idx === -1) {
      nextVal = allValues[0] || '';
    } else if (idx === allValues.length - 1) {
      nextVal = '';
    } else {
      nextVal = allValues[idx + 1];
    }
    setFocus(nextVal);
    setSortKey(key);
    setSortAsc(false);
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
    <div className="page-body">
      <style>{`
        .mass-update-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateX(128px);
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 12px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
          z-index: 999;
          animation: massBarSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        [data-theme='light'] .mass-update-bar {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(0,0,0,0.1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        [data-theme='light'] .mass-update-bar span {
          color: #0f172a !important;
        }
        [data-theme='light'] .mass-update-bar span.status-label {
          color: #64748b !important;
        }
        @keyframes massBarSlideUp {
          from { transform: translate(-50%, 20px) scale(0.95); opacity: 0; }
          to { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        .mass-update-select {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #ffffff;
          padding: 6px 12px;
          font-size: 12.5px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }
        [data-theme='light'] .mass-update-select {
          background: rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.1);
          color: #0f172a;
        }
        .mass-update-select option {
          background: #0f172a;
          color: #ffffff;
        }
        [data-theme='light'] .mass-update-select option {
          background: #ffffff;
          color: #0f172a;
        }
        .mass-update-btn-delete {
          background: rgba(239, 68, 68, 0.15);
          border: none;
          color: #ef4444;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 6px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .mass-update-btn-delete:hover {
          background: rgba(239, 68, 68, 0.25);
        }
        .mass-update-btn-clear {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .mass-update-btn-clear:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        @media (max-width: 768px) {
          .mass-update-bar {
            bottom: 72px;
            left: 16px;
            right: 16px;
            transform: none;
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
            padding: 16px;
          }
          .orders-table-wrapper { display: none !important; }
          .orders-card-list { display: flex !important; }
          .orders-toolbar-filters { flex-wrap: wrap; gap: 8px !important; }
          .orders-toolbar-filters select { flex: 1 1 calc(50% - 4px); min-width: 0; }
          .table-toolbar { flex-wrap: wrap !important; gap: 8px !important; }
          .table-toolbar .search-box { flex: 1 1 100% !important; min-width: 0 !important; }
          .table-toolbar .btn { flex: 1 1 100% !important; }
        }
        @media (min-width: 769px) {
          .orders-card-list { display: none !important; }
          .orders-table-wrapper { display: block !important; }
        }
        .orders-card-list {
          display: none;
          flex-direction: column;
          gap: 10px;
          padding: 4px 0;
        }
        .order-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: box-shadow 0.2s;
          position: relative;
        }
        .order-card:active {
          box-shadow: 0 0 0 2px rgba(124,58,237,0.3);
        }
        .order-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .order-card-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .order-card-date {
          font-size: 11px;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .order-card-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .order-card-chip {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .order-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .order-card-total {
          font-size: 15px;
          font-weight: 800;
          color: var(--accent-green);
        }
        .order-card-actions {
          display: flex;
          gap: 8px;
        }
        .order-card-actions button {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          touch-action: manipulation;
          transition: all 0.15s;
        }
        .order-card-btn-print {
          background: rgba(124,58,237,0.12);
          color: var(--accent-purple);
        }
        .order-card-btn-print:active { background: rgba(124,58,237,0.25); }
        .order-card-btn-edit {
          background: rgba(59,130,246,0.12);
          color: #60a5fa;
        }
        .order-card-btn-edit:active { background: rgba(59,130,246,0.25); }
        .order-card-btn-del {
          background: rgba(239,68,68,0.12);
          color: var(--accent-red);
        }
        .order-card-btn-del:active { background: rgba(239,68,68,0.25); }
        .order-card-no {
          position: absolute;
          top: 14px;
          right: 14px;
          font-size: 10px;
          color: var(--text-muted);
          font-weight: 600;
        }
        [data-theme='light'] .order-card {
          background: #ffffff;
          border-color: #e2e8f0;
        }
        [data-theme='light'] .order-card-btn-edit { color: #2563eb; }
      `}</style>
      <div className="card">
        {/* Toolbar */}
        <div className="table-toolbar" style={{ gap: 12 }}>
          <div className="search-box" style={{ minWidth: 240 }}>
            <Search size={15} className="search-icon" />
            <input
              value={searchQuery}
              onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
              placeholder="Search orders…"
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ padding: '0 16px', height: 38 }}>
            + Add Order
          </button>
          <select className="filter-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {allTypes.map((t) => <option key={t} value={t}>{t} ({typeFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterPearl} onChange={(e) => { setFilterPearl(e.target.value); setPage(1); }}>
            <option value="">All Pearls</option>
            {allPearls.map((t) => <option key={t} value={t}>{t} ({pearlFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterSize} onChange={(e) => { setFilterSize(e.target.value); setPage(1); }}>
            <option value="">All Sizes</option>
            {allSizes.map((t) => <option key={t} value={t}>{t} ({sizeFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterColor} onChange={(e) => { setFilterColor(e.target.value); setPage(1); }}>
            <option value="">All Colors</option>
            {allColors.map((t) => <option key={t} value={t}>{t} ({colorFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setPage(1); }}>
            <option value="">All Grades</option>
            {allGrades.map((t) => <option key={t} value={t}>{t} ({gradeFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterPayment} onChange={(e) => { setFilterPayment(e.target.value); setPage(1); }}>
            <option value="">All Payments</option>
            {allPayments.map((t) => <option key={t} value={t}>{t} ({paymentFreq[t] || 0})</option>)}
          </select>
          <select className="filter-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="pending">⏳ Pending ({statusFreq['pending'] || 0})</option>
            <option value="dikirim">🚚 Dikirim ({statusFreq['dikirim'] || 0})</option>
            <option value="selesai">✅ Selesai ({statusFreq['selesai'] || 0})</option>
            <option value="retur">↩️ Retur ({statusFreq['retur'] || 0})</option>
          </select>
          <div className="toolbar-spacer" />
          <span className="result-count">
            {(filterType || filterPearl || filterGrade || filterPayment || filterSize || filterColor || filterStatus) ? (
              <span style={{ color: 'var(--text-accent)' }}>Filtered: {filtered.length} of {orderRows.length} orders</span>
            ) : (
              <span>{filtered.length} orders</span>
            )}
          </span>
        </div>

        {/* Desktop Table */}
        <div className="orders-table-wrapper table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={pageData.length > 0 && pageData.every(r => selectedIds.includes(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelected = [...selectedIds];
                        pageData.forEach(r => {
                          if (!newSelected.includes(r.id)) newSelected.push(r.id);
                        });
                        setSelectedIds(newSelected);
                      } else {
                        const pageIds = pageData.map(r => r.id);
                        setSelectedIds(selectedIds.filter(id => !pageIds.includes(id)));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th className={sortKey === 'namaInstagram' ? 'sorted' : ''} onClick={() => handleSort('namaInstagram')}>
                  <div className="th-inner">Customer <SortIcon col="namaInstagram" /></div>
                </th>
                <th className={sortKey === 'tanggalOrder' ? 'sorted' : ''} onClick={() => handleSort('tanggalOrder')}>
                  <div className="th-inner">Date <SortIcon col="tanggalOrder" /></div>
                </th>
                <th className={sortKey === 'orderStatus' ? 'sorted' : ''} onClick={() => handleSort('orderStatus')}>
                  <div className="th-inner">Status <SortIcon col="orderStatus" /></div>
                </th>
                <th className={focusType ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusType, allTypes, setFocusType, 'jenis')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Type {focusType ? `(${focusType})` : ''} 
                    <span className="sort-arrow" style={{ color: focusType ? 'var(--accent-purple)' : undefined }}>
                      {focusType ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusPearl ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusPearl, allPearls, setFocusPearl, 'type')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Pearl {focusPearl ? `(${focusPearl})` : ''} 
                    <span className="sort-arrow" style={{ color: focusPearl ? 'var(--accent-purple)' : undefined }}>
                      {focusPearl ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusSize ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusSize, allSizes, setFocusSize, 'size')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Size {focusSize ? `(${focusSize})` : ''} 
                    <span className="sort-arrow" style={{ color: focusSize ? 'var(--accent-purple)' : undefined }}>
                      {focusSize ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusColor ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusColor, allColors, setFocusColor, 'color')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Color {focusColor ? `(${focusColor})` : ''} 
                    <span className="sort-arrow" style={{ color: focusColor ? 'var(--accent-purple)' : undefined }}>
                      {focusColor ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusGrade ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusGrade, allGrades, setFocusGrade, 'grade')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Grade {focusGrade ? `(${focusGrade})` : ''} 
                    <span className="sort-arrow" style={{ color: focusGrade ? 'var(--accent-purple)' : undefined }}>
                      {focusGrade ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusPayment ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusPayment, allPayments, setFocusPayment, 'paymentVia')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Payment {focusPayment ? `(${focusPayment})` : ''} 
                    <span className="sort-arrow" style={{ color: focusPayment ? 'var(--accent-purple)' : undefined }}>
                      {focusPayment ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={sortKey === 'totalBayar' ? 'sorted' : ''} onClick={() => handleSort('totalBayar')}>
                  <div className="th-inner">Total <SortIcon col="totalBayar" /></div>
                </th>
                <th style={{ width: 80, textTransform: 'uppercase', fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.5px', textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <div className="empty-title">No orders found</div>
                      <div className="empty-text">Try adjusting your search or filters</div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageData.map((r, i) => (
                  <tr key={r.id} style={{ background: selectedIds.includes(r.id) ? 'rgba(124, 58, 237, 0.05)' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, r.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== r.id));
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{(safePage - 1) * rowsPerPage + i + 1}</span>
                      </div>
                    </td>
                    <td className="td-name">{r.namaInstagram || r.namaPengiriman || '—'}</td>
                    <td>{r.tanggalOrder || '—'}</td>
                    <td>
                      {(() => {
                        const statusCfg = STATUS_CONFIG[r.orderStatus || 'pending'];
                        return (
                          <select
                            value={r.orderStatus || 'pending'}
                            onChange={(e) => {
                              onEditOrder(r.id, { orderStatus: e.target.value as any });
                            }}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 20px 2px 6px',
                              borderRadius: 4,
                              color: statusCfg?.color || 'var(--text-muted)',
                              background: statusCfg?.bg || 'rgba(255,255,255,0.05)',
                              border: '1px solid transparent',
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(statusCfg?.color || '#94a3b8')}' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 6px center',
                              fontFamily: 'inherit'
                            }}
                          >
                            <option value="pending" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>⏳ Pending</option>
                            <option value="dikirim" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>🚚 Dikirim</option>
                            <option value="selesai" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>✅ Selesai</option>
                            <option value="retur" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>↩️ Retur</option>
                          </select>
                        );
                      })()}
                    </td>
                    <td>
                      {r.jenis ? (
                        <span className={`badge ${getJenisBadgeClass(r.jenis)}`}>{r.jenis}</span>
                      ) : '—'}
                    </td>
                    <td>
                      {r.type ? (
                        <span className={`badge ${getPearlBadgeClass(r.type)}`}>{r.type}</span>
                      ) : '—'}
                    </td>
                    <td>{r.size || '—'}</td>
                    <td>{r.color || '—'}</td>
                    <td>
                      {r.grade ? (
                        <span className="badge badge-aa">{r.grade}</span>
                      ) : '—'}
                    </td>
                    <td>
                      {r.paymentVia ? (
                        <span className="badge badge-default">{r.paymentVia}</span>
                      ) : '—'}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      {r.totalBayar
                        ? `Rp ${parseInt(r.totalBayar.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}`
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button
                          className="icon-btn"
                          style={{ width: 24, height: 24, color: 'var(--text-accent)' }}
                          onClick={() => {
                            const customer: Customer = customers.find(c => c.nama.toLowerCase() === r.namaInstagram.toLowerCase())
                              || {
                                id: '',
                                nama: r.namaInstagram || r.namaPengiriman || 'Pelanggan',
                                wa: r.wa || '',
                                alamat: r.alamat || '',
                                city: '',
                                orders: [],
                                totalSpend: 0,
                                orderCount: 0,
                                lastOrder: '',
                                instagram: r.instagram || '',
                                tanggalUlangTahun: r.tanggalUlangTahun || ''
                              };
                            printInvoice(customer, r);
                          }}
                          title="Cetak Nota Order"
                        >
                          <Printer size={12} />
                        </button>
                        <button
                          className="icon-btn"
                          style={{ width: 24, height: 24 }}
                          onClick={() => setEditingOrder(r)}
                          title="Edit order"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="icon-btn"
                          style={{ width: 24, height: 24, color: 'var(--accent-red)' }}
                          onClick={() => {
                            if (window.confirm('Apakah Anda yakin ingin menghapus order ini?')) {
                               onDeleteOrder(r.id);
                            }
                          }}
                          title="Hapus order"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="orders-card-list">
          {pageData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No orders found</div>
              <div className="empty-text">Try adjusting your search or filters</div>
            </div>
          ) : (
            pageData.map((r, i) => {
              const statusCfg = STATUS_CONFIG[r.orderStatus || 'pending'];
              return (
                <div key={r.id} className="order-card">
                  <span className="order-card-no">#{(safePage - 1) * rowsPerPage + i + 1}</span>
                  <div className="order-card-header">
                    <div className="order-card-name">{r.namaInstagram || r.namaPengiriman || '—'}</div>
                    <div className="order-card-date">{r.tanggalOrder || '—'}</div>
                  </div>
                  <div className="order-card-chips">
                    {/* Status */}
                    <select
                      value={r.orderStatus || 'pending'}
                      onChange={(e) => onEditOrder(r.id, { orderStatus: e.target.value as any })}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 20px 3px 8px',
                        borderRadius: 20,
                        color: statusCfg?.color || 'var(--text-muted)',
                        background: statusCfg?.bg || 'rgba(255,255,255,0.05)',
                        border: `1px solid ${statusCfg?.color || 'transparent'}`,
                        cursor: 'pointer',
                        outline: 'none',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(statusCfg?.color || '#94a3b8')}' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 6px center',
                        fontFamily: 'inherit',
                      }}
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="dikirim">🚚 Dikirim</option>
                      <option value="selesai">✅ Selesai</option>
                      <option value="retur">↩️ Retur</option>
                    </select>
                    {r.jenis && <span className={`badge ${getJenisBadgeClass(r.jenis)}`}>{r.jenis}</span>}
                    {r.type && <span className={`badge ${getPearlBadgeClass(r.type)}`}>{r.type}</span>}
                    {r.size && <span className="order-card-chip">📏 {r.size}</span>}
                    {r.color && <span className="order-card-chip">🎨 {r.color}</span>}
                    {r.grade && <span className="badge badge-aa">{r.grade}</span>}
                    {r.paymentVia && <span className="badge badge-default">{r.paymentVia}</span>}
                  </div>
                  <div className="order-card-footer">
                    <div className="order-card-total">
                      {r.totalBayar
                        ? `Rp ${parseInt(r.totalBayar.replace(/\D/g, '') || '0', 10).toLocaleString('id-ID')}`
                        : '—'}
                    </div>
                    <div className="order-card-actions">
                      <button
                        className="order-card-btn-print"
                        onClick={() => {
                          const customer: Customer = customers.find(c => c.nama.toLowerCase() === r.namaInstagram.toLowerCase())
                            || { id: '', nama: r.namaInstagram || r.namaPengiriman || 'Pelanggan', wa: r.wa || '', alamat: r.alamat || '', city: '', orders: [], totalSpend: 0, orderCount: 0, lastOrder: '', instagram: r.instagram || '', tanggalUlangTahun: r.tanggalUlangTahun || '' };
                          printInvoice(customer, r);
                        }}
                        title="Cetak Nota"
                      >
                        <Printer size={11} /> Nota
                      </button>
                      <button
                        className="order-card-btn-edit"
                        onClick={() => setEditingOrder(r)}
                        title="Edit order"
                      >
                        <Edit2 size={11} /> Edit
                      </button>
                      <button
                        className="order-card-btn-del"
                        onClick={() => {
                          if (window.confirm('Hapus order ini?')) onDeleteOrder(r.id);
                        }}
                        title="Hapus order"
                      >
                        <Trash2 size={11} /> Hapus
                      </button>
                    </div>
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
            <select className="rows-select" value={rowsPerPage} onChange={(e) => { setRowsPerPage(+e.target.value); setPage(1); }}>
              {ROWS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
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
                <span key={`d-${i}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>…</span>
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

      {showAddModal && (
        <OrderFormModal
          customers={customers}
          onSave={(data) => {
            onAddOrder(data);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingOrder && (
        <OrderFormModal
          customers={customers}
          customerName={editingOrder.namaInstagram}
          initial={editingOrder}
          onSave={(data) => {
            onEditOrder(editingOrder.id, data);
            setEditingOrder(null);
          }}
          onClose={() => setEditingOrder(null)}
        />
      )}

      {selectedIds.length > 0 && (
        <div className="mass-update-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
              {selectedIds.length} pesanan terpilih
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="status-label" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Update Status:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBatchEditOrders(selectedIds, { orderStatus: e.target.value as any });
                  setSelectedIds([]);
                }
              }}
              value=""
              className="mass-update-select"
            >
              <option value="" disabled>Pilih Status...</option>
              <option value="pending">⏳ Pending</option>
              <option value="dikirim">🚚 Dikirim</option>
              <option value="selesai">✅ Selesai</option>
              <option value="retur">↩️ Retur</option>
            </select>

            <button
              type="button"
              className="mass-update-btn-delete"
              onClick={() => {
                if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} pesanan terpilih?`)) {
                  onBatchDeleteOrders(selectedIds);
                  setSelectedIds([]);
                }
              }}
            >
              <Trash2 size={13} />
              Hapus
            </button>

            <button
              type="button"
              className="mass-update-btn-clear"
              onClick={() => setSelectedIds([])}
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
