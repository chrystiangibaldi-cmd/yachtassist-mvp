import React, { useState, useRef, useEffect, useContext } from 'react';
import axios from 'axios';
import { Anchor, Send, X } from 'lucide-react';
import { UserContext } from '@/App';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const INITIAL_GREETING = {
  role: 'assistant',
  content:
    "Ciao! Sono l'assistente YachtAssist. Puoi chiedermi di D.M. 133/2024, preventivi, pagamenti, selezione tecnici o manutenzione nautica.",
};

const AiChatWidget = () => {
  const { user } = useContext(UserContext);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND}/ai/chat`, {
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        user_id: user?.id || null,
      });
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: 'assistant', content: 'Mi dispiace, il servizio non è raggiungibile. Riprova tra poco.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Apri chat assistente"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0A2342] text-white shadow-lg hover:bg-[#0A2342]/90 flex items-center justify-center transition"
        >
          <Anchor className="w-6 h-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-6rem)] bg-white border border-slate-200 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0A2342] text-white">
            <div className="flex items-center gap-2">
              <Anchor className="w-5 h-5 text-[#00A878]" />
              <div>
                <div className="font-semibold text-sm">Assistente YachtAssist</div>
                <div className="text-xs text-slate-300">Nautica &amp; piattaforma</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi chat"
              className="p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-[#00A878] text-white'
                    : 'mr-auto bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-white border border-slate-200 text-slate-500 text-sm px-3 py-2 rounded-lg">
                L'assistente sta scrivendo…
              </div>
            )}
          </div>

          <div className="p-2 border-t border-slate-200 bg-white flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda…"
              rows={1}
              className="flex-1 resize-none px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00A878] max-h-24"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Invia messaggio"
              className="px-3 rounded-lg bg-[#00A878] text-white hover:bg-[#00A878]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
