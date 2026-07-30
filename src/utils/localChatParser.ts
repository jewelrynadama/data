export interface ExtractedOrderLocal {
  // Basic info
  customerName: string;
  phone: string;
  address: string;
  products: string;     // raw product text (for Keterangan)
  totalPrice: string;
  shippingFee: string;
  courier: string;
  dp: string;
  orderDate: string;
  platform: string;     // Pesanan via: shopee, wa, dll
  sku: string;          // SKU Pesanan
  notes: string;        // Catatan
  gift: string;         // Free gift
  photo: string;        // Lampiran foto

  // Pearl / product detail columns
  jenis: string;              // Jenis perhiasan (Cincin, Gelang, dll) — col Jenis
  rangka: string;             // Jenis Rangka (Emas 18K, dll) — col Rangka
  gramasiRangka: string;      // Berat Rangka — col Gramasi Rangka
  kodeType: string;           // kode Type
  pearlType: string;          // Type / Jenis Mutiara
  beratMutiara: string;       // Stone weight
  size: string;               // Ukuran Mutiara — col Size
  shape: string;              // Bentuk Mutiara — col Shape
  color: string;              // Warna Mutiara — col Color
  grade: string;              // Grade Mutiara — col Grade
  stone: string;
  stoneWeight: string;      // Weight of additional stone (Diamond/Ruby/Zirkon)              // Stone (Mutiara apa)
}

// Helper to extract a field value by label from a block of text
function extractField(text: string, ...labels: string[]): string {
  for (const label of labels) {
    // Match label followed by optional colons/dashes/spaces and capture the value
    // Support separators like ':', '-', or just spaces
    const re = new RegExp(`(?:^|\\n)[\\-\\*\\s]*${label}\\s*(?:[:\\-]+\\s*|\\s+)(.+)`, 'im');
    const match = text.match(re);
    if (match && match[1]) {
      // Remove markdown bold markers and trim
      return match[1].replace(/\*/g, '').replace(/^[:\-\s]+/, '').trim();
    }
  }
  return '';
}

// Identify blocks that are "Format Orderan" — the full order message
function splitIntoOrderBlocks(text: string): string[] {
  // Try splitting on the "Format Orderan" marker (most reliable)
  if (text.toLowerCase().includes('format orderan')) {
    const markerPattern = /(?=\*?Format Orderan\*?)/gi;
    const byMarker = text.split(markerPattern).map(s => s.trim()).filter(s => s.length > 10);
    if (byMarker.length > 0) return byMarker;
  }

  // Fallback: split by WA message timestamp boundaries and group consecutive lines into order blocks
  const waBoundaryRegex = /(?:\n|^)(?=\[?\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}[, ]+\d{1,2}[:\.]\d{2})/g;
  const waBlocks = text.split(waBoundaryRegex).map(s => s.trim()).filter(s => s.length > 0);
  if (waBlocks.length > 1) return waBlocks;

  // Last resort: split by blank lines
  return text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 10);
}

// Post-processing cleanup to fix template copy-paste errors and label leakage
function cleanupParsedOrder(o: ExtractedOrderLocal) {
  const labels = [
    'jenis mutiara', 'type mutiara', 'pearl type',
    'berat mutiara', 'pearl weight', 'stone weight',
    'ukuran mutiara', 'pearl size', 'size',
    'warna mutiara', 'warna', 'color',
    'bentuk mutiara', 'bentuk', 'shape',
    'grade mutiara', 'grade',
    'jenis rangka', 'rangka', 'frame',
    'berat rangka', 'gramasi rangka', 'gramasi'
  ];

  // Helper to check if a value is just a label or contains a label
  const isLabel = (v: string) => {
    const low = v.toLowerCase().trim();
    return labels.some(l => low === l || low === l + ':' || low === l + ' :');
  };

  // If a field is exactly one of the labels, clear it
  if (isLabel(o.pearlType)) o.pearlType = '';
  if (isLabel(o.beratMutiara)) o.beratMutiara = '';
  if (isLabel(o.size)) o.size = '';
  if (isLabel(o.shape)) o.shape = '';
  if (isLabel(o.color)) o.color = '';
  if (isLabel(o.grade)) o.grade = '';

  // 1. & 2. Try to correctly separate pearlType and shape if they are mixed
  const PEARL_TYPES = ['akoya', 'freshwater', 'southsea', 'tahitian', 'edison', 'seapearls', 'sea pearl', 'sea pearls', 'laut', 'tawar'];
  const SHAPES = ['baroque', 'round', 'near round', 'oval', 'button', 'teardrop', 'tear drop', 'bulat', 'barok'];

  // Combine whatever we found into one string to re-parse it carefully
  const combinedTypeShape = [o.pearlType, o.shape].filter(Boolean).join(' ').toLowerCase();

  if (combinedTypeShape) {
    const foundTypes: string[] = [];
    const foundShapes: string[] = [];

    // Check for pearl types
    for (const t of PEARL_TYPES) {
      if (combinedTypeShape.includes(t)) {
        foundTypes.push(t);
      }
    }
    // Check for shapes
    for (const s of SHAPES) {
      if (combinedTypeShape.includes(s)) {
        foundShapes.push(s);
      }
    }

    if (foundTypes.length > 0 || foundShapes.length > 0) {
      // Reassign based on what we found. If we found something specific, we use the original capitalization or just what we found.
      // But we must preserve the original string if it had extra info.
      // Easiest is to assign found types to pearlType, and found shapes to shape.
      if (foundTypes.length > 0) {
        o.pearlType = [o.pearlType, o.shape].filter(Boolean).join(' ').match(new RegExp(foundTypes.join('|'), 'gi'))?.join(' ') || foundTypes.join(' ');
      }
      if (foundShapes.length > 0) {
        o.shape = [o.pearlType, o.shape].filter(Boolean).join(' ').match(new RegExp(foundShapes.join('|'), 'gi'))?.join(' ') || foundShapes.join(' ');
      }
    }
  }

  // 3. If size contains a color label (like Pearl Color : Purple)
  if (o.size && o.size.toLowerCase().includes('color')) {
    const colorVal = o.size.replace(/^(?:pearl\s*color|color|warna)\s*[:\-]?\s*/i, '').trim();
    if (!o.color) o.color = colorVal;
    o.size = '';
  }

  // 4. If size contains a weight label
  if (o.size && o.size.toLowerCase().includes('weight')) {
    const weightVal = o.size.replace(/^(?:pearl\s*weight|weight|berat)\s*[:\-]?\s*/i, '').trim();
    if (!o.beratMutiara) o.beratMutiara = weightVal;
    o.size = '';
  }

  // 5. If weight contains size info (mm)
  const looksLikeSize = (v: string) => /\d[\-–]?\d*\s*mm|mm/i.test(v);
  const looksLikeWeight = (v: string) => /gram|gr\b|g\b|\d+\s*g|\d,\d+/i.test(v);

  if (o.beratMutiara && looksLikeSize(o.beratMutiara) && !looksLikeWeight(o.beratMutiara)) {
    if (!o.size) o.size = o.beratMutiara;
    o.beratMutiara = '';
  }
}

export function parseWhatsAppLocal(text: string): ExtractedOrderLocal[] {
  const orders: ExtractedOrderLocal[] = [];
  const blocks = splitIntoOrderBlocks(text);

  for (const block of blocks) {
    // Must have at least one of these to be considered an order block
    if (!/Nama\s*:|Penerima\s*:|Total Bayar|List Pesanan/i.test(block)) continue;

    // --- Basic info ---
    const customerName = extractField(block, 'Nama', 'Penerima', 'Customer');
    
    let phone = extractField(block, 'WA', 'No HP', 'No WA', 'Telp', 'No\\. WA');
    phone = phone.replace(/[^0-9+]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    else if (phone.startsWith('+')) phone = phone.substring(1);

    // Address: lines that follow immediately after the name line, before next labeled field
    let address = '';
    // Find the line with Nama/Penerima and grab subsequent non-labeled lines
    const blockLines = block.split('\n');
    let nameLineIdx = -1;
    for (let i = 0; i < blockLines.length; i++) {
      if (/^[\[\]\d\/\.\-, :]+.*(?:Nama|Penerima)\s*:/i.test(blockLines[i])) {
        nameLineIdx = i;
        break;
      }
    }
    if (nameLineIdx >= 0) {
      const addrLines: string[] = [];
      for (let i = nameLineIdx + 1; i < blockLines.length; i++) {
        const l = blockLines[i].trim();
        if (!l) break; // blank line ends address block
        // Stop at next labeled section (contains label: pattern)
        if (/^[\*\-]?\s*(?:WA|No HP|No WA|Telp|List Pesanan|SKU|Jasa Kirim|Total Bayar|Catatan|Free gift|DP|Kurir)\s*[:\-]/i.test(l)) break;
        // Skip standalone labels like 'Kota:' 'Provinsi:'
        if (/^(?:Kota|Provinsi|Negara)\s*:/i.test(l)) continue;
        addrLines.push(l);
      }
      address = addrLines.join(', ');
    }

    const orderDate = extractField(block, 'Tanggal');
    const platform   = extractField(block, 'Pesanan via', 'Via', 'Channel');
    const sku        = extractField(block, 'SKU Pesanan', 'SKU', 'Kode Pesanan');
    const gift       = extractField(block, 'Free gift', 'Gift', 'Bonus');
    const courier    = extractField(block, 'Jasa Kirim', 'Kurir', 'Ekspedisi');
    const notes      = extractField(block, 'Catatan', 'Note');

    const totalRaw   = extractField(block, 'Total Bayar', 'Total', 'Nominal');
    const totalPrice = totalRaw.replace(/[^0-9]/g, '');

    const shippingRaw = extractField(block, 'Ongkir', 'Ongkos Kirim');
    const shippingFee = shippingRaw.replace(/[^0-9]/g, '');

    const dpRaw = extractField(block, 'DP', 'Down Payment');
    const dp    = dpRaw.replace(/[^0-9]/g, '');

    // Photo attachment
    const photoMatch = block.match(/<terlampir:\s*([^>]+)>/i) || block.match(/\(file terlampir\)/i);
    const photo = photoMatch ? (photoMatch[1] || '(file terlampir)').trim() : '';

    // --- Pearl / product detail fields ---
    const rangka        = extractField(block, 'Jenis Rangka', 'Rangka');
    const gramasiRangka = extractField(block, 'Berat Rangka', 'Gramasi Rangka', 'Gramasi');
    const pearlType     = extractField(block, 'Jenis Mutiara', 'Pearl Type', 'Type Mutiara', 'Mutiara');
    const color         = extractField(block, 'Warna Mutiara', 'Warna', 'Color', 'Pearl Color');
    const shape         = extractField(block, 'Bentuk Mutiara', 'Bentuk', 'Shape', 'Pearl Shape');
    const grade         = extractField(block, 'Grade Mutiara', 'Grade');

    // Extract size and weight carefully — some chats write "Stone weight: Pearl Size :5-6 mm"
    // which means the seller is actually writing the size info in the stone weight field.
    let rawBeratMutiara = extractField(block, 'Berat Mutiara', 'Pearl Weight', 'Stone weight', 'Weight');
    let rawSize         = extractField(block, 'Ukuran Mutiara', 'Ukuran', 'Pearl Size', 'Size', 'Size mutiara');

    // Helper: strip common prefixes like "Pearl Size :" or "estimasi " from a value
    const stripPrefix = (v: string) =>
      v.replace(/^(?:pearl\s*size|ukuran\s*mutiara|berat\s*mutiara|estimasi)\s*[:\-]?\s*/i, '').trim();

    const looksLikeSize   = (v: string) => /\d[\-–]?\d*\s*mm|mm/i.test(v);
    const looksLikeWeight = (v: string) => /gram|gr\b|g\b|\d+\s*g|\d,\d+/i.test(v);

    let beratMutiara = '';
    let size         = '';

    if (rawSize) {
      size = stripPrefix(rawSize);
    }
    if (rawBeratMutiara) {
      if (looksLikeSize(rawBeratMutiara) && !looksLikeWeight(rawBeratMutiara)) {
        // It's actually a size value, put it in size if not already filled
        if (!size) size = stripPrefix(rawBeratMutiara);
      } else {
        beratMutiara = stripPrefix(rawBeratMutiara);
      }
    }

    // Fallback: if still no size, try to extract from product text block
    if (!size) {
      const sizeMatch = block.match(/(?:Ukuran|Pearl Size|Size)\s*[:\-]\s*([\d][\d\s\-–,\.]+mm)/i);
      if (sizeMatch) size = sizeMatch[1].trim();
    }

    // Jenis (col J) = type of jewelry in ENGLISH
    // Priority: explicit field → keyword scan of block text → SKU prefix inference
    const JENIS_MAP: Record<string, string> = {
      // Indonesian → English
      'anting'        : 'Earring',
      'anting-anting' : 'Earring',
      'earring'       : 'Earring',
      'kalung'        : 'Necklace',
      'necklace'      : 'Necklace',
      'gelang'        : 'Bracelet',
      'bracelet'      : 'Bracelet',
      'cincin'        : 'Ring',
      'ring'          : 'Ring',
      'liontin'       : 'Pendant',
      'pendant'       : 'Pendant',
      'bros'          : 'Brooch',
      'bross'         : 'Brooch',
      'brooch'        : 'Brooch',
      'jepit'         : 'Hair Clip',
      'hair clip'     : 'Hair Clip',
      'mahkota'       : 'Crown',
      'crown'         : 'Crown',
      'set'           : 'Set',
    };

    // SKU prefix → English jewelry type
    const SKU_JENIS: Record<string, string> = {
      'AN' : 'Earring',
      'KA' : 'Necklace',
      'GE' : 'Bracelet',
      'CI' : 'Ring',
      'LI' : 'Pendant',
      'PN' : 'Pendant',
      'BR' : 'Brooch',
      'BO' : 'Brooch',
      'JE' : 'Hair Clip',
      'SE' : 'Set',
    };

    let jenis = '';

    // 1. Explicit labeled field in chat
    const jenisRaw = extractField(block, 'Jenis Perhiasan', 'Jenis Produk', 'Jewelry Type', 'Type of Jewelry');
    if (jenisRaw) {
      const key = jenisRaw.toLowerCase().trim();
      jenis = JENIS_MAP[key] || jenisRaw; // use mapping or keep original if unknown
    }

    // 2. Keyword scan: look for jewelry type keywords anywhere in the block
    if (!jenis) {
      const blockLower = block.toLowerCase();
      for (const [keyword, english] of Object.entries(JENIS_MAP)) {
        // Match whole word only (not e.g. "kalung" inside "per-kalung-an")
        const wordRe = new RegExp(`\\b${keyword}\\b`);
        if (wordRe.test(blockLower)) {
          jenis = english;
          break;
        }
      }
    }

    // 3. SKU prefix inference (last resort)
    if (!jenis && sku) {
      const skuPrefix = sku.substring(0, 2).toUpperCase();
      jenis = SKU_JENIS[skuPrefix] || '';
    }

    // Stone = additional gemstone in the jewelry (Diamond, Ruby, Zirkon, etc.) — NOT the pearl
    // Look for explicit labels first, then scan for known gemstone keywords in the block
    let stone = extractField(block, 'Batu Permata', 'Batu', 'Stone', 'Diamond', 'Gem');
    if (!stone) {
      // Scan block for known gemstone names
      const gemstoneMatch = block.match(
        /\b(diamond|berlian|ruby|rubi|sapphire|safir|emerald|zamrud|zirkon|zircon|cubic zirconia|cz|topaz|amethyst|opal|garnet|jade|moissanite)\b/i
      );
      if (gemstoneMatch) stone = gemstoneMatch[1];
    }

    // Stone weight = weight of the additional stone (Diamond, Ruby, etc.) — NOT pearl weight
    // Only extract if there's actually a stone present
    let stoneWeight = '';
    if (stone) {
      stoneWeight = extractField(block, 'Berat Batu', 'Stone Weight', 'Diamond Weight', 'Carat', 'Karat Batu');
    }

    const kodeType   = '';  // not commonly in raw text; left for manual entry

    // products = full product block text for Keterangan
    let products = '';
    const prodMatch = block.match(/(?:\*List Pesanan[:\*]*|Produk)\s*[\-]*\s*\n([\s\S]*?)(?:\*Jasa Kirim|\*Total Bayar|Catatan\s*:|$)/i);
    if (prodMatch) {
      products = prodMatch[1].trim().replace(/\n/g, ' | ');
    } else {
      products = sku || '';
    }

    const orderObj = {
      customerName,
      phone,
      address,
      products,
      totalPrice,
      shippingFee,
      courier,
      dp,
      orderDate,
      platform,
      sku,
      notes,
      gift,
      photo,
      jenis,
      rangka,
      gramasiRangka,
      kodeType,
      pearlType,
      beratMutiara,
      size,
      shape,
      color,
      grade,
      stone,
      stoneWeight,
    };

    // Post-extraction cleanup
    cleanupParsedOrder(orderObj);

    orders.push(orderObj);
  }

  return orders;
}

// ─────────────────────────────────────────────────────────────────────────────
// Terbilang — convert a number to Indonesian words
// e.g. 2999000 → "Dua Juta Sembilan Ratus Sembilan Puluh Sembilan Ribu Rupiah"
// ─────────────────────────────────────────────────────────────────────────────
const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan',
                'Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas',
                'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];
const PULUHAN = ['', '', 'Dua Puluh', 'Tiga Puluh', 'Empat Puluh', 'Lima Puluh',
                 'Enam Puluh', 'Tujuh Puluh', 'Delapan Puluh', 'Sembilan Puluh'];

function terbilangRatusan(n: number): string {
  if (n === 0) return '';
  if (n < 20) return SATUAN[n];
  if (n < 100) {
    const sisa = n % 10;
    return PULUHAN[Math.floor(n / 10)] + (sisa ? ' ' + SATUAN[sisa] : '');
  }
  // hundreds
  const ratus = Math.floor(n / 100);
  const sisa  = n % 100;
  const prefix = ratus === 1 ? 'Seratus' : SATUAN[ratus] + ' Ratus';
  return prefix + (sisa ? ' ' + terbilangRatusan(sisa) : '');
}

export function terbilang(amount: string | number): string {
  const num = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num === 0) return '';

  const MILIAR  = 1_000_000_000;
  const JUTA    = 1_000_000;
  const RIBU    = 1_000;

  let result = '';
  let sisa   = num;

  if (sisa >= MILIAR) {
    const n = Math.floor(sisa / MILIAR);
    result += (n === 1 ? 'Satu' : terbilangRatusan(n)) + ' Miliar ';
    sisa %= MILIAR;
  }
  if (sisa >= JUTA) {
    const n = Math.floor(sisa / JUTA);
    result += (n === 1 ? 'Satu' : terbilangRatusan(n)) + ' Juta ';
    sisa %= JUTA;
  }
  if (sisa >= RIBU) {
    const n = Math.floor(sisa / RIBU);
    result += (n === 1 ? 'Seribu' : terbilangRatusan(n) + ' Ribu') + ' ';
    sisa %= RIBU;
  }
  if (sisa > 0) {
    result += terbilangRatusan(sisa);
  }

  return result.trim() + ' Rupiah';
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV generator — columns must match the user's Google Spreadsheet exactly
// ─────────────────────────────────────────────────────────────────────────────
export function generateCSVFromLocal(orders: any[]): string {
  const headers = [
    "No",                           // 0
    "Nama Instagram",               // 1
    "Instagram",                    // 2
    "Tanggal Order",                // 3
    "Tanggal Ulang Tahun",          // 4
    "Nama Pengiriman",              // 5
    "Alamat",                       // 6
    "WA",                           // 7
    "Kode",                         // 8  (SKU)
    "Jenis",                        // 9
    "Gambar",                       // 10 (photo)
    "Rangka",                       // 11
    "Gramasi Rangka",               // 12
    "kode Type",                    // 13
    "Type",                         // 14 (Jenis Mutiara)
    "Weight",                       // 15 (Berat Mutiara)
    "Size",                         // 16 (Ukuran Mutiara)
    "Kode Shape",                   // 17
    "Shape",                        // 18 (Bentuk Mutiara)
    "Color",                        // 19 (Warna Mutiara)
    "Grade",                        // 20
    "Stone",                        // 21
    "Stone weight",                 // 22
    "Amount (total harga)",         // 23
    "Terbilang",                    // 24
    "QTY",                          // 25
    "Payment via",                  // 26 (Platform)
    "Total Bayar",                  // 27
    "Ongkir",                       // 28
    "Harga Bersih",                 // 29
    "Kurir",                        // 30
    "Keterangan",                   // 31 (products raw / notes)
    "Gift",                         // 32
    "",                             // 33
    "",                             // 34
    "Tipe Customer",                // 35
    "Fashion",                      // 36
    "",                             // 37
    "",                             // 38
    "Hobi",                         // 39
    "",                             // 40
    "Pekerjaan",                    // 41
    "Status Pernikahan dan Jumlah Anak", // 42
    "Order via",                    // 43 (Platform copy)
    "",                             // 44
    "",                             // 45
    "",                             // 46
    "",                             // 47
    "Tertarik dengan Jenis Mutiara",// 48
    "",                             // 49
    "",                             // 50
    "",                             // 51
    "",                             // 52
    "Tertarik dengan Jenis Perhiasan", // 53
    "",                             // 54
    "",                             // 55
    "",                             // 56
    "",                             // 57
    "",                             // 58
    "",                             // 59
    "",                             // 60
    "",                             // 61
    "",                             // 62
  ];

  // Escape a value for CSV: quote all cells, escape inner quotes
  const esc = (v: string | number | undefined | null) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;

  let csvContent = headers.map(esc).join(',') + '\n';

  orders.forEach((o, idx) => {
    const row = new Array(headers.length).fill('');

    row[0]  = (idx + 1).toString();                                   // No
    row[1]  = o.customerName || '';                                   // Nama Instagram
    row[3]  = o.orderDate || '';                                       // Tanggal Order
    row[5]  = o.customerName || '';                                    // Nama Pengiriman
    row[6]  = o.address || '';                                         // Alamat
    row[7]  = o.phone ? `'${o.phone}` : '';                           // WA (leading ' prevents Excel auto-format)
    row[8]  = o.jenis ? o.jenis[0].toLowerCase() : '';               // Kode = huruf pertama Jenis (e=earring, n=necklace, dst)
    row[9]  = o.jenis || '';                                           // Jenis
    row[10] = o.photo || o.attachments?.[0] || '';                    // Gambar
    row[11] = o.rangka || '';                                          // Rangka
    row[12] = o.gramasiRangka || '';                                   // Gramasi Rangka
    row[13] = o.kodeType || '';                                        // kode Type
    row[14] = o.pearlType || '';                                       // Type (Jenis Mutiara)
    row[15] = o.beratMutiara || o.weight || '';                        // Weight
    row[16] = o.size || '';                                            // Size
    row[17] = '';                                                       // Kode Shape (blank)
    row[18] = o.shape || '';                                           // Shape
    row[19] = o.color || '';                                           // Color
    row[20] = o.grade || '';                                           // Grade
    row[21] = o.stone || '';                                           // Stone (Diamond/Ruby/Zirkon)
    row[22] = o.stoneWeight || '';                                     // Stone weight (berat batu permata)
    row[23] = o.totalPrice || o.amount || '';                          // Amount (total harga)
    row[24] = o.totalPrice ? terbilang(o.totalPrice) : (o.amount ? terbilang(o.amount) : ''); // Terbilang
    row[25] = o.qty ? o.qty.toString() : '1';                         // QTY
    row[26] = o.platform || o.paymentVia || '';                        // Payment via
    row[27] = o.totalPrice || o.totalBayar || o.amount || '';          // Total Bayar
    row[28] = o.shippingFee || o.ongkir || '';                         // Ongkir
    row[30] = o.courier || '';                                         // Kurir
    row[31] = [o.products, o.notes, o.dp ? `DP: ${o.dp}` : '']       // Keterangan
                .filter(Boolean).join(' | ');
    row[32] = o.gift || '';                                            // Gift
    row[43] = o.platform || o.orderVia || '';                          // Order via

    csvContent += row.map(esc).join(',') + '\n';
  });

  return csvContent;
}

export function downloadLocalCSV(csvContent: string, filename: string = 'pesanan_wa.csv') {
  // Add BOM for correct UTF-8 encoding in Excel (prevents garbled Indonesian characters)
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

