import { useState } from 'react';

export default function AttachmentViewer({ filename }: { filename: string }) {
  const [hasError, setHasError] = useState(false);
  
  // Clean filename: remove all non-printable/zero-width characters that WhatsApp inserts
  const cleanFilename = filename.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
  const ext = cleanFilename.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
  const isVideo = ['mp4', 'mov', 'avi'].includes(ext || '');

  if (isImage) {
    return (
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        {!hasError ? (
          <img 
            src={`/data/nadama_images/${cleanFilename}`} 
            alt={cleanFilename} 
            title={cleanFilename}
            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border)' }} 
            onClick={() => window.open(`/data/nadama_images/${cleanFilename}`, '_blank')}
            onError={() => setHasError(true)}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            📎 {cleanFilename} (Image not found)
          </span>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div style={{ marginTop: 8, marginBottom: 8 }}>
        {!hasError ? (
          <video 
            src={`/data/nadama_images/${cleanFilename}`} 
            controls
            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', border: '1px solid var(--border)' }} 
            onError={() => setHasError(true)}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            📎 {cleanFilename} (Video not found)
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <a 
        href={`/data/nadama_images/${cleanFilename}`} 
        target="_blank" 
        rel="noreferrer" 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'rgba(255,255,255,0.05)', 
          padding: '6px 10px', 
          borderRadius: '8px', 
          border: '1px solid var(--border)', 
          color: 'var(--text-primary)', 
          textDecoration: 'none', 
          fontSize: '0.85rem' 
        }}
      >
        📎 {cleanFilename}
      </a>
    </div>
  );
}
