// src/pages/ActivityLogPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Clock, ShoppingBag, Users, Edit, Trash2, Plus, ChevronDown } from 'lucide-react';
import { type ActivityEntry, getActivityLog } from '../utils/activityLogger';

// ─── Page Component ──────────────────────────────────────
interface Props {
  theme?: 'dark' | 'light';
}

export default function ActivityLogPage({ theme }: Props) {
  const isLight = theme === 'light';
  const [log, setLog] = useState<ActivityEntry[]>([]);
  const [filterType, setFilterType] = useState<'' | 'add' | 'edit' | 'delete'>('');
  const [filterEntity, setFilterEntity] = useState<'' | 'customer' | 'order'>('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setLog(getActivityLog());
    // Poll every 5s for updates
    const iv = setInterval(() => setLog(getActivityLog()), 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    let data = log;
    if (filterType) data = data.filter((e) => e.type === filterType);
    if (filterEntity) data = data.filter((e) => e.entity === filterEntity);
    return data.slice(0, limit);
  }, [log, filterType, filterEntity, limit]);

  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: ActivityEntry[] }[] = [];
    const map = new Map<string, ActivityEntry[]>();
    for (const entry of filtered) {
      const d = new Date(entry.timestamp);
      const key = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    for (const [date, items] of map) groups.push({ date, items });
    return groups;
  }, [filtered]);

  const typeIcon = (t: string) => {
    if (t === 'add') return <Plus size={14} />;
    if (t === 'edit') return <Edit size={14} />;
    if (t === 'delete') return <Trash2 size={14} />;
    return <Clock size={14} />;
  };

  const typeColor = (t: string) => {
    if (t === 'add') return { color: '#42B72A', bg: 'rgba(66,183,42,0.12)' };
    if (t === 'edit') return { color: '#1877F2', bg: 'rgba(24,119,242,0.12)' };
    if (t === 'delete') return { color: '#E41E3F', bg: 'rgba(228,30,63,0.12)' };
    return { color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
  };

  const entityIcon = (e: string) => {
    if (e === 'customer') return <Users size={13} />;
    if (e === 'order') return <ShoppingBag size={13} />;
    return <Clock size={13} />;
  };

  return (
    <div className="page-body" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: 'rgba(24,119,242,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={22} color="#1877F2" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Activity Log</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {log.length} aktivitas tercatat
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
          }}
        >
          <option value="">Semua Aksi</option>
          <option value="add">➕ Tambah</option>
          <option value="edit">✏️ Edit</option>
          <option value="delete">🗑️ Hapus</option>
        </select>
        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value as any)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
          }}
        >
          <option value="">Semua Entitas</option>
          <option value="customer">👤 Customer</option>
          <option value="order">📦 Order</option>
        </select>
        {log.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm('Hapus semua log aktivitas?')) {
                localStorage.removeItem('pearlcrm_activity_log');
                setLog([]);
              }
            }}
            style={{ fontSize: 11, padding: '5px 10px', marginLeft: 'auto' }}
          >
            🗑️ Clear Log
          </button>
        )}
      </div>

      {/* Timeline */}
      {groupedByDate.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Belum ada aktivitas</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Setiap kali Anda menambah, mengedit, atau menghapus data — akan tercatat di sini
          </div>
        </div>
      ) : (
        groupedByDate.map((group) => (
          <div key={group.date} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid var(--border)`,
            }}>
              {group.date}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map((entry) => {
                const tc = typeColor(entry.type);
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', borderRadius: 12,
                    background: isLight ? '#ffffff' : 'var(--bg-card)',
                    border: `1px solid ${isLight ? '#e4e6eb' : 'var(--border)'}`,
                    transition: 'background 0.15s',
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, background: tc.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: tc.color, flexShrink: 0, marginTop: 2,
                    }}>
                      {typeIcon(entry.type)}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: tc.bg, color: tc.color, textTransform: 'uppercase',
                        }}>
                          {entry.type}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                          {entityIcon(entry.entity)} {entry.entity}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                        {entry.label}
                      </div>
                      {entry.details && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {entry.details}
                        </div>
                      )}
                    </div>
                    {/* Time */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(entry.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Load more */}
      {filtered.length >= limit && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setLimit((l) => l + 50)}
            style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ChevronDown size={14} /> Muat lebih banyak
          </button>
        </div>
      )}
    </div>
  );
}
