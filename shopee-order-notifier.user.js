// ==UserScript==
// @name         🛍️ Volla Pearl - Shopee Order Notifier
// @namespace    vollapearl-shopee-notifier
// @version      2.0.0
// @description  Notifikasi otomatis order baru di Shopee Seller Center dengan suara, popup, dan WhatsApp alert
// @author       Volla Pearl
// @match        https://seller.shopee.co.id/*
// @match        https://bm.shopee.co.id/*
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// @icon         https://cf.shopee.co.id/file/sg-11134004-7qvfm-lgahwbs7dbo0e0_tn
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // ⚙️ KONFIGURASI — EDIT SESUAI KEBUTUHANMU
  // ============================================================
  var CONFIG = {
    // Interval cek order baru (dalam detik)
    CHECK_INTERVAL: 30,

    // Nomor WA untuk alert (format: 628xxx)
    // Kosongkan string jika tidak mau kirim WA otomatis
    WA_ALERT_NUMBER: '',   // contoh: '6289618885066'

    // Token Fonnte untuk kirim WA
    FONNTE_TOKEN: '5dRUkEauBfcm5dax81CU',

    // Suara notifikasi: 'ding', 'bell', 'chime', 'none'
    SOUND_TYPE: 'ding',

    // Volume suara (0.0 - 1.0)
    VOLUME: 0.85,

    // Tampilkan popup notifikasi desktop?
    DESKTOP_NOTIF: true,

    // Auto-refresh halaman jika stuck (menit, 0 = off)
    AUTO_REFRESH_MINUTES: 0,

    // Tampilkan badge di tab browser?
    SHOW_TAB_BADGE: true,

    // Nama toko di notifikasi
    STORE_NAME: 'Volla Pearl',
  };
  // ============================================================

  var STORAGE_KEY = 'volla_shopee_known_orders';
  var TOTAL_NEW_KEY = 'volla_shopee_total_new';
  var isRunning = false;
  var checkTimer = null;
  var totalNewOrders = 0;
  var originalTitle = document.title;

  // ──────────────────────────────────────────────
  // 🎨 INJECT CSS
  // ──────────────────────────────────────────────
  GM_addStyle(`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

    #volla-notifier-panel, #volla-notifier-panel * {
      font-family: 'Plus Jakarta Sans', sans-serif !important;
      box-sizing: border-box;
    }

    #volla-notifier-panel {
      position: fixed;
      bottom: 20px;
      left: 20px;
      z-index: 999999;
      width: 280px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
      overflow: hidden;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(0,0,0,0.07);
    }

    #volla-notifier-panel.collapsed {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(238, 77, 45, 0.35);
    }

    #volla-notifier-header {
      background: linear-gradient(135deg, #ee4d2d 0%, #f97316 100%);
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    }

    #volla-notifier-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: white;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #volla-notifier-header .badge {
      background: white;
      color: #ee4d2d;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 99px;
      min-width: 20px;
      text-align: center;
    }

    #volla-notifier-toggle {
      background: rgba(255,255,255,0.25);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.2s;
      flex-shrink: 0;
    }

    #volla-notifier-toggle:hover { background: rgba(255,255,255,0.4); }

    #volla-notifier-body {
      padding: 14px;
    }

    #volla-notifier-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #555;
      margin-bottom: 12px;
      padding: 8px 10px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #f0f0f0;
    }

    .volla-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .volla-status-dot.active {
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,0.2);
      animation: pulse-dot 1.5s ease-in-out infinite;
    }

    .volla-status-dot.inactive {
      background: #d1d5db;
    }

    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
      50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.1); }
    }

    #volla-order-list {
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
      scrollbar-width: thin;
    }

    .volla-order-item {
      background: #fff9f5;
      border: 1px solid #ffe8dc;
      border-radius: 8px;
      padding: 9px 11px;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      display: block;
    }

    .volla-order-item:hover {
      background: #fff3ee;
      border-color: #ee4d2d;
      transform: translateX(2px);
    }

    .volla-order-item.new-order {
      border-color: #ee4d2d;
      background: linear-gradient(135deg, #fff5f0, #fff9f5);
      animation: newOrderPulse 0.6s ease-out;
    }

    @keyframes newOrderPulse {
      0% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }

    .volla-order-no {
      font-size: 12px;
      font-weight: 700;
      color: #ee4d2d;
      margin-bottom: 3px;
    }

    .volla-order-meta {
      font-size: 11px;
      color: #888;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .volla-order-amount {
      font-weight: 600;
      color: #333;
    }

    .volla-order-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 99px;
      background: #fee2e2;
      color: #ee4d2d;
    }

    .volla-no-orders {
      text-align: center;
      padding: 20px 10px;
      color: #aaa;
      font-size: 12px;
    }

    #volla-notifier-footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    #volla-notifier-footer button {
      padding: 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.2s;
      border: 1px solid;
    }

    #volla-btn-toggle-monitor {
      background: #ee4d2d;
      color: white;
      border-color: #ee4d2d;
    }

    #volla-btn-toggle-monitor:hover { background: #d63b1c; }

    #volla-btn-toggle-monitor.paused {
      background: #22c55e;
      border-color: #22c55e;
    }

    #volla-btn-clear {
      background: white;
      color: #666;
      border-color: #e0e0e0;
    }

    #volla-btn-clear:hover { background: #f5f5f5; border-color: #ccc; }

    #volla-notifier-panel.collapsed #volla-notifier-body,
    #volla-notifier-panel.collapsed #volla-notifier-header h3,
    #volla-notifier-panel.collapsed #volla-notifier-toggle {
      display: none !important;
    }

    #volla-notifier-panel.collapsed #volla-notifier-header {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #volla-collapsed-icon {
      display: none;
      font-size: 22px;
    }

    #volla-notifier-panel.collapsed #volla-collapsed-icon {
      display: block;
    }

    #volla-collapsed-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ff4444;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 99px;
      border: 2px solid white;
      display: none;
    }

    /* ── Toast notifikasi ─────────────────── */
    #volla-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .volla-toast {
      background: white;
      border-radius: 12px;
      padding: 14px 18px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.14);
      border-left: 4px solid #ee4d2d;
      max-width: 320px;
      pointer-events: all;
      animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    @keyframes toastIn {
      from { transform: translateX(120%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .volla-toast.out {
      animation: toastOut 0.3s ease-in forwards;
    }

    @keyframes toastOut {
      to { transform: translateX(120%); opacity: 0; }
    }

    .volla-toast-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .volla-toast-title {
      font-size: 13px;
      font-weight: 700;
      color: #ee4d2d;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .volla-toast-close {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }

    .volla-toast-body {
      font-size: 12.5px;
      color: #333;
      line-height: 1.5;
    }

    .volla-toast-amount {
      font-size: 14px;
      font-weight: 700;
      color: #ee4d2d;
      margin-top: 4px;
    }

    .volla-toast-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }

    .volla-toast-actions a, .volla-toast-actions button {
      flex: 1;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      border: none;
      transition: 0.2s;
    }

    .volla-toast-btn-primary {
      background: #ee4d2d;
      color: white !important;
    }

    .volla-toast-btn-secondary {
      background: #f5f5f5;
      color: #555 !important;
      border: 1px solid #e0e0e0 !important;
    }
  `);

  // ──────────────────────────────────────────────
  // 🔊 AUDIO ENGINE
  // ──────────────────────────────────────────────
  function playNotificationSound() {
    if (CONFIG.SOUND_TYPE === 'none') return;
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();

      function playTone(freq, start, dur, type) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type || 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(CONFIG.VOLUME, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      }

      if (CONFIG.SOUND_TYPE === 'ding') {
        playTone(880, 0, 0.4);
        playTone(1100, 0.15, 0.35);
        playTone(1320, 0.3, 0.5);
      } else if (CONFIG.SOUND_TYPE === 'bell') {
        playTone(660, 0, 0.6, 'triangle');
        playTone(880, 0.1, 0.5, 'triangle');
        playTone(1100, 0.25, 0.5, 'triangle');
        playTone(880, 0.45, 0.6, 'triangle');
      } else if (CONFIG.SOUND_TYPE === 'chime') {
        [523, 659, 784, 1047].forEach(function(f, i) {
          playTone(f, i * 0.12, 0.45, 'triangle');
        });
      }
    } catch(e) {}
  }

  // ──────────────────────────────────────────────
  // 🔔 TOAST NOTIFIKASI
  // ──────────────────────────────────────────────
  var toastContainer = null;

  function initToastContainer() {
    toastContainer = document.getElementById('volla-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'volla-toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  function showToast(order) {
    if (!toastContainer) initToastContainer();
    var toast = document.createElement('div');
    toast.className = 'volla-toast';
    var orderUrl = 'https://seller.shopee.co.id/portal/sale/all-orders?search_key=' + order.orderSn;

    toast.innerHTML =
      '<div class="volla-toast-header">' +
        '<div class="volla-toast-title">🛍️ Order Baru Masuk!</div>' +
        '<button class="volla-toast-close" onclick="this.closest(\'.volla-toast\').remove()">✕</button>' +
      '</div>' +
      '<div class="volla-toast-body">' +
        '<div style="font-weight:600; color:#333;">' + order.buyerUsername + '</div>' +
        '<div style="color:#888; font-size:11px; margin-top:2px;">' + order.orderSn + '</div>' +
        '<div class="volla-toast-amount">' + formatIDR(order.totalAmount) + '</div>' +
        (order.items ? '<div style="color:#888; font-size:11px; margin-top:4px;">📦 ' + order.items + '</div>' : '') +
      '</div>' +
      '<div class="volla-toast-actions">' +
        '<a href="' + orderUrl + '" target="_blank" class="volla-toast-btn-primary">Lihat Order</a>' +
        '<button class="volla-toast-btn-secondary" onclick="this.closest(\'.volla-toast\').remove()">Tutup</button>' +
      '</div>';

    toastContainer.appendChild(toast);

    // Auto dismiss setelah 15 detik
    setTimeout(function() {
      toast.classList.add('out');
      setTimeout(function() { toast.remove(); }, 300);
    }, 15000);
  }

  // ──────────────────────────────────────────────
  // 📲 KIRIM WA ALERT (via Fonnte)
  // ──────────────────────────────────────────────
  function sendWAAlert(order) {
    if (!CONFIG.WA_ALERT_NUMBER || !CONFIG.FONNTE_TOKEN) return;

    var pesan =
      '🛍️ *ORDER BARU - ' + CONFIG.STORE_NAME + '*\n\n' +
      '📦 No. Order: ' + order.orderSn + '\n' +
      '👤 Pembeli: ' + order.buyerUsername + '\n' +
      '💰 Total: ' + formatIDR(order.totalAmount) + '\n' +
      (order.items ? '🎁 Produk: ' + order.items + '\n' : '') +
      '\nCek di: https://seller.shopee.co.id/portal/sale/all-orders';

    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.fonnte.com/send',
      headers: {
        'Authorization': CONFIG.FONNTE_TOKEN,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        target: CONFIG.WA_ALERT_NUMBER,
        message: pesan
      }),
      onload: function(res) {
        console.log('[Volla Notifier] WA alert sent:', res.status);
      },
      onerror: function() {
        console.log('[Volla Notifier] WA alert failed');
      }
    });
  }

  // ──────────────────────────────────────────────
  // 🔢 FORMAT RUPIAH
  // ──────────────────────────────────────────────
  function formatIDR(amount) {
    if (!amount) return 'Rp-';
    var num = parseInt(amount) || 0;
    return 'Rp' + num.toLocaleString('id-ID');
  }

  // ──────────────────────────────────────────────
  // 💾 STORAGE HELPERS
  // ──────────────────────────────────────────────
  function getKnownOrders() {
    try { return JSON.parse(GM_getValue(STORAGE_KEY, '[]')); } catch(e) { return []; }
  }

  function saveKnownOrders(arr) {
    // Simpan maksimal 200 order terakhir
    if (arr.length > 200) arr = arr.slice(-200);
    GM_setValue(STORAGE_KEY, JSON.stringify(arr));
  }

  // ──────────────────────────────────────────────
  // 🛒 AMBIL DATA ORDER DARI SHOPEE API
  // ──────────────────────────────────────────────
  function fetchNewOrders(callback) {
    // Coba ambil dari Shopee internal API
    // Shopee menyimpan auth di cookie, kita request API internal
    var urls = [
      '/api/v2/order/get_order_list?order_status=UNPAID&page_size=20&cursor=&response_optional_fields=buyer_username,item_list,total_amount',
      '/api/v2/order/get_order_list?order_status=READY_TO_SHIP&page_size=20&cursor=&response_optional_fields=buyer_username,item_list,total_amount'
    ];

    var results = [];
    var done = 0;

    urls.forEach(function(url) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://seller.shopee.co.id' + url,
        withCredentials: true,
        onload: function(res) {
          try {
            var data = JSON.parse(res.responseText);
            if (data && data.data && data.data.order_list) {
              results = results.concat(data.data.order_list);
            }
          } catch(e) {}
          done++;
          if (done === urls.length) callback(results);
        },
        onerror: function() {
          done++;
          if (done === urls.length) callback(results);
        }
      });
    });
  }

  // Fallback: scrape dari DOM halaman order Shopee
  function scrapeOrdersFromDOM() {
    var orders = [];
    try {
      // Cek apakah ada state Redux di window
      var keys = Object.keys(window);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.startsWith('__') || k.startsWith('$')) {
          try {
            var val = window[k];
            if (val && val.orderList) {
              orders = val.orderList;
              break;
            }
          } catch(e) {}
        }
      }

      // Coba dari elemen DOM langsung
      if (orders.length === 0) {
        var orderEls = document.querySelectorAll('[data-order-sn], .order-card, [class*="order-item"]');
        orderEls.forEach(function(el) {
          var sn = el.getAttribute('data-order-sn') || el.querySelector('[class*="order-sn"]')?.textContent;
          if (sn) {
            var amountEl = el.querySelector('[class*="price"], [class*="amount"]');
            var buyerEl = el.querySelector('[class*="buyer"], [class*="username"]');
            orders.push({
              order_sn: sn.trim(),
              buyer_username: buyerEl ? buyerEl.textContent.trim() : '—',
              total_amount: amountEl ? parseInt(amountEl.textContent.replace(/\D/g,'')) : 0
            });
          }
        });
      }
    } catch(e) {}
    return orders;
  }

  // ──────────────────────────────────────────────
  // 🔍 CEK ORDER BARU
  // ──────────────────────────────────────────────
  var recentNewOrders = [];

  function checkNewOrders() {
    fetchNewOrders(function(orderList) {
      var known = getKnownOrders();
      var knownSet = new Set(known);
      var newOrders = [];

      // Jika API gagal, coba scrape DOM
      if (orderList.length === 0) {
        orderList = scrapeOrdersFromDOM();
      }

      orderList.forEach(function(order) {
        var sn = order.order_sn || order.orderSn || '';
        if (!sn) return;
        if (!knownSet.has(sn)) {
          // Order baru!
          var newOrder = {
            orderSn: sn,
            buyerUsername: order.buyer_username || order.buyerUsername || 'Pembeli',
            totalAmount: order.total_amount || order.totalAmount || 0,
            items: getItemNames(order),
            detectedAt: new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})
          };
          newOrders.push(newOrder);
          known.push(sn);
        }
      });

      if (newOrders.length > 0) {
        saveKnownOrders(known);
        totalNewOrders += newOrders.length;
        recentNewOrders = newOrders.concat(recentNewOrders).slice(0, 10);

        // Notifikasi untuk setiap order baru
        newOrders.forEach(function(order) {
          // Suara
          playNotificationSound();

          // Toast popup
          showToast(order);

          // Desktop notification (browser)
          if (CONFIG.DESKTOP_NOTIF) {
            if (Notification && Notification.permission === 'granted') {
              new Notification('🛍️ Order Baru - ' + CONFIG.STORE_NAME, {
                body: order.buyerUsername + ' • ' + formatIDR(order.totalAmount),
                icon: 'https://cf.shopee.co.id/file/sg-11134004-7qvfm-lgahwbs7dbo0e0_tn',
                tag: order.orderSn
              });
            } else if (Notification && Notification.permission !== 'denied') {
              Notification.requestPermission();
            }
          }

          // WA Alert
          sendWAAlert(order);

          console.log('[Volla Notifier] 🆕 Order baru:', order.orderSn, order.buyerUsername, formatIDR(order.totalAmount));
        });

        // Update UI
        updatePanelUI();
        updateTabBadge();
      }
    });
  }

  function getItemNames(order) {
    try {
      var items = order.item_list || order.itemList || [];
      if (!items || items.length === 0) return null;
      var names = items.map(function(it) {
        return (it.item_name || it.itemName || '').split(' ').slice(0, 3).join(' ');
      });
      return names.slice(0, 2).join(', ') + (items.length > 2 ? ' +' + (items.length - 2) + ' lagi' : '');
    } catch(e) { return null; }
  }

  // ──────────────────────────────────────────────
  // 🖥️ UPDATE TAB TITLE (BADGE)
  // ──────────────────────────────────────────────
  function updateTabBadge() {
    if (!CONFIG.SHOW_TAB_BADGE) return;
    if (totalNewOrders > 0) {
      document.title = '(' + totalNewOrders + ' Baru!) ' + originalTitle;
    } else {
      document.title = originalTitle;
    }
  }

  // ──────────────────────────────────────────────
  // 🖼️ PANEL UI
  // ──────────────────────────────────────────────
  var panelEl = null;
  var isPanelCollapsed = false;
  var isPaused = false;

  function buildPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'volla-notifier-panel';
    panelEl.innerHTML =
      '<div id="volla-notifier-header">' +
        '<span id="volla-collapsed-icon">🛍️<span id="volla-collapsed-badge"></span></span>' +
        '<h3>🛍️ Order Monitor <span class="badge" id="volla-new-count">0</span></h3>' +
        '<button id="volla-notifier-toggle" title="Minimize">−</button>' +
      '</div>' +
      '<div id="volla-notifier-body">' +
        '<div id="volla-notifier-status">' +
          '<div class="volla-status-dot active" id="volla-status-dot"></div>' +
          '<span id="volla-status-text">Memantau order baru...</span>' +
        '</div>' +
        '<div id="volla-order-list">' +
          '<div class="volla-no-orders">Belum ada order baru terdeteksi</div>' +
        '</div>' +
        '<div id="volla-notifier-footer">' +
          '<button id="volla-btn-toggle-monitor">⏸ Pause</button>' +
          '<button id="volla-btn-clear">🗑 Clear</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(panelEl);

    // Toggle collapse
    document.getElementById('volla-notifier-header').addEventListener('click', function(e) {
      if (e.target.closest('#volla-notifier-toggle')) return;
      if (isPanelCollapsed) expandPanel();
    });

    document.getElementById('volla-notifier-toggle').addEventListener('click', function(e) {
      e.stopPropagation();
      collapsePanel();
    });

    document.getElementById('volla-btn-toggle-monitor').addEventListener('click', function() {
      isPaused = !isPaused;
      if (isPaused) {
        clearInterval(checkTimer);
        this.textContent = '▶ Resume';
        this.classList.add('paused');
        document.getElementById('volla-status-dot').className = 'volla-status-dot inactive';
        document.getElementById('volla-status-text').textContent = 'Monitor dijeda';
      } else {
        startMonitoring();
        this.textContent = '⏸ Pause';
        this.classList.remove('paused');
        document.getElementById('volla-status-dot').className = 'volla-status-dot active';
        document.getElementById('volla-status-text').textContent = 'Memantau order baru...';
      }
    });

    document.getElementById('volla-btn-clear').addEventListener('click', function() {
      recentNewOrders = [];
      totalNewOrders = 0;
      updatePanelUI();
      updateTabBadge();
    });

    initToastContainer();
  }

  function collapsePanel() {
    isPanelCollapsed = true;
    panelEl.classList.add('collapsed');
  }

  function expandPanel() {
    isPanelCollapsed = false;
    panelEl.classList.remove('collapsed');
    updatePanelUI();
  }

  function updatePanelUI() {
    if (!panelEl) return;

    // Update badge count di header
    var countEl = document.getElementById('volla-new-count');
    if (countEl) countEl.textContent = totalNewOrders;

    // Update collapsed badge
    var collapsedBadge = document.getElementById('volla-collapsed-badge');
    if (collapsedBadge) {
      if (totalNewOrders > 0) {
        collapsedBadge.style.display = 'block';
        collapsedBadge.textContent = totalNewOrders;
      } else {
        collapsedBadge.style.display = 'none';
      }
    }

    // Update order list
    var list = document.getElementById('volla-order-list');
    if (!list) return;

    if (recentNewOrders.length === 0) {
      list.innerHTML = '<div class="volla-no-orders">Belum ada order baru terdeteksi</div>';
      return;
    }

    var html = '';
    recentNewOrders.forEach(function(order) {
      var url = 'https://seller.shopee.co.id/portal/sale/all-orders?search_key=' + order.orderSn;
      html +=
        '<a href="' + url + '" target="_blank" class="volla-order-item new-order">' +
          '<div class="volla-order-no">📦 ' + order.orderSn + '</div>' +
          '<div class="volla-order-meta">' +
            '<span>' + order.buyerUsername + '</span>' +
            '<span class="volla-order-badge">' + order.detectedAt + '</span>' +
          '</div>' +
          '<div class="volla-order-meta" style="margin-top:3px;">' +
            '<span class="volla-order-amount">' + formatIDR(order.totalAmount) + '</span>' +
            (order.items ? '<span style="color:#aaa; font-size:10px;">' + order.items + '</span>' : '') +
          '</div>' +
        '</a>';
    });
    list.innerHTML = html;
  }

  // ──────────────────────────────────────────────
  // ⏱️ MULAI MONITORING
  // ──────────────────────────────────────────────
  function startMonitoring() {
    if (checkTimer) clearInterval(checkTimer);
    checkNewOrders(); // cek langsung pertama kali
    checkTimer = setInterval(checkNewOrders, CONFIG.CHECK_INTERVAL * 1000);
  }

  // ──────────────────────────────────────────────
  // 🚀 INIT
  // ──────────────────────────────────────────────
  function init() {
    // Minta izin notifikasi desktop
    if (CONFIG.DESKTOP_NOTIF && Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Bangun panel UI
    buildPanel();

    // Mulai pantau order
    startMonitoring();

    // Auto-refresh jika dikonfigurasi
    if (CONFIG.AUTO_REFRESH_MINUTES > 0) {
      setTimeout(function() {
        location.reload();
      }, CONFIG.AUTO_REFRESH_MINUTES * 60 * 1000);
    }

    // Juga pantau jika halaman navigation (SPA)
    var lastPath = location.pathname;
    setInterval(function() {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        // Re-inject panel jika hilang
        if (!document.getElementById('volla-notifier-panel')) {
          buildPanel();
          startMonitoring();
        }
      }
    }, 2000);

    console.log('[Volla Notifier] ✅ Order monitor aktif. Cek setiap', CONFIG.CHECK_INTERVAL, 'detik');
  }

  // Tunggu halaman siap
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

})();
