import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Bell, Sun, Moon, LogOut, LayoutDashboard, Users, ShoppingBag, BarChart3, Settings, Megaphone, Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import OrdersPage from './pages/OrdersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ExportPage from './pages/ExportPage';
import MarketingPage from './pages/MarketingPage';
import InboxPage from './pages/InboxPage';
import BirthdayPage from './pages/BirthdayPage';
import ReportsPage from './pages/ReportsPage';
import InvoicePage from './pages/InvoicePage';
import InventoryPage from './pages/InventoryPage';
import KanbanPage from './pages/KanbanPage';
import RFMAnalyticsPage from './pages/RFMAnalyticsPage';
import { loadCustomerData, extractCity, formatWhatsApp, loadCatalogData } from './utils/csvLoader';
import { formatAddress } from './utils/addressHelper';
import type { Customer, CustomerRow, PendingOrder, CatalogItem } from './types';
import './index.css';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { getBirthdayAlerts } from './utils/birthday';
import {
  saveNewCustomer,
  saveCustomerEdit,
  deleteCustomer,
  saveNewOrder,
  saveOrderEdit,
  deleteOrder,
  mergeData,
} from './utils/localStore';
import type { LocalStore } from './utils/localStore';
import { auth, db } from './utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { subscribeToStore, saveToFirestore, mergeAndUploadLocal } from './utils/firebaseSync';
import LoginScreen from './components/LoginScreen';
import SettingsPage from './pages/SettingsPage';
import type { StoreSettings } from './pages/SettingsPage';
import NotificationCenter from './components/NotificationCenter';
import { computeNotifications } from './utils/notificationEngine';
import SocialIntelligencePage from './pages/SocialIntelligencePage';
import AITrendsPage from './pages/AITrendsPage';
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
};

type Page = 'dashboard' | 'customers' | 'orders' | 'inbox' | 'marketing' | 'social' | 'analytics' | 'rfm-analytics' | 'export' | 'settings' | 'birthday' | 'reports' | 'invoice' | 'inventory' | 'kanban' | 'catalog' | 'ai-trends';

const PAGE_TITLES: Record<Page, { title: string; subtitle: string }> = {
  dashboard:  { title: 'Overview',           subtitle: 'Key metrics and insights at a glance' },
  customers:  { title: 'Customers',          subtitle: 'Manage and explore customer profiles' },
  orders:     { title: 'All Orders',         subtitle: 'View and filter every transaction' },
  inbox:      { title: 'Order Inbox',        subtitle: 'Review and confirm incoming orders' },
  kanban:     { title: 'Kanban Tracker',     subtitle: 'Visual board status pesanan' },
  marketing:  { title: 'Marketing Hub',      subtitle: 'Campaigns, Flash Sales, and Re-engagement' },
  social:     { title: 'Social Radar',       subtitle: 'AI Scanner untuk memantau momen penting pelanggan' },
  'ai-trends':{ title: 'AI Market Radar',    subtitle: 'Analisis tren pasar dan kompetitor secara instan' },
  analytics:  { title: 'Analytics',          subtitle: 'Deep-dive charts and distributions' },
  'rfm-analytics': { title: 'RFM Analytics', subtitle: 'Customer Segmentation based on Recency, Frequency, Monetary' },
  birthday:   { title: 'Birthday Tracker',   subtitle: 'Kelola ucapan ulang tahun pelanggan' },
  reports:    { title: 'Laporan Bulanan',    subtitle: 'Ringkasan performa toko per bulan' },
  invoice:    { title: 'Invoice Generator', subtitle: 'Generate dan cetak invoice transaksi' },
  inventory:  { title: 'Stok / Inventory',  subtitle: 'Pantau dan kelola stok produk' },
  catalog:    { title: 'Katalog Produk',     subtitle: 'Analisis produk terlaris dari data order' },
  export:     { title: 'Export Data',        subtitle: 'Download your data in various formats' },
  settings:   { title: 'Store Settings',     subtitle: 'Configure store details and classification thresholds' },
};

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.title = settings.appName || 'PearlCRM';
  }, [settings.appName]);

  const handleToggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };
  
  // Auth states
  const [user, setUser] = useState<any>(null);
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
  });

  const [localTrigger, setLocalTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  
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
      
      const merged = mergeData(result.customers, result.rows, storeData);
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
  }, [showToast, storeData]);

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
            (parsed.deletedOrderIds && parsed.deletedOrderIds.length > 0);

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

  // Listen to pending orders from Firestore in real-time
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, 'pending_orders');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: PendingOrder[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PendingOrder);
      });
      
      // Play a premium crystal chime sound if a new order arrives
      if (list.length > pendingOrders.length && pendingOrders.length > 0) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
          audio.volume = 0.5;
          audio.play();
        } catch (e) {
          console.log('Audio play failed:', e);
        }
        showToast('📥 Orderan Baru Masuk!', 'info');
      }
      setPendingOrders(list);
    }, (err) => {
      console.error('Pending orders subscription error:', err);
    });
    return unsubscribe;
  }, [db, pendingOrders.length]);

  const handleAddCustomer = useCallback((newC: { nama: string; instagram?: string; wa?: string; alamat?: string; tanggalUlangTahun?: string; city?: string }) => {
    const customer: Customer = {
      id: `local-customer-${Date.now()}`,
      nama: newC.nama,
      instagram: newC.instagram || '',
      wa: newC.wa ? formatWhatsApp(newC.wa) : '',
      alamat: newC.alamat ? formatAddress(newC.alamat) : '',
      tanggalUlangTahun: newC.tanggalUlangTahun || '',
      city: newC.city || '',
      orders: [],
      orderCount: 0,
      totalSpend: 0,
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
    showToast('Order added successfully', 'success');
  }, [showToast, customers, user, storeData]);

  const handleEditOrder = useCallback((id: string, patch: Partial<CustomerRow>) => {
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
    showToast('Order updated successfully', 'success');
  }, [showToast, user, storeData]);

  const handleDeleteOrder = useCallback((id: string) => {
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
    showToast('Order deleted successfully', 'success');
  }, [showToast, user, storeData]);

  const handleAcceptPendingOrder = useCallback(async (pending: PendingOrder) => {
    try {
      const orderId = `order-${Date.now()}`;
      
      const newOrder: CustomerRow = {
        id: orderId,
        namaInstagram: pending.customerName,
        instagram: pending.instagram || '',
        tanggalOrder: pending.orderDate,
        tanggalUlangTahun: '',
        namaPengiriman: pending.customerName,
        alamat: pending.alamat || '',
        wa: pending.wa || '',
        kode: 'WEB-INBOX',
        jenis: 'Pearl',
        gambar: '',
        rangka: 'None',
        gramasiRangka: '',
        kodeType: '',
        type: pending.productName,
        weight: '',
        size: '',
        kodeShape: '',
        shape: '',
        color: '',
        grade: '',
        stone: '',
        stoneWeight: '',
        amount: pending.totalPrice.toString(),
        terbilang: '',
        qty: pending.qty.toString(),
        paymentVia: pending.source === 'shopee' ? 'Shopee' : 'Website',
        totalBayar: pending.totalPrice.toString(),
        ongkir: '0',
        hargaBersih: pending.totalPrice.toString(),
        kurir: 'JNE/J&T',
        keterangan: `Sync from ${pending.source}. Original ID: ${pending.id}`,
        resi: '',
        orderStatus: 'pending',
        raw: [],
      };

      await handleAddOrder(newOrder);

      if (db) {
        await deleteDoc(doc(db, 'pending_orders', pending.id));
      }
      
      showToast(`Order dari ${pending.customerName} berhasil diterima!`, 'success');
    } catch (error: any) {
      console.error('Failed to accept pending order:', error);
      showToast(`Gagal menerima order: ${error.message}`, 'error');
    }
  }, [handleAddOrder, showToast]);

  const handleRejectPendingOrder = useCallback(async (pending: PendingOrder) => {
    try {
      if (db) {
        await deleteDoc(doc(db, 'pending_orders', pending.id));
      }
      showToast(`Order dari ${pending.customerName} dihapus dari Inbox.`, 'info');
    } catch (error: any) {
      console.error('Failed to reject pending order:', error);
      showToast(`Gagal menghapus order: ${error.message}`, 'error');
    }
  }, [showToast]);

  const handleBatchEditOrders = useCallback((ids: string[], patch: Partial<CustomerRow>) => {
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

  const handleBatchDeleteOrders = useCallback((ids: string[]) => {
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
        minHeight: '100vh', background: '#05050c', color: 'var(--text-muted)',
        flexDirection: 'column', gap: 16, fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.2)',
          borderTopColor: '#7c3aed',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 14 }}>Mengautentikasi {settings.appName || 'PearlCRM'}...</div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen settings={settings} onLoginSuccess={() => showToast('Selamat datang kembali!', 'success')} />;
  }

  return (
    <div className="app-shell">
      <div className="ambient-glow g-1"></div>
      <div className="ambient-glow g-2"></div>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        page={page}
        onNavigate={(p) => {
          handleNavigate(p);
          setSidebarOpen(false);
        }}
        totalCustomers={customers.length}
        totalOrders={rows.filter((r) => r.jenis).length}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        settings={settings}
        unreadCount={unreadCount}
        onOpenNotifications={() => {
          setNotifOpen(true);
          setSidebarOpen(false);
        }}
        pendingCount={pendingOrders.length}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        {/* Top Header */}
        <div className="top-header">
          <div className="header-left">
            <button 
              className="icon-btn mobile-menu-btn" 
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="page-title">{title}</div>
              <div className="page-subtitle">{subtitle}</div>
            </div>
          </div>

          <div className="header-right">
            {/* Global search — only for customer/order pages */}
            {(page === 'customers' || page === 'orders') && (
              <div className="search-box">
                <Search size={15} className="search-icon" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${page}…`}
                />
              </div>
            )}

            <button
              className="icon-btn"
              onClick={() => loadData(true)}
              title="Refresh data"
              style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined}
            >
              <RefreshCw size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
            </button>

            {/* Mobile Header Actions (Theme Toggle & Logout) */}
            <div className="mobile-header-actions" style={{ display: 'flex', gap: 6 }}>
              <button
                className="icon-btn"
                onClick={handleToggleTheme}
                title={theme === 'dark' ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                className="icon-btn"
                onClick={handleLogout}
                title="Keluar / Logout"
                style={{ color: 'var(--accent-red)' }}
              >
                <LogOut size={15} />
              </button>
            </div>

            <button
              className="icon-btn header-bell-btn"
              title={unreadCount > 0 ? `${unreadCount} notifikasi belum dibaca` : 'Notifikasi'}
              onClick={() => setNotifOpen(true)}
              style={{ position: 'relative' }}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 10,
                  background: '#ef4444',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 2px',
                  fontFamily: 'Inter, sans-serif',
                  pointerEvents: 'none',
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
 
            <div style={{ position: 'relative' }}>
              <div
                className="header-avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'white',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdminDropdown(!showAdminDropdown);
                }}
              >
                A
              </div>
              {showAdminDropdown && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 40,
                  width: 180,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--border-radius-sm)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  padding: '6px 0',
                  animation: 'fadeIn 0.15s ease-out',
                }}>
                  <div style={{
                    padding: '8px 14px',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: 4,
                  }}>
                    Store: <strong>{settings.storeName}</strong>
                  </div>
                  <button
                    onClick={() => {
                      handleNavigate('settings');
                      setShowAdminDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: 12.5,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    ⚙️ Pengaturan Toko
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: 12.5,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-red)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    🚪 Keluar / Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid rgba(124,58,237,0.2)',
              borderTopColor: '#7c3aed',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Loading customer data…</div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <div className="empty-title">Failed to load data</div>
              <div className="empty-text">{error}</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => loadData()}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Pages */}
        {!loading && !error && (
          <>
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
            {page === 'inbox' && (
              <InboxPage
                pendingOrders={pendingOrders}
                onAccept={handleAcceptPendingOrder}
                onReject={handleRejectPendingOrder}
              />
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
            {page === 'birthday' && (
              <BirthdayPage customers={customers} settings={settings} />
            )}
            {page === 'reports' && (
              <ReportsPage customers={customers} rows={rows} settings={settings} />
            )}
            {page === 'invoice' && (
              <InvoicePage customers={customers} settings={settings} />
            )}
            {page === 'inventory' && <InventoryPage catalogItems={catalogItems} />}
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
          </>
        )}
      </div>

      <div className="mobile-nav">
        {[
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'orders', label: 'Orders', icon: ShoppingBag },
          { id: 'marketing', label: 'Marketing', icon: Megaphone },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => handleNavigate(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

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
      
      {/* JARVIS Voice AI */}
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
