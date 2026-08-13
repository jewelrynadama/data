import { useState, useEffect } from 'react';
import { 
  Target, Calendar, MessageCircle, BarChart3, 
  Plus, Trash2, Check, Zap, Instagram, RefreshCw, Settings,
  TrendingUp, TrendingDown, DollarSign, Activity
} from 'lucide-react';
import { generateSmartCopy } from '../utils/aiEngines';
import { formatRupiah } from '../utils/csvLoader';
import { fetchMetaCampaigns } from '../utils/metaAdsEngine';
import type { MetaAdCampaign } from '../utils/metaAdsEngine';

type AdsTab = 'tracker' | 'calendar' | 'whatsapp';

interface ContentPost {
  id: string;
  date: string;
  type: 'Reels' | 'Story' | 'Feed';
  caption: string;
  status: 'planned' | 'posted';
}

export default function AdsManagerPage() {
  const [activeTab, setActiveTab] = useState<AdsTab>('tracker');

  // --- Meta Ads Tracker State ---
  const [ads, setAds] = useState<MetaAdCampaign[]>(() => {
    try { return JSON.parse(localStorage.getItem('pearlcrm_ads') || '[]'); } catch { return []; }
  });
  const [showAddAd, setShowAddAd] = useState(false);
  const [newAd, setNewAd] = useState<Partial<MetaAdCampaign>>({ name: '', budget: 500000, platform: 'instagram', status: 'active' });
  
  // --- Meta API State ---
  const [metaAccountId, setMetaAccountId] = useState(localStorage.getItem('pearlcrm_meta_account_id') || '1120351115414747');
  const [metaToken, setMetaToken] = useState(localStorage.getItem('pearlcrm_meta_token') || 'EAGKGC0ax4p8BSFQxWsaRzXUSJJCTur1cxGujNbTXOtAn3EIKD5yRt8lDXlK7WLPvZCdAFGFRSAz5WTI5inT5OYwP7IXNBMxkROIKSk65WR6wOxPQZAPYx3MkPbbwhiF512lMMcOZBYP67h7GZAbH4o2Mp19gyBCG9agW602X6wYMKwuUQxkoxR2YuDP2e1BUSR4B');
  const [lastSyncTime, setLastSyncTime] = useState<number>(() => {
    return Number(localStorage.getItem('pearlcrm_meta_last_sync') || '0');
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showMetaSettings, setShowMetaSettings] = useState(false);

  // --- Content Calendar State ---
  const [posts, setPosts] = useState<ContentPost[]>(() => {
    try { return JSON.parse(localStorage.getItem('pearlcrm_posts') || '[]'); } catch { return []; }
  });
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState<Partial<ContentPost>>({ type: 'Reels', date: new Date().toISOString().split('T')[0], status: 'planned', caption: '' });

  // --- WhatsApp A/B Test State ---
  const [waContext, setWaContext] = useState('');
  const [waVariantA, setWaVariantA] = useState('');
  const [waVariantB, setWaVariantB] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => { localStorage.setItem('pearlcrm_ads', JSON.stringify(ads)); }, [ads]);
  useEffect(() => { localStorage.setItem('pearlcrm_posts', JSON.stringify(posts)); }, [posts]);
  useEffect(() => { 
    localStorage.setItem('pearlcrm_meta_account_id', metaAccountId); 
    localStorage.setItem('pearlcrm_meta_token', metaToken); 
  }, [metaAccountId, metaToken]);
  useEffect(() => {
    localStorage.setItem('pearlcrm_meta_last_sync', String(lastSyncTime));
  }, [lastSyncTime]);

  const handleSyncMeta = async (auto = false) => {
    if (!metaAccountId || !metaToken) {
      if (!auto) setShowMetaSettings(true);
      return;
    }
    setIsSyncing(true);
    try {
      const fetchedAds = await fetchMetaCampaigns(metaAccountId, metaToken);
      const merged = fetchedAds.map(ad => {
        const existing = ads.find(a => a.id === ad.id);
        return existing ? { ...ad, sales: existing.sales } : ad;
      });
      setAds(merged);
      setLastSyncTime(Date.now());
    } catch (err: any) {
      if (!auto) alert("Gagal sinkronisasi: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-Sync 12 Jam (43200000 ms)
  useEffect(() => {
    const twelveHours = 12 * 60 * 60 * 1000;
    if (Date.now() - lastSyncTime > twelveHours) {
      handleSyncMeta(true);
    }
    const interval = setInterval(() => {
      handleSyncMeta(true);
    }, twelveHours);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [lastSyncTime, metaAccountId, metaToken]);

  // Handlers
  const handleSaveAd = () => {
    if (!newAd.name) return;
    const ad: MetaAdCampaign = {
      id: `ad-${Date.now()}`,
      name: newAd.name,
      budget: newAd.budget || 0,
      platform: newAd.platform as any,
      status: newAd.status as any,
      clicks: 0, spent: 0, leads: 0, sales: 0,
    };
    setAds([...ads, ad]);
    setShowAddAd(false);
    setNewAd({ name: '', budget: 500000, platform: 'instagram', status: 'active' });
  };

  const handleSavePost = () => {
    if (!newPost.caption) return;
    const post: ContentPost = {
      id: `post-${Date.now()}`,
      date: newPost.date || '',
      type: newPost.type as any,
      caption: newPost.caption,
      status: newPost.status as any,
    };
    setPosts([...posts, post]);
    setShowAddPost(false);
    setNewPost({ type: 'Reels', date: new Date().toISOString().split('T')[0], status: 'planned', caption: '' });
  };

  const generateWA = async () => {
    if (!waContext) return;
    setIsGenerating(true);
    try {
      const resA = await generateSmartCopy(waContext, 'formal');
      const resB = await generateSmartCopy(waContext, 'casual');
      setWaVariantA(resA);
      setWaVariantB(resB);
    } catch (e) {
      alert("Gagal memanggil AI. Pastikan API Key Gemini sudah dikonfigurasi.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Derived Metrics ---
  const totalSpent = ads.reduce((sum, ad) => sum + ad.spent, 0);
  const totalRevenue = ads.reduce((sum, ad) => sum + ad.sales, 0);
  const overallROI = totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent * 100).toFixed(1) : 0;
  const activeAdsCount = ads.filter(a => a.status === 'active').length;

  return (
    <div className="page-body fade-in" style={{ padding: 16 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Header - Meta Business Suite Style */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, margin: '0 0 4px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Ads & Social Manager
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Tinjauan kampanye aktif dan perencana konten</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowMetaSettings(true)} style={{ fontSize: 13, padding: '6px 12px' }}>
            <Settings size={14} style={{ marginRight: 6 }}/> Pengaturan Meta
          </button>
          <button className="btn btn-secondary" onClick={() => handleSyncMeta(false)} disabled={isSyncing} style={{ fontSize: 13, padding: '6px 12px' }}>
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} style={{ marginRight: 6 }}/>
            {isSyncing ? 'Sinkronisasi...' : 'Sinkronkan'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('tracker')}
          style={{ 
            background: 'none', border: 'none', padding: '0 0 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: activeTab === 'tracker' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'tracker' ? '2px solid var(--text-primary)' : '2px solid transparent'
          }}>
          <BarChart3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/>
          Tracker Iklan
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          style={{ 
            background: 'none', border: 'none', padding: '0 0 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: activeTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'calendar' ? '2px solid var(--text-primary)' : '2px solid transparent'
          }}>
          <Calendar size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/>
          Perencana Konten
        </button>
        <button 
          onClick={() => setActiveTab('whatsapp')}
          style={{ 
            background: 'none', border: 'none', padding: '0 0 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            color: activeTab === 'whatsapp' ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'whatsapp' ? '2px solid var(--text-primary)' : '2px solid transparent'
          }}>
          <MessageCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }}/>
          Uji A/B WhatsApp
        </button>
      </div>

      {/* --- TAB: IG ADS TRACKER --- */}
      {activeTab === 'tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Top Summary Cards (Compact) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', boxShadow: 'none' }}>
              <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)' }}><DollarSign size={16} /></div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Pengeluaran</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatRupiah(totalSpent)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', boxShadow: 'none' }}>
              <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)' }}><TrendingUp size={16} /></div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Pendapatan</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatRupiah(totalRevenue)}</div>
              </div>
            </div>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', boxShadow: 'none' }}>
              <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)' }}><Activity size={16} /></div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rata-rata ROI</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{overallROI}%</div>
              </div>
            </div>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--border)', boxShadow: 'none' }}>
              <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, color: 'var(--text-secondary)' }}><Target size={16} /></div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kampanye Aktif</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{activeAdsCount}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Semua Kampanye</h2>
            <button className="btn btn-primary" onClick={() => setShowAddAd(true)} style={{ fontSize: 12, padding: '6px 12px' }}>
              <Plus size={14} style={{ marginRight: 4 }}/> Buat Manual
            </button>
          </div>

          {showAddAd && (
            <div className="card" style={{ padding: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)', boxShadow: 'none' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Tambah Kampanye Baru</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Nama Kampanye</label>
                  <input className="form-input" style={{ fontSize: 12, padding: '6px 10px', height: 32 }} value={newAd.name} onChange={e => setNewAd({...newAd, name: e.target.value})} placeholder="cth: Promo Cincin Kawin" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Anggaran (Rp)</label>
                  <input className="form-input" style={{ fontSize: 12, padding: '6px 10px', height: 32 }} type="number" value={newAd.budget} onChange={e => setNewAd({...newAd, budget: Number(e.target.value)})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSaveAd} style={{ fontSize: 12, padding: '6px 12px' }}>Simpan</button>
                <button className="btn btn-secondary" onClick={() => setShowAddAd(false)} style={{ fontSize: 12, padding: '6px 12px' }}>Batal</button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ads.map(ad => {
              const roi = ad.spent > 0 ? ((ad.sales - ad.spent) / ad.spent * 100).toFixed(1) : 0;
              const isRoiPositive = Number(roi) >= 0;
              const budgetUsage = ad.budget > 0 ? Math.min((ad.spent / ad.budget) * 100, 100) : 0;
              
              return (
                <div key={ad.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', border: '1px solid var(--border)', boxShadow: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{ad.name}</h4>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: ad.status === 'active' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ad.status}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>•</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Instagram size={10} color="var(--text-muted)" /> {ad.platform}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                      {isRoiPositive ? <TrendingUp size={12} color="var(--accent-green)" /> : <TrendingDown size={12} color="var(--accent-red)" />} {roi}%
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, background: 'var(--bg-tertiary)', padding: 8, borderRadius: 6 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 11 }}>Klik Tautan</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ad.clicks.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2, fontSize: 11 }}>Penjualan</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{formatRupiah(ad.sales)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span>Spent: <b>{formatRupiah(ad.spent)}</b></span>
                      <span>Budget: {formatRupiah(ad.budget)}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${budgetUsage}%`, 
                        background: budgetUsage > 90 ? 'var(--accent-red)' : 'var(--text-primary)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setAds(ads.filter(a => a.id !== ad.id))}
                    style={{ position: 'absolute', bottom: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    title="Hapus Kampanye"
                  >
                    <Trash2 size={14} color="var(--text-muted)" />
                  </button>
                </div>
              );
            })}
            
            {ads.length === 0 && (
              <div className="empty-state-card" style={{ gridColumn: '1 / -1', padding: '32px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 12 }}>
                  <BarChart3 size={20} />
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600 }}>Belum Ada Kampanye</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12, maxWidth: 300, marginBottom: 16 }}>Sinkronkan dengan Meta atau tambahkan pencatatan manual.</p>
                <button className="btn btn-primary" onClick={() => setShowAddAd(true)} style={{ fontSize: 12, padding: '6px 16px' }}>Buat Kampanye</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: CONTENT PLANNER --- */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Jadwal Konten</h2>
            <button className="btn btn-primary" onClick={() => setShowAddPost(true)} style={{ fontSize: 12, padding: '6px 12px' }}>
              <Plus size={14} style={{ marginRight: 4 }} /> Jadwalkan Post
            </button>
          </div>

          {showAddPost && (
            <div className="card" style={{ padding: 16, border: '1px solid var(--border)', boxShadow: 'none' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Jadwal Baru</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Tanggal Post</label>
                  <input className="form-input" style={{ fontSize: 12, padding: '6px 10px', height: 32 }} type="date" value={newPost.date} onChange={e => setNewPost({...newPost, date: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Format</label>
                  <select className="form-input" style={{ fontSize: 12, padding: '6px 10px', height: 32 }} value={newPost.type} onChange={e => setNewPost({...newPost, type: e.target.value as any})}>
                    <option value="Reels">Reels</option>
                    <option value="Story">Story</option>
                    <option value="Feed">Feed</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Detail / Teks</label>
                <textarea className="form-input" style={{ fontSize: 12, padding: '8px 10px' }} rows={2} value={newPost.caption} onChange={e => setNewPost({...newPost, caption: e.target.value})} placeholder="cth: Video unboxing..." />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSavePost} style={{ fontSize: 12, padding: '6px 12px' }}>Simpan</button>
                <button className="btn btn-secondary" onClick={() => setShowAddPost(false)} style={{ fontSize: 12, padding: '6px 12px' }}>Batal</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.sort((a,b) => a.date.localeCompare(b.date)).map(post => (
              <div key={post.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--border)', boxShadow: 'none' }}>
                <div style={{ width: 48, textAlign: 'center', borderRight: '1px solid var(--border)', paddingRight: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{post.date.split('-')[2]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{post.date.split('-')[1]}/{post.date.split('-')[0].slice(2)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: 4 }}>{post.type}</span>
                    {post.status === 'posted' && <span style={{ fontSize: 10, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 2 }}><Check size={10} /> Dipublikasikan</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>{post.caption}</p>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setPosts(posts.map(p => p.id === post.id ? {...p, status: p.status === 'planned' ? 'posted' : 'planned'} : p))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: 6, cursor: 'pointer', color: post.status === 'posted' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setPosts(posts.filter(p => p.id !== post.id))} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="empty-state-card" style={{ padding: '32px 16px', border: '1px solid var(--border)' }}>
                <Calendar size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Jadwal Kosong</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>Mulai jadwalkan rencana konten Anda.</p>
                <button className="btn btn-primary" onClick={() => setShowAddPost(true)} style={{ fontSize: 12, padding: '6px 16px' }}>Buat Jadwal</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: WA A/B TESTING --- */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16, border: '1px solid var(--border)', boxShadow: 'none' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color="var(--text-muted)" /> Eksperimen Pesan (A/B Test)
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Uji dua variasi teks untuk audiens yang sama agar menemukan pesan dengan konversi terbaik.
            </p>
            
            <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>Topik / Penawaran</label>
            <textarea 
              className="form-input" 
              rows={2}
              style={{ fontSize: 12, padding: '8px 10px', marginBottom: 12 }}
              value={waContext} 
              onChange={e => setWaContext(e.target.value)} 
              placeholder="cth: Promo cincin kawin diskon 20% khusus minggu ini..."
            />
            
            <button className="btn btn-primary" onClick={generateWA} disabled={!waContext || isGenerating} style={{ fontSize: 12, padding: '6px 12px' }}>
              {isGenerating ? 'Menghasilkan Variasi...' : 'Hasilkan Variasi AI'}
            </button>
          </div>

          {(waVariantA || waVariantB) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card" style={{ padding: 16, border: '1px solid var(--border)', borderLeft: '3px solid var(--text-primary)', boxShadow: 'none' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Varian A (Formal)</h3>
                <textarea className="form-input" rows={6} style={{ fontSize: 12 }} value={waVariantA} onChange={e => setWaVariantA(e.target.value)} />
                <button className="btn btn-secondary" style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }} onClick={() => navigator.clipboard.writeText(waVariantA)}>Salin Teks</button>
              </div>
              <div className="card" style={{ padding: 16, border: '1px solid var(--border)', borderLeft: '3px solid var(--text-muted)', boxShadow: 'none' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Varian B (Kasual)</h3>
                <textarea className="form-input" rows={6} style={{ fontSize: 12 }} value={waVariantB} onChange={e => setWaVariantB(e.target.value)} />
                <button className="btn btn-secondary" style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }} onClick={() => navigator.clipboard.writeText(waVariantB)}>Salin Teks</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- META SETTINGS MODAL --- */}
      {showMetaSettings && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, padding: 20 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Pengaturan API Meta</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Masukkan ID Akun Iklan dan Token Akses untuk mengambil data secara otomatis. Data akan di-sync otomatis setiap 12 jam.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>ID Akun Iklan</label>
              <input className="form-input" style={{ fontSize: 12, height: 32 }} value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} placeholder="Contoh: 123456789012345" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>Token Akses (System User)</label>
              <textarea className="form-input" style={{ fontSize: 12, padding: '8px 10px' }} rows={3} value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="EAAI..." />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setShowMetaSettings(false)}>Tutup</button>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => { setShowMetaSettings(false); handleSyncMeta(false); }}>Simpan & Sync</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
