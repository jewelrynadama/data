import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Sparkles, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { parseWhatsAppTextWithAI, scanImageWithVisionAI, uploadImageToStorage, inferJenisAndType } from '../utils/whatsappParser';
import type { ExtractedOrder } from '../utils/whatsappParser';
import { db } from '../utils/firebase';
import { mergeAndUploadLocal, saveToFirestore } from '../utils/firebaseSync';
import { readStore, saveOrderEdit } from '../utils/localStore';
import { parseWhatsAppLocal, generateCSVFromLocal, downloadLocalCSV } from '../utils/localChatParser';
import { extractCity } from '../utils/csvLoader';

// Helper to clean/format date to YYYY-MM-DD
function cleanDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Try custom parsing for DD/MM/YY format
  // E.g. 02/08/22 -> 2022-08-02
  const slashParts = dateStr.split('/');
  if (slashParts.length === 3) {
    let day = slashParts[0].trim();
    let month = slashParts[1].trim();
    let year = slashParts[2].trim();
    if (year.length === 2) {
      year = '20' + year;
    }
    if (day.length === 1) day = '0' + day;
    if (month.length === 1) month = '0' + month;
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// Helper to filter chat lines by year
function filterChatByYear(chatText: string, selectedYear: string): string {
  const yearSuffix = selectedYear.substring(2); // E.g. "2026" -> "26"
  const lines = chatText.split(/\r?\n/);
  const filteredLines: string[] = [];
  let isCurrentMessageInYear = false;

  // Pattern to detect timestamp, e.g. [02/08/22, or 2.8.2022,
  const dateRegex = /^\[?(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4}),/;

  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      const year = match[3]; // The YY or YYYY part
      const matchYear = year.length === 4 ? year.substring(2) : year; // normalize to 2 digits "26"
      if (matchYear === yearSuffix) {
        isCurrentMessageInYear = true;
        filteredLines.push(line);
      } else {
        isCurrentMessageInYear = false;
      }
    } else {
      if (isCurrentMessageInYear) {
        filteredLines.push(line);
      }
    }
  }
  return filteredLines.join('\n');
}

// Helper to chunk text safely without cutting in the middle of messages
function chunkChatText(text: string, maxChunkSize: number = 15000): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    const isNewMessage = line.trim().startsWith('[') || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(line.trim());
    const isTooLarge = currentSize + line.length > maxChunkSize * 1.5;
    
    if (currentSize + line.length > maxChunkSize && currentChunk.length > 0 && (isNewMessage || isTooLarge)) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(line);
    currentSize += line.length + 1;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  return chunks;
}

function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }
  const shortMatch = filename.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (shortMatch) {
    const y = parseInt(shortMatch[1]);
    const m = parseInt(shortMatch[2]);
    const d = parseInt(shortMatch[3]);
    if (y >= 20 && y <= 30 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(2000 + y, m - 1, d);
    }
  }
  return null;
}

function matchAttachmentsProgrammatically(chatText: string, orders: ExtractedOrder[]): ExtractedOrder[] {
  const lines = chatText.split(/\r?\n/);
  
  return orders.map(order => {
    const nameLower = (order.customerName || '').toLowerCase().trim();
    if (!nameLower) return order;

    let bestLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(nameLower)) {
        let score = 1;
        const addrSnippet = (order.address || '').split(',')[0].toLowerCase().trim();
        if (addrSnippet && lines.slice(i, i + 15).some(l => l.toLowerCase().includes(addrSnippet))) {
          score += 2;
        }
        const prodSnippet = (order.products || '').split('\n')[0].toLowerCase().trim().substring(0, 15);
        if (prodSnippet && lines.slice(i, i + 25).some(l => l.toLowerCase().includes(prodSnippet))) {
          score += 2;
        }
        if (score > 1) {
          bestLineIdx = i;
          break;
        }
        if (bestLineIdx === -1) {
          bestLineIdx = i;
        }
      }
    }

    if (bestLineIdx === -1) return order;

    const matchedFiles: string[] = [];
    let firstPhotoDate: Date | null = null;

    for (let i = bestLineIdx + 1; i < Math.min(lines.length, bestLineIdx + 40); i++) {
      const line = lines[i];
      
      if (line.includes('No. Pesanan:') || line.includes('*Penerima :*') || line.toLowerCase().includes('total bayar')) {
        if (line.includes('No. Pesanan:') || line.includes('Nama:')) {
          break;
        }
      }

      const match = line.match(/<terlampir:\s*(.*?)>/i);
      if (match && match[1]) {
        const filename = match[1].trim();
        const photoDate = parseDateFromFilename(filename);
        if (photoDate) {
          if (!firstPhotoDate) {
            firstPhotoDate = photoDate;
            matchedFiles.push(filename);
          } else {
            const diffTime = Math.abs(photoDate.getTime() - firstPhotoDate.getTime());
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays <= 3) {
              matchedFiles.push(filename);
            }
          }
        } else {
          matchedFiles.push(filename);
        }

        if (matchedFiles.length >= 5) {
          break;
        }
      }
    }

    return {
      ...order,
      attachments: matchedFiles.length > 0 ? matchedFiles : (order.attachments || [])
    };
  });
}

export default function WhatsAppImporterPage({ customers, rows = [] }: { customers: any[]; rows?: any[] }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({ current: 0, total: 0, message: '' });
  const [parsedOrders, setParsedOrders] = useState<ExtractedOrder[]>([]);
  const [unassignedPhotos, setUnassignedPhotos] = useState<File[]>([]);
  const [allImages, setAllImages] = useState<File[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ExtractedOrder | null>(null);
  const [importFilter, setImportFilter] = useState<'latest' | '2026' | '2025' | '2024' | '2023' | '2022' | 'all'>('2026');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [inputMode, setInputMode] = useState<'folder' | 'paste'>('folder');
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoUpdateResults, setAutoUpdateResults] = useState<Array<{
    id: string; name: string;
    before: { jenis: string; type: string };
    after: { jenis: string; type: string; size: string; color: string; grade: string };
    changed: boolean;
  }> | null>(null);
  const [autoUpdateError, setAutoUpdateError] = useState('');
  const [lightboxWa, setLightboxWa] = useState<{ src: string; name: string } | null>(null);

  const handleAutoUpdate = async () => {
    setAutoUpdating(true);
    setAutoUpdateResults(null);
    setAutoUpdateError('');
    try {
      const toUpdate = rows.filter(o =>
        o.type === 'Imported Item' || o.jenis === 'Pearl'
      );

      if (toUpdate.length === 0) {
        setAutoUpdateError('Tidak ada order "Imported Item" yang perlu diupdate. Pastikan data sudah tersinkron dari Firestore.');
        setAutoUpdating(false);
        return;
      }

      const results: NonNullable<typeof autoUpdateResults> = [];

      for (const order of toUpdate) {
        const productText = (order.keterangan || '').replace(/\n*\[DP\][\s\S]*$/, '').trim();
        const inferred = inferJenisAndType(productText);

        const newJenis = inferred.jenis  || order.jenis || 'Pearl';
        const newType  = inferred.pearlType || order.type  || 'Imported Item';
        const newSize  = inferred.size  || order.size  || '';
        const newColor = inferred.color || order.color || '';
        const newGrade = inferred.grade || order.grade || '';

        const changed = (
          newJenis !== (order.jenis || '') ||
          newType  !== (order.type  || '') ||
          newSize  !== (order.size  || '') ||
          newColor !== (order.color || '') ||
          newGrade !== (order.grade || '')
        );

        results.push({
          id: order.id,
          name: order.namaInstagram || order.namaPengiriman || order.id,
          before: { jenis: order.jenis || 'Pearl', type: order.type || 'Imported Item' },
          after: { jenis: newJenis, type: newType, size: newSize, color: newColor, grade: newGrade },
          changed
        });

        if (changed) {
          saveOrderEdit(order.id, { jenis: newJenis, type: newType, size: newSize, color: newColor, grade: newGrade });
        }
      }

      // Push updated store to Firestore
      const updatedStore = readStore();
      await saveToFirestore(updatedStore);

      setAutoUpdateResults(results);
    } catch (err: any) {
      setAutoUpdateError(`Gagal: ${err?.message || 'Unknown error'}`);
    } finally {
      setAutoUpdating(false);
    }
  };


  const handlePasteProcess = async () => {
    if (!pasteText.trim()) {
      alert('Silakan paste teks chat WhatsApp terlebih dahulu.');
      return;
    }
    setIsProcessing(true);
    setParsedOrders([]);
    setUnassignedPhotos([]);
    try {
      let cleaned = pasteText.replace(/[\u200e\u200f\u202a\u202b\u202c\ufeff\u200b\u200c\u200d]/g, '');
      const chunks = chunkChatText(cleaned, 12000); // 12000 is the sweet spot for speed vs rate limits
      const orders: ExtractedOrder[] = [];
      let aiFailed = false;
      
      for (let c = chunks.length - 1; c >= 0; c--) {
        const chunkNum = chunks.length - c;
        setProgress({ current: chunkNum, total: chunks.length, message: `Menganalisis chat bagian ${chunkNum} dari ${chunks.length}...` });
        try {
          const chunkOrders = await parseWhatsAppTextWithAI(chunks[c]);
          if (chunkOrders && chunkOrders.length > 0) orders.push(...chunkOrders);
        } catch (err: any) {
          console.warn(`Gagal chunk ke-${c} via AI. Beralih ke Regex Lokal:`, err);
          aiFailed = true;
          break; // Stop loop immediately and fallback
        }
        if (c > 0) await new Promise(r => setTimeout(r, 2000)); // Delay to respect rate limits
      }
      
      // Fallback to local parsing if AI failed or hit limits
      if (aiFailed || orders.length === 0) {
        setProgress({ current: 100, total: 100, message: 'Memproses dengan Regex Lokal (Tanpa AI)...' });
        const localOrders = parseWhatsAppLocal(cleaned);
        orders.length = 0; 
        for (const o of localOrders) {
           const inf = inferJenisAndType(o.products);
           orders.push({
             rawId: Math.random().toString(36).substring(7),
             orderDate: new Date().toISOString(),
             customerName: o.customerName,
             phone: o.phone,
             address: o.address,
             products: o.products,
             totalPrice: parseInt(o.totalPrice || '0', 10),
             shippingFee: parseInt(o.shippingFee || '0', 10),
             courier: o.courier,
             dp: parseInt(o.dp || '0', 10),
             jenis: o.jenis || inf.jenis,
             pearlType: o.pearlType || inf.pearlType,
             size: o.size || inf.size,
             color: o.color || inf.color,
             grade: o.grade || inf.grade,
             shape: o.shape || inf.shape,
             stone: o.stone || inf.stone,
             stoneWeight: o.stoneWeight || inf.stoneWeight,
             rangka: o.rangka || inf.rangka,
             weight: o.beratMutiara || '',
             gramasiRangka: o.gramasiRangka || '',
             qty: 1
           });
        }
      }
      
      if (orders.length === 0) {
        alert("Proses selesai, namun TIDAK ADA SATUPUN pesanan yang terdeteksi dari teks ini. Pastikan format teks mengandung keyword wajib seperti 'Nama:' atau 'Penerima:', 'WA:', dan 'Total'.");
      } else {
        setParsedOrders(orders);
        setProgress({ current: 100, total: 100, message: 'Selesai!' });
      }
    } catch (error) {
      alert('Gagal memproses teks: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Process selected directory
  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsProcessing(true);
    setProgress({ current: 0, total: 100, message: 'Membaca file...' });

    try {
      let chatText = '';
      const imageFiles: File[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith('.txt')) {
          chatText = await file.text();
        } else if (file.type.startsWith('image/')) {
          imageFiles.push(file);
        }
      }

      if (!chatText) {
        alert('File _chat.txt tidak ditemukan di dalam folder.');
        setIsProcessing(false);
        return;
      }

      // Clean hidden Unicode control characters (like LTR markers \u200e)
      chatText = chatText.replace(/[\u200e\u200f\u202a\u202b\u202c\ufeff\u200b\u200c\u200d]/g, '');

      // Filter image files by year if a specific year filter is selected
      let activeImageFiles = imageFiles;
      if (importFilter !== 'all' && importFilter !== 'latest') {
        const yearStr = importFilter; // E.g. "2026"
        activeImageFiles = imageFiles.filter(f => f.name.includes(yearStr));
      }

      setAllImages(activeImageFiles);

      // Apply Filter
      let filteredChat = chatText;
      if (importFilter === 'latest') {
        const lines = chatText.split(/\r?\n/);
        if (lines.length > 1000) {
          let startIndex = lines.length - 1000;
          while (startIndex < lines.length && !/^\[?\d{1,2}[\/\.\-]\d{1,2}/.test(lines[startIndex].trim())) {
            startIndex++;
          }
          filteredChat = lines.slice(startIndex).join('\n');
        }
      } else if (importFilter !== 'all') {
        filteredChat = filterChatByYear(chatText, importFilter);
      }

      if (!filteredChat.trim()) {
        alert(`Tidak ada obrolan yang ditemukan untuk filter yang dipilih (${importFilter === 'latest' ? 'Terbaru' : 'Tahun ' + importFilter}).`);
        setIsProcessing(false);
        return;
      }

      // Chunk the text with a larger size for faster processing
      const chunks = chunkChatText(filteredChat, 12000);
      const orders: ExtractedOrder[] = [];
      let aiFailed = false;

      for (let c = chunks.length - 1; c >= 0; c--) {
        const chunkNum = chunks.length - c;
        setProgress({ 
          current: chunkNum, 
          total: chunks.length, 
          message: `Menganalisis chat bagian ${chunkNum} dari ${chunks.length}...` 
        });

        try {
          const chunkOrders = await parseWhatsAppTextWithAI(chunks[c]);
          if (chunkOrders && chunkOrders.length > 0) {
            orders.push(...chunkOrders);
          }
        } catch (err: any) {
          console.warn(`Gagal menganalisis chunk ke-${c} via AI. Beralih ke Regex Lokal:`, err);
          aiFailed = true;
          break;
        }

        if (c > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Fallback to local parsing if AI failed or hit limits
      if (aiFailed || orders.length === 0) {
        setProgress({ current: 100, total: 100, message: 'Memproses dengan Regex Lokal (Tanpa AI)...' });
        const localOrders = parseWhatsAppLocal(filteredChat);
        
        // Clear previous partial orders from AI to avoid duplicates
        orders.length = 0; 
        
        for (const o of localOrders) {
           const inf = inferJenisAndType(o.products);
           orders.push({
             rawId: Math.random().toString(36).substring(7),
             orderDate: new Date().toISOString(),
             customerName: o.customerName,
             phone: o.phone,
             address: o.address,
             products: o.products,
             totalPrice: parseInt(o.totalPrice || '0', 10),
             shippingFee: parseInt(o.shippingFee || '0', 10),
             courier: o.courier,
             dp: parseInt(o.dp || '0', 10),
             jenis: o.jenis || inf.jenis,
             pearlType: o.pearlType || inf.pearlType,
             size: o.size || inf.size,
             color: o.color || inf.color,
             grade: o.grade || inf.grade,
             shape: o.shape || inf.shape,
             stone: o.stone || inf.stone,
             stoneWeight: o.stoneWeight || inf.stoneWeight,
             rangka: o.rangka || inf.rangka,
             weight: o.beratMutiara || '',
             gramasiRangka: o.gramasiRangka || '',
             qty: 1
           });
        }
      }
      
      // Match attachments programmatically based on user's heuristic
      const finalOrders = matchAttachmentsProgrammatically(filteredChat, orders);

      const unassigned: File[] = [];
      const assignedUrls = new Set<string>();

      // Pair attachments
      for (const order of finalOrders) {
        if (order.attachments && order.attachments.length > 0) {
          const matched = activeImageFiles.filter(f => order.attachments && order.attachments.includes(f.name));
          if (matched.length > 0) {
            order.attachments = matched.map(f => f.name);
            matched.forEach(f => assignedUrls.add(f.name));
          } else {
            order.attachments = [];
          }
        }
      }

      for (const file of activeImageFiles) {
        if (!assignedUrls.has(file.name)) {
          unassigned.push(file);
        }
      }

      if (finalOrders.length === 0) {
        alert("Proses selesai, namun TIDAK ADA SATUPUN pesanan yang terdeteksi dari _chat.txt ini. Pastikan file berisi format order yang memiliki keyword wajib seperti 'Nama:' atau 'Penerima:', 'WA:', dan 'Total'.");
      } else {
        setParsedOrders(finalOrders);
        setUnassignedPhotos(unassigned);
        setProgress({ current: 100, total: 100, message: 'Selesai!' });
      }
    } catch (error) {
      console.error(error);
      alert('Gagal memproses folder: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // (Removed manual batch handling function to return to automatic loop)

  // 2. Scan unassigned photo with Vision AI
  const handleVisionScan = async (file: File) => {
    try {
      setIsProcessing(true);
      setProgress({ current: 0, total: 100, message: `Menganalisis ${file.name}...` });
      const res = await scanImageWithVisionAI(file);
      let targetOrder = parsedOrders.find(o => {
        const nameMatch = res.customerName && o.customerName.toLowerCase() === res.customerName.toLowerCase();
        const senderMatch = res.senderName && o.customerName.toLowerCase() === res.senderName.toLowerCase();
        const amountMatch = res.amount && (o.totalPrice === res.amount || (o.totalPrice - o.shippingFee) === res.amount);
        return nameMatch || senderMatch || amountMatch;
      });

      if (targetOrder) {
        targetOrder.attachments = [...(targetOrder.attachments || []), file.name];
        setParsedOrders([...parsedOrders]);
        setUnassignedPhotos(unassignedPhotos.filter(f => f !== file));
        alert(`Berhasil dicocokkan dengan pesanan ${targetOrder.customerName}!`);
      } else {
        alert('Foto ini memuat informasi yang berbeda dari daftar pesanan, atau pesanan belum ada.');
      }
    } catch (error: any) {
      alert(error?.message || 'Gagal menganalisis foto.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Import to Database or CSV
  const handleDownloadCsvAI = () => {
    if (parsedOrders.length === 0) return;
    const csv = generateCSVFromLocal(parsedOrders);
    downloadLocalCSV(csv);
  };

  const handleImportToDatabase = async () => {
    if (parsedOrders.length === 0) return;
    if (!db) {
      alert("Database Firestore belum siap.");
      return;
    }
    
    setIsProcessing(true);
    let successCount = 0;
    const ordersToPush: any[] = [];
    const newCustomersToPush: any[] = [];
    const addedCustomerNames = new Set<string>();
    
    try {
      for (let i = 0; i < parsedOrders.length; i++) {
        const order = parsedOrders[i];
        setProgress({ current: i + 1, total: parsedOrders.length, message: `Mengunggah pesanan & foto ${order.customerName}...` });

        // Helper for upload with timeout
        const uploadWithTimeout = async (file: File, timeoutMs: number = 8000): Promise<string> => {
          return Promise.race([
            uploadImageToStorage(file),
            new Promise<string>((_, reject) => 
              setTimeout(() => reject(new Error("Timeout")), timeoutMs)
            )
          ]);
        };

        // Upload attachments in parallel for the current order
        const uploadedUrls: string[] = [];
        if (order.attachments && order.attachments.length > 0) {
          const uploadPromises = order.attachments.map(async (filename) => {
            const fileObj = allImages.find(f => f.name === filename);
            if (fileObj) {
              try {
                // Parallel upload with 8 second timeout per file
                return await uploadWithTimeout(fileObj, 8000);
              } catch (e) {
                console.warn(`Gagal mengunggah ${filename} ke cloud, menggunakan rujukan lokal:`, e);
                // Fallback to local filename
                return filename;
              }
            }
            return filename;
          });
          const results = await Promise.all(uploadPromises);
          uploadedUrls.push(...results.filter(Boolean));
        }

        const cleanName = order.customerName ? order.customerName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const cleanProducts = order.products ? order.products.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) : '';
        const orderDateStr = cleanDate(order.orderDate);
        const stableId = `wa-${orderDateStr}-${cleanName}-${order.totalPrice}-${cleanProducts}`;

        // Auto-infer jenis, pearlType, size, color, grade from product name
        const inferred = inferJenisAndType(order.products || '');
        const resolvedJenis     = order.jenis     || inferred.jenis     || 'Pearl';
        const resolvedPearlType = order.pearlType || inferred.pearlType || 'Imported Item';
        const resolvedSize      = order.size      || inferred.size      || '';
        const resolvedColor     = order.color     || inferred.color     || '';
        const resolvedGrade     = order.grade     || inferred.grade     || '';
        const resolvedRangka    = order.rangka    || inferred.rangka    || '';

        // Prepare the order object
        const newOrder = {
          id: stableId,
          no: order.orderId || '',
          namaInstagram: order.customerName,
          instagram: '',
          tanggalOrder: orderDateStr,
          tanggalUlangTahun: '',
          namaPengiriman: order.customerName,
          alamat: order.address,
          wa: order.phone,
          kode: 'WA-IMPORT',
          jenis: resolvedJenis,
          gambar: '',
          rangka: resolvedRangka,
          gramasiRangka: order.gramasiRangka || '',
          kodeType: '',
          type: resolvedPearlType,
          weight: order.weight || '',
          size: resolvedSize,
          kodeShape: '',
          shape: order.shape || inferred.shape || '',
          color: resolvedColor,
          grade: resolvedGrade,
          stone: order.stone || inferred.stone || '',
          stoneWeight: order.stoneWeight || inferred.stoneWeight || '',
          amount: order.totalPrice.toString(),
          terbilang: '',
          qty: order.qty ? order.qty.toString() : '1',
          paymentVia: 'WhatsApp',
          totalBayar: order.totalPrice.toString(),
          ongkir: order.shippingFee.toString(),
          hargaBersih: (order.totalPrice - order.shippingFee).toString(),
          kurir: order.courier,
          keterangan: order.dp && order.dp > 0 && order.dpNote
            ? `${order.products}\n\n[DP] ${order.dpNote}`
            : order.products,
          resi: '',
          orderStatus: 'selesai' as const,
          raw: [order.products],
          attachments: uploadedUrls
        };
        
        ordersToPush.push(newOrder);
        successCount++;

        const custName = newOrder.namaInstagram;
        if (custName) {
          const exists = customers.some((c: any) => c.nama.toLowerCase() === custName.toLowerCase());
          if (!exists && !addedCustomerNames.has(custName.toLowerCase())) {
            addedCustomerNames.add(custName.toLowerCase());
            newCustomersToPush.push({
              id: `wa-cust-${cleanName}`,
              nama: custName,
              instagram: '',
              wa: newOrder.wa,
              alamat: newOrder.alamat,
              tanggalUlangTahun: '',
              orders: [],
              orderCount: 0,
              totalSpend: 0,
              lastOrder: '',
              city: extractCity(newOrder.alamat),
            });
          }
        }
      }

      // Save using mergeAndUploadLocal so it syncs to App state properly
      await mergeAndUploadLocal({
        newCustomers: newCustomersToPush,
        editedCustomers: {},
        deletedCustomerIds: [],
        newOrders: ordersToPush,
        editedOrders: {},
        deletedOrderIds: [],
        inventoryLogs: []
      });

      alert(`Berhasil menyimpan ${successCount} pesanan ke database! Silakan kembali ke halaman All Orders.`);
      setParsedOrders([]);
    } catch (error) {
      console.error('Error memproses antrean:', error);
      alert('Terjadi kesalahan saat memproses antrean.');
      setIsProcessing(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!pasteText.trim()) {
      alert("Silakan paste teks chat terlebih dahulu!");
      return;
    }
    const orders = parseWhatsAppLocal(pasteText);
    if (orders.length === 0) {
      alert("Tidak ditemukan pola order pada teks. Pastikan format mengandung Nama:, WA:, dsb.");
      return;
    }
    const csv = generateCSVFromLocal(orders);
    downloadLocalCSV(csv);
  };



  return (
    <div className="page-body">
      <div className="wa-importer-wrapper">

      <div className="wa-importer-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', paddingRight: 8, paddingBottom: 40 }}>
          {/* Pengaturan Impor */}
          <div className="card" style={{ padding: 20, background: 'var(--bg-card)', flexShrink: 0 }}>
            <h3 className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <Sparkles style={{ width: 18, height: 18, color: 'var(--accent-purple)' }} />
              Pilih Rentang Impor Chat
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div 
                onClick={() => setImportFilter('2026')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === '2026' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === '2026' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === '2026' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Tahun 2026</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khusus pesan tahun 2026</span>
              </div>

              <div 
                onClick={() => setImportFilter('2025')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === '2025' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === '2025' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === '2025' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Tahun 2025</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khusus pesan tahun 2025</span>
              </div>

              <div 
                onClick={() => setImportFilter('2024')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === '2024' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === '2024' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === '2024' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Tahun 2024</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khusus pesan tahun 2024</span>
              </div>

              <div 
                onClick={() => setImportFilter('2023')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === '2023' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === '2023' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === '2023' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Tahun 2023</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khusus pesan tahun 2023</span>
              </div>

              <div 
                onClick={() => setImportFilter('2022')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === '2022' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === '2022' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === '2022' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Tahun 2022</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Khusus pesan tahun 2022</span>
              </div>

              <div 
                onClick={() => setImportFilter('latest')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === 'latest' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === 'latest' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === 'latest' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Terbaru Saja</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>~1.000 baris terakhir</span>
              </div>

              <div 
                onClick={() => setImportFilter('all')}
                style={{ 
                  padding: '12px 16px', 
                  border: '1px solid ' + (importFilter === 'all' ? 'var(--accent-purple)' : 'var(--border)'), 
                  background: importFilter === 'all' ? 'rgba(124,58,237,0.05)' : 'transparent',
                  borderRadius: 12, 
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  flex: '1 1 180px',
                  minWidth: 160,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: importFilter === 'all' ? 'var(--accent-purple)' : 'var(--text-primary)' }}>Semua Riwayat</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seluruh riwayat chat</span>
              </div>
            </div>
          </div>

          {/* Mode Toggle Tabs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', flexShrink: 0 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setInputMode('folder')}
                style={{
                  flex: 1, padding: '14px 20px', border: 'none', cursor: 'pointer',
                  background: inputMode === 'folder' ? 'rgba(124,58,237,0.08)' : 'transparent',
                  color: inputMode === 'folder' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  fontWeight: inputMode === 'folder' ? 700 : 500,
                  fontSize: 14, borderBottom: inputMode === 'folder' ? '2px solid var(--accent-purple)' : '2px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                📁 Upload Folder WA
              </button>
              <button
                onClick={() => setInputMode('paste')}
                style={{
                  flex: 1, padding: '14px 20px', border: 'none', cursor: 'pointer',
                  background: inputMode === 'paste' ? 'rgba(124,58,237,0.08)' : 'transparent',
                  color: inputMode === 'paste' ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  fontWeight: inputMode === 'paste' ? 700 : 500,
                  fontSize: 14, borderBottom: inputMode === 'paste' ? '2px solid var(--accent-purple)' : '2px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                📋 Paste Teks Chat
              </button>
            </div>

            {/* Folder Upload Mode */}
            {inputMode === 'folder' && (
              <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-card)' }}>
                <div onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', marginBottom: 20 }}>
                  <Upload style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                  <h3 className="card-title" style={{ marginBottom: 4 }}>Upload Folder WhatsApp</h3>
                  <p className="card-subtitle">
                    Pilih folder yang berisi _chat.txt dan semua lampiran fotonya.
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <p className="card-subtitle" style={{ marginBottom: 12 }}>Atau jika laptop/HP Anda tidak mendukung pilih folder:</p>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => singleFileInputRef.current?.click()}
                    style={{ margin: '0 auto' }}
                  >
                    Upload File _chat.txt Saja
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleDirectorySelect}
                  {...{ webkitdirectory: "", directory: "" } as any}
                />
                <input
                  type="file"
                  ref={singleFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleDirectorySelect}
                  accept=".txt"
                  multiple
                />
              </div>
            )}

            {/* Paste Text Mode */}
            {inputMode === 'paste' && (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                  Copy seluruh isi chat WhatsApp dari HP atau PC, lalu paste di bawah ini.
                </p>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="[18/06/26, 10.00.00] Nama Pelanggan: Halo, saya mau pesan...&#10;&#10;Paste teks chat WhatsApp di sini..."
                  style={{
                    width: '100%', minHeight: 180, padding: 14, borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace',
                    resize: 'vertical', outline: 'none', boxSizing: 'border-box'
                  }}
                />
                <div className="paste-actions">
                  <button
                    onClick={() => setPasteText('')}
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    Bersihkan
                  </button>
                  <button
                    onClick={handleDownloadCsv}
                    disabled={isProcessing || !pasteText.trim()}
                    className="btn btn-secondary"
                  >
                    ⬇️ Download CSV (Tanpa AI)
                  </button>
                  <button
                    onClick={handlePasteProcess}
                    disabled={isProcessing || !pasteText.trim()}
                    className="btn btn-primary"
                  >
                    {isProcessing ? '⏳ Memproses...' : '✨ Proses Chat'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Loader2 style={{ width: 20, height: 20, color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{progress.message}</span>
              </div>
              <div style={{ width: '100%', background: 'var(--bg-tertiary)', borderRadius: 99, height: 8 }}>
                <div 
                  style={{ 
                    background: 'var(--accent-purple)', 
                    height: 8, 
                    borderRadius: 99, 
                    transition: 'width 0.3s ease',
                    width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` 
                  }} 
                />
              </div>
            </div>
          )}

          {/* Batch Status UI has been removed to simplify and automate process */}

          {/* Empty State after processing */}
          {!isProcessing && progress.message === 'Selesai!' && parsedOrders.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <AlertCircle style={{ width: 40, height: 40, color: 'var(--accent-amber)', margin: '0 auto 16px' }} />
              <h3 className="card-title" style={{ marginBottom: 8 }}>Tidak Ada Pesanan Ditemukan</h3>
              <p className="card-subtitle" style={{ maxWidth: 400, margin: '0 auto 16px' }}>
                AI tidak berhasil mengekstrak pesanan dari chat ini. Kemungkinan semua API Key sedang penuh (quota). 
                Coba lagi beberapa menit lagi, atau gunakan filter tahun yang berbeda.
              </p>
              <button
                onClick={() => setProgress({ current: 0, total: 0, message: '' })}
                className="btn"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Parsed Results */}
          {parsedOrders.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Header with save button */}
              <div style={{ padding: '16px 20px', background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 style={{ width: 22, height: 22, color: 'var(--accent-green)', flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 15 }}>
                      {parsedOrders.length} Pesanan Berhasil Diekstrak
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                      Unduh hasil ekstrak AI ini ke dalam format Spreadsheet Anda.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleDownloadCsvAI}
                    className="btn btn-secondary"
                    style={{ flexShrink: 0, padding: '10px 24px', fontSize: 14, fontWeight: 700, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                  >
                    ⬇️ Download CSV
                  </button>
                  <button
                    onClick={handleImportToDatabase}
                    className="btn btn-primary"
                    style={{ flexShrink: 0, padding: '10px 24px', fontSize: 14, fontWeight: 700, background: 'var(--accent-green)', boxShadow: '0 4px 15px rgba(34,197,94,0.35)' }}
                  >
                    💾 Simpan ke Database
                  </button>
                </div>
              </div>

              {/* Order list */}
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {parsedOrders.map((order, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedOrder(order)}
                    style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{order.customerName}</h4>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.address}</p>
                      <div style={{ display: 'flex', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-purple)', background: 'rgba(124,58,237,0.1)', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                          Rp {order.totalPrice.toLocaleString('id-ID')}
                        </span>
                        {order.courier && (
                          <span style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 4 }}>
                            {order.courier}
                          </span>
                        )}
                        {order.products && (
                          <span style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 4, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {order.products.split('\n')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    {order.attachments && order.attachments.length > 0 && (
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-tertiary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <ImageIcon style={{ width: 24, height: 24, color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.attachments[0]}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Unassigned Photos Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.05)' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle style={{ width: 20, height: 20, color: 'var(--accent-amber)' }} />
                Butuh Pengecekan
              </h3>
              <p className="card-subtitle" style={{ marginTop: 4 }}>
                {unassignedPhotos.length} foto tidak terhubung ke pesanan mana pun.
              </p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {unassignedPhotos.map((file, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg-tertiary)' }}>
                  <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, background: 'var(--bg-primary)', marginBottom: 12, overflow: 'hidden' }}>
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 12 }}>{file.name}</p>
                  <button 
                    onClick={() => handleVisionScan(file)}
                    disabled={isProcessing}
                    className="btn btn-secondary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Sparkles style={{ width: 16, height: 16, color: 'var(--accent-purple)' }} />
                    Scan Vision AI
                  </button>
                </div>
              ))}
              
              {unassignedPhotos.length === 0 && parsedOrders.length > 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <CheckCircle2 style={{ width: 32, height: 32, color: 'var(--accent-green)', margin: '0 auto 8px' }} />
                  <p className="card-subtitle">Semua foto sudah terpasangkan!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out', border: '1px solid var(--border)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">Detail Pesanan</h3>
              <button className="icon-btn" onClick={() => setSelectedOrder(null)}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Customer Info */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>Info Pelanggan</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nama</label>
                    <div style={{ fontWeight: 600 }}>{selectedOrder.customerName}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>No. WhatsApp</label>
                    <div>{selectedOrder.phone || '-'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Alamat Pengiriman</label>
                    <div style={{ background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, fontSize: 14 }}>
                      {selectedOrder.address || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>Detail Pesanan</h4>
                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Produk yang Dipesan</label>
                    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-primary)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                      {selectedOrder.products}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Kurir</label>
                      <div style={{ fontWeight: 600 }}>{selectedOrder.courier || '-'}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ongkir</label>
                      <div style={{ fontWeight: 600 }}>Rp {selectedOrder.shippingFee.toLocaleString('id-ID')}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Total Pembayaran</label>
                      <div style={{ fontWeight: 700, color: 'var(--accent-purple)', fontSize: 16 }}>Rp {selectedOrder.totalPrice.toLocaleString('id-ID')}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {selectedOrder.attachments && selectedOrder.attachments.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>Lampiran ({selectedOrder.attachments.length})</h4>
                  <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 12, paddingTop: 4, scrollSnapType: 'x mandatory' }}>
                    {selectedOrder.attachments.map((filename, idx) => {
                      const file = allImages.find(f => f.name === filename);
                      if (!file) return null;
                      const objUrl = URL.createObjectURL(file);
                      return (
                        <div
                          key={idx}
                          style={{
                            width: 280, flexShrink: 0,
                            scrollSnapAlign: 'start',
                            borderRadius: 14, overflow: 'hidden',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                            background: 'var(--bg-secondary)',
                            transition: 'transform 0.18s, box-shadow 0.18s',
                            cursor: 'zoom-in'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.18)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)'; }}
                          onClick={() => setLightboxWa({ src: objUrl, name: filename })}
                        >
                          <img
                            src={objUrl}
                            alt={filename}
                            style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
                          />
                          <div style={{ padding: '8px 12px', fontSize: 11, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {filename}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for WhatsApp importer attachments */}
      {lightboxWa && (
        <div
          onClick={() => setLightboxWa(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.18s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
          >
            <img
              src={lightboxWa.src}
              alt={lightboxWa.name}
              style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 14, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
            />
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{lightboxWa.name}</div>
            <button
              onClick={() => setLightboxWa(null)}
              style={{
                position: 'absolute', top: -14, right: -14,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                color: 'white', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)'
              }}
            >×</button>
          </div>
        </div>
      )}

      {/* ── Auto-Update Panel ─────────────────────────────────────── */}
      <div style={{
        marginTop: 32,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={20} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Auto-Update Order Lama
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Scan semua order "Imported Item" → isi otomatis Jenis, Pearl Type, Size, Color, Grade dari nama produk.
            </div>
          </div>
        </div>

        <button
          onClick={handleAutoUpdate}
          disabled={autoUpdating}
          style={{
            padding: '10px 24px',
            background: autoUpdating ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: autoUpdating ? 'var(--text-muted)' : 'white',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5,
            cursor: autoUpdating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
          }}
        >
          {autoUpdating
            ? <><Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Memproses...</>
            : <><RefreshCw size={16} /> Jalankan Auto-Update</>}
        </button>

        {autoUpdateError && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 13 }}>
            ⚠️ {autoUpdateError}
          </div>
        )}

        {autoUpdateResults && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
              Hasil: {autoUpdateResults.filter(r => r.changed).length} dari {autoUpdateResults.length} order diperbarui ✅
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              {autoUpdateResults.map(r => (
                <div key={r.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: r.changed ? 'rgba(16,185,129,0.06)' : 'var(--bg-tertiary)',
                  border: `1px solid ${r.changed ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {r.name}
                    </div>
                    {r.changed ? (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 7px', borderRadius: 5, textDecoration: 'line-through' }}>
                          {r.before.jenis} / {r.before.type}
                        </span>
                        <span>→</span>
                        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 7px', borderRadius: 5 }}>
                          {r.after.jenis} / {r.after.type}
                          {r.after.size  ? ` · ${r.after.size}mm` : ''}
                          {r.after.color ? ` · ${r.after.color}` : ''}
                          {r.after.grade ? ` · ${r.after.grade}` : ''}
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Tidak ada perubahan (nama produk tidak dikenali)</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {r.changed
                      ? <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                      : <span style={{ fontSize: 16 }}>—</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, fontSize: 12.5, color: '#10b981', fontWeight: 600 }}>
              ✅ Perubahan sudah disimpan ke Firestore. Buka halaman <strong>All Orders</strong> untuk melihat hasilnya.
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
      </div>
    </div>
  );
}
