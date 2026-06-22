import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function Flashcards() {
  const [sets, setSets] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [activeSet, setActiveSet] = useState(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('list');
  const [cardCount, setCardCount] = useState(10); // ✅ separate number state, no object

  useEffect(() => {
    loadSets();
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, status')
        .eq('status', 'ready')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch {
      // silent
    }
  };

  const loadSets = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcard_sets')
        .select('id, title, created_at, flashcards(count)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSets(
        (data || []).map((s) => ({
          _id: s.id,
          title: s.title,
          cardCount: s.flashcards?.[0]?.count || 0,
        }))
      );
    } catch {
      // silent
    }
  };

  const loadFullSet = async (setId) => {
    const { data: set, error: setError } = await supabase
      .from('flashcard_sets')
      .select('*')
      .eq('id', setId)
      .single();

    if (setError) throw setError;

    const { data: cards, error: cardsError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('set_id', setId)
      .order('order_index', { ascending: true });

    if (cardsError) throw cardsError;

    return {
      _id: set.id,
      title: set.title,
      cards: (cards || []).map((c) => ({
        _id: c.id,
        front: c.front,
        back: c.back,
        known: false,
      })),
    };
  };

  const handleGenerate = async () => {
    if (!selectedDocId) return toast.error('Select a document');

    // ✅ parse to integer and clamp between 3–30
    const count = Math.min(30, Math.max(3, parseInt(cardCount, 10) || 10));

    console.log('Generating flashcards — count:', count);

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: {
          documentId: selectedDocId,
          cardCount: count,
        },
      });

      if (error) throw error;
      if (!data?.setId) throw new Error('No setId returned from function');

      toast.success(`${count} flashcards generated!`);
      await loadSets();

      const fullSet = await loadFullSet(data.setId);
      setActiveSet(fullSet);
      setCurrentCard(0);
      setStep('view');
    } catch (err) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const openSet = async (set) => {
    try {
      const fullSet = await loadFullSet(set._id);
      setActiveSet(fullSet);
      setCurrentCard(0);
      setStep('view');
    } catch {
      toast.error('Failed to load set');
    }
  };

  const handleNext = () => {
    if (!activeSet) return;
    setCurrentCard((prev) => (prev + 1) % activeSet.cards.length);
  };

  const handlePrev = () => {
    if (!activeSet) return;
    setCurrentCard((prev) => (prev - 1 + activeSet.cards.length) % activeSet.cards.length);
  };

  const toggleKnown = (cardId, known) => {
    if (!activeSet) return;
    setActiveSet((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c._id === cardId ? { ...c, known } : c)),
    }));
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('flashcard_sets').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      loadSets();
      if (activeSet?._id === id) {
        setActiveSet(null);
        setStep('list');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  /* ── Generate Step ── */
  if (step === 'generate') {
    return (
      <section className="min-h-screen overflow-x-hidden px-4 py-8 text-white">
        <h1 className="mb-8 font-orbitron text-3xl font-black tracking-[.15em]">
          GENERATE <span className="text-red-400">FLASHCARDS</span>
        </h1>
        <div className="mx-auto max-w-lg rounded-2xl border border-red-400/30 bg-red-400/5 p-6 backdrop-blur">

          <div className="mb-6">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-red-300">
              Document
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none"
            >
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
            {documents.length === 0 && (
              <p className="mt-2 text-xs text-red-300/60">
                No processed documents yet — upload one first.
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-red-300">
              Number of Cards (3–30)
            </label>
            <input
              type="number"
              min={3}
              max={30}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none"
            />
            <p className="mt-1 text-xs text-red-300/50">
              Will generate {Math.min(30, Math.max(3, cardCount || 3))} cards
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50"
          >
            {loading ? 'Generating...' : `Generate ${Math.min(30, Math.max(3, cardCount || 3))} Cards`}
          </button>
          <button
            onClick={() => setStep('list')}
            className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold transition hover:bg-red-400/15"
          >
            Back to Sets
          </button>
        </div>
      </section>
    );
  }

  /* ── View Step ── */
  if (step === 'view' && activeSet) {
    const card = activeSet.cards[currentCard];
    return (
      <section className="min-h-screen overflow-x-hidden px-4 py-8 text-white">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="font-orbitron text-2xl font-bold text-red-300">{activeSet.title}</h1>
            <p className="mt-1 text-sm text-slate-400">{activeSet.cards.length} cards</p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="w-full max-w-full rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/20 to-pink-500/10 p-6 backdrop-blur">
              <p className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-red-300/70">
                {card.front}
              </p>
              <p className="text-center text-base leading-relaxed text-slate-100">{card.back}</p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
                  card.known ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'
                }`}
              >
                {card.known ? '✓ Known' : 'Learning'}
              </span>
              {card._id && (
                <button
                  onClick={() => toggleKnown(card._id, !card.known)}
                  className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs transition hover:bg-red-400/20"
                >
                  Mark {card.known ? 'Unknown' : 'Known'}
                </button>
              )}
            </div>

            <p className="text-xs text-slate-400">
              {currentCard + 1} / {activeSet.cards.length}
            </p>

            <div className="flex w-full justify-center gap-4">
              <button
                onClick={handlePrev}
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-6 py-3 font-bold transition hover:bg-red-400/20"
              >
                ← Prev
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105"
              >
                Next →
              </button>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-red-400/10">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300"
                style={{ width: `${((currentCard + 1) / activeSet.cards.length) * 100}%` }}
              />
            </div>

            <button
              onClick={() => setStep('list')}
              className="text-xs text-slate-400 transition hover:text-slate-300"
            >
              ← Back to Sets
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ── List Step ── */
  return (
    <section className="min-h-screen overflow-x-hidden px-4 py-8 text-white">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-orbitron text-3xl font-black tracking-[.15em]">
            FLASH <span className="text-red-400">CARDS</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">{sets.length} sets</p>
        </div>
        <button
          onClick={() => {
            setStep('generate');
            setCardCount(10);
            setSelectedDocId('');
          }}
          className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-sm font-bold shadow-[0_0_20px_rgba(255,107,107,.3)] transition hover:scale-105"
        >
          + New Set
        </button>
      </div>

      {sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-400">No flashcard sets yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <div
              key={set._id}
              className="min-w-0 rounded-2xl border border-red-400/20 bg-red-400/5 p-6 backdrop-blur transition hover:bg-red-400/10"
            >
              <h3 className="truncate font-orbitron text-sm font-bold text-red-200">
                {set.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{set.cardCount || 0} cards</p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openSet(set)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-xs font-bold transition hover:scale-105"
                >
                  Study
                </button>
                <button
                  onClick={() => handleDelete(set._id)}
                  className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 transition hover:bg-red-400/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
