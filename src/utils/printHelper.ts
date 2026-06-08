// src/utils/printHelper.ts
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from './csvLoader';

/**
 * Prints a single order invoice (Nota Penjualan)
 */
export function printInvoice(customer: Customer, order: CustomerRow, settings?: any) {
  const storeName = settings?.storeName || 'Pearl Store';
  const storePhone = settings?.storePhone || '081234567890';
  const storeInstagram = settings?.storeInstagram || 'pearlstore';
  const accentColor = settings?.invoiceAccentColor || '#0f172a';
  const footerNote = settings?.invoiceFooterNote || 'Terima kasih atas kunjungan & kepercayaan Anda berbelanja di toko kami!';
  
  const win = window.open('', '_blank', 'width=600,height=800');
  if (!win) {
    alert('Pop-up terblokir! Mohon izinkan pop-up untuk mencetak nota.');
    return;
  }
  
  const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const orderDateStr = order.tanggalOrder || '—';
  
  // Clean values
  const qty = parseInt(order.qty || '1', 10) || 1;
  const rawPrice = order.totalBayar ? parseInt(order.totalBayar.replace(/\D/g, ''), 10) || 0 : 0;
  const unitPrice = qty > 0 ? Math.round(rawPrice / qty) : rawPrice;
  const amountStr = order.amount ? formatRupiah(parseInt(order.amount.replace(/\D/g, ''), 10)) : '—';
  const ongkirStr = order.ongkir ? formatRupiah(parseInt(order.ongkir.replace(/\D/g, ''), 10)) : '—';

  // Format row ID to professional invoice format (e.g. row-50 becomes INV-0050)
  const rawId = order.id || '';
  const numMatch = rawId.match(/\d+/);
  const displayInvoiceId = numMatch
    ? `INV-${numMatch[0].padStart(4, '0')}`
    : `INV-${rawId.toUpperCase()}`;
  
  win.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Nota Penjualan - ${customer.nama} - ${orderDateStr}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 105mm 148mm;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif !important; }
          html, body { width: 105mm; height: 148mm; margin: 0; padding: 0; background: white; overflow: hidden; }
          body { color: #0f172a; line-height: 1.4; display: flex; justify-content: center; align-items: center; }
          .invoice-card { width: 100mm; height: 143mm; background: #fff; padding: 16px; position: relative; }
          
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid ${accentColor}; margin-bottom: 12px; }
          .store-info { display: flex; flex-direction: column; gap: 2px; }
          .store-name { font-size: 16px; font-weight: 900; text-transform: uppercase; color: ${accentColor}; letter-spacing: 0.5px; }
          .store-contact { font-size: 9px; color: #475569; }
          .invoice-title-wrap { text-align: right; }
          .invoice-title { font-size: 14px; font-weight: 850; text-transform: uppercase; color: ${accentColor}; letter-spacing: 0.5px; }
          .invoice-number { font-size: 10px; color: #475569; font-family: monospace; font-weight: 700; margin-top: 2px; }
          
          /* Details Grid */
          .details-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
          .details-row { display: flex; justify-content: space-between; }
          .details-box { display: flex; flex-direction: column; gap: 2px; width: 48%; }
          .details-label { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
          .details-value { font-size: 10px; font-weight: 600; color: #1e293b; }
          .details-value.customer-name { font-size: 12px; font-weight: 800; color: #0f172a; }
          .details-value.address { font-size: 9px; font-weight: 400; line-height: 1.3; color: #334155; }
          
          /* Table */
          .table-wrap { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .table-wrap th { background: #f8fafc; color: #475569; font-size: 8px; font-weight: 700; text-transform: uppercase; text-align: left; padding: 6px; border-bottom: 2px solid ${accentColor}; }
          .table-wrap td { padding: 6px; font-size: 9.5px; border-bottom: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
          .table-wrap th.num, .table-wrap td.num { text-align: right; }
          .table-wrap td.product-desc { font-weight: 700; color: #0f172a; font-size: 10px; }
          .table-wrap td.product-meta { font-size: 8px; color: #475569; margin-top: 2px; line-height: 1.2; }
          
          /* Totals Section */
          .totals-container { display: flex; justify-content: flex-end; margin-bottom: 12px; }
          .totals-table { width: 180px; border-collapse: collapse; }
          .totals-table td { padding: 4px 6px; font-size: 9px; color: #475569; }
          .totals-table td.label { text-align: left; }
          .totals-table td.val { text-align: right; font-weight: 600; color: #0f172a; }
          .totals-table tr.grand-total td { font-size: 11px; font-weight: 800; color: ${accentColor}; border-top: 2px solid ${accentColor}; padding-top: 6px; }
          
          /* Signature and Terms block */
          .terms-signature-grid { display: flex; justify-content: space-between; margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          .terms-box { font-size: 7.5px; color: #64748b; line-height: 1.4; width: 60%; }
          .signature-box { text-align: center; width: 35%; font-size: 9px; color: #0f172a; display: flex; flex-direction: column; align-items: center; }
          .signature-title { color: #64748b; margin-bottom: 30px; font-size: 8px; }
          .signature-name { font-weight: 700; border-top: 1px solid #0f172a; width: 100px; padding-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

          /* Footer */
          .footer { position: absolute; bottom: 16px; left: 16px; right: 16px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 8px; color: #94a3b8; font-weight: 500; }
          
          @media print {
            body { padding: 0; overflow: hidden; }
            th { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-card">
          <!-- Header -->
          <div class="header">
            <div class="store-info">
              <div class="store-name">${storeName}</div>
              <div class="store-contact">WhatsApp: ${storePhone} ${storeInstagram ? ` · Instagram: @${storeInstagram}` : ''}</div>
            </div>
            <div class="invoice-title-wrap">
              <div class="invoice-title">Nota Penjualan</div>
              <div class="invoice-number">No. Invoice: ${displayInvoiceId}</div>
            </div>
          </div>
          
          <!-- Details -->
          <div class="details-grid">
            <div class="details-row">
              <div class="details-box">
                <div class="details-label">Penerima / Kirim Ke:</div>
                <div class="details-value customer-name">${customer.nama}</div>
                ${customer.wa ? `<div class="details-value">Telp: ${customer.wa}</div>` : ''}
              </div>
              <div class="details-box" style="text-align: right;">
                <div class="details-label">Tgl Order</div>
                <div class="details-value">${orderDateStr}</div>
              </div>
            </div>
            ${customer.alamat ? `<div class="details-value address">${customer.alamat}</div>` : ''}
            
            <div class="details-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0;">
              <div class="details-box">
                <div class="details-label">Kurir</div>
                <div class="details-value">${(order.kurir && !/^\\d+$/.test(order.kurir.trim().replace(/[\\s\\.\\,\\-]/g, ''))) ? order.kurir : 'JNE'} ${order.resi ? `<br/>Resi: ${order.resi}` : ''}</div>
              </div>
              <div class="details-box" style="text-align: right;">
                <div class="details-label">Metode Bayar</div>
                <div class="details-value">${order.paymentVia || '—'}</div>
              </div>
            </div>
          </div>
          
          <!-- Table -->
          <table class="table-wrap">
            <thead>
              <tr>
                <th>Deskripsi Produk</th>
                <th class="num" style="width: 80px;">Qty</th>
                <th class="num" style="width: 130px;">Harga Satuan</th>
                <th class="num" style="width: 130px;">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="product-desc">${order.jenis || 'Perhiasan Mutiara'}</div>
                  <div class="product-meta">
                    ${order.type ? `Mutiara: ${order.type}` : ''} 
                    ${order.size ? ` · Ukuran: ${order.size}mm` : ''} 
                    ${order.color ? ` · Warna: ${order.color}` : ''} 
                    ${order.shape ? ` · Bentuk: ${order.shape}` : ''}
                    ${order.grade ? ` · Grade: ${order.grade}` : ''}
                  </div>
                  ${order.keterangan ? `<div style="font-size: 8px; margin-top: 3px; color: #475569;">Ket: ${order.keterangan}</div>` : ''}
                </td>
                <td class="num">${qty}</td>
                <td class="num">${formatRupiah(unitPrice)}</td>
                <td class="num" style="font-weight: 700; color: #0f172a;">${formatRupiah(rawPrice)}</td>
              </tr>
            </tbody>
          </table>
          
          <!-- Totals -->
          <div class="totals-container">
            <table class="totals-table">
              <tr>
                <td class="label">Harga Barang</td>
                <td class="val">${amountStr !== '—' ? amountStr : formatRupiah(rawPrice)}</td>
              </tr>
              ${order.ongkir ? `
              <tr>
                <td class="label">Ongkos Kirim</td>
                <td class="val">${ongkirStr}</td>
              </tr>
              ` : ''}
              <tr class="grand-total">
                <td class="label">Total Pembayaran</td>
                <td class="val">${formatRupiah(rawPrice)}</td>
              </tr>
            </table>
          </div>
          
          <!-- Signature & Terms Grid -->
          <div class="terms-signature-grid">
            <div class="terms-box">
              <strong style="color: #0f172a;">Syarat &amp; Ketentuan Penjualan:</strong><br>
              1. Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan, kecuali terdapat cacat produksi atau perjanjian tertulis sebelumnya.<br>
              2. Nota ini adalah bukti transaksi penjualan yang sah dikeluarkan oleh pihak toko resmi.
            </div>
            <div class="signature-box">
              <span class="signature-title">Hormat Kami,</span>
              <span class="signature-name">${storeName}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div>${footerNote}</div>
            <div style="font-size: 7px; color: #cbd5e1; margin-top: 4px;">Dicetak otomatis pada ${todayStr}</div>
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

/**
 * Prints the entire purchase statement for a customer (Riwayat Transaksi)
 */
export function printCustomerStatement(customer: Customer, settings?: any) {
  const storeName = settings?.storeName || 'Pearl Store';
  const storePhone = settings?.storePhone || '081234567890';
  const storeInstagram = settings?.storeInstagram || 'pearlstore';
  
  const win = window.open('', '_blank', 'width=850,height=800');
  if (!win) {
    alert('Pop-up terblokir! Mohon izinkan pop-up untuk mencetak riwayat.');
    return;
  }
  
  const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const sortedOrders = customer.orders.slice().sort((a, b) => new Date(a.tanggalOrder).getTime() - new Date(b.tanggalOrder).getTime());
  
  win.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Riwayat Pembelian - ${customer.nama}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif !important; }
          body { color: #0f172a; padding: 40px; line-height: 1.5; background: #fff; }
          .report-wrap { max-width: 800px; margin: 0 auto; }
          
          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0f172a; margin-bottom: 24px; }
          .store-info { display: flex; flex-direction: column; gap: 4px; }
          .store-name { font-size: 22px; font-weight: 950; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .store-contact { font-size: 12px; color: #475569; }
          .report-title-wrap { text-align: right; }
          .report-title { font-size: 18px; font-weight: 850; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
          .report-subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
          
          /* Customer Info */
          .customer-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 24px; margin-bottom: 30px; display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
          .customer-details { display: flex; flex-direction: column; gap: 6px; }
          .customer-name { font-size: 15.5px; font-weight: 800; color: #0f172a; }
          .customer-contact { font-size: 12.5px; color: #334155; }
          .customer-address { font-size: 12px; color: #475569; line-height: 1.5; margin-top: 2px; }
          .summary-box { display: flex; flex-direction: column; justify-content: center; align-items: flex-end; border-left: 1px solid #e2e8f0; padding-left: 20px; }
          .summary-item { text-align: right; }
          .summary-label { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .summary-value { font-size: 18px; font-weight: 800; color: #10b981; margin-bottom: 8px; }
          
          /* Table */
          .table-wrap { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .table-wrap th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 12px 14px; border-bottom: 2px solid #0f172a; }
          .table-wrap td { padding: 12px 14px; font-size: 12.5px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          .table-wrap th.num, .table-wrap td.num { text-align: right; }
          .table-wrap tr:hover td { background: #f8fafc; }
          .badge { font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; }
          .badge-completed { background: #d1fae5; color: #065f46; }
          .badge-pending { background: #fef3c7; color: #92400e; }
          .badge-shipped { background: #dbeafe; color: #1e40af; }
          .badge-returned { background: #fee2e2; color: #991b1b; }

          /* Signature block */
          .report-signature-container { display: flex; justify-content: flex-end; margin-top: 40px; }
          .signature-box { text-align: center; width: 200px; font-size: 12.5px; color: #0f172a; }
          .signature-title { color: #64748b; margin-bottom: 60px; display: block; }
          .signature-name { font-weight: 700; border-top: 1px solid #0f172a; width: 160px; padding-top: 6px; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; }

          /* Footer */
          .footer { text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 40px; }
          
          @media print {
            body { padding: 0; }
            th { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .customer-card { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="report-wrap">
          <!-- Header -->
          <div class="header">
            <div class="store-info">
              <div class="store-name">${storeName}</div>
              <div class="store-contact">WhatsApp: ${storePhone} ${storeInstagram ? ` · Instagram: @${storeInstagram}` : ''}</div>
            </div>
            <div class="report-title-wrap">
              <div class="report-title">Riwayat Transaksi Customer</div>
              <div class="report-subtitle">Laporan Pembelian Lengkap</div>
            </div>
          </div>
          
          <!-- Customer Profile Card -->
          <div class="customer-card">
            <div class="customer-details">
              <div class="customer-name">${customer.nama}</div>
              ${customer.wa ? `<div class="customer-contact">WhatsApp: ${customer.wa}</div>` : ''}
              ${customer.instagram ? `<div class="customer-contact">Instagram: @${customer.instagram}</div>` : ''}
              ${customer.alamat ? `<div class="customer-address">Alamat:<br>${customer.alamat}</div>` : ''}
            </div>
            <div class="summary-box">
              <div class="summary-item">
                <div class="summary-label">Total Pembelian</div>
                <div class="summary-value">${formatRupiah(customer.totalSpend)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Jumlah Order</div>
                <div class="summary-value" style="color: #0f172a; font-size: 15px;">${customer.orderCount} Transaksi</div>
              </div>
            </div>
          </div>
          
          <!-- Table -->
          <table class="table-wrap">
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 100px;">Tanggal</th>
                <th style="width: 110px;">No. Invoice</th>
                <th>Item / Detail Produk</th>
                <th style="width: 60px; text-align: center;">Qty</th>
                <th style="width: 110px;">Kurir / Resi</th>
                <th style="width: 80px; text-align: center;">Status</th>
                <th class="num" style="width: 120px;">Total Bayar</th>
              </tr>
            </thead>
            <tbody>
              ${sortedOrders.map((o, index) => {
                let badgeClass = 'badge-completed';
                let statusText = 'Selesai';
                if (o.orderStatus === 'pending') {
                  badgeClass = 'badge-pending';
                  statusText = 'Pending';
                } else if (o.orderStatus === 'dikirim') {
                  badgeClass = 'badge-shipped';
                  statusText = 'Dikirim';
                } else if (o.orderStatus === 'retur') {
                  badgeClass = 'badge-returned';
                  statusText = 'Retur';
                }
                const formattedPrice = o.totalBayar ? formatRupiah(parseInt(o.totalBayar.replace(/\D/g,''), 10)) : '—';
                
                const rawOrderId = o.id || '';
                const oNumMatch = rawOrderId.match(/\d+/);
                const oDisplayInvoiceId = oNumMatch
                  ? `INV-${oNumMatch[0].padStart(4, '0')}`
                  : `INV-${rawOrderId.toUpperCase()}`;

                return `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${o.tanggalOrder || '—'}</td>
                    <td style="font-family: monospace; font-weight: 700; font-size: 11.5px; color: #0f172a;">${oDisplayInvoiceId}</td>
                    <td>
                      <strong>${o.jenis || 'Perhiasan'}</strong>
                      ${o.type ? `<br><span style="color: #475569; font-size: 11px;">${o.type} ${o.size ? `· ${o.size}mm` : ''} ${o.color ? `· ${o.color}` : ''}</span>` : ''}
                      ${o.keterangan ? `<br><span style="color: #64748b; font-size: 11px; font-style: italic;">Ket: ${o.keterangan}</span>` : ''}
                    </td>
                    <td style="text-align: center;">${o.qty || '1'}</td>
                    <td>${o.kurir || '—'}${o.resi ? `<br><span style="font-family: monospace; font-size: 11px; font-weight: 600;">${o.resi}</span>` : ''}</td>
                    <td style="text-align: center;"><span class="badge ${badgeClass}">${statusText}</span></td>
                    <td class="num" style="font-weight: 700; color: #0f172a;">${formattedPrice}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Signature Box -->
          <div class="report-signature-container">
            <div class="signature-box">
              <span class="signature-title">Hormat Kami,</span>
              <span class="signature-name">${storeName}</span>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div>Laporan ini dihasilkan secara otomatis oleh sistem ${storeName}.</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 8px;">Dicetak pada ${todayStr}</div>
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}
