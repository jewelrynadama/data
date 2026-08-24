import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { 
  RefreshCw, Bell, Menu, Grid, Search, Columns, List, 
  BarChart2, Calendar, Plus, ChevronRight, LayoutDashboard,
  Users, ShoppingBag
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import PearlAIChatWidget from './components/PearlAIChatWidget';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const AdsManagerPage = lazy(() => import('./pages/AdsManagerPage'));
const BirthdayPage = lazy(() => import('./pages/BirthdayPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const InvoicePage = lazy(() => import('./pages/InvoicePage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const KanbanPage = lazy(() => import('./pages/KanbanPage'));
const RFMAnalyticsPage = lazy(() => import('./pages/RFMAnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WhatsAppImporterPage = lazy(() => import('./pages/WhatsAppImporterPage'));
const DrivePhotoLinkerPage = lazy(() => import('./pages/DrivePhotoLinkerPage'));
const FinanceAnalyticsPage = lazy(() => import('./pages/FinanceAnalyticsPage'));
const SalesTargetPage = lazy(() => import('./pages/SalesTargetPage'));
const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage'));
const IGAnalyzerPage = lazy(() => import('./pages/IGAnalyzerPage'));
import { loadCustomerData, extractCity, formatWhatsApp, loadCatalogData } from './utils/csvLoader';
import { formatAddress } from './utils/addressHelper';
import type { Customer, CustomerRow, PendingOrder, CatalogItem } from './types';
import './index.css';
import { collection, onSnapshot } from 'firebase/firestore';
import { getBirthdayAlerts } from './utils/birthday';
import {
  saveNewCustomer,
  saveCustomerEdit,
  deleteCustomer,
  saveNewOrder,
  saveOrderEdit,
  deleteOrder,
  mergeData,
  saveInventoryLogs,
} from './utils/localStore';
import type { LocalStore } from './utils/localStore';
import { auth, db } from './utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { cleanPrice } from './utils/csvLoader';
import { subscribeToStore, saveToFirestore, mergeAndUploadLocal } from './utils/firebaseSync';
import LoginScreen from './components/LoginScreen';
import type { StoreSettings } from './pages/SettingsPage';
import NotificationCenter from './components/NotificationCenter';
import { computeNotifications } from './utils/notificationEngine';
// BUG-ST3 fix: logActivity now imported from utils/activityLogger (not ActivityLogPage)
// This resolves the INEFFECTIVE_DYNAMIC_IMPORT Vite warning
import { logActivity } from './utils/activityLogger';
import ErrorBoundary from './components/ErrorBoundary';
const SocialIntelligencePage = lazy(() => import('./pages/SocialIntelligencePage'));
const AITrendsPage = lazy(() => import('./pages/AITrendsPage'));
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage'));
const AffinityMatrixPage = lazy(() => import('./pages/AffinityMatrixPage'));
const ProfitOptimizerPage = lazy(() => import('./pages/ProfitOptimizerPage'));
const DemandForecastPage = lazy(() => import('./pages/DemandForecastPage'));
const BundleRecommenderPage = lazy(() => import('./pages/BundleRecommenderPage'));
const ChatImportPage = lazy(() => import('./pages/ChatImportPage'));
import CommandCenter from './components/CommandCenter';
import JarvisVoiceAI from './components/JarvisVoiceAI';

import { extractInstagramUsername } from './utils/socialIntelligenceEngine';
import { requestNotificationPermission, sendBirthdayNotifications, sendVipInactiveNotifications } from './utils/pushNotification';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Pearl Store',
  storePhone: '081234567890',
  storeInstagram: 'pearlstore',
  voucherCode: 'BDAY10',
  voucherType: 'percent',
  voucherValue: 10,
  vipMinSpend: 15000000,
  loyalMinOrders: 3,
  birthdayMessageTemplate: '🎂 Selamat Ulang Tahun Kak {customerName}! 🎉\n\nSemoga hari spesial Kakak dipenuhi kebahagiaan dan selalu dalam lindungan-Nya. Terima kasih sudah menjadi pelanggan setia {storeName}! 💎✨{vipNote}\n\nSalam hangat,\n💎 {storeName}',
  shippingMessageTemplate: 'Halo Kak {customerName}! Terima kasih atas ordernya di toko kami. Pesanan perhiasan {productName} Kakak telah dikirim menggunakan kurir {courierName} dengan nomor resi *{resi}*. Semoga suka dengan perhiasannya! 💎✨',
  appName: 'PearlCRM',
  loginTitle: 'PearlCRM Access',
  loginSubtitle: 'Silakan login untuk mengakses dashboard mutiara',
  loginLogoEmoji: '🛡️',
  invoiceAccentColor: '#0f172a',
  invoiceFooterNote: 'Terima kasih atas kunjungan & kepercayaan Anda berbelanja di toko kami!',
  labelFooterNote: '',
  printPaperSize: 'A4',
  printOrientation: 'portrait',
  printMarginUnit: 'mm',
  printMarginTop: '15',
  printMarginRight: '15',
  printMarginBottom: '15',
  printMarginLeft: '15',
  printCustomWidth: '210',
  printCustomHeight: '297'
};

type Page = 'dashboard' | 'customers' | 'orders' | 'marketing' | 'ads-manager' | 'social' | 'analytics' | 'rfm-analytics' | 'finance-analytics' | 'export' | 'settings' | 'birthday' | 'reports' | 'invoice' | 'inventory' | 'kanban' | 'catalog' | 'ai-trends' | 'whatsapp-importer' | 'whatsapp-scanner' | 'whatsapp-inbox' | 'drive-photo-linker' | 'sales-target' | 'activity-log' | 'ig-analyzer' | 'command-center' | 'affinity-matrix' | 'profit-optimizer' | 'demand-forecast' | 'bundle-recommender' | 'chat-history';

const PAGE_TITLES: Record<Page, { title: string; subtitle: string }> = {
  dashboard:  { title: 'Overview',           subtitle: 'Key metrics and insights at a glance' },
  customers:  { title: 'Customers',          subtitle: 'Manage and explore customer profiles' },
  orders:     { title: 'All Orders',         subtitle: 'View and filter every transaction' },
  kanban:     { title: 'Kanban Tracker',     subtitle: 'Visual board status pesanan' },
  marketing:  { title: 'Marketing Hub',      subtitle: 'Campaigns, Flash Sales, and Re-engagement' },
  'ads-manager': { title: 'Ads & Social Manager', subtitle: 'Lacak Iklan IG, Jadwal Konten & WA Campaign' },
  social:     { title: 'Kalender Momen',     subtitle: 'Pantau momen spesial dan ulang tahun pelanggan' },
  'ai-trends':{ title: 'AI Market Radar',    subtitle: 'Analisis tren pasar dan kompetitor secara instan' },
  analytics:  { title: 'Analytics',          subtitle: 'Deep-dive charts and distributions' },
  'rfm-analytics': { title: 'RFM Analytics', subtitle: 'Customer Segmentation based on Recency, Frequency, Monetary' },
  'finance-analytics': { title: 'Analisis Keuangan', subtitle: 'Laporan keuangan mendalam, profitabilitas, arus kas & saran AI' },
  birthday:   { title: 'Birthday Tracker',   subtitle: 'Kelola ucapan ulang tahun pelanggan' },
  reports:    { title: 'Laporan Bulanan',    subtitle: 'Ringkasan performa toko per bulan' },
  invoice:    { title: 'Invoice Generator', subtitle: 'Generate dan cetak invoice transaksi' },
  inventory:  { title: 'Stok / Inventory',  subtitle: 'Pantau dan kelola stok produk' },
  catalog:    { title: 'Katalog Produk',     subtitle: 'Analisis produk terlaris dari data order' },
  export:     { title: 'Export Data',        subtitle: 'Download your data in various formats' },
  settings:   { title: 'Store Settings',     subtitle: 'Configure store details and classification thresholds' },
  'whatsapp-importer': { title: 'WhatsApp Importer', subtitle: 'Import data pelanggan dari chat WhatsApp' },
  'whatsapp-scanner': { title: 'Hubungkan WA', subtitle: 'Scan QR Code untuk integrasi WhatsApp' },
  'whatsapp-inbox': { title: 'WA Live Inbox', subtitle: 'Chat langsung dengan pelanggan' },
  'drive-photo-linker': { title: 'Drive Photo Linker', subtitle: 'Hubungkan foto Google Drive ke pesanan CRM' },
  'sales-target': { title: 'Sales Target', subtitle: 'Tetapkan & pantau target penjualan bulanan' },
  'activity-log': { title: 'Activity Log', subtitle: 'Riwayat semua aktivitas tambah, edit & hapus data' },
  'ig-analyzer':  { title: 'IG Analyzer',  subtitle: 'Analisis cerdas profil Instagram pelanggan (Mock)' },
  'command-center': { title: 'PearlMind™ Command Center', subtitle: '5 AI engines: DNA Fingerprint · Autopilot · Forecast · Cohort · Health Score' },
  'affinity-matrix': { title: 'Product Affinity Matrix™', subtitle: 'Temukan pasangan produk yang paling sering dibeli bersama' },
  'profit-optimizer': { title: 'Product Profit Optimizer™', subtitle: 'Analisis margin & efisiensi produk untuk memaksimalkan profit' },
  'demand-forecast': { title: 'Demand Forecasting', subtitle: 'Prediksi permintaan produk 3 bulan ke depan berdasarkan tren historis' },
  'bundle-recommender': { title: 'Smart Bundle Recommender™', subtitle: 'Kombinasi produk cerdas berdasarkan pola pembelian customer' },
  'chat-history': { title: 'WhatsApp Chat History', subtitle: 'Lihat riwayat chat WhatsApp per pelanggan — 100% privat, tersimpan di perangkat Anda' },
};

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Force reset any rogue scroll position that Chrome might have restored
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Also reset overflow containers that might have been scrolled by scrollIntoView
    const appShell = document.querySelector('.app-shell');
    if (appShell) appShell.scrollTop = 0;
    
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
    
    const pagesContainer = document.querySelector('.pages-container');
    if (pagesContainer) pagesContainer.scrollTop = 0;
  }, [page]);
  
  // Store settings state
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const saved = localStorage.getItem('pearlcrm_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  useEffect(() => {
    if (!showAdminDropdown) return;
    const closeDropdown = () => setShowAdminDropdown(false);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [showAdminDropdown]);

  const handleSaveSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    localStorage.setItem('pearlcrm_settings', JSON.stringify(newSettings));
    showToast('Pengaturan toko berhasil disimpan!', 'success');
  };

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Custom global styles are no longer needed
  useEffect(() => {
    // Removed style injection
  }, []);

  useEffect(() => {
    document.title = settings.appName || 'PearlCRM';
  }, [settings.appName]);

  const handleToggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };
  
  // Auth states
  // BUG-10 fix: proper User type instead of any
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Raw sheets data
  const [rawCustomers, setRawCustomers] = useState<Customer[]>([]);
  const [rawRows, setRawRows] = useState<CustomerRow[]>([]);

  // Merged data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // Local/Online mutations store
  const [storeData, setStoreData] = useState<LocalStore>({
    newCustomers: [],
    editedCustomers: {},
    deletedCustomerIds: [],
    newOrders: [],
    editedOrders: {},
    deletedOrderIds: [],
    inventoryLogs: [],
    customerCRMState: {},
  });

  const storeDataRef = useRef(storeData);
  useEffect(() => {
    storeDataRef.current = storeData;
  }, [storeData]);

  const [localTrigger, setLocalTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  // pendingOrders removed
  

  // CommandCenter states & listeners
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandCenterOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Push notifications: request permission once, send birthday + VIP alerts
  useEffect(() => {
    requestNotificationPermission().then(() => {
      // Will auto-send when customers are loaded (triggered by customers change)
    });
  }, []);

  useEffect(() => {
    if (customers.length === 0) return;
    const alerts = getBirthdayAlerts(customers);
    sendBirthdayNotifications(alerts, settings.storeName || 'Pearl Store');
    sendVipInactiveNotifications(customers, settings.storeName || 'Pearl Store', settings.vipMinSpend);
  }, [customers, settings.storeName, settings.vipMinSpend]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const result = await loadCustomerData();
      setRawCustomers(result.customers);
      setRawRows(result.rows);
      
      const merged = mergeData(result.customers, result.rows, storeDataRef.current);
      setCustomers(merged.customers);
      setRows(merged.rows);

      try {
        const catalog = await loadCatalogData();
        setCatalogItems(catalog);
      } catch (catErr) {
        console.error('Failed to load catalog data', catErr);
      }

      if (isRefresh) showToast(`Data refreshed — ${merged.customers.length} customers loaded`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // Listen to Auth state
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Migrate old standalone inventory logs
  useEffect(() => {
    try {
      const oldLogs = localStorage.getItem('inventory_movement_logs');
      if (oldLogs) {
        const parsed = JSON.parse(oldLogs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveInventoryLogs(parsed);
          setLocalTrigger(t => t + 1);
        }
        localStorage.removeItem('inventory_movement_logs');
      }
    } catch (e) {
      console.error('Failed to migrate old inventory logs', e);
    }
  }, []);

  // Listen to Firestore updates if logged in, otherwise use localStorage
  useEffect(() => {
    if (user) {
      const unsub = subscribeToStore((data) => {
        setStoreData(data);
      });

      // Auto-upload localStorage to Firestore on first login
      const local = localStorage.getItem('pearlcrm_local_v1');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          const hasLocalData =
            (parsed.newCustomers && parsed.newCustomers.length > 0) ||
            (parsed.newOrders && parsed.newOrders.length > 0) ||
            (parsed.editedCustomers && Object.keys(parsed.editedCustomers).length > 0) ||
            (parsed.deletedCustomerIds && parsed.deletedCustomerIds.length > 0) ||
            (parsed.deletedOrderIds && parsed.deletedOrderIds.length > 0) ||
            (parsed.inventoryLogs && parsed.inventoryLogs.length > 0);

          if (hasLocalData) {
            if (window.confirm('Ditemukan data input manual offline di laptop ini. Apakah Anda ingin mengunggah dan menggabungkannya ke cloud online agar bisa diakses dari laptop lain?')) {
              mergeAndUploadLocal(parsed).then(() => {
                localStorage.removeItem('pearlcrm_local_v1');
                showToast('Data offline berhasil digabungkan ke cloud!', 'success');
              });
            }
          }
        } catch (e) {
          console.error('Failed to parse offline data:', e);
        }
      }

      return unsub;
    } else {
      // Offline fallback: read from localStorage
      const local = localStorage.getItem('pearlcrm_local_v1');
      if (local) {
        try {
          setStoreData(JSON.parse(local));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [user, localTrigger, showToast]);

  useEffect(() => {
    loadData();

    // Auto-sync data every 12 hours
    const syncInterval = setInterval(() => {
      loadData(true);
    }, 12 * 60 * 60 * 1000);

    return () => clearInterval(syncInterval);
  }, [loadData]);

  // Sync username list to browser environment for Tampermonkey
  useEffect(() => {
    const activeList = customers
      .filter(c => c.instagram && c.instagram.trim() !== '' && c.instagram !== '-')
      .map(c => ({
        id: c.id,
        nama: c.nama,
        instagram: extractInstagramUsername(c.instagram),
        wa: c.wa
      }));
    
    // Dispatch custom event for Tampermonkey connector running on CRM page
    window.dispatchEvent(new CustomEvent('pearlcrm:sync_monitored', {
      detail: {
        customers: activeList,
        settings: {
          storeName: settings.storeName,
          birthdayMessageTemplate: settings.birthdayMessageTemplate,
          shippingMessageTemplate: settings.shippingMessageTemplate
        }
      }
    }));
  }, [customers, settings]);

  // Re-merge when raw data or store data changes
  useEffect(() => {
    if (rawCustomers.length || rawRows.length) {
      const merged = mergeData(rawCustomers, rawRows, storeData);
      setCustomers(merged.customers);
      setRows(merged.rows);
    }
  }, [rawCustomers, rawRows, storeData]);

  // BUG-03 fix: use ref to track previous count so we don't re-subscribe on every change
  const prevPendingCountRef = useRef(0);

  // Listen to pending orders from Firestore in real-time
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, 'pending_orders');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: PendingOrder[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PendingOrder);
      });

      // BUG-07 fix: use .catch() to handle async rejection from autoplay policy
      // Play a premium crystal chime sound if a new order arrives
      if (list.length > prevPendingCountRef.current && prevPendingCountRef.current > 0) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
        audio.volume = 0.5;
        audio.play().catch((e) => console.log('Audio play failed:', e));
        showToast('📥 Orderan Baru Masuk!', 'info');
      }
      prevPendingCountRef.current = list.length;
      // setPendingOrders(list);
    }, (err) => {
      console.error('Pending orders subscription error:', err);
    });
    return unsubscribe;
  }, [db, showToast]);

  const handleAddCustomer = useCallback((newC: { nama: string; instagram?: string; wa?: string; alamat?: string; tanggalUlangTahun?: string; city?: string; orders?: CustomerRow[] }) => {
    const customer: Customer = {
      id: `local-customer-${Date.now()}`,
      nama: newC.nama,
      instagram: newC.instagram || '',
      wa: newC.wa ? formatWhatsApp(newC.wa) : '',
      alamat: newC.alamat ? formatAddress(newC.alamat) : '',
      tanggalUlangTahun: newC.tanggalUlangTahun || '',
      city: newC.city || '',
      orders: newC.orders || [],
      orderCount: newC.orders ? newC.orders.length : 0,
      // BUG-04 fix: use cleanPrice() instead of Number() to handle Rupiah formatted strings like "1.500.000"
      totalSpend: newC.orders ? newC.orders.reduce((sum, o) => sum + cleanPrice(o.totalBayar), 0) : 0,
      lastOrder: '',
    };
    if (user) {
      const nextData = {
        ...storeData,
        newCustomers: [...storeData.newCustomers.filter((x: any) => x.id !== customer.id), customer]
      };
      saveToFirestore(nextData);
    } else {
      saveNewCustomer(customer);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'add', entity: 'customer', label: customer.nama });
    showToast(`Customer "${customer.nama}" added successfully`, 'success');
  }, [showToast, user, storeData]);

  const handleEditCustomer = useCallback((id: string, patch: Partial<Customer>) => {
    const formattedPatch = { ...patch };
    if (formattedPatch.wa) {
      formattedPatch.wa = formatWhatsApp(formattedPatch.wa);
    }
    if (formattedPatch.alamat) {
      formattedPatch.alamat = formatAddress(formattedPatch.alamat);
    }
    if (user) {
      const nextData = {
        ...storeData,
        editedCustomers: {
          ...storeData.editedCustomers,
          [id]: { ...(storeData.editedCustomers[id] ?? {}), ...formattedPatch }
        }
      };
      saveToFirestore(nextData);
    } else {
      saveCustomerEdit(id, formattedPatch);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'edit', entity: 'customer', label: id, details: Object.keys(formattedPatch).join(', ') });
    showToast('Customer updated successfully', 'success');
  }, [showToast, user, storeData]);

  const handleDeleteCustomer = useCallback((id: string) => {
    if (user) {
      const nextData = {
        ...storeData,
        deletedCustomerIds: [...new Set([...storeData.deletedCustomerIds, id])],
        newCustomers: storeData.newCustomers.filter((c: any) => c.id !== id)
      };
      saveToFirestore(nextData);
    } else {
      deleteCustomer(id);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'delete', entity: 'customer', label: id });
    showToast('Customer deleted successfully', 'success');
  }, [showToast, user, storeData]);

  const handleAddOrder = useCallback((orderData: Partial<CustomerRow>) => {
    const custName = orderData.namaInstagram || '';
    let updatedNewCusts = [...storeData.newCustomers];

    if (custName) {
      const exists = customers.some((c) => c.nama.toLowerCase() === custName.toLowerCase());
      if (!exists) {
        const customer: Customer = {
          id: `local-customer-${Date.now()}`,
          nama: custName,
          instagram: orderData.instagram || '',
          wa: orderData.wa ? formatWhatsApp(orderData.wa) : '',
          alamat: orderData.alamat ? formatAddress(orderData.alamat) : '',
          tanggalUlangTahun: orderData.tanggalUlangTahun || '',
          city: orderData.alamat ? extractCity(orderData.alamat) : '',
          orders: [],
          orderCount: 0,
          totalSpend: 0,
          lastOrder: '',
        };
        if (user) {
          updatedNewCusts = [...updatedNewCusts.filter((x: any) => x.id !== customer.id), customer];
        } else {
          saveNewCustomer(customer);
        }
      }
    }

    const order: CustomerRow = {
      id: `local-row-${Date.now()}`,
      namaInstagram: orderData.namaInstagram || '',
      instagram: orderData.instagram || '',
      tanggalOrder: orderData.tanggalOrder || '',
      tanggalUlangTahun: orderData.tanggalUlangTahun || '',
      namaPengiriman: orderData.namaPengiriman || '',
      alamat: orderData.alamat ? formatAddress(orderData.alamat) : '',
      wa: orderData.wa ? formatWhatsApp(orderData.wa) : '',
      kode: orderData.kode || '',
      jenis: orderData.jenis || '',
      gambar: orderData.gambar || '',
      rangka: orderData.rangka || '',
      gramasiRangka: orderData.gramasiRangka || '',
      kodeType: orderData.kodeType || '',
      type: orderData.type || '',
      weight: orderData.weight || '',
      size: orderData.size || '',
      kodeShape: orderData.kodeShape || '',
      shape: orderData.shape || '',
      color: orderData.color || '',
      grade: orderData.grade || '',
      stone: orderData.stone || '',
      stoneWeight: orderData.stoneWeight || '',
      amount: orderData.amount || '',
      terbilang: orderData.terbilang || '',
      qty: orderData.qty || '1',
      paymentVia: orderData.paymentVia || '',
      totalBayar: orderData.totalBayar || '',
      ongkir: orderData.ongkir || '',
      hargaBersih: orderData.hargaBersih || '',
      kurir: orderData.kurir || '',
      keterangan: orderData.keterangan || '',
      resi: orderData.resi || '',
      raw: [],
    };

    if (user) {
      const nextData = {
        ...storeData,
        newCustomers: updatedNewCusts,
        newOrders: [...storeData.newOrders.filter((x: any) => x.id !== order.id), order]
      };
      saveToFirestore(nextData);
    } else {
      saveNewOrder(order);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'add', entity: 'order', label: `${orderData.namaInstagram || 'Unknown'} — ${orderData.jenis || ''}` });
    showToast('Order added successfully', 'success');
  }, [showToast, customers, user, storeData]);

  // BUG-06 fix: handleBatch functions declared BEFORE handleEditOrder/handleDeleteOrder
  // to avoid referencing a const before it's defined in the closure chain.
  const handleBatchEditOrders = useCallback((rawIds: string[], patch: Partial<CustomerRow>) => {
    const ids = rawIds.flatMap(id => id.split(','));
    const formattedPatch = { ...patch };
    if (formattedPatch.wa) {
      formattedPatch.wa = formatWhatsApp(formattedPatch.wa);
    }
    if (formattedPatch.alamat) {
      formattedPatch.alamat = formatAddress(formattedPatch.alamat);
    }
    if (user) {
      const nextEditedOrders = { ...storeData.editedOrders };
      ids.forEach(id => {
        nextEditedOrders[id] = { ...(nextEditedOrders[id] ?? {}), ...formattedPatch };
      });
      const nextData = {
        ...storeData,
        editedOrders: nextEditedOrders
      };
      saveToFirestore(nextData);
    } else {
      ids.forEach(id => {
        saveOrderEdit(id, formattedPatch);
      });
      setLocalTrigger((t) => t + 1);
    }
    showToast(`${ids.length} orders updated successfully`, 'success');
  }, [showToast, user, storeData]);

  const handleBatchDeleteOrders = useCallback((rawIds: string[]) => {
    const ids = rawIds.flatMap(id => id.split(','));
    if (user) {
      const nextData = {
        ...storeData,
        deletedOrderIds: [...new Set([...storeData.deletedOrderIds, ...ids])],
        newOrders: storeData.newOrders.filter((o: any) => !ids.includes(o.id))
      };
      saveToFirestore(nextData);
    } else {
      ids.forEach(id => {
        deleteOrder(id);
      });
      setLocalTrigger((t) => t + 1);
    }
    showToast(`${ids.length} orders deleted successfully`, 'success');
  }, [showToast, user, storeData]);

  const handleEditOrder = useCallback((id: string, patch: Partial<CustomerRow>) => {
    if (id.includes(',')) {
      handleBatchEditOrders(id.split(','), patch);
      return;
    }
    const formattedPatch = { ...patch };
    if (formattedPatch.wa) {
      formattedPatch.wa = formatWhatsApp(formattedPatch.wa);
    }
    if (formattedPatch.alamat) {
      formattedPatch.alamat = formatAddress(formattedPatch.alamat);
    }
    if (user) {
      const nextData = {
        ...storeData,
        editedOrders: {
          ...storeData.editedOrders,
          [id]: { ...(storeData.editedOrders[id] ?? {}), ...formattedPatch }
        }
      };
      saveToFirestore(nextData);
    } else {
      saveOrderEdit(id, formattedPatch);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'edit', entity: 'order', label: id, details: Object.keys(formattedPatch).join(', ') });
    showToast('Order updated successfully', 'success');
  }, [showToast, user, storeData, handleBatchEditOrders]);

  const handleDeleteOrder = useCallback((id: string) => {
    if (id.includes(',')) {
      handleBatchDeleteOrders(id.split(','));
      return;
    }
    if (user) {
      const nextData = {
        ...storeData,
        deletedOrderIds: [...new Set([...storeData.deletedOrderIds, id])],
        newOrders: storeData.newOrders.filter((o: any) => o.id !== id)
      };
      saveToFirestore(nextData);
    } else {
      deleteOrder(id);
      setLocalTrigger((t) => t + 1);
    }
    logActivity({ type: 'delete', entity: 'order', label: id });
    showToast('Order deleted successfully', 'success');
  }, [showToast, user, storeData, handleBatchDeleteOrders]);

  const handleUpdateInventoryLogs = useCallback((newLogs: any[]) => {
    if (user) {
      const nextData = {
        ...storeData,
        inventoryLogs: newLogs
      };
      saveToFirestore(nextData);
    } else {
      saveInventoryLogs(newLogs);
      setLocalTrigger((t) => t + 1);
    }
  }, [user, storeData]);

  const birthdayAlerts = useMemo(() => {
    return getBirthdayAlerts(customers);
  }, [customers]);

  // ── Smart Notification Center ────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pearlcrm_read_notifs') || '[]');
    } catch { return []; }
  });

  const notifications = useMemo(() => {
    return computeNotifications(customers, rows, birthdayAlerts);
  }, [customers, rows, birthdayAlerts]);

  const readIdsSet = useMemo(() => new Set(readNotifIds), [readNotifIds]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIdsSet.has(n.id)).length,
    [notifications, readIdsSet]
  );

  function handleMarkRead(id: string) {
    setReadNotifIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('pearlcrm_read_notifs', JSON.stringify(next));
      return next;
    });
  }

  function handleMarkAllRead() {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem('pearlcrm_read_notifs', JSON.stringify(allIds));
  }

  function handleNavigate(p: string) {
    setPage(p as Page);
    setSearchQuery('');
  }

  const { title, subtitle } = PAGE_TITLES[page];

  function handleLogout() {
    if (auth && window.confirm('Apakah Anda yakin ingin logout?')) {
      signOut(auth).then(() => {
        showToast('Berhasil logout', 'info');
      }).catch(() => {
        showToast('Gagal logout', 'error');
      });
    }
  }

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#18191A', color: 'var(--text-muted)',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(24,119,242,0.2)',
          borderTopColor: '#1877F2',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 14 }}>Mengautentikasi {settings.appName || 'PearlCRM'}...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen settings={settings} onLoginSuccess={() => showToast('Selamat datang kembali!', 'success')} />;
  }

  return (
    <div className="app-shell" style={{ overflow: 'hidden', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="ambient-glow g-1"></div>
      <div className="ambient-glow g-2"></div>
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── ODOO PURPLE APP BAR ───────────────────────── */}
      <header className="odoo-topbar" style={{ 
        height: '38px', 
        background: '#714B67', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 12px',
        color: '#FFFFFF',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 1000,
        borderBottom: '1px solid rgba(0,0,0,0.1)'
      }}>
         {/* Left: Odoo App Switcher & Top Level Modules */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <Menu size={18} />
            </button>

            {/* Odoo 9-dots Grid App Switcher */}
            <div 
              onClick={() => handleNavigate('dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.12)' }}
              title="Odoo App Switcher"
            >
               <Grid size={14} color="#FFFFFF" />
               <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.3px', color: '#FFFFFF' }}>
                 {settings.appName || 'PearlCRM'}
               </span>
            </div>

            {/* Odoo Top Level Module Nav Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }} className="hide-on-mobile">
              {[
                { id: 'crm', label: 'CRM', target: 'kanban', activeFor: ['dashboard', 'kanban', 'customers', 'activity-log'] },
                { id: 'sales', label: 'Sales', target: 'orders', activeFor: ['orders', 'invoice', 'sales-target'] },
                { id: 'inventory', label: 'Inventory', target: 'catalog', activeFor: ['catalog', 'inventory'] },
                { id: 'marketing', label: 'Marketing', target: 'marketing', activeFor: ['marketing', 'ads-manager', 'chat-history', 'whatsapp-importer', 'drive-photo-linker'] },
                { id: 'reporting', label: 'Reporting', target: 'analytics', activeFor: ['analytics', 'rfm-analytics', 'finance-analytics', 'birthday', 'reports'] },
                { id: 'config', label: 'Configuration', target: 'settings', activeFor: ['settings', 'export'] },
              ].map((m) => {
                const isActive = m.activeFor.includes(page);
                return (
                  <button
                    key={m.id}
                    onClick={() => handleNavigate(m.target)}
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
         </div>

         {/* Right: Search, Sync, Notifications & Profile */}
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Sync Button with spinner */}
            <button
              className="btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Sync Real-time Cloud"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: '#FFFFFF',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
              <span className="hide-on-mobile">{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setNotifOpen(true)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', padding: '4px' }}
              title={unreadCount > 0 ? `${unreadCount} notifications` : 'Notifications'}
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -4, background: '#D9534F', color: 'white', fontSize: '9px', fontWeight: 800, padding: '1px 4px', borderRadius: '10px'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Avatar Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 24, height: 24, borderRadius: '4px', background: 'rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#FFFFFF'
                }}
                onClick={(e) => { e.stopPropagation(); setShowAdminDropdown(!showAdminDropdown); }}
              >
                A
              </div>
              {showAdminDropdown && (
                <div style={{
                  position: 'absolute', right: 0, top: 32, width: 180, background: '#FFFFFF',
                  border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-md)',
                  zIndex: 1000, padding: '4px 0', color: 'var(--text-primary)'
                }}>
                  <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '2px' }}>
                    Company: <strong>{settings.storeName}</strong>
                  </div>
                  <button onClick={() => { handleNavigate('settings'); setShowAdminDropdown(false); }} style={{ width: '100%', padding: '6px 12px', fontSize: '12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Preferences / Settings</button>
                  <button onClick={handleLogout} style={{ width: '100%', padding: '6px 12px', fontSize: '12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}>Logout</button>
                </div>
              )}
            </div>
         </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <Sidebar
          page={page}
          onNavigate={(p) => { handleNavigate(p); setSidebarOpen(false); }}
          totalCustomers={customers.length}
          totalOrders={rows.filter((r) => r.jenis).length}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="main-content" style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* ── ODOO CONTROL PANEL (Breadcrumbs & View Switchers) ───────── */}
          <div className="top-header" style={{ 
            padding: '6px 16px', 
            background: '#FFFFFF', 
            borderBottom: '1px solid var(--border)', 
            height: '36px',
            minHeight: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            {/* Left: Breadcrumbs & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Odoo Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => handleNavigate('dashboard')}>
                  {['dashboard', 'kanban', 'customers', 'activity-log'].includes(page) ? 'CRM' :
                   ['orders', 'invoice', 'sales-target'].includes(page) ? 'Sales' :
                   ['catalog', 'inventory'].includes(page) ? 'Inventory' :
                   ['marketing', 'ads-manager', 'chat-history', 'whatsapp-importer', 'drive-photo-linker'].includes(page) ? 'Marketing' :
                   ['analytics', 'rfm-analytics', 'finance-analytics', 'birthday', 'reports'].includes(page) ? 'Reporting' : 'Configuration'}
                </span>
                <ChevronRight size={13} color="var(--text-muted)" />
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }} title={subtitle}>{title}</span>
              </div>

              {/* Odoo NEW / CREATE Button */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (['customers'].includes(page)) {
                      handleNavigate('customers');
                    } else if (['orders', 'kanban'].includes(page)) {
                      handleNavigate('orders');
                    } else {
                      handleNavigate('kanban');
                    }
                  }}
                  style={{
                    background: '#017E84',
                    borderColor: '#017E84',
                    color: '#FFFFFF',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={13} />
                  <span>NEW</span>
                </button>
              </div>
            </div>

            {/* Center: Odoo Control Panel Search Bar */}
            <div style={{ flex: 1, maxWidth: 360, margin: '0 12px' }} className="hide-on-mobile">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#F8F9FA',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '3px 8px'
              }}>
                <Search size={13} color="var(--text-muted)" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search records, customers, orders..."
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '11.5px',
                    color: 'var(--text-primary)',
                    width: '100%'
                  }}
                />
                {searchQuery && (
                  <span 
                    onClick={() => setSearchQuery('')} 
                    style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}
                  >✕</span>
                )}
              </div>
            </div>

            {/* Right: Odoo View Switchers & Records Count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }} className="hide-on-mobile">
                Total: <strong>{page === 'customers' ? customers.length : rows.length}</strong> items
              </div>

              {/* Odoo View Switcher Buttons */}
              <div style={{
                display: 'inline-flex',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                overflow: 'hidden',
                background: '#FFFFFF'
              }}>
                <button
                  onClick={() => handleNavigate('kanban')}
                  title="Kanban View"
                  style={{
                    border: 'none',
                    padding: '4px 7px',
                    background: page === 'kanban' ? '#F1F3F5' : 'transparent',
                    color: page === 'kanban' ? '#714B67' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Columns size={14} />
                </button>
                <button
                  onClick={() => handleNavigate(page === 'orders' ? 'orders' : 'customers')}
                  title="List View"
                  style={{
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    padding: '4px 7px',
                    background: ['customers', 'orders'].includes(page) ? '#F1F3F5' : 'transparent',
                    color: ['customers', 'orders'].includes(page) ? '#714B67' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <List size={14} />
                </button>
                <button
                  onClick={() => handleNavigate('analytics')}
                  title="Graph / Analytics View"
                  style={{
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    padding: '4px 7px',
                    background: page === 'analytics' ? '#F1F3F5' : 'transparent',
                    color: page === 'analytics' ? '#714B67' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <BarChart2 size={14} />
                </button>
                <button
                  onClick={() => handleNavigate('activity-log')}
                  title="Activity View"
                  style={{
                    border: 'none',
                    borderLeft: '1px solid var(--border)',
                    padding: '4px 7px',
                    background: page === 'activity-log' ? '#F1F3F5' : 'transparent',
                    color: page === 'activity-log' ? '#714B67' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Calendar size={14} />
                </button>
              </div>
            </div>
          </div>

        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid rgba(113,75,103,0.2)',
              borderTopColor: '#714B67',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading CRM data…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <div className="empty-title">Failed to load data</div>
              <div className="empty-text">{error}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => loadData()}>
                  Retry
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    import('./utils/localStore').then(({ restoreDeletedOrders }) => {
                      restoreDeletedOrders();
                      import('./utils/firebaseSync').then(({ clearDeletedOrdersInFirestore }) => {
                        clearDeletedOrdersInFirestore().finally(() => {
                          window.location.reload();
                        });
                      });
                    });
                  }} 
                  style={{ background: '#ef4444', color: 'white', border: 'none' }}>
                  Restore Spreadsheet Data
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="pages-container" style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ErrorBoundary pageName="Halaman ini">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(113,75,103,0.2)', borderTopColor: '#714B67', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Memuat modul Odoo CRM...</div>
            </div>
          }>
            {page === 'dashboard' && (
              <DashboardPage
                customers={customers}
                rows={rows}
                birthdayAlerts={birthdayAlerts}
                onSelectCustomer={(c) => {
                  setSelectedCustomer(c);
                  setPage('customers');
                }}
                theme={theme}
                onSelectCity={(city) => {
                  setSearchQuery(city);
                  setPage('customers');
                }}
                settings={settings}
              />
            )}
            {page === 'customers' && (
              <CustomersPage
                customers={customers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAddCustomer={handleAddCustomer}
                onEditCustomer={handleEditCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onAddOrder={handleAddOrder}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                birthdayAlerts={birthdayAlerts}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                settings={settings}
              />
            )}
            {page === 'orders' && (
              <OrdersPage
                rows={rows}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAddOrder={handleAddOrder}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onBatchEditOrders={handleBatchEditOrders}
                onBatchDeleteOrders={handleBatchDeleteOrders}
                customers={customers}
              />
            )}
            {page === 'marketing' && (
              <MarketingPage customers={customers} rows={rows} settings={settings} />
            )}
            {page === 'ads-manager' && (
              <AdsManagerPage />
            )}
{page === 'kanban' && (
              <KanbanPage rows={rows} customers={customers} settings={settings} onEditOrder={handleEditOrder} />
            )}
            {page === 'social' && (
              <SocialIntelligencePage
                customers={customers}
                settings={settings}
                onSelectCustomer={(c) => {
                  setSelectedCustomer(c);
                  setPage('customers');
                }}
              />
            )}
            {page === 'analytics' && <AnalyticsPage customers={customers} rows={rows} theme={theme} />}
            {page === 'rfm-analytics' && <RFMAnalyticsPage customers={customers} onSelectCustomer={(c) => { setSelectedCustomer(c); setPage('customers'); }} />}
            {page === 'finance-analytics' && <FinanceAnalyticsPage rows={rows} catalogItems={catalogItems} theme={theme} />}
            {page === 'birthday' && (
              <BirthdayPage customers={customers} settings={settings} />
            )}
            {page === 'reports' && (
              <ReportsPage customers={customers} rows={rows} settings={settings} />
            )}
            {page === 'invoice' && (
              <InvoicePage customers={customers} settings={settings} />
            )}
            {page === 'catalog' && <CatalogPage catalogItems={catalogItems} rows={rows} />}
            {page === 'inventory' && <InventoryPage catalogItems={catalogItems} inventoryLogs={storeData.inventoryLogs || []} onUpdateLogs={handleUpdateInventoryLogs} />}
            {page === 'ai-trends' && <AITrendsPage />}
            {page === 'export' && (
              <ExportPage
                customers={customers}
                rows={rows}
                onImportSuccess={() => {
                  setLocalTrigger((t) => t + 1);
                  showToast('Data backup restored successfully', 'success');
                }}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                settings={settings}
                onSave={handleSaveSettings}
              />
            )}
            {page === 'whatsapp-importer' && <WhatsAppImporterPage customers={customers} rows={rows} />}
            {page === 'drive-photo-linker' && <DrivePhotoLinkerPage rows={rows} onShowToast={showToast} />}
            {page === 'sales-target' && <SalesTargetPage customers={customers} rows={rows} theme={theme} />}
            {page === 'activity-log' && <ActivityLogPage theme={theme} />}
            {page === 'ig-analyzer' && <IGAnalyzerPage onAddCustomer={handleAddCustomer} customers={customers} onEditCustomer={handleEditCustomer} />}
            {page === 'command-center' && (
              <CommandCenterPage
                customers={customers}
                rows={rows}
                onSelectCustomer={(c) => { setSelectedCustomer(c); setPage('customers'); }}
              />
            )}
            {page === 'affinity-matrix' && (
              <AffinityMatrixPage
                customers={customers}
                rows={rows}
              />
            )}
            {page === 'profit-optimizer' && (
              <ProfitOptimizerPage
                customers={customers}
                rows={rows}
                catalog={catalogItems}
              />
            )}
            {page === 'demand-forecast' && (
              <DemandForecastPage
                customers={customers}
                rows={rows}
              />
            )}
            {page === 'bundle-recommender' && (
              <BundleRecommenderPage
                customers={customers}
                rows={rows}
              />
            )}
            {page === 'chat-history' && (
              <ChatImportPage
                customers={customers}
              />
            )}
          </Suspense>
          </ErrorBoundary>
          </div>
        )}
      </div> {/* end main-content */}
    </div> {/* end body wrapper */}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`mobile-bottom-nav-item ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNavigate('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Home</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${page === 'customers' ? 'active' : ''}`}
          onClick={() => handleNavigate('customers')}
        >
          <Users size={18} />
          <span>Customers</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${page === 'orders' ? 'active' : ''}`}
          onClick={() => handleNavigate('orders')}
        >
          <ShoppingBag size={18} />
          <span>Orders</span>
        </button>
        <button 
          className={`mobile-bottom-nav-item ${page === 'kanban' ? 'active' : ''}`}
          onClick={() => handleNavigate('kanban')}
        >
          <Columns size={18} />
          <span>Pipeline</span>
        </button>
        <button 
          className="mobile-bottom-nav-item"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>

      {/* Smart Notification Center */}
      <NotificationCenter
        notifications={notifications}
        readIds={readIdsSet}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onClose={() => setNotifOpen(false)}
        open={notifOpen}
        settings={settings}
      />

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.type === 'info' && 'ℹ️'}
            <span style={{ fontSize: 13 }}>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Global SpotLight Command Center */}
      <CommandCenter
        isOpen={commandCenterOpen}
        onClose={() => setCommandCenterOpen(false)}
        customers={customers}
        setPage={setPage}
        setSelectedCustomer={setSelectedCustomer}
        handleToggleTheme={handleToggleTheme}
        theme={theme}
        setNotifOpen={setNotifOpen}
        showToast={showToast}
      />
      
      <PearlAIChatWidget customers={customers} />
      <JarvisVoiceAI customers={customers} rows={rows} settings={settings} setPage={setPage} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .page-container-scroll {
          scrollbar-width: thin;
        }
      `}</style>
    </div>
  );
}
