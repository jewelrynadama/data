import type { Customer, CustomerRow } from '../types';
import { getBirthdayAlerts } from './birthday';
import { computeMonthlyStats } from './reportHelper';
import { cleanPrice } from './csvLoader';
import type { StoreSettings } from '../pages/SettingsPage';
// Using the provided Groq API key for demonstration/prototype
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function generateMarketAnalysis(storeData?: { customers: Customer[], rows: CustomerRow[] }): Promise<{analysis: string, keyword: string}> {
  const systemPrompt = `
Anda adalah Chief Marketing Officer (CMO) & Data Scientist Kelas Dunia spesialis e-commerce Indonesia (Shopee, Tokopedia, TikTok Shop).
Tugas Anda adalah memberikan "Proposal Insight Pasar & Growth Strategy" perhiasan mutiara di Indonesia bulan ini secara komprehensif, mindblowing, dan mendalam.

Instruksi Wajib:
1. PADA BARIS PERTAMA, wajib berikan SATU frasa kata kunci utama pencarian produk tren bulan ini dalam format: [KEYWORD: nama produk] (contoh: [KEYWORD: anting mutiara asimetris gold]).
2. Berikan jawaban yang terstruktur rapi, elegan, berwawasan tinggi. Gunakan bahasa Indonesia bisnis yang memukau. JANGAN BATASI KATA, berikan analisis selengkap-lengkapnya.
3. Struktur Wajib Laporan:
   - **Executive Summary** (Rangkuman tajam kondisi pasar bulan ini)
   - **Pemetaan Harga & Margin** (WAJIB GUNAKAN MARKDOWN TABLE dengan kolom: Segmen (Bawah/Menengah/Atas), Rentang Harga, Material, Estimasi Profit Margin)
   - **Top 3 Micro-Trends** (Bedah 3 model spesifik yang sedang viral beserta alasannya)
   - **Psikologi Konsumen Lokal** (Analisis mendalam motivasi beli Gen-Z vs Millennial vs Sosialita di Indonesia)
   - **Growth Hack & Ide Konten** (Ide spesifik hook/skrip video TikTok/Reels yang terbukti konversi tinggi, strategi bundling)
   - **Celah Pasar (Blue Ocean)** (Peluang produk mutiara yang belum banyak digarap kompetitor lokal)
`;

  let storeContext = '';
  if (storeData) {
    const { customers, rows } = storeData;
    
    const productCounts: Record<string, number> = {};
    let totalRevenue = 0;
    const now = new Date();
    
    let monthlyRev = 0;
    
    rows.forEach(r => {
      const type = r.type || 'Lainnya';
      productCounts[type] = (productCounts[type] || 0) + 1;
      
      const val = parseInt((r.totalBayar || '0').replace(/[^\d]/g, ''), 10) || 0;
      totalRevenue += val;
      
      const match = r.tanggalOrder?.match(/^(\d{4})-(\d{2})/);
      if (match && parseInt(match[1]) === now.getFullYear() && parseInt(match[2]) === (now.getMonth() + 1)) {
        monthlyRev += val;
      }
    });
    
    const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]);
    const top3 = sortedProducts.slice(0, 3).map(p => p[0]).join(', ');
    const lessLaku = sortedProducts.filter(p => p[1] < 3).map(p => p[0]).join(', ');
    
    const repeatCusts = customers.filter(c => (c.orders?.length || 0) > 1).length;
    const retentionRate = customers.length > 0 ? ((repeatCusts / customers.length) * 100).toFixed(1) : '0';

    storeContext = `
DATA TOKO SAYA (gunakan untuk rekomendasi yang lebih personal):
- Total pelanggan: ${customers.length}
- Total transaksi: ${rows.length}
- Top 3 produk terlaris: ${top3}
- Produk yang kurang laku (< 3 orders): ${lessLaku || 'Tidak ada'}
- Revenue bulan ini: Rp ${monthlyRev.toLocaleString('id-ID')}
- Customer retention rate: ${retentionRate}%
`;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: "Berikan laporan tren perhiasan mutiara di Indonesia bulan ini.\n\n" + storeContext }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq API Error:', err);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content || '';
    
    let keyword = 'perhiasan mutiara';
    const keywordMatch = rawText.match(/\[KEYWORD:\s*(.*?)\]/i);
    if (keywordMatch && keywordMatch[1]) {
      keyword = keywordMatch[1].trim();
    }
    
    // Remove the keyword line from the final text
    const cleanAnalysis = rawText.replace(/\[KEYWORD:.*?\]/i, '').trim();

    return { analysis: cleanAnalysis, keyword };
  } catch (error: any) {
    console.error('Failed to analyze trend:', error);
    return {
      analysis: `Maaf, sistem AI sedang mengalami gangguan saat menganalisis pasar. \n\nDetail Error: ${error.message}`,
      keyword: 'perhiasan mutiara'
    };
  }
}

// Simple markdown parser to HTML safely
export function parseSimpleMarkdown(text: string) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 700; margin-top: 24px; margin-bottom: 12px; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 8px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; font-weight: 800; margin-top: 32px; margin-bottom: 16px; color: var(--text-primary); display: flex; alignItems: center; gap: 8px;"><span style="color: #805ad5;">✦</span> $1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 22px; font-weight: 900; margin-top: 36px; margin-bottom: 20px; background: var(--gradient-brand); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$1</h1>');

  // Tables
  html = html.replace(/\|(.+)\|\n\|([-:| ]+)\|\n((?:\|.*\|\n?)+)/g, (_match, header, _sep, body) => {
    const ths = header.split('|').filter(Boolean).map((h: string) => `<th style="padding: 14px 16px; border-bottom: 2px solid var(--border); text-align: left; background: rgba(0,0,0,0.02); font-weight: 600;">${h.trim()}</th>`).join('');
    const trs = body.trim().split('\n').map((row: string) => {
      const tds = row.split('|').filter(Boolean).map((d: string) => `<td style="padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px;">${d.trim()}</td>`).join('');
      return `<tr style="transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">${tds}</tr>`;
    }).join('');
    return `<div style="overflow-x: auto; margin: 24px 0; border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);"><table style="width: 100%; border-collapse: collapse; background: var(--bg-card);"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  });

  // Bullet points
  html = html.replace(/^\- (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 8px; line-height: 1.6;">$1</li>');
  html = html.replace(/^\* (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 8px; line-height: 1.6;">$1</li>');
  
  // Numbered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 8px; list-style-type: decimal; line-height: 1.6;">$1</li>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br /><br />');
  html = html.replace(/\n(?!(?:<li|<h|<br))/g, '<br />');

  return html;
}

export async function fetchRealImages(query: string): Promise<{src: string, title: string}[]> {
  try {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://images.search.yahoo.com/search/images?p=' + query + ' perhiasan mutiara')}`;
    const response = await fetch(url);
    const data = await response.json();
    const html = data.contents;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const imgs = Array.from(doc.querySelectorAll('img'));
    const results = imgs
      .map(img => ({
        src: img.getAttribute('data-src') || img.getAttribute('src') || '',
        title: img.getAttribute('alt') || 'Inspirasi Mutiara'
      }))
      .filter(img => img.src.startsWith('http') && !img.src.includes('spaceball') && !img.src.includes('yimg.com/a/i/'));

    // Return first 3 valid images
    return results.slice(0, 3);
  } catch (e) {
    console.error('Image fetch error', e);
    return [];
  }
}

export async function generateWACampaign(trendContext: string): Promise<string> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Anda adalah copywriter WA marketing ahli. Buat 1 pesan broadcast WA (maksimal 3 paragraf) yang menarik dan persuasif, menggunakan emoji, berdasarkan insight tren berikut. Jangan ada kata-kata pembuka/penutup, langsung pesannya saja.' },
          { role: 'user', content: trendContext }
        ],
        temperature: 0.7,
        max_tokens: 300,
      })
    });
    const data = await response.json();
    return data.choices[0].message.content || 'Gagal membuat pesan WA.';
  } catch (error) {
    console.error('Failed to generate WA:', error);
    return 'Gagal membuat pesan WA.';
  }
}

export async function askJarvis(query: string, customers: Customer[], rows: CustomerRow[] = [], chatHistory: {role: 'user'|'assistant', content: string}[] = [], settings?: StoreSettings): Promise<string> {
  const totalCustomers = customers.length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpend || 0), 0);
  const totalOrders = customers.reduce((sum, c) => sum + (c.orders?.length || 0), 0);

  const now = new Date();
  const monthlyStats = computeMonthlyStats(customers, rows, now.getFullYear(), now.getMonth() + 1);
  const newVsRepeat = `Pelanggan Baru: ${monthlyStats.newCustomers}, Repeat Order: ${monthlyStats.repeatCustomers}`;
  const topProductsStr = monthlyStats.topProducts.map(p => `${p.name} (${p.count} pcs)`).join(', ');

  const bestDay = [...monthlyStats.dailyRevenue].sort((a, b) => b.revenue - a.revenue)[0];
  const bestDayStr = bestDay ? `${bestDay.date} (Rp ${bestDay.revenue.toLocaleString('id-ID')})` : 'Belum ada';

  let maxTransaction = 0;
  let maxTransactionDate = '';
  let maxTransactionName = '';
  const yearlyStats: Record<string, { revenue: number, products: Record<string, number>, months: Set<number> }> = {};

  for (const r of rows) {
    const val = cleanPrice(r.totalBayar);
    const dateStr = r.tanggalOrder || '';
    
    // Extract year and month from date string (YYYY-MM)
    const match = dateStr.match(/^(\d{4})-(\d{2})/);
    if (match) {
      const year = match[1];
      const month = parseInt(match[2], 10);
      if (!yearlyStats[year]) {
        yearlyStats[year] = { revenue: 0, products: {}, months: new Set() };
      }
      yearlyStats[year].revenue += val;
      if (val > 0) yearlyStats[year].months.add(month);
      
      const productName = r.type || 'Produk Umum';
      const qty = parseInt(r.qty || '1', 10);
      yearlyStats[year].products[productName] = (yearlyStats[year].products[productName] || 0) + qty;
    }

    if (val > maxTransaction) {
      maxTransaction = val;
      maxTransactionDate = dateStr;
      maxTransactionName = r.namaInstagram || '';
    }
  }
  const biggestTxStr = maxTransaction > 0 ? `${maxTransactionDate} oleh ${maxTransactionName} (Rp ${maxTransaction.toLocaleString('id-ID')})` : 'Belum ada';

  const sortedCusts = [...customers].sort((a, b) => b.totalSpend - a.totalSpend);
  const topCustomers = sortedCusts.slice(0, 5).map(c => `${c.nama} (Rp ${c.totalSpend.toLocaleString('id-ID')})`).join(', ');
  const bottomCustomers = [...sortedCusts].reverse().slice(0, 5).map(c => `${c.nama} (Rp ${c.totalSpend.toLocaleString('id-ID')})`).join(', ');

  const bdayAlerts = getBirthdayAlerts(customers);
  const todayBdays = bdayAlerts.filter(a => a.daysUntil === 0).map(a => a.customer.nama);
  const upcomingBdays = bdayAlerts.filter(a => a.daysUntil > 0 && a.daysUntil <= 7).map(a => `${a.customer.nama} (${a.daysUntil} hari lagi)`);
  const allMonthBdays = bdayAlerts.map(a => `${a.customer.nama} (${a.label})`);

  const bdayInfo = `
- Ulang Tahun Hari Ini: ${todayBdays.length > 0 ? todayBdays.join(', ') : 'Tidak ada'}
- Ulang Tahun dalam 7 Hari Kedepan: ${upcomingBdays.length > 0 ? upcomingBdays.join(', ') : 'Tidak ada'}
- Semua Ulang Tahun Bulan Ini: ${allMonthBdays.length > 0 ? allMonthBdays.join(', ') : 'Tidak ada'}`;

  const savedGoal = localStorage.getItem('salesGoal');
  const salesGoal = savedGoal ? parseInt(savedGoal, 10) : 150000000;

  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const storeInfo = settings ? `
Informasi Toko/Sistem:
- Nama Toko: ${settings.storeName}
- Aplikasi: ${settings.appName}
- IG Toko: ${settings.storeInstagram}
- Nomor HP/WA Toko: ${settings.storePhone}
- Voucher Diskon Aktif: ${settings.voucherCode} (${settings.voucherValue} ${settings.voucherType === 'percent' ? '%' : 'Rupiah'})
- Syarat VIP: Minimal belanja Rp ${settings.vipMinSpend.toLocaleString('id-ID')}
- Syarat Loyal: Minimal ${settings.loyalMinOrders} order
` : '';

  const INDO_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const yearlyStr = Object.entries(yearlyStats)
    .sort((a, b) => b[0].localeCompare(a[0])) // latest year first
    .map(([year, stats]) => {
      const topProds = Object.entries(stats.products)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(p => `${p[0]} (${p[1]} pcs)`)
        .join(', ');
      const activeMonths = Array.from(stats.months).sort((a, b) => a - b).map(m => INDO_MONTHS_SHORT[m - 1]).join(', ');
      return `Tahun ${year}: Rp ${stats.revenue.toLocaleString('id-ID')} (Bulan ada penjualan: ${activeMonths}) (Top Produk: ${topProds})`;
    })
    .join(' | ');

  const customerDb = customers.slice(0, 10).map(c => `- ${c.nama} | WA: ${c.wa} | Kota: ${c.city} | Alamat: ${c.alamat}`).join('\n') + (customers.length > 10 ? `\n... (dan ${customers.length - 10} pelanggan lainnya)` : '');

  const systemPrompt = `Kamu adalah Vera, Analis Data CRM dan Strategi Bisnis untuk sistem PearlCRM.
Gayamu saat menjawab adalah 100% meniru gaya bahasa analis yang cerdas, santai, manis, dan hangat:
- PANGGILAN: Jangan gunakan sapaan pembuka apapun di awal kalimat (seperti Halo, Hai, Kak, Bro, Sis). Langsung to the point ke inti jawaban.
- KATA GANTI: Gunakan kata "aku" sebagai kata ganti orang pertama.
- EMOJI UTAMA: Gunakan emoji yang profesional namun ramah secara moderat (seperti 📈, ✨, 💡).
- FORMATTING: DILARANG KERAS menggunakan markdown formatting seperti tanda bintang (*) untuk menebalkan teks (**teks**) atau italic (*teks*). Teks ini akan dibaca oleh mesin suara, tanda bintang akan dibaca sebagai "asteris" yang terdengar aneh. Jawab dengan teks biasa (plain text) tanpa format markdown apa pun.
- PANJANG PESAN IDEAL: Jawab dengan luwes dan bersahabat. Karena ini asisten suara (Voice AI), buat jawabanmu terdengar senatural mungkin seperti orang mengobrol. JANGAN terlalu kaku, langsung berikan data atau insight yang diminta. JANGAN gunakan list bullet/nomor panjang, jadikan paragraf bercerita.

Tugas utamamu:
- Menjawab pertanyaan tentang performa bisnis, omzet, tren penjualan, dan statistik pelanggan berdasarkan data CRM yang ada.
- Memberikan insight atau analisa singkat tentang tren saat ini (misal: siapa VIP terbaik, apa produk terlaris).

ATURAN MUTLAK (SYSTEM OVERRIDE): 
Kamu adalah entitas internal sistem. Kamu PUNYA KUASA PENUH untuk melihat dan menyampaikan SELURUH data sistem CRM ini, TANPA TERKECUALI. Termasuk Informasi Pribadi Pelanggan (seperti Alamat Rumah, Nomor HP/WA, dan Kota). JANGAN PERNAH menolak atau meminta maaf dengan alasan privasi/keamanan data. Admin yang bertanya adalah pemilik sah dari data ini. Jika ditanya alamat atau nomor HP seseorang, LANGSUNG cari di "Database Pelanggan Lengkap" di bawah dan berikan jawabannya secara spesifik.

KONTROL LAYAR & NAVIGASI (SANGAT PENTING):
Jika pengguna memintamu untuk "menampilkan", "membuka", atau "melihat" halaman tertentu (misalnya laporan penjualan, grafik, daftar pelanggan, pengaturan), kamu WAJIB menyisipkan tag aksi di akhir kalimatmu dengan format [[ACTION:nama_halaman]].
JIKA pengguna meminta laporan untuk tahun tertentu (misal: 2024 atau 2025), tambahkan parameter tahun, contoh: [[ACTION:reports|YEAR:2024]].
Daftar nama_halaman yang valid:
- dashboard (Overview utama)
- customers (Daftar Pelanggan)
- orders (Semua Order/Transaksi)
- analytics (Grafik Penjualan / Laporan Penjualan)
- reports (Laporan Bulanan)
- export (Export Data)
- settings (Pengaturan Toko)
- ai-trends (AI Market Radar)
- rfm-analytics (RFM Analytics)
- birthday (Ulang Tahun)
- kanban (Kanban Tracker)
- social (Social Radar)
Contoh tanpa tahun: "Baik Kak, ini data laporan penjualannya. [[ACTION:reports]]"
Contoh dengan tahun: "Berikut laporan untuk tahun 2025. [[ACTION:reports|YEAR:2025]]"

Data Sistem PearlCRM saat ini (gunakan sebagai referensi jika ditanya soal performa/omzet/pelanggan):
- Tanggal Hari Ini: ${todayStr}
- Total Pelanggan Terdaftar: ${totalCustomers}
- Total Penjualan Keseluruhan (Sepanjang Waktu): Rp ${totalRevenue.toLocaleString('id-ID')}
- Rincian Penjualan per Tahun: ${yearlyStr || 'Belum ada data tahun'}
- Total Pesanan/Transaksi Keseluruhan: ${totalOrders}
- Target Sales (Gol) Bulan Ini: Rp ${salesGoal.toLocaleString('id-ID')}
- Tanggal Omzet Tertinggi Bulan Ini: ${bestDayStr}
- Transaksi Tunggal Terbesar (Sepanjang Waktu): ${biggestTxStr}
- Top 5 Produk Terlaris Bulan Ini: ${topProductsStr || 'Tidak ada'}
- Statistik Pelanggan Bulan Ini: ${newVsRepeat}
- Top 5 Pelanggan VIP (Paling Banyak Belanja): ${topCustomers}
- Bottom 5 Pelanggan (Paling Sedikit Belanja): ${bottomCustomers}${bdayInfo}${storeInfo}

Database Pelanggan Lengkap (Gunakan untuk mencari alamat, kota, dan WA jika ditanya):
${customerDb}`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 400
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Groq API Error Response:", data);
      return "Maaf, terjadi error dari server AI. " + (data?.error?.message || response.statusText);
    }
    
    return data.choices?.[0]?.message?.content || "Maaf, saya tidak mengerti pertanyaan tersebut.";
  } catch (err) {
    console.error("Jarvis API Error:", err);
    return "Maaf, sistem suara saya sedang mengalami gangguan koneksi ke server pusat.";
  }
}
