// src/types.ts
export interface CustomerRow {
  id: string;
  no?: string;
  namaInstagram: string;
  instagram: string;
  tanggalOrder: string;
  tanggalUlangTahun: string;
  namaPengiriman: string;
  alamat: string;
  wa: string;
  kode: string;
  jenis: string;
  gambar: string;
  rangka: string;
  gramasiRangka: string;
  kodeType: string;
  type: string;
  weight: string;
  size: string;
  kodeShape: string;
  shape: string;
  color: string;
  grade: string;
  stone: string;
  stoneWeight: string;
  amount: string;
  terbilang: string;
  qty: string;
  paymentVia: string;
  totalBayar: string;
  ongkir: string;
  hargaBersih: string;
  kurir: string;
  keterangan: string;
  resi?: string;
  orderStatus?: 'pending' | 'dikirim' | 'selesai' | 'retur';
  raw: string[];
  attachments?: string[];
}

export interface Customer {
  id: string;
  nama: string;
  instagram: string;
  wa: string;
  alamat: string;
  tanggalUlangTahun: string;
  orders: CustomerRow[];
  totalSpend: number;
  orderCount: number;
  lastOrder: string;
  city: string;
}

export interface PendingOrder {
  id: string;
  source: 'website' | 'shopee';
  orderDate: string;
  customerName: string;
  instagram?: string;
  wa?: string;
  productName: string;
  totalPrice: number;
  qty: number;
  alamat?: string;
  status: 'pending';
  createdAt?: string;
  attachments?: string[];
}

export interface CatalogItem {
  id: string; // row index or Kode
  no: string;
  status: string;
  fotoR: string;
  fotoK: string;
  kode: string;
  tanggal: string;
  tipeBarang: string;
  modalRangka: number;
  modalMutiara: number;
  hargaJual: number;
  hargaBarkode: number;
  rangka: string;
  beratRangka: string;
  jenisMutiara: string;
  beratMutiara: string;
  warnaMutiara: string;
  sizeMutiara: string;
  gradeMutiara: string;
  bentukMutiara: string;
  jenisBatu: string;
  beratBatu: string;
  panjang: string;
  surface: string;
  shineLuster: string;
  shape: string;
  tisCrack: string;
  
  // Computed fields
  title: string;
  isReady: boolean;
}
