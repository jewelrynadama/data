import { useRef, useState } from 'react';
import type { CustomerRow } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Award, Loader2 } from 'lucide-react';

interface Props {
  order: CustomerRow;
}

export default function CertificateGenerator({ order }: Props) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    if (!certificateRef.current) return;
    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2, // High resolution
        useCORS: true, // Allow external images
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
      });
      
      // A5 Landscape dimensions: 210 x 148 mm
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 148);
      
      const fileName = `Sertifikat_${order.namaInstagram}_${order.serialNumber || order.id.slice(0, 8)}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Gagal membuat Sertifikat PDF. Silakan coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <button 
        className="btn btn-secondary" 
        style={{ padding: '4px 8px', fontSize: 11, background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#f8fafc', border: '1px solid #334155' }}
        onClick={generatePDF}
        disabled={isGenerating}
        title="Download Sertifikat"
      >
        {isGenerating ? <Loader2 size={13} className="lucide-spin" /> : <Award size={13} />} Sertifikat
      </button>

      {/* Hidden Certificate Container for HTML2Canvas */}
      <div style={{ position: 'absolute', top: -9999, left: -9999, pointerEvents: 'none' }}>
        <div 
          ref={certificateRef}
          style={{
            width: '793.7px', // A5 landscape width at 96 DPI
            height: '559.3px', // A5 landscape height at 96 DPI
            background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
            border: '2px solid #0f172a',
            padding: '30px',
            boxSizing: 'border-box',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            color: '#1e293b',
          }}
        >
          {/* Decorative Border */}
          <div style={{
            position: 'absolute',
            top: 15, left: 15, right: 15, bottom: 15,
            border: '1px solid #cbd5e1',
            pointerEvents: 'none'
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 10 }}>
            <h1 style={{ fontSize: 32, margin: 0, fontWeight: 800, letterSpacing: '2px', color: '#0f172a', textTransform: 'uppercase' }}>Certificate of Authenticity</h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b', fontStyle: 'italic' }}>
              We hereby guarantee that this item is an authentic Pearl CRM Jewelry product, crafted with the finest materials.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 30, marginTop: 30, position: 'relative', zIndex: 1 }}>
            {/* Left: Product Image */}
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '100%', 
                height: 220, 
                backgroundColor: '#ffffff', 
                border: '1px solid #e2e8f0', 
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                {order.gambar ? (
                  <img src={order.gambar} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                ) : (
                  <span style={{ color: '#cbd5e1', fontSize: 40 }}>💎</span>
                )}
              </div>
              
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Serial Number</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '2px' }}>
                  {order.serialNumber || `SN-${order.id.slice(0, 8).toUpperCase()}`}
                </div>
              </div>
            </div>

            {/* Right: Details */}
            <div style={{ width: '60%' }}>
              <h2 style={{ fontSize: 24, margin: '0 0 20px', fontWeight: 700 }}>{order.type || 'Authentic Jewelry'}</h2>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {[
                    { label: 'Item Code', value: order.kode },
                    { label: 'Metal / Setting', value: `${order.rangka || '-'} (${order.gramasiRangka || '-'})` },
                    { label: 'Pearl Grade', value: order.grade || '-' },
                    { label: 'Pearl Color', value: order.color || '-' },
                    { label: 'Pearl Shape', value: order.shape || '-' },
                    { label: 'Weight / Size', value: `${order.weight || '-'} / ${order.size || '-'}` },
                    { label: 'Stone', value: `${order.stone || '-'} (${order.stoneWeight || '-'})` },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 0', color: '#64748b', width: '40%' }}>{row.label}</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#334155' }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 20, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: '#94a3b8' }}>Issued To:</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{order.namaInstagram}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>Date: {order.tanggalOrder}</div>
                </div>
                
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 100, borderBottom: '1px solid #1e293b', marginBottom: 5 }}></div>
                  <div style={{ fontSize: 10, fontWeight: 600 }}>Authorized Signature</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Watermark / Logo Text */}
          <div style={{ position: 'absolute', bottom: 20, right: 30, fontSize: 24, fontWeight: 900, color: 'rgba(0,0,0,0.03)' }}>
            pearlCRM
          </div>
        </div>
      </div>
    </>
  );
}
