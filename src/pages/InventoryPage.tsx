import { useState, useMemo } from 'react';
import { Package, Search, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import type { CatalogItem } from '../types';
import { formatRupiah } from '../utils/csvLoader';

interface Props {
  catalogItems: CatalogItem[];
}

export default function InventoryPage({ catalogItems }: Props) {
  const [filterCat, setFilterCat] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua'); // Semua, Ready, Sold
  const [search, setSearch] = useState('');

  const categories = useMemo(() => {
    const cats = new Set(['Semua']);
    catalogItems.forEach((p) => {
      const type = p.tipeBarang.split(' ')[0] || 'Lainnya';
      cats.add(type);
    });
    return [...cats];
  }, [catalogItems]);

  const displayed = useMemo(() => {
    return catalogItems
      .filter((p) => {
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

  return (
    <div className="page-body">
      <style>{`
        @media (max-width: 768px) {
          .inventory-table-wrapper { display: none !important; }
          .inventory-card-list { display: flex !important; flex-direction: column; gap: 12px; padding-bottom: 20px; }
        }
        @media (min-width: 769px) {
          .inventory-card-list { display: none !important; }
          .inventory-table-wrapper { display: block !important; }
        }
        .inv-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .inv-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .inv-card-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-purple);
        }
        .inv-card-type {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          display: inline-block;
          margin-top: 4px;
        }
        .inv-card-columns {
          display: flex;
          gap: 8px;
        }
        .inv-card-section {
          background: rgba(0,0,0,0.02);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }
        [data-theme='dark'] .inv-card-section {
          background: rgba(255,255,255,0.03);
        }
        .inv-card-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
      `}</style>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card purple">
          <div className="stat-icon purple"><Package size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Total Barang</div>
            <div className="stat-value">{catalogItems.length}</div>
            <div className="stat-sub">Item di spreadsheet</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><CheckCircle2 size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Stok Tersedia (Ready)</div>
            <div className="stat-value">{readyCount}</div>
            <div className="stat-sub">Item berstatus R</div>
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><TrendingUp size={18} /></div>
          <div className="stat-info">
            <div className="stat-label">Potensi Nilai Aset</div>
            <div className="stat-value">{formatRupiah(readyValue)}</div>
            <div className="stat-sub">Nilai dari barang Ready</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', flex: 1, minWidth: 200 }}>
          <Search size={13} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau nama perhiasan…" style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12.5, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilterCat(cat)} className={`btn ${filterCat === cat ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 11, padding: '5px 12px' }}>{cat}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
          <option value="Semua">Semua Status</option>
          <option value="Ready">Status: Ready</option>
          <option value="Sold">Status: Sold</option>
        </select>
      </div>

      {/* Alert if not synced */}
      <div style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ color: '#3b82f6' }}><AlertTriangle size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Data Terhubung Live ke Google Sheets</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Perubahan data dan stok (Status R/Sold) akan langsung disinkronisasi setiap kali aplikasi di-refresh. Tidak perlu input manual!</div>
        </div>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Tidak ada data ditemukan</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Pastikan kata kunci pencarian atau filter benar</div>
          </div>
        </div>
      ) : (
        <>
          <div className="card inventory-table-wrapper">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrapper">
                <table className="data-table">
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
                        <tr key={item.kode} style={{ opacity: item.isReady ? 1 : 0.6 }}>
                          <td style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>{item.kode}</td>
                          <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{type}</span></td>
                          <td>
                            <div style={{ fontSize: 12 }}>{item.rangka} {item.beratRangka && `(${item.beratRangka}gr)`}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Modal: <span style={{ fontWeight: 600 }}>{formatRupiah(item.modalRangka)}</span></div>
                          </td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.jenisMutiara}</div>
                            
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 4 }}>
                              {item.warnaMutiara && item.warnaMutiara !== '-' && <span>🎨 {item.warnaMutiara}</span>}
                              {item.beratMutiara && item.beratMutiara !== '-' && <span>⚖️ {item.beratMutiara}gr</span>}
                              {item.sizeMutiara && item.sizeMutiara !== '-' && <span>📏 {item.sizeMutiara}mm</span>}
                              {item.bentukMutiara && item.bentukMutiara !== '-' && <span>💠 {item.bentukMutiara}</span>}
                              {item.gradeMutiara && item.gradeMutiara !== '-' && <span>⭐ Grade {item.gradeMutiara}</span>}
                              {item.panjang && item.panjang !== '-' && <span>📏 Pjg: {item.panjang}</span>}
                            </div>
  
                            {((item.surface && item.surface !== '-') || (item.shineLuster && item.shineLuster !== '-') || (item.shape && item.shape !== '-') || (item.tisCrack && item.tisCrack !== '-')) && (
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', gap: 6, marginTop: 4, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, width: 'max-content' }}>
                                {item.surface && item.surface !== '-' && <span>Sur: {item.surface}</span>}
                                {item.shineLuster && item.shineLuster !== '-' && <span>Lus: {item.shineLuster}</span>}
                                {item.shape && item.shape !== '-' && <span>Shp: {item.shape}</span>}
                                {item.tisCrack && item.tisCrack !== '-' && <span>Tis: {item.tisCrack}</span>}
                              </div>
                            )}
  
                            {(item.jenisBatu && item.jenisBatu !== '-') && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                                ♦️ {item.jenisBatu} {item.beratBatu && item.beratBatu !== '-' ? `(${item.beratBatu})` : ''}
                              </div>
                            )}
  
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Modal: <span style={{ fontWeight: 600 }}>{formatRupiah(item.modalMutiara)}</span></div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(item.hargaJual)}</td>
                          <td>
                            {item.isReady
                              ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><div style={{width: 6, height: 6, borderRadius: '50%', background: '#10b981'}}/> Ready</span>
                              : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)', fontWeight: 700 }}>Sold</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="inventory-card-list">
            {displayed.map((item) => {
              const type = item.tipeBarang.split(' ')[0] || 'Lainnya';
              return (
                <div key={item.kode} className="inv-card" style={{ opacity: item.isReady ? 1 : 0.6 }}>
                  <div className="inv-card-header">
                    <div>
                      <div className="inv-card-title">{item.kode}</div>
                      <div className="inv-card-type">{type}</div>
                    </div>
                    <div>
                      {item.isReady
                        ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><div style={{width: 6, height: 6, borderRadius: '50%', background: '#10b981'}}/> Ready</span>
                        : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)', fontWeight: 700 }}>Sold</span>}
                    </div>
                  </div>

                  <div className="inv-card-columns">
                    <div className="inv-card-section">
                      <div className="inv-card-label">Rangka & Modal</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{item.rangka} {item.beratRangka && `(${item.beratRangka}gr)`}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Modal: <span style={{ fontWeight: 600 }}>{formatRupiah(item.modalRangka)}</span></div>
                    </div>
  
                    <div className="inv-card-section">
                      <div className="inv-card-label">Mutiara & Batu</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.jenisMutiara}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 4 }}>
                        {item.warnaMutiara && item.warnaMutiara !== '-' && <span>🎨 {item.warnaMutiara}</span>}
                        {item.beratMutiara && item.beratMutiara !== '-' && <span>⚖️ {item.beratMutiara}gr</span>}
                        {item.sizeMutiara && item.sizeMutiara !== '-' && <span>📏 {item.sizeMutiara}mm</span>}
                        {item.bentukMutiara && item.bentukMutiara !== '-' && <span>💠 {item.bentukMutiara}</span>}
                        {item.gradeMutiara && item.gradeMutiara !== '-' && <span>⭐ Grade {item.gradeMutiara}</span>}
                        {item.panjang && item.panjang !== '-' && <span>📏 Pjg: {item.panjang}</span>}
                      </div>
                      {((item.surface && item.surface !== '-') || (item.shineLuster && item.shineLuster !== '-') || (item.shape && item.shape !== '-') || (item.tisCrack && item.tisCrack !== '-')) && (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: 4 }}>
                          {item.surface && item.surface !== '-' && <span>Sur: {item.surface}</span>}
                          {item.shineLuster && item.shineLuster !== '-' && <span>Lus: {item.shineLuster}</span>}
                          {item.shape && item.shape !== '-' && <span>Shp: {item.shape}</span>}
                          {item.tisCrack && item.tisCrack !== '-' && <span>Tis: {item.tisCrack}</span>}
                        </div>
                      )}
                      {(item.jenisBatu && item.jenisBatu !== '-') && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          ♦️ {item.jenisBatu} {item.beratBatu && item.beratBatu !== '-' ? `(${item.beratBatu})` : ''}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Modal: <span style={{ fontWeight: 600 }}>{formatRupiah(item.modalMutiara)}</span></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '0 4px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Harga Jual</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-green)' }}>{formatRupiah(item.hargaJual)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
