// src/components/CustomerFormModal.tsx
import { useState, useEffect } from 'react';
import { X, Save, User } from 'lucide-react';
import type { Customer } from '../types';

interface Props {
  initial?: Customer | null;
  onSave: (data: Partial<Customer> & { nama: string }) => void;
  onClose: () => void;
}

const EMPTY: Partial<Customer> & { nama: string } = {
  nama: '',
  instagram: '',
  wa: '',
  alamat: '',
  tanggalUlangTahun: '',
  city: '',
};

export default function CustomerFormModal({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      setForm({
        nama: initial.nama,
        instagram: initial.instagram,
        wa: initial.wa,
        alamat: initial.alamat,
        tanggalUlangTahun: initial.tanggalUlangTahun,
        city: initial.city,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [initial]);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.nama.trim()) errs.nama = 'Nama wajib diisi';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({ ...form, nama: form.nama.trim() });
  }

  const isEdit = !!initial;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        width: 480,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
        animation: 'modalIn 0.22s cubic-bezier(0.4,0,0.2,1)',
        margin: 'auto',
        alignSelf: 'center',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1, borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={15} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {isEdit ? 'Edit Customer' : 'Tambah Customer Baru'}
            </span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Nama *" error={errors.nama}>
            <input className="form-input" value={form.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Nama lengkap / Instagram" />
          </Field>
          <Field label="Instagram">
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{
                padding: '0 10px', height: 38, display: 'flex', alignItems: 'center',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRight: 'none', borderRadius: '8px 0 0 8px',
                fontSize: 12, color: 'var(--text-muted)',
              }}>@</span>
              <input
                className="form-input"
                style={{ borderRadius: '0 8px 8px 0', flex: 1 }}
                value={form.instagram?.replace(/^@/, '').replace('https://www.instagram.com/', '')}
                onChange={(e) => set('instagram', e.target.value)}
                placeholder="username"
              />
            </div>
          </Field>
          <Field label="WhatsApp">
            <input className="form-input" value={form.wa} onChange={(e) => set('wa', e.target.value)} placeholder="08xxxxxxxxxx" />
          </Field>
          <Field label="Kota">
            <input className="form-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Jakarta, Surabaya, dst." />
          </Field>
          <Field label="Alamat Lengkap">
            <textarea
              className="form-input"
              style={{ resize: 'vertical', minHeight: 72, fontFamily: 'Inter, sans-serif' }}
              value={form.alamat}
              onChange={(e) => set('alamat', e.target.value)}
              placeholder="Alamat pengiriman"
            />
          </Field>
          <Field label="Tanggal Ulang Tahun">
            <input className="form-input" value={form.tanggalUlangTahun} onChange={(e) => set('tanggalUlangTahun', e.target.value)} placeholder="DD/MM/YYYY" />
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary">
              <Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Tambah Customer'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        .form-input {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-family: Inter, sans-serif;
          font-size: 13px;
          padding: 8px 12px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          height: 38px;
          box-sizing: border-box;
        }
        textarea.form-input { height: auto; }
        .form-input:focus {
          border-color: rgba(124,58,237,0.6);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        .form-input::placeholder { color: var(--text-muted); }
        .form-input option { background: #1a1a27; }
      `}</style>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{error}</span>}
    </div>
  );
}
