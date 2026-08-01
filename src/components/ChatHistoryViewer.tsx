import { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Trash2, Search, MessageCircle, X, ChevronDown, Calendar, ArrowLeft } from 'lucide-react';
import AttachmentViewer from './AttachmentViewer';
import {
  getAllThreads,
  getThreadsForCustomer,
  deleteThread,
  parseWAChatFile,
  saveThread,
  loadNadamaPreloadedChat,
  type ChatThread,
  type ChatMessage,
} from '../utils/chatHistoryStore';

interface Props {
  waNumber?: string;
  customerName?: string;
  onClose?: () => void;
}

export default function ChatHistoryViewer({ waNumber, customerName, onClose }: Props) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'customer'>(waNumber || customerName ? 'customer' : 'all');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  const [dateFilter, setDateFilter] = useState<string>('Semua');
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  
  const [importPreview, setImportPreview] = useState<ChatThread | null>(null);
  const [importStoreName, setImportStoreName] = useState('');
  const [importWaNumber, setImportWaNumber] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, waNumber, customerName]);

  const loadThreads = async () => {
    let loadedThreads: ChatThread[] = [];
    if (filterMode === 'customer' && (waNumber || customerName)) {
      loadedThreads = getThreadsForCustomer(waNumber || '', customerName || '');
    } else {
      loadedThreads = getAllThreads();
      if (loadedThreads.length === 0) {
        const nadamaThread = await loadNadamaPreloadedChat();
        if (nadamaThread) {
          loadedThreads = [nadamaThread];
        }
      }
    }
    setThreads(loadedThreads);
    if (!activeThreadId && loadedThreads.length > 0) {
      setActiveThreadId(loadedThreads[0].id);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseWAChatFile(text, file.name);
    setImportPreview(parsed);
    setImportStoreName('');
    setImportWaNumber(waNumber || parsed?.customerName || '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const confirmImport = () => {
    if (!importPreview) return;
    const threadToSave = { ...importPreview };
    if (importStoreName) {
      threadToSave.messages = threadToSave.messages.map((m: ChatMessage) => ({
        ...m,
        isStore: m.sender === importStoreName || m.isStore
      }));
    }
    if (importWaNumber) {
      threadToSave.waNumber = importWaNumber;
    }
    saveThread(threadToSave);
    setImportPreview(null);
    loadThreads();
    setActiveThreadId(threadToSave.id);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat thread?')) {
      deleteThread(id);
      if (activeThreadId === id) setActiveThreadId(null);
      loadThreads();
    }
  };

  const activeThread = useMemo(() => threads.find(t => t.id === activeThreadId) || null, [threads, activeThreadId]);

  useEffect(() => {
    setDateFilter('Semua');
  }, [activeThreadId]);

  const availableMonths = useMemo(() => {
    if (!activeThread) return [];
    const monthsSet = new Set<string>();
    activeThread.messages.forEach((msg: ChatMessage) => {
      let msgDateObj = new Date(msg.dateStr);
      if (isNaN(msgDateObj.getTime())) {
         const dPart = msg.dateStr.split(/[\s,]+/)[0];
         if (dPart) {
             const parts = dPart.includes('/') ? dPart.split('/') : dPart.split('-');
             if (parts.length === 3) {
                 const p0 = parseInt(parts[0]);
                 const p1 = parseInt(parts[1]);
                 const p2 = parseInt(parts[2]);
                 msgDateObj = new Date(p2 < 100 ? 2000 + p2 : p2, p1 - 1, p0 > 31 ? p2 : p0);
             }
         }
      }
      if (!isNaN(msgDateObj.getTime())) {
        monthsSet.add(msgDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }));
      }
    });
    return Array.from(monthsSet);
  }, [activeThread]);

  const filteredMessages = useMemo(() => {
    if (!activeThread) return [];
    return activeThread.messages.filter((msg: ChatMessage) => {
      if (dateFilter === 'Semua') return true;
      
      let msgDateObj = new Date(msg.dateStr);
      if (isNaN(msgDateObj.getTime())) {
         const dPart = msg.dateStr.split(/[\s,]+/)[0];
         if (dPart) {
             const parts = dPart.includes('/') ? dPart.split('/') : dPart.split('-');
             if (parts.length === 3) {
                 const p0 = parseInt(parts[0]);
                 const p1 = parseInt(parts[1]);
                 const p2 = parseInt(parts[2]);
                 msgDateObj = new Date(p2 < 100 ? 2000 + p2 : p2, p1 - 1, p0 > 31 ? p2 : p0);
             }
         }
      }
      if (isNaN(msgDateObj.getTime())) return true;
      
      const msgMonthYear = msgDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      return msgMonthYear === dateFilter;
    });
  }, [activeThread, dateFilter]);

  const searchMatches = useMemo(() => {
    if (!filteredMessages) return [];
    const query = searchQuery.toLowerCase();
    if (!query) return [];
    return filteredMessages
      .map((m: ChatMessage, index: number) => m.text.toLowerCase().includes(query) ? index : -1)
      .filter((i: number) => i !== -1);
  }, [filteredMessages, searchQuery]);

  const renderMessageContent = (content: string, index: number) => {
    const attachmentRegex = /<(?:terlampir|attached):\s*([^>]+)>/gi;
    const tokens = [];
    let lastIndex = 0;
    let match;
    
    while ((match = attachmentRegex.exec(content)) !== null) {
       if (match.index > lastIndex) {
          tokens.push({ type: 'text', text: content.substring(lastIndex, match.index) });
       }
       tokens.push({ type: 'attachment', filename: match[1].trim() });
       lastIndex = attachmentRegex.lastIndex;
    }
    if (lastIndex < content.length) {
       tokens.push({ type: 'text', text: content.substring(lastIndex) });
    }

    return tokens.map((token, tIdx) => {
      if (token.type === 'attachment') {
        return <AttachmentViewer key={`att-${tIdx}`} filename={token.filename || ''} />;
      }
      
      const text = token.text || '';
      if (!searchQuery) return <span key={`txt-${tIdx}`}>{text}</span>;
      
      const regex = new RegExp(`(${searchQuery})`, 'gi');
      const parts = text.split(regex);
      const isCurrentMatch = searchMatches[currentMatchIndex] === index;
      
      return (
        <span key={`txt-${tIdx}`}>
          {parts.map((part: string, pIdx: number) => 
            regex.test(part) ? (
              <span key={pIdx} style={{ backgroundColor: 'yellow', color: '#000', fontWeight: isCurrentMatch ? 'bold' : 'normal' }}>
                {part}
              </span>
            ) : part
          )}
        </span>
      );
    });
  };

  const scrollToMatch = (index: number) => {
    if (index >= 0 && index < searchMatches.length) {
      setCurrentMatchIndex(index);
      const matchElem = document.getElementById(`msg-${searchMatches[index]}`);
      if (matchElem) {
        matchElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSearchNext = () => scrollToMatch((currentMatchIndex + 1) % searchMatches.length);
  const handleSearchPrev = () => scrollToMatch((currentMatchIndex - 1 + searchMatches.length) % searchMatches.length);

  useEffect(() => {
    if (searchMatches.length > 0) {
      scrollToMatch(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchMatches.length]);

  useEffect(() => {
    if (!searchQuery && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [activeThreadId, searchQuery]);

  const renderMessages = () => {
    if (!activeThread) return null;
    if (!filteredMessages || filteredMessages.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Tidak ada pesan yang sesuai dengan filter.
        </div>
      );
    }
    
    let currentMonthYear = '';
    return filteredMessages.map((msg: ChatMessage, idx: number) => {
      const msgDateObj = new Date(msg.dateStr);
      
      const msgMonthYear = isNaN(msgDateObj.getTime()) ? msg.dateStr.split(' ')[0] : msgDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const showMonthDivider = msgMonthYear !== currentMonthYear;
      if (showMonthDivider) currentMonthYear = msgMonthYear;

      const prevMsg = idx > 0 ? filteredMessages[idx - 1] : null;
      const prevMsgDateObj = prevMsg ? new Date(prevMsg.dateStr) : null;
      
      const isNewDay = !prevMsgDateObj || isNaN(prevMsgDateObj.getTime()) || isNaN(msgDateObj.getTime()) 
        ? true 
        : prevMsgDateObj.toLocaleDateString() !== msgDateObj.toLocaleDateString();

      const showSender = !prevMsg || prevMsg.sender !== msg.sender || showMonthDivider || isNewDay;
      
      const timeOnlyStr = msg.dateStr.includes(' ') ? msg.dateStr.split(' ')[1].substring(0, 5) : (!isNaN(msgDateObj.getTime()) ? msgDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
      const dayStr = !isNaN(msgDateObj.getTime()) ? msgDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
      const timeStr = dayStr ? `${dayStr}, ${timeOnlyStr}` : timeOnlyStr;

      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
          {showMonthDivider && (
            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0 16px 0' }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
              <span style={{ margin: '0 12px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>{msgMonthYear}</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
            </div>
          )}
          <div id={`msg-${idx}`} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.isStore ? 'flex-end' : 'flex-start',
            marginBottom: '8px'
          }}>
            <div style={{
              maxWidth: '75%',
              padding: '8px 12px',
              background: msg.isStore ? 'rgba(37,211,102,0.15)' : 'var(--bg-secondary)',
              border: msg.isStore ? '1px solid rgba(37,211,102,0.3)' : '1px solid var(--border)',
              borderRadius: msg.isStore ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              color: 'var(--text-primary)'
            }}>
              {showSender && !msg.isStore && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                  {msg.sender}
                </div>
              )}
              <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {renderMessageContent(msg.text, idx)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>
                {timeStr}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', border: 'none', borderRadius: 0, overflow: 'hidden', position: 'relative' }}>
       {/* SIDEBAR - absolute overlay on mobile, normal flow on desktop */}
       <div style={{
         width: isMobile ? '100%' : '280px',
         display: 'flex',
         flexDirection: 'column',
         background: 'var(--bg-secondary)',
         borderRight: isMobile ? 'none' : '1px solid var(--border)',
         position: isMobile ? 'absolute' : 'relative',
         top: 0, left: 0, bottom: 0,
         zIndex: isMobile ? 20 : 'auto',
         transform: isMobile && !showSidebar ? 'translateX(-100%)' : 'translateX(0)',
         transition: 'transform 0.25s ease',
         boxShadow: isMobile && showSidebar ? '4px 0 16px rgba(0,0,0,0.2)' : 'none'
       }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Chat History</h3>
                {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>}
             </div>
             {(waNumber || customerName) && (
               <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                 <button 
                   onClick={() => setFilterMode('customer')}
                   style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: filterMode === 'customer' ? 'var(--text-primary)' : 'var(--bg-card)', color: filterMode === 'customer' ? 'var(--bg-card)' : 'var(--text-primary)' }}
                 >This Customer</button>
                 <button 
                   onClick={() => setFilterMode('all')}
                   style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: filterMode === 'all' ? 'var(--text-primary)' : 'var(--bg-card)', color: filterMode === 'all' ? 'var(--bg-card)' : 'var(--text-primary)' }}
                 >All Chats</button>
               </div>
             )}
             <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                <Upload size={16} /> Import .txt
             </button>
             <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {threads.map(thread => {
              let d1 = '';
              let d2 = '';
              if (thread.messages.length > 0) {
                 const firstD = new Date(thread.messages[0].dateStr);
                 const lastD = new Date(thread.messages[thread.messages.length - 1].dateStr);
                 d1 = isNaN(firstD.getTime()) ? thread.messages[0].dateStr.split(' ')[0] : firstD.toLocaleDateString();
                 d2 = isNaN(lastD.getTime()) ? thread.messages[thread.messages.length - 1].dateStr.split(' ')[0] : lastD.toLocaleDateString();
              }
              
              return (
                <div 
                  key={thread.id} 
                  onClick={() => { setActiveThreadId(thread.id); if (isMobile) setShowSidebar(false); }}
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: activeThreadId === thread.id ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                    borderLeft: activeThreadId === thread.id ? '4px solid #8b5cf6' : '4px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {thread.customerName || 'Unknown Customer'}
                    </div>
                    <button onClick={(e) => handleDelete(thread.id, e)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {thread.fileName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{thread.messages.length} msgs</span>
                    {thread.messages.length > 0 && (
                       <span>
                         {d1} {d1 !== d2 && `- ${d2}`}
                       </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
       </div>

       {/* Backdrop when sidebar open on mobile */}
       {isMobile && showSidebar && (
         <div
           onClick={() => setShowSidebar(false)}
           style={{ position: 'absolute', inset: 0, zIndex: 19, background: 'rgba(0,0,0,0.35)' }}
         />
       )}

       {/* MAIN CHAT AREA - always renders */}
       <div style={{
         flex: 1,
         display: 'flex',
         flexDirection: 'column',
         background: 'var(--bg-card)',
         position: 'relative',
         minWidth: 0
       }}>
          {activeThread ? (
            <>
              {/* Header - 2 baris */}
              <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                {/* Row 1: Back button + Name + msg count */}
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isMobile && (
                    <button
                      onClick={() => setShowSidebar(true)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', padding: '4px', marginRight: '4px' }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <MessageCircle size={20} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeThread.customerName || 'Chat'}</span>
                  <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 }}>
                    {filteredMessages.length}/{activeThread.messages.length} msgs
                  </span>
                </div>
                {/* Row 2: Period filter + Search */}
                <div style={{ padding: '6px 12px 8px', display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
                  {/* Period label - hidden on mobile to save space */}
                  {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <Calendar size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Periode:</span>
                    </div>
                  )}

                  {/* Semua pill */}
                  <button
                    onClick={() => { setDateFilter('Semua'); setShowMonthDropdown(false); }}
                    style={{
                      padding: '3px 12px', borderRadius: '20px', border: 'none', flexShrink: 0,
                      background: dateFilter === 'Semua' ? 'var(--primary-color, #1877F2)' : 'var(--bg-card)',
                      color: dateFilter === 'Semua' ? '#fff' : 'var(--text-primary)',
                      fontSize: '0.82rem', fontWeight: dateFilter === 'Semua' ? 600 : 400,
                      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                      boxShadow: dateFilter === 'Semua' ? '0 2px 4px rgba(24,119,242,0.25)' : 'none'
                    }}
                  >
                    Semua
                  </button>

                  {/* First 2 month pills */}
                  {availableMonths.slice(0, 2).map(my => (
                    <button
                      key={my}
                      onClick={() => { setDateFilter(my); setShowMonthDropdown(false); }}
                      style={{
                        padding: '3px 12px', borderRadius: '20px', border: 'none', flexShrink: 0,
                        background: dateFilter === my ? 'var(--primary-color, #1877F2)' : 'var(--bg-card)',
                        color: dateFilter === my ? '#fff' : 'var(--text-primary)',
                        fontSize: '0.82rem', fontWeight: dateFilter === my ? 600 : 400,
                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                        boxShadow: dateFilter === my ? '0 2px 4px rgba(24,119,242,0.25)' : 'none'
                      }}
                    >
                      {my}
                    </button>
                  ))}

                  {/* More dropdown if > 2 months */}
                  {availableMonths.length > 2 && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={() => setShowMonthDropdown(v => !v)}
                        style={{
                          padding: '3px 10px', borderRadius: '20px', border: 'none',
                          background: availableMonths.slice(2).includes(dateFilter) ? 'var(--primary-color, #1877F2)' : 'var(--bg-card)',
                          color: availableMonths.slice(2).includes(dateFilter) ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', gap: '3px',
                          boxShadow: availableMonths.slice(2).includes(dateFilter) ? '0 2px 4px rgba(24,119,242,0.25)' : 'none'
                        }}
                      >
                        {availableMonths.slice(2).includes(dateFilter) ? dateFilter : `+${availableMonths.length - 2} lainnya`}
                        <ChevronDown size={12} style={{ transform: showMonthDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                      {showMonthDropdown && (
                        <div style={{
                          position: 'fixed', zIndex: 200,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                          minWidth: '170px', padding: '4px 0', maxHeight: '50vh', overflowY: 'auto'
                        }}>
                          {availableMonths.slice(2).map(my => (
                            <button
                              key={my}
                              onClick={() => { setDateFilter(my); setShowMonthDropdown(false); }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '10px 16px',
                                border: 'none', background: dateFilter === my ? 'rgba(24,119,242,0.1)' : 'transparent',
                                color: dateFilter === my ? 'var(--primary-color, #1877F2)' : 'var(--text-primary)',
                                fontSize: '0.9rem', fontWeight: dateFilter === my ? 600 : 400,
                                cursor: 'pointer'
                              }}
                            >
                              {my}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

                  {/* Search */}
                  <Search size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', width: isMobile ? '70px' : '120px', fontSize: '0.9rem', minWidth: 0 }}
                  />
                  {searchQuery && searchMatches.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {currentMatchIndex + 1}/{searchMatches.length}
                      <button onClick={handleSearchPrev} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                      <button onClick={handleSearchNext} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                  {searchQuery && searchMatches.length === 0 && (
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>0/0</span>
                  )}
                </div>
              </div>
              
              {/* Messages */}
              <div ref={messageListRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', overflowAnchor: 'none' }}>
                {renderMessages()}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
             <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', padding: '32px', maxWidth: '400px', textAlign: 'center' }}>
                  <MessageCircle size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>No Chat Selected</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'left', lineHeight: 1.6 }}>
                    <p style={{ marginTop: 0 }}><strong>To import WhatsApp chat:</strong></p>
                    <ol style={{ paddingLeft: '20px', margin: 0 }}>
                      <li>Buka WhatsApp &rarr; Chat konsumen &rarr; &#8942; &rarr; Export Chat &rarr; Tanpa Media</li>
                      <li>Transfer file .txt ke komputer</li>
                      <li>Klik tombol <strong>Import .txt</strong> di atas</li>
                    </ol>
                  </div>
                </div>
             </div>
          )}
       </div>

       {/* Import Modal */}
       {importPreview && (
         <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%', border: '1px solid var(--border)' }}>
               <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Import Chat Preview</h3>
               
               <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                 Detected <strong>{importPreview.messages.length}</strong> messages.
               </div>

               <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)', fontSize: '0.85rem', maxHeight: '150px', overflowY: 'auto' }}>
                 {importPreview.messages.slice(0, 3).map((m: ChatMessage, i: number) => (
                   <div key={i} style={{ marginBottom: '8px' }}>
                     <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{m.sender}: </span>
                     <span style={{ color: 'var(--text-primary)' }}>{m.text.length > 50 ? m.text.substring(0, 50) + '...' : m.text}</span>
                   </div>
                 ))}
                 {importPreview.messages.length > 3 && <div style={{ color: 'var(--text-muted)' }}>...</div>}
               </div>

               <div style={{ marginBottom: '16px' }}>
                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Set Store Name (Overrides sender to match Store)</label>
                 <input 
                   type="text" 
                   value={importStoreName} 
                   onChange={e => setImportStoreName(e.target.value)} 
                   placeholder="e.g. CS Store" 
                   style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                 />
               </div>

               <div style={{ marginBottom: '24px' }}>
                 <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Customer WA Number</label>
                 <input 
                   type="text" 
                   value={importWaNumber} 
                   onChange={e => setImportWaNumber(e.target.value)} 
                   placeholder="e.g. 628123456789" 
                   style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                 />
               </div>

               <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                 <button onClick={() => setImportPreview(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>Cancel</button>
                 <button onClick={confirmImport} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: 'pointer', fontWeight: 600 }}>Save Chat</button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}
