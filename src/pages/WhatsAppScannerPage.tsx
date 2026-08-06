import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { io, Socket } from 'socket.io-client';
import { QrCode, Smartphone, CheckCircle, LogOut } from 'lucide-react';

export default function WhatsAppScannerPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [waStatus, setWaStatus] = useState<string>('CONNECTING');
  const [qrCode, setQrCode] = useState<string>('');
  
  useEffect(() => {
    // Connect to the local Node.js server
    
    let apiUrl = 'http://localhost:3001';
    try {
      const savedSettings = localStorage.getItem('pearlcrm_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.waApiUrl) apiUrl = parsed.waApiUrl;
      }
    } catch (e) {}
    const newSocket = io(apiUrl, {
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });
  
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WA Backend');
    });

    newSocket.on('wa_status', (data: { status: string, qr?: string }) => {
      setWaStatus(data.status);
      if (data.qr) {
        setQrCode(data.qr);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleLogout = () => {
    if (socket) {
      socket.emit('logout');
      setWaStatus('DISCONNECTING...');
    }
  };

  return (
    <div className="page-body fade-in">
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div className="premium-header-icon" style={{ width: 80, height: 80 }}>
            <Smartphone size={40} color="var(--accent-blue)" />
          </div>
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Hubungkan WhatsApp Bisnis</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>
          Scan QR Code di bawah ini menggunakan aplikasi WhatsApp di HP Anda (Pilih menu Perangkat Tertaut / Linked Devices).
        </p>

        <div className="card" style={{ padding: 40, display: 'inline-block', minWidth: 350, minHeight: 350 }}>
          {waStatus === 'WAITING_FOR_SCAN' && qrCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {qrCode.startsWith('data:image') ? (
                <img src={qrCode} width={256} height={256} alt="Scan me" style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              ) : (
                <QRCodeSVG value={qrCode} size={256} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <QrCode size={18} />
                <span>Menunggu Anda melakukan scan...</span>
              </div>
            </div>
          ) : waStatus === 'CONNECTED' || waStatus === 'AUTHENTICATED' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={48} color="#10b981" />
              </div>
              <div>
                <h3 style={{ fontSize: 20, color: '#10b981', margin: '0 0 8px' }}>WhatsApp Terhubung!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>CRM sekarang dapat mengirim pesan melalui nomor Anda.</p>
              </div>
              <button className="btn btn-secondary" onClick={handleLogout} style={{ marginTop: 20 }}>
                <LogOut size={16} /> Putuskan Koneksi
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, height: 256, justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span style={{ color: 'var(--text-muted)' }}>
                {waStatus === 'CONNECTING' ? 'Menghubungkan ke Server...' : 'Memuat WhatsApp Client...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
