// src/components/LoginScreen.tsx
import React, { useState } from 'react';
import { KeyRound, Mail, AlertTriangle, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../utils/firebase';

interface Props {
  onLoginSuccess?: () => void;
  settings?: any;
}

export default function LoginScreen({ onLoginSuccess, settings }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase belum dikonfigurasi. Silakan isi API Keys di file .env terlebih dahulu.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Harap isi semua kolom login.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email atau password salah.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError('Gagal masuk. Coba cek koneksi internet Anda.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #0f0c20 0%, #05050c 100%)',
      fontFamily: 'Inter, sans-serif',
      padding: 16,
      boxSizing: 'border-box',
    }}>
      {/* Glow effects in background */}
      <div style={{
        position: 'absolute', width: 350, height: 350, borderRadius: '50%',
        background: 'rgba(124, 58, 237, 0.15)', filter: 'blur(80px)',
        top: '20%', left: '10%', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.08)', filter: 'blur(80px)',
        bottom: '20%', right: '10%', pointerEvents: 'none',
      }} />

      <div style={{
        background: 'rgba(13, 13, 23, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        width: 440,
        maxWidth: '100%',
        padding: '38px 40px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        animation: 'fadeInUp 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 2,
        boxSizing: 'border-box',
      }}>
        {/* Brand/Header */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            display: 'inline-flex',
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)',
            marginBottom: 16,
            fontSize: 26,
          }}>
            {settings?.loginLogoEmoji || '🛡️'}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            {settings?.loginTitle || 'PearlCRM Access'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {settings?.loginSubtitle || 'Silakan login untuk mengakses dashboard mutiara'}
          </p>
        </div>

        {/* Warning if Firebase not configured */}
        {!isFirebaseConfigured && (
          <div style={{
            display: 'flex', gap: 10,
            padding: '12px 14px', background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.22)', borderRadius: 10,
            marginBottom: 20, fontSize: 12, color: '#fcd34d', lineHeight: 1.4,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Kredensial Firebase Belum Terpasang:</strong><br />
              Silakan isi file <code>.env</code> Anda di folder root dengan API Keys Firebase agar sinkronisasi online dapat digunakan.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex', gap: 10,
            padding: '12px 14px', background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.22)', borderRadius: 10,
            marginBottom: 20, fontSize: 12.5, color: '#fca5a5', lineHeight: 1.4,
            animation: 'shake 0.3s ease-in-out',
          }}>
            <div style={{ fontWeight: 700 }}>⚠️</div>
            <div>{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Email Administrator
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
              <input
                type="email"
                className="login-input"
                style={{ paddingLeft: 38 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Kata Sandi
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound size={15} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="login-input"
                style={{ paddingLeft: 38 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 10,
            }}
            disabled={loading || !isFirebaseConfigured}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Memverifikasi...
              </>
            ) : 'Masuk Dashboard'}
          </button>
        </form>

        {/* Admin note */}
        <div style={{
          textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 18,
        }}>
          Hanya admin utama yang dapat menambahkan akses pengguna baru melalui Firebase Console.
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: #ffffff;
          font-family: Inter, sans-serif;
          font-size: 13.5px;
          height: 42px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        }
        .login-input:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
          background: rgba(255, 255, 255, 0.06);
        }
        .login-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
        .login-btn {
          width: 100%;
          height: 42px;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          border: none;
          border-radius: 10px;
          color: #ffffff;
          font-family: Inter, sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: filter 0.2s, transform 0.1s, opacity 0.2s;
          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.25);
        }
        .login-btn:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        .login-btn:active:not(:disabled) {
          transform: scale(0.985);
        }
        .login-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
