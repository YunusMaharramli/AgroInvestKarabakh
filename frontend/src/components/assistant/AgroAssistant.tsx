import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageCircle, Mic, MicOff, Phone, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { useLang, useLocalePath } from '../../app/i18n';
import { useCurrentUser } from '../../services/api';
import { backendToken } from '../../services/backend';
import { CONTACT } from '../layout/Header';
import { cabinetHome } from '../../features/auth/routing';

/**
 * AgroKöməkçi — the portal chat assistant (restored from the previous site).
 * Talks to POST /api/ai/chat: the server adds live portal data and calls Gemini (the key never reaches the browser).
 * Other parts of the site can open it with a ready question:
 *   window.dispatchEvent(new CustomEvent('agro:ask', { detail: 'Hansı sənədlər lazımdır?' }))
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

const STORAGE_KEY = 'agro_chat_v2';
const TOPIC_EMOJI = ['📝', '📄', '🌾', '🏡', '🔎'];
const SPEECH_LANG: Record<string, string> = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' };

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
      ? <strong key={`${keyBase}-${i}`} className="font-bold">{part.slice(2, -2)}</strong>
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
    const items = list.items;
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-6 my-2 flex flex-col gap-1.5`}>
        {items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>)}
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionImpl: any =
  typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The server suggests routes of the previous site ("/opportunities", "/lands/new", ...).
 * Map them to the pages of the new site.
 */
function mapRoute(route: string, signedIn: boolean, home: string): string {
  const path = route.split('?')[0];
  if (path === '/login') return '/login';
  if (path === '/register') return '/signup';
  if (path === '/dashboard') return signedIn ? home : '/login';
  if (path === '/lands/new') return '/owner/add-land';
  if (path === '/compare') return '/investor/compare';
  if (path === '/agromatch') return '/investor';
  if (path === '/map') return '/investments#map';
  if (path === '/opportunities' || path.startsWith('/opportunities/') || path.startsWith('/proposals/new/')) return signedIn ? '/investor/search' : '/investments';
  return '/';
}

export const AgroAssistant: React.FC = () => {
  const { t } = useTranslation();
  const lang = useLang();
  const lp = useLocalePath();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const recognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const topics = t('assistant.topics', { returnObjects: true }) as unknown as string[];

  // Remember the conversation while the tab is open
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* storage blocked */ }
  }, [messages]);

  // Keep the newest message in view
  useEffect(() => {
    if (isOpen) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    recognitionRef.current?.stop?.();
    setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  // Focus the text box when opened; Esc closes
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(id); document.removeEventListener('keydown', onKey); };
  }, [isOpen, close]);

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
      const token = backendToken();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: query, history, page: window.location.pathname, language: lang }),
        signal: controller.signal,
      });
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(String(res.status));
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        text: typeof data.answer === 'string' && data.answer ? data.answer : t('assistant.noAnswer'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: Array.isArray(data.actions) ? data.actions.filter((a: any) => a?.label && typeof a.route === 'string' && a.route.startsWith('/')) : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter((s: unknown) => typeof s === 'string') : [],
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'assistant',
        failed: true,
        text: t('assistant.failed', { phone: CONTACT.phone }),
      }]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [loading, lang, t]);

  // Other pages can open the chat with a question
  useEffect(() => {
    const onAsk = (e: Event) => {
      setIsOpen(true);
      const q = (e as CustomEvent<string>).detail;
      if (typeof q === 'string' && q.trim()) void send(q);
    };
    window.addEventListener('agro:ask', onAsk);
    return () => window.removeEventListener('agro:ask', onAsk);
  }, [send]);

  const retryLast = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setMessages(prev => prev.filter(m => !m.failed && m.id !== lastUser.id));
    void send(lastUser.text);
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
    rec.lang = SPEECH_LANG[lang] ?? 'az-AZ';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
    navigate(lp(mapRoute(route, !!user, user ? cabinetHome(user) : '/login')));
    // On phones the chat covers the page, so close it to show where we went
    if (window.matchMedia('(max-width: 639px)').matches) close();
  };

  // Not on the full-screen sign-in pages
  const section = pathname.split('/')[2] ?? '';
  if (['login', 'signup', 'forgot-password', 'reset-password', 'confirm-email', 'choose-cabinet'].includes(section)) return null;
  // Cabinets have a bottom tab bar on phones; the compare bar sits above it
  const inCabinet = section === 'owner' || section === 'investor';
  const launcherBottom = inCabinet ? 'bottom-20 lg:bottom-6' : 'bottom-5 sm:bottom-6';

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const firstName = user?.fullName.split(' ')[0];

  return (
    <>
      {!isOpen && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          className={`fixed right-4 sm:right-6 z-[45] flex items-center gap-3 min-h-14 pl-2.5 pr-5 rounded-full bg-brand hover:bg-brand-dark text-cream shadow-[0_10px_30px_rgba(20,54,33,0.35)] border-2 border-cream transition ${launcherBottom}`}
        >
          <span className="w-10 h-10 rounded-full bg-gold text-forest grid place-items-center" aria-hidden="true">
            <MessageCircle className="w-5 h-5" />
          </span>
          <span className="font-bold text-sm leading-tight text-left">
            {t('assistant.launcher')}
            <span className="hidden sm:block font-normal text-xs text-cream/80">{t('assistant.launcherSub')}</span>
          </span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="agro-chat-title"
          className="fixed z-[70] inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[26rem] sm:h-[min(42rem,calc(100svh-3rem))] bg-cream sm:rounded-[1.5rem] shadow-[0_24px_60px_rgba(20,54,33,0.35)] border border-line flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-forest text-cream px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="w-11 h-11 rounded-full bg-gold text-forest grid place-items-center shrink-0" aria-hidden="true">
              <Sparkles className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 id="agro-chat-title" className="font-display text-xl leading-tight">AgroKöməkçi</h2>
              <p className="text-sm text-cream/75 leading-tight truncate">{t('assistant.subtitle')}</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} aria-label={t('assistant.newChat')} title={t('assistant.newChat')}
                className="w-11 h-11 rounded-xl text-cream/85 hover:bg-white/10 grid place-items-center">
                <RotateCcw className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={close} className="min-h-11 px-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold flex items-center gap-1.5 text-sm">
              <X className="w-5 h-5" aria-hidden="true" />
              {t('assistant.close')}
            </button>
          </div>

          {/* Conversation */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4" role="log" aria-live="polite" aria-relevant="additions">
            <div className="bg-white rounded-2xl rounded-tl-md border border-line px-4 py-3.5 leading-relaxed max-w-[92%]">
              <p className="font-bold">{firstName ? t('assistant.helloName', { name: firstName }) : t('assistant.hello')}</p>
              <p className="mt-1 text-muted">{t('assistant.intro')}</p>
            </div>

            {messages.length === 0 && (
              <div>
                <p className="text-sm font-bold text-muted mb-2">{t('assistant.pickTopic')}</p>
                <div className="grid gap-2">
                  {topics.map((text, i) => (
                    <button key={text} type="button" onClick={() => void send(text)}
                      className="min-h-12 px-4 rounded-2xl bg-white border-2 border-line hover:border-brand text-left font-semibold text-brand flex items-center gap-3 transition">
                      <span className="text-xl" aria-hidden="true">{TOPIC_EMOJI[i % TOPIC_EMOJI.length]}</span>
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(m =>
              m.role === 'user' ? (
                <div key={m.id} className="self-end max-w-[85%] bg-brand text-cream rounded-2xl rounded-tr-md px-4 py-3 leading-relaxed whitespace-pre-wrap">
                  <span className="sr-only">{t('assistant.you')}: </span>{m.text}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] flex flex-col gap-2.5">
                  <div className={`bg-white rounded-2xl rounded-tl-md border px-4 py-3 leading-relaxed ${m.failed ? 'border-danger' : 'border-line'}`}>
                    <span className="sr-only">AgroKöməkçi: </span>
                    <FormattedText text={m.text} />
                  </div>
                  {m.failed && (
                    <button type="button" onClick={retryLast} className="btn btn-primary self-start">
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />{t('assistant.retry')}
                    </button>
                  )}
                  {m.actions && m.actions.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {m.actions.map(a => (
                        <button key={a.route} type="button" onClick={() => goTo(a.route)} className="btn btn-gold self-start text-left">
                          {a.label}<ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {loading && (
              <div className="self-start bg-white rounded-2xl rounded-tl-md border border-line px-4 py-3 flex items-center gap-3 text-muted" role="status">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-leaf animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-leaf animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-leaf animate-bounce [animation-delay:0.3s]" />
                </span>
                {t('assistant.typing')}
              </div>
            )}

            {!loading && lastAssistant?.suggestions && lastAssistant.suggestions.length > 0 && lastAssistant === messages[messages.length - 1] && (
              <div>
                <p className="text-sm font-bold text-muted mb-2">{t('assistant.alsoAsk')}</p>
                <div className="flex flex-wrap gap-2">
                  {lastAssistant.suggestions.map(s => (
                    <button key={s} type="button" onClick={() => void send(s)}
                      className="min-h-10 px-4 rounded-full bg-white border-2 border-line hover:border-brand text-sm font-semibold text-brand transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); void send(input); }}
            className="shrink-0 border-t border-line bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="agro-chat-input" className="sr-only">{t('assistant.inputLabel')}</label>
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
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                placeholder={listening ? t('assistant.listening') : t('assistant.placeholder')}
                className="field flex-1 !min-h-[3rem] max-h-36 resize-none leading-snug"
              />
              {SpeechRecognitionImpl && (
                <button type="button" onClick={toggleMic} aria-pressed={listening}
                  aria-label={listening ? t('assistant.micStop') : t('assistant.mic')} title={listening ? t('assistant.micStop') : t('assistant.mic')}
                  className={`shrink-0 w-12 h-12 rounded-xl border-2 grid place-items-center ${listening ? 'bg-danger border-danger text-white animate-pulse' : 'bg-white border-line text-brand hover:border-brand'}`}>
                  {listening ? <MicOff className="w-5 h-5" aria-hidden="true" /> : <Mic className="w-5 h-5" aria-hidden="true" />}
                </button>
              )}
              <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary shrink-0 !h-12 !px-4 disabled:opacity-50" aria-label={t('assistant.send')}>
                <Send className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{t('assistant.disclaimer')}</span>
              <a href={CONTACT.phoneHref} className="whitespace-nowrap font-bold text-brand">
                <Phone className="inline w-3.5 h-3.5 -mt-0.5" aria-hidden="true" /> {CONTACT.phone}
              </a>
            </p>
          </form>
        </div>
      )}
    </>
  );
};
