import { useState, useCallback } from 'react';
import {
  HardDrive, Key,
  CheckCircle2, XCircle, Wand2,
  Search, CloudUpload, Loader2,
  AlertCircle, FolderOpen, ArrowRight, Unlink
} from 'lucide-react';
import { mergeAndUploadLocal } from '../utils/firebaseSync';
import { scanImageWithVisionAI } from '../utils/whatsappParser';
import type { CustomerRow } from '../types';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  size?: string;
  linkedOrderId?: string | null;
  uploadedUrl?: string | null;
  uploadStatus?: 'pending' | 'uploading' | 'done' | 'error';
}

interface Props {
  rows: CustomerRow[];
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const GOOGLE_API_KEY_STORAGE = 'pearlcrm_google_api_key';
const DRIVE_FOLDER_KEY_STORAGE = 'pearlcrm_drive_folder_id';

function extractFolderId(input: string): string {
  // Handle full URLs like https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  const match = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // If it's already just the ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return input.trim();
}

const ENV_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

export default function DrivePhotoLinkerPage({ rows, onShowToast }: Props) {
  // Use env key first, then localStorage, then empty
  const [apiKey, setApiKey] = useState<string>(() => 
    ENV_GOOGLE_API_KEY || localStorage.getItem(GOOGLE_API_KEY_STORAGE) || ''
  );
  const [folderInput, setFolderInput] = useState<string>(() => localStorage.getItem(DRIVE_FOLDER_KEY_STORAGE) || 'https://drive.google.com/drive/folders/1ZeIzX1r6yrcER3HcUB_goeNUpOHfPODN?usp=sharing');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [uploadingAll, setUploadingAll] = useState(false);
  // Only show manual API key input if no env key AND no saved key
  const [showApiKeyInput, setShowApiKeyInput] = useState(!ENV_GOOGLE_API_KEY && !localStorage.getItem(GOOGLE_API_KEY_STORAGE));
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [step, setStep] = useState<'connect' | 'link' | 'upload'>('connect');
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [autoLinkProgress, setAutoLinkProgress] = useState('');

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem(GOOGLE_API_KEY_STORAGE, apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setShowApiKeyInput(false);
    onShowToast('Google API Key disimpan!', 'success');
  };

  const fetchDriveFiles = useCallback(async () => {
    const folderId = extractFolderId(folderInput);
    if (!folderId) { setError('Masukkan folder ID atau URL Google Drive yang valid.'); return; }
    if (!apiKey) { setError('Masukkan Google API Key terlebih dahulu.'); return; }

    setLoading(true);
    setError('');
    try {
      localStorage.setItem(DRIVE_FOLDER_KEY_STORAGE, folderInput);

      let allImageFiles: DriveFile[] = [];
      let pageToken: string | undefined = undefined;

      do {
        const url: string = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,size)&pageSize=1000&orderBy=name${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          const msg = data?.error?.message || 'Gagal mengambil file dari Google Drive.';
          if (msg.includes('API key not valid')) {
            setError('API Key tidak valid. Silakan cek kembali Google API Key Anda.');
          } else if (msg.includes('Drive API')) {
            setError('Google Drive API belum diaktifkan. Aktifkan di Google Cloud Console → APIs & Services → Enable Drive API.');
          } else {
            setError(msg);
          }
          setLoading(false);
          return;
        }

        const imageFiles: DriveFile[] = (data.files || []).filter(
          (f: any) => f.mimeType?.startsWith('image/')
        ).map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          thumbnailLink: f.thumbnailLink?.replace('=s220', '=s400') || null,
          webViewLink: f.webViewLink,
          size: f.size,
          linkedOrderId: null,
          uploadedUrl: null,
          uploadStatus: 'pending',
        }));

        allImageFiles = [...allImageFiles, ...imageFiles];
        pageToken = data.nextPageToken;
      } while (pageToken);

      if (allImageFiles.length === 0) {
        setError('Tidak ada gambar di folder ini. Pastikan folder berisi file gambar (JPG, PNG, dll) dan dibagikan secara publik.');
        setLoading(false);
        return;
      }

      setDriveFiles(allImageFiles);
      setStep('link');
      onShowToast(`✅ ${allImageFiles.length} foto berhasil dimuat dari Google Drive!`, 'success');
    } catch (err) {
      setError('Gagal terhubung ke Google Drive. Periksa koneksi internet dan API Key Anda.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, folderInput, onShowToast]);

  const linkFileToOrder = (fileId: string, orderId: string | null) => {
    setDriveFiles(prev => prev.map(f => f.id === fileId ? { ...f, linkedOrderId: orderId } : f));
    setSelectedFile(null);
  };

  const uploadAndLinkPhoto = async (file: DriveFile): Promise<string | null> => {
    try {
      setDriveFiles(prev => prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'uploading' } : f));
      
      // Gunakan URL Google Drive langsung (bypass Firebase Storage)
      const downloadURL = file.thumbnailLink?.replace('=s400', '=s1200') || `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;

      // Simulasi delay kecil agar UI terlihat prosesnya
      await new Promise(r => setTimeout(r, 200));

      setDriveFiles(prev => prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'done', uploadedUrl: downloadURL } : f));
      return downloadURL;
    } catch (err) {
      console.error('Link error:', err);
      setDriveFiles(prev => prev.map(f => f.id === file.id ? { ...f, uploadStatus: 'error' } : f));
      return null;
    }
  };

  const handleAutoLinkWithAI = async () => {
    const unlinked = driveFiles.filter(f => !f.linkedOrderId);
    if (unlinked.length === 0) {
      onShowToast('Semua foto sudah terhubung!', 'info');
      return;
    }

    setIsAutoLinking(true);
    let linkedThisSession = 0;

    const BATCH_SIZE = 5;
    let processedCount = 0;

    for (let i = 0; i < unlinked.length; i += BATCH_SIZE) {
      const batch = unlinked.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (file) => {
        try {
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
          const response = await fetch(downloadUrl);
          if (!response.ok) return;

          const blob = await response.blob();
          const ext = file.name.split('.').pop() || 'jpg';
          const storageFile = new File([blob], `drive_${file.id}.${ext}`, { type: file.mimeType });

          const scanned = await scanImageWithVisionAI(storageFile);
          
          let matchedId = null;
          
          const cName = (scanned.customerName || '').toLowerCase().trim();
          const sName = (scanned.senderName || '').toLowerCase().trim();
          const hasScannedName = cName.length >= 3 || sName.length >= 3;

          const checkNameMatch = (r: CustomerRow) => {
            const rNameInsta = (r.namaInstagram || '').toLowerCase().trim();
            const rNameShip = (r.namaPengiriman || '').toLowerCase().trim();
            
            const matchesInsta = rNameInsta && rNameInsta !== '-' && rNameInsta.length >= 3 &&
              (cName.includes(rNameInsta) || rNameInsta.includes(cName) ||
               sName.includes(rNameInsta) || rNameInsta.includes(sName));
               
            const matchesShip = rNameShip && rNameShip !== '-' && rNameShip.length >= 3 &&
              (cName.includes(rNameShip) || rNameShip.includes(cName) ||
               sName.includes(rNameShip) || rNameShip.includes(sName));

            return matchesInsta || matchesShip;
          };

          const isConflictingName = (r: CustomerRow) => {
            if (!hasScannedName) return false;
            
            const rNameInsta = (r.namaInstagram || '').toLowerCase().trim();
            const rNameShip = (r.namaPengiriman || '').toLowerCase().trim();
            
            const hasInsta = rNameInsta && rNameInsta !== '-' && rNameInsta.length >= 3;
            const hasShip = rNameShip && rNameShip !== '-' && rNameShip.length >= 3;
            
            if (!hasInsta && !hasShip) return false;
            
            return !checkNameMatch(r);
          };

          let nameMatchedRow = null;
          if (hasScannedName) {
            const nameMatches = rows.filter(r => checkNameMatch(r));
            if (nameMatches.length === 1) {
              nameMatchedRow = nameMatches[0];
            } else if (nameMatches.length > 1 && scanned.amount && scanned.amount > 0) {
              const matchesAmountAndName = nameMatches.filter(r => {
                const clean = parseInt((r.totalBayar || '').replace(/\D/g, ''), 10);
                return clean === scanned.amount;
              });
              if (matchesAmountAndName.length > 0) {
                nameMatchedRow = matchesAmountAndName[0];
              }
            }
          }

          if (nameMatchedRow) {
            matchedId = nameMatchedRow.id;
          } else if (scanned.amount && scanned.amount > 0) {
            const exactAmountMatches = rows.filter(r => {
              const clean = parseInt((r.totalBayar || '').replace(/\D/g, ''), 10);
              return clean === scanned.amount;
            });
            const nonConflictingMatches = exactAmountMatches.filter(r => !isConflictingName(r));
            if (nonConflictingMatches.length === 1) {
              matchedId = nonConflictingMatches[0].id;
            }
          }

          if (matchedId) {
            setDriveFiles(prev => prev.map(f => f.id === file.id ? { ...f, linkedOrderId: matchedId } : f));
            linkedThisSession++;
          }
        } catch (err) {
          console.error('Auto-link failed for', file.name, err);
        } finally {
          processedCount++;
          setAutoLinkProgress(`Menganalisis ${processedCount} dari ${unlinked.length} foto dengan AI...`);
        }
      }));
    }

    setIsAutoLinking(false);
    setAutoLinkProgress('');
    if (linkedThisSession > 0) {
      onShowToast(`Selesai! AI berhasil menemukan kecocokan untuk ${linkedThisSession} foto.`, 'success');
    } else {
      onShowToast('Selesai, namun AI tidak menemukan data pesanan yang cocok untuk sisa foto ini.', 'info');
    }
  };

  const handleUploadAll = async () => {
    const linkedFiles = driveFiles.filter(f => f.linkedOrderId && f.uploadStatus === 'pending');
    if (linkedFiles.length === 0) {
      onShowToast('Belum ada foto yang dihubungkan ke pesanan.', 'info');
      return;
    }

    setUploadingAll(true);
    const updatedOrders: Record<string, string[]> = {};

    for (const file of linkedFiles) {
      const url = await uploadAndLinkPhoto(file);
      if (url && file.linkedOrderId) {
        if (!updatedOrders[file.linkedOrderId]) updatedOrders[file.linkedOrderId] = [];
        updatedOrders[file.linkedOrderId].push(url);
      }
    }

    // Save to Firestore via editedOrders
    const editedOrders: Record<string, any> = {};
    for (const [orderId, urls] of Object.entries(updatedOrders)) {
      const existingOrder = rows.find(r => r.id === orderId);
      const existingAttachments = existingOrder?.attachments || [];
      editedOrders[orderId] = {
        gambar: urls[0], // first photo as main product image
        attachments: [...existingAttachments, ...urls],
      };
    }

    if (Object.keys(editedOrders).length > 0) {
      await mergeAndUploadLocal({
        newCustomers: [],
        editedCustomers: {},
        deletedCustomerIds: [],
        newOrders: [],
        editedOrders,
        deletedOrderIds: [],
        inventoryLogs: [],
      });
      onShowToast(`🎉 ${Object.keys(updatedOrders).length} pesanan berhasil dihubungkan dengan foto!`, 'success');
      setStep('upload');
    }

    setUploadingAll(false);
  };

  const filteredOrders = rows.filter(r => {
    const q = orderSearch.toLowerCase();
    return (
      r.namaInstagram?.toLowerCase().includes(q) ||
      r.tanggalOrder?.includes(q) ||
      r.jenis?.toLowerCase().includes(q) ||
      r.id?.toLowerCase().includes(q)
    );
  }).slice(0, 50);

  const linkedCount = driveFiles.filter(f => f.linkedOrderId).length;
  const uploadedCount = driveFiles.filter(f => f.uploadStatus === 'done').length;

  return (
    <div className="page-body">
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #4285F4, #34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HardDrive size={24} color="white" />
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Google Drive Photo Linker</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Ambil foto dari Google Drive → hubungkan langsung ke pesanan tanpa memakan kuota Storage</p>
        </div>
        {driveFiles.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600 }}>
              {driveFiles.length} foto
            </span>
            {linkedCount > 0 && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
                {linkedCount} terhubung
              </span>
            )}
            {uploadedCount > 0 && (
              <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(124,58,237,0.1)', color: 'var(--accent-purple)', fontWeight: 600 }}>
                {uploadedCount} tersimpan
              </span>
            )}
          </div>
        )}
      </div>

      {/* Step 1: API Key + Folder Setup */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: step === 'connect' ? 'var(--accent-purple)' : '#10b981', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>1</span>
          Koneksi Google Drive
        </h3>

        {/* API Key Section */}
        {showApiKeyInput ? (
          <div style={{ marginBottom: 20, padding: 16, background: 'rgba(251,191,36,0.08)', border: '1px dashed rgba(251,191,36,0.4)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Key size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Masukkan Google API Key</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
              Buat API Key di <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" style={{ color: '#4285F4', fontWeight: 600 }}>Google Cloud Console</a> → APIs & Services → Credentials → Create Credentials → API Key. 
              Kemudian aktifkan <strong>Google Drive API</strong> di <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" style={{ color: '#4285F4', fontWeight: 600 }}>sini</a>.
              Folder Google Drive harus di-share ke "Anyone with the link".
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button
                onClick={saveApiKey}
                style={{ padding: '9px 16px', borderRadius: 8, background: '#4285F4', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Simpan
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
            <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Google API Key tersimpan</span>
            <button onClick={() => setShowApiKeyInput(true)} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Ganti</button>
          </div>
        )}

        {/* Folder URL */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 6 }}>URL / ID Folder Google Drive</label>
            <input
              type="text"
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderInput}
              onChange={e => setFolderInput(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={fetchDriveFiles}
              disabled={loading || !apiKey}
              style={{ padding: '10px 20px', borderRadius: 10, background: loading ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #4285F4, #34A853)', color: loading ? 'var(--text-muted)' : 'white', border: 'none', cursor: loading || !apiKey ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderOpen size={16} />}
              {loading ? 'Memuat...' : 'Muat Foto'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 12.5, color: '#ef4444', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
      </div>

      {/* Step 2: Link Photos to Orders */}
      {driveFiles.length > 0 && (
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Left: Drive Photos Grid */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-purple)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>2</span>
                Pilih Foto ({driveFiles.length})
              </h3>
              <button
                onClick={handleAutoLinkWithAI}
                disabled={isAutoLinking}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 20,
                  background: isAutoLinking ? 'var(--bg-tertiary)' : 'rgba(124,58,237,0.1)',
                  color: isAutoLinking ? 'var(--text-muted)' : 'var(--accent-purple)',
                  border: isAutoLinking ? '1px solid var(--border)' : '1px solid rgba(124,58,237,0.2)',
                  fontSize: 12, fontWeight: 700, cursor: isAutoLinking ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isAutoLinking ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={14} />}
                {isAutoLinking ? 'Menganalisis...' : 'Auto-Link AI'}
              </button>
            </div>
            {isAutoLinking && (
              <div style={{ padding: '8px 12px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                {autoLinkProgress}
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Klik foto untuk memilih manual, atau gunakan tombol Auto-Link AI untuk menjodohkan otomatis.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {driveFiles.map(file => (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: selectedFile?.id === file.id
                      ? '2px solid var(--accent-purple)'
                      : file.linkedOrderId
                      ? '2px solid #10b981'
                      : '1px solid var(--border)',
                    cursor: 'pointer',
                    background: 'var(--bg-tertiary)',
                    transition: 'all 0.15s',
                    transform: selectedFile?.id === file.id ? 'scale(1.03)' : 'scale(1)',
                  }}
                >
                  <img
                    src={file.thumbnailLink || `https://drive.google.com/thumbnail?id=${file.id}&sz=w400`}
                    alt={file.name}
                    referrerPolicy="no-referrer"
                    style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block', background: 'var(--bg-card)' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('alt=media')) {
                        // Fallback to full image download via API key if thumbnail fails
                        target.src = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
                      }
                    }}
                  />

                  {/* Status badge */}
                  {file.uploadStatus === 'done' && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: '#10b981', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={11} color="white" />
                    </div>
                  )}
                  {file.uploadStatus === 'uploading' && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: '#3b82f6', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={11} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                  )}
                  {file.uploadStatus === 'error' && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <XCircle size={11} color="white" />
                    </div>
                  )}
                  {file.linkedOrderId && file.uploadStatus !== 'done' && (
                    <div style={{ position: 'absolute', top: 4, left: 4, background: '#10b981', borderRadius: 4, padding: '1px 4px', fontSize: 9, color: 'white', fontWeight: 700 }}>LINKED</div>
                  )}

                  <div style={{ padding: '4px 6px', fontSize: 9.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Order List */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ArrowRight size={16} style={{ color: 'var(--accent-purple)' }} />
              {selectedFile ? (
                <span>Pilih pesanan untuk <em style={{ color: 'var(--accent-purple)' }}>{selectedFile.name}</em></span>
              ) : 'Pilih foto terlebih dahulu →'}
            </h3>

            {selectedFile && (
              <div style={{ marginBottom: 12, padding: 10, background: 'rgba(124,58,237,0.08)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedFile.thumbnailLink && (
                  <img src={selectedFile.thumbnailLink} alt={selectedFile.name} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedFile.name}</div>
                  {selectedFile.linkedOrderId && (
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>
                      ✓ Terhubung ke: {rows.find(r => r.id === selectedFile.linkedOrderId)?.namaInstagram || selectedFile.linkedOrderId}
                    </div>
                  )}
                </div>
                {selectedFile.linkedOrderId && (
                  <button
                    onClick={() => linkFileToOrder(selectedFile.id, null)}
                    style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Unlink size={11} /> Lepas
                  </button>
                )}
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cari nama pelanggan, tanggal, produk..."
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
              {filteredOrders.map(order => {
                const isLinked = driveFiles.some(f => f.linkedOrderId === order.id);
                const isThisLinked = selectedFile?.linkedOrderId === order.id;
                return (
                  <div
                    key={order.id}
                    onClick={() => selectedFile && linkFileToOrder(selectedFile.id, isThisLinked ? null : order.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isThisLinked
                        ? '1.5px solid var(--accent-purple)'
                        : isLinked
                        ? '1.5px solid #10b981'
                        : '1px solid var(--border)',
                      background: isThisLinked
                        ? 'rgba(124,58,237,0.06)'
                        : isLinked
                        ? 'rgba(16,185,129,0.05)'
                        : 'var(--bg-card)',
                      cursor: selectedFile ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {order.namaInstagram}
                          {isLinked && <span style={{ fontSize: 9, padding: '1px 5px', background: '#10b981', color: 'white', borderRadius: 4 }}>FOTO ✓</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {order.tanggalOrder} · {order.jenis || 'Pesanan'} · {order.totalBayar}
                        </div>
                      </div>
                      {isThisLinked && <CheckCircle2 size={16} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />}
                    </div>
                  </div>
                );
              })}
              {filteredOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  Tidak ada pesanan yang sesuai dengan pencarian.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Upload Button */}
      {linkedCount > 0 && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: uploadedCount > 0 ? '#10b981' : 'var(--accent-purple)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>3</span>
            Simpan Hubungan ke CRM
          </h3>

          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ textAlign: 'center', padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{driveFiles.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Foto</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(16,185,129,0.05)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{linkedCount}</div>
              <div style={{ fontSize: 11, color: '#10b981' }}>Terhubung ke Pesanan</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(124,58,237,0.05)', borderRadius: 10, border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-purple)' }}>{uploadedCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tersimpan</div>
            </div>
          </div>

          <button
            onClick={handleUploadAll}
            disabled={uploadingAll || linkedCount === 0}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              background: uploadingAll ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--accent-purple), #3b82f6)',
              color: uploadingAll ? 'var(--text-muted)' : 'white',
              border: 'none',
              cursor: uploadingAll ? 'not-allowed' : 'pointer',
              fontWeight: 800,
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s'
            }}
          >
            {uploadingAll ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Menyimpan {linkedCount} foto...
              </>
            ) : (
              <>
                <CloudUpload size={18} />
                Simpan {linkedCount} Foto langsung dari Drive
              </>
            )}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            Foto akan dirender langsung dari Google Drive (Tidak memakan kuota Firebase Storage).
          </p>
        </div>
      )}

      {/* Success State */}
      {step === 'upload' && uploadedCount > 0 && (
        <div style={{ padding: 24, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, textAlign: 'center' }}>
          <CheckCircle2 size={40} style={{ color: '#10b981', marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginBottom: 8 }}>Berhasil! 🎉</h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {uploadedCount} foto berhasil dihubungkan ke pesanan.<br />
            Buka halaman <strong>All Orders</strong>, klik pesanan, dan foto akan tampil di bagian <strong>Lampiran & Foto Bukti</strong>.
          </p>
        </div>
      )}

    </div>
    </div>
  );
}
