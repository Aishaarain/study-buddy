// import { useEffect, useState } from 'react';
// import API from '../Api';
// import toast from 'react-hot-toast';

// export default function Flashcards() {
//   const [sets, setSets] = useState([]);
//   const [activeSet, setActiveSet] = useState(null);
//   const [currentCard, setCurrentCard] = useState(0);
//   const [flipped, setFlipped] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [step, setStep] = useState('list');
//   const [generateForm, setGenerateForm] = useState({ topic: '', count: 10 });

//   useEffect(() => { loadSets(); }, []);

//   const loadSets = async () => {
//     try {
//       const { data } = await API.get('/flashcard');
//       setSets(data.flashcardSets || []);
//     } catch { /* */ }
//   };

//   const handleGenerate = async () => {
//     if (!generateForm.topic.trim()) return toast.error('Enter a topic');
//     setLoading(true);
//     try {
//       const { data } = await API.post('/flashcard/generate', {
//         topic: generateForm.topic,
//         count: generateForm.count,
//       });
//       toast.success('Flashcards generated!');
//       await loadSets();
//       setActiveSet(data.flashcardSet);
//       setCurrentCard(0);
//       setFlipped(false);
//       setStep('view');
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Generation failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openSet = (set) => {
//     setActiveSet(set);
//     setCurrentCard(0);
//     setFlipped(false);
//     setStep('view');
//   };

//   const handleNext = () => {
//     if (!activeSet) return;
//     setFlipped(false);
//     setCurrentCard((prev) => (prev + 1) % activeSet.cards.length);
//   };

//   const handlePrev = () => {
//     if (!activeSet) return;
//     setFlipped(false);
//     setCurrentCard((prev) => (prev - 1 + activeSet.cards.length) % activeSet.cards.length);
//   };

//   const toggleKnown = async (cardId, known) => {
//     if (!activeSet) return;
//     try {
//       await API.patch(`/flashcard/${activeSet._id}/cards/${cardId}`, { known });
//       const updated = { ...activeSet };
//       updated.cards = updated.cards.map((c) => (c._id === cardId ? { ...c, known } : c));
//       setActiveSet(updated);
//     } catch { toast.error('Failed to update'); }
//   };

//   const handleDelete = async (id) => {
//     try {
//       await API.delete(`/flashcard/${id}`);
//       toast.success('Deleted');
//       loadSets();
//       if (activeSet?._id === id) { setActiveSet(null); setStep('list'); }
//     } catch { toast.error('Delete failed'); }
//   };

//   if (step === 'generate') {
//     return (
//       <section className="min-h-screen p-8 text-white">
//         <h1 className="mb-8 font-orbitron text-3xl font-black tracking-[.15em]">
//           GENERATE <span className="text-red-400">FLASHCARDS</span>
//         </h1>
//         <div className="mx-auto max-w-lg rounded-2xl border border-red-400/30 bg-red-400/5 p-8 backdrop-blur">
//           <div className="mb-6">
//             <label className="mb-2 block text-xs uppercase tracking-wider text-red-300 font-bold">Topic</label>
//             <input value={generateForm.topic} onChange={(e) => setGenerateForm((f) => ({ ...f, topic: e.target.value }))}
//               className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none" placeholder="e.g. Biology Terms" />
//           </div>
//           <div className="mb-6">
//             <label className="mb-2 block text-xs uppercase tracking-wider text-red-300 font-bold">Number of Cards</label>
//             <input type="number" min={3} max={30} value={generateForm.count}
//               onChange={(e) => setGenerateForm((f) => ({ ...f, count: Number(e.target.value) }))}
//               className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none" />
//           </div>
//           <button onClick={handleGenerate} disabled={loading}
//             className="w-full rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50">
//             {loading ? 'Generating...' : 'Generate'}
//           </button>
//           <button onClick={() => setStep('list')} className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold hover:bg-red-400/15 transition">
//             Back to Sets
//           </button>
//         </div>
//       </section>
//     );
//   }

//   if (step === 'view' && activeSet) {
//     const card = activeSet.cards[currentCard];
//     return (
//       <section className="min-h-screen p-8 text-white">
//         <div className="mx-auto max-w-lg">
//           <div className="mb-6 text-center">
//             <h1 className="font-orbitron text-2xl font-bold text-red-300">{activeSet.title}</h1>
//             <p className="mt-1 text-xs text-slate-400">{activeSet.cards.length} cards</p>
//           </div>

//           <div className="flex flex-col items-center gap-6">
//             <div onClick={() => setFlipped(!flipped)} className="relative h-72 w-full cursor-pointer perspective">
//               <div className="relative h-full w-full rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/20 to-pink-500/10 p-6 backdrop-blur transition-all duration-500 flex items-center justify-center"
//                 style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
//                 <div className="text-center">
//                   <p className="mb-4 text-xs uppercase tracking-wider text-red-200/60">{flipped ? 'ANSWER' : 'QUESTION'}</p>
//                   <p className="text-xl font-bold leading-relaxed">{flipped ? card.back : card.front}</p>
//                   {card.tag && <p className="mt-4 text-xs text-red-300/50">{card.tag}</p>}
//                   <p className="mt-6 text-xs text-red-300/30">Click to flip</p>
//                 </div>
//               </div>
//             </div>

//             <div className="flex items-center gap-3">
//               <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${card.known ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'}`}>
//                 {card.known ? '✓ Known' : 'Learning'}
//               </span>
//               {card._id && (
//                 <button onClick={() => toggleKnown(card._id, !card.known)}
//                   className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs hover:bg-red-400/20 transition">
//                   Mark {card.known ? 'Unknown' : 'Known'}
//                 </button>
//               )}
//             </div>

//             <div className="flex gap-4">
//               <button onClick={handlePrev} className="rounded-xl border border-red-400/30 bg-red-400/10 px-6 py-3 font-bold hover:bg-red-400/20 transition">← Prev</button>
//               <button onClick={handleNext} className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105">Next →</button>
//             </div>

//             <div className="w-full rounded-full bg-red-400/10 h-1 overflow-hidden">
//               <div className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300"
//                 style={{ width: `${((currentCard + 1) / activeSet.cards.length) * 100}%` }} />
//             </div>

//             <button onClick={() => setStep('list')} className="text-xs text-slate-400 hover:text-slate-300 transition">← Back to Sets</button>
//           </div>
//         </div>
//       </section>
//     );
//   }

//   return (
//     <section className="min-h-screen p-8 text-white">
//       <div className="mb-8 flex items-center justify-between">
//         <div>
//           <h1 className="font-orbitron text-3xl font-black tracking-[.15em]">
//             FLASH <span className="text-red-400">CARDS</span>
//           </h1>
//           <p className="mt-1 text-xs text-slate-400">{sets.length} sets</p>
//         </div>
//         <button onClick={() => { setStep('generate'); setGenerateForm({ topic: '', count: 10 }); }}
//           className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(255,107,107,.3)]">
//           + New Set
//         </button>
//       </div>

//       {sets.length === 0 ? (
//         <div className="flex flex-col items-center justify-center py-20">
//           <p className="text-slate-400">No flashcard sets yet.</p>
//         </div>
//       ) : (
//         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
//           {sets.map((set) => (
//             <div key={set._id} className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 backdrop-blur transition hover:bg-red-400/10">
//               <h3 className="font-orbitron text-sm font-bold text-red-200 truncate">{set.title}</h3>
//               <p className="mt-2 text-xs text-slate-400">{set.cards?.length || 0} cards</p>
//               <div className="mt-4 flex gap-2">
//                 <button onClick={() => openSet(set)} className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-xs font-bold transition hover:scale-105">
//                   Study
//                 </button>
//                 <button onClick={() => handleDelete(set._id)} className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10 transition">
//                   Delete
//                 </button>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </section>
//   );
// }


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
  const [generateForm, setGenerateForm] = useState({ count: 10 });

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
          cards: { length: s.flashcards?.[0]?.count || 0 },
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
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: {
          documentId: selectedDocId,
          cardCount: generateForm.count,
        },
      });

      if (error) throw error;

      toast.success('Flashcards generated!');
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
    setFlipped(false);
    setCurrentCard((prev) => (prev + 1) % activeSet.cards.length);
  };

  const handlePrev = () => {
    if (!activeSet) return;
    setFlipped(false);
    setCurrentCard((prev) => (prev - 1 + activeSet.cards.length) % activeSet.cards.length);
  };

  const toggleKnown = (cardId, known) => {
    if (!activeSet) return;
    const updated = { ...activeSet };
    updated.cards = updated.cards.map((c) => (c._id === cardId ? { ...c, known } : c));
    setActiveSet(updated);
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('flashcard_sets').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      loadSets();
      if (activeSet?._id === id) { setActiveSet(null); setStep('list'); }
    } catch {
      toast.error('Delete failed');
    }
  };

  if (step === 'generate') {
    return (
      <section className="min-h-screen p-8 text-white">
        <h1 className="mb-8 font-orbitron text-3xl font-black tracking-[.15em]">
          GENERATE <span className="text-red-400">FLASHCARDS</span>
        </h1>
        <div className="mx-auto max-w-lg rounded-2xl border border-red-400/30 bg-red-400/5 p-8 backdrop-blur">
          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-red-300 font-bold">Document</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none"
            >
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
            {documents.length === 0 && (
              <p className="mt-2 text-xs text-red-300/60">No processed documents yet — upload one first.</p>
            )}
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-red-300 font-bold">Number of Cards</label>
            <input type="number" min={3} max={30} value={generateForm.count}
              onChange={(e) => setGenerateForm((f) => ({ ...f, count: Number(e.target.value) }))}
              className="w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none" />
          </div>
          <button onClick={handleGenerate} disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate'}
          </button>
          <button onClick={() => setStep('list')} className="mt-3 w-full rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-bold hover:bg-red-400/15 transition">
            Back to Sets
          </button>
        </div>
      </section>
    );
  }

  if (step === 'view' && activeSet) {
    const card = activeSet.cards[currentCard];
    return (
      <section className="min-h-screen p-8 text-white">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 text-center">
            <h1 className="font-orbitron text-2xl font-bold text-red-300">{activeSet.title}</h1>
            <p className="mt-1 text-md text-slate-400">{activeSet.cards.length} cards</p>
          </div>

          <div className="flex flex-col items-center gap-6">
           <div className="relative min-h-72 w-full rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/20 to-pink-500/10 p-8 backdrop-blur flex flex-col items-center justify-center">
  <p className="mb-4 text-center text-xs uppercase tracking-wider text-red-300/70 font-bold">{card.front}</p>
  <p className="text-center text-base leading-relaxed text-slate-100">{card.back}</p>
</div>

            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${card.known ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-400'}`}>
                {card.known ? '✓ Known' : 'Learning'}
              </span>
              {card._id && (
                <button onClick={() => toggleKnown(card._id, !card.known)}
                  className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs hover:bg-red-400/20 transition">
                  Mark {card.known ? 'Unknown' : 'Known'}
                </button>
              )}
            </div>

            <div className="flex gap-4">
              <button onClick={handlePrev} className="rounded-xl border border-red-400/30 bg-red-400/10 px-6 py-3 font-bold hover:bg-red-400/20 transition">← Prev</button>
              <button onClick={handleNext} className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105">Next →</button>
            </div>

            <div className="w-full rounded-full bg-red-400/10 h-1 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300"
                style={{ width: `${((currentCard + 1) / activeSet.cards.length) * 100}%` }} />
            </div>

            <button onClick={() => setStep('list')} className="text-xs text-slate-400 hover:text-slate-300 transition">← Back to Sets</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-orbitron text-3xl font-black tracking-[.15em]">
            FLASH <span className="text-red-400">CARDS</span>
          </h1>
          <p className="mt-1 text-md text-slate-400">{sets.length} sets</p>
        </div>
        <button onClick={() => { setStep('generate'); setGenerateForm({ count: 10 }); }}
          className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(255,107,107,.3)]">
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
            <div key={set._id} className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 backdrop-blur transition hover:bg-red-400/10">
              <h3 className="font-orbitron text-md font-bold text-red-200 truncate">{set.title}</h3>
              <p className="mt-2 text-md text-slate-400">{set.cards?.length || 0} cards</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openSet(set)} className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 text-xs font-bold transition hover:scale-105">
                  Study
                </button>
                <button onClick={() => handleDelete(set._id)} className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10 transition">
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