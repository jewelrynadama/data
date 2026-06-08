// src/components/OrderFormModal.tsx
import { useState, useEffect, useMemo } from 'react';
import { X, Save, ShoppingBag } from 'lucide-react';
import type { CustomerRow, Customer } from '../types';
import { formatInputNumber } from '../utils/csvLoader';


interface Props {
  customerName?: string;
  customers?: Customer[];
  initial?: CustomerRow | null;
  onSave: (data: Partial<CustomerRow>) => void;
  onClose: () => void;
}

const JENIS_OPTIONS = ['Necklace', 'Pendant', 'Earrings', 'Bracelet', 'Ring', 'Brooch', 'Jewelry Set', 'Loose'];
const PEARL_OPTIONS = ['Akoya Seawater', 'Akoya Freshwater', 'Southsea', 'Tahitian Seawater', 'Edison', 'Freshwater', 'Mix Pearls'];
const PAYMENT_OPTIONS = ['Transfer', 'Shopee', 'Tokopedia', 'Cash', 'COD', 'Tukar', 'Retur'];
const SHAPE_OPTIONS = ['Round', 'Near Round', 'Oval', 'Drop', 'Button', 'Baroque', 'Semi Baroque', 'Circle'];
const GRADE_OPTIONS = ['AAA', 'AA+', 'AA', 'A+', 'A', 'B', 'C'];

const EMPTY: Partial<CustomerRow> = {
  tanggalOrder: '', jenis: '', type: '', size: '', color: '', grade: '',
  shape: '', stone: '', stoneWeight: '', qty: '1',
  totalBayar: '', ongkir: '', paymentVia: '', kurir: '', keterangan: '', resi: '', orderStatus: 'pending',
};

export default function OrderFormModal({ customerName, customers, initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<Partial<CustomerRow>>({ ...EMPTY });
  const [selectedCustName, setSelectedCustName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isNewCustomer = useMemo(() => {
    if (customerName) return false;
    const name = selectedCustName.trim().toLowerCase();
    if (!name) return false;
    return !customers?.some((c) => c.nama.toLowerCase() === name);
  }, [selectedCustName, customerName, customers]);

  useEffect(() => {
    if (initial) {
      setForm({ ...initial });
      if (initial.namaInstagram) setSelectedCustName(initial.namaInstagram);
    } else {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      setForm({ ...EMPTY, tanggalOrder: `${dd}/${mm}/${yyyy}` });
      setSelectedCustName('');
    }
  }, [initial]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!customerName && !selectedCustName.trim()) {
      errs.namaInstagram = 'Nama customer wajib diisi';
    }
    if (!form.jenis) errs.jenis = 'Tipe perhiasan wajib dipilih';
    if (!form.totalBayar) errs.totalBayar = 'Total bayar wajib diisi';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...form, namaInstagram: customerName || selectedCustName.trim() });
  }

  const isEdit = !!initial;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 16, width: 540, maxWidth: '95vw', maxHeight: '92vh',
        overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        animation: 'modalIn 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1, borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={15} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{isEdit ? 'Edit Order' : 'Tambah Order'}</div>
              {customerName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{customerName}</div>}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Customer Selection (only if customerName is not pre-specified) */}
          {!customerName && (
            <Field label="Customer *" error={errors.namaInstagram}>
              <input
                className="form-input"
                list="customers-list"
                value={selectedCustName}
                onChange={(e) => {
                  setSelectedCustName(e.target.value);
                  setErrors((err) => ({ ...err, namaInstagram: '' }));
                }}
                placeholder="Pilih atau ketik nama customer..."
              />
              <datalist id="customers-list">
                {customers?.map((c) => (
                  <option key={c.id} value={c.nama} />
                ))}
              </datalist>
            </Field>
          )}

          {/* New Customer Info (only if it is a newly typed customer name) */}
          {isNewCustomer && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '14px 16px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                👤 Informasi Customer Baru
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Instagram">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <span style={{
                      padding: '0 8px', height: 38, display: 'flex', alignItems: 'center',
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                      borderRight: 'none', borderRadius: '8px 0 0 8px',
                      fontSize: 12, color: 'var(--text-muted)',
                    }}>@</span>
                    <input
                      className="form-input"
                      style={{ borderRadius: '0 8px 8px 0', flex: 1 }}
                      value={form.instagram?.replace(/^@/, '').replace('https://www.instagram.com/', '') ?? ''}
                      onChange={(e) => set('instagram', e.target.value)}
                      placeholder="username"
                    />
                  </div>
                </Field>
                <Field label="WhatsApp">
                  <input
                    className="form-input"
                    value={form.wa ?? ''}
                    onChange={(e) => set('wa', e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Tanggal Lahir">
                  <input
                    className="form-input"
                    value={form.tanggalUlangTahun ?? ''}
                    onChange={(e) => set('tanggalUlangTahun', e.target.value)}
                    placeholder="DD/MM/YYYY"
                  />
                </Field>
                <Field label="Alamat Pengiriman">
                  <input
                    className="form-input"
                    value={form.alamat ?? ''}
                    onChange={(e) => set('alamat', e.target.value)}
                    placeholder="Alamat Lengkap"
                  />
                </Field>
              </div>
            </div>
          )}
          {/* Section: Waktu */}
          <SectionLabel>📅 Informasi Order</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tanggal Order">
              <input className="form-input" value={form.tanggalOrder ?? ''} onChange={(e) => set('tanggalOrder', e.target.value)} placeholder="DD/MM/YYYY" />
            </Field>
            <Field label="Qty">
              <input className="form-input" type="number" min="1" value={form.qty ?? '1'} onChange={(e) => set('qty', e.target.value)} />
            </Field>
          </div>

          {/* Section: Perhiasan */}
          <SectionLabel>💎 Detail Perhiasan</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipe Perhiasan *" error={errors.jenis}>
              <select className="form-input" value={form.jenis ?? ''} onChange={(e) => set('jenis', e.target.value)}>
                <option value="">-- Pilih --</option>
                {JENIS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Tipe Mutiara">
              <select className="form-input" value={form.type ?? ''} onChange={(e) => set('type', e.target.value)}>
                <option value="">-- Pilih --</option>
                {PEARL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Ukuran (mm)">
              <input className="form-input" value={form.size ?? ''} onChange={(e) => set('size', e.target.value)} placeholder="cth: 8-9" />
            </Field>
            <Field label="Warna">
              <input className="form-input" value={form.color ?? ''} onChange={(e) => set('color', e.target.value)} placeholder="cth: White, Pink" />
            </Field>
            <Field label="Grade">
              <select className="form-input" value={form.grade ?? ''} onChange={(e) => set('grade', e.target.value)}>
                <option value="">-- Pilih --</option>
                {GRADE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Shape">
              <select className="form-input" value={form.shape ?? ''} onChange={(e) => set('shape', e.target.value)}>
                <option value="">-- Pilih --</option>
                {SHAPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Batu (Stone)">
              <input className="form-input" value={form.stone ?? ''} onChange={(e) => set('stone', e.target.value)} placeholder="cth: Diamond, Ruby" />
            </Field>
            <Field label="Berat Batu">
              <input className="form-input" value={form.stoneWeight ?? ''} onChange={(e) => set('stoneWeight', e.target.value)} placeholder="cth: 0.5 ct" />
            </Field>
          </div>

          {/* Section: Pembayaran */}
          <SectionLabel>💳 Pembayaran & Pengiriman</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Total Bayar (Rp) *" error={errors.totalBayar}>
              <input className="form-input" value={formatInputNumber(form.totalBayar ?? '')} onChange={(e) => set('totalBayar', formatInputNumber(e.target.value))} placeholder="cth: 1.500.000" />
            </Field>
            <Field label="Ongkos Kirim (Rp)">
              <input className="form-input" value={formatInputNumber(form.ongkir ?? '')} onChange={(e) => set('ongkir', formatInputNumber(e.target.value))} placeholder="cth: 50.000" />
            </Field>
            <Field label="Metode Bayar">
              <select className="form-input" value={form.paymentVia ?? ''} onChange={(e) => set('paymentVia', e.target.value)}>
                <option value="">-- Pilih --</option>
                {PAYMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Kurir">
              <input className="form-input" value={formatInputNumber(form.kurir ?? '')} onChange={(e) => set('kurir', formatInputNumber(e.target.value))} placeholder="JNE, J&T, SiCepat, ..." />
            </Field>
          </div>

          <Field label="Nomor Resi Pengiriman">
            <input className="form-input" value={form.resi ?? ''} onChange={(e) => set('resi', e.target.value)} placeholder="Masukkan nomor resi jika sudah ada..." />
          </Field>

          <Field label="Status Pesanan">
            <select className="form-input" value={form.orderStatus ?? 'pending'} onChange={(e) => set('orderStatus', e.target.value)}>
              <option value="pending">⏳ Pending</option>
              <option value="dikirim">🚚 Dikirim</option>
              <option value="selesai">✅ Selesai</option>
              <option value="retur">↩️ Retur</option>
            </select>
          </Field>

          <Field label="Keterangan">
            <textarea className="form-input" style={{ height: 60, resize: 'vertical', fontFamily: 'Inter,sans-serif' }}
              value={form.keterangan ?? ''} onChange={(e) => set('keterangan', e.target.value)} placeholder="Catatan tambahan..." />
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary">
              <Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Tambah Order'}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        .form-input {
          width:100%; background:#1a1a27; border:1px solid var(--border);
          border-radius:8px; color:var(--text-primary); font-family:Inter,sans-serif;
          font-size:13px; padding:8px 12px; outline:none; height:38px;
          transition:border-color 0.15s, box-shadow 0.15s; box-sizing:border-box;
          color-scheme: dark;
        }
        textarea.form-input { height:auto; }
        select.form-input { -webkit-appearance:none; appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
        }
        .form-input:focus { border-color:rgba(124,58,237,0.6); box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
        .form-input::placeholder { color:var(--text-muted); }
        .form-input option { background:#1a1a27; color:var(--text-primary); }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.8px', paddingBottom: 4, borderBottom: '1px solid var(--border)', marginTop: 2 }}>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{error}</span>}
    </div>
  );
}
