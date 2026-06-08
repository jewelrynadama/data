// src/utils/csvLoader.ts
import Papa from 'papaparse';
import type { CustomerRow, Customer, CatalogItem } from '../types';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2elLCDbnJsEuXpde2jZ-4Mj_1AghwCk6hJjxfD7ZQduWsfZjH02cJjr2afGrEvNo3T3ZUk1D-cUkH/pub?gid=0&single=true&output=csv';

function clean(v: string | undefined) {
  if (!v) return '';
  return v.replace(/#N\/A/gi, '').trim();
}

import { formatAddress } from './addressHelper';

function normalizeDate(v: string): string {
  if (!v) return '';
  const str = v.trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // If DD/MM/YYYY or D/M/YYYY
  const parts = str.split(/[/\-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return str;
}

function parseAmount(v: string): number {
  if (!v) return 0;
  const s = v.replace(/[^0-9]/g, '');
  return s ? parseInt(s, 10) : 0;
}

export function extractCity(address: string): string {
  if (!address) return '—';
  const lower = address.toLowerCase();
  const cities = [
    'jakarta', 'surabaya', 'bandung', 'medan', 'semarang', 'makassar',
    'palembang', 'yogyakarta', 'tangerang', 'depok', 'bogor', 'bekasi',
    'malang', 'denpasar', 'bali', 'sukabumi', 'batam', 'balikpapan',
    'samarinda', 'manado', 'padang', 'pekanbaru', 'solo', 'sidoarjo',
    'cirebon', 'tasikmalaya', 'serang', 'cilegon', 'karawang', 'purwakarta',
    'mataram', 'lombok barat', 'lombok tengah', 'lombok timur', 'lombok utara', 'lombok',
    'banyuwangi', 'jember', 'kediri', 'madiun', 'blitar', 'pasuruan', 'probolinggo',
    'gresik', 'mojokerto', 'kudus', 'pati', 'jepara', 'tegal', 'pekalongan', 'salatiga',
    'magelang', 'purwokerto', 'cilacap', 'kebumen', 'garut', 'cianjur', 'sumedang',
    'subang', 'majalengka', 'kuningan', 'ciamis', 'pangandaran', 'banjar',
    'bandar lampung', 'metro', 'bengkulu', 'jambi', 'pangkal pinang', 'tanjungpinang',
    'lhokseumawe', 'langsa', 'meulaboh', 'binjai', 'pematangsiantar', 'tebing tinggi',
    'padangsidimpuan', 'sibolga', 'bukittinggi', 'payakumbuh', 'solok', 'sawahlunto',
    'dumai', 'sungai penuh', 'lubuklinggau', 'prabumulih', 'pagar alam', 'baturaja',
    'tanatoraja', 'parepare', 'palopo', 'kendari', 'baubau', 'gorontalo',
    'palu', 'poso', 'bitung', 'tomohon', 'kotamobagu', 'ambon', 'ternate',
    'tidore', 'kupang', 'bima', 'sumbawa', 'ende', 'maumere', 'waingapu',
    'jayapura', 'sorong', 'merauke', 'mimika', 'manokwari', 'pontianak',
    'singkawang', 'banjarmasin', 'banjarbaru', 'martapura', 'palangkaraya',
    'bontang', 'tarakan', 'singaraja', 'tabanan', 'ubud', 'gianyar'
  ];

  for (const city of cities) {
    if (lower.includes(city)) {
      return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  // Look for keywords like "kabupaten", "kab.", or "kota"
  const kabKotaMatch = address.match(/(?:kabupaten|kab\.|kota)\s+([a-zA-Z\s]+?)(?:,|$|\s+kec|\s+kel)/i);
  if (kabKotaMatch && kabKotaMatch[1]) {
    const cityName = kabKotaMatch[1].trim();
    if (cityName.length > 2 && cityName.length < 25 && !/(?:gang|rt|rw|no|depan|dekat|sebelah)/i.test(cityName)) {
      return cityName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // Fallback: parse from comma-separated parts, skipping common street address terms
  const parts = address.split(',').map(p => p.trim());
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;
    if (/(?:jalan|jl|gang|rt|rw|no\.|spbu|toko|warung|depan|dekat|sebelah|alamat|penerima|delivery)/i.test(part)) {
      continue;
    }
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.length <= 4) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return '—';
}

function normalizeType(v: string): string {
  if (!v) return '';
  const t = v.toLowerCase().trim();
  // Single-letter codes
  const codeMap: Record<string, string> = {
    n: 'Necklace', p: 'Pendant', e: 'Earrings', b: 'Bracelet',
    r: 'Ring', br: 'Brooch', s: 'Jewelry Set', l: 'Loose',
  };
  if (codeMap[t]) return codeMap[t];
  // Full names + plurals/typos
  if (t.includes('necklace')) return 'Necklace';
  if (t.includes('pendant')) return 'Pendant';
  if (t.startsWith('earring')) return 'Earrings';   // earring / earrings
  if (t.includes('bracelet') || t === 'bangle') return 'Bracelet';
  if (t.includes('brooch') || t.includes('broch')) return 'Brooch';
  if (t.includes('ring')) return 'Ring';
  if (t.includes('jewelry set') || t.includes('jewellery set') || t.includes('set')) return 'Jewelry Set';
  if (t.includes('loose')) return 'Loose';
  return v.trim();
}

function normalizePearl(v: string): string {
  if (!v) return '';
  const t = v.toLowerCase().trim();
  // Canonical names (most specific first)
  if (t.includes('akoya') && t.includes('freshwater')) return 'Akoya Freshwater';
  if (t.includes('akoya') && (t.includes('seawater') || t.includes('sea water'))) return 'Akoya Seawater';
  if (t.includes('akoya') && t.includes('tahitian')) return 'Akoya & Tahitian';
  if (t.includes('akoya') && t.includes('southsea')) return 'Akoya & Southsea';
  if (t.includes('akoya') && t.includes('edison')) return 'Akoya & Edison';
  if (t.includes('akoya') && t.includes('southsea') && t.includes('edison')) return 'Akoya, Southsea & Edison';
  if (t.includes('akoya')) return 'Akoya Seawater';   // default akoya → seawater
  if (t.includes('tahitian') && (t.includes('seawater') || t.includes('sea water'))) return 'Tahitian Seawater';
  if (t.includes('tahitian')) return 'Tahitian Seawater';
  if (t.includes('southsea') || t.includes('south sea') || t === 's') return 'Southsea';
  if (t.includes('edison')) return 'Edison';
  if (t.includes('freshwater') || t === 'f' || t === 'fw') return 'Freshwater';
  if (t.includes('mix') || t.includes('campur')) return 'Mix Pearls';
  // title-case fallback
  return v.trim().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function normalizePayment(v: string): string {
  if (!v) return '';
  const t = v.toLowerCase().trim();
  if (!t || t === '-' || t === '—') return '';
  // Shopee variants
  if (t.includes('shopee')) return 'Shopee';
  // Tokopedia variants
  if (t.includes('tokopedia') || t.includes('tokped') || t.includes('toped')) return 'Tokopedia';
  // Transfer — catch typos: tranfer, trnsfer, ttanfer, trasnfer, tf, tr, tukar
  if (
    t.includes('transfer') ||
    t.includes('tranfer') ||
    t.includes('transf') ||
    t.includes('ttanfer') ||
    t.includes('trnsfer') ||
    t === 'tf' || t === 'tr'
  ) return 'Transfer';
  // Cash / Tukar / COD
  if (t === 'cash' || t === 'tunai') return 'Cash';
  if (t.includes('tukar') || t.includes('barter')) return 'Tukar';
  if (t.includes('retur') || t.includes('return') || t.includes('refund')) return 'Retur';
  if (t.includes('cod')) return 'COD';
  // Title-case anything else
  return v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase();
}

export async function loadCustomerData(): Promise<{ rows: CustomerRow[]; customers: Customer[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(CSV_URL, {
      download: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        try {
          const raw = results.data as string[][];
          // Find header row (row with "No", "Nama Instagram" etc.)
          let headerIdx = -1;
          for (let i = 0; i < Math.min(raw.length, 10); i++) {
            if (raw[i].some((c) => c === 'No' || c === 'Nama Instagram')) {
              headerIdx = i;
              break;
            }
          }
          if (headerIdx < 0) headerIdx = 2;

          // Build rows from data after header
          const rows: CustomerRow[] = [];
          let lastNama = '';
          let lastIg = '';
          let lastWa = '';
          let lastAlamat = '';
          let lastBirthday = '';

          for (let i = headerIdx + 1; i < raw.length; i++) {
            const r = raw[i];
            if (!r || r.length < 10) continue;

            // Columns (0-based): 0=No,1=NamaIG,2=Instagram,3=TgOrder,4=TgUltah,
            // 5=NamaPengiriman,6=Alamat,7=WA,8=Kode,9=Jenis,...
            const namaInstagram = clean(r[1]) || lastNama;
            const instagram     = clean(r[2]) || (lastNama === namaInstagram ? lastIg : '');
            const wa            = formatWhatsApp(clean(r[7]) || lastWa);
            const alamat        = formatAddress(clean(r[6])) || lastAlamat;
            const birthday      = clean(r[4]) || lastBirthday;
            const jenisFull     = normalizeType(clean(r[9]) || '');

            if (clean(r[3]) === '' && clean(r[8]) === '' && jenisFull === '') continue;

            const row: CustomerRow = {
              id: `row-${i}`,
              namaInstagram,
              instagram,
              tanggalOrder: normalizeDate(clean(r[3])),
              tanggalUlangTahun: clean(r[4]) || birthday,
              namaPengiriman: clean(r[5]),
              alamat,
              wa,
              kode: clean(r[8]),
              jenis: jenisFull,
              gambar: clean(r[10]),
              rangka: clean(r[11]),
              gramasiRangka: clean(r[12]),
              kodeType: clean(r[13]),
              type: normalizePearl(clean(r[14])),
              weight: clean(r[15]),
              size: clean(r[16]),
              kodeShape: clean(r[17]),
              shape: clean(r[18]),
              color: clean(r[19]),
              grade: clean(r[20]),
              stone: clean(r[21]),
              stoneWeight: clean(r[22]),
              amount: clean(r[23]),
              terbilang: clean(r[24]),
              qty: clean(r[25]),
              paymentVia: normalizePayment(clean(r[26])),
              totalBayar: clean(r[27]),
              ongkir: clean(r[28]),
              hargaBersih: clean(r[29]),
              kurir: clean(r[30]),
              keterangan: clean(r[31]),
              raw: r,
            };

            if (namaInstagram) lastNama = namaInstagram;
            if (instagram) lastIg = instagram;
            if (wa) lastWa = wa;
            if (alamat) lastAlamat = alamat;
            if (birthday) lastBirthday = birthday;

            rows.push(row);
          }

          // Group by customer name
          const customerMap = new Map<string, Customer>();
          for (const row of rows) {
            const key = row.namaInstagram || row.namaPengiriman || 'Unknown';
            if (!customerMap.has(key)) {
              customerMap.set(key, {
                id: `customer-${customerMap.size}`,
                nama: key,
                instagram: row.instagram,
                wa: row.wa,
                alamat: row.alamat,
                tanggalUlangTahun: row.tanggalUlangTahun,
                orders: [],
                totalSpend: 0,
                orderCount: 0,
                lastOrder: '',
                city: extractCity(row.alamat),
              });
            }
            const cust = customerMap.get(key)!;
            if (row.jenis) {
              cust.orders.push(row);
              cust.orderCount++;
              cust.totalSpend += parseAmount(row.totalBayar);
              if (!cust.lastOrder || row.tanggalOrder > cust.lastOrder) {
                cust.lastOrder = row.tanggalOrder;
              }
              if (!cust.instagram && row.instagram) cust.instagram = row.instagram;
              if (!cust.wa && row.wa) cust.wa = row.wa;
              if (!cust.alamat && row.alamat) cust.alamat = row.alamat;
            }
          }

          const customers = Array.from(customerMap.values()).filter(
            (c) => c.nama !== 'Unknown' || c.orderCount > 0
          );

          resolve({ rows, customers });
        } catch (err) {
          reject(err);
        }
      },
      error: reject,
    });
  });
}

export function formatRupiah(n: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export function getJenisBadgeClass(jenis: string): string {
  const map: Record<string, string> = {
    necklace: 'badge-necklace',
    pendant: 'badge-pendant',
    earrings: 'badge-earrings',
    bracelet: 'badge-bracelet',
    ring: 'badge-ring',
    brooch: 'badge-brooch',
    'jewelry set': 'badge-set',
    loose: 'badge-loose',
  };
  return map[jenis.toLowerCase()] ?? 'badge-default';
}

export function getPearlBadgeClass(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('southsea') || lower === 's') return 'badge-southsea';
  if (lower.includes('akoya') || lower === 'as' || lower === 'af') return 'badge-akoya';
  if (lower.includes('tahitian') || lower === 't') return 'badge-tahitian';
  if (lower.includes('edison') || lower === 'e') return 'badge-edison';
  if (lower.includes('freshwater') || lower === 'f') return 'badge-freshwater';
  return 'badge-default';
}

export function formatWhatsApp(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return phone;
  
  if (cleaned.startsWith('62')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  const len = cleaned.length;
  if (len >= 9 && len <= 13) {
    const part1 = cleaned.slice(0, 3);
    const part2 = cleaned.slice(3, 7);
    const part3 = cleaned.slice(7);
    return `+62 ${part1}-${part2}-${part3}`;
  }
  return phone;
}

export function parseDateToSortValue(dateStr: string): number {
  if (!dateStr || dateStr === '—' || dateStr === '-') return 0;
  const parts = dateStr.split('/');
  if (parts.length < 3) return 0;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return 0;
  return year * 10000 + month * 100 + day;
}

export function formatInputNumber(value: string | undefined | null): string {
  if (!value) return '';
  const clean = value.replace(/\./g, '');
  if (/^\d+$/.test(clean)) {
    return parseInt(clean, 10).toLocaleString('id-ID');
  }
  return value;
}

export type CustomerLabel = 'vip' | 'loyal' | 'new' | null;

export function getCustomerLabel(
  totalSpend: number,
  orderCount: number,
  vipMinSpend: number = 15000000,
  loyalMinOrders: number = 3
): CustomerLabel {
  if (totalSpend >= vipMinSpend) return 'vip';
  if (orderCount >= loyalMinOrders) return 'loyal';
  if (orderCount === 1) return 'new';
  return null;
}

const CATALOG_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThQ2kPUPjRXfJBTB7rxJOrpQf2bIyghtOVZPcvnzEQDu0-KhLp-rxMu8mws-HsBLmQCXYUxlFiZlmk/pub?gid=804242596&single=true&output=csv';

const JENIS_MUTIARA_MAP: Record<string, string> = {
  THT: 'Tahitian',
  SSP: 'South Sea',
  AKY: 'Akoya',
  EDI: 'Edison',
  M: 'Mother of Pearl',
};

const BATU_MAP: Record<string, string> = {
  D: 'Diamond',
  J: 'Juntai',
  R: 'Ruby',
  Z: 'Zirkon',
  S: 'Safir',
  K: 'Opal',
  A: 'Amethyst',
  M: 'Mother of Pearl',
};

const BENTUK_MAP: Record<string, string> = {
  R: 'Round',
  BRQ: 'Baroque',
  OV: 'Oval',
  BUT: 'Button',
  NR: 'Near Round',
  OVT: 'Oval Tear',
  SBRQ: 'Semi Baroque',
  TD: 'Tear Drop',
  KES: 'Keshi',
  MIX: 'MIX',
};

const RANGKA_MAP: Record<string, string> = {
  '18K': 'Emas Asli 18K',
  'S925': 'Real Silver 925',
  '750': 'Emas Asli 18K (Lokal)',
  'KRT': 'Karet',
};

export async function loadCatalogData(): Promise<CatalogItem[]> {
  const url = `${CATALOG_CSV_URL}&_t=${new Date().getTime()}`;
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const items: CatalogItem[] = [];
        const data = results.data as any[];

        for (const row of data) {
          const no = clean(row['No']);
          const kode = clean(row['Kode']);
          if (!kode) continue; // Skip empty rows

          const status = clean(row['Status']);
          const tipeBarang = clean(row['Tipe Barang']);
          
          const mutiaraRaw = clean(row['Jenis Mutiara']);
          const jenisMutiara = JENIS_MUTIARA_MAP[mutiaraRaw.toUpperCase()] || mutiaraRaw;
          
          const warna = clean(row['Warna Mutiara']);
          const grade = clean(row['Grade Mutiara']);
          const size = clean(row['size']);
          
          const tipeSplit = tipeBarang.split(' ');
          const typeBase = tipeSplit[0];
          const typeBatuInit = tipeSplit.length > 1 ? tipeSplit[1] : '';
          const typeBatuFull = typeBatuInit ? (BATU_MAP[typeBatuInit.toUpperCase()] || typeBatuInit) : '';
          const tipeFull = typeBatuFull ? `${typeBase} ${typeBatuFull}` : typeBase;
          
          // Construct Title
          const parts = [
            kode,
            tipeFull,
            mutiaraRaw ? 'Mutiara' : '',
            jenisMutiara,
            warna,
            grade,
            size ? `${size} mm` : ''
          ];
          const title = parts.filter(Boolean).join(' ');

          const bentukRaw = clean(row['Bentuk Mutiara']);
          const rangkaRaw = clean(row['Rangka']);
          const batuRaw = clean(row['Jenis Batu']);

          items.push({
            id: kode,
            no,
            status,
            fotoR: clean(row['Foto R']),
            fotoK: clean(row['Foto K']),
            kode,
            tanggal: clean(row['Tanggal']),
            tipeBarang,
            modalRangka: parseAmount(row['Modal Rangka 04/06/2026']),
            modalMutiara: parseAmount(row['Modal Mutiara']),
            hargaJual: parseAmount(row['Harga Jual']) || parseAmount(row[' Harga Barkode']), // Use barkode if available or jual
            hargaBarkode: parseAmount(row[' Harga Barkode']),
            rangka: RANGKA_MAP[rangkaRaw.toUpperCase()] || rangkaRaw,
            beratRangka: clean(row['Berat Rangka']),
            jenisMutiara,
            beratMutiara: clean(row['Berat Mutiara']),
            warnaMutiara: warna,
            sizeMutiara: size,
            gradeMutiara: grade,
            bentukMutiara: BENTUK_MAP[bentukRaw.toUpperCase()] || bentukRaw,
            jenisBatu: BATU_MAP[batuRaw.toUpperCase()] || batuRaw,
            beratBatu: clean(row['Berat Batu']),
            panjang: clean(row['Panjang']),
            surface: clean(row['Surface']),
            shineLuster: clean(row['Shine/Luster']),
            shape: clean(row['Shape']),
            tisCrack: clean(row['Tis/Crack']),
            title,
            isReady: status.toUpperCase() === 'R'
          });
        }
        resolve(items);
      },
      error: (err: any) => {
        reject(err);
      }
    });
  });
}
