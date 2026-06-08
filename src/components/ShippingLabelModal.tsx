// src/components/ShippingLabelModal.tsx
import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';

interface Props {
  customer: Customer;
  order?: CustomerRow | null;
  onClose: () => void;
  settings?: any;
}

export default function ShippingLabelModal({ customer, order, onClose, settings }: Props) {
  const storeName = settings?.storeName || 'Pearl Store';
  const storePhone = settings?.storePhone || '081234567890';
  const labelFooterNote = settings?.labelFooterNote || '';
  const labelRef = useRef<HTMLDivElement>(null);

  const cityCaps = customer.city && customer.city !== '—'
    ? customer.city.trim().toUpperCase()
    : 'JAKARTA';
  
  const isNumericCourier = order?.kurir ? /^\d+$/.test(order.kurir.trim().replace(/[\s\.\,\-]/g, '')) : false;
  const courierName = order?.kurir && !isNumericCourier
    ? order.kurir.toUpperCase()
    : 'REGULER';

  function handlePrint() {
    const cardElement = labelRef.current;
    if (!cardElement) return;

    const clone = cardElement.cloneNode(true) as HTMLDivElement;
    // Remove the scale transform from preview
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'unset';

    const content = clone.outerHTML;
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak Resi Shopee - ${customer.nama}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 0;
            }
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
              font-family: 'Inter', Arial, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 105mm;
              height: auto;
              margin: 0;
              padding: 0;
              background: white;
            }
            body { 
              display: flex;
              justify-content: center;
              align-items: flex-start;
              overflow: visible;
            }
            .print-wrapper {
              width: 100mm;
              height: auto;
              background: white;
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${content}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() { window.print(); }, 250);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  // Fallback items if empty
  const dummyItems = [{ qty: 1, name: 'Cempaka - Anting Mutiara Asli', sku: 'Cempaka', variant: 'White', keterangan: '' }];
  let items = dummyItems;
  if (order && order.jenis) {
    items = [{
      qty: parseInt(order.qty) || 1,
      name: `${order.jenis || ''} - ${order.type || ''}`.trim(),
      sku: order.kode || '-',
      variant: order.color || '-',
      keterangan: order.keterangan || ''
    }];
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-panel" style={{ maxWidth: 800, width: '95vw', padding: 0, overflow: 'hidden', background: '#333', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Header Toolbar (Shopee Preview Header style) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: '#222', color: 'white'
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Preview Cetak</span>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>• Panjang label akan menyesuaikan otomatis.</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#ee4d2d', color: 'white', border: 'none', borderRadius: 4,
                padding: '8px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
              }}
            >
              <Printer size={16} /> Cetak Dokumen
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Label Preview Container */}
        <div style={{ padding: '30px', display: 'flex', justifyContent: 'center', overflowX: 'auto', background: '#333', minHeight: '60vh' }}>
          
          {/* Actual Print Element - Dimensions set strictly to A6 portrait equivalent at 96dpi (approx 396x559 px), but we use absolute mm dimensions for safety */}
          <div
            ref={labelRef}
            style={{
              width: '100mm',
              height: 'auto',
              background: 'white',
              position: 'relative',
              boxSizing: 'border-box',
              display: 'flex',
              padding: '0', /* Removed padding for outer resi */
              flexShrink: 0,
              transform: 'scale(1.2)', // Scale up just for preview
              transformOrigin: 'top center',
              margin: '0 auto'
            }}
          >

            {/* Main Content Box with thick border */}
            <div style={{ border: '2px solid black', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: 'black' }}>
              
              {/* Row 1: Logo & Reguler */}
              <div style={{ display: 'flex', borderBottom: '2px solid black', height: '42px' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                  <div style={{ width: 24, height: 24, background: '#ee4d2d', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>
                    {storeName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>{storeName}</span>
                </div>
                <div style={{ borderLeft: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', fontSize: 18, fontWeight: 800 }}>
                  {courierName}
                </div>
              </div>



              {/* Row 3: Penerima & Pengirim */}
              <div style={{ display: 'flex', borderBottom: '2px solid black', minHeight: '75px' }}>
                {/* Penerima */}
                <div style={{ flex: 1, padding: 6, borderRight: '2px solid black', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10 }}><b>Penerima: {customer.nama}</b></div>
                  {customer.wa && <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{customer.wa}</div>}
                  <div style={{ fontSize: 10, lineHeight: 1.2 }}>{customer.alamat}</div>
                </div>
                {/* Pengirim */}
                <div style={{ flex: 1, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10 }}><b>Pengirim: {storeName}</b></div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{storePhone}</div>
                  <div style={{ fontSize: 10, lineHeight: 1.2 }}>KAB. LOMBOK TIMUR, NUSA TENGGARA BAR.</div>
                </div>
              </div>

              {/* Row 4: Wilayah */}
              <div style={{ display: 'flex', borderBottom: '2px solid black', height: '24px' }}>
                <div style={{ flex: 1, borderRight: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                  KAB. {cityCaps}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                  {cityCaps}
                </div>
              </div>


              {/* Row 7: Products Table */}
              <div style={{ flex: 1, padding: '6px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid black' }}>
                      <th style={{ width: '20px', textAlign: 'center', padding: '2px 4px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '2px 4px' }}>Nama Produk</th>
                      <th style={{ width: '60px', textAlign: 'left', padding: '2px 4px' }}>SKU</th>
                      <th style={{ width: '60px', textAlign: 'left', padding: '2px 4px' }}>Variasi</th>
                      <th style={{ width: '30px', textAlign: 'center', padding: '2px 4px' }}>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', padding: '4px', verticalAlign: 'top' }}>{idx + 1}</td>
                        <td style={{ textAlign: 'left', padding: '4px', verticalAlign: 'top', fontWeight: 600 }}>
                          {it.name}
                          {it.keterangan && <div style={{ fontWeight: 400, marginTop: 2 }}>Pesan: ({it.keterangan})</div>}
                        </td>
                        <td style={{ textAlign: 'left', padding: '4px', verticalAlign: 'top' }}>{it.sku || '-'}</td>
                        <td style={{ textAlign: 'left', padding: '4px', verticalAlign: 'top' }}>{it.variant || '-'}</td>
                        <td style={{ textAlign: 'center', padding: '4px', verticalAlign: 'top' }}>{it.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Label Footer Note */}
              {labelFooterNote && (
                <div style={{ padding: '8px', borderTop: '2px solid black', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>
                  {labelFooterNote}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
