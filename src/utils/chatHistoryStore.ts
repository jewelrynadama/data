// src/utils/chatHistoryStore.ts
// Stores WhatsApp chat history per customer (keyed by WA number or customer name)
// All data stored in localStorage — fully offline, no API needed

export interface ChatMessage {
  id: string;
  timestamp: number;       // Unix ms
  dateStr: string;         // original string e.g. "30/07/2026, 10:23"
  sender: string;          // raw sender name from WA export
  text: string;
  isStore: boolean;        // true = message from store side
}

export interface ChatThread {
  id: string;              // unique id for this thread
  customerName: string;    // matched customer name
  waNumber: string;        // matched WA number (normalized)
  storeName: string;       // name used by the store in the chat
  messages: ChatMessage[];
  importedAt: number;
  fileName: string;
}

const STORAGE_KEY = 'pearlcrm_chat_history';
const MAX_THREADS = 500;

export function getAllThreads(): ChatThread[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAllThreads(threads: ChatThread[]): void {
  if (threads.length > MAX_THREADS) threads = threads.slice(-MAX_THREADS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export function getThreadsForCustomer(waNumber: string, customerName: string): ChatThread[] {
  const all = getAllThreads();
  const normWa = normalizeWa(waNumber);
  const normName = customerName?.toLowerCase().trim() || '';
  return all.filter(t => {
    if (normWa && t.waNumber && normalizeWa(t.waNumber) === normWa) return true;
    if (normName && t.customerName?.toLowerCase().includes(normName)) return true;
    return false;
  });
}

export function deleteThread(threadId: string): void {
  const all = getAllThreads().filter(t => t.id !== threadId);
  saveAllThreads(all);
}

export function normalizeWa(wa: string): string {
  if (!wa) return '';
  return wa.replace(/\D/g, '').replace(/^0/, '62').replace(/^62/, '62');
}

// ─── Parser ──────────────────────────────────────────────────────────────────
// Supports Android, iOS, and WhatsApp Desktop export formats:
//   Android: 30/07/2026, 10.23 - Sender: message
//   iOS:     [30/07/2026, 10:23:00] Sender: message
//   Desktop: [07/01/23, 13.03.52] Sender: message

const WA_LINE_REGEX = /^\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})[,\s]+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\]?\s*(?:[-–]\s*)?(.+?):\s*(.*)$/;

export function parseWAChatFile(
  rawText: string,
  fileName: string,
  storeSenderHint?: string
): ChatThread | null {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const messages: ChatMessage[] = [];
  const senderCounts: Record<string, number> = {};

  let currentMsg: Omit<ChatMessage, 'id' | 'isStore'> & { sender: string } | null = null;

  for (const line of lines) {
    const match = line.match(WA_LINE_REGEX);
    if (match) {
      if (currentMsg) {
        const id = `msg_${currentMsg.timestamp}_${Math.random().toString(36).slice(2, 6)}`;
        messages.push({ ...currentMsg, id, isStore: false });
      }
      const [, dateStr, timeStr, sender, text] = match;
      const cleanSender = sender.replace(/[\u200e\u200f]/g, '').trim();
      const timestamp = parseDateToMs(dateStr, timeStr);
      senderCounts[cleanSender] = (senderCounts[cleanSender] || 0) + 1;
      currentMsg = { timestamp, dateStr: `${dateStr}, ${timeStr}`, sender: cleanSender, text: text.trim() };
    } else if (currentMsg && line.trim()) {
      // Continuation of previous message
      currentMsg.text += '\n' + line.trim();
    }
  }
  if (currentMsg) {
    const id = `msg_${currentMsg.timestamp}_${Math.random().toString(36).slice(2, 6)}`;
    messages.push({ ...currentMsg, id, isStore: false });
  }

  if (messages.length === 0) return null;

  // Determine store vs customer
  const senders = Object.entries(senderCounts).sort((a, b) => a[1] - b[1]);
  let storeName = storeSenderHint || '';
  if (!storeName && senders.length >= 2) {
    storeName = senders[0][0];
  }
  const storeNameLower = storeName.toLowerCase();

  const customerSenders = senders.filter(([name]) => name.toLowerCase() !== storeNameLower);
  const customerName = customerSenders.length > 0
    ? customerSenders.sort((a, b) => b[1] - a[1])[0][0]
    : senders[senders.length - 1]?.[0] || 'Pelanggan';

  const finalMessages = messages.map(m => ({
    ...m,
    isStore: m.sender.toLowerCase() === storeNameLower,
  }));

  const waFromFile = fileName.match(/(\+?62\d{8,13}|0\d{8,12})/)?.[1] || '';

  const thread: ChatThread = {
    id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    customerName,
    waNumber: normalizeWa(waFromFile),
    storeName,
    messages: finalMessages,
    importedAt: Date.now(),
    fileName,
  };

  return thread;
}

export function saveThread(thread: ChatThread): void {
  const all = getAllThreads();
  const idx = all.findIndex(t => t.fileName === thread.fileName);
  if (idx >= 0) {
    all[idx] = thread;
  } else {
    all.push(thread);
  }
  saveAllThreads(all);
}

function parseDateToMs(dateStr: string, timeStr: string): number {
  try {
    const dp = dateStr.split(/[\/.\-]/);
    if (dp.length < 3) return Date.now();
    let d = parseInt(dp[0], 10);
    let m = parseInt(dp[1], 10) - 1;
    let y = parseInt(dp[2], 10);
    if (y < 100) y += 2000;
    const tp = timeStr.split(/[:.]/).map(Number);
    return new Date(y, m, d, tp[0] || 0, tp[1] || 0, tp[2] || 0).getTime();
  } catch {
    return Date.now();
  }
}

// ─── Nadama Auto-Loader ──────────────────────────────────────────────────────
export async function loadNadamaPreloadedChat(): Promise<ChatThread | null> {
  try {
    const res = await fetch('/data/nadama_chat.json');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.messages || data.messages.length === 0) return null;

    const messages: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
      id: `nadama_msg_${idx}`,
      timestamp: Date.now() - (data.messages.length - idx) * 60000,
      dateStr: m.dateStr,
      sender: m.sender,
      text: m.text,
      isStore: m.sender === 'Data Penjualan Nadama' || m.sender === 'Nadama Info',
    }));

    const thread: ChatThread = {
      id: 'thread_nadama_chat_txt',
      customerName: 'Data Penjualan Nadama (Group)',
      waNumber: '',
      storeName: 'Data Penjualan Nadama',
      messages,
      importedAt: Date.now(),
      fileName: 'WhatsApp Chat - Data Penjualan Nadama/_chat.txt',
    };

    saveThread(thread);
    return thread;
  } catch (err) {
    console.error('Failed to load Nadama chat json:', err);
    return null;
  }
}
