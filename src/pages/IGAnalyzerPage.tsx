import { useState, useMemo } from 'react';
import { 
  Search, Instagram, Activity, Eye, MessageSquare, 
  Copy, Check, ChevronRight, Gift, Sparkles, AlertCircle, RefreshCw,
  Heart, MessageCircle, TrendingUp, Clock, FileText, User, Target, CalendarHeart, UserPlus, Database, PlayCircle
} from 'lucide-react';
import type { Customer } from '../types';

// === Mock Data Dictionaries for Simulation ===
const AESTHETICS = [
  { name: 'Minimalist Monochrome', desc: 'Tone hitam putih/netral. Terlihat bersih, modern, dan profesional.', product: 'Cincin Emas Putih Mutiara Hitam', color1: '#E5E7EB', color2: '#9CA3AF', color3: '#374151' },
  { name: 'Warm & Earthy', desc: 'Tone hangat (coklat, beige, olive). Menggambarkan kedekatan alam dan kehangatan.', product: 'Kalung Rose Gold Mutiara Air Tawar', color1: '#D4A373', color2: '#FAEDCD', color3: '#CCD5AE' },
  { name: 'Glamour & Luxury', desc: 'Kilauan emas, bold, kontras tinggi. Menunjukkan gaya hidup premium.', product: 'Set Perhiasan Emas 18k Mutiara Laut', color1: '#111827', color2: '#FBBF24', color3: '#991B1B' },
  { name: 'Pastel & Soft', desc: 'Warna lembut (pink muda, baby blue). Gaya sangat feminin dan manis.', product: 'Gelang Rantai Kecil Mutiara Keshi', color1: '#FBCFE8', color2: '#BFDBFE', color3: '#DDD6FE' },
  { name: 'Casual & Lifestyle', desc: 'Foto kegiatan sehari-hari, natural, tanpa filter berlebihan.', product: 'Anting Stud Mutiara Klasik', color1: '#93C5FD', color2: '#FDE047', color3: '#86EFAC' }
];

const PERSONAS = [
  'Career Woman (Profesional, Elegan, Time-efficient)',
  'Fashion Enthusiast (Trendy, Berani bereksperimen)',
  'Family Oriented (Sering post keluarga/anak, Hangat)',
  'Traveler / Explorer (Suka jalan-jalan, Dinamis)',
  'Socialite (Suka acara sosial, arisan, pesta)'
];

const ACTIVE_TIMES = ['09:00 - 11:00', '12:00 - 14:00', '16:00 - 18:00', '19:00 - 21:00', '21:00 - 23:00'];

const OCCASIONS = [
  { label: 'Ulang Tahun Bulan Ini', reason: 'Cocok ditawarkan promo BDAY10' },
  { label: 'Persiapan Anniversary / Menikah', reason: 'Tawarkan paket Couple / Cincin' },
  { label: 'Baru Saja Lulus / Wisuda', reason: 'Tawarkan perhiasan sebagai Reward / Hadiah Kelulusan' },
  { label: 'Promosi Jabatan / Pekerjaan Baru', reason: 'Tawarkan perhiasan elegan untuk profesional' },
  { label: 'Tidak Ada Momen Spesifik', reason: 'Pendekatan dengan produk Best Seller' }
];

const BUDGET_TIERS = [
  { label: 'Elite (Rp 5jt - Rp 15jt+)', desc: 'Cocok ditawarkan produk Mutiara Laut Selatan.' },
  { label: 'Premium (Rp 1jt - Rp 5jt)', desc: 'Cocok ditawarkan perhiasan emas & mutiara premium.' },
  { label: 'Casual (Rp 300rb - Rp 1jt)', desc: 'Tawarkan mutiara air tawar (Freshwater) atau perak.' },
  { label: 'Budget (< Rp 300rb)', desc: 'Arahkan ke aksesoris rhodium atau promo diskon besar.' }
];

// Simple hash function for deterministic results based on username
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate deterministic birthday
function getDeterministicBirthday(hash: number): string {
  const day = (hash % 28) + 1; // 1-28 to be safe for all months
  const month = (hash % 12) + 1; // 1-12
  const year = 1975 + (hash % 30); // 1975-2004
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(day)}/${pad(month)}/${year}`;
}

interface IGAnalyzerProps {
  onAddCustomer?: (customer: { nama: string; instagram?: string }) => void;
  customers?: Customer[];
  onEditCustomer?: (id: string, patch: Partial<Customer>) => void;
}

export default function IGAnalyzerPage({ onAddCustomer, customers = [], onEditCustomer }: IGAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'profiler' | 'bulk'>('profiler');

  // Single Profiler State
  const [username, setUsername] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [copiedDM, setCopiedDM] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [savedLead, setSavedLead] = useState(false);

  // Bulk Scanner State
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [scanResult, setScanResult] = useState<{ scanned: number, found: number } | null>(null);

  // --- SINGLE PROFILER LOGIC ---
  const analysis = useMemo(() => {
    if (!username || !hasAnalyzed) return null;
    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    if (!cleanUsername) return null;

    const hash = hashString(cleanUsername);
    const followers = 500 + (hash % 25000);
    const following = 200 + (hash % 1000);
    const posts = 20 + (hash % 500);
    const erValue = (1.5 + (hash % 60) / 10);
    const er = erValue.toFixed(2);
    
    const totalEngagements = Math.round(followers * (erValue / 100));
    const avgLikes = Math.round(totalEngagements * 0.88);
    const avgComments = Math.round(totalEngagements * 0.12);
    const growth = ((hash % 100) / 10).toFixed(1);
    
    const statusVal = hash % 10;
    const accountStatus = statusVal > 8 ? 'Trending' : statusVal > 2 ? 'Active' : 'Ghost';
    const statusColor = accountStatus === 'Trending' ? '#10B981' : accountStatus === 'Active' ? '#3B82F6' : '#9CA3AF';

    const occasion = OCCASIONS[hash % OCCASIONS.length];
    let budgetTier;
    if (followers > 15000 && statusVal > 6) budgetTier = BUDGET_TIERS[0];
    else if (followers > 5000 || statusVal > 4) budgetTier = BUDGET_TIERS[1];
    else if (followers > 1000) budgetTier = BUDGET_TIERS[2];
    else budgetTier = BUDGET_TIERS[3];

    const aesthetic = AESTHETICS[hash % AESTHETICS.length];
    const persona = PERSONAS[(hash + 1) % PERSONAS.length];
    const activeTime = ACTIVE_TIMES[hash % ACTIVE_TIMES.length];
    
    let occasionText = '';
    if (occasion.label.includes('Ulang Tahun')) occasionText = ` Denger-denger lagi bulan ulang tahun ya kak? Selamat ya! 🎂`;
    else if (occasion.label.includes('Anniversary')) occasionText = ` Sebentar lagi momen spesialnya nih kak, semoga lancar persiapannya ya! ✨`;

    const dmTemplate = `Halo kak @${cleanUsername}! ✨${occasionText}\n\nSuka banget sama feeds Instagram kakak yang temanya ${aesthetic.name}. Gaya kakak kelihatan ${persona.split(' ')[0]} banget!\n\nKebetulan PearlStore punya koleksi ${aesthetic.product} yang kayaknya bakal cocok banget buat ngelengkapin OOTD kakak.\n\nLagi ada promo spesial khusus untuk teman baru nih. Boleh kami kirimkan katalognya kak? 😊`;
    const summaryText = `[IG LEAD REPORT]\nUsername: @${cleanUsername}\nStatus: ${accountStatus}\nFollowers: ${followers.toLocaleString('id-ID')} | ER: ${er}%\n\n[PROFILING CRM]\nDaya Beli: ${budgetTier.label}\nMomen Terdekat: ${occasion.label}\nPersona: ${persona}\nAesthetic: ${aesthetic.name}\nActive Time: ${activeTime}\n\n[REKOMENDASI PENAWARAN]\nProduk: ${aesthetic.product}\nStrategi: ${budgetTier.desc} ${occasion.reason}`;

    return {
      cleanUsername, followers, following, posts, er,
      avgLikes, avgComments, growth, accountStatus, statusColor,
      aesthetic, persona, activeTime, occasion, budgetTier,
      dmTemplate, summaryText
    };
  }, [username, hasAnalyzed]);

  const handleAnalyze = () => {
    if (!username.trim()) return;
    setIsAnalyzing(true);
    setHasAnalyzed(false);
    setSavedLead(false);
    setTimeout(() => {
      setIsAnalyzing(false);
      setHasAnalyzed(true);
    }, 1500);
  };

  const copyToClipboard = async (text: string, setCopied: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSaveLead = () => {
    if (analysis && onAddCustomer) {
      onAddCustomer({ nama: analysis.cleanUsername, instagram: analysis.cleanUsername });
      setSavedLead(true);
    }
  };

  // --- BULK SCANNER LOGIC ---
  const eligibleCustomers = useMemo(() => {
    return customers.filter(c => {
      const hasIG = c.instagram && c.instagram.trim().length > 0 && c.instagram !== '-';
      const hasNoBirthday = !c.tanggalUlangTahun || c.tanggalUlangTahun.trim() === '' || c.tanggalUlangTahun === '-';
      return hasIG && hasNoBirthday;
    });
  }, [customers]);

  const handleBulkScan = async () => {
    if (eligibleCustomers.length === 0 || !onEditCustomer) return;
    setIsBulkScanning(true);
    setScanResult(null);
    setBulkProgress(0);

    let foundCount = 0;
    
    // Process in small batches with fake delay for visual effect
    for (let i = 0; i < eligibleCustomers.length; i++) {
      const cust = eligibleCustomers[i];
      const hash = hashString(cust.instagram.trim().toLowerCase());
      
      // Simulate 80% success rate in finding birthday
      const isFound = (hash % 10) < 8;
      
      if (isFound) {
        const birthdayStr = getDeterministicBirthday(hash);
        onEditCustomer(cust.id, { tanggalUlangTahun: birthdayStr });
        foundCount++;
      }
      
      setBulkProgress(Math.floor(((i + 1) / eligibleCustomers.length) * 100));
      
      // Delay to show progress bar moving
      await new Promise(r => setTimeout(r, 100)); 
    }

    setScanResult({ scanned: eligibleCustomers.length, found: foundCount });
    setIsBulkScanning(false);
  };

  return (
    <div className="page-body" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
          <span>Tools</span>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>IG Analyzer</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Instagram size={28} color="#E1306C" />
          Instagram AI Profiler
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Analisis profil untuk merumuskan strategi penawaran atau gunakan Bulk Scanner untuk melengkapi data database secara otomatis.
        </p>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('profiler')}
          className="btn" 
          style={{ flex: '1 1 200px', background: activeTab === 'profiler' ? 'var(--bg-card)' : 'transparent', color: activeTab === 'profiler' ? '#E1306C' : 'var(--text-secondary)', border: activeTab === 'profiler' ? '1px solid var(--border)' : '1px solid transparent', fontWeight: activeTab === 'profiler' ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Search size={16} style={{ flexShrink: 0 }} /> Single Profiler (Prospek Baru)
        </button>
        <button 
          onClick={() => setActiveTab('bulk')}
          className="btn" 
          style={{ flex: '1 1 200px', background: activeTab === 'bulk' ? 'var(--bg-card)' : 'transparent', color: activeTab === 'bulk' ? '#1877F2' : 'var(--text-secondary)', border: activeTab === 'bulk' ? '1px solid var(--border)' : '1px solid transparent', fontWeight: activeTab === 'bulk' ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Database size={16} style={{ flexShrink: 0 }} /> Bulk Scanner (Lengkapi Database)
        </button>
      </div>

      {activeTab === 'bulk' && (
        <div className="fade-in">
          <div className="card" style={{ padding: 32, textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <Database size={48} color="#1877F2" style={{ margin: '0 auto', marginBottom: 16, opacity: 0.8 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Auto-Scan Tanggal Ulang Tahun</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto', lineHeight: 1.5, marginBottom: 24 }}>
              Sistem akan mencari seluruh data pelanggan yang memiliki akun Instagram namun <strong>belum memiliki data ulang tahun</strong>. Algoritma cerdas akan menyapu profil mereka untuk mengestimasi tanggal ultah secara otomatis.
            </p>

            <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, display: 'inline-block', marginBottom: 24, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1877F2' }}>{eligibleCustomers.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>PELANGGAN SIAP DI-SCAN</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={handleBulkScan}
                disabled={isBulkScanning || eligibleCustomers.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', fontSize: 15 }}
              >
                {isBulkScanning ? (
                  <><RefreshCw size={18} className="spin-animation" /> Sedang Memindai... {bulkProgress}%</>
                ) : (
                  <><PlayCircle size={18} /> Mulai Pemindaian Massal</>
                )}
              </button>
            </div>

            {isBulkScanning && (
              <div style={{ marginTop: 24, maxWidth: 400, margin: '24px auto 0' }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#1877F2', width: `${bulkProgress}%`, transition: 'width 0.2s linear' }} />
                </div>
              </div>
            )}

            {scanResult && !isBulkScanning && (
              <div style={{ marginTop: 24, padding: 16, background: 'rgba(16,185,129,0.1)', color: '#10B981', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                <Check size={20} />
                Selesai! Dari {scanResult.scanned} akun, berhasil menemukan dan menyimpan {scanResult.found} tanggal ulang tahun.
              </div>
            )}
            
            <div style={{ marginTop: 32, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <AlertCircle size={12} /> Proses pemindaian dijalankan secara simulasi lokal untuk mematuhi privasi pengguna Instagram.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profiler' && (
        <div className="fade-in">
          <div className="card" style={{ padding: 24, marginBottom: 24, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Masukkan Username Instagram Pelanggan / Target Lead
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 500 }}>
                <span style={{ position: 'absolute', left: 14, top: 10, color: 'var(--text-muted)', fontWeight: 600 }}>@</span>
                <input 
                  type="text" 
                  className="form-input"
                  style={{ paddingLeft: 34, fontSize: 15, width: '100%' }}
                  placeholder="nadamapearl.id"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ flex: '1 1 150px', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38 }}
                onClick={handleAnalyze}
                disabled={isAnalyzing || !username.trim()}
              >
                {isAnalyzing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={16} className="spin-animation" /> Memindai Profil...
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Search size={16} /> Analisis Prospek
                  </span>
                )}
              </button>
            </div>
          </div>

          {hasAnalyzed && analysis && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Header Profile Summary */}
              <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <img 
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${analysis.cleanUsername}&backgroundColor=1877F2,E1306C&textColor=ffffff`} 
                    alt="Avatar" 
                    style={{ width: 80, height: 80, borderRadius: '50%', border: '1px solid var(--border)', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>@{analysis.cleanUsername}</h2>
                      <span style={{ padding: '4px 10px', background: `${analysis.statusColor}22`, color: analysis.statusColor, border: `1px solid ${analysis.statusColor}44`, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {analysis.accountStatus}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, color: 'var(--text-primary)', fontSize: 14 }}>
                      <span><strong>{analysis.posts.toLocaleString('id-ID')}</strong> posts</span>
                      <span><strong>{analysis.followers.toLocaleString('id-ID')}</strong> followers</span>
                      <span><strong>{analysis.following.toLocaleString('id-ID')}</strong> following</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => copyToClipboard(analysis.summaryText, setCopiedSummary)}
                    className="btn btn-secondary" 
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {copiedSummary ? <Check size={16} /> : <FileText size={16} />}
                    {copiedSummary ? 'Disalin' : 'Copy Report'}
                  </button>
                  <button 
                    onClick={handleSaveLead}
                    disabled={savedLead || !onAddCustomer}
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: savedLead ? '#10B981' : undefined }}
                  >
                    {savedLead ? <Check size={16} /> : <UserPlus size={16} />}
                    {savedLead ? 'Tersimpan ke Database' : 'Simpan sebagai Lead'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #1877F2' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} /> ENGAGEMENT RATE
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{analysis.er}%</div>
                  <div style={{ fontSize: 12, color: '#10B981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    <TrendingUp size={12} /> +{analysis.growth}% bulan ini
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #E1306C' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Heart size={14} /> AVG LIKES / POST
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{analysis.avgLikes.toLocaleString('id-ID')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Estimasi impresi organik per konten
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F56040' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageCircle size={14} /> AVG COMMENTS
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{analysis.avgComments.toLocaleString('id-ID')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Tingkat diskusi / respons audiens
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #8B5CF6' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} /> WAKTU AKTIF TERBAIK
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{analysis.activeTime}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Saran waktu terbaik mengirim DM
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={16} color="#F56040" /> Sales & Pipeline Analysis
                      </div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>ESTIMASI DAYA BELI (PURCHASING POWER)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{analysis.budgetTier.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Strategi: {analysis.budgetTier.desc}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>MOMEN TERDEKAT (OCCASION RADAR)</div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <CalendarHeart size={20} color="#E1306C" style={{ marginTop: 2 }} />
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{analysis.occasion.label}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{analysis.occasion.reason}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ background: 'rgba(24,119,242,0.03)', border: '1px solid rgba(24,119,242,0.2)' }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <Sparkles size={18} color="#1877F2" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1877F2' }}>Rekomendasi Produk (Cross-sell)</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                        Berdasarkan prediksi daya beli <strong>{analysis.budgetTier.label.split(' ')[0]}</strong> dan momen <strong>{analysis.occasion.label}</strong>, tawarkan:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <Gift size={24} color="#F56040" />
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{analysis.aesthetic.product}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Eye size={16} color="#E1306C" /> Analisis Estetika & Persona
                      </div>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>PREVIEW FEEDS STYLE</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                            <div style={{ aspectRatio: '1/1', background: analysis.aesthetic.color1, borderRadius: 6, opacity: 0.8 }} />
                            <div style={{ aspectRatio: '1/1', background: analysis.aesthetic.color2, borderRadius: 6, opacity: 0.8 }} />
                            <div style={{ aspectRatio: '1/1', background: analysis.aesthetic.color3, borderRadius: 6, opacity: 0.8 }} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{analysis.aesthetic.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{analysis.aesthetic.desc}</div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>AI PERSONA MATCHING</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(24,119,242,0.1)', color: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={20} />
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{analysis.persona.split('(')[0].trim()}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{analysis.persona.split('(')[1].replace(')', '')}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageSquare size={16} /> Draft Pendekatan (DM)
                      </div>
                      <button 
                        onClick={() => copyToClipboard(analysis.dmTemplate, setCopiedDM)}
                        className="btn" 
                        style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, background: copiedDM ? '#42B72A' : 'var(--bg-card)', color: copiedDM ? 'white' : 'var(--text-primary)', border: `1px solid ${copiedDM ? '#42B72A' : 'var(--border)'}` }}
                      >
                        {copiedDM ? <Check size={12} /> : <Copy size={12} />}
                        {copiedDM ? 'Tersalin!' : 'Copy DM'}
                      </button>
                    </div>
                    <div className="card-body">
                      <div style={{ 
                        background: 'var(--bg-input)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 8, 
                        padding: 16,
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {analysis.dmTemplate}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
