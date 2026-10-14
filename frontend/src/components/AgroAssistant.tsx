import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, RotateCcw } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const CLIENT_FAQ_BACKUP: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['necə müraciət', 'müraciət qaydası', 'müraciət etmək', 'ərizə vermək', 'addım', 'proses', 'müraciət'],
    answer: 'AgroInvest Qarabağ portalında investisiya müsabiqəsinə müraciət 5 sadə elektron addımdan ibarətdir:\n\n1. **Qeydiyyat**: Portalda fərdi sahibkar və ya hüquqi şəxs kimi qeydiyyatdan keçin və ya kabinetinizə daxil olun.\n2. **Sahə Seçimi**: "İnvestisiya imkanları" kataloqundan fəaliyyətinizə uyğun torpaq sahəsini və aktiv müsabiqəni seçin.\n3. **Təklif**: "Müraciət et" düyməsini sıxaraq layihənizin investisiya məbləğini və icra müddətini qeyd edin.\n4. **Sənədlər**: Biznes Plan, Texniki-İqtisadi Əsaslandırma (TİƏ) və bank zəmanətini PDF formatında sistemə yükləyin.\n5. **Təsdiq**: Formanı təsdiq edib göndərin. Sizə dərhal unikal AGRO-2026-XXXX qeydiyyat kodu veriləcək.',
  },
  {
    keywords: ['sənəd', 'hansı sənəd', 'lazım olan sənəd', 'tələb olunan sənədlər', 'sənədlər siyahısı', 'tiə', 'biznes plan'],
    answer: 'İnvestisiya müsabiqələrində tələb olunan əsas sənədlər:\n\n• **Biznes Plan və Texniki-İqtisadi Əsaslandırma (TİƏ)**;\n• **Maliyyə Zəmanəti** (layihə məbləğinin ən azı 30%-i həcmində bank zəmanəti və ya hesab çıxarışı);\n• **VÖEN şəhadətnaməsi** və hüquqi şəxsin nizamnaməsi;\n• **Aqrar sahədə təcrübəni** təsdiq edən portfel sənədləri.',
  },
  {
    keywords: ['agromatch', 'tövsiyə', 'uyğun torpaq', 'bal', 'necə hesablanır', 'alqoritm'],
    answer: 'AgroMatch — sizin investisiya imkanlarınıza ən uyğun torpaq sahələrini müəyyən edən şəffaf çəkili alqoritmdir:\n\n• **Məkan uyğunluğu (35%)**\n• **Büdcə uyğunluğu (30%)**\n• **Aqrar sektor (20%)**\n• **Torpaq sahəsi (15%)**\n\nNəticədə 0-100% arası uyğunluq balı və amillərin ətraflı bölgüsü təqdim olunur.',
  },
  {
    keywords: ['subsidiya', 'güzəşt', 'dövlət dəstəyi', 'kredit', 'vergi'],
    answer: 'Qarabağ və Şərqi Zəngəzurda fəaliyyət göstərən sahibkarlar üçün xüsusi dövlət dəstəyi:\n\n• **10 il müddətinə vergi azadolmaları** (mənfəət, əmlak, torpaq);\n• **Kənd təsərrüfatı texnikası alışına 40%-dək subsidiya**;\n• **Müasir suvarma sistemlərinə dövlət dəstəyi**;\n• **SİF vasitəsilə 5%-li güzəştli aqro-kreditlər**.',
  },
  {
    keywords: ['status', 'izləmə', 'mərhələ', 'nə deməkdir'],
    answer: 'Müraciətlər 4 əsas mərhələdən keçir:\n\n• **Qəbul edilib (RECEIVED)**: Elektron müraciət qeydə alınıb.\n• **Baxılır (UNDER_REVIEW)**: Ekspert şurası biznes planı qiymətləndirir.\n• **Əlavə məlumat tələb olunur**: Komissiya əlavə aydınlaşdırma tələb edir.\n• **Qərar verilib (DECIDED)**: Müsabiqənin yekun nəticəsi təsdiqlənib.',
  },
  {
    keywords: ['salam', 'necəsən', 'sabahınız xeyir', 'axşamınız xeyir'],
    answer: 'Salam! Mən AgroKöməkçiyəm — Qarabağda aqrar investisiya imkanları, müsabiqə şərtləri və elektron müraciət üzrə virtual bələdçinizəm. Sizə necə kömək edə bilərəm?',
  },
];

export const AgroAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Salam! Mən AgroKöməkçiyəm — Qarabağda aqrar investisiya imkanları, müsabiqə şərtləri və elektron müraciət üzrə virtual bələdçinizəm. Sizə necə kömək edə bilərəm?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-4),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const reply = data.answer || 'Sorğunuzu cavablandırmaq mümkün olmadı.';
        setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
      } else {
        throw new Error('API response not ok');
      }
    } catch (err) {
      // Instant Client-Side Knowledge Fallback
      const lowerQuery = query.toLowerCase();
      let matchedAnswer: string | null = null;
      for (const item of CLIENT_FAQ_BACKUP) {
        if (item.keywords.some(k => lowerQuery.includes(k))) {
          matchedAnswer = item.answer;
          break;
        }
      }

      const fallbackReply = matchedAnswer || `Salam! Mən AgroKöməkçiyəm. Sizə Qarabağda investisiya müsabiqələri üzrə aşağıdakı mövzularda məlumat verə bilərəm:\n\n• **"Müraciət necə edilir?"**\n• **"Hansı sənədlər lazımdır?"**\n• **"AgroMatch necə hesablanır?"**\n• **"Dövlət subsidiyaları nədir?"**\n\nZəhmət olmasa sualınızı seçin və ya yazın!`;
      setMessages(prev => [...prev, { role: 'assistant', text: fallbackReply }]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        text: 'Salam! Mən AgroKöməkçiyəm — Qarabağda aqrar investisiya imkanları, müsabiqə şərtləri və elektron müraciət üzrə virtual bələdçinizəm. Sizə necə kömək edə bilərəm?',
      },
    ]);
  };

  const quickPrompts = [
    'Müsabiqəyə necə müraciət edilir?',
    'Hansı sənədlər tələb olunur?',
    'AgroMatch necə hesablanır?',
    'Dövlət subsidiyaları nədir?',
  ];

  // Helper to render bold and line breaks safely
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Parse **bold** parts
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={i} className="block min-h-[1.1rem]">
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pIdx} className="font-bold text-emerald-950">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 group"
        >
          <Bot className="w-5 h-5 text-amber-300" />
          <span className="text-xs font-semibold whitespace-nowrap">AgroKöməkçi AI</span>
        </button>
      ) : (
        <div className="w-[360px] sm:w-[420px] h-[540px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-emerald-900 px-4 py-3 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center">
                <Bot className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight">AgroKöməkçi</h3>
                <p className="text-[10px] text-emerald-200">Qarabağ Aqro İnvestisiya Məsləhətçisi</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Söhbəti yenilə"
                className="p-1.5 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-emerald-200 hover:text-white hover:bg-emerald-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed text-xs ${
                    m.role === 'user'
                      ? 'bg-emerald-800 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {renderFormattedText(m.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-xs px-3.5 py-2 text-xs flex items-center gap-2 shadow-2xs">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span>Cavab hazırlanır...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompt suggestions */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            {quickPrompts.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(q)}
                className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200/60"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Sualınızı bura yazın (məs: müraciət qaydası)..."
              className="flex-1 text-xs px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 text-slate-900"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
