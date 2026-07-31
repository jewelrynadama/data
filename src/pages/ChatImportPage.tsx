import { useState } from 'react';
import type { Customer } from '../types';
import ChatHistoryViewer from '../components/ChatHistoryViewer';
import { getAllThreads } from '../utils/chatHistoryStore';

interface Props {
  customers: Customer[];
}

export default function ChatImportPage({ customers }: Props) {
  const [showBanner, setShowBanner] = useState(true);
  
  const threads = getAllThreads();
  const totalThreads = threads.length;
  const totalMessages = threads.reduce((acc, t) => acc + t.messages.length, 0);
  const customersWithChat = customers.filter(c => threads.some(t => t.waNumber === c.wa)).length;
  
  return (
    <div className="page-body" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '12px', paddingBottom: '16px' }}>
      {showBanner && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: '13px',
        }}>
          <div>
            Fitur ini membaca file export WhatsApp (.txt). Chat tersimpan di perangkat Anda, tidak dikirim ke server manapun. 🔒 100% Privat
          </div>
          <button 
            onClick={() => setShowBanner(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="card" style={{ padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>💬 WhatsApp Chat History</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>Lihat riwayat chat WhatsApp per pelanggan</p>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            padding: '8px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '10px',
            border: '1px solid var(--border)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Threads</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{totalThreads}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Messages</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{totalMessages}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customers with Chat</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{customersWithChat}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, minHeight: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ChatHistoryViewer />
      </div>
    </div>
  );
}
