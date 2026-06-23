import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { checkAndIncrementUsage, getUsage } from '../lib/usageLimits';
import toast from 'react-hot-toast';

/* ─── Quota Bar Component ─────────────────────────────────────────── */
function QuotaBar({ used, max, color = 'violet' }) {
  const pct = Math.min((used / max) * 100, 100);
  const isNearLimit = used >= max - 1;
  const isAtLimit = used >= max;

  return (
    <div className="flex items-center gap-3">
      <span className={`font-['Syne'] text-[11px] font-semibold ${
        isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-slate-400'
      }`}>
        {used}/{max} chats today
      </span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-violet-400/15">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit
              ? 'bg-red-500'
              : isNearLimit
              ? 'bg-amber-400'
              : 'bg-gradient-to-r from-violet-500 to-cyan-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Chat() {
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // ── Quota state ──
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaMax, setQuotaMax] = useState(10);
  const [userId, setUserId] = useState(null);

  const documentId = localStorage.getItem('documentId');

  useEffect(() => {
    loadConversations();
    initUser();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Fetch user & their current quota on mount ──
  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const usage = await getUsage(user.id, 'chat');
    setQuotaUsed(usage.used);
    setQuotaMax(usage.max);
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('id, title, document_id, created_at, chat_messages(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConversations(
        (data || []).map((c) => ({
          _id: c.id,
          title: c.title,
          messageCount: c.chat_messages?.[0]?.count || 0,
        }))
      );
    } catch {
      // silent
    }
  };

  const loadConversation = async (id) => {
    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .single();

      if (chatError) throw chatError;

      const { data: msgs, error: msgsError } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      if (msgsError) throw msgsError;

      setConversationId(chat.id);
      setMessages(msgs || []);
      setShowHistory(false);
    } catch {
      toast.error('Failed to load conversation');
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!documentId) {
      toast.error('Upload a document first to chat about it');
      return;
    }

    // ── Check quota before sending ──
    if (!userId) return;
    let usage;
    try {
      usage = await checkAndIncrementUsage(userId, 'chat');
      setQuotaUsed(usage.used);
    } catch (err) {
      toast.error(err.message); // "Daily limit reached. Come back tomorrow!"
      return;
    }

    const question = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-rag', {
        body: {
          chatId: conversationId,
          documentId,
          message: question,
        },
      });

      if (error) throw error;

      const assistantAnswer =
        data?.message?.content ||
        data?.message ||
        data?.answer ||
        data?.reply ||
        data?.response ||
        data?.content ||
        'No answer received from AI.';

      setConversationId(data?.chatId || conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantAnswer }]);
      loadConversations();
    } catch (err) {
      toast.error(err.message || 'AI request failed');
      setMessages((prev) => prev.slice(0, -1));
      // Roll back quota count on failure
      setQuotaUsed((prev) => Math.max(prev - 1, 0));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      const { error } = await supabase.from('chats').delete().eq('id', id);
      if (error) throw error;
      loadConversations();
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
  };

  const isAtLimit = quotaUsed >= quotaMax;

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050510] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(124,92,252,.22),transparent_38%),linear-gradient(to_bottom,rgba(5,5,16,.2),rgba(5,5,16,.96))]" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-5 sm:px-6 lg:px-10">

        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-violet-400/20 bg-white/[0.03] p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h1 className="font-orbitron text-3xl font-black tracking-[.14em] drop-shadow-[0_0_24px_#7c5cfc] sm:text-4xl lg:text-5xl">
              ASK <span className="text-violet-400">AI</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Context-Aware Study Assistant ·{' '}
              <span className="text-violet-400/70">Free tier: 10 AI chats/day</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ── Quota display in header ── */}
            <QuotaBar used={quotaUsed} max={quotaMax} />

            <button
              onClick={() => setShowHistory((s) => !s)}
              className="rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm font-bold text-violet-100 transition hover:scale-105 hover:bg-violet-400/20 sm:text-base"
            >
              {showHistory ? 'Close History' : 'History'}
            </button>

            <button
              onClick={handleNewChat}
              className="rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm font-bold text-violet-100 transition hover:scale-105 hover:bg-violet-400/20 sm:text-base"
            >
              + New Chat
            </button>
          </div>
        </div>

        {/* Main Layout */}
        <div className="flex flex-1 flex-col gap-5 overflow-hidden lg:flex-row">

          {/* History Sidebar */}
          {showHistory && (
            <aside className="max-h-[280px] w-full overflow-y-auto rounded-3xl border border-violet-400/20 bg-violet-400/5 p-4 backdrop-blur-xl lg:max-h-none lg:w-80 lg:flex-shrink-0 lg:p-5">
              <h3 className="mb-4 font-orbitron text-sm font-bold tracking-[.14em] text-violet-300 sm:text-base">
                Conversations
              </h3>

              {conversations.length === 0 && (
                <p className="text-sm text-slate-500 sm:text-base">No conversations yet</p>
              )}

              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div
                    key={conv._id}
                    onClick={() => loadConversation(conv._id)}
                    className={`cursor-pointer rounded-2xl p-4 text-sm transition sm:text-base ${
                      conv._id === conversationId
                        ? 'border border-violet-400/40 bg-violet-500/20 shadow-[0_0_20px_rgba(124,92,252,.15)]'
                        : 'border border-transparent bg-violet-400/5 hover:border-violet-400/20 hover:bg-violet-400/10'
                    }`}
                  >
                    <div className="truncate font-bold text-violet-100">
                      {conv.title || 'Untitled Chat'}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{conv.messageCount} messages</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv._id); }}
                      className="mt-3 text-sm font-semibold text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* Chat Area */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto rounded-3xl border border-violet-400/20 bg-violet-400/5 p-4 shadow-[0_0_40px_rgba(124,92,252,.08)] backdrop-blur-xl sm:p-6 lg:p-8">

              {/* ── Limit reached banner ── */}
              {isAtLimit && (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-center">
                  <p className="text-sm font-bold text-red-300">
                    🚫 You've used all 10 AI chats for today.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your quota resets at midnight. Come back tomorrow!
                  </p>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="flex h-full min-h-[420px] items-center justify-center">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/10 text-4xl shadow-[0_0_35px_rgba(124,92,252,.25)] sm:h-24 sm:w-24 sm:text-5xl">
                      ✨
                    </div>
                    <p className="text-xl font-bold text-slate-200 sm:text-2xl lg:text-3xl">
                      Ask anything about your studies
                    </p>
                    <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
                      Explanations, summaries, practice questions, coding help, and document-based answers.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-5 py-4 text-base leading-7 shadow-lg sm:max-w-[75%] sm:px-6 sm:py-5 sm:text-lg lg:max-w-[65%] ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-violet-950/30'
                        : 'border border-violet-400/30 bg-violet-400/10 text-slate-100'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="animate-pulse rounded-3xl border border-violet-400/30 bg-violet-400/10 px-6 py-5">
                    <div className="flex gap-2">
                      <div className="h-3 w-3 rounded-full bg-violet-400" />
                      <div className="h-3 w-3 rounded-full bg-violet-400" />
                      <div className="h-3 w-3 rounded-full bg-violet-400" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-violet-400/20 bg-white/[0.03] p-3 backdrop-blur-xl sm:flex-row sm:p-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && !isAtLimit && handleSend()}
                placeholder={isAtLimit ? 'Daily limit reached — come back tomorrow!' : 'Ask a question...'}
                className="min-h-[58px] flex-1 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-4 text-base text-white placeholder-slate-500 backdrop-blur transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 sm:text-lg disabled:opacity-50"
                disabled={loading || isAtLimit}
              />

              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || isAtLimit}
                className="min-h-[58px] rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 px-8 py-4 text-base font-black shadow-[0_0_20px_rgba(124,92,252,.35)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
              >
                {loading ? '...' : 'Send'}
              </button>
            </div>

            {/* ── Remaining count below input ── */}
            <p className="mt-2 text-center font-['Syne'] text-[11px] text-slate-500">
              {isAtLimit
                ? '🚫 No chats remaining today'
                : `${quotaMax - quotaUsed} of ${quotaMax} AI chats remaining today`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
