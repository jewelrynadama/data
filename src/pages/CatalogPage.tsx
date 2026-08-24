import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Gem, ShoppingBag, Sparkles, RefreshCw, X, Tag, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CatalogItem, CustomerRow } from '../types';
import { formatRupiah, resolveImageUrl } from '../utils/csvLoader';

const calculateMargin = (item: CatalogItem) => {
  const hargaJual = Number(item.hargaJual) || 0;
  if (hargaJual <= 0) return null;
  const modalRangka = Number(item.modalRangka) || 0;
  const modalMutiara = Number(item.modalMutiara) || 0;
  if (modalRangka === 0 && modalMutiara === 0) return null;
  return ((hargaJual - modalRangka - modalMutiara) / hargaJual) * 100;
};

const MarginBadge = ({ item }: { item: CatalogItem }) => {
  const margin = calculateMargin(item);
  if (margin === null) return null;
  let color = '#ef4444';
  let bg = 'rgba(239, 68, 68, 0.1)';
  if (margin > 30) { color = '#10b981'; bg = 'rgba(16, 185, 129, 0.1)'; }
  else if (margin >= 15) { color = '#f59e0b'; bg = 'rgba(245, 158, 11, 0.1)'; }
  return (
    <div title="Margin kotor estimasi" style={{ background: bg, color: color, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, marginLeft: 'auto', display: 'inline-block' }}>
      ▲ {margin.toFixed(0)}%
    </div>
  );
};

interface Props {
  catalogItems: CatalogItem[];
  rows: CustomerRow[];
}

export default function CatalogPage({ catalogItems, rows }: Props) {
  const [filterCat, setFilterCat] = useState('Semua');
  const [search, setSearch] = useState('');
  
  // Advanced Filters
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [filterPearlType, setFilterPearlType] = useState<string>('Semua');
  const [filterMinPrice, setFilterMinPrice] = useState<string>('');
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('Semua');
  
  // Compare Mode
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  
  // Drive Image State
  const CATALOG_DRIVE_FOLDER = '1IPKjQ8W07HkAm9gYutKcc-DbQ5T1klW-';
  const GOOGLE_API_KEY_STORAGE = 'pearlcrm_google_api_key';
  const DRIVE_IMAGE_MAP_STORAGE = 'pearlcrm_catalog_drive_map_v2';
  
  const [driveImageMap, setDriveImageMap] = useState<Record<string, string[]>>(() => {
    try {
      const cached = localStorage.getItem(DRIVE_IMAGE_MAP_STORAGE);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  
  // Debug states
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const addLog = (msg: string) => {
    console.log(`[Catalog Drive Sync] ${msg}`);
    setDebugLog(prev => [...prev, msg].slice(-15));
  };

  const fetchImages = async (force = false) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || localStorage.getItem(GOOGLE_API_KEY_STORAGE);
    if (!apiKey) {
      addLog('No API Key found');
      return;
    }
    
    try {
      addLog('Starting fetch...');
      setIsFetchingDrive(true);
      const folderId = CATALOG_DRIVE_FOLDER;
      let newMap: Record<string, string[]> = force ? {} : { ...driveImageMap }; 
      let hasNewData = false;
      
      // Step 1: Fetch all items in the root folder
      let rootPageToken: string | undefined = undefined;
      let rootFiles: any[] = [];
      do {
        const rootQ = `'${folderId}' in parents and trashed=false`;
        const url: string = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(rootQ)}&key=${apiKey}&fields=nextPageToken,files(id,name,mimeType,thumbnailLink)&pageSize=1000${rootPageToken ? `&pageToken=${rootPageToken}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Root fetch failed: ${res.status}`);
        const data = await res.json();
        rootFiles = [...rootFiles, ...(data.files || [])];
        rootPageToken = data.nextPageToken;
      } while (rootPageToken);

      const folderToSku: Record<string, string> = {};
      const folderIds: string[] = [];
      let rootImageCount = 0;

      rootFiles.forEach((f: any) => {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          folderToSku[f.id] = f.name.trim();
          folderIds.push(f.id);
        } else if (f.thumbnailLink && f.mimeType.startsWith('image/')) {
          const code = f.name.replace(/\.[^/.]+$/, '').trim();
          let url = '';
          if (f.thumbnailLink && !f.thumbnailLink.includes('/drive-storage/')) {
            url = f.thumbnailLink.replace('=s220', '=s800');
          } else if (f.id) {
            url = `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`;
          } else if (f.thumbnailLink) {
            url = f.thumbnailLink;
          }
          if (url) {
            if (!newMap[code]) newMap[code] = [];
            if (!newMap[code].includes(url)) {
              newMap[code].push(url);
              hasNewData = true;
            }
          }
          rootImageCount++;
        }
      });
      
      addLog(`Found ${folderIds.length} folders, ${rootImageCount} direct images`);

      // Step 2: Fetch images inside the subfolders
      let subImageCount = 0;
      if (folderIds.length > 0) {
        const fetchChunk = async (chunkIds: string[]) => {
          const q = `(${chunkIds.map(id => `'${id}' in parents`).join(' or ')}) and trashed=false`;
          const imagesUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${apiKey}&fields=files(id,parents,thumbnailLink,mimeType)&pageSize=1000`;
          const res = await fetch(imagesUrl);
          const data = await res.json();
          if (data.error) throw data.error;
          return data.files || [];
        };

        const processFiles = (files: any[]) => {
          files.forEach((f: any) => {
            if (f.parents && f.parents.length > 0 && (f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/') || f.thumbnailLink)) {
              let sku = null;
              for (const p of f.parents) {
                if (folderToSku[p]) { sku = folderToSku[p]; break; }
              }
              if (sku) {
                let url = '';
                
                if (f.id) {
                  // For public files, this is the most reliable high-res thumbnail generator
                  url = `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`;
                } else if (f.thumbnailLink) {
                  if (f.thumbnailLink.includes('/drive-storage/')) {
                    // This is a private signed link. Do not modify it (changing =s220 to =s800 breaks the signature)
                    url = f.thumbnailLink;
                  } else {
                    url = f.thumbnailLink.replace('=s220', '=s800');
                  }
                }
                  
                if (url) {
                  if (!newMap[sku]) newMap[sku] = [];
                  if (!newMap[sku].includes(url)) {
                    newMap[sku].push(url);
                    hasNewData = true;
                  }
                }
                subImageCount++;
              }
            }
          });
        };

        const chunkSize = 10;
        for (let i = 0; i < folderIds.length; i += chunkSize) {
          const chunk = folderIds.slice(i, i + chunkSize);
          try {
            // Try batch fetch first
            const files = await fetchChunk(chunk);
            processFiles(files);
          } catch (err: any) {
            addLog(`Batch failed (${err.message}). Retrying individually...`);
            // If batch fails (e.g., due to 1 restricted folder), try individually
            for (const id of chunk) {
              try {
                const files = await fetchChunk([id]);
                processFiles(files);
              } catch (singleErr: any) {
                addLog(`Folder ${folderToSku[id]} failed: ${singleErr.message}`);
              }
            }
          }
        }
      }
      
      addLog(`Found ${subImageCount} images inside folders`);
      
      if (hasNewData || force) {
        setDriveImageMap(newMap);
        localStorage.setItem(DRIVE_IMAGE_MAP_STORAGE, JSON.stringify(newMap));
        addLog(`Saved ${Object.keys(newMap).length} mapped images: ${Object.keys(newMap).join(', ')}`);
        // Log the first URL for debugging
        const firstKey = Object.keys(newMap)[0];
        if (firstKey) {
          addLog(`Sample URL for ${firstKey}: ${newMap[firstKey]}`);
        }
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsFetchingDrive(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(['Semua']);
    catalogItems.forEach((p) => {
      if (p.tipeBarang) {
        const type = p.tipeBarang.split(' ')[0] || 'Lainnya';
        cats.add(type);
      }
    });
    return [...cats];
  }, [catalogItems]);

  const pearlTypes = useMemo(() => {
    const types = new Set<string>();
    catalogItems.forEach(p => p.jenisMutiara && types.add(p.jenisMutiara));
    return ['Semua', ...Array.from(types).filter(t => t !== '-')];
  }, [catalogItems]);

  const grades = useMemo(() => {
    const g = new Set<string>();
    catalogItems.forEach(p => p.gradeMutiara && g.add(p.gradeMutiara));
    return ['Semua', ...Array.from(g).filter(t => t !== '-')];
  }, [catalogItems]);

  const displayed = useMemo(() => {
    return catalogItems.filter((p) => {
      // By default show ready stock, or show all if showSold is true
      if (!showSold && !p.isReady) return false;
      
      if (filterCat !== 'Semua') {
        const type = p.tipeBarang?.split(' ')[0] || 'Lainnya';
        if (type !== filterCat) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (!p.title?.toLowerCase().includes(s) && !p.kode?.toLowerCase().includes(s)) return false;
      }
      
      // Advanced filters
      if (filterPearlType !== 'Semua' && p.jenisMutiara !== filterPearlType) return false;
      if (filterGrade !== 'Semua' && p.gradeMutiara !== filterGrade) return false;
      if (filterMinPrice && Number(p.hargaJual) < Number(filterMinPrice)) return false;
      if (filterMaxPrice && Number(p.hargaJual) > Number(filterMaxPrice)) return false;
      
      return true;
    });
  }, [catalogItems, showSold, filterCat, search, filterPearlType, filterGrade, filterMinPrice, filterMaxPrice]);

  const activeFiltersCount = (filterPearlType !== 'Semua' ? 1 : 0) + (filterGrade !== 'Semua' ? 1 : 0) + (filterMinPrice ? 1 : 0) + (filterMaxPrice ? 1 : 0);

  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isFullscreenImage, setIsFullscreenImage] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const ITEMS_PER_PAGE = printMode ? 9999 : 40;
  
  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 300);
  };
  
  useEffect(() => {
    setPage(1);
  }, [filterCat, search, filterPearlType, filterGrade, filterMinPrice, filterMaxPrice]);

  const totalPages = Math.ceil(displayed.length / ITEMS_PER_PAGE);
  const currentItems = displayed.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="page-body">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .catalog-grid { 
            display: grid !important; 
            grid-template-columns: repeat(6, 1fr) !important; 
            gap: 10px !important; 
          }
          .catalog-card { border: 1px solid #ddd !important; box-shadow: none !important; break-inside: avoid; }
          .catalog-img-wrapper { height: 100px !important; }
          .catalog-content { padding: 8px !important; }
          .catalog-title { font-size: 11px !important; }
          .catalog-price { font-size: 12px !important; }
          .catalog-specs { display: none !important; }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Debug Log (collapsible) */}
        {debugLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0'
              }}
            >
              {showDebug ? 'Sembunyikan Log Diagnostik' : 'Tampilkan Log Diagnostik'}
            </button>
            {showDebug && (
              <div style={{ background: '#1e1e2d', color: '#a1a1aa', padding: 12, borderRadius: 8, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                <div style={{ color: '#fff', marginBottom: 4, fontWeight: 'bold' }}>Drive Sync Diagnostic Log:</div>
                {debugLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 200 }}>
            <Search size={14} color="var(--text-muted)" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Cari nama, kode, atau tipe mutiara..." 
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button 
                key={cat} 
                onClick={() => setFilterCat(cat)} 
                className={`btn ${filterCat === cat ? 'btn-primary' : 'btn-secondary'}`} 
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20 }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }} className="no-print">
            <button 
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)} 
              className={`btn ${showAdvancedFilter ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              🔽 Filter Lanjutan 
              {activeFiltersCount > 0 && <span style={{ background: 'var(--accent-purple)', padding: '2px 6px', borderRadius: 10, fontSize: 10, marginLeft: 4, color: 'white' }}>{activeFiltersCount}</span>}
            </button>
            <button 
              onClick={() => setShowSold(!showSold)} 
              className={`btn ${showSold ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8 }}
              title="Tampilkan perhiasan yang sudah terjual untuk referensi custom order"
            >
              {showSold ? '📦 Termasuk Terjual' : '✨ Stok Ready'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }} className="no-print">
            <button 
              onClick={() => fetchImages(true)} 
              disabled={isFetchingDrive}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 6, 
                padding: '6px 12px', borderRadius: 8, 
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 12, cursor: isFetchingDrive ? 'not-allowed' : 'pointer',
                opacity: isFetchingDrive ? 0.7 : 1
              }}
              title="Tarik ulang seluruh foto katalog dari Google Drive"
            >
              <RefreshCw size={14} className={isFetchingDrive ? "animate-spin" : ""} />
              Sync Foto
            </button>
            <button 
              className="btn btn-secondary print-keep" 
              onClick={handlePrint}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <Printer size={14} /> Print PDF
            </button>
          </div>
        </div>

        {/* Advanced Filter Panel */}
        {showAdvancedFilter && (
          <div style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }} className="no-print">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold' }}>Filter Lanjutan</div>
              {activeFiltersCount > 0 && (
                <button onClick={() => { setFilterPearlType('Semua'); setFilterGrade('Semua'); setFilterMinPrice(''); setFilterMaxPrice(''); }} style={{ fontSize: 12, color: 'var(--accent-purple)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset Filter</button>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Jenis Mutiara</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {pearlTypes.map(t => (
                    <button key={t} onClick={() => setFilterPearlType(t)} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, border: '1px solid var(--border)', background: filterPearlType === t ? 'var(--accent-purple)' : 'transparent', color: filterPearlType === t ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Grade</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {grades.map(t => (
                    <button key={t} onClick={() => setFilterGrade(t)} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, border: '1px solid var(--border)', background: filterGrade === t ? 'var(--accent-purple)' : 'transparent', color: filterGrade === t ? 'white' : 'var(--text-primary)', cursor: 'pointer' }}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>Rentang Harga (Rp)</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="number" placeholder="Min" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8, width: '100%' }} />
                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                  <input type="number" placeholder="Max" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', borderRadius: 8, width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Catalog Grid */}
        {displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💎</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Produk tidak ditemukan</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Coba sesuaikan kata kunci pencarian atau kategori filter</div>
          </div>
        ) : (
          <>
            <div className="catalog-grid">
              {currentItems.map((item) => {
                let resolvedImage = null;
                
                if (item.kode && driveImageMap[item.kode] && driveImageMap[item.kode].length > 0) {
                  // Priority 1: Image from the catalog Drive folder
                  resolvedImage = driveImageMap[item.kode][0];
                } else {
                  let imageSource = item.fotoR || item.fotoK;
                  
                  // Priority 2: Fallback to order history image
                  if (!imageSource && item.kode) {
                    const orderWithImage = rows.find(r => r.kode === item.kode && r.gambar);
                    if (orderWithImage) {
                      imageSource = orderWithImage.gambar;
                    }
                  }
                  
                  // Priority 3: Resolve any found image source (e.g., direct url from CSV)
                  resolvedImage = imageSource ? resolveImageUrl(imageSource) : null;
                }
                
                return (
                  <div 
                    key={item.id} 
                    className="catalog-card" 
                    onClick={() => { setSelectedItem(item); setGalleryIndex(0); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="catalog-img-wrapper">
                      <div className="no-print" style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={compareIds.includes(item.id)} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (compareIds.length < 3) setCompareIds([...compareIds, item.id]);
                              else alert("Maksimal 3 produk untuk dibandingkan");
                            } else {
                              setCompareIds(compareIds.filter(id => id !== item.id));
                            }
                          }}
                          style={{ width: 18, height: 18, cursor: 'pointer' }}
                          title="Bandingkan produk"
                        />
                      </div>
                      {resolvedImage ? (
                        <img 
                          src={resolvedImage} 
                          alt={item.title} 
                          className="catalog-img"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" fill="%231e1e2d"/><text x="50%" y="50%" fill="%236b7280" font-size="12" font-family="sans-serif" dominant-baseline="middle" text-anchor="middle">No Image</text></svg>';
                          }}
                        />
                      ) : (
                        <div className="catalog-no-img" title={driveImageMap[item.kode || '']?.[0] || ''}>No Image</div>
                      )}
                      <div className="catalog-code-badge">{item.kode}</div>
                    </div>
                    <div className="catalog-content">
                      <h3 className="catalog-title">{item.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto' }}>
                        <div className="catalog-price">{formatRupiah(item.hargaJual)}</div>
                        <MarginBadge item={item} />
                      </div>
                      
                      <div className="catalog-specs">
                        {item.jenisMutiara && item.jenisMutiara !== '-' && (
                          <div className="catalog-spec-item">
                            <Gem size={10} /> {item.jenisMutiara} {item.sizeMutiara && item.sizeMutiara !== '-' ? `(${item.sizeMutiara})` : ''}
                          </div>
                        )}
                        {item.rangka && item.rangka !== '-' && (
                          <div className="catalog-spec-item">
                            <ShoppingBag size={10} /> {item.rangka} {item.beratRangka && item.beratRangka !== '-' ? `· ${item.beratRangka}` : ''}
                          </div>
                        )}
                        {item.jenisBatu && item.jenisBatu !== '-' && (
                          <div className="catalog-spec-item">
                            <Sparkles size={10} /> {item.jenisBatu} {item.beratBatu && item.beratBatu !== '-' ? `· ${item.beratBatu}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && !printMode && (
              <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20 }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: 8, opacity: page === 1 ? 0.5 : 1 }}
                >
                  Sebelumnya
                </button>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  Halaman <strong style={{ color: 'var(--text-primary)' }}>{page}</strong> dari {totalPages}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', borderRadius: 8, opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Berikutnya
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem && createPortal(
        <div className="catalog-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-card)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <div className="catalog-modal-content" style={{ background: 'var(--bg-card)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h3 style={{ margin: 0, marginTop: 4, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Detail Produk</h3>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'var(--bg-tertiary)', border: 'none', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={16} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: '20px 20px 40px', overflowY: 'auto', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              
              {/* Image Section */}
              <div style={{ width: '100%', maxWidth: 320, flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 12, margin: '0 auto' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', height: 'auto', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-tertiary)', position: 'relative', flexShrink: 0 }}>
                  {(() => {
                    let images: string[] = [];
                    if (selectedItem.kode && driveImageMap[selectedItem.kode] && driveImageMap[selectedItem.kode].length > 0) {
                      images = driveImageMap[selectedItem.kode];
                    } else {
                      let src = selectedItem.fotoR || selectedItem.fotoK;
                      if (!src && selectedItem.kode) {
                        const order = rows.find(r => r.kode === selectedItem.kode && r.gambar);
                        if (order) src = order.gambar;
                      }
                      if (src) images = [resolveImageUrl(src)];
                    }
                    
                    if (images.length === 0) return <div className="catalog-no-img">No Image</div>;
                    
                    const safeIndex = galleryIndex >= 0 && galleryIndex < images.length ? galleryIndex : 0;
                    return (
                      <>
                        <img 
                          src={images[safeIndex]} 
                          alt={selectedItem.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                        {images.length > 1 && (
                          <>
                            <button 
                              onClick={() => setGalleryIndex(p => (p === 0 ? images.length - 1 : p - 1))}
                              style={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button 
                              onClick={() => setGalleryIndex(p => (p === images.length - 1 ? 0 : p + 1))}
                              style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: 16, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
                            >
                              <ChevronRight size={20} />
                            </button>
                            <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                              {safeIndex + 1} / {images.length}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                  <div style={{ position: 'absolute', top: 12, left: 12, background: 'var(--accent-green)', color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                    {formatRupiah(selectedItem.hargaJual)}
                  </div>
                </div>
                
                {/* Thumbnails */}
                {selectedItem.kode && driveImageMap[selectedItem.kode] && driveImageMap[selectedItem.kode].length > 1 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 4 }}>
                    {driveImageMap[selectedItem.kode].map((img, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setGalleryIndex(idx)}
                        style={{ 
                          width: 60, height: 60, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                          border: galleryIndex === idx ? '2px solid var(--accent-purple)' : '2px solid transparent',
                          opacity: galleryIndex === idx ? 1 : 0.6
                        }}
                      >
                        <img src={img} alt={`Thumbnail ${idx+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Detail Section */}
              <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Title & Code */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-purple)', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      <Tag size={12} /> {selectedItem.kode}
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: selectedItem.status?.toUpperCase() === 'R' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: selectedItem.status?.toUpperCase() === 'R' ? '#10b981' : '#ef4444', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                      {selectedItem.status?.toUpperCase() === 'R' ? '● Ready' : `● ${selectedItem.status}`}
                    </div>
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{selectedItem.title}</h2>
                </div>

                {/* Prices */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: '10px 14px', position: 'relative' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Harga Jual</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-green)', marginTop: 2 }}>{formatRupiah(selectedItem.hargaJual)}</div>
                    <div style={{ position: 'absolute', top: 10, right: 10 }}><MarginBadge item={selectedItem} /></div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Harga Barkode</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{formatRupiah(selectedItem.hargaBarkode)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Modal Rangka</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-secondary)', marginTop: 2 }}>{formatRupiah(selectedItem.modalRangka)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Modal Mutiara</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-secondary)', marginTop: 2 }}>{formatRupiah(selectedItem.modalMutiara)}</div>
                  </div>
                </div>

                {/* WhatsApp Button */}
                <button
                  onClick={() => {
                    const waMessage = `Halo Kak! 👋\n\nBerikut detail produk yang Anda tanyakan:\n\n✨ *${selectedItem.title || selectedItem.kode}*\n📿 Mutiara: ${selectedItem.jenisMutiara || '-'} | ${selectedItem.sizeMutiara || '-'}mm | Grade ${selectedItem.gradeMutiara || '-'} | ${selectedItem.warnaMutiara || '-'}\n🔧 Rangka: ${selectedItem.rangka || '-'}\n💎 Shape: ${selectedItem.bentukMutiara || '-'}\n💰 Harga Jual: Rp ${formatRupiah(selectedItem.hargaJual)}\n\nTertarik? Hubungi kami sekarang! ✨`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(waMessage)}`, '_blank');
                  }}
                  style={{ background: '#25D366', color: 'white', padding: '12px 16px', borderRadius: 10, border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: '100%', justifyContent: 'center', fontSize: 14 }}
                >
                  <span role="img" aria-label="whatsapp">📲</span> Bagikan ke WA
                </button>

                {/* All Fields Table */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {[
                    { label: 'No', value: selectedItem.no },
                    { label: 'Tanggal', value: selectedItem.tanggal },
                    { label: 'Tipe Barang', value: selectedItem.tipeBarang },
                    { label: 'Rangka', value: selectedItem.rangka },
                    { label: 'Berat Rangka', value: selectedItem.beratRangka },
                    { label: 'Jenis Mutiara', value: selectedItem.jenisMutiara },
                    { label: 'Warna Mutiara', value: selectedItem.warnaMutiara },
                    { label: 'Ukuran Mutiara', value: selectedItem.sizeMutiara ? `${selectedItem.sizeMutiara} mm` : '' },
                    { label: 'Bentuk Mutiara', value: selectedItem.bentukMutiara },
                    { label: 'Grade Mutiara', value: selectedItem.gradeMutiara },
                    { label: 'Berat Mutiara', value: selectedItem.beratMutiara },
                    { label: 'Jenis Batu', value: selectedItem.jenisBatu },
                    { label: 'Berat Batu', value: selectedItem.beratBatu },
                    { label: 'Panjang', value: selectedItem.panjang },
                    { label: 'Surface', value: selectedItem.surface },
                    { label: 'Shine / Luster', value: selectedItem.shineLuster },
                    { label: 'Shape', value: selectedItem.shape },
                    { label: 'Tis / Crack', value: selectedItem.tisCrack },
                  ].filter(r => r.value && r.value !== '-' && r.value !== '0').map((row, i) => (
                    <div key={row.label} style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <div style={{ width: '40%', padding: '8px 14px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{row.label}</div>
                      <div style={{ flex: 1, padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
          </div>
        </div>,
        document.body
      )}

      {/* Compare Mode Bottom Bar */}
      {compareIds.length >= 2 && !printMode && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-secondary)', border: '1px solid var(--accent-purple)', padding: '12px 24px', borderRadius: 30, display: 'flex', alignItems: 'center', gap: 20, zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
          <span style={{ fontWeight: 'bold', fontSize: 14 }}>🔍 Bandingkan {compareIds.length} produk</span>
          <button onClick={() => setShowCompareModal(true)} style={{ background: 'var(--accent-purple)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: 20, fontWeight: 'bold', cursor: 'pointer', fontSize: 13 }}>Lihat Perbandingan</button>
          <button onClick={() => setCompareIds([])} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && createPortal(
        <div className="catalog-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: 16, width: '90%', maxWidth: 1000, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Perbandingan Produk</h2>
              <button onClick={() => setShowCompareModal(false)} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
              {compareIds.map(id => {
                const item = catalogItems.find(i => i.id === id);
                if (!item) return null;
                
                let imageSource = item.fotoR || item.fotoK;
                let resolvedImage = imageSource ? resolveImageUrl(imageSource) : null;
                if (item.kode && driveImageMap[item.kode] && driveImageMap[item.kode].length > 0) {
                  resolvedImage = driveImageMap[item.kode][0];
                }

                return (
                  <div key={item.id} style={{ flex: 1, minWidth: 240, border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--bg-secondary)' }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-tertiary)', marginBottom: 16, borderRadius: 8, overflow: 'hidden' }}>
                      {resolvedImage ? <img src={resolvedImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div className="catalog-no-img">No Image</div>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--accent-purple)', fontWeight: 700, marginBottom: 4 }}>{item.kode}</div>
                    <h3 style={{ fontSize: 15, margin: '0 0 12px 0', lineHeight: 1.3 }}>{item.title}</h3>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)', marginBottom: 20 }}>{formatRupiah(item.hargaJual)}</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Mutiara</div><div style={{ fontWeight: 600 }}>{item.jenisMutiara || '-'}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Ukuran</div><div style={{ fontWeight: 600 }}>{item.sizeMutiara || '-'} mm</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Grade</div><div style={{ fontWeight: 600 }}>{item.gradeMutiara || '-'}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Bentuk</div><div style={{ fontWeight: 600 }}>{item.bentukMutiara || '-'}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Rangka</div><div style={{ fontWeight: 600 }}>{item.rangka || '-'}</div></div>
                      <div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Berat Rangka</div><div style={{ fontWeight: 600 }}>{item.beratRangka || '-'}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fullscreen Image Overlay */}
      {isFullscreenImage && selectedItem && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setIsFullscreenImage(false)}
        >
          <button 
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 20, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setIsFullscreenImage(false); }}
          >
            <X size={24} />
          </button>
          
          {(() => {
            let images: string[] = [];
            if (selectedItem.kode && driveImageMap[selectedItem.kode] && driveImageMap[selectedItem.kode].length > 0) {
              images = driveImageMap[selectedItem.kode];
            } else {
              let src = selectedItem.fotoR || selectedItem.fotoK;
              if (!src && selectedItem.kode) {
                const order = rows.find(r => r.kode === selectedItem.kode && r.gambar);
                if (order) src = order.gambar;
              }
              if (src) images = [resolveImageUrl(src)];
            }
            const safeIndex = galleryIndex >= 0 && galleryIndex < images.length ? galleryIndex : 0;
            if (images.length === 0) return null;
            return (
              <img 
                src={images[safeIndex]} 
                alt="Fullscreen" 
                style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }} 
                onClick={(e) => e.stopPropagation()}
              />
            );
          })()}
        </div>,
        document.body
      )}

      <style>{`
        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }
        
        @media (max-width: 640px) {
          .catalog-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
          }
        }
        
        .catalog-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
        }
        
        .catalog-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.15);
          border-color: rgba(139, 92, 246, 0.4);
        }
        
        .catalog-img-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          background: var(--bg-tertiary);
          overflow: hidden;
        }
        
        .catalog-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        
        .catalog-card:hover .catalog-img {
          transform: scale(1.05);
        }
        
        .catalog-no-img {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 12px;
          background: var(--bg-tertiary);
        }
        
        .catalog-code-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .catalog-content {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        
        .catalog-title {
          margin: 0;
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          word-break: break-word;
        }
        
        .catalog-price {
          font-size: 15px;
          font-weight: 800;
          color: var(--accent-green);
          margin-top: auto;
        }
        
        .catalog-specs {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 6px;
          padding-top: 10px;
          border-top: 1px dashed var(--border);
        }
        
        .catalog-spec-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary);
        }
        
        .catalog-modal-overlay {
          padding: 2vh 2vw !important;
          background: rgba(0,0,0,0.85) !important;
          z-index: 999999 !important;
        }
        
        .catalog-modal-content {
          max-width: 96vw !important;
          max-height: 96vh !important;
          height: 96vh !important;
          width: 96vw !important;
          border-radius: 16px !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
        }
        
        @media (max-width: 768px) {
          .catalog-modal-overlay {
            padding: 16px !important;
            align-items: flex-end !important;
          }
          .catalog-modal-content {
            max-width: 95vw !important;
            max-height: 80dvh !important;
            height: 80dvh !important;
            width: 95vw !important;
            border-radius: 20px !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            margin-bottom: 20px !important; /* Add space so it's clearly a popup */
          }
        }
      `}</style>
    </div>
  );
}
