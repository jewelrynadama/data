import { useState, useEffect } from 'react';
import { 
  Target, Calendar, MessageCircle, BarChart3, 
  Plus, Trash2, Check, Zap, Instagram, RefreshCw, Settings,
  TrendingUp, TrendingDown, DollarSign, Activity, MousePointerClick
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

  const handleSyncMeta = async () => {
    if (!metaAccountId || !metaToken) {
      setShowMetaSettings(true);
      return;
    }
    setIsSyncing(true);
    try {
      const fetchedAds = await fetchMetaCampaigns(metaAccountId, metaToken);
      // Merge with existing sales data if needed, or overwrite
      const merged = fetchedAds.map(ad => {
        const existing = ads.find(a => a.id === ad.id);
        if (existing) {
          return { ...ad, sales: existing.sales }; // keep manual sales
        }
        return ad;
      });
      setAds(merged);
    } catch (err: any) {
      alert("Gagal sinkronisasi: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

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
    <div className="page-body fade-in">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="premium-header-icon">
            <Target size={32} />
          </div>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 28, margin: '0 0 8px', fontWeight: 800 }}>
              Ads & Social Manager
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Lacak dan optimalkan pengeluaran Iklan Anda secara cerdas.</p>
          </div>
        </div>
      </div>

      {/* Modern Tabs (Segmented Control Style) */}
      <div className="modern-tab-container" style={{ background: 'var(--bg-tertiary)', padding: 4, borderRadius: 12, display: 'inline-flex', gap: 4, marginBottom: 24 }}>
        <button 
          className={`modern-tab ${activeTab === 'tracker' ? 'active' : ''}`} 
          style={{ padding: '10px 20px', borderRadius: 8, transition: 'all 0.2s', background: activeTab === 'tracker' ? 'var(--bg-card)' : 'transparent', boxShadow: activeTab === 'tracker' ? 'var(--shadow-sm)' : 'none', color: activeTab === 'tracker' ? 'var(--text-primary)' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('tracker')}
        >
          <BarChart3 size={16} /> IG Ads Tracker
        </button>
        <button 
          className={`modern-tab ${activeTab === 'calendar' ? 'active' : ''}`} 
          style={{ padding: '10px 20px', borderRadius: 8, transition: 'all 0.2s', background: activeTab === 'calendar' ? 'var(--bg-card)' : 'transparent', boxShadow: activeTab === 'calendar' ? 'var(--shadow-sm)' : 'none', color: activeTab === 'calendar' ? 'var(--text-primary)' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={16} /> Content Planner
        </button>
        <button 
          className={`modern-tab ${activeTab === 'whatsapp' ? 'active' : ''}`} 
          style={{ padding: '10px 20px', borderRadius: 8, transition: 'all 0.2s', background: activeTab === 'whatsapp' ? 'var(--bg-card)' : 'transparent', boxShadow: activeTab === 'whatsapp' ? 'var(--shadow-sm)' : 'none', color: activeTab === 'whatsapp' ? 'var(--text-primary)' : 'var(--text-muted)' }}
          onClick={() => setActiveTab('whatsapp')}
        >
          <MessageCircle size={16} /> WA A/B Testing
        </button>
      </div>

      {/* --- TAB: IG ADS TRACKER --- */}
      {activeTab === 'tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Top Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="stat-icon pink"><DollarSign size={22} /></div>
                <div>
                  <div className="stat-label">Total Spent</div>
                  <div className="stat-value">{formatRupiah(totalSpent)}</div>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="stat-icon green"><TrendingUp size={22} /></div>
                <div>
                  <div className="stat-label">Total Revenue</div>
                  <div className="stat-value">{formatRupiah(totalRevenue)}</div>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className={`stat-icon ${Number(overallROI) >= 0 ? 'green' : 'pink'}`}><Activity size={22} /></div>
                <div>
                  <div className="stat-label">Avg ROI</div>
                  <div className="stat-value" style={{ color: Number(overallROI) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {overallROI}%
                  </div>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="stat-icon cyan"><Target size={22} /></div>
                <div>
                  <div className="stat-label">Active Campaigns</div>
                  <div className="stat-value">{activeAdsCount}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Campaigns (Iklan Berjalan)</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={handleSyncMeta} disabled={isSyncing} style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-tertiary)', border: 'none' }}>
                <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
                {isSyncing ? 'Menyinkronkan...' : 'Sync Meta API'}
              </button>
              <button className="icon-btn" onClick={() => setShowMetaSettings(true)} title="Meta Settings">
                <Settings size={20} color="var(--text-secondary)" />
              </button>
              <button className="btn btn-primary" onClick={() => setShowAddAd(true)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Plus size={14} /> Buat Manual
              </button>
            </div>
          </div>

          {showAddAd && (
            <div className="card" style={{ padding: 20, border: '1px solid var(--accent-blue)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Tambah Campaign Baru</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nama Iklan</label>
                  <input className="form-input" value={newAd.name} onChange={e => setNewAd({...newAd, name: e.target.value})} placeholder="cth: Promo Cincin Kawin" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Budget (Rp)</label>
                  <input className="form-input" type="number" value={newAd.budget} onChange={e => setNewAd({...newAd, budget: Number(e.target.value)})} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveAd}>Simpan Iklan</button>
              <button className="btn btn-secondary" onClick={() => setShowAddAd(false)} style={{ marginLeft: 8 }}>Batal</button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {ads.map(ad => {
              const roi = ad.spent > 0 ? ((ad.sales - ad.spent) / ad.spent * 100).toFixed(1) : 0;
              const isRoiPositive = Number(roi) >= 0;
              const budgetUsage = ad.budget > 0 ? Math.min((ad.spent / ad.budget) * 100, 100) : 0;
              
              return (
                <div key={ad.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <h4 style={{ margin: '0 0 6px', fontSize: 16, lineHeight: 1.3 }}>{ad.name}</h4>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className={`badge ${ad.status === 'active' ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 11 }}>{ad.status.toUpperCase()}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Instagram size={12} color="#e1306c" /> {ad.platform}
                        </span>
                      </div>
                    </div>
                    <div className={`badge ${isRoiPositive ? 'badge-green' : 'badge-red'}`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}>
                      {isRoiPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {roi}%
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 10 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MousePointerClick size={14}/> Clicks</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{ad.clicks}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Target size={14}/> Leads/Sales</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{ad.leads} <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>/ {formatRupiah(ad.sales)}</span></div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>Spent: <b>{formatRupiah(ad.spent)}</b></span>
                      <span>Budget: {formatRupiah(ad.budget)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${budgetUsage}%`, 
                        background: budgetUsage > 90 ? 'var(--accent-red)' : 'var(--accent-blue)',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                  
                  <button 
                    className="icon-btn" 
                    onClick={() => setAds(ads.filter(a => a.id !== ad.id))}
                    style={{ position: 'absolute', bottom: 16, right: 16, background: 'var(--bg-tertiary)' }}
                  >
                    <Trash2 size={14} color="var(--accent-red)" />
                  </button>
                </div>
              );
            })}
            
            {ads.length === 0 && (
              <div className="empty-state-card" style={{ 
                gridColumn: '1 / -1', 
                padding: '48px 24px', 
                background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-tertiary) 100%)',
                border: '1px dashed var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 16
              }}>
                <div style={{ 
                  width: 64, height: 64, borderRadius: 20, 
                  background: 'linear-gradient(135deg, rgba(1, 126, 132, 0.2) 0%, rgba(113, 75, 103, 0.2) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-blue)', marginBottom: 8
                }}>
                  <BarChart3 size={32} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary)' }}>Belum Ada Kampanye Iklan Aktif</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 400 }}>Sinkronkan dengan akun Meta Developer Anda untuk menarik data otomatis, atau buat pencatatan iklan secara manual.</p>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => setShowAddAd(true)} style={{ padding: '10px 24px', borderRadius: 8, boxShadow: '0 4px 12px rgba(1, 126, 132, 0.3)' }}>
                    + Buat Manual
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowMetaSettings(true)} style={{ padding: '10px 24px', borderRadius: 8 }}>
                    <Settings size={16} style={{ marginRight: 6 }}/> Setup Meta API
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: CONTENT PLANNER --- */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Instagram Planner</h2>
            <button className="btn btn-primary" onClick={() => setShowAddPost(true)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Plus size={14} /> Jadwalkan Post
            </button>
          </div>

          {showAddPost && (
            <div className="card" style={{ padding: 20, border: '1px solid var(--accent-purple)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Jadwal Konten Baru</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tanggal Post</label>
                  <input className="form-input" type="date" value={newPost.date} onChange={e => setNewPost({...newPost, date: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Tipe Konten</label>
                  <select className="form-input" value={newPost.type} onChange={e => setNewPost({...newPost, type: e.target.value as any})}>
                    <option value="Reels">Reels</option>
                    <option value="Story">Story</option>
                    <option value="Feed">Feed</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Caption / Ide Konten</label>
                <textarea className="form-input" rows={3} value={newPost.caption} onChange={e => setNewPost({...newPost, caption: e.target.value})} placeholder="cth: Video unboxing cincin..." />
              </div>
              <button className="btn btn-primary" onClick={handleSavePost}>Simpan Jadwal</button>
              <button className="btn btn-secondary" onClick={() => setShowAddPost(false)} style={{ marginLeft: 8 }}>Batal</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.sort((a,b) => a.date.localeCompare(b.date)).map(post => (
              <div key={post.id} className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{post.date.split('-')[2]}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{post.date.split('-')[1]}-{post.date.split('-')[0]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-purple">{post.type}</span>
                    <span className={`badge ${post.status === 'planned' ? 'badge-gray' : 'badge-green'}`}>{post.status}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14 }}>{post.caption}</p>
                </div>
                <button className="icon-btn" onClick={() => {
                  setPosts(posts.map(p => p.id === post.id ? {...p, status: p.status === 'planned' ? 'posted' : 'planned'} : p));
                }}>
                  <Check size={20} color={post.status === 'posted' ? 'var(--accent-green)' : 'var(--text-muted)'} />
                </button>
                <button className="icon-btn" onClick={() => setPosts(posts.filter(p => p.id !== post.id))}><Trash2 size={16} color="var(--accent-red)" /></button>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="empty-state-card">
                <div className="empty-state-icon"><Calendar size={32} /></div>
                <div>
                  <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Jadwal Kosong</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Mulai jadwalkan Reels, Story, atau Feed Anda sekarang.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddPost(true)}>+ Jadwalkan Post</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: WA A/B TESTING --- */}
      {activeTab === 'whatsapp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} color="var(--accent-orange)" /> AI A/B Test WhatsApp Broadcast
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              AI akan membuat dua versi (*Formal* & *Casual*) untuk kampanye WA Anda, sehingga Anda bisa menguji mana yang konversinya paling tinggi.
            </p>
            
            <label style={{ display: 'block', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>Konteks / Tujuan Promo</label>
            <textarea 
              className="form-input" 
              rows={3} 
              value={waContext} 
              onChange={e => setWaContext(e.target.value)} 
              placeholder="cth: Promo cuci gudang cincin emas kuning diskon 20% khusus minggu ini, segera habiskan stok..."
              style={{ marginBottom: 16 }}
            />
            
            <button className="btn btn-primary" onClick={generateWA} disabled={!waContext || isGenerating} style={{ width: '100%', justifyContent: 'center' }}>
              {isGenerating ? 'Memproses dengan AI...' : 'Generate Variasi A/B Test'}
            </button>
          </div>

          {(waVariantA || waVariantB) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 20, borderTop: '4px solid var(--accent-blue)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--accent-blue)' }}>Varian A (Formal / Eksklusif)</h3>
                <textarea className="form-input" rows={8} value={waVariantA} onChange={e => setWaVariantA(e.target.value)} />
                <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => navigator.clipboard.writeText(waVariantA)}>Copy Varian A</button>
              </div>
              <div className="card" style={{ padding: 20, borderTop: '4px solid var(--accent-orange)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--accent-orange)' }}>Varian B (Casual / Mendesak)</h3>
                <textarea className="form-input" rows={8} value={waVariantB} onChange={e => setWaVariantB(e.target.value)} />
                <button className="btn btn-secondary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => navigator.clipboard.writeText(waVariantB)}>Copy Varian B</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- META SETTINGS MODAL --- */}
      {showMetaSettings && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <h2 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} color="var(--accent-blue)" /> Meta API Settings
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Masukkan kredensial dari Meta Developer App Anda untuk menarik data pengeluaran dan hasil Iklan Facebook/Instagram secara otomatis.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Ad Account ID (Tanpa 'act_')</label>
              <input className="form-input" value={metaAccountId} onChange={e => setMetaAccountId(e.target.value)} placeholder="Contoh: 123456789012345" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>System User Access Token</label>
              <textarea className="form-input" rows={4} value={metaToken} onChange={e => setMetaToken(e.target.value)} placeholder="EAAI..." />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowMetaSettings(false)}>Tutup</button>
              <button className="btn btn-primary" onClick={() => { setShowMetaSettings(false); handleSyncMeta(); }}>Simpan & Sync</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
