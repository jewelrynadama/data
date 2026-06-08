# 🛍️ Panduan Instalasi — Shopee Order Notifier
## untuk Volla Pearl Seller Center

---

## ✅ Apa yang Dilakukan Script Ini?

Script **Tampermonkey** ini berjalan di browser kamu saat membuka **Shopee Seller Center**. Setiap X detik (default: 30 detik), script akan mengecek apakah ada order baru masuk. Jika ada:

| Fitur | Keterangan |
|-------|------------|
| 🔔 **Suara Ding** | Bunyi notifikasi tiga nada saat ada order baru |
| 🍞 **Toast Popup** | Popup indah di pojok kanan atas berisi detail order |
| 🖥️ **Desktop Notif** | Notifikasi browser (seperti notif WhatsApp Web) |
| 📲 **WA Alert** | Kirim pesan WA ke nomormu via Fonnte |
| 🔴 **Badge Tab** | Judul tab browser berubah jadi `(2 Baru!) Shopee` |
| 📋 **Panel Monitor** | Panel kecil di pojok kiri bawah, berisi daftar order baru |

---

## 📦 Langkah Instalasi

### Step 1 — Install Tampermonkey Extension

Pilih browser kamu:
- **Chrome**: [Install Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Install Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- **Edge**: [Install Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

---

### Step 2 — Install Script

1. Klik ikon **Tampermonkey** di toolbar browser
2. Klik **"Create new script"** (atau **"New script"**)
3. **Hapus semua kode default** di editor
4. **Copy-paste seluruh isi** file `shopee-order-notifier.user.js`
5. Klik **File → Save** (atau Ctrl+S)
6. Script otomatis aktif ✅

---

### Step 3 — Konfigurasi (Opsional)

Buka script di Tampermonkey Editor, cari bagian `CONFIG`:

```javascript
var CONFIG = {
  CHECK_INTERVAL: 30,        // Cek order setiap 30 detik
  WA_ALERT_NUMBER: '',       // Isi nomor WA kamu: '6289618885066'
  FONNTE_TOKEN: '...',       // Token Fonnte (sudah diisi)
  SOUND_TYPE: 'ding',        // 'ding' | 'bell' | 'chime' | 'none'
  VOLUME: 0.85,              // Volume suara (0.0 - 1.0)
  DESKTOP_NOTIF: true,       // Notifikasi desktop browser
  SHOW_TAB_BADGE: true,      // Badge di judul tab
  STORE_NAME: 'Volla Pearl', // Nama toko
};
```

**Untuk kirim WA alert:** Isi `WA_ALERT_NUMBER` dengan nomor WA kamu (format: `6289618885066`)

---

### Step 4 — Buka Shopee Seller Center

1. Buka: **https://seller.shopee.co.id/portal/sale/all-orders**
2. Login seperti biasa
3. Panel **🛍️ Order Monitor** akan muncul di pojok **kiri bawah**
4. Pertama kali, browser akan minta izin notifikasi — klik **"Allow"**

---

## 🖼️ Tampilan Panel

```
┌──────────────────────────────────┐
│ 🛍️ Order Monitor    [3]    [−] │  ← Header (bisa di-collapse)
├──────────────────────────────────┤
│ 🟢 Memantau order baru...        │
├──────────────────────────────────┤
│ 📦 250125XXXXXXX                 │
│ BuyerName123         [14:32]     │
│ Rp285.000    Anting Mutiara...   │
├──────────────────────────────────┤
│ [⏸ Pause]        [🗑 Clear]     │
└──────────────────────────────────┘
```

**Panel bisa di-minimize** (jadi lingkaran kecil) dengan klik tombol **−** di pojok kanan header.

---

## 🔔 Toast Popup (Kanan Atas)

Saat ada order baru, muncul popup seperti ini:

```
┌──────────────────────────────────┐
│ 🛍️ Order Baru Masuk!        [✕] │
│ BuyerName123                     │
│ 250125XXXXXXX                    │
│ Rp285.000                        │
│ 📦 Anting Mutiara Akatsuki       │
│ [Lihat Order]    [Tutup]         │
└──────────────────────────────────┘
```

Popup otomatis hilang setelah **15 detik**.

---

## ❓ FAQ

**Q: Script tidak jalan / panel tidak muncul?**  
A: Pastikan Tampermonkey sudah aktif (ikon berwarna, bukan abu-abu). Coba refresh halaman.

**Q: Kenapa tidak ada suara?**  
A: Browser perlu ada interaksi dulu (klik apapun di halaman) sebelum bisa memutar audio. Ini batasan browser modern.

**Q: WA Alert tidak terkirim?**  
A: Pastikan nomor WA diisi dengan format `628xxx` (bukan `08xxx`). Cek juga token Fonnte masih valid.

**Q: Apakah aman digunakan?**  
A: Script hanya berjalan di browser kamu dan tidak mengirim data ke server manapun selain Fonnte (untuk WA alert). Token Fonnte adalah milikmu sendiri.

**Q: Bagaimana cara pause monitoring?**  
A: Klik tombol **⏸ Pause** di panel. Klik **▶ Resume** untuk melanjutkan.

---

## 📝 Changelog

| Versi | Perubahan |
|-------|-----------|
| 2.0.0 | Toast popup, WA alert, panel collapsible, suara 3 tipe |
| 1.0.0 | Versi awal |

---

> **Dibuat untuk Volla Pearl** | Script berjalan 100% di browser lokal kamu.
