import type { Customer } from '../types';

export interface ParsedCustomerData {
  nama: string;
  wa: string;
  alamat: string;
  instagram: string;
  orderItem: string;
  ringSize: string;
  keterangan: string;
}

export function parseMagicPaste(text: string): ParsedCustomerData {
  // A simulated NLP parser using regex and heuristics
  const data: ParsedCustomerData = {
    nama: '',
    wa: '',
    alamat: '',
    instagram: '',
    orderItem: '',
    ringSize: '',
    keterangan: ''
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Simulated entity extraction
  lines.forEach(line => {
    const lower = line.toLowerCase();
    if (lower.includes('nama') || lower.includes('penerima')) {
      data.nama = line.split(/[:=]/)[1]?.trim() || line;
    } else if (lower.includes('alamat') || lower.includes('kirim ke')) {
      data.alamat = line.split(/[:=]/)[1]?.trim() || line;
    } else if (lower.includes('hp') || lower.includes('wa') || lower.includes('telepon')) {
      data.wa = line.split(/[:=]/)[1]?.trim().replace(/\D/g, '') || line.replace(/\D/g, '');
    } else if (lower.includes('ig') || lower.includes('instagram')) {
      data.instagram = line.split(/[:=]/)[1]?.trim().replace('@', '') || line;
    } else if (lower.includes('pesanan') || lower.includes('order') || lower.includes('item')) {
      data.orderItem = line.split(/[:=]/)[1]?.trim() || line;
    } else if (lower.includes('ukuran') || lower.includes('size')) {
      data.ringSize = line.split(/[:=]/)[1]?.trim() || line;
    } else {
      // Append to keterangan if it looks like a note
      if (line.length > 10 && !data.keterangan && !line.includes(':')) {
        data.keterangan = line;
      }
    }
  });

  return data;
}

export interface ProductRecommendation {
  product: string;
  confidence: number;
  reason: string;
}

export function generateUpsellRecommendations(customer: Customer): ProductRecommendation[] {
  // Analyze purchase history to suggest products
  const recs: ProductRecommendation[] = [];
  
  const hasNecklace = customer.orders.some(o => o.jenis.toLowerCase().includes('kalung'));
  const hasRing = customer.orders.some(o => o.jenis.toLowerCase().includes('cincin'));
  const hasEarrings = customer.orders.some(o => o.jenis.toLowerCase().includes('anting'));

  if (hasNecklace && !hasEarrings) {
    recs.push({
      product: 'Anting Mutiara Senada',
      confidence: 85,
      reason: 'Pelanggan membeli kalung mutiara sebelumnya. Anting adalah pelengkap yang sempurna.'
    });
  }
  if (hasRing) {
    recs.push({
      product: 'Gelang Mutiara',
      confidence: 70,
      reason: 'Pembeli cincin sering melengkapi koleksinya dengan gelang.'
    });
  }
  
  if (recs.length === 0) {
    recs.push({
      product: 'Bros Mutiara Eksklusif',
      confidence: 60,
      reason: 'Bros adalah produk netral yang cocok ditawarkan sebagai hadiah.'
    });
  }

  return recs;
}

export interface AIResponse {
  answer: string;
  suggestedActions?: string[];
}

export function askPearlAI(query: string, customers: Customer[]): AIResponse {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('tertinggi') || lowerQuery.includes('vip') || lowerQuery.includes('terbanyak')) {
    const sorted = [...customers].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);
    const names = sorted.map((c, i) => `${i+1}. ${c.nama} (Rp ${c.totalSpend.toLocaleString('id-ID')})`).join('\n');
    return {
      answer: `Tentu! Berikut adalah 5 pelanggan VIP dengan total belanja tertinggi:\n\n${names}`,
      suggestedActions: ['Kirim pesan WA ke Top 5 pelanggan']
    };
  }

  if (lowerQuery.includes('total pelanggan') || lowerQuery.includes('berapa pelanggan')) {
    return {
      answer: `Saat ini kita memiliki total **${customers.length}** pelanggan setia di database CRM.`,
    };
  }

  return {
    answer: "Maaf, Pearl AI (Simulasi) saat ini hanya bisa menjawab pertanyaan dasar seperti 'Siapa pelanggan tertinggi?' atau 'Berapa total pelanggan?'. Untuk analitik penuh, silakan hubungkan API Key OpenAI Anda di masa mendatang.",
  };
}

export function generateSmartCopy(context: string, tone: 'casual' | 'formal' | 'empathic'): string {
  const templates = {
    casual: `Halo Kak! ✨\n\nWah, nggak kerasa udah mau {context} nih. Semoga harinya menyenangkan ya! Oh iya, kalau butuh perhiasan baru buat nemenin acara Kakak, langsung kabari kita aja. 😍\n\nHave a great day!`,
    formal: `Selamat siang,\n\nKami dari Pearl Store ingin menyampaikan ucapan selamat atas {context} Anda. Kami berharap yang terbaik untuk Anda.\n\nJika ada kebutuhan perhiasan khusus, silakan hubungi kami.\n\nSalam hangat,\nPearl Store`,
    empathic: `Halo Kak, apa kabar? 💖\n\nSemoga Kakak sehat dan bahagia selalu ya. Mengingat sebentar lagi {context}, kami cuma mau menyapa dan berterima kasih karena Kakak selalu jadi pelanggan istimewa kami. ✨\n\nJaga kesehatan selalu ya Kak!`
  };
  
  return templates[tone].replace('{context}', context);
}
