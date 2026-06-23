import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { checkAndIncrementUsage, getUsage } from '../lib/usageLimits';
import toast from 'react-hot-toast';

/* ─── Quota Bar Component ─────────────────────────────────────────── */
function QuotaBar({ used, max }) {
  const pct = Math.min((used / max) * 100, 100);
  const isNearLimit = used >= max - 1;
  const isAtLimit = used >= max;

  return (
    <div className="flex items-center gap-3">
      <span className={`font-['Syne'] text-[11px] font-semibold ${
        isAtLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-amber-300/70'
      }`}>
        {used}/{max} quizzes today
      </span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-amber-400/15">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Quiz() {
  const [quizzes, setQuizzes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [step, setStep] = useState('list');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({ difficulty: 'medium', numQuestions: 5 });

  // ── Quota state ──
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaMax, setQuotaMax] = useState(3);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadQuizzes();
    loadDocuments();
    initUser();
  }, []);

  // ── Fetch user & quota on mount ──
  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const usage = await getUsage(user.id, 'quiz');
    setQuotaUsed(usage.used);
    setQuotaMax(usage.max);
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, status')
        .eq('status', 'ready')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch { /* silent */ }
  };

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, difficulty, created_at, quiz_questions(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuizzes(
        (data || []).map((q) => ({
          _id: q.id,
          title: q.title,
          difficulty: q.difficulty,
          questions: { length: q.quiz_questions?.[0]?.count || 0 },
        }))
      );
    } catch { /* silent */ }
  };

  const loadFullQuiz = async (quizId, questionLimit = null) => {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes').select('*').eq('id', quizId).single();
    if (quizError) throw quizError;

    const { data: questions, error: qError } = await supabase
      .from('quiz_questions').select('*').eq('quiz_id', quizId)
      .order('order_index', { ascending: true }).limit(questionLimit || 100);
    if (qError) throw qError;

    return {
      _id: quiz.id,
      title: quiz.title,
      difficulty: quiz.difficulty,
      questions: (questions || []).map((q) => ({
        _id: q.id,
        question: q.question,
        options: q.options ? JSON.parse(q.options) : [],
        correctAnswer: q.correct_answer,
        explanation: q.explanation,
        type: q.question_type,
      })),
    };
  };

  const handleGenerate = async () => {
    if (!selectedDocId) return toast.error('Select a document');

    // ── Check quota before generating ──
    if (!userId) return;
    try {
      const usage = await checkAndIncrementUsage(userId, 'quiz');
      setQuotaUsed(usage.used);
    } catch (err) {
      toast.error(err.message);
      return;
    }

    setGenerating(true);
    try {
      const questionCount = Number(generateForm.numQuestions);
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          documentId: selectedDocId,
          difficulty: generateForm.difficulty,
          mcqCount: questionCount,
          numQuestions: questionCount,
          questionCount: questionCount,
        },
      });
      if (error) throw error;

      toast.success(`New quiz generated with ${questionCount} questions!`);
      await loadQuizzes();
      const fullQuiz = await loadFullQuiz(data.quizId, questionCount);
      setActiveQuiz(fullQuiz);
      setAnswers({});
      setResults(null);
      setStep('take');
    } catch (err) {
      toast.error(err.message || 'Generation failed');
      // Roll back quota on failure
      setQuotaUsed((prev) => Math.max(prev - 1, 0));
    } finally {
      setGenerating(false);
    }
  };

  const startQuiz = async (quiz) => {
    try {
      const fullQuiz = await loadFullQuiz(quiz._id);
      setActiveQuiz(fullQuiz);
      setAnswers({});
      setResults(null);
      setStep('take');
    } catch {
      toast.error('Failed to load quiz');
    }
  };

  const handleAnswer = (qIndex, answer) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: answer }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const questionResults = activeQuiz.questions.map((q, i) => {
        const givenAnswer = answers[i];
        const isCorrect = givenAnswer === q.correctAnswer;
        return { question: q.question, givenAnswer, correctAnswer: q.correctAnswer, isCorrect, explanation: q.explanation };
      });
      const score = questionResults.filter((r) => r.isCorrect).length;
      const total = questionResults.length;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      setResults({ score, total, percentage, results: questionResults });
      setStep('results');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted');
      loadQuizzes();
    } catch {
      toast.error('Delete failed');
    }
  };

  const isAtLimit = quotaUsed >= quotaMax;

  // ── Generate Step ──
  if (step === 'generate') {
    return (
      <section className="min-h-screen p-8 text-white">
        <h1 className="mb-2 font-orbitron text-3xl font-black tracking-[.15em]">
          GENERATE <span className="text-amber-400">QUIZ</span>
        </h1>

        {/* Quota bar on generate page */}
        <div className="mb-6 flex items-center gap-3">
          <QuotaBar used={quotaUsed} max={quotaMax} />
          <span className="text-[11px] text-slate-500">· Free tier: 3 quizzes/day</span>
        </div>

        {/* Limit banner */}
        {isAtLimit && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-center">
            <p className="text-sm font-bold text-red-300">🚫 You've used all 3 quiz generations for today.</p>
            <p className="mt-1 text-xs text-slate-400">Your quota resets at midnight. Come back tomorrow!</p>
          </div>
        )}

        <div className="mx-auto max-w-lg rounded-2xl border border-amber-400/30 bg-amber-400/5 p-8 backdrop-blur">
          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-amber-300 font-bold">Document</label>
            <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none">
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
            {documents.length === 0 && (
              <p className="mt-2 text-xs text-amber-300/60">No processed documents yet — upload one first.</p>
            )}
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-amber-300 font-bold">Difficulty</label>
              <select value={generateForm.difficulty} onChange={(e) => setGenerateForm((f) => ({ ...f, difficulty: e.target.value }))}
                className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-amber-300 font-bold">Questions</label>
              <input type="number" min={1} max={20} value={generateForm.numQuestions}
                onChange={(e) => setGenerateForm((f) => ({ ...f, numQuestions: Number(e.target.value) }))}
                className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none" />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating || isAtLimit}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? 'Generating...' : isAtLimit ? 'Daily Limit Reached' : 'Generate Quiz'}
          </button>
          <button onClick={() => setStep('list')} className="mt-3 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-md font-bold hover:bg-amber-400/15 transition">
            Back to Quizzes
          </button>
        </div>
      </section>
    );
  }

  // ── Take Quiz Step ──
  if (step === 'take' && activeQuiz) {
    return (
      <section className="min-h-screen p-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="font-orbitron text-4xl font-bold text-amber-300">{activeQuiz.title}</h1>
            <p className="mt-1 text-xl text-slate-400 capitalize">{activeQuiz.difficulty} · {activeQuiz.questions?.length || 0} questions</p>
          </div>
          <div className="space-y-6">
            {(activeQuiz.questions || []).map((q, i) => (
              <div key={i} className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 backdrop-blur">
                <p className="mb-4 text-md font-bold text-amber-100">Q{i + 1}. {q.question}</p>
                <div className="space-y-2">
                  {q.options && q.options.length > 0 ? (
                    q.options.map((opt, oi) => (
                      <label key={oi} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-md transition ${
                        answers[i] === opt ? 'border-amber-400 bg-amber-400/20' : 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10'
                      }`}>
                        <input type="radio" name={`q${i}`} value={opt} checked={answers[i] === opt}
                          onChange={() => handleAnswer(i, opt)} className="accent-amber-400" />
                        {opt}
                      </label>
                    ))
                  ) : (
                    <textarea value={answers[i] || ''} onChange={(e) => handleAnswer(i, e.target.value)}
                      placeholder="Type your answer here..." rows={4}
                      className="w-full resize-none rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-md text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep('list')} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-6 py-3 text-md font-bold hover:bg-amber-400/15 transition">Cancel</button>
            <button onClick={handleSubmit} disabled={loading || Object.keys(answers).length === 0}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Answers'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Results Step ──
  if (step === 'results' && results) {
    return (
      <section className="min-h-screen p-8 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-6">
            <div className="text-6xl mb-4">{results.percentage >= 70 ? '🎉' : results.percentage >= 40 ? '📚' : '💪'}</div>
            <h1 className="font-orbitron text-4xl font-bold text-amber-300">{results.percentage}%</h1>
            <p className="mt-2 text-slate-400">{results.score} / {results.total} correct</p>
          </div>
          <div className="space-y-4 text-left">
            {(results.results || []).map((r, i) => (
              <div key={i} className={`rounded-2xl border p-5 backdrop-blur ${r.isCorrect ? 'border-green-400/30 bg-green-400/5' : 'border-red-400/30 bg-red-400/5'}`}>
                <p className="mb-2 text-lg font-bold">{r.question}</p>
                <p className="text-md text-slate-400">Your answer: <span className={r.isCorrect ? 'text-green-400' : 'text-red-400'}>{r.givenAnswer || 'No answer'}</span></p>
                {!r.isCorrect && <p className="text-md text-green-400 mt-1">Correct: {r.correctAnswer}</p>}
                {r.explanation && <p className="mt-2 text-md text-slate-500">{r.explanation}</p>}
              </div>
            ))}
          </div>
          <button onClick={() => { setStep('list'); setActiveQuiz(null); setResults(null); }}
            className="mt-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-105">
            Back to Quizzes
          </button>
        </div>
      </section>
    );
  }

  // ── List Step ──
  return (
    <section className="min-h-screen p-8 text-white">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-orbitron text-4xl font-black tracking-[.15em]">
            MY <span className="text-amber-400">QUIZZES</span>
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-lg text-slate-400">{quizzes.length} quizzes generated</p>
            <span className="text-slate-600">·</span>
            <QuotaBar used={quotaUsed} max={quotaMax} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Free tier: 3 quiz generations/day</p>
        </div>
        <button
          onClick={() => { setStep('generate'); setGenerateForm({ difficulty: 'medium', numQuestions: 5 }); }}
          disabled={isAtLimit}
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(255,171,0,.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isAtLimit ? '🚫 Limit Reached' : '+ New Quiz'}
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-400">No quizzes yet. Generate your first quiz!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <div key={quiz._id} className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 backdrop-blur transition hover:bg-amber-400/10">
              <h3 className="font-orbitron text-sm font-bold text-amber-200 truncate">{quiz.title}</h3>
              <div className="mt-2 flex gap-2 text-xs text-slate-400">
                <span className="capitalize">{quiz.difficulty}</span>
                <span>·</span>
                <span>{quiz.questions?.length || 0} questions</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => startQuiz(quiz)} className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold transition hover:scale-105">
                  Take Quiz
                </button>
                <button onClick={() => handleDelete(quiz._id)} className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10 transition">
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
