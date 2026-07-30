// src/pages/ExportPage.tsx
import { useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';
import type { Customer, CustomerRow } from '../types';
import { formatRupiah } from '../utils/csvLoader';
import { exportLocalStore, importLocalStore, readStore } from '../utils/localStore';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  onImportSuccess?: () => void;
}

export default function ExportPage({ customers, rows, onImportSuccess }: Props) {
  const [exported, setExported] = useState('');

  function downloadCSV(filename: string, csvContent: string) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExported(filename);
    setTimeout(() => setExported(''), 3000);
  }

  function exportCustomers() {
    const header = ['Name', 'Instagram', 'WhatsApp', 'City', 'Address', 'Birthday', 'Total Orders', 'Total Spend (IDR)', 'Last Order'];
    const csvRows = [header.join(',')];
    for (const c of customers) {
      csvRows.push([
        `"${c.nama}"`,
        `"${c.instagram}"`,
        `"${c.wa}"`,
        `"${c.city}"`,
        `"${c.alamat.replace(/"/g, '""')}"`,
        `"${c.tanggalUlangTahun}"`,
        c.orderCount,
        c.totalSpend,
        `"${c.lastOrder}"`,
      ].join(','));
    }
    downloadCSV('customers.csv', csvRows.join('\n'));
  }

  function exportOrders() {
    const orderRows = rows.filter((r) => r.jenis);
    const header = ['Customer', 'Order Date', 'Type', 'Pearl', 'Size', 'Color', 'Grade', 'Stone', 'Payment', 'Total (IDR)', 'Courier', 'Shipping Cost'];
    const csvRows = [header.join(',')];
    for (const r of orderRows) {
      csvRows.push([
        `"${r.namaInstagram || r.namaPengiriman}"`,
        `"${r.tanggalOrder}"`,
        `"${r.jenis}"`,
        `"${r.type}"`,
        `"${r.size}"`,
        `"${r.color}"`,
        `"${r.grade}"`,
        `"${r.stone}"`,
        `"${r.paymentVia}"`,
        r.totalBayar.replace(/\D/g, '') || '0',
        `"${r.kurir}"`,
        r.ongkir.replace(/\D/g, '') || '0',
      ].join(','));
    }
    downloadCSV('orders.csv', csvRows.join('\n'));
  }

  function exportNewOrders() {
    const s = readStore();
    const orderRows = s.newOrders;
    const header = ['Customer', 'Order Date', 'Type', 'Pearl', 'Size', 'Color', 'Grade', 'Stone', 'Payment', 'Total (IDR)', 'Courier', 'Shipping Cost'];
    const csvRows = [header.join(',')];
    for (const r of orderRows) {
      csvRows.push([
        `"${r.namaInstagram || r.namaPengiriman}"`,
        `"${r.tanggalOrder}"`,
        `"${r.jenis}"`,
        `"${r.type}"`,
        `"${r.size}"`,
        `"${r.color}"`,
        `"${r.grade}"`,
        `"${r.stone}"`,
        `"${r.paymentVia}"`,
        r.totalBayar.replace(/\D/g, '') || '0',
        `"${r.kurir}"`,
        r.ongkir.replace(/\D/g, '') || '0',
      ].join(','));
    }
    downloadCSV('new_orders_to_paste.csv', csvRows.join('\n'));
  }

  function exportSummary() {
    const orderRows = rows.filter((r) => r.jenis);
    const totalRev = customers.reduce((s, c) => s + c.totalSpend, 0);
    const lines = [
      '== PearlCRM Summary Report ==',
      `Generated: ${new Date().toLocaleString('id-ID')}`,
      '',
      '--- Overview ---',
      `Total Customers: ${customers.length}`,
      `Total Orders: ${orderRows.length}`,
      `Total Revenue: ${formatRupiah(totalRev)}`,
      `Avg Order Value: ${formatRupiah(orderRows.length > 0 ? totalRev / orderRows.length : 0)}`,
      '',
      '--- Top 5 Customers ---',
      ...customers
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 5)
        .map((c, i) => `${i + 1}. ${c.nama} — ${formatRupiah(c.totalSpend)} (${c.orderCount} orders)`),
      '',
      '--- Revenue by Pearl Type ---',
    ];
    const pearlRev: Record<string, number> = {};
    for (const r of orderRows) {
      if (r.type) {
        pearlRev[r.type] = (pearlRev[r.type] || 0) + parseInt(r.totalBayar.replace(/\D/g, '') || '0', 10);
      }
    }
    for (const [type, rev] of Object.entries(pearlRev).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${type}: ${formatRupiah(rev)}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary_report.txt';
    a.click();
    URL.revokeObjectURL(url);
    setExported('summary_report.txt');
    setTimeout(() => setExported(''), 3000);
  }

  const exports = [
    {
      id: 'new_orders',
      title: 'New Orders (For Spreadsheet)',
      desc: `Export only newly added orders that are not yet in the Spreadsheet. Use this to copy-paste.`,
      icon: '🆕',
      action: exportNewOrders,
      filename: 'new_orders_to_paste.csv',
    },
    {
      id: 'customers',
      title: 'Customer List',
      desc: `Export all ${customers.length} customers with contact info, city, total spend, and order count.`,
      icon: '👥',
      action: exportCustomers,
      filename: 'customers.csv',
    },
    {
      id: 'orders',
      title: 'All Orders',
      desc: `Export all ${rows.filter((r) => r.jenis).length} order records with pearl type, size, color, grade, payment, and price.`,
      icon: '📦',
      action: exportOrders,
      filename: 'orders.csv',
    },
    {
      id: 'summary',
      title: 'Summary Report',
      desc: 'Export a human-readable summary report with key metrics and top customers.',
      icon: '📊',
      action: exportSummary,
      filename: 'summary_report.txt',
    },
  ];

  function handleExportBackup() {
    exportLocalStore();
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importLocalStore(file);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal memulihkan backup');
    }
  }

  return (
    <div className="page-body">
      <div style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {exports.map((exp) => (
            <div key={exp.id} className="card" style={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 22px', flexWrap: 'wrap' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {exp.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {exp.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{exp.desc}</div>
                  {exported === exp.filename && (
                    <div style={{ fontSize: 12, color: 'var(--accent-green)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} /> Downloaded successfully!
                    </div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={exp.action}>
                  <Download size={14} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Backup & Restore Section */}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Migrasi Data (Pindah Laptop)</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
            Pindahkan data customer baru dan order manual yang tersimpan secara lokal ke laptop baru.
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {/* Backup Card */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  📥 Ekspor Backup (.json)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Unduh seluruh riwayat input customer baru dan order manual dari browser laptop ini.
                </div>
              </div>
              <button className="btn btn-secondary" onClick={handleExportBackup} style={{ width: '100%' }}>
                Ekspor File JSON
              </button>
            </div>

            {/* Restore Card */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  📤 Impor Backup (.json)
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Unggah file backup untuk memulihkan riwayat input manual di laptop baru.
                </div>
              </div>
              <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center', margin: 0, width: '100%', boxSizing: 'border-box' }}>
                Impor File JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 32,
          padding: '16px 20px',
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 'var(--border-radius)',
          fontSize: 12.5,
          color: 'var(--text-muted)',
        }}>
          💡 <strong style={{ color: 'var(--text-secondary)' }}>Tip:</strong> Data sheets utama di-load secara online dari Google Sheets. Ekspor/Impor di atas hanya diperlukan untuk memindahkan data lokal hasil input manual Anda.
        </div>
      </div>
    </div>
  );
}
