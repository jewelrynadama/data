import React, { useState } from 'react';
import { Sparkles, Activity, Zap, ShoppingBag, ExternalLink, MessageCircle, Copy, Check } from 'lucide-react';
import { generateMarketAnalysis, parseSimpleMarkdown, fetchRealImages, generateWACampaign } from '../utils/aiEngine';
import type { Customer, CustomerRow } from '../types';

const SCAN_STEPS = [
  "Inisiasi sistem AI Market Radar...",
  "Mengumpulkan data tren perhiasan dari sosial media global...",
  "Menganalisis sentimen pembeli di e-commerce lokal...",
  "Membandingkan harga mutiara air laut vs air tawar...",
  "Mengekstrak model desain terpopuler bulan ini...",
  "Menyusun visual laporan tren...",
  "Selesai! Menampilkan hasil laporan..."
];

interface Props {
  customers?: Customer[];
  rows?: CustomerRow[];
}

export default function AITrendsPage({ customers = [], rows = [] }: Props) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [scanStep, setScanStep] = useState(0);
  const [aiResult, setAiResult] = useState('');
  const [realImages, setRealImages] = useState<{src: string, title: string}[]>([]);
  const [autoKeyword, setAutoKeyword] = useState('');
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState('');
  const [isGeneratingWA, setIsGeneratingWA] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAnalysis = async (useStoreData = false) => {
    setStatus('scanning');
    setScanStep(0);
    setAiResult('');
    setRealImages([]);
    setAutoKeyword('');

    const interval = setInterval(() => {
      setScanStep(s => {
        if (s >= SCAN_STEPS.length - 1) {
          clearInterval(interval);
          return s;
        }
        return s + 1;
      });
    }, 1200);

    try {
      // Parallel execution for speed
      const { analysis, keyword } = await generateMarketAnalysis(useStoreData ? { customers, rows } : undefined);
      setAutoKeyword(keyword);
      const images = await fetchRealImages(keyword);
      
      setAiResult(parseSimpleMarkdown(analysis));
      setRealImages(images);
    } catch (error) {
      setAiResult('Gagal menghubungi AI Server.');
    } finally {
      clearInterval(interval);
      setScanStep(SCAN_STEPS.length - 1); // Finished
      setTimeout(() => setStatus('results'), 500);
    }
  };

  const handleGenerateWA = async () => {
    setIsGeneratingWA(true);
    setWaModalOpen(true);
    try {
      const plainTextAnalysis = aiResult.replace(/<[^>]*>?/gm, '').substring(0, 500);
      const msg = await generateWACampaign(`Keyword Tren: ${autoKeyword}\nAnalisis: ${plainTextAnalysis}`);
      setWaMessage(msg);
    } catch (e) {
      setWaMessage("Gagal generate WA.");
    }
    setIsGeneratingWA(false);
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(waMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-body">
      <style>{`
        .ai-header-bg {
          position: relative;
          background: linear-gradient(135deg, #111827 0%, #1e1b4b 100%);
          border-radius: 16px;
          padding: 40px;
          overflow: hidden;
          margin-bottom: 24px;
          color: white;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .ai-bg-glow {
          position: absolute;
          top: -50px;
          right: -50px;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }
        .ai-btn {
          background: var(--gradient-brand);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 24px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .ai-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(124,58,237,0.4);
        }
        .ai-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        
        .scan-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          box-shadow: var(--shadow-sm);
        }
        .radar-spinner {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 3px solid rgba(124,58,237,0.1);
          border-top-color: #7c3aed;
          animation: spin 1s linear infinite;
          margin: 0 auto 24px;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
        .typing-text {
          font-size: 15px;
          color: var(--text-primary);
          font-weight: 500;
          height: 24px;
        }
        
        .result-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        .trend-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: var(--shadow-sm);
        }
        .trend-image-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 20px;
        }
        .trend-img {
          width: 100%;
          height: 140px;
          object-fit: cover;
          border-radius: 12px;
          transition: transform 0.3s;
        }
        .trend-img:hover {
          transform: scale(1.05);
        }
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .stat-row:last-child {
          border-bottom: none;
        }
        .competitor-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 12px;
          margin-bottom: 10px;
        }
        
        @media (max-width: 768px) {
          .result-grid { grid-template-columns: 1fr; }
          .trend-image-grid { grid-template-columns: 1fr 1fr; }
          .ai-header-bg { padding: 24px; }
        }
      `}</style>

      {/* Header */}
      <div className="ai-header-bg">
        <div className="ai-bg-glow" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 16, backdropFilter: 'blur(5px)' }}>
            <Sparkles size={14} color="#fcd34d" /> AI POWERED
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 12px 0', lineHeight: 1.2 }}>Market Trend Radar</h1>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', maxWidth: 600, margin: 0, lineHeight: 1.5 }}>
                Data ditarik secara real-time dari engine AI, mensimulasikan pencarian produk paling laku di platform e-commerce Indonesia saat ini.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button 
                onClick={() => runAnalysis(false)}
                disabled={status === 'scanning'}
                className="ai-btn"
                style={{ opacity: status === 'scanning' ? 0.7 : 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                {status === 'scanning' ? <Activity size={16} /> : <Zap size={16} />}
                {status === 'scanning' ? 'Memindai...' : 'Refresh Data Market'}
              </button>
              
              <button 
                onClick={() => runAnalysis(true)}
                disabled={status === 'scanning'}
                className="ai-btn"
                style={{ opacity: status === 'scanning' ? 0.7 : 1 }}
              >
                {status === 'scanning' ? <Activity size={16} /> : <Zap size={16} />}
                Analisis dengan Data Toko
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scanning State */}
      {status === 'scanning' && (
        <div className="scan-container">
          <div className="radar-spinner" />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            AI Sedang Menganalisis...
          </div>
          <div className="typing-text">
            {SCAN_STEPS[scanStep] || "Memproses..."}
          </div>
          <div style={{ width: '100%', maxWidth: 300, height: 4, background: 'var(--bg-secondary)', borderRadius: 4, margin: '24px auto 0', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--gradient-brand)', width: `${((scanStep + 1) / SCAN_STEPS.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Results State */}
      {status === 'results' && (
        <div className="result-grid">
          {/* Main Analysis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="trend-card">
              <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Zap size={20} color="#10b981" /> Hasil Analisis Pasar Real-time
              </h2>
              <div 
                style={{ 
                  fontSize: 14, 
                  color: 'var(--text-primary)', 
                  lineHeight: 1.6, 
                  marginBottom: 20 
                }}
                dangerouslySetInnerHTML={{ __html: aiResult }}
              />

              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 24 }}>Visual Inspirasi (Hasil Pencarian Web)</h3>
              
              {realImages.length > 0 ? (
                <div className="trend-image-grid">
                  {realImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, background: '#f3f4f6', height: 140 }}>
                      <img src={img.src} alt={img.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: 10, maxWidth: '90%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {img.title || `#Inspirasi_${idx+1}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                  Mencari gambar referensi asli dari web...
                </div>
              )}

              {/* Marketplace Links */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tindak Lanjut & Cari di Marketplace:</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleGenerateWA}
                    className="btn btn-primary"
                    style={{ background: '#25D366', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <MessageCircle size={14} /> Buat Kampanye dari Tren Ini
                  </button>
                  <a 
                    href={`https://shopee.co.id/search?keyword=${encodeURIComponent(autoKeyword)}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-secondary" 
                    style={{ background: '#ee4d2d', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <ShoppingBag size={14} /> Shopee <ExternalLink size={14} />
                  </a>
                  <a 
                    href={`https://www.tokopedia.com/search?q=${encodeURIComponent(autoKeyword)}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn btn-secondary" 
                    style={{ background: '#00aa5b', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <ShoppingBag size={14} /> Tokopedia <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WA Modal */}
      {waModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 16, width: '90%', maxWidth: 500, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageCircle size={20} color="#25D366" />
                Draft Kampanye WA
              </h3>
              <button onClick={() => setWaModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>&times;</button>
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16, minHeight: 150, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {isGeneratingWA ? 'Menghasilkan draf menggunakan AI...' : waMessage}
            </div>

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setWaModalOpen(false)} className="btn btn-secondary">Tutup</button>
              <button onClick={handleCopy} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? '#10b981' : 'var(--accent-purple)' }} disabled={isGeneratingWA}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Tersalin!' : 'Salin Pesan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
