import { useState, useEffect } from 'react';
import { 
  Target, Calendar, MessageCircle, BarChart3, 
  Plus, Trash2, Check, Zap, Instagram, RefreshCw, Settings
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
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Tingkatkan penjualan dengan iklan dan marketing cerdas.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="modern-tab-container">
        <button className={`modern-tab ${activeTab === 'tracker' ? 'active' : ''}`} onClick={() => setActiveTab('tracker')}>
          <BarChart3 size={16} /> IG Ads Tracker
        </button>
        <button className={`modern-tab ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
          <Calendar size={16} /> Content Planner
        </button>
        <button className={`modern-tab ${activeTab === 'whatsapp' ? 'active' : ''}`} onClick={() => setActiveTab('whatsapp')}>
          <MessageCircle size={16} /> WA A/B Testing
        </button>
      </div>

      {/* --- TAB: IG ADS TRACKER --- */}
      {activeTab === 'tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Campaigns (Iklan Berjalan)</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={handleSyncMeta} disabled={isSyncing} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
            <div className="card" style={{ padding: 20, border: '1px solid var(--accent-blue)' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {ads.map(ad => {
              const roi = ad.spent > 0 ? ((ad.sales - ad.spent) / ad.spent * 100).toFixed(1) : 0;
              return (
                <div key={ad.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>{ad.name}</h4>
                      <span className={`badge ${ad.status === 'active' ? 'badge-blue' : 'badge-gray'}`}>{ad.status}</span>
                    </div>
                    <Instagram size={20} color="#e1306c" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Budget:</span><br/><b>{formatRupiah(ad.budget)}</b></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Spent:</span><br/><b>{formatRupiah(ad.spent)}</b></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Clicks:</span><br/><b>{ad.clicks}</b></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Leads/Sales:</span><br/><b>{ad.leads} / {formatRupiah(ad.sales)}</b></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{ fontSize: 12, color: Number(roi) > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>ROI: {roi}%</span>
                    <button className="icon-btn" onClick={() => setAds(ads.filter(a => a.id !== ad.id))}><Trash2 size={14} color="var(--accent-red)" /></button>
                  </div>
                </div>
              );
            })}
            {ads.length === 0 && (
              <div className="empty-state-card" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-state-icon"><BarChart3 size={32} /></div>
                <div>
                  <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Belum Ada Iklan Aktif</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>Sinkronkan dengan Meta API atau buat iklan secara manual.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowAddAd(true)}>+ Buat Manual</button>
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
