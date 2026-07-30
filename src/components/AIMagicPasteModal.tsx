import { useState } from 'react';
import { X, Wand2, ArrowRight, Loader2, Check } from 'lucide-react';
import { parseMagicPaste } from '../utils/aiEngines';
import type { ParsedCustomerData } from '../utils/aiEngines';
import type { Customer, CustomerRow } from '../types';

interface Props {
  onClose: () => void;
  onAdd: (customerPatch: Partial<Customer> & { nama: string }, orderPatch: Partial<CustomerRow>) => void;
}

export default function AIMagicPasteModal({ onClose, onAdd }: Props) {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsed, setParsed] = useState<ParsedCustomerData | null>(null);

  const handleProcess = () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    
    // Simulate AI processing delay
    setTimeout(() => {
      const data = parseMagicPaste(text);
      setParsed(data);
      setIsProcessing(false);
    }, 1500);
  };

  const handleSave = () => {
    if (!parsed) return;
    
    const customerPatch: Partial<Customer> & { nama: string } = {
      nama: parsed.nama || 'Pelanggan Baru',
      wa: parsed.wa || '',
      alamat: parsed.alamat || '',
      instagram: parsed.instagram || ''
    };

    const orderPatch: Partial<CustomerRow> = {
      jenis: parsed.orderItem || '',
      size: parsed.ringSize || '',
      keterangan: parsed.keterangan || '',
      orderStatus: 'pending',
      tanggalOrder: new Date().toISOString().split('T')[0]
    };

    onAdd(customerPatch, orderPatch);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 500 }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
            <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', padding: 6, borderRadius: 8, display: 'flex' }}>
              <Wand2 size={18} />
            </div>
            AI Magic Paste
          </h2>
          <button onClick={onClose} className="btn-close"><X size={20} /></button>
        </div>

        <div className="modal-body">
          {!parsed ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Paste obrolan WhatsApp berantakan dari pelanggan ke kotak di bawah ini. AI akan mengekstrak Nama, Alamat, HP, dan Pesanan secara otomatis.
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Contoh:&#10;Sis pesen kalung mutiara yang hitam ya.&#10;Kirim ke Budi, Jl. Sudirman no 5 Jkt.&#10;No hp ku 0812345678"
                style={{ width: '100%', minHeight: 180, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', resize: 'vertical', fontSize: 13 }}
              />
              <button 
                onClick={handleProcess}
                disabled={!text.trim() || isProcessing}
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: 16, height: 44, justifyContent: 'center' }}
              >
                {isProcessing ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
                {isProcessing ? 'Memproses dengan AI...' : 'Ekstrak Data'}
              </button>
            </>
          ) : (
            <div className="fade-in">
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <Check size={20} color="#10b981" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>Ekstraksi Berhasil</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>AI berhasil mengidentifikasi entitas berikut:</div>
                </div>
              </div>

              <div className="magic-paste-grid">
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>NAMA PELANGGAN</label>
                  <input value={parsed.nama} onChange={e => setParsed({...parsed, nama: e.target.value})} className="form-control" style={{ fontSize: 13, padding: 8 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>WHATSAPP</label>
                  <input value={parsed.wa} onChange={e => setParsed({...parsed, wa: e.target.value})} className="form-control" style={{ fontSize: 13, padding: 8 }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>ALAMAT LENGKAP</label>
                  <textarea value={parsed.alamat} onChange={e => setParsed({...parsed, alamat: e.target.value})} className="form-control" style={{ fontSize: 13, padding: 8, minHeight: 60, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>ITEM / PESANAN</label>
                  <input value={parsed.orderItem} onChange={e => setParsed({...parsed, orderItem: e.target.value})} className="form-control" style={{ fontSize: 13, padding: 8 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>UKURAN/SIZE</label>
                  <input value={parsed.ringSize} onChange={e => setParsed({...parsed, ringSize: e.target.value})} className="form-control" style={{ fontSize: 13, padding: 8 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setParsed(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Coba Ulang
                </button>
                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none' }}>
                  Simpan Order <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .magic-paste-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (max-width: 600px) {
          .magic-paste-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
