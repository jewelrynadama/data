import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Package, Search, Printer, Plus, Minus, Box, X, Calendar, FileText, Edit2, ArrowDownCircle, ArrowUpCircle, ClipboardList } from 'lucide-react';
import type { CatalogItem } from '../types';
import { formatRupiah } from '../utils/csvLoader';

interface Props {
  catalogItems: CatalogItem[];
  inventoryLogs: InventoryLog[];
  onUpdateLogs: (logs: InventoryLog[]) => void;
}

export interface InventoryLog {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  kodeBarang: string;
  namaBarang: string;
  qty: number;
  price: number;
  note: string;
  imageUrl?: string;
}

export default function InventoryPage({ catalogItems, inventoryLogs, onUpdateLogs }: Props) {
  const [activeTab, setActiveTab] = useState<'katalog' | 'ledger'>('katalog');
  const [filterCat, setFilterCat] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [search, setSearch] = useState('');
  const logs = inventoryLogs || [];
  const [showModal, setShowModal] = useState(false);
  const [logType, setLogType] = useState<'IN' | 'OUT'>('IN');
  const [formData, setFormData] = useState({ kodeBarang: '', namaBarang: '', qty: 1, price: 0, note: '', imageUrl: '' });
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // --- KATALOG LOGIC ---
  const categories = useMemo(() => {
    const cats = new Set(['Semua']);
    catalogItems.forEach((p) => {
      const type = p.tipeBarang.split(' ')[0] || 'Lainnya';
      cats.add(type);
    });
    return [...cats];
  }, [catalogItems]);

  const displayed = useMemo(() => {
    return catalogItems.filter((p) => {
      if (filterCat !== 'Semua') {
        const type = p.tipeBarang.split(' ')[0] || 'Lainnya';
        if (type !== filterCat) return false;
      }
      if (filterStatus === 'Ready' && !p.isReady) return false;
      if (filterStatus === 'Sold' && p.isReady) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!p.title.toLowerCase().includes(s) && !p.kode.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [catalogItems, filterCat, filterStatus, search]);

  const readyCount = catalogItems.filter(p => p.isReady).length;
  const readyValue = catalogItems.filter(p => p.isReady).reduce((s, p) => s + p.hargaJual, 0);

  // Ledger summary
  const ledgerSummary = useMemo(() => {
    const totalIn = logs.filter(l => l.type === 'IN').reduce((s, l) => s + l.qty, 0);
    const totalOut = logs.filter(l => l.type === 'OUT').reduce((s, l) => s + l.qty, 0);
    const valueIn = logs.filter(l => l.type === 'IN').reduce((s, l) => s + (l.price || 0), 0);
    const valueOut = logs.filter(l => l.type === 'OUT').reduce((s, l) => s + (l.price || 0), 0);
    return { totalIn, totalOut, valueIn, valueOut };
  }, [logs]);

  // --- LEDGER LOGIC ---
  const handleOpenModal = (type: 'IN' | 'OUT', log?: InventoryLog) => {
    setLogType(type);
    if (log) {
      setEditingLogId(log.id);
      setFormData({ kodeBarang: log.kodeBarang, namaBarang: log.namaBarang, qty: log.qty, price: log.price, note: log.note, imageUrl: log.imageUrl || '' });
    } else {
      setEditingLogId(null);
      setFormData({ kodeBarang: '', namaBarang: '', qty: 1, price: 0, note: '', imageUrl: '' });
    }
    setShowModal(true);
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kodeBarang.trim() && !formData.namaBarang.trim()) return;
    if (editingLogId) {
      onUpdateLogs(logs.map(l => l.id === editingLogId ? {
        ...l, kodeBarang: formData.kodeBarang, namaBarang: formData.namaBarang,
        qty: formData.qty, price: formData.price, note: formData.note, imageUrl: formData.imageUrl
      } : l));
    } else {
      const newLog: InventoryLog = {
        id: `inv-${Date.now()}`, date: new Date().toISOString(), type: logType,
        kodeBarang: formData.kodeBarang, namaBarang: formData.namaBarang,
        qty: formData.qty, price: formData.price, note: formData.note, imageUrl: formData.imageUrl
      };
      onUpdateLogs([...logs, newLog]);
    }
    setShowModal(false);
    setEditingLogId(null);
  };

  const handleDeleteLog = (id: string) => {
    if (confirm('Hapus log inventori ini?')) {
      onUpdateLogs(logs.filter(l => l.id !== id));
    }
  };

  const handleKodeChange = (kode: string) => {
    setFormData(prev => ({ ...prev, kodeBarang: kode }));
    const found = catalogItems.find(c => c.kode.toLowerCase() === kode.toLowerCase());
    if (found) {
      setFormData(prev => ({
        ...prev, kodeBarang: kode,
        namaBarang: prev.namaBarang ? prev.namaBarang : found.tipeBarang,
        price: prev.price ? prev.price : found.hargaJual
      }));
    }
  };

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [logs]);

  return (
    <div className="page-body">
      <style>{`
        /* ── INVENTORY PAGE SCOPED STYLES ─────────────────── */
        .inv-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--bg-tertiary);
          border-radius: 12px;
          margin-bottom: 20px;
          width: fit-content;
        }
        .inv-tab {
          padding: 10px 22px;
          font-size: 13px;
          font-weight: 600;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .inv-tab:hover { color: var(--text-primary); }
        .inv-tab.active {
          background: var(--bg-card);
          color: var(--text-accent);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        /* Stat cards */
        .inv-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }
        .inv-stats.grid-4 {
          grid-template-columns: repeat(4, 1fr);
        }
        .inv-stat {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.2s ease;
          overflow: hidden;
          position: relative;
        }
        .inv-stat::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 14px 14px 0 0;
        }
        .inv-stat.purple::before { background: linear-gradient(90deg, #1877F2, #5B9EF4); }
        .inv-stat.green::before { background: linear-gradient(90deg, #10B981, #34D399); }
        .inv-stat.amber::before { background: linear-gradient(90deg, #F59E0B, #FBBF24); }
        .inv-stat.red::before { background: linear-gradient(90deg, #EF4444, #F87171); }
        .inv-stat-icon {
          width: 42px; height: 42px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .inv-stat-icon.purple { background: rgba(24,119,242,0.12); color: #1877F2; }
        .inv-stat-icon.green { background: rgba(16,185,129,0.12); color: #10B981; }
        .inv-stat-icon.amber { background: rgba(245,158,11,0.12); color: #F59E0B; }
        .inv-stat-icon.red { background: rgba(239,68,68,0.12); color: #EF4444; }
        .inv-stat-label { font-size: 11px; color: var(--text-muted); font-weight: 500; margin-bottom: 2px; }
        .inv-stat-value { font-size: 20px; font-weight: 700; color: var(--text-primary); line-height: 1.1; }
        .inv-stat-sub { font-size: 10.5px; color: var(--text-muted); margin-top: 2px; }

        /* Search toolbar */
        .inv-toolbar {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          align-items: center;
        }
        .inv-search {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 12px;
          flex: 1;
          min-width: 180px;
          transition: border-color 0.2s;
        }
        .inv-search:focus-within { border-color: var(--text-accent); }
        .inv-search input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 13px;
          width: 100%;
        }
        .inv-search input::placeholder { color: var(--text-muted); }
        .inv-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .inv-chip {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .inv-chip:hover { border-color: var(--text-accent); color: var(--text-primary); }
        .inv-chip.active {
          background: rgba(24,119,242,0.12);
          border-color: rgba(24,119,242,0.3);
          color: var(--text-accent);
        }

        /* Desktop table card */
        .inv-table-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }
        .inv-table-card .table-wrapper {
          width: 100%;
        }
        .inv-table-card table { 
          width: 100%; 
          border-collapse: collapse; 
          table-layout: auto;
          word-break: break-word;
        }
        .inv-table-card th {
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          text-align: left;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          position: sticky;
          top: 0;
        }
        .inv-table-card td {
          padding: 10px 14px;
          font-size: 13px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
          vertical-align: top;
        }
        .inv-table-card tr:last-child td { border-bottom: none; }
        .inv-table-card tr:hover td { background: var(--bg-card-hover); }

        /* Status badge */
        .inv-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }
        .inv-badge.ready { background: rgba(16,185,129,0.12); color: #10B981; }
        .inv-badge.sold { background: rgba(100,116,139,0.12); color: var(--text-muted); }
        .inv-badge.in { background: rgba(16,185,129,0.12); color: #10B981; }
        .inv-badge.out { background: rgba(239,68,68,0.12); color: #EF4444; }
        .inv-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Mobile cards */
        .inv-card-grid {
          display: none;
          flex-direction: column;
          gap: 10px;
        }
        .inv-mcard {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s;
        }
        .inv-mcard:active { border-color: var(--text-accent); }
        .inv-mcard-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .inv-mcard-code {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-accent);
        }
        .inv-mcard-type {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          margin-top: 3px;
          display: inline-block;
        }
        .inv-mcard-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .inv-mcard-cell {
          background: var(--bg-secondary);
          border-radius: 10px;
          padding: 10px;
        }
        .inv-mcard-cell-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .inv-mcard-cell-value {
          font-size: 12px;
          color: var(--text-primary);
          font-weight: 500;
          word-break: break-word;
        }
        .inv-mcard-price {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 4px 0;
          border-top: 1px solid var(--border);
        }

        /* Ledger action buttons */
        .inv-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .inv-action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          color: white;
          flex: 1;
          justify-content: center;
          min-width: 0;
        }
        .inv-action-btn.green { background: linear-gradient(135deg, #10B981, #059669); }
        .inv-action-btn.green:hover { box-shadow: 0 4px 14px rgba(16,185,129,0.35); transform: translateY(-1px); }
        .inv-action-btn.red { background: linear-gradient(135deg, #EF4444, #DC2626); }
        .inv-action-btn.red:hover { box-shadow: 0 4px 14px rgba(239,68,68,0.35); transform: translateY(-1px); }

        /* Ledger mobile card */
        .inv-ledger-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .inv-ledger-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .inv-ledger-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-secondary);
          border-radius: 8px;
          padding: 10px 12px;
          margin-top: 4px;
        }
        .inv-ledger-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }

        /* Empty state */
        .inv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        .inv-empty-icon {
          width: 64px; height: 64px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          background: var(--bg-tertiary);
          color: var(--text-muted);
        }

        /* Modal form styles */
        .inv-form-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .inv-form-group label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .inv-form-group input,
        .inv-form-group textarea {
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .inv-form-group input:focus,
        .inv-form-group textarea:focus {
          border-color: var(--text-accent);
          box-shadow: 0 0 0 3px rgba(24,119,242,0.1);
        }
        .inv-form-group .inv-hint {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .inv-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .inv-form-actions {
          display: flex;
          gap: 10px;
          padding-top: 8px;
        }
        .inv-form-actions button {
          flex: 1;
          padding: 12px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .inv-form-cancel {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .inv-form-cancel:hover { background: var(--bg-card-hover); }
        .inv-form-submit {
          color: white;
        }
        .inv-form-submit.green { background: linear-gradient(135deg, #10B981, #059669); }
        .inv-form-submit.red { background: linear-gradient(135deg, #EF4444, #DC2626); }
        .inv-form-submit:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.2); }

        /* Info banner */
        .inv-info-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(24,119,242,0.06);
          border: 1px solid rgba(24,119,242,0.15);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .inv-info-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(24,119,242,0.12);
          display: flex; align-items: center; justify-content: center;
          color: #1877F2;
          flex-shrink: 0;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .inv-stats, .inv-stats.grid-4 { grid-template-columns: 1fr 1fr; gap: 8px; }
          .inv-stat { padding: 12px; gap: 10px; }
          .inv-stat-icon { width: 36px; height: 36px; }
          .inv-stat-value { font-size: 16px; }
          .inv-stat-label { font-size: 10px; }
          .inv-stat-sub { display: none; }
          .inv-table-card { display: none; }
          .inv-card-grid { display: flex; }
          .inv-tabs { width: 100%; }
          .inv-tab { flex: 1; justify-content: center; padding: 10px 12px; font-size: 12px; }
          .inv-toolbar { gap: 8px; }
          .inv-search { min-width: 100%; }
          .inv-filters { width: 100%; display: flex; flex-wrap: wrap; gap: 8px; }
          .inv-action-btn { font-size: 12px; padding: 10px 14px; }
          .inv-info-banner { flex-direction: column; text-align: center; gap: 8px; }
          .inv-info-icon { display: none; }
          .inv-form-row { grid-template-columns: 1fr; }
          .inv-ledger-meta { grid-template-columns: 1fr 1fr; }
        }
        @media (min-width: 641px) {
          .inv-card-grid { display: none !important; }
        }
        @media print {
          .no-print { display: none !important; }
          .inv-card-grid { display: none !important; }
          .inv-table-card { display: block !important; overflow: visible !important; border: none !important; }
          .inv-table-card th, .inv-table-card td {
            padding: 4px 6px !important;
            font-size: 10px !important;
            border: 1px solid #000 !important;
            color: #000 !important;
          }
          .inv-table-card th { background: #f0f0f0 !important; }
        }
      `}</style>

      {/* ═══ TAB SWITCHER ═══ */}
      <div className="inv-tabs no-print">
        <button className={`inv-tab ${activeTab === 'katalog' ? 'active' : ''}`} onClick={() => setActiveTab('katalog')}>
          <Box size={16} /> Katalog Stok
        </button>
        <button className={`inv-tab ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
          <ClipboardList size={16} /> Buku Besar
        </button>
      </div>

      {/* ═══════════════════════ KATALOG TAB ═══════════════════════ */}
      {activeTab === 'katalog' && (
        <div className="fade-in">
          {/* Stats */}
          <div className="inv-stats no-print">
            <div className="inv-stat purple">
              <div>
                <div className="inv-stat-label">Total Barang</div>
                <div className="inv-stat-value">{catalogItems.length}</div>
                <div className="inv-stat-sub">Item di katalog</div>
              </div>
            </div>
            <div className="inv-stat green">
              <div>
                <div className="inv-stat-label">Stok Ready</div>
                <div className="inv-stat-value">{readyCount}</div>
                <div className="inv-stat-sub">Siap jual</div>
              </div>
            </div>
            <div className="inv-stat amber">
              <div>
                <div className="inv-stat-label">Nilai Aset</div>
                <div className="inv-stat-value" style={{ fontSize: 16 }}>{formatRupiah(readyValue)}</div>
                <div className="inv-stat-sub">Dari barang ready</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="inv-toolbar no-print">
            <div className="inv-search">
              <Search size={14} color="var(--text-muted)" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama…" />
            </div>
            <div className="inv-filters">
              {categories.map((cat) => (
                <button key={cat} className={`inv-chip ${filterCat === cat ? 'active' : ''}`} onClick={() => setFilterCat(cat)}>{cat}</button>
              ))}
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select" style={{ borderRadius: 10 }}>
              <option value="Semua">Semua Status</option>
              <option value="Ready">Ready</option>
              <option value="Sold">Sold</option>
            </select>
            <button className="btn btn-secondary print-keep" onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <Printer size={14} /> Cetak
            </button>
          </div>

          {/* Info banner */}
          <div className="inv-info-banner no-print">
            <div className="inv-info-icon"><Package size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Data Live dari Google Sheets</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Status stok (Ready/Sold) otomatis tersinkronisasi setiap kali refresh.</div>
            </div>
          </div>

          {/* Content */}
          {displayed.length === 0 ? (
            <div className="inv-table-card">
              <div className="inv-empty">
                <div className="inv-empty-icon"><Package size={28} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Tidak ada data ditemukan</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Coba ubah filter atau kata kunci pencarian</div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="inv-table-card">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Kategori</th>
                        <th>Rangka & Modal</th>
                        <th>Mutiara & Modal</th>
                        <th>Harga Jual</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((item) => {
                        const type = item.tipeBarang.split(' ')[0] || 'Lainnya';
                        return (
                          <tr key={item.kode} style={{ opacity: item.isReady ? 1 : 0.55 }}>
                            <td style={{ fontWeight: 700, color: 'var(--text-accent)' }}>{item.kode}</td>
                            <td><span className="inv-chip active" style={{ padding: '2px 10px', fontSize: 11 }}>{type}</span></td>
                            <td>
                              <div style={{ fontSize: 12 }}>{item.rangka} {item.beratRangka && `(${item.beratRangka}gr)`}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Modal: <strong>{formatRupiah(item.modalRangka)}</strong></div>
                            </td>
                            <td>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.jenisMutiara}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 4 }}>
                                {item.warnaMutiara && item.warnaMutiara !== '-' && <span>🎨 {item.warnaMutiara}</span>}
                                {item.beratMutiara && item.beratMutiara !== '-' && <span>⚖️ {item.beratMutiara}gr</span>}
                                {item.sizeMutiara && item.sizeMutiara !== '-' && <span>📏 {item.sizeMutiara}mm</span>}
                                {item.bentukMutiara && item.bentukMutiara !== '-' && <span>💠 {item.bentukMutiara}</span>}
                                {item.gradeMutiara && item.gradeMutiara !== '-' && <span>⭐ {item.gradeMutiara}</span>}
                              </div>
                              {((item.surface && item.surface !== '-') || (item.shineLuster && item.shineLuster !== '-')) && (
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', gap: 6, marginTop: 4, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
                                  {item.surface && item.surface !== '-' && <span>Sur: {item.surface}</span>}
                                  {item.shineLuster && item.shineLuster !== '-' && <span>Lus: {item.shineLuster}</span>}
                                  {item.shape && item.shape !== '-' && <span>Shp: {item.shape}</span>}
                                  {item.tisCrack && item.tisCrack !== '-' && <span>Tis: {item.tisCrack}</span>}
                                </div>
                              )}
                              {item.jenisBatu && item.jenisBatu !== '-' && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>♦️ {item.jenisBatu} {item.beratBatu && item.beratBatu !== '-' ? `(${item.beratBatu})` : ''}</div>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Modal: <strong>{formatRupiah(item.modalMutiara)}</strong></div>
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(item.hargaJual)}</td>
                            <td>
                              {item.isReady
                                ? <span className="inv-badge ready"><span className="inv-badge-dot" style={{ background: '#10B981' }} /> Ready</span>
                                : <span className="inv-badge sold">Sold</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="inv-card-grid">
                {displayed.map((item) => {
                  const type = item.tipeBarang.split(' ')[0] || 'Lainnya';
                  return (
                    <div key={item.kode} className="inv-mcard" style={{ opacity: item.isReady ? 1 : 0.55 }}>
                      <div className="inv-mcard-top">
                        <div>
                          <div className="inv-mcard-code">{item.kode}</div>
                          <div className="inv-mcard-type">{type}</div>
                        </div>
                        {item.isReady
                          ? <span className="inv-badge ready"><span className="inv-badge-dot" style={{ background: '#10B981' }} /> Ready</span>
                          : <span className="inv-badge sold">Sold</span>}
                      </div>
                      <div className="inv-mcard-row">
                        <div className="inv-mcard-cell">
                          <div className="inv-mcard-cell-label">Rangka</div>
                          <div className="inv-mcard-cell-value">
                            {item.rangka || '-'} {item.beratRangka && item.beratRangka !== '-' && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({item.beratRangka}gr)</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Modal: {formatRupiah(item.modalRangka)}</div>
                        </div>
                        <div className="inv-mcard-cell">
                          <div className="inv-mcard-cell-label">Mutiara & Batu</div>
                          <div className="inv-mcard-cell-value" style={{ marginBottom: 4 }}>{item.jenisMutiara || '-'}</div>
                          
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginBottom: 4 }}>
                            {item.warnaMutiara && item.warnaMutiara !== '-' && <span>🎨 {item.warnaMutiara}</span>}
                            {item.beratMutiara && item.beratMutiara !== '-' && <span>⚖️ {item.beratMutiara}gr</span>}
                            {item.sizeMutiara && item.sizeMutiara !== '-' && <span>📏 {item.sizeMutiara}mm</span>}
                            {item.bentukMutiara && item.bentukMutiara !== '-' && <span>💠 {item.bentukMutiara}</span>}
                            {item.gradeMutiara && item.gradeMutiara !== '-' && <span>⭐ {item.gradeMutiara}</span>}
                          </div>

                          {((item.surface && item.surface !== '-') || (item.shineLuster && item.shineLuster !== '-')) && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: 4, width: 'fit-content', marginBottom: 4 }}>
                              {item.surface && item.surface !== '-' && <span>Sur: {item.surface}</span>}
                              {item.shineLuster && item.shineLuster !== '-' && <span>Lus: {item.shineLuster}</span>}
                              {item.shape && item.shape !== '-' && <span>Shp: {item.shape}</span>}
                              {item.tisCrack && item.tisCrack !== '-' && <span>Tis: {item.tisCrack}</span>}
                            </div>
                          )}

                          {item.jenisBatu && item.jenisBatu !== '-' && (
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>♦️ {item.jenisBatu} {item.beratBatu && item.beratBatu !== '-' ? `(${item.beratBatu})` : ''}</div>
                          )}

                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Modal: {formatRupiah(item.modalMutiara)}</div>
                        </div>
                      </div>
                      <div className="inv-mcard-price">
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Harga Jual</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(item.hargaJual)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════ LEDGER TAB ═══════════════════════ */}
      {activeTab === 'ledger' && (
        <div className="fade-in">
          {/* Ledger stats */}
          <div className="inv-stats grid-4 no-print">
            <div className="inv-stat green">
              <div>
                <div className="inv-stat-label">Total Masuk</div>
                <div className="inv-stat-value">{ledgerSummary.totalIn}</div>
                <div className="inv-stat-sub">{formatRupiah(ledgerSummary.valueIn)}</div>
              </div>
            </div>
            <div className="inv-stat red">
              <div>
                <div className="inv-stat-label">Total Keluar</div>
                <div className="inv-stat-value">{ledgerSummary.totalOut}</div>
                <div className="inv-stat-sub">{formatRupiah(ledgerSummary.valueOut)}</div>
              </div>
            </div>
            <div className="inv-stat purple">
              <div>
                <div className="inv-stat-label">Saldo</div>
                <div className="inv-stat-value">{ledgerSummary.totalIn - ledgerSummary.totalOut}</div>
                <div className="inv-stat-sub">unit</div>
              </div>
            </div>
            <div className="inv-stat amber">
              <div>
                <div className="inv-stat-label">Nilai Bersih</div>
                <div className="inv-stat-value" style={{ fontSize: 14 }}>{formatRupiah(ledgerSummary.valueIn - ledgerSummary.valueOut)}</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="inv-actions no-print">
            <button className="inv-action-btn green" onClick={() => handleOpenModal('IN')}>
              <Plus size={16} /> Barang Masuk
            </button>
            <button className="inv-action-btn red" onClick={() => handleOpenModal('OUT')}>
              <Minus size={16} /> Barang Keluar
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()} style={{ padding: '10px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Printer size={16} /> Cetak
            </button>
          </div>

          {/* Ledger content */}
          {sortedLogs.length === 0 ? (
            <div className="inv-table-card">
              <div className="inv-empty">
                <div className="inv-empty-icon"><ClipboardList size={28} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Belum Ada Catatan</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 280 }}>Catat pergerakan barang masuk/keluar untuk memantau stok secara real-time.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="inv-table-card">
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Tipe</th>
                        <th>Kode</th>
                        <th>Nama Barang</th>
                        <th>Qty</th>
                        <th>Nilai</th>
                        <th>Keterangan</th>
                        <th className="no-print" style={{ width: 70 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLogs.map((log) => {
                        const d = new Date(log.date);
                        const isOut = log.type === 'OUT';
                        return (
                          <tr key={log.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={12} color="var(--text-muted)" />
                                {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, marginLeft: 18 }}>
                                {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td>
                              <span className={`inv-badge ${isOut ? 'out' : 'in'}`}>
                                {isOut ? <Minus size={12} /> : <Plus size={12} />} {log.type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{log.kodeBarang || '-'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {log.imageUrl && <img src={log.imageUrl} alt="img" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} />}
                                <span>{log.namaBarang}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, fontSize: 15 }}>{log.qty}</td>
                            <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatRupiah(log.price || 0)}</td>
                            <td>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180 }}>
                                {log.note || '-'}
                              </div>
                            </td>
                            <td className="no-print">
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => handleOpenModal(log.type, log)} style={{ padding: 5, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(24,119,242,0.1)', color: '#1877F2', display: 'flex' }}>
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDeleteLog(log.id)} style={{ padding: 5, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#EF4444', display: 'flex' }}>
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="inv-card-grid">
                {sortedLogs.map((log) => {
                  const d = new Date(log.date);
                  const isOut = log.type === 'OUT';
                  return (
                    <div key={log.id} className="inv-ledger-card" style={{ padding: '12px 14px', gap: 0, flexDirection: 'row', alignItems: 'flex-start' }}>
                      {log.imageUrl && (
                        <div style={{ marginRight: 12, flexShrink: 0, marginTop: 2 }}>
                          <img src={log.imageUrl} alt="Item" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* Baris 1: Kode - Nama & Badge */}
                        <div className="inv-ledger-top" style={{ alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-accent)' }}>{log.kodeBarang || 'Tanpa Kode'}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden' }}>{log.namaBarang}</span>
                        </div>
                        <span className={`inv-badge ${isOut ? 'out' : 'in'}`} style={{ padding: '4px 8px', fontSize: 10, flexShrink: 0 }}>
                          {isOut ? <Minus size={10} /> : <Plus size={10} />} {log.type}
                        </span>
                      </div>

                      {/* Baris 2: Qty & Nilai */}
                      <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div><span style={{color: 'var(--text-muted)'}}>Qty:</span> <strong style={{color: 'var(--text-primary)'}}>{log.qty}</strong></div>
                          <div><span style={{color: 'var(--text-muted)'}}>Nilai:</span> <strong style={{color: 'var(--accent-green)'}}>{formatRupiah(log.price || 0)}</strong></div>
                        </div>
                      </div>

                      {/* Baris 3: Tanggal, Note & Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <Calendar size={11} />
                            {d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {log.note && (
                            <>
                              <span style={{ flexShrink: 0 }}>|</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                <FileText size={11} style={{ flexShrink: 0 }} /> {log.note}
                              </div>
                            </>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                          <button onClick={() => handleOpenModal(log.type, log)} style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(24,119,242,0.1)', color: '#1877F2', display: 'flex' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleDeleteLog(log.id)} style={{ padding: 4, borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#EF4444', display: 'flex' }}>
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MODAL ═══ */}
      {showModal && createPortal(
        <div className="modal-overlay center">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: logType === 'IN' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: logType === 'IN' ? '#10B981' : '#EF4444'
                }}>
                  {logType === 'IN' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {editingLogId ? 'Edit Catatan' : logType === 'IN' ? 'Barang Masuk' : 'Barang Keluar'}
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {editingLogId ? 'Perbarui detail transaksi' : 'Catat pergerakan stok baru'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveLog} className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="inv-form-grid">
                <div className="inv-form-group">
                  <label>Kode Barang</label>
                  <input
                    type="text"
                    value={formData.kodeBarang}
                    onChange={(e) => handleKodeChange(e.target.value)}
                    placeholder="Misal: P102"
                  />
                  <div className="inv-hint">Jika kode dikenali, nama & harga otomatis terisi</div>
                </div>
                <div className="inv-form-group">
                  <label>Nama / Deskripsi Barang <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.namaBarang}
                    onChange={(e) => setFormData(prev => ({ ...prev, namaBarang: e.target.value }))}
                    placeholder="Deskripsi barang…"
                  />
                </div>
                <div className="inv-form-row">
                  <div className="inv-form-group">
                    <label>Jumlah (Qty) <span style={{ color: '#EF4444' }}>*</span></label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.qty}
                      onChange={(e) => setFormData(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="inv-form-group">
                    <label>Nilai / Harga (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.price || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                      placeholder="1500000"
                    />
                  </div>
                </div>
                <div className="inv-form-group">
                  <label>Keterangan</label>
                  <textarea
                    rows={2}
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder={logType === 'IN' ? 'Dari supplier/pengrajin mana…' : 'Dibawa ke pameran, retur, dll…'}
                  />
                </div>
                <div className="inv-form-group">
                  <label>Link Gambar / Foto (Opsional)</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="inv-form-actions">
                <button type="button" className="inv-form-cancel" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className={`inv-form-submit ${logType === 'IN' ? 'green' : 'red'}`}>
                  {logType === 'IN' ? '✓ Simpan Masuk' : '✓ Simpan Keluar'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
