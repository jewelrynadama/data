// src/pages/InboxPage.tsx
import { useState } from 'react';
import { Check, Copy, CheckCircle, Trash2, Globe, ShoppingBag, Terminal, BookOpen } from 'lucide-react';
import type { PendingOrder } from '../types';

interface Props {
  pendingOrders: PendingOrder[];
  onAccept: (order: PendingOrder) => Promise<void>;
  onReject: (order: PendingOrder) => Promise<void>;
}

export default function InboxPage({ pendingOrders, onAccept, onReject }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Read Firebase variables directly from environmental variables or display placeholders
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY';
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_FIREBASE_AUTH_DOMAIN';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_FIREBASE_PROJECT_ID';
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_FIREBASE_STORAGE_BUCKET';
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_FIREBASE_MESSAGING_SENDER_ID';
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_FIREBASE_APP_ID';

  const blogspotCode = `<!-- 1. Tambahkan script SDK Firebase di bagian <head> atau sebelum </body> template Blogspot Anda -->
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>

<script>
  // 2. Konfigurasi Firebase otomatis dari PearlCRM Anda
  const firebaseConfig = {
    apiKey: "${apiKey}",
    authDomain: "${authDomain}",
    projectId: "${projectId}",
    storageBucket: "${storageBucket}",
    messagingSenderId: "${messagingSenderId}",
    appId: "${appId}"
  };

  // Inisialisasi
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // 3. Panggil fungsi ini ketika tombol Checkout / Beli / Kirim WA diklik di template Blogspot
  function sendOrderToCRM(customerName, waNumber, productName, totalPrice, qty, address) {
    const orderId = 'web-' + Date.now();
    return db.collection('pending_orders').doc(orderId).set({
      id: orderId,
      source: 'website',
      orderDate: new Date().toLocaleDateString('id-ID'),
      customerName: customerName,
      wa: waNumber ? waNumber.replace(/\\D/g, '') : '',
      productName: productName,
      totalPrice: Number(totalPrice),
      qty: Number(qty),
      alamat: address,
      status: 'pending',
      createdAt: new Date().toISOString()
    })
    .then(() => {
      console.log('Order berhasil disinkronisasi ke PearlCRM!');
    })
    .catch((error) => {
      console.error('Gagal sinkronisasi ke CRM:', error);
    });
  }

  // CONTOH PENGGUNAAN PADA TOMBOL CHECKOUT:
  // document.getElementById('btn-checkout').addEventListener('click', function() {
  //   sendOrderToCRM('Rina Kusuma', '081234567890', 'Kalung Mutiara Southsea', 4500000, 1, 'Jakarta Selatan');
  // });
</script>`;

  const tampermonkeyCode = `// ==UserScript==
// @name         Shopee Seller Center to PearlCRM Sync
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Kirim data order baru dari Shopee ke dashboard PearlCRM secara semi-otomatis
// @author       PearlCRM
// @match        https://seller.shopee.co.id/portal/sale*
// @grant        none
// @require      https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js
// ==/UserScript==

(function() {
  'use strict';

  const firebaseConfig = {
    apiKey: "${apiKey}",
    authDomain: "${authDomain}",
    projectId: "${projectId}",
    storageBucket: "${storageBucket}",
    messagingSenderId: "${messagingSenderId}",
    appId: "${appId}"
  };

  // Tunggu Firebase ter-load
  const checkInterval = setInterval(() => {
    if (typeof firebase !== 'undefined') {
      clearInterval(checkInterval);
      firebase.initializeApp(firebaseConfig);
      const db = firebase.firestore();
      console.log('[PearlCRM Sync] Connected to Firebase successfully!');

      // Tambahkan tombol Sync di setiap baris orderan Shopee
      setInterval(() => {
        // Cari baris pesanan atau header detail pesanan di Shopee
        const orderRows = document.querySelectorAll('.order-item-row, .order-detail-header-card'); // Sesuaikan class selector jika Shopee memperbarui UI
        
        orderRows.forEach(row => {
          if (row.classList.contains('crm-btn-added')) return;
          row.classList.add('crm-btn-added');

          const btn = document.createElement('button');
          btn.innerText = '💎 Sync to CRM';
          btn.style.cssText = 'background:#7c3aed;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:bold;margin-left:8px;';
          
          btn.onclick = (e) => {
            e.stopPropagation();
            btn.innerText = '⏳ Syncing...';
            btn.disabled = true;

            // Ekstrak info dari DOM Shopee
            const orderId = row.querySelector('.order-sn-text')?.innerText || 'SP-' + Date.now();
            const customerName = row.querySelector('.buyer-name-text')?.innerText || 'Pelanggan Shopee';
            const productName = row.querySelector('.product-name-text')?.innerText || 'Perhiasan Mutiara';
            const totalPrice = Number((row.querySelector('.total-amount-text')?.innerText || '0').replace(/\\D/g, ''));
            const qty = Number((row.querySelector('.quantity-text')?.innerText || '1').replace(/\\D/g, ''));
            const address = row.querySelector('.address-text')?.innerText || 'Shopee Order';

            db.collection('pending_orders').doc(orderId).set({
              id: orderId,
              source: 'shopee',
              orderDate: new Date().toLocaleDateString('id-ID'),
              customerName: customerName,
              productName: productName,
              totalPrice: totalPrice,
              qty: qty,
              alamat: address,
              status: 'pending',
              createdAt: new Date().toISOString()
            })
            .then(() => {
              btn.innerText = '✅ Synced!';
              btn.style.background = '#10b981';
            })
            .catch(err => {
              btn.innerText = '❌ Error';
              btn.style.background = '#ef4444';
              btn.disabled = false;
              console.error(err);
            });
          };

          row.appendChild(btn);
        });
      }, 1500);
    }
  }, 1000);
})();`;

  function handleCopy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  async function processAccept(order: PendingOrder) {
    setProcessingId(order.id);
    try {
      await onAccept(order);
    } finally {
      setProcessingId(null);
    }
  }

  async function processReject(order: PendingOrder) {
    if (!confirm(`Hapus orderan dari ${order.customerName} dari Inbox?`)) return;
    setProcessingId(order.id);
    try {
      await onReject(order);
    } finally {
      setProcessingId(null);
    }
  }

  function formatRupiah(num: number): string {
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Total orderan masuk yang menunggu persetujuan Anda
          </div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setShowGuide(!showGuide)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {showGuide ? <BookOpen size={14} /> : <Terminal size={14} />}
          {showGuide ? 'Tutup Panduan Integrasi' : '⚙️ Setup Integrasi Website & Shopee'}
        </button>
      </div>

      {/* Integration Guide Section */}
      {showGuide && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)', background: 'var(--bg-secondary)', animation: 'fadeIn 0.2s ease' }}>
          <div className="card-header">
            <div className="card-title">⚙️ Panduan Menghubungkan vollapearl.com & Shopee</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                PearlCRM Anda terintegrasi langsung dengan database real-time. Salin kode di bawah ini untuk menghubungkan form order Blogspot atau Shopee Seller Center Anda.
              </div>
            </div>

            {/* Blogspot Script */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe size={13} color="#2563eb" /> 1. Integrasi Website Blogspot (vollapearl.com)
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => handleCopy('blogspot', blogspotCode)}
                >
                  {copiedKey === 'blogspot' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  {copiedKey === 'blogspot' ? 'Tersalin!' : 'Salin Script Blogspot'}
                </button>
              </div>
              <pre style={{ margin: 0, padding: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)', overflowX: 'auto', maxHeight: 200, color: 'var(--text-secondary)' }}>
                {blogspotCode}
              </pre>
            </div>

            {/* Shopee Tampermonkey Script */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShoppingBag size={13} color="#ea580c" /> 2. Integrasi Shopee (Tampermonkey Script)
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => handleCopy('shopee', tampermonkeyCode)}
                >
                  {copiedKey === 'shopee' ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                  {copiedKey === 'shopee' ? 'Tersalin!' : 'Salin Script Tampermonkey'}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                💡 <strong>Cara Pasang:</strong> Pasang ekstensi <strong>Tampermonkey</strong> di browser Anda (Chrome/Firefox), klik "Create a new script", hapus script bawaan, lalu paste script di bawah ini dan simpan (Ctrl+S).
              </div>
              <pre style={{ margin: 0, padding: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)', overflowX: 'auto', maxHeight: 200, color: 'var(--text-secondary)' }}>
                {tampermonkeyCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Pending Orders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {pendingOrders.length === 0 ? (
          <div className="card" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Inbox Kosong</div>
            <div style={{ fontSize: 12.5, marginTop: 4, maxWidth: 360, lineHeight: 1.5 }}>
              Belum ada orderan baru yang masuk dari vollapearl.com atau Shopee. Hubungkan toko Anda dengan mengikuti panduan setup di kanan atas.
            </div>
          </div>
        ) : (
          pendingOrders.map((order) => {
            const isShopee = order.source === 'shopee';
            const badgeBg = isShopee ? 'rgba(234, 88, 12, 0.12)' : 'rgba(37, 99, 235, 0.12)';
            const badgeColor = isShopee ? '#ea580c' : '#2563eb';
            const badgeText = isShopee ? '🟠 Shopee Order' : '🌐 Website Order';

            return (
              <div
                key={order.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${badgeColor}`,
                  opacity: processingId === order.id ? 0.6 : 1,
                  pointerEvents: processingId === order.id ? 'none' : 'auto',
                }}
              >
                <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Badge & Source */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2.5px 10px', borderRadius: 99, background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}33`, width: 'fit-content' }}>
                      {badgeText}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      📅 {order.orderDate}
                    </div>
                  </div>

                  {/* Order Details */}
                  <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {order.customerName}
                      </span>
                      {order.wa && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          📱 {order.wa}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                      📦 <strong>{order.productName}</strong> x {order.qty}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 700 }}>
                      {formatRupiah(order.totalPrice)}
                    </div>

                    {order.alamat && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '6px 10px', borderRadius: 6, marginTop: 6, border: '1px solid var(--border)' }}>
                        📍 {order.alamat}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => processAccept(order)}
                      disabled={processingId !== null}
                      style={{ background: 'var(--gradient-green)', fontSize: 12, padding: '6px 14px' }}
                    >
                      <CheckCircle size={13} /> Terima & Catat
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => processReject(order)}
                      disabled={processingId !== null}
                      style={{ fontSize: 12, color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.25)', padding: '6px 12px' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <Trash2 size={13} /> Tolak
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
