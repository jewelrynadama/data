import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { Send, User, Search, Loader2, RefreshCw, Paperclip, X, Download } from 'lucide-react';

interface WAChat {
  id: string;
  name: string;
  unreadCount: number;
  timestamp: number;
  isGroup: boolean;
  phoneNumber?: string;
  lastMessage?: {
    body: string;
    type: string;
    timestamp: number;
  };
}

interface WAMessage {
  id: string;
  fromMe: boolean;
  body: string;
  timestamp: number;
  from: string;
  to: string;
  type: string;
  base64?: string;
}

export default function WhatsAppInboxPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [waStatus, setWaStatus] = useState<string>('CONNECTING');
  const [chats, setChats] = useState<WAChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WAChat | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    
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

    let chatRefreshInterval: NodeJS.Timeout;

    newSocket.on('wa_status', (data: { status: string }) => {
      setWaStatus(data.status);
      if (data.status === 'CONNECTED' || data.status === 'AUTHENTICATED') {
        fetchChats(newSocket);
        // Silently auto-refresh chat list every 10 seconds
        chatRefreshInterval = setInterval(() => {
          fetchChats(newSocket, false);
        }, 10000);
      }
    });

    newSocket.on('wa_message_received', (msg: any) => {
      // If we receive a message for the currently selected chat, append it
      setSelectedChat(currentChat => {
        if (currentChat && (msg.from === currentChat.id || msg.to === currentChat.id)) {
          setMessages(prev => [...prev, {
            id: msg.timestamp.toString(), // or generate an id
            fromMe: false, // assuming incoming
            body: msg.body,
            timestamp: msg.timestamp,
            from: msg.from,
            to: msg.to,
            type: msg.type || 'chat'
          }]);
          scrollToBottom();
        }
        return currentChat;
      });
      // Manually update the chats list since backend getChats is returning empty
      setChats(prevChats => {
        const chatId = msg.from;
        const existingChatIndex = prevChats.findIndex(c => c.id === chatId);
        const updatedChat: WAChat = existingChatIndex >= 0 
          ? { ...prevChats[existingChatIndex] } 
          : { id: chatId, name: msg.senderName || chatId.replace('@c.us', ''), timestamp: msg.timestamp, unreadCount: 0, isGroup: false };
        
        updatedChat.timestamp = msg.timestamp;
        updatedChat.lastMessage = { body: msg.body, type: msg.type || 'chat', timestamp: msg.timestamp };
        updatedChat.unreadCount = (existingChatIndex >= 0 ? updatedChat.unreadCount : 0) + 1;
        
        const newChats = prevChats.filter(c => c.id !== chatId);
        return [updatedChat, ...newChats];
      });
    });

    return () => {
      if (chatRefreshInterval) clearInterval(chatRefreshInterval);
      newSocket.disconnect();
    };
  }, []);

  const fetchChats = (currentSocket: Socket, showLoader = true) => {
    if (showLoader) setLoadingChats(true);
    currentSocket.emit('get_chats', (response: { success: boolean, chats?: WAChat[], error?: string }) => {
      if (response.success && response.chats) {
        // Sort chats by timestamp descending
        const sorted = response.chats.sort((a, b) => b.timestamp - a.timestamp);
        setChats(sorted);
      }
      if (showLoader) setLoadingChats(false);
    });
  };

  const handleSelectChat = (chat: WAChat) => {
    setSelectedChat(chat);
    setLoadingMessages(true);
    if (socket) {
      socket.emit('get_messages', { chatId: chat.id, limit: 50 }, (response: { success: boolean, messages?: WAMessage[] }) => {
        if (response.success && response.messages) {
          setMessages(response.messages);
          scrollToBottom();
        }
        setLoadingMessages(false);
      });
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedChat || !socket) return;
    
    const messageToSend = inputText;
    setInputText('');

    // Optimistically add to UI
    const tempMsg: WAMessage = {
      id: Date.now().toString(),
      fromMe: true,
      body: messageToSend,
      timestamp: Math.floor(Date.now() / 1000),
      from: 'me',
      to: selectedChat.id,
      type: 'chat'
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    socket.emit('send_message', { to: selectedChat.id, message: messageToSend }, (res: any) => {
      if (!res.success) {
        console.error('Failed to send message:', res.error);
        alert('Gagal mengirim pesan: ' + res.error);
        // Optionally remove the optimistic message
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !socket) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const fileName = file.name;
      const mimeType = file.type;
      const isImage = mimeType && mimeType.startsWith('image/');
      const tempMsg: WAMessage = {
        id: Date.now().toString(),
        fromMe: true,
        body: isImage ? '' : `[Mengirim: ${fileName}]`,
        timestamp: Math.floor(Date.now() / 1000),
        from: 'me',
        to: selectedChat.id,
        type: isImage ? 'image' : 'document',
        base64: base64Data
      };
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom();
      
      socket.emit('send_media', { to: selectedChat.id, base64: base64Data, filename: fileName, mimeType: mimeType }, (res: any) => {
         if (!res.success) {
           console.error('Failed to send media:', res.error);
           alert('Gagal mengirim file: ' + res.error);
         }
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (waStatus !== 'CONNECTED' && waStatus !== 'AUTHENTICATED') {
    return (
      <div className="page-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ marginBottom: 16 }}>WhatsApp Tidak Terhubung</h2>
          <p style={{ color: 'var(--text-muted)' }}>Silakan buka halaman <strong>Hubungkan WA</strong> terlebih dahulu untuk men-scan QR Code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ padding: 0, height: '100%', display: 'flex', overflow: 'hidden' }}>
      
      {/* Left Panel: Chat List */}
      <div style={{ width: 350, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Live Inbox
            <button 
              onClick={() => socket && fetchChats(socket)} 
              className="btn btn-secondary" 
              style={{ padding: '6px 10px', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}
              disabled={loadingChats}
            >
              <RefreshCw size={14} className={loadingChats ? 'spin' : ''} />
              Muat Ulang
            </button>
          </h2>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Cari pesan atau nama..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field" 
              style={{ paddingLeft: 40, width: '100%', boxSizing: 'border-box' }} 
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingChats ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 12px' }} />
              <p>Memuat riwayat chat...</p>
              <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredChats.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Tidak ada chat.</div>
          ) : (
            filteredChats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                style={{ 
                  padding: '16px', 
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selectedChat?.id === chat.id ? 'var(--background)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.name.replace(/@(c\.us|lid)/, '')}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(chat.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{chat.phoneNumber || chat.id.split('@')[0]}</span>
                    {chat.unreadCount > 0 && (
                      <div style={{ background: '#25D366', color: '#fff', fontSize: 11, fontWeight: 'bold', padding: '2px 6px', borderRadius: 10 }}>
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Chat Thread */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} color="var(--text-secondary)" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>{selectedChat.name.replace(/@(c\.us|lid)/, '')}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedChat.phoneNumber ? `+${selectedChat.phoneNumber}` : selectedChat.id.split('@')[0]}
                </span>
              </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loadingMessages ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Loader2 size={32} className="spin" color="var(--accent-blue)" />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>Belum ada pesan.</div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.fromMe;
                  return (
                    <div key={msg.id || i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ 
                        background: isMe ? 'var(--accent-blue)' : 'var(--surface)', 
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        padding: '10px 16px',
                        borderRadius: 16,
                        borderTopRightRadius: isMe ? 4 : 16,
                        borderTopLeftRadius: !isMe ? 4 : 16,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {msg.type === 'chat' ? (
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.5 }}>{msg.body}</div>
                        ) : msg.type === 'image' && msg.base64 ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div onClick={() => setPreviewImage(msg.base64?.startsWith('data:') ? msg.base64 : `data:image/jpeg;base64,${msg.base64}`)}>
                              <img src={msg.base64.startsWith('data:') ? msg.base64 : `data:image/jpeg;base64,${msg.base64}`} alt="Sent Image" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: msg.body ? 8 : 0, cursor: 'zoom-in' }} />
                            </div>
                            {msg.body && <div style={{ fontSize: 14, color: isMe ? '#fff' : 'var(--text-primary)' }}>{msg.body}</div>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, fontStyle: 'italic', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                            [{msg.type} message]
                          </div>
                        )}
                        <div style={{ fontSize: 10, marginTop: 4, textAlign: 'right', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                          {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: 16, background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
              <form 
                onSubmit={e => { e.preventDefault(); handleSendMessage(); }}
                style={{ display: 'flex', gap: 12, alignItems: 'center' }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileSelect} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary" 
                  style={{ borderRadius: '50%', width: 44, height: 44, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Lampirkan File/Gambar"
                >
                  <Paperclip size={18} />
                </button>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Ketik pesan..." 
                  className="input-field" 
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 24 }} 
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ borderRadius: '50%', width: 44, height: 44, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  disabled={!inputText.trim()}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Send size={32} color="var(--text-secondary)" />
              </div>
              <h3>PearlCRM Live Inbox</h3>
              <p>Pilih chat dari daftar di sebelah kiri untuk mulai membaca dan membalas pesan.</p>
            </div>
          </div>
        )}
      </div>
      {/* Lightbox Overlay */}
      {previewImage && createPortal(
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          onClick={() => setPreviewImage(null)}
        >
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 12 }}>
            <a 
              href={previewImage} 
              download="image.jpg" 
              onClick={e => e.stopPropagation()} 
              style={{ padding: '8px 16px', borderRadius: 24, background: '#25D366', display: 'flex', alignItems: 'center', gap: 8, color: '#fff', textDecoration: 'none', fontWeight: 600 }}
              title="Download"
            >
              <Download size={20} />
              Download
            </a>
            <button 
              onClick={() => setPreviewImage(null)}
              style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer' }}
              title="Tutup"
            >
              <X size={24} />
            </button>
          </div>
          <img src={previewImage} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: 8, cursor: 'zoom-out' }} onClick={() => setPreviewImage(null)} />
        </div>,
        document.body
      )}
    </div>
  );
}
