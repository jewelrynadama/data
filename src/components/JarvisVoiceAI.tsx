import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader, Volume2, X } from 'lucide-react';
import { askJarvis } from '../utils/aiEngine';
import type { Customer, CustomerRow } from '../types';
import type { StoreSettings } from '../pages/SettingsPage';

interface Props {
  customers: Customer[];
  rows: CustomerRow[];
  settings: StoreSettings;
  setPage?: (page: any) => void;
}

export default function JarvisVoiceAI({ customers, rows, settings, setPage }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant', content: string}[]>([]);

  // Web Speech API
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'id-ID';

      recognition.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        setIsListening(false);
        handleAskJarvis(text);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          // just ignore
        } else {
          setShowBubble(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [customers]);

  const toggleListening = () => {
    if (!showBubble) setShowBubble(true);

    if (!speechSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (synthRef.current) synthRef.current.cancel(); // stop current speech
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessing) return;
    const query = inputText;
    setInputText('');
    handleAskJarvis(query);
  };

  const handleAskJarvis = async (query: string) => {
    setIsProcessing(true);
    
    let finalReply = await askJarvis(query, customers, rows, chatHistory, settings);
    
    // Parse ACTION tag if exists: [[ACTION:page_name|YEAR:2025]]
    const actionMatch = finalReply.match(/\[\[ACTION:([^\]]+)\]\]/);
    if (actionMatch && actionMatch[1]) {
      const actionContent = actionMatch[1].trim();
      const parts = actionContent.split('|');
      const actionPage = parts[0];

      if (setPage) {
        setPage(actionPage);
      }

      const yearPart = parts.find(p => p.startsWith('YEAR:'));
      if (yearPart) {
        const year = parseInt(yearPart.split(':')[1], 10);
        if (!isNaN(year)) {
          // Beri sedikit delay agar komponen halaman sempat me-render sebelum menerima event
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('AI_SET_YEAR', { detail: year }));
          }, 300);
        }
      }

      // Remove the tag from spoken text
      finalReply = finalReply.replace(/\[\[ACTION:[^\]]+\]\]/g, '').trim();
    }

    setIsProcessing(false);
    
    setChatHistory(prev => {
      // Keep only last 10 messages to avoid context overflow
      const newHistory = [
        ...prev, 
        {role: 'user' as const, content: query}, 
        {role: 'assistant' as const, content: finalReply}
      ];
      return newHistory.slice(-10);
    });
    
    // Speak
    if (synthRef.current && finalReply) {
      // Bersihkan karakter markdown agar mesin suara tidak membaca "asteris" atau "hash"
      const cleanTextForSpeech = finalReply.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech);
      utterance.lang = 'id-ID';
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
      
      const voices = synthRef.current.getVoices();
      
      // Prioritaskan suara yang lebih natural (Gadis, Andika, atau Google)
      const preferredNames = ['Gadis', 'Andika', 'Google Bahasa Indonesia', 'Aris'];
      let selectedVoice = null;
      for (const pref of preferredNames) {
         selectedVoice = voices.find(v => v.lang.includes('id') && v.name.includes(pref));
         if (selectedVoice) break;
      }
      
      if (!selectedVoice) {
         selectedVoice = voices.find(v => v.lang.includes('id') && v.name.toLowerCase().includes('female')) 
                      || voices.find(v => v.lang.includes('id'));
      }
      
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
    }
  };

  const handleClose = () => {
    setShowBubble(false);
    if (synthRef.current) synthRef.current.cancel();
    if (isListening) recognitionRef.current?.stop();
    setIsListening(false);
    setIsSpeaking(false);
  };

  if (!speechSupported && !showBubble) {
    // If not supported, we still render the button so they can open the text chat
  }

  return (
    <div className="jarvis-voice-container" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9995, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
      
      {/* Chat Bubble */}
      {showBubble && (
        <div style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border)', 
          borderRadius: 20, 
          padding: 20, 
          width: 300,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          position: 'relative',
          animation: 'slideUp 0.3s ease'
        }}>
          <button onClick={handleClose} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
          
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0ea5e9', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: '#0ea5e9', borderRadius: '50%', boxShadow: '0 0 10px #0ea5e9', animation: isSpeaking || isListening ? 'pulse 1s infinite' : 'none' }} />
            VERA AI ANALYST
          </div>

          <div style={{ minHeight: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {isListening ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🎙️</div>
                <div style={{ fontSize: 13 }}>Mendengarkan...</div>
              </div>
            ) : isProcessing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <Loader size={18} className="spinner" /> 
                <span style={{ fontSize: 13 }}>Memproses...</span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                {isSpeaking ? (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 8, display: 'inline-block', animation: 'pulse 1s infinite' }}>🔊</div>
                    <div style={{ fontSize: 13 }}>Vera sedang berbicara...</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                    <div style={{ fontSize: 13 }}>Siap membantu!</div>
                  </>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleTextSubmit} style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tanya Vera di sini..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-body)', color: 'var(--text-primary)', fontSize: 13
              }}
            />
            <button 
              type="submit" 
              disabled={isProcessing || !inputText.trim()}
              style={{
                padding: '8px 12px', borderRadius: 8, border: 'none', background: '#0ea5e9',
                color: 'white', fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !inputText.trim() ? 0.6 : 1
              }}
            >
              Kirim
            </button>
          </form>

        </div>
      )}

      {/* Floating Mic Button */}
      <button
        onClick={toggleListening}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: isListening ? '#ef4444' : isSpeaking ? '#0ea5e9' : '#FFFFFF',
          color: isListening || isSpeaking ? '#fff' : '#0ea5e9',
          border: isListening || isSpeaking ? 'none' : '1px solid var(--border)',
          boxShadow: isListening ? '0 0 15px rgba(239,68,68,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
          transform: isListening ? 'scale(1.05)' : 'scale(1)'
        }}
        title="Bicara dengan Vera"
      >
        {isSpeaking ? <Volume2 size={16} /> : isListening ? <MicOff size={16} /> : speechSupported ? <Mic size={16} /> : <div style={{fontSize: 14}}>✨</div>}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 600px) {
          .jarvis-voice-container {
            bottom: 60px !important;
            right: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
