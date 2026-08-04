import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Printer, Edit2, Trash2, X, Package, MapPin, CreditCard, Camera } from 'lucide-react';
import type { CustomerRow, Customer } from '../types';
import { getJenisBadgeClass, getPearlBadgeClass, parseDateToSortValue, cleanPrice, resolveImageUrl } from '../utils/csvLoader';
import OrderFormModal from '../components/OrderFormModal';
import { printInvoice } from '../utils/printHelper';
import { storage } from '../utils/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ─── Filter Dropdown Component ─────────────────────────────────────────────
interface FilterOption { value: string; label: string; count: number; }
interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (val: string) => void;
  customContent?: React.ReactNode;
}

function FilterDropdown({ label, value, options, onChange, customContent }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isActive = !!value;
  const activeLabel = options.find(o => o.value === value)?.label || (customContent && isActive ? 'Filter' : '');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="filter-panel-wrap" ref={wrapRef}>
      <button
        className={`filter-btn${isActive ? ' active' : ''}`}
        onClick={() => setOpen(p => !p)}
      >
        {isActive ? (activeLabel || label) : label}
        {isActive && <span className="filter-badge">✓</span>}
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="filter-panel" style={{ maxHeight: 320, overflowY: 'auto' }}>
          {customContent ? customContent : (
            <>
              <div
                className={`filter-panel-item${!value ? ' selected' : ''}`}
                onClick={() => { onChange(''); setOpen(false); }}
              >
                <span>Semua</span>
              </div>
              {options.map(opt => (
                <div
                  key={opt.value}
                  className={`filter-panel-item${value === opt.value ? ' selected' : ''}`}
                  onClick={() => { onChange(value === opt.value ? '' : opt.value); setOpen(false); }}
                >
                  <span>{opt.label}</span>
                  <span className="fpi-count">{opt.count}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

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

const isGooglePhotos = (url?: string | null) => {
  if (!url) return false;
  // Only treat as Google Photos album (non-embeddable) if it's a sharing/album link
  // lh3.googleusercontent.com URLs ARE directly embeddable as images
  return (url.includes('photos.google.com/share') || 
          url.includes('photos.google.com/album') ||
          url.includes('photos.app.goo.gl')) &&
          !url.includes('lh3.googleusercontent.com');
};

// ─────────────────────────────────────────────
// Drive Image Card: searches Google Drive by filename
// and renders the thumbnail directly from Drive
// ─────────────────────────────────────────────
const DRIVE_RESOLVE_CACHE = new Map<string, string | null>();

function isPlainFilename(url: string): boolean {
  if (!url) return false;
  return !url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:');
}

function DriveImageCard({
  photo,
  onDelete,
  onOpenLightbox,
  onUpdateUrl
}: {
  photo: { url: string; originalName: string; label: string; orderId: string; isMain: boolean };
  onDelete: () => void;
  onOpenLightbox?: (src: string, label: string) => void;
  onUpdateUrl?: (newUrl: string) => void;
}) {
  const filename = photo.originalName || photo.url;
  const isDriveSearch = isPlainFilename(photo.url);
  const [imgSrc, setImgSrc] = useState<string | null>(isDriveSearch ? null : photo.url);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'uploading'>(isDriveSearch ? 'loading' : 'ok');
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const fetched = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;

    setStatus('uploading');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const newFilename = `whatsapp_attachments/${Date.now()}_upload.${ext}`;
      const fileRef = ref(storage, newFilename);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setImgSrc(url);
      setStatus('ok');
      if (onUpdateUrl) {
        onUpdateUrl(url);
      }
    } catch (err) {
      console.error('Upload failed', err);
      setStatus('error');
      alert('Gagal mengupload foto');
    }
  };

  useEffect(() => {
    if (!isDriveSearch || fetched.current) return;
    fetched.current = true;

    if (DRIVE_RESOLVE_CACHE.has(filename)) {
      const cached = DRIVE_RESOLVE_CACHE.get(filename);
      if (cached) { 
        setImgSrc(cached); 
        setDriveFileId(cached.includes('drive.google.com') ? cached.split('id=')[1]?.split('&')[0] : null); 
        setStatus('ok'); 
      }
      else setStatus('error');
      return;
    }

    // Bypassing Drive and Firebase Storage search to allow manual upload immediately
    DRIVE_RESOLVE_CACHE.set(filename, null);
    setStatus('error');
  }, [filename, isDriveSearch, onUpdateUrl]);

  const driveSearchUrl = `https://drive.google.com/drive/u/6/search?q=${encodeURIComponent(filename.replace(/\.\w+$/, ''))}`;
  const driveViewUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

  const handleImgClick = () => {
    if (imgSrc && onOpenLightbox) {
      onOpenLightbox(imgSrc, photo.label);
    } else {
      window.open(driveViewUrl || imgSrc || '', '_blank');
    }
  };

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
        position: 'relative',
        transition: 'transform 0.18s, box-shadow 0.18s'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(24,119,242,0.2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)'; }}
    >
      {status === 'loading' && (
        <div style={{ width: '100%', height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: '#1877F2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mencari di Drive...</div>
        </div>
      )}
      {status === 'ok' && imgSrc && (
        <div style={{ position: 'relative' }}>
          <img
            src={imgSrc}
            alt={photo.label}
            style={{ width: '100%', height: 260, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
            onClick={handleImgClick}
            onError={() => setStatus('error')}
          />
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s', cursor: 'zoom-in'
          }}
          onClick={handleImgClick}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
          >
            <div style={{ opacity: 0, transition: 'opacity 0.2s', fontSize: 28, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
              className="zoom-icon">🔍</div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div style={{ width: '100%', height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, textAlign: 'center', gap: 8 }}>
          <div style={{ fontSize: 30 }}>🔍</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>Foto tidak ditemukan otomatis.<br/>Cari manual di Google Drive:</div>
          <a
            href={driveSearchUrl}
            target="_blank"
            rel="noreferrer"
            style={{ marginTop: 4, padding: '6px 14px', background: '#10b981', color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: 'none', display: 'inline-block', width: '80%' }}
          >
            🔍 Cari di Drive
          </a>
          
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>atau</div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '6px 14px', background: '#1877F2', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '80%' }}
          >
            📤 Upload Manual
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleUpload}
          />
        </div>
      )}
      {status === 'uploading' && (
        <div style={{ width: '100%', height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: '#1877F2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mengupload foto...</div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-tertiary)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {photo.label}
        </div>
        <button
          title="Hapus foto ini"
          onClick={onDelete}
          style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, marginLeft: 6 }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(function OrdersPage({ rows, searchQuery, onSearchChange, onAddOrder, onEditOrder, onDeleteOrder, onBatchEditOrders, onBatchDeleteOrders, customers }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tanggalOrder');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerRow | null>(null);
  const [selectedOrderView, setSelectedOrderView] = useState<CustomerRow | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

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

  // Find all rows of the same transaction
  const relatedOrderRows = useMemo(() => {
    if (!selectedOrderView) return [];
    if (!selectedOrderView.tanggalOrder) return [selectedOrderView];
    
    const matched = rows.filter((r) => 
      r.namaInstagram.toLowerCase() === selectedOrderView.namaInstagram.toLowerCase() &&
      r.tanggalOrder === selectedOrderView.tanggalOrder
    );
    // Always include at least the selected row itself
    if (matched.length === 0) return [selectedOrderView];
    return matched;
  }, [selectedOrderView, rows]);

  const uniquePhotos = useMemo(() => {
    if (!selectedOrderView) return [];
    
    const photos: { url: string; originalName: string; label: string; isGoogle: boolean; orderId: string; isMain: boolean }[] = [];
    const seen = new Set<string>();
    
    relatedOrderRows.forEach((item, idx) => {
      if (item.gambar && item.gambar.trim() && item.gambar !== '-' && item.gambar !== '—') {
        const resolved = resolveImageUrl(item.gambar);
        if (!seen.has(resolved)) {
          seen.add(resolved);
          photos.push({
            url: resolved,
            originalName: item.gambar,
            label: `Foto ${item.jenis || 'Produk'} (Item ${idx + 1})`,
            isGoogle: isGooglePhotos(item.gambar),
            orderId: item.id,
            isMain: true
          });
        }
      }
      
      if (item.attachments && Array.isArray(item.attachments)) {
        item.attachments.forEach((att, attIdx) => {
          if (att && att.trim()) {
            const resolved = resolveImageUrl(att);
            if (!seen.has(resolved)) {
              seen.add(resolved);
              photos.push({
                url: resolved,
                originalName: att,
                label: `Lampiran ${attIdx + 1} (Item ${idx + 1})`,
                isGoogle: isGooglePhotos(att),
                orderId: item.id,
                isMain: false
              });
            }
          }
        });
      }
    });
    
    return photos;
  }, [relatedOrderRows, selectedOrderView]);

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
  const [focusGrade] = useState('');
  const [focusSize] = useState('');
  const [focusColor] = useState('');



  // Only rows with actual order data, grouped by transaction
  const orderRows = useMemo(() => {
    const rawRows = rows.filter((r) => r.jenis);
    const groups = new Map<string, CustomerRow[]>();
    rawRows.forEach(r => {
      const key = `${r.namaInstagram || r.namaPengiriman}_${r.tanggalOrder}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    return Array.from(groups.values()).map(group => {
      const first = group[0];
      if (group.length === 1) return first;
      
      const totalBayarNum = group.reduce((sum, curr) => sum + parseInt((curr.totalBayar || '0').replace(/\D/g, '') || '0', 10), 0);
      const uniqueJenis = [...new Set(group.map(g => g.jenis).filter(Boolean))];
      const uniqueType = [...new Set(group.map(g => g.type).filter(Boolean))];
      const uniqueSize = [...new Set(group.map(g => g.size).filter(Boolean))];
      const uniqueColor = [...new Set(group.map(g => g.color).filter(Boolean))];
      const uniqueGrade = [...new Set(group.map(g => g.grade).filter(Boolean))];
      
      return {
        ...first,
        id: group.map(g => g.id).join(','),
        jenis: uniqueJenis.length > 1 ? 'Multiple Items' : uniqueJenis[0] || '',
        type: uniqueType.length > 1 ? 'Mixed' : uniqueType[0] || '',
        size: uniqueSize.length > 1 ? 'Mixed' : uniqueSize[0] || '',
        color: uniqueColor.length > 1 ? 'Mixed' : uniqueColor[0] || '',
        grade: uniqueGrade.length > 1 ? 'Mixed' : uniqueGrade[0] || '',
        totalBayar: totalBayarNum.toString(),
      };
    });
  }, [rows]);

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
      const s = r.orderStatus || 'selesai';
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
      if (filterStatus && (r.orderStatus || 'selesai') !== filterStatus) return false;

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
        av = cleanPrice(av as string);
        bv = cleanPrice(bv as string);
      } else if (sortKey === 'tanggalOrder') {
        av = parseDateToSortValue(av as string);
        bv = parseDateToSortValue(bv as string);
      } else if (sortKey === 'orderStatus') {
        av = (a.orderStatus || 'selesai').toLowerCase();
        bv = (b.orderStatus || 'selesai').toLowerCase();
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

  const exportToCsv = () => {
    if (filtered.length === 0) {
      alert("Tidak ada data untuk diexport!");
      return;
    }

    const headers = [
      "ID", "Customer", "Tanggal Order", "Jenis", "Type", "Size", "Color", "Grade",
      "Total Bayar", "Payment Via", "Kurir", "Resi", "Keterangan", "Status", "Alamat"
    ];

    const escapeCsv = (str?: string) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""').replace(/\n/g, ' ');
      return `"${escaped}"`;
    };

    const csvRows = filtered.map(r => {
      const cust = customers.find(c => c.instagram === r.namaInstagram || c.nama === r.namaInstagram);
      return [
        escapeCsv(r.id),
        escapeCsv(r.namaInstagram),
        escapeCsv(r.tanggalOrder),
        escapeCsv(r.jenis),
        escapeCsv(r.type),
        escapeCsv(r.size),
        escapeCsv(r.color),
        escapeCsv(r.grade),
        escapeCsv(r.totalBayar),
        escapeCsv(r.paymentVia),
        escapeCsv(r.kurir),
        escapeCsv(r.resi),
        escapeCsv(r.keterangan),
        escapeCsv(r.orderStatus),
        escapeCsv(cust?.alamat)
      ].join(';');
    });

    const csvContent = "\uFEFF" + [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `All_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    return <span className="sort-arrow" style={{ color: '#1877F2' }}>{sortAsc ? '↑' : '↓'}</span>;
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
      <div className="card">
        {/* Toolbar */}
        <div className="table-toolbar" style={{ gap: 8 }}>
          <div className="search-box" style={{ flex: 1, minWidth: 0, maxWidth: 320 }}>
            <Search size={15} className="search-icon" />
            <input
              value={localSearch}
              onChange={(e) => { setLocalSearch(e.target.value); setPage(1); }}
              placeholder="Cari order, customer, produk…"
            />
          </div>

          {/* Filter Dropdowns */}
          <FilterDropdown
            label="Jenis"
            value={filterType}
            options={allTypes.map(t => ({ value: t, label: t, count: typeFreq[t] || 0 }))}
            onChange={(v) => { setFilterType(v); setPage(1); }}
          />
          <FilterDropdown
            label="Pearl"
            value={filterPearl}
            options={allPearls.map(t => ({ value: t, label: t, count: pearlFreq[t] || 0 }))}
            onChange={(v) => { setFilterPearl(v); setPage(1); }}
          />
          <FilterDropdown
            label="Status"
            value={filterStatus}
            options={[
              { value: 'pending',  label: '⏳ Pending',  count: statusFreq['pending']  || 0 },
              { value: 'dikirim', label: '🚚 Dikirim',  count: statusFreq['dikirim']  || 0 },
              { value: 'selesai', label: '✅ Selesai',  count: statusFreq['selesai']  || 0 },
              { value: 'retur',   label: '↩️ Retur',    count: statusFreq['retur']    || 0 },
            ]}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
          />
          <FilterDropdown
            label="More"
            value={filterGrade || filterPayment || filterSize || filterColor ? '1' : ''}
            options={[]}
            customContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div className="filter-panel-title">Grade</div>
                {allGrades.map(t => (
                  <div key={t} className={`filter-panel-item${filterGrade === t ? ' selected' : ''}`}
                    onClick={() => { setFilterGrade(filterGrade === t ? '' : t); setPage(1); }}>
                    <span>{t}</span>
                    <span className="fpi-count">{gradeFreq[t] || 0}</span>
                  </div>
                ))}
                <div className="filter-panel-title" style={{ marginTop: 4 }}>Payment</div>
                {allPayments.map(t => (
                  <div key={t} className={`filter-panel-item${filterPayment === t ? ' selected' : ''}`}
                    onClick={() => { setFilterPayment(filterPayment === t ? '' : t); setPage(1); }}>
                    <span>{t}</span>
                    <span className="fpi-count">{paymentFreq[t] || 0}</span>
                  </div>
                ))}
                <div className="filter-panel-title" style={{ marginTop: 4 }}>Size</div>
                {allSizes.map(t => (
                  <div key={t} className={`filter-panel-item${filterSize === t ? ' selected' : ''}`}
                    onClick={() => { setFilterSize(filterSize === t ? '' : t); setPage(1); }}>
                    <span>{t}</span>
                    <span className="fpi-count">{sizeFreq[t] || 0}</span>
                  </div>
                ))}
                <div className="filter-panel-title" style={{ marginTop: 4 }}>Warna</div>
                {allColors.map(t => (
                  <div key={t} className={`filter-panel-item${filterColor === t ? ' selected' : ''}`}
                    onClick={() => { setFilterColor(filterColor === t ? '' : t); setPage(1); }}>
                    <span>{t}</span>
                    <span className="fpi-count">{colorFreq[t] || 0}</span>
                  </div>
                ))}
                {(filterGrade || filterPayment || filterSize || filterColor) && (
                  <div className="filter-panel-clear" onClick={() => { setFilterGrade(''); setFilterPayment(''); setFilterSize(''); setFilterColor(''); setPage(1); }}>
                    ✕ Reset
                  </div>
                )}
              </div>
            }
            onChange={() => {}}
          />

          <div className="toolbar-spacer" />
          <button className="btn btn-primary" style={{ fontSize: 13, padding: '7px 14px' }} onClick={() => setShowAddModal(true)}>
            + Add
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '7px 10px' }} onClick={exportToCsv} title="Export ke CSV">
            ⬇ CSV
          </button>
          <span className="result-count">
            {(filterType || filterPearl || filterGrade || filterPayment || filterSize || filterColor || filterStatus)
              ? <span style={{ color: '#1877F2' }}>{filtered.length}/{orderRows.length}</span>
              : <span>{filtered.length} orders</span>
            }
          </span>
        </div>

        {/* Active filter chips */}
        {(filterType || filterPearl || filterGrade || filterPayment || filterSize || filterColor || filterStatus) && (
          <div className="active-filters-bar">
            {filterType    && <span className="active-filter-chip">{filterType}    <button onClick={() => { setFilterType('');    setPage(1); }}>×</button></span>}
            {filterPearl   && <span className="active-filter-chip">{filterPearl}   <button onClick={() => { setFilterPearl('');   setPage(1); }}>×</button></span>}
            {filterStatus  && <span className="active-filter-chip">{filterStatus}  <button onClick={() => { setFilterStatus('');  setPage(1); }}>×</button></span>}
            {filterGrade   && <span className="active-filter-chip">{filterGrade}   <button onClick={() => { setFilterGrade('');   setPage(1); }}>×</button></span>}
            {filterPayment && <span className="active-filter-chip">{filterPayment} <button onClick={() => { setFilterPayment(''); setPage(1); }}>×</button></span>}
            {filterSize    && <span className="active-filter-chip">{filterSize}    <button onClick={() => { setFilterSize('');    setPage(1); }}>×</button></span>}
            {filterColor   && <span className="active-filter-chip">{filterColor}   <button onClick={() => { setFilterColor('');   setPage(1); }}>×</button></span>}
            <button onClick={() => { setFilterType(''); setFilterPearl(''); setFilterGrade(''); setFilterPayment(''); setFilterSize(''); setFilterColor(''); setFilterStatus(''); setPage(1); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '2px 6px' }}>
              Reset semua
            </button>
          </div>
        )}

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
                    <span className="sort-arrow" style={{ color: focusType ? '#1877F2' : undefined }}>
                      {focusType ? '•' : '↕'}
                    </span>
                  </div>
                </th>
                <th className={focusPearl ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusPearl, allPearls, setFocusPearl, 'type')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Pearl {focusPearl ? `(${focusPearl})` : ''} 
                    <span className="sort-arrow" style={{ color: focusPearl ? '#1877F2' : undefined }}>
                      {focusPearl ? '•' : '↕'}
                    </span>
                  </div>
                </th>

                <th className={focusPayment ? 'filtered-active sorted' : ''} onClick={() => cycleFocus(focusPayment, allPayments, setFocusPayment, 'paymentVia')} style={{ cursor: 'pointer' }}>
                  <div className="th-inner">
                    Payment {focusPayment ? `(${focusPayment})` : ''} 
                    <span className="sort-arrow" style={{ color: focusPayment ? '#1877F2' : undefined }}>
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
                      <div style={{ marginTop: 20, fontSize: 11, color: 'red', textAlign: 'left', background: '#fee2e2', padding: 10, borderRadius: 5, maxWidth: 500, margin: '20px auto' }}>
                        <strong>Debug Info:</strong><br/>
                        rows.length: {rows.length}<br/>
                        orderRows.length: {orderRows.length}<br/>
                        filtered.length: {filtered.length}<br/>
                        Sampel baris 1: {rows.length > 0 ? JSON.stringify({ nama: rows[0].namaInstagram, jenis: rows[0].jenis }) : 'None'}<br/>
                        Sampel baris 2: {rows.length > 1 ? JSON.stringify({ nama: rows[1].namaInstagram, jenis: rows[1].jenis }) : 'None'}<br/>
                        Sampel baris 3: {rows.length > 2 ? JSON.stringify({ nama: rows[2].namaInstagram, jenis: rows[2].jenis }) : 'None'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pageData.map((r, i) => (
                  <tr 
                    key={r.id} 
                    style={{ 
                      background: selectedIds.includes(r.id) ? 'rgba(124, 58, 237, 0.05)' : undefined,
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedOrderView(r)}
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const statusCfg = STATUS_CONFIG[r.orderStatus || 'selesai'];
                        return (
                          <select
                            value={r.orderStatus || 'selesai'}
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
                    <td>
                      {r.paymentVia ? (
                        <span className="badge badge-default">{r.paymentVia}</span>
                      ) : '—'}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      {r.totalBayar
                        ? `Rp ${cleanPrice(r.totalBayar).toLocaleString('id-ID')}`
                        : '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
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
              const statusCfg = STATUS_CONFIG[r.orderStatus || 'selesai'];
              return (
                <div 
                  key={r.id} 
                  className="order-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedOrderView(r)}
                >
                  <span className="order-card-no">#{(safePage - 1) * rowsPerPage + i + 1}</span>
                  <div className="order-card-header">
                    <div className="order-card-name">{r.namaInstagram || r.namaPengiriman || '—'}</div>
                    <div className="order-card-date">{r.tanggalOrder || '—'}</div>
                  </div>
                  <div className="order-card-chips">
                    {/* Status */}
                    <select
                      value={r.orderStatus || 'selesai'}
                      onChange={(e) => onEditOrder(r.id, { orderStatus: e.target.value as any })}
                      onClick={(e) => e.stopPropagation()}
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
                        ? `Rp ${cleanPrice(r.totalBayar).toLocaleString('id-ID')}`
                        : '—'}
                    </div>
                    <div className="order-card-actions" onClick={(e) => e.stopPropagation()}>
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

      {selectedOrderView && createPortal(
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 0, 
            background: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.25s ease-out'
          }}
          onClick={() => setSelectedOrderView(null)}
        >
          <div 
            className="modal-panel" 
            style={{ 
              width: '100%', 
              maxWidth: '850px', 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border)', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              style={{ 
                padding: '20px 24px', 
                borderBottom: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'linear-gradient(to right, rgba(124, 58, 237, 0.05), rgba(0, 0, 0, 0))'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Detail Pesanan
                  </span>
                  {(() => {
                    const statusCfg = STATUS_CONFIG[selectedOrderView.orderStatus || 'selesai'];
                    return (
                      <span 
                        style={{ 
                          fontSize: 11, 
                          fontWeight: 700, 
                          padding: '3px 10px', 
                          borderRadius: '12px', 
                          color: statusCfg?.color || 'var(--text-muted)',
                          background: statusCfg?.bg || 'rgba(255,255,255,0.05)',
                          border: `1px solid ${statusCfg?.color || 'transparent'}`
                        }}
                      >
                        {statusCfg?.label || '⏳ Pending'}
                      </span>
                    );
                  })()}
                  {/* DP Badge — shown when keterangan contains [DP] marker */}
                  {selectedOrderView.keterangan?.includes('[DP]') && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      color: '#d97706',
                      background: 'rgba(217,119,6,0.12)',
                      border: '1px solid rgba(217,119,6,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      💰 BAYAR DP
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, marginTop: 4 }}>
                  Order ID: {selectedOrderView.no ? `#${selectedOrderView.no}` : `#${selectedOrderView.id.substring(0, 8)}`}
                </h2>
              </div>
              
              <button 
                className="icon-btn" 
                onClick={() => setSelectedOrderView(null)}
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  transition: 'background-color 0.2s',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Row 1: 2-Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                
                {/* Column A: Pelanggan & Pengiriman */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div 
                    style={{ 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px', 
                      padding: '16px 20px',
                      height: '100%'
                    }}
                  >
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <MapPin size={16} style={{ color: 'var(--accent-purple)' }} />
                      Info Pelanggan & Pengiriman
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Nama Pelanggan / IG</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedOrderView.namaInstagram || '—'}
                        </span>
                        {selectedOrderView.instagram && (
                          <a 
                            href={selectedOrderView.instagram.startsWith('http') ? selectedOrderView.instagram : `https://instagram.com/${selectedOrderView.instagram.replace(/^@/, '')}`}
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            @{(() => {
                              let u = selectedOrderView.instagram.trim();
                              if (u.includes('instagram.com/')) {
                                u = u.split('instagram.com/')[1].split('/')[0].split('?')[0];
                              }
                              return u.replace(/^@/, '');
                            })()}
                          </a>
                        )}
                      </div>

                      {selectedOrderView.wa && (
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>WhatsApp</span>
                          <a 
                            href={`https://wa.me/${selectedOrderView.wa.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {selectedOrderView.wa} 
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>Chat WhatsApp</span>
                          </a>
                        </div>
                      )}

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Penerima</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrderView.namaPengiriman || '—'}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Alamat Penerima</span>
                        <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, display: 'block', marginTop: 2 }}>
                          {selectedOrderView.alamat || '—'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Ekspedisi / Kurir</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {(() => {
                              const isNumericCourier = selectedOrderView.kurir ? /^\\d+$/.test(selectedOrderView.kurir.trim().replace(/[\\s\\.\\,\\-]/g, '')) : false;
                              return selectedOrderView.kurir && !isNumericCourier ? selectedOrderView.kurir.toUpperCase() : 'JNE/J&T';
                            })()}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>No. Resi</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {(() => {
                              const isNumericCourier = selectedOrderView.kurir ? /^\\d+$/.test(selectedOrderView.kurir.trim().replace(/[\\s\\.\\,\\-]/g, '')) : false;
                              const finalResi = selectedOrderView.resi || (isNumericCourier ? selectedOrderView.kurir : '—');
                              return finalResi !== '—' ? (
                                <a href={`https://cekresi.com/?noresi=${finalResi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>
                                  {finalResi}
                                </a>
                              ) : '—';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column B: Item Pesanan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div 
                    style={{ 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px', 
                      padding: '16px 20px',
                      height: '100%',
                      overflowY: 'auto',
                      maxHeight: 340
                    }}
                  >
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                      <Package size={16} style={{ color: 'var(--accent-purple)' }} />
                      Item Pesanan ({relatedOrderRows.length})
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {relatedOrderRows.map((item) => {
                        const resolvedImg = resolveImageUrl(item.gambar);
                        const isGP = isGooglePhotos(item.gambar);
                        return (
                          <div 
                            key={item.id}
                            style={{ 
                              display: 'flex', 
                              gap: 12, 
                              padding: '10px', 
                              background: 'var(--bg-card)', 
                              border: '1px solid var(--border)', 
                              borderRadius: '10px',
                              alignItems: 'center',
                            }}
                          >
                            {/* Thumbnail (Only show if there is an image) */}
                            {item.gambar && (
                              <div 
                                style={{ 
                                  width: 48, 
                                  height: 48, 
                                  borderRadius: 8, 
                                  overflow: 'hidden', 
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-secondary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  cursor: 'pointer'
                                }}
                                onClick={() => { 
                                  if (isGP) {
                                    window.open(item.gambar, '_blank');
                                  } else {
                                    setLightbox({ src: resolvedImg, label: `${item.jenis || 'Produk'} ${item.kode ? `- ${item.kode}` : ''}` });
                                  }
                                }}
                              >
                                {isGP ? (
                                  <span style={{ fontSize: 18 }} title="Foto di Google Photos — klik untuk buka">📸</span>
                                ) : (
                                  <img src={resolvedImg} alt={item.jenis} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(e) => { const t = e.target as HTMLImageElement; t.style.display='none'; if(t.parentElement) t.parentElement.style.display='none'; }}
                                  />
                                )}
                              </div>
                            )}
                            
                            {/* Product Details */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                  {item.jenis || 'Perhiasan Mutiara'}
                                </span>
                                {item.kode && (
                                  <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: 4, fontFamily: 'monospace', fontWeight: 600, border: '1px solid var(--border)' }}>
                                    {item.kode}
                                  </span>
                                )}
                                {item.type && <span className={`badge ${getPearlBadgeClass(item.type)}`} style={{ fontSize: 10, padding: '2px 6px' }}>{item.type}</span>}
                              </div>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px 8px', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                {item.size && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>📏 <span>{item.size.replace('mm', '')}mm</span></div>}
                                {item.shape && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>💧 <span>{item.shape}</span></div>}
                                {item.color && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    🎨 <span>{item.color}</span>
                                  </div>
                                )}
                                {item.grade && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    ⭐ <span>Grade <strong style={{ color: 'var(--text-primary)' }}>{item.grade}</strong></span>
                                  </div>
                                )}
                                {(item.rangka || item.gramasiRangka) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    💍 <span>{item.rangka || 'Rangka'} {item.gramasiRangka ? `(${item.gramasiRangka}g)` : ''}</span>
                                  </div>
                                )}
                                {(item.stone || item.stoneWeight) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    💎 <span>{item.stone || 'Batu'} {item.stoneWeight ? `(${item.stoneWeight.replace(/ct/g, '').trim()} ct)` : ''}</span>
                                  </div>
                                )}
                              </div>


                            </div>

                            {/* Price */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>
                                {(!item.totalBayar || item.totalBayar === '0') ? '—' : `Rp ${cleanPrice(item.totalBayar).toLocaleString('id-ID')}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>qty: {item.qty || '1'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

                {/* Row 2: Rincian Biaya & Pembayaran (moved here, full width) */}
              <div 
                style={{ 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '20px' 
                }}
              >
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <CreditCard size={16} style={{ color: 'var(--accent-purple)' }} />
                  Rincian Biaya & Pembayaran
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Harga Barang (Bersih)</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {`Rp ${relatedOrderRows.reduce((acc, curr) => acc + parseInt((curr.hargaBersih || '0').replace(/\D/g, '') || '0', 10), 0).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Biaya Kirim (Ongkir)</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {`Rp ${relatedOrderRows.reduce((acc, curr) => acc + parseInt((curr.ongkir || '0').replace(/\D/g, '') || '0', 10), 0).toLocaleString('id-ID')}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Total Pembayaran</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>
                        {`Rp ${relatedOrderRows.reduce((acc, curr) => acc + parseInt((curr.totalBayar || '0').replace(/\D/g, '') || '0', 10), 0).toLocaleString('id-ID')}`}
                      </span>
                    </div>

                    {/* DP Breakdown — only shown when keterangan contains [DP] */}
                    {(() => {
                      const ket = relatedOrderRows[0]?.keterangan || selectedOrderView.keterangan || '';
                      const dpLineMatch = ket.match(/\[DP\]\s*(.+)/s);
                      if (!dpLineMatch) return null;
                      const dpLine = dpLineMatch[1].trim();
                      // Parse DP parts from e.g. "DP 1: Rp 6.000.000 | Pelunasan: Rp 10.000.000"
                      const parts = dpLine.split('|').map(s => s.trim());
                      return (
                        <div style={{
                          marginTop: 8,
                          padding: '12px 14px',
                          background: 'rgba(217,119,6,0.07)',
                          border: '1px solid rgba(217,119,6,0.25)',
                          borderRadius: 10
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            💰 Rincian Pembayaran DP
                          </div>
                          {parts.map((part, i) => {
                            const isDP = part.toLowerCase().includes('dp');
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                                  {part.split(':')[0]?.trim() || part}
                                </span>
                                <span style={{ fontWeight: 700, color: isDP ? '#d97706' : '#10b981' }}>
                                  {part.split(':').slice(1).join(':').trim() || ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 10 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Metode Pembayaran</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginTop: 4, display: 'block' }}>{selectedOrderView.paymentVia || '—'}</span>
                    </div>
                    {selectedOrderView.tanggalOrder && (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Tanggal Order</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginTop: 4, display: 'block' }}>{selectedOrderView.tanggalOrder}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Keterangan & Catatan — strip [DP] line, shown separately in payment section */}
              {/* Row 3: Keterangan & Catatan — strip [DP] line, shown separately in payment section */}
              {relatedOrderRows.some(r => r.keterangan) && (() => {
                // Combine all unique keterangans from related rows
                const allKeterangans = relatedOrderRows.map(r => r.keterangan).filter(Boolean);
                // Deduplicate in case multiple rows have the exact same description
                const uniqueKeterangans = Array.from(new Set(allKeterangans));
                
                const combinedKeterangan = uniqueKeterangans.join('\n\n');
                const prodOnly = combinedKeterangan.replace(/\n*\[DP\][\s\S]*$/, '').trim();
                if (!prodOnly) return null;
                
                return (
                  <div 
                    style={{ 
                      background: 'rgba(124, 58, 237, 0.04)', 
                      border: '1px dashed rgba(124, 58, 237, 0.2)', 
                      borderRadius: '12px', 
                      padding: '16px 20px' 
                    }}
                  >
                    <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-purple)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Keterangan / Catatan Order
                    </h4>
                    <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {prodOnly.replace(/(?:^|\s+)(\d+\.)/g, '\n\n$1').replace(/\s*•\s*/g, '\n  • ').trim()}
                    </p>
                  </div>
                );
              })()}

              {/* Row 4: Attachments / Bukti Transfer / Media */}
              {uniquePhotos.length > 0 && (
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                    <Camera size={16} style={{ color: 'var(--accent-purple)' }} />
                    Lampiran & Foto Bukti
                  </h4>

                  <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 14, paddingTop: 4, scrollSnapType: 'x mandatory' }}>
                    {uniquePhotos.map((photo, pIdx) => (
                      photo.isGoogle ? (
                        <div 
                          key={pIdx}
                          style={{ 
                            minWidth: 300,
                            flexShrink: 0,
                            scrollSnapAlign: 'start',
                            borderRadius: 14, 
                            border: '2px dashed rgba(24,119,242,0.4)',
                            background: 'linear-gradient(135deg, rgba(24,119,242,0.07), rgba(59,130,246,0.05))',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px 20px',
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(24,119,242,0.1)',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1877F2'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(24,119,242,0.12), rgba(59,130,246,0.08))'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(24,119,242,0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(24,119,242,0.07), rgba(59,130,246,0.05))'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          <div style={{ fontSize: 40, marginBottom: 12 }}>☁️</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            Foto di Google Photos / Drive
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16, maxWidth: 220 }}>
                            {photo.label} · Pilih tempat membuka foto:
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <button 
                              onClick={() => window.open(photo.url, '_blank')}
                              style={{ 
                                padding: '8px 18px', 
                                borderRadius: 8, 
                                fontSize: 12, 
                                background: '#1877F2', 
                                color: 'white', 
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                border: 'none',
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              📸 Buka Link Google Photos Asli
                            </button>
                            <button 
                              onClick={() => window.open('https://drive.google.com/drive/folders/1ZeIzX1r6yrcER3HcUB_goeNUpOHfPODN?usp=sharing', '_blank')}
                              style={{ 
                                padding: '8px 12px', 
                                background: 'var(--accent-green)', 
                                borderRadius: 8, 
                                fontSize: 11, 
                                color: 'white', 
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                border: 'none',
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              📂 Buka Folder Google Drive
                            </button>
                            <button
                              title="Hapus tautan foto ini"
                              onClick={async () => {
                                if (!window.confirm('Hapus foto ini dari pesanan?')) return;
                                const targetRow = rows.find(r => r.id === photo.orderId);
                                if (!targetRow) return;
                                const patch = photo.isMain
                                  ? { gambar: '' }
                                  : { attachments: (targetRow.attachments || []).filter(a => a !== photo.originalName) };
                                await onEditOrder(photo.orderId, patch);
                                if (selectedOrderView && selectedOrderView.id === photo.orderId) {
                                  setSelectedOrderView({ ...selectedOrderView, ...patch });
                                }
                              }}
                              style={{
                                marginTop: 8,
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--accent-red)',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            >
                              <Trash2 size={12} /> Hapus Tautan Foto Lama
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={pIdx} style={{ scrollSnapAlign: 'start' }}>
                          <DriveImageCard
                            photo={photo}
                            onOpenLightbox={(src, label) => setLightbox({ src, label })}
                            onUpdateUrl={async (newUrl) => {
                              const targetRow = rows.find(r => r.id === photo.orderId);
                              if (!targetRow) return;
                              const patch = photo.isMain
                                ? { gambar: newUrl }
                                : { attachments: (targetRow.attachments || []).map(a => a === photo.originalName ? newUrl : a) };
                              await onEditOrder(photo.orderId, patch);
                              if (selectedOrderView && selectedOrderView.id === photo.orderId) {
                                setSelectedOrderView({ ...selectedOrderView, ...patch });
                              }
                            }}
                            onDelete={async () => {
                              if (!window.confirm('Hapus foto ini dari pesanan?')) return;
                              const targetRow = rows.find(r => r.id === photo.orderId);
                              if (!targetRow) return;
                              const patch = photo.isMain
                                ? { gambar: '' }
                                : { attachments: (targetRow.attachments || []).filter(a => a !== photo.originalName) };
                              await onEditOrder(photo.orderId, patch);
                              if (selectedOrderView && selectedOrderView.id === photo.orderId) {
                                setSelectedOrderView({ ...selectedOrderView, ...patch });
                              }
                            }}
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lightbox */}
            {lightbox && (
              <div
                onClick={() => setLightbox(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 9999,
                  background: 'rgba(0,0,0,0.88)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                  animation: 'fadeIn 0.18s ease'
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
                >
                  <img
                    src={lightbox.src}
                    alt={lightbox.label}
                    style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 14, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
                  />
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{lightbox.label}</div>
                  <button
                    onClick={() => setLightbox(null)}
                    style={{
                      position: 'absolute', top: -14, right: -14,
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                      color: 'white', fontSize: 18, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)'
                    }}
                  >✕</button>
                  <button
                    onClick={() => window.open(lightbox.src, '_blank')}
                    style={{
                      marginTop: 4, padding: '8px 22px',
                      background: 'rgba(124,58,237,0.85)', border: 'none',
                      borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', backdropFilter: 'blur(4px)'
                    }}
                  >🔗 Buka di Tab Baru</button>
                </div>
              </div>
            )}

            {/* Footer / Actions */}
            <div 
              style={{ 
                padding: '16px 24px', 
                borderTop: '1px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 12, 
                background: 'var(--bg-secondary)' 
              }}
            >
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  const customer: Customer = customers.find(c => c.nama.toLowerCase() === selectedOrderView.namaInstagram.toLowerCase())
                    || {
                      id: '',
                      nama: selectedOrderView.namaInstagram || selectedOrderView.namaPengiriman || 'Pelanggan',
                      wa: selectedOrderView.wa || '',
                      alamat: selectedOrderView.alamat || '',
                      city: '',
                      orders: [],
                      totalSpend: 0,
                      orderCount: 0,
                      lastOrder: '',
                      instagram: selectedOrderView.instagram || '',
                      tanggalUlangTahun: selectedOrderView.tanggalUlangTahun || ''
                    };
                  printInvoice(customer, relatedOrderRows);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={15} /> Cetak Nota
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingOrder(selectedOrderView);
                  setSelectedOrderView(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Edit2 size={15} /> Edit Order
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedOrderView(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
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
});
