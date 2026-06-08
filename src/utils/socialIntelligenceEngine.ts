import type { Customer } from '../types';

export type SocialEventType = 'vacation' | 'achievement' | 'grieving' | 'birthday';

export interface SocialEvent {
  id: string;
  customer: Customer;
  type: SocialEventType;
  title: string;
  context: string;
  dateDetected: string;
  suggestedMessage: string;
  riskLevel: 'low' | 'medium' | 'high'; // high risk = grieving (exclude from promo)
}

const CACHE_KEY = 'pearlcrm_social_events_cache';

// Load persistent events from localStorage
export function getActiveSocialEvents(customers: Customer[], _storeName?: string): SocialEvent[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      const validEvents: SocialEvent[] = [];
      for (const item of parsedCache) {
        const c = customers.find(x => x.id === item.customerId);
        if (c) {
          validEvents.push({ ...item, customer: c });
        }
      }
      return validEvents;
    }
  } catch (e) {
    console.error('Failed to parse cached social events', e);
  }
  
  return [];
}

// Backward compatible scan hook
export function scanSocialFeeds(customers: Customer[], _storeName: string): SocialEvent[] {
  return getActiveSocialEvents(customers);
}

// Save events list to localStorage
export function saveEventsToStorage(events: SocialEvent[]): void {
  try {
    const toCache = events.map(e => ({
      id: e.id,
      customerId: e.customer.id,
      type: e.type,
      title: e.title,
      context: e.context,
      dateDetected: e.dateDetected,
      suggestedMessage: e.suggestedMessage,
      riskLevel: e.riskLevel
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch (e) {
    console.error('Failed to save social events to cache', e);
  }
}

// Generate new mock events (seeding)
export function seedSimulatedEvents(_customers: Customer[], _storeName: string): SocialEvent[] {
  return []; // Removed, using OSINT now
}

export async function performOSINTScan(customers: Customer[], storeName: string): Promise<SocialEvent[]> {
  if (customers.length === 0) return [];
  const events: SocialEvent[] = [];
  const now = new Date();
  
  // Pick random subset of customers (max 3 to avoid API timeout)
  const shuffled = [...customers].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);
  
  const GEMINI_API_KEY = 'AIzaSyCSZcpedBFcMzrO_Vzp_tB1lB0OKUp9N9U';

  for (let i = 0; i < selected.length; i++) {
    const c = selected[i];
    try {
      const igHandle = extractInstagramUsername(c.instagram);
      const prompt = `Anda adalah investigator intelijen digital. Cari informasi publik nyata di web tentang orang bernama "${c.nama}" (Domisili: ${c.city || 'Indonesia'}, Username IG: @${igHandle}).
Instruksi Wajib:
1. Google TIDAK BISA membaca postingan Instagram biasa. Anda hanya mengandalkan berita web, TikTok publik, atau artikel.
2. JANGAN menebak atau merangkum aktivitas artis/tokoh publik lain yang kebetulan memiliki nama yang sama dengan "${c.nama}".
3. Jika pencarian tidak menemukan artikel/jejak digital publik yang BENAR-BENAR COCOK 100% dengan profil di atas, Anda WAJIB menjawab persis dengan kalimat: "TIDAK DITEMUKAN".
4. Jika benar-benar menemukan kecocokan valid, rangkum aktivitas terbarunya dalam 1 kalimat singkat.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

      if (text.trim().length > 0 && !text.toUpperCase().includes('TIDAK DITEMUKAN') && !text.includes('maaf')) {
        events.push({
          id: `ev-${Date.now()}-${i}`,
          customer: c,
          type: 'achievement',
          title: `Sinyal Publik Web Terdeteksi (Google OSINT)`,
          context: `Hasil Pencarian Web AI: ${text.substring(0, 200)}...`,
          dateDetected: dateStr,
          suggestedMessage: `Halo Kak ${c.nama}! Saya tidak sengaja melihat kabar baik tentang Kakak. Semoga makin sukses terus ya! Salam dari ${storeName}. ✨`,
          riskLevel: 'low'
        });
      } else {
        // Fallback: AI Predictive Profiling
        const totalRp = c.totalSpend ? c.totalSpend.toLocaleString('id-ID') : '0';
        if (c.totalSpend > 5000000) {
           events.push({
            id: `ev-${Date.now()}-${i}`,
            customer: c,
            type: 'vacation',
            title: `Prediksi Pola Belanja AI (VIP Customer)`,
            context: `Analisis AI: Pelanggan sangat aktif berbelanja perhiasan (Total Belanja: Rp ${totalRp}). AI memprediksi pelanggan memiliki gaya hidup bersosialita tinggi atau sering liburan. Lakukan sapaan hangat.`,
            dateDetected: dateStr,
            suggestedMessage: `Halo Kak ${c.nama}! Lama tidak berjumpa, semoga Kakak dan keluarga sehat dan bahagia selalu ya. Jika sedang butuh perhiasan untuk momen liburan/pesta berikutnya, jangan ragu hubungi kami! 💖`,
            riskLevel: 'low'
          });
        }
      }
    } catch (e) {
      console.error('OSINT failed for', c.nama, e);
    }
  }

  return events;
}

// Log a new social event (either from Guided Surfer or UserScript)
export function logSocialEvent(
  customers: Customer[],
  customerId: string,
  type: SocialEventType,
  title: string,
  context: string,
  suggestedMessage: string,
  riskLevel: 'low' | 'medium' | 'high'
): SocialEvent | null {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const newEvent: SocialEvent = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    customer,
    type,
    title,
    context,
    dateDetected: dateStr,
    suggestedMessage,
    riskLevel
  };

  const currentEvents = getActiveSocialEvents(customers, 'Pearl Store');
  // Avoid duplicate events of the same type for the same customer within 24h
  const filtered = currentEvents.filter(e => !(e.customer.id === customerId && e.type === type));
  const updated = [newEvent, ...filtered];
  saveEventsToStorage(updated);
  return newEvent;
}

// Dismiss / Delete an event
export function dismissSocialEvent(eventId: string, customers: Customer[]): SocialEvent[] {
  const currentEvents = getActiveSocialEvents(customers, 'Pearl Store');
  const updated = currentEvents.filter(e => e.id !== eventId);
  saveEventsToStorage(updated);
  return updated;
}

export function extractInstagramUsername(igInput: string | undefined): string {
  if (!igInput) return '';
  let cleaned = igInput.trim();
  
  if (cleaned.includes('instagram.com/')) {
    const parts = cleaned.split('instagram.com/');
    if (parts.length > 1) {
      cleaned = parts[1].split('?')[0].split('/')[0];
    }
  }
  
  cleaned = cleaned.replace(/@/g, '').trim();
  return cleaned;
}

// Helper to generate Instagram profile URL
export function generateInstaLink(username: string | undefined, name: string): string {
  const extracted = extractInstagramUsername(username);
  if (extracted && extracted !== '' && extracted !== '-') {
    return `https://instagram.com/${extracted}`;
  }
  const guessed = name.toLowerCase().replace(/\s+/g, '').slice(0, 15);
  return `https://instagram.com/${guessed}`;
}

// Generate templates message based on event type
export function generateSuggestedMessage(customerName: string, type: SocialEventType, detail?: string, storeName: string = 'Pearl Store'): string {
  switch (type) {
    case 'vacation':
      const dest = detail || 'liburan';
      return `Halo Kak ${customerName}! Wah seru banget kayaknya liburan di ${dest} 😍. Enjoy the trip ya Kak, stay safe and have a blast! 💖`;
    case 'achievement':
      const ach = detail || 'pencapaian barunya';
      return `Halo Kak ${customerName}! Selamat ya atas ${ach}! 🎉 Semoga berkah dan makin sukses terus ke depannya. We are so happy for you! 🥰`;
    case 'birthday':
      return `Happy Birthday Kak ${customerName}! 🎂🎉 Semoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan kesayangan ${storeName}! ✨`;
    case 'grieving':
      const info = detail || 'keadaan kurang baik';
      return `Halo Kak ${customerName}. Mendengar kabar ${info}, kami dari ${storeName} turut mendoakan yang terbaik ya Kak. Semoga segera diberikan kesembuhan dan keadaan lekas membaik. 🙏✨`;
    default:
      return `Halo Kak ${customerName}, salam hangat dari ${storeName}! Semoga sehat selalu ya Kak. ✨`;
  }
}

