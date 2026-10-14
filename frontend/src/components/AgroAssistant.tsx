import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, RotateCcw, Mic, MicOff, Phone, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { HELP_LINE } from './Header.js';

/**
 * AgroKöməkçi — the portal chat assistant.
 * Talks to POST /api/ai/chat (the server adds live portal data and calls Gemini; the API key never reaches the browser).
 * Other parts of the site can open it with a ready question:
 *   window.dispatchEvent(new CustomEvent('agro:ask', { detail: 'Bu sahə üçün hansı sənədlər lazımdır?' }))
 */

interface ChatAction { label: string; route: string }
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: ChatAction[];
  suggestions?: string[];
  failed?: boolean;
}

interface AgroAssistantProps {
  navigate: (route: string) => void;
  currentRoute: string;
}

const STORAGE_KEY = 'agro_chat_v2';
const TOPICS = [
  { emoji: '📝', text: 'Necə təklif göndərim?' },
  { emoji: '📄', text: 'Hansı sənədlər lazımdır?' },
  { emoji: '🌾', text: 'Mənə uyğun sahə tapın' },
  { emoji: '🏡', text: 'Torpağımı necə yerləşdirim?' },
  { emoji: '🔎', text: 'Təkliflərimin vəziyyəti necədir?' },
];

const newId = () => Math.random().toString(36).slice(2);

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** **bold** inside a line */
function inline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={`${keyBase}-${i}`} className="font-extrabold">{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>,
  );
}

/** Small, safe formatter: paragraphs, "1." numbered lists, "-"/"•" bullet lists and **bold**. No HTML. */
function FormattedText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-6 my-2 flex flex-col gap-1.5`}>
        {list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}
      </Tag>,
    );
    list = null;
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (num || bullet) {
      const ordered = Boolean(num);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((num ?? bullet)![1]);
    } else {
      flush();
      if (line) blocks.push(<p key={`p${i}`} className="my-1.5">{inline(line, `p${i}`)}</p>);
    }
  });
  flush();
  return <>{blocks}</>;
}

// Browser speech-to-text (Chrome/Edge). Hidden where not supported.
const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;

export const AgroAssistant: React.FC<AgroAssistantProps> = ({ navigate, currentRoute }) => {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Remember the conversation while the tab is open
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* storage blocked */ }
  }, [messages]);

  // Keep the newest message in view
  useEffect(() => {
    if (isOpen) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  // Focus the text box when opened; Esc closes
  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    recognitionRef.current?.stop?.();
    setTimeout(() => launcherRef.current?.focus(), 0);
  };

  const send = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query || loading) return;
    const history = messagesRef.current
      .filter(m => !m.failed)
      .slice(-10)
      .map(m => ({ role: m.role, text: m.text }));

    setMessages(prev => [...prev.filter(m => !m.failed), { id: newId(), role: 'user', text: query }]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: query, history, page: window.location.pathname }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        text: typeof data.answer === 'string' && data.answer ? data.answer : 'Bağışlayın, cavab hazırlaya bilmədim.',
        actions: Array.isArray(data.actions) ? data.actions.filter((a: any) => a?.label && typeof a.route === 'string' && a.route.startsWith('/')) : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((s: any) => typeof s === 'string') : [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        failed: true,
        text: `Bağlantı alınmadı. İnternetinizi yoxlayıb **“Yenidən göndər”** düyməsini basın. Təcili sualınız varsa, zəng edin: **${HELP_LINE}**`,
      }]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [loading, token]);

  // Other pages can open the chat with a question
  useEffect(() => {
    const onAsk = (e: Event) => {
      setIsOpen(true);
      const q = (e as CustomEvent<string>).detail;
      if (typeof q === 'string' && q.trim()) send(q);
    };
    window.addEventListener('agro:ask', onAsk);
    return () => window.removeEventListener('agro:ask', onAsk);
  }, [send]);

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setMessages(prev => prev.filter(m => !m.failed && m.id !== lastUser.id));
    send(lastUser.text);
  };

  const reset = () => {
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const toggleMic = () => {
    if (!SpeechRecognitionImpl) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const rec = new SpeechRecognitionImpl();
    rec.lang = 'az-AZ';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onend = () => { setListening(false); inputRef.current?.focus(); };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const goTo = (route: string) => {
    navigate(route);
    // On phones the chat covers the page, so close it to show where we went
    if (window.matchMedia('(max-width: 639px)').matches) close();
  };

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const greeting = user ? `Salam, ${user.firstName}!` : 'Salam!';
  // Hide the launcher label behind the compare bar on the list page
  const raised = currentRoute === '/opportunities';

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          className={`fixed right-4 sm:right-6 z-40 flex items-center gap-3 min-h-14 pl-4 pr-5 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-[0_10px_30px_rgba(20,71,42,0.35)] border-2 border-white ${raised ? 'bottom-24' : 'bottom-5 sm:bottom-6'}`}
        >
          <span className="w-9 h-9 rounded-full bg-gold-500 text-ink flex items-center justify-center" aria-hidden="true">
            <MessageCircle className="w-5 h-5" />
          </span>
          <span className="font-display font-extrabold text-base leading-tight text-left">
            Sualınız var?
            <span className="block font-sans font-normal text-sm text-[#DCE8E0]">Köməkçiyə yazın</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="agro-chat-title"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[27rem] sm:h-[min(42rem,calc(100vh-3rem))] bg-cream sm:rounded-3xl shadow-2xl border border-line flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-brand-900 text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-11 h-11 rounded-full bg-gold-500 text-ink flex items-center justify-center shrink-0" aria-hidden="true">
              <Sparkles className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id="agro-chat-title" className="font-display font-extrabold text-lg leading-tight">AgroKöməkçi</h2>
              <p className="text-sm text-[#C9D8CE] leading-tight truncate">Portal üzrə köməkçiniz</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                aria-label="Yeni söhbət başlat"
                title="Yeni söhbət"
                className="w-11 h-11 rounded-xl text-[#DCE8E0] hover:bg-white/10 flex items-center justify-center"
              >
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="min-h-11 px-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold flex items-center gap-1.5"
            >
              <X className="w-5 h-5" aria-hidden="true" />
              Bağla
            </button>
          </div>

          {/* Conversation */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4" role="log" aria-live="polite" aria-relevant="additions">
            {/* Welcome (always first) */}
            <div className="bg-white rounded-2xl rounded-tl-md border border-line px-4 py-3.5 text-[1.05rem] leading-relaxed max-w-[92%]">
              <p className="font-bold">{greeting} Mən AgroKöməkçiyəm.</p>
              <p className="mt-1">Sahə seçməyə, investisiya təklifi göndərməyə və torpağınızı yerləşdirməyə kömək edirəm.</p>
            </div>

            {messages.length === 0 && (
              <div>
                <p className="text-base font-bold text-muted mb-2">Bir mövzu seçin:</p>
                <div className="grid grid-cols-1 gap-2">
                  {TOPICS.map(t => (
                    <button
                      key={t.text}
                      type="button"
                      onClick={() => send(t.text)}
                      className="min-h-14 px-4 rounded-2xl bg-white border-2 border-line hover:border-brand-700 text-left font-bold text-base text-brand-900 flex items-center gap-3"
                    >
                      <span className="text-xl" aria-hidden="true">{t.emoji}</span>
                      {t.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m =>
              m.role === 'user' ? (
                <div key={m.id} className="self-end max-w-[85%] bg-brand-700 text-white rounded-2xl rounded-tr-md px-4 py-3 text-[1.05rem] leading-relaxed whitespace-pre-wrap">
                  <span className="sr-only">Siz: </span>{m.text}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] flex flex-col gap-2.5">
                  <div className={`bg-white rounded-2xl rounded-tl-md border px-4 py-3 text-[1.05rem] leading-relaxed ${m.failed ? 'border-[#C0392B]' : 'border-line'}`}>
                    <span className="sr-only">Köməkçi: </span>
                    <FormattedText text={m.text} />
                  </div>
                  {m.failed && (
                    <button type="button" onClick={retryLast} className="self-start min-h-12 px-5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold flex items-center gap-2">
                      <RotateCcw className="w-5 h-5" aria-hidden="true" />
                      Yenidən göndər
                    </button>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {m.actions.map(a => (
                        <button
                          key={a.route}
                          type="button"
                          onClick={() => goTo(a.route)}
                          className="self-start min-h-12 px-4 rounded-xl bg-gold-500 hover:bg-gold-400 text-ink font-display font-bold flex items-center gap-2 text-left"
                        >
                          {a.label}
                          <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {loading && (
              <div className="self-start bg-white rounded-2xl rounded-tl-md border border-line px-4 py-3 flex items-center gap-3 text-base text-muted" role="status">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-bounce [animation-delay:0.3s]" />
                </span>
                Cavab yazılır…
              </div>
            )}

            {/* Follow-up questions under the latest answer */}
            {!loading && lastAssistant?.suggestions && lastAssistant.suggestions.length > 0 && lastAssistant === messages[messages.length - 1] && (
              <div>
                <p className="text-sm font-bold text-muted mb-2">Bunu da soruşa bilərsiniz:</p>
                <div className="flex flex-wrap gap-2">
                  {lastAssistant.suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="min-h-11 px-4 rounded-full bg-white border-2 border-line hover:border-brand-700 text-base font-bold text-brand-900"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(input); }}
            className="shrink-0 border-t border-line bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <label htmlFor="agro-chat-input" className="sr-only">Sualınız</label>
            <div className="flex items-end gap-2">
              <textarea
                id="agro-chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={1000}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                }}
                placeholder={listening ? 'Danışın, dinləyirəm…' : 'Sualınızı yazın…'}
                className="flex-1 min-h-[3.25rem] max-h-36 resize-none px-4 py-3 rounded-2xl border-2 border-[#9AA89E] bg-white text-lg leading-snug focus:border-brand-700"
              />
              {SpeechRecognitionImpl && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-pressed={listening}
                  aria-label={listening ? 'Dinləməni dayandır' : 'Səslə soruşun'}
                  title={listening ? 'Dinləməni dayandır' : 'Səslə soruşun'}
                  className={`shrink-0 w-[3.25rem] h-[3.25rem] rounded-2xl border-2 flex items-center justify-center ${
                    listening ? 'bg-[#C0392B] border-[#C0392B] text-white animate-pulse' : 'bg-white border-line text-brand-900 hover:border-brand-700'
                  }`}
                >
                  {listening ? <MicOff className="w-6 h-6" aria-hidden="true" /> : <Mic className="w-6 h-6" aria-hidden="true" />}
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="shrink-0 h-[3.25rem] px-4 rounded-2xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-display font-bold flex items-center gap-2"
              >
                <Send className="w-5 h-5" aria-hidden="true" />
                <span className="hidden min-[400px]:inline">Göndər</span>
                <span className="sr-only min-[400px]:hidden">Göndər</span>
              </button>
            </div>
            <p className="mt-2 text-sm text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Köməkçi səhv edə bilər — vacib məlumatı yoxlayın.</span>
              <span className="whitespace-nowrap font-bold text-brand-900">
                <Phone className="inline w-4 h-4 -mt-0.5" aria-hidden="true" /> {HELP_LINE}
              </span>
            </p>
          </form>
        </div>
      )}
    </>
  );
};
