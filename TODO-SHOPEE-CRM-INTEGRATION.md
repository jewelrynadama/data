# 📋 TODO — Integrasi Shopee → CRM (Nanti kalau sudah mood 😄)

## Rencana:
1. **Update Tampermonkey** (`shopee-order-notifier.user.js`)
   - Tambah fungsi kirim data order baru ke Google Apps Script
   
2. **Update Apps Script** (`Apps Script.txt`)
   - Tambah endpoint baru: `doPost` route untuk terima order dari Shopee
   - Simpan ke sheet `DATA_PENJUALAN`

3. **CRM Order Inbox**
   - Order Shopee otomatis muncul di menu "Order Inbox"
   - Sudah ada Shopee di Payment Channels chart ✅

## Alur:
Shopee Seller Center → Tampermonkey → Apps Script → Google Sheets → CRM

## Catatan:
- Semua komponen sudah ada, tinggal disambung
- Estimasi pengerjaan: ~1-2 jam
