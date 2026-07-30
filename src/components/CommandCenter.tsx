import { useState, useEffect, useRef } from 'react';
import {
  Search, CornerDownLeft, Sparkles, LayoutDashboard, Users,
  ShoppingBag, BarChart3, Megaphone, Globe, Settings,
  Sun, Moon, Bell, Copy, RefreshCw, X
} from 'lucide-react';
import type { Customer } from '../types';
import { extractInstagramUsername } from '../utils/socialIntelligenceEngine';
import { TAMPERMONKEY_SCRIPT_CODE } from '../utils/instagramUserScript';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  setPage: (page: any) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  handleToggleTheme: () => void;
  theme: 'dark' | 'light';
  setNotifOpen: (open: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  category: 'Navigasi Cepat' | 'Aksi Sistem' | 'Cari Pelanggan' | 'Aksi CLI (Command Line)';
  icon: React.ReactNode;
  handler: () => void;
}

// Levenshtein distance and fuzzy search helpers for typo tolerance
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (t.includes(q)) return true;
  
  if (q.length < 3) return false;

  const words = t.split(/\s+/);
  for (const word of words) {
    if (getLevenshteinDistance(word, q) <= 2) return true;
  }

  if (getLevenshteinDistance(t, q) <= 2) return true;

  return false;
}

export default function CommandCenter({
  isOpen,
  onClose,
  customers,
  setPage,
  setSelectedCustomer,
  handleToggleTheme,
  theme,
  setNotifOpen,
  showToast
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Generate lists of available commands
  const navigationCommands: CommandItem[] = [
    { id: 'nav-db', label: 'Buka Dashboard Overview', subtitle: 'Pindah ke halaman Overview & Ringkasan Penjualan', category: 'Navigasi Cepat', icon: <LayoutDashboard size={16} />, handler: () => setPage('dashboard') },
    { id: 'nav-pl', label: 'Buka Daftar Pelanggan', subtitle: 'Pindah ke halaman Pengelolaan Database Pelanggan', category: 'Navigasi Cepat', icon: <Users size={16} />, handler: () => { setPage('customers'); setSelectedCustomer(null); } },
    { id: 'nav-tr', label: 'Buka Riwayat Transaksi', subtitle: 'Pindah ke halaman Pengelolaan Order & Nomor Resi', category: 'Navigasi Cepat', icon: <ShoppingBag size={16} />, handler: () => setPage('orders') },
    { id: 'nav-mk', label: 'Buka Marketing Hub', subtitle: 'Akses Broadcast, Flash Sales, dan Re-engagement', category: 'Navigasi Cepat', icon: <Megaphone size={16} />, handler: () => setPage('marketing') },
    { id: 'nav-rd', label: 'Buka Social Radar (IG Scan)', subtitle: 'Pantau momen penting pelanggan via Tampermonkey', category: 'Navigasi Cepat', icon: <Globe size={16} />, handler: () => setPage('social') },
    { id: 'nav-an', label: 'Buka Analisis & Statistik', subtitle: 'Tampilkan grafik distribusi produk terlaris', category: 'Navigasi Cepat', icon: <BarChart3 size={16} />, handler: () => setPage('analytics') },
    { id: 'nav-se', label: 'Buka Pengaturan Toko', subtitle: 'Ubah template pesan WA & kualifikasi kelas VIP', category: 'Navigasi Cepat', icon: <Settings size={16} />, handler: () => setPage('settings') }
  ];

  const systemCommands: CommandItem[] = [
    { id: 'sys-theme', label: `Ganti ke Tema ${theme === 'dark' ? 'Terang ☀️' : 'Gelap 🌙'}`, subtitle: 'Ubah warna antarmuka aplikasi', category: 'Aksi Sistem', icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />, handler: () => { handleToggleTheme(); showToast(`Tema berhasil diubah ke ${theme === 'dark' ? 'Terang' : 'Gelap'}`, 'success'); } },
    { id: 'sys-notif', label: 'Buka Pusat Notifikasi', subtitle: 'Tampilkan panel geser pengingat ultah & idle alerts', category: 'Aksi Sistem', icon: <Bell size={16} />, handler: () => setNotifOpen(true) },
    { id: 'sys-script', label: 'Salin Script Tampermonkey', subtitle: 'Salin kode UserScript integrasi Instagram ke clipboard', category: 'Aksi Sistem', icon: <Copy size={16} />, handler: async () => {
      const ok = await navigator.clipboard.writeText(TAMPERMONKEY_SCRIPT_CODE).then(() => true).catch(() => false);
      if (ok) showToast('Script Tampermonkey berhasil disalin ke clipboard!', 'success');
      else showToast('Gagal menyalin script', 'error');
    } },
    { id: 'sys-sim', label: 'Simulasikan Scan Radar Sosial', subtitle: 'Generate momen simulasi baru pada radar sosial', category: 'Aksi Sistem', icon: <RefreshCw size={16} />, handler: () => {
      localStorage.removeItem('pearlcrm_social_events_cache');
      window.dispatchEvent(new CustomEvent('pearlcrm:trigger_simulation'));
      setPage('social');
      showToast('Simulasi scan AI berhasil dipicu!', 'success');
    } }
  ];

  // Map customers to command items
  const customerCommands: CommandItem[] = customers.map(c => ({
    id: `cust-${c.id}`,
    label: c.nama,
    subtitle: `Instagram: @${extractInstagramUsername(c.instagram) || '-'} | Total Spend: Rp ${c.totalSpend.toLocaleString('id-ID')}`,
    category: 'Cari Pelanggan',
    icon: <Users size={16} style={{ color: '#a78bfa' }} />,
    handler: () => {
      setSelectedCustomer(c);
      setPage('customers');
    }
  }));

  // Filter combined lists based on query
  const filteredItems = (() => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) {
      // Default: show navigation and system commands
      return [...navigationCommands, ...systemCommands];
    }

    // ── CLI COMMAND: wa [nama] [pesan] ──
    if (cleanQuery.startsWith('wa ')) {
      const parts = query.slice(3).trim().split(/\s+/);
      const targetName = parts[0] || '';
      const message = parts.slice(1).join(' ');

      if (targetName) {
        const cleanTarget = targetName.toLowerCase();
        // Find matching customers
        const matchedCusts = customers.filter(c => 
          c.nama.toLowerCase().includes(cleanTarget) ||
          c.instagram.toLowerCase().includes(cleanTarget)
        );

        const cliItems: CommandItem[] = [];

        if (matchedCusts.length > 0) {
          matchedCusts.forEach(c => {
            cliItems.push({
              id: `cli-wa-${c.id}`,
              label: `Kirim WhatsApp ke: ${c.nama}`,
              subtitle: `Pesan: "${message || '(Kosong)'}" | No: ${c.wa || 'Tanpa No'}`,
              category: 'Aksi CLI (Command Line)',
              icon: <Megaphone size={16} style={{ color: '#10b981' }} />,
              handler: () => {
                if (!c.wa) {
                  showToast('Gagal: Pelanggan tidak memiliki nomor WhatsApp!', 'error');
                  return;
                }
                const encodedMsg = encodeURIComponent(message || 'Halo Kak!');
                const url = `https://wa.me/${c.wa.replace(/[^0-9]/g, '').replace(/^0/, '62')}?text=${encodedMsg}`;
                window.open(url, '_blank');
                showToast(`Membuka WhatsApp chat ke ${c.nama}...`, 'success');
              }
            });
          });
        } else {
          const isPhone = /^[0-9+]+$/.test(targetName);
          cliItems.push({
            id: `cli-wa-new`,
            label: `Kirim WhatsApp ke nomor baru: ${targetName}`,
            subtitle: isPhone ? `Kirim pesan: "${message || '(Kosong)'}"` : 'Masukkan nomor telepon yang valid!',
            category: 'Aksi CLI (Command Line)',
            icon: <Megaphone size={16} style={{ color: '#10b981' }} />,
            handler: () => {
              if (!isPhone) {
                showToast('Masukkan nomor telepon angka yang valid!', 'error');
                return;
              }
              const encodedMsg = encodeURIComponent(message || 'Halo Kak!');
              const url = `https://wa.me/${targetName.replace(/[^0-9]/g, '')}?text=${encodedMsg}`;
              window.open(url, '_blank');
            }
          });
        }

        return cliItems;
      }
    }

    // ── CLI COMMAND: order [nama] ──
    if (cleanQuery.startsWith('order ')) {
      const targetName = query.slice(6).trim();
      if (targetName) {
        const cleanTarget = targetName.toLowerCase();
        const matchedCusts = customers.filter(c => 
          c.nama.toLowerCase().includes(cleanTarget) ||
          c.instagram.toLowerCase().includes(cleanTarget)
        );

        const cliItems: CommandItem[] = matchedCusts.map(c => ({
          id: `cli-order-${c.id}`,
          label: `Buat Transaksi Baru untuk: ${c.nama}`,
          subtitle: `Pilih untuk membuka profil ${c.nama} dan mencatat order baru`,
          category: 'Aksi CLI (Command Line)',
          icon: <ShoppingBag size={16} style={{ color: '#8b5cf6' }} />,
          handler: () => {
            setSelectedCustomer(c);
            setPage('customers');
            showToast(`Membuka profil ${c.nama} untuk pembuatan order baru`, 'success');
          }
        }));

        if (cliItems.length === 0) {
          cliItems.push({
            id: 'cli-order-empty',
            label: `Pelanggan "${targetName}" tidak ditemukan`,
            subtitle: 'Ketik nama pelanggan yang terdaftar di CRM',
            category: 'Aksi CLI (Command Line)',
            icon: <X size={16} style={{ color: '#ef4444' }} />,
            handler: () => {}
          });
        }

        return cliItems;
      }
    }
    
    // Filter matching navigation with fuzzy search
    const navs = navigationCommands.filter(item => 
      fuzzyMatch(item.label, cleanQuery) || 
      fuzzyMatch(item.subtitle || '', cleanQuery)
    );

    // Filter matching actions with fuzzy search
    const sys = systemCommands.filter(item => 
      fuzzyMatch(item.label, cleanQuery) || 
      fuzzyMatch(item.subtitle || '', cleanQuery)
    );

    // Filter matching customers (fuzzy match with Lev distance typo tolerance)
    const custs = customerCommands.filter(item => 
      fuzzyMatch(item.label, cleanQuery) || 
      fuzzyMatch(item.subtitle || '', cleanQuery)
    );

    return [...navs, ...sys, ...custs];
  })();

  const totalItems = filteredItems.length;

  // Scroll selected item into view automatically
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector('.command-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard keydown events inside the overlay
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (totalItems > 0 && filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].handler();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, totalItems, filteredItems, onClose]);

  if (!isOpen) return null;

  // Group items by category for rendering headers
  const groupedItems: Record<string, CommandItem[]> = {};
  filteredItems.forEach(item => {
    if (!groupedItems[item.category]) {
      groupedItems[item.category] = [];
    }
    groupedItems[item.category].push(item);
  });

  // Flat array representing order of rendering to match selectedIndex
  let flatRenderIndex = 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '12vh',
      zIndex: 9999999,
      animation: 'fadeIn 0.2s ease'
    }}>
      
      {/* Main command palette box */}
      <div
        ref={containerRef}
        style={{
          width: '640px',
          maxWidth: '92vw',
          background: 'rgba(30, 27, 75, 0.95)', // Deep purple/indigo dark glass
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 18,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(124, 58, 237, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        
        {/* Search header area */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Search size={20} style={{ color: '#a78bfa', marginRight: 14, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Ketik perintah atau nama pelanggan... (Tutup dengan ESC)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 500,
              outline: 'none',
              padding: 0
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, marginLeft: 12 }}>
            ESC
          </span>
        </div>

        {/* Results container */}
        <div
          ref={resultsRef}
          style={{
            maxHeight: '380px',
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            scrollbarWidth: 'thin'
          }}
        >
          {totalItems === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <X size={32} style={{ opacity: 0.2, marginBottom: 12, margin: '0 auto' }} />
              <div style={{ fontSize: 13, fontWeight: 700 }}>Tidak ada hasil ditemukan</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Coba ketik kata kunci lain seperti "dashboard" atau "Rina"</div>
            </div>
          ) : (
            Object.keys(groupedItems).map(category => {
              const items = groupedItems[category];
              return (
                <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  
                  {/* Category Header */}
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', padding: '8px 16px 4px 16px', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {category}
                  </div>

                  {/* Category Items */}
                  {items.map(item => {
                    const currentFlatIndex = flatRenderIndex;
                    flatRenderIndex++; // Increment flat count
                    const isSelected = currentFlatIndex === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        className={`command-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          item.handler();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                        style={{
                          background: isSelected ? undefined : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                          color: isSelected ? '#fff' : '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {item.icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#fff' : '#cbd5e1' }}>
                            {item.label}
                          </div>
                          {item.subtitle && (
                            <div style={{ fontSize: '11px', color: isSelected ? '#c4b5fd' : 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c4b5fd', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            Pilih <CornerDownLeft size={10} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hints */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span>↑↓ Navigasi</span>
            <span>↵ Eksekusi</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} style={{ color: '#a78bfa' }} />
            <span>Pearl Command Center</span>
          </div>
        </div>

      </div>
    </div>
  );
}
