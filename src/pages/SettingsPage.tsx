// src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import {
  Save,
  RefreshCw,
  Store,
  Palette,
  Gift,
  Phone,
  Instagram,
  Sparkles,
  Award,
  KeyRound,
  Type,
  Tag,
  Coins,
  Percent,
  MessageSquare,
  Crown,
  Trophy,
  Printer
} from 'lucide-react';

export interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeInstagram: string;
  voucherCode: string;
  voucherType: 'percent' | 'fixed';
  voucherValue: number;
  vipMinSpend: number;
  loyalMinOrders: number;
  birthdayMessageTemplate: string;
  shippingMessageTemplate: string;
  appName: string;
  loginTitle: string;
  loginSubtitle: string;
  loginLogoEmoji: string;
  invoiceAccentColor: string;
  invoiceFooterNote: string;
  labelFooterNote: string;
  printPaperSize?: string;
  printOrientation?: string;
  printMarginTop?: string;
  printMarginRight?: string;
  printMarginBottom?: string;
  printMarginLeft?: string;
  printCustomWidth?: string;
  printCustomHeight?: string;
  printMarginUnit?: string;
  waApiUrl?: string;
}

import { formatInputNumber } from '../utils/csvLoader';

interface Props {
  settings: StoreSettings;
  onSave: (data: StoreSettings) => void;
}

export default function SettingsPage({ settings, onSave }: Props) {
  const [activeSection, setActiveSection] = useState<'profile' | 'branding' | 'loyalty' | 'print'>('profile');

  const [storeName, setStoreName]           = useState(settings.storeName);
  const [storePhone, setStorePhone]         = useState(settings.storePhone);
  const [storeInstagram, setStoreInstagram] = useState(settings.storeInstagram);
  const [voucherCode, setVoucherCode]       = useState(settings.voucherCode);
  
  const [voucherType, setVoucherType]       = useState<'percent' | 'fixed'>(
    settings.voucherType || 'percent'
  );
  const [voucherValueStr, setVoucherValueStr] = useState(() => 
    (settings.voucherValue || 10).toLocaleString('id-ID')
  );

  // Format min spend as string with dots for user typing
  const [vipMinSpendStr, setVipMinSpendStr] = useState(() => 
    settings.vipMinSpend.toLocaleString('id-ID')
  );
  
  const [loyalMinOrders, setLoyalMinOrders] = useState(settings.loyalMinOrders);
  const [birthdayMessageTemplate, setBirthdayMessageTemplate] = useState(
    settings.birthdayMessageTemplate || '🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨{vipNote}\n\nSalam hangat,\n💎 {storeName}'
  );
  const [shippingMessageTemplate, setShippingMessageTemplate] = useState(
    settings.shippingMessageTemplate || 'Halo Kak {customerName}! Terima kasih atas ordernya di toko kami. Pesanan perhiasan {productName} Kakak telah dikirim menggunakan kurir {courierName} dengan nomor resi *{resi}*. Semoga suka dengan perhiasannya! 💎✨'
  );
  const [appName, setAppName]               = useState(settings.appName || 'PearlCRM');
  const [loginTitle, setLoginTitle]         = useState(settings.loginTitle || 'PearlCRM Access');
  const [loginSubtitle, setLoginSubtitle]   = useState(settings.loginSubtitle || 'Silakan login untuk mengakses dashboard mutiara');
  const [loginLogoEmoji, setLoginLogoEmoji] = useState(settings.loginLogoEmoji || '🛡️');

  const [invoiceAccentColor, setInvoiceAccentColor] = useState(settings.invoiceAccentColor || '#0f172a');
  const [invoiceFooterNote, setInvoiceFooterNote] = useState(settings.invoiceFooterNote || 'Terima kasih atas kunjungan & kepercayaan Anda berbelanja di toko kami!');
  const [labelFooterNote, setLabelFooterNote] = useState(settings.labelFooterNote || '');

  const [printPaperSize, setPrintPaperSize] = useState(settings.printPaperSize || 'A4');
  const [printOrientation, setPrintOrientation] = useState(settings.printOrientation || 'portrait');
  const [printMarginUnit, setPrintMarginUnit] = useState(settings.printMarginUnit || 'mm');
  const [printMarginTop, setPrintMarginTop] = useState(settings.printMarginTop || '15');
  const [printMarginRight, setPrintMarginRight] = useState(settings.printMarginRight || '15');
  const [printMarginBottom, setPrintMarginBottom] = useState(settings.printMarginBottom || '15');
  const [printMarginLeft, setPrintMarginLeft] = useState(settings.printMarginLeft || '15');
  const [printCustomWidth, setPrintCustomWidth] = useState(settings.printCustomWidth || '210');
  const [printCustomHeight, setPrintCustomHeight] = useState(settings.printCustomHeight || '297');
  const [waApiUrl, setWaApiUrl] = useState(settings.waApiUrl || 'http://localhost:3001');

  const handleVipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\./g, '');
    if (/^\d*$/.test(rawVal)) {
      setVipMinSpendStr(formatInputNumber(e.target.value));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      alert('Nama Toko tidak boleh kosong!');
      return;
    }
    const cleanVipSpend = parseInt(vipMinSpendStr.replace(/\D/g, '') || '0', 10);
    const cleanVoucherValue = parseInt(voucherValueStr.replace(/\D/g, '') || '0', 10);

    onSave({
      storeName: storeName.trim(),
      storePhone: storePhone.trim(),
      storeInstagram: storeInstagram.trim(),
      voucherCode: voucherCode.trim() || 'BDAY10',
      voucherType,
      voucherValue: cleanVoucherValue,
      vipMinSpend: cleanVipSpend,
      loyalMinOrders: Number(loyalMinOrders) || 3,
      birthdayMessageTemplate: birthdayMessageTemplate.trim(),
      shippingMessageTemplate: shippingMessageTemplate.trim(),
      appName: appName.trim() || 'PearlCRM',
      loginTitle: loginTitle.trim() || 'PearlCRM Access',
      loginSubtitle: loginSubtitle.trim() || 'Silakan login untuk mengakses dashboard mutiara',
      loginLogoEmoji: loginLogoEmoji.trim() || '🛡️',
      invoiceAccentColor: invoiceAccentColor.trim() || '#0f172a',
      invoiceFooterNote: invoiceFooterNote.trim() || 'Terima kasih atas kunjungan & kepercayaan Anda berbelanja di toko kami!',
      labelFooterNote: labelFooterNote.trim(),
      printPaperSize,
      printOrientation,
      printMarginUnit,
        waApiUrl,
      printMarginTop,
      printMarginRight,
      printMarginBottom,
      printMarginLeft,
      printCustomWidth,
      printCustomHeight,
    });
  };

  const handleReset = () => {
    if (window.confirm('Reset pengaturan ke default?')) {
      setStoreName('Pearl Store');
      setStorePhone('081234567890');
      setStoreInstagram('pearlstore');
      setVoucherCode('BDAY10');
      setVoucherType('percent');
      setVoucherValueStr('10');
      setVipMinSpendStr((15000000).toLocaleString('id-ID'));
      setLoyalMinOrders(3);
      setBirthdayMessageTemplate('🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨{vipNote}\n\nSalam hangat,\n💎 {storeName}');
      setShippingMessageTemplate('Halo Kak {customerName}! Terima kasih atas ordernya di toko kami. Pesanan perhiasan {productName} Kakak telah dikirim menggunakan kurir {courierName} dengan nomor resi *{resi}*. Semoga suka dengan perhiasannya! 💎✨');
      setAppName('PearlCRM');
      setLoginTitle('PearlCRM Access');
      setLoginSubtitle('Silakan login untuk mengakses dashboard mutiara');
      setLoginLogoEmoji('🛡️');
      setInvoiceAccentColor('#0f172a');
      setInvoiceFooterNote('Terima kasih atas kunjungan & kepercayaan Anda berbelanja di toko kami!');
      setLabelFooterNote('');
      setPrintPaperSize('A4');
      setPrintOrientation('portrait');
      setPrintMarginUnit('mm');
      setPrintMarginTop('15');
      setPrintMarginRight('15');
      setPrintMarginBottom('15');
      setPrintMarginLeft('15');
      setPrintCustomWidth('210');
      setPrintCustomHeight('297');
      setWaApiUrl('http://localhost:3001');
    }
  };

  return (
    <div className="page-body">
      <style>{`
        .settings-layout {
          display: flex;
          gap: 28px;
          max-width: 1000px;
          margin: 0 auto;
          min-width: 0;
          width: 100%;
        }
        .settings-sidebar {
          width: 240px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex-shrink: 0;
          min-width: 0;
        }
        .settings-tab-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--border-radius-sm);
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid transparent;
          cursor: pointer;
          text-align: left;
          font-weight: 600;
          font-size: 13.5px;
          transition: var(--transition);
          font-family: 'Inter', sans-serif;
          white-space: nowrap;
        }
        .settings-tab-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        .settings-tab-btn.active {
          background: var(--gradient-brand);
          color: #ffffff;
          box-shadow: var(--shadow-glow);
        }
        .settings-content {
          flex: 1;
          min-width: 0;
        }
        .settings-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--border-radius);
          padding: 28px;
          box-shadow: var(--shadow-md);
        }
        .input-prefix-wrapper {
          position: relative;
        }
        .input-prefix-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          pointer-events: none;
          transition: var(--transition);
        }
        .form-input-premium {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--border-radius-sm);
          color: var(--text-primary);
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          padding: 10px 12px 10px 38px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
          height: 42px;
          box-sizing: border-box;
        }
        .form-input-premium:focus {
          border-color: rgba(124,58,237,0.6);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
          background: rgba(124,58,237,0.02);
        }
        .form-input-premium:focus ~ .input-prefix-icon {
          color: #a78bfa;
        }
        .whatsapp-preview-container {
          background-image: radial-gradient(circle at center, #121b22 0%, #0b141a 100%);
          padding: 20px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border);
          font-family: 'Segoe UI', -apple-system, sans-serif;
          position: relative;
          min-height: 100px;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.4);
        }
        [data-theme='light'] .whatsapp-preview-container {
          background-image: radial-gradient(circle at center, #efeae2 0%, #e5ddd5 100%);
        }
        .whatsapp-bubble {
          background: #202c33;
          color: #e9edef;
          padding: 10px 14px;
          border-radius: 8px 8px 8px 0;
          max-width: 90%;
          font-size: 13px;
          line-height: 1.5;
          white-space: pre-wrap;
          box-shadow: 0 1.5px 1px rgba(0,0,0,0.18);
          margin-left: 4px;
          position: relative;
        }
        [data-theme='light'] .whatsapp-bubble {
          background: #d9fdd3;
          color: #111b21;
        }
        .whatsapp-time {
          font-size: 10px;
          color: #8696a0;
          text-align: right;
          margin-top: 5px;
        }
        [data-theme='light'] .whatsapp-time {
          color: #667781;
        }
        .mock-preview-container {
          margin-top: 24px;
          padding: 18px;
          border-radius: var(--border-radius);
          background: var(--bg-tertiary);
          border: 1px dashed var(--border);
        }
        .settings-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid var(--border);
          padding-top: 24px;
          margin-top: 24px;
        }
        .settings-actions button {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          border-radius: 8px;
          justify-content: center;
        }
        .settings-actions-reset {
          padding: 0 18px;
          flex: 1 1 auto;
        }
        .settings-actions-save {
          padding: 0 24px;
          flex: 2 1 auto;
        }
        @media (max-width: 768px) {
          .settings-layout {
            flex-direction: column;
            gap: 16px;
            padding-bottom: 48px;
          }
          .settings-sidebar {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding-bottom: 8px;
          }
          .settings-tab-btn {
            padding: 10px;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            white-space: normal;
            font-size: 11px;
            gap: 6px;
          }
          .settings-tab-btn span {
            display: block;
          }
          .settings-grid-2 {
            grid-template-columns: 1fr !important;
          }
          .settings-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .settings-preview-2 {
            grid-template-columns: 1fr !important;
          }
          .settings-card {
            padding: 18px !important;
          }
          .settings-actions {
            flex-direction: column-reverse;
            gap: 10px;
          }
          .settings-actions-reset, .settings-actions-save {
            width: 100%;
            flex: 1 1 auto !important;
          }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pengaturan Aplikasi
          </span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Kustomisasi identitas toko, tampilan halaman login, branding sistem dashboard, dan program loyatilas pelanggan Anda.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div className="settings-layout">
          {/* Left Column: Sidebar Menu */}
          <div className="settings-sidebar">
            <button
              type="button"
              className={`settings-tab-btn ${activeSection === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveSection('profile')}
            >
              <Store size={16} />
              <span>Profil Toko</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeSection === 'branding' ? 'active' : ''}`}
              onClick={() => setActiveSection('branding')}
            >
              <Palette size={16} />
              <span>Branding &amp; Login</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeSection === 'loyalty' ? 'active' : ''}`}
              onClick={() => setActiveSection('loyalty')}
            >
              <Gift size={16} />
              <span>Loyalitas &amp; Voucher</span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeSection === 'print' ? 'active' : ''}`}
              onClick={() => setActiveSection('print')}
            >
              <Printer size={16} />
              <span>Pengaturan Cetak</span>
            </button>
          </div>

          {/* Right Column: Settings Card Form */}
          <div className="settings-content">
            <div className="settings-card">
              
              {/* TAB 1: PROFIL TOKO */}
              <div style={{ display: activeSection === 'profile' ? 'block' : 'none' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(124,58,237,0.12)', color: '#7c3aed'
                    }}>
                      <Store size={16} />
                    </div>
                    <span>Informasi &amp; Profil Toko</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginLeft: 42, lineHeight: 1.4 }}>
                    Kelola nama utama toko Anda, kontak WhatsApp resmi, serta username Instagram yang akan terintegrasi langsung pada cetak label pengiriman.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Nama Toko</label>
                    <div className="input-prefix-wrapper">
                      <input
                        type="text"
                        className="form-input-premium"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Contoh: Pearl Store"
                        required
                      />
                      <div className="input-prefix-icon">
                        <Store size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="settings-grid-2" style={{ display: 'grid', gap: 18 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>No. WhatsApp Toko</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={storePhone}
                          onChange={(e) => setStorePhone(e.target.value)}
                          placeholder="Contoh: 081234567890"
                        />
                        <div className="input-prefix-icon">
                          <Phone size={16} />
                        </div>
                      </div>
                      <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                        Gunakan nomor WhatsApp aktif untuk pengirim label paket.
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Instagram Toko</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={storeInstagram}
                          onChange={(e) => setStoreInstagram(e.target.value)}
                          placeholder="Contoh: pearlstore"
                        />
                        <div className="input-prefix-icon">
                          <Instagram size={16} />
                        </div>
                      </div>
                      <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                        Username Instagram tanpa karakter '@' (misal: pearlstore).
                      </span>
                    </div>
                  </div>

                  {/* Mock Shipping Label Preview */}
                                    <div className="form-group" style={{ marginTop: 18 }}>
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>URL Server WhatsApp (API)</label>
                    <div className="input-prefix-wrapper">
                      <input
                        type="text"
                        className="form-input-premium"
                        value={waApiUrl}
                        onChange={(e) => setWaApiUrl(e.target.value)}
                        placeholder="http://localhost:3001"
                      />
                    </div>
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                      Masukkan URL Ngrok/Tunnel jika ingin diakses dari luar. Biarkan default jika dari laptop.
                    </span>
                  </div>

                  <div className="mock-preview-container">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      🔍 PREVIEW MOCKUP PENGIRIM (LABEL PENGIRIMAN)
                    </div>
                    <div style={{
                      padding: 14,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 13,
                      lineHeight: 1.6
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>PENGIRIM: {storeName || 'Pearl Store'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        📱 WA: {storePhone || '081234567890'} &nbsp;|&nbsp; 📸 IG: @{storeInstagram || 'pearlstore'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TAB 2: BRANDING & LOGIN */}
              <div style={{ display: activeSection === 'branding' ? 'block' : 'none' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(6,182,212,0.12)', color: '#06b6d4'
                    }}>
                      <Palette size={16} />
                    </div>
                    <span>Branding &amp; Tampilan Aplikasi</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginLeft: 42, lineHeight: 1.4 }}>
                    Sesuaikan nama sistem CRM yang tampil di sidebar menu dan ubah logo emoji beserta teks header pada halaman otentikasi login.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="settings-grid-2" style={{ display: 'grid', gap: 18 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Nama Aplikasi</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          placeholder="Contoh: PearlCRM"
                          required
                        />
                        <div className="input-prefix-icon">
                          <Sparkles size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Emoji Logo Login</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={loginLogoEmoji}
                          onChange={(e) => setLoginLogoEmoji(e.target.value)}
                          placeholder="Contoh: 🛡️ atau 💎"
                        />
                        <div className="input-prefix-icon">
                          <Award size={16} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="settings-grid-2" style={{ display: 'grid', gap: 18 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Judul Halaman Login</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={loginTitle}
                          onChange={(e) => setLoginTitle(e.target.value)}
                          placeholder="Contoh: PearlCRM Access"
                        />
                        <div className="input-prefix-icon">
                          <KeyRound size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Sub-judul Halaman Login</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={loginSubtitle}
                          onChange={(e) => setLoginSubtitle(e.target.value)}
                          placeholder="Contoh: Masukkan akun akses"
                        />
                        <div className="input-prefix-icon">
                          <Type size={16} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Mockups */}
                  <div style={{ display: 'grid', gap: 16, marginTop: 16 }} className="settings-preview-2">
                    <div className="mock-preview-container" style={{ marginTop: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        🔍 SIDEBAR LOGO PREVIEW
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: 'var(--gradient-brand)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, boxShadow: 'var(--shadow-sm)'
                        }}>
                          {loginLogoEmoji || '🛡️'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{appName || 'PearlCRM'}</div>
                          <div style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: 0.5 }}>ACTIVE SYSTEM</div>
                        </div>
                      </div>
                    </div>

                    <div className="mock-preview-container" style={{ marginTop: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                        🔍 LOGIN SCREEN CARD PREVIEW
                      </div>
                      <div style={{
                        padding: 10,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{loginLogoEmoji || '🛡️'}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{loginTitle || 'PearlCRM Access'}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{loginSubtitle || 'Silakan login'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TAB 3: LOYALITAS & VOUCHER */}
              <div style={{ display: activeSection === 'loyalty' ? 'block' : 'none' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(16,185,129,0.12)', color: '#10b981'
                    }}>
                      <Gift size={16} />
                    </div>
                    <span>Program Loyalitas &amp; Voucher</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginLeft: 42, lineHeight: 1.4 }}>
                    Kelola kode promo voucher diskon hari ulang tahun, nominal minimum untuk klasifikasi level customer (VIP / Loyal), serta kustomisasi template pesan WhatsApp.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="settings-grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Kode Voucher Ulang Tahun</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                          placeholder="Contoh: BDAY10"
                        />
                        <div className="input-prefix-icon">
                          <Tag size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Tipe Diskon</label>
                      <div className="input-prefix-wrapper">
                        <select
                          className="form-input-premium"
                          style={{ paddingRight: 28 }}
                          value={voucherType}
                          onChange={(e) => {
                            const newType = e.target.value as 'percent' | 'fixed';
                            setVoucherType(newType);
                            if (newType === 'percent') {
                              setVoucherValueStr('10');
                            } else {
                              setVoucherValueStr((50000).toLocaleString('id-ID'));
                            }
                          }}
                        >
                          <option value="percent">Persentase (%)</option>
                          <option value="fixed">Nominal Tetap (Rp)</option>
                        </select>
                        <div className="input-prefix-icon">
                          <Coins size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                        Nilai {voucherType === 'percent' ? '(%)' : '(Rp)'}
                      </label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={voucherValueStr}
                          onChange={(e) => {
                            if (voucherType === 'percent') {
                              const val = e.target.value.replace(/\D/g, '');
                              const num = parseInt(val, 10) || 0;
                              if (num <= 100) {
                                setVoucherValueStr(val);
                              }
                            } else {
                              const rawVal = e.target.value.replace(/\./g, '');
                              if (/^\d*$/.test(rawVal)) {
                                setVoucherValueStr(formatInputNumber(e.target.value));
                              }
                            }
                          }}
                          placeholder={voucherType === 'percent' ? '10' : '50.000'}
                        />
                        <div className="input-prefix-icon">
                          {voucherType === 'percent' ? <Percent size={16} /> : <Coins size={16} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="settings-grid-2" style={{ display: 'grid', gap: 18 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Min. Belanja VIP (Rp)</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="text"
                          className="form-input-premium"
                          value={vipMinSpendStr}
                          onChange={handleVipChange}
                          placeholder="Contoh: 15.000.000"
                        />
                        <div className="input-prefix-icon">
                          <Crown size={16} style={{ color: '#fbbf24' }} />
                        </div>
                      </div>
                      <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                        Total belanja minimal untuk otomatis diklasifikasikan sebagai <span className="badge-customer-vip" style={{ padding: '0 4px', fontSize: 9 }}>VIP</span>.
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Min. Transaksi Loyal</label>
                      <div className="input-prefix-wrapper">
                        <input
                          type="number"
                          min="1"
                          className="form-input-premium"
                          value={loyalMinOrders}
                          onChange={(e) => setLoyalMinOrders(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          placeholder="Contoh: 3"
                        />
                        <div className="input-prefix-icon">
                          <Trophy size={16} style={{ color: '#a78bfa' }} />
                        </div>
                      </div>
                      <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                        Jumlah order selesai minimal untuk otomatis menjadi pelanggan <span className="badge-customer-loyal" style={{ padding: '0 4px', fontSize: 9 }}>LOYAL</span>.
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Template Pesan WA Ulang Tahun</label>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        className="form-input-premium"
                        style={{
                          padding: '12px 12px 12px 38px',
                          height: 'auto',
                          minHeight: 120,
                          fontFamily: 'Inter, sans-serif',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                        value={birthdayMessageTemplate}
                        onChange={(e) => setBirthdayMessageTemplate(e.target.value)}
                        placeholder="Tulis template ucapan ulang tahun..."
                      />
                      <div className="input-prefix-icon" style={{ top: 22 }}>
                        <MessageSquare size={16} />
                      </div>
                    </div>
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6, lineHeight: 1.4 }}>
                      Variabel dinamis: <code>{`{customerName}`}</code> (nama), <code>{`{storeName}`}</code> (nama toko), dan <code>{`{vipNote}`}</code> (tambahan voucher untuk VIP).
                    </span>
                  </div>

                  {/* WhatsApp Live Preview */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      🔍 LIVE PREVIEW PESAN WHATSAPP (VIP CUSTOMER)
                    </div>
                    <div className="whatsapp-preview-container">
                      <div className="whatsapp-bubble">
                        {birthdayMessageTemplate
                          .replace(/{customerName}/g, 'Nabila Amalia')
                          .replace(/{storeName}/g, storeName || 'Pearl Store')
                          .replace(/{vipNote}/g, `\n\nSebagai pelanggan VIP, gunakan kode voucher *${voucherCode || 'BDAY10'}* untuk diskon *${
                            voucherType === 'percent' ? `${voucherValueStr}%` : `Rp ${voucherValueStr}`
                          }* pada pesanan berikutnya! 🎁`)}
                        <div className="whatsapp-time">
                          09:00 ✓✓
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 24 }}>
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Template Pesan WA Pengiriman &amp; Resi</label>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        className="form-input-premium"
                        style={{
                          padding: '12px 12px 12px 38px',
                          height: 'auto',
                          minHeight: 120,
                          fontFamily: 'Inter, sans-serif',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                        value={shippingMessageTemplate}
                        onChange={(e) => setShippingMessageTemplate(e.target.value)}
                        placeholder="Tulis template pengiriman pesanan..."
                      />
                      <div className="input-prefix-icon" style={{ top: 22 }}>
                        <MessageSquare size={16} />
                      </div>
                    </div>
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6, lineHeight: 1.4 }}>
                      Variabel dinamis: <code>{`{customerName}`}</code> (nama), <code>{`{productName}`}</code> (jenis perhiasan), <code>{`{courierName}`}</code> (kurir), <code>{`{resi}`}</code> (nomor resi), dan <code>{`{storeName}`}</code> (nama toko).
                    </span>
                  </div>

                  {/* WhatsApp Shipping Live Preview */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 }}>
                      🔍 LIVE PREVIEW PESAN WA PENGIRIMAN
                    </div>
                    <div className="whatsapp-preview-container">
                      <div className="whatsapp-bubble">
                        {shippingMessageTemplate
                          .replace(/{customerName}/g, 'Nabila Amalia')
                          .replace(/{productName}/g, 'Bracelet - Akoya Seawater')
                          .replace(/{courierName}/g, 'JNE')
                          .replace(/{resi}/g, 'JZ123456789')
                          .replace(/{storeName}/g, storeName || 'Pearl Store')}
                        <div className="whatsapp-time">
                          14:20 âœ“âœ“
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TAB 4: PENGATURAN CETAK */}
              <div style={{ display: activeSection === 'print' ? 'block' : 'none' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(59,130,246,0.12)', color: '#3b82f6'
                    }}>
                      <Printer size={16} />
                    </div>
                    <span>Pengaturan Cetak & Invoice</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginLeft: 42, lineHeight: 1.4 }}>
                    Kustomisasi tampilan nota penjualan (invoice) dan label pengiriman paket. Atur warna tema invoice serta catatan tambahan.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Warna Tema Invoice</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="color"
                        value={invoiceAccentColor}
                        onChange={(e) => setInvoiceAccentColor(e.target.value)}
                        style={{
                          width: 42,
                          height: 42,
                          padding: 0,
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: 'transparent'
                        }}
                      />
                      <div className="input-prefix-wrapper" style={{ flex: 1 }}>
                        <input
                          type="text"
                          className="form-input-premium"
                          value={invoiceAccentColor}
                          onChange={(e) => setInvoiceAccentColor(e.target.value)}
                          placeholder="#0f172a"
                          style={{ paddingLeft: 12 }}
                        />
                      </div>
                    </div>
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                      Warna ini digunakan untuk garis header, tabel, dan warna aksen di cetak nota (invoice).
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Catatan Kaki Invoice (Footer)</label>
                    <textarea
                      className="form-input-premium"
                      style={{
                        padding: '12px',
                        height: 'auto',
                        minHeight: 80,
                        fontFamily: 'Inter, sans-serif',
                        resize: 'vertical',
                        lineHeight: '1.6',
                      }}
                      value={invoiceFooterNote}
                      onChange={(e) => setInvoiceFooterNote(e.target.value)}
                      placeholder="Contoh: Terima kasih atas kunjungan Anda..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Catatan Ekstra Label Pengiriman</label>
                    <textarea
                      className="form-input-premium"
                      style={{
                        padding: '12px',
                        height: 'auto',
                        minHeight: 80,
                        fontFamily: 'Inter, sans-serif',
                        resize: 'vertical',
                        lineHeight: '1.6',
                      }}
                      value={labelFooterNote}
                      onChange={(e) => setLabelFooterNote(e.target.value)}
                      placeholder="Contoh: AWAS PECAH! Wajib melampirkan video unboxing untuk klaim retur."
                    />
                    <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                      Teks ini akan muncul di bagian paling bawah pada kertas label pengiriman kurir.
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Pengaturan Kertas Cetak</div>
                    
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Ukuran Kertas</label>
                      <select className="form-input-premium" style={{ paddingLeft: 12, cursor: 'pointer' }} value={printPaperSize} onChange={(e) => setPrintPaperSize(e.target.value)}>
                        <option value="A4">A4 (210mm x 297mm)</option>
                        <option value="A5">A5 (148mm x 210mm)</option>
                        <option value="Letter">Letter (8.5in x 11in)</option>
                        <option value="Thermal80">Printer Kasir / Thermal 80mm</option>
                        <option value="Thermal58">Printer Kasir / Thermal 58mm</option>
                        <option value="Custom">Kustom (Atur Sendiri)</option>
                      </select>
                    </div>

                    {printPaperSize === 'Custom' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, marginTop: 16 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Lebar Kertas (mm)</label>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 12 }} value={printCustomWidth} onChange={(e) => setPrintCustomWidth(e.target.value)} />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tinggi Kertas (mm)</label>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 12 }} value={printCustomHeight} onChange={(e) => setPrintCustomHeight(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <div className="form-group" style={{ marginTop: 16 }}>
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Orientasi Kertas</label>
                      <select className="form-input-premium" style={{ paddingLeft: 12, cursor: 'pointer' }} value={printOrientation} onChange={(e) => setPrintOrientation(e.target.value)}>
                        <option value="portrait">Portrait (Tegak)</option>
                        <option value="landscape">Landscape (Mendatar)</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <label className="form-label" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Margin Kertas</label>
                        <select className="form-input-premium" style={{ paddingLeft: 8, paddingRight: 8, height: 28, width: 'auto', fontSize: 11, cursor: 'pointer' }} value={printMarginUnit} onChange={(e) => setPrintMarginUnit(e.target.value)}>
                          <option value="mm">Milimeter (mm)</option>
                          <option value="px">Pixel (px)</option>
                          <option value="cm">Sentimeter (cm)</option>
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>Atas</div>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'center' }} value={printMarginTop} onChange={(e) => setPrintMarginTop(e.target.value)} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>Kanan</div>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'center' }} value={printMarginRight} onChange={(e) => setPrintMarginRight(e.target.value)} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>Bawah</div>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'center' }} value={printMarginBottom} onChange={(e) => setPrintMarginBottom(e.target.value)} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>Kiri</div>
                          <input type="number" className="form-input-premium" style={{ paddingLeft: 8, paddingRight: 8, textAlign: 'center' }} value={printMarginLeft} onChange={(e) => setPrintMarginLeft(e.target.value)} />
                        </div>
                      </div>
                      <span className="form-helper" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                        Kosongkan margin atau isi '0' jika Anda menggunakan printer kasir (Thermal) agar tidak terpotong.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVE / RESET ACTION BUTTONS */}
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-secondary settings-actions-reset"
                  onClick={handleReset}
                >
                  <RefreshCw size={15} /> Reset Default
                </button>
                <button
                  type="submit"
                  className="btn btn-primary settings-actions-save"
                >
                  <Save size={15} /> Simpan Pengaturan
                </button>
              </div>

            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

