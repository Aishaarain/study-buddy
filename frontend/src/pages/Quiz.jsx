import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { checkAndIncrementUsage, getUsage } from '../lib/usageLimit';
import toast from 'react-hot-toast';

/* ─── Quota Bar Component ─────────────────────────────────────────── */
function QuotaBar({ used, max }) {
  const pct = Math.min((used / max) * 100, 100);
  const isNearLimit = used >= max - 1;
  const isAtLimit = used >= max;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
      <span
        className={`font-['Syne'] text-[10px] font-semibold sm:text-[11px] ${
          isAtLimit
            ? 'text-red-400'
            : isNearLimit
              ? 'text-amber-400'
              : 'text-amber-300/70'
        }`}
      >
        {used}/{max} quizzes today
      </span>

      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-amber-400/15 min-[380px]:w-20 sm:w-24">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAtLimit
              ? 'bg-red-500'
              : isNearLimit
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-amber-500 to-orange-400'
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
  const [generateForm, setGenerateForm] = useState({
    difficulty: 'medium',
    numQuestions: 5,
  });

  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaMax, setQuotaMax] = useState(3);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadQuizzes();
    loadDocuments();
    initUser();
  }, []);

  const initUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    } catch {
      /* silent */
    }
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
          questions: {
            length: q.quiz_questions?.[0]?.count || 0,
          },
        }))
      );
    } catch {
      /* silent */
    }
  };

  const loadFullQuiz = async (quizId, questionLimit = null) => {
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError) throw quizError;

    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: true })
      .limit(questionLimit || 100);

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
          questionCount,
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
    setAnswers((prev) => ({
      ...prev,
      [qIndex]: answer,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const questionResults = activeQuiz.questions.map((q, i) => {
        const givenAnswer = answers[i];
        const isCorrect = givenAnswer === q.correctAnswer;

        return {
          question: q.question,
          givenAnswer,
          correctAnswer: q.correctAnswer,
          isCorrect,
          explanation: q.explanation,
        };
      });

      const score = questionResults.filter((r) => r.isCorrect).length;
      const total = questionResults.length;
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

      setResults({
        score,
        total,
        percentage,
        results: questionResults,
      });

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

  if (step === 'generate') {
    return (
      <section className="min-h-screen w-full max-w-full overflow-x-hidden px-4 py-6 text-white sm:p-8">
        <h1 className="mb-2 break-words font-orbitron text-2xl font-black tracking-[.12em] min-[420px]:text-3xl sm:tracking-[.15em]">
          GENERATE <span className="text-amber-400">QUIZ</span>
        </h1>

        <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
          <QuotaBar used={quotaUsed} max={quotaMax} />
          <span className="text-[11px] text-slate-500">
            · Free tier: 3 quizzes/day
          </span>
        </div>

        {isAtLimit && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-center sm:px-5">
            <p className="text-sm font-bold text-red-300">
              🚫 You&apos;ve used all 3 quiz generations for today.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Your quota resets at midnight. Come back tomorrow!
            </p>
          </div>
        )}

        <div className="mx-auto w-full max-w-lg rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 backdrop-blur sm:p-8">
          <div className="mb-6">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-300">
              Document
            </label>

            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full rounded-xl border border-amber-400/30 bg-[#120b05] px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
            >
              <option value="">Select a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>

            {documents.length === 0 && (
              <p className="mt-2 text-xs text-amber-300/60">
                No processed documents yet — upload one first.
              </p>
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-300">
                Difficulty
              </label>

              <select
                value={generateForm.difficulty}
                onChange={(e) =>
                  setGenerateForm((f) => ({
                    ...f,
                    difficulty: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-amber-400/30 bg-[#120b05] px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-300">
                Questions
              </label>

              <input
                type="number"
                min={1}
                max={20}
                value={generateForm.numQuestions}
                onChange={(e) =>
                  setGenerateForm((f) => ({
                    ...f,
                    numQuestions: Number(e.target.value),
                  }))
                }
                className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || isAtLimit}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating
              ? 'Generating...'
              : isAtLimit
                ? 'Daily Limit Reached'
                : 'Generate Quiz'}
          </button>

          <button
            onClick={() => setStep('list')}
            className="mt-3 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-bold transition hover:bg-amber-400/15 sm:text-md"
          >
            Back to Quizzes
          </button>
        </div>
      </section>
    );
  }

  if (step === 'take' && activeQuiz) {
    return (
      <section className="min-h-screen w-full max-w-full overflow-x-hidden px-4 py-6 text-white sm:p-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6">
            <h1 className="break-words font-orbitron text-2xl font-bold text-amber-300 sm:text-4xl">
              {activeQuiz.title}
            </h1>
            <p className="mt-1 text-base capitalize text-slate-400 sm:text-xl">
              {activeQuiz.difficulty} · {activeQuiz.questions?.length || 0}{' '}
              questions
            </p>
          </div>

          <div className="space-y-5 sm:space-y-6">
            {(activeQuiz.questions || []).map((q, i) => (
              <div
                key={i}
                className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 backdrop-blur sm:p-6"
              >
                <p className="mb-4 break-words text-sm font-bold text-amber-100 sm:text-md">
                  Q{i + 1}. {q.question}
                </p>

                <div className="space-y-2">
                  {q.options && q.options.length > 0 ? (
                    q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition sm:px-4 sm:text-md ${
                          answers[i] === opt
                            ? 'border-amber-400 bg-amber-400/20'
                            : 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q${i}`}
                          value={opt}
                          checked={answers[i] === opt}
                          onChange={() => handleAnswer(i, opt)}
                          className="mt-1 accent-amber-400"
                        />
                        <span className="min-w-0 break-words">{opt}</span>
                      </label>
                    ))
                  ) : (
                    <textarea
                      value={answers[i] || ''}
                      onChange={(e) => handleAnswer(i, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={4}
                      className="w-full resize-none rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none sm:text-md"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setStep('list')}
              className="w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-6 py-3 text-sm font-bold transition hover:bg-amber-400/15 sm:w-auto sm:text-md"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading || Object.keys(answers).length === 0}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-[1.02] disabled:opacity-50 sm:w-auto"
            >
              {loading ? 'Submitting...' : 'Submit Answers'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (step === 'results' && results) {
    return (
      <section className="min-h-screen w-full max-w-full overflow-x-hidden px-4 py-6 text-white sm:p-8">
        <div className="mx-auto w-full max-w-2xl text-center">
          <div className="mb-6">
            <div className="mb-4 text-5xl sm:text-6xl">
              {results.percentage >= 70
                ? '🎉'
                : results.percentage >= 40
                  ? '📚'
                  : '💪'}
            </div>

            <h1 className="font-orbitron text-3xl font-bold text-amber-300 sm:text-4xl">
              {results.percentage}%
            </h1>

            <p className="mt-2 text-slate-400">
              {results.score} / {results.total} correct
            </p>
          </div>

          <div className="space-y-4 text-left">
            {(results.results || []).map((r, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-4 backdrop-blur sm:p-5 ${
                  r.isCorrect
                    ? 'border-green-400/30 bg-green-400/5'
                    : 'border-red-400/30 bg-red-400/5'
                }`}
              >
                <p className="mb-2 break-words text-base font-bold sm:text-lg">
                  {r.question}
                </p>

                <p className="break-words text-sm text-slate-400 sm:text-md">
                  Your answer:{' '}
                  <span
                    className={r.isCorrect ? 'text-green-400' : 'text-red-400'}
                  >
                    {r.givenAnswer || 'No answer'}
                  </span>
                </p>

                {!r.isCorrect && (
                  <p className="mt-1 break-words text-sm text-green-400 sm:text-md">
                    Correct: {r.correctAnswer}
                  </p>
                )}

                {r.explanation && (
                  <p className="mt-2 break-words text-sm text-slate-500 sm:text-md">
                    {r.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setStep('list');
              setActiveQuiz(null);
              setResults(null);
            }}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold transition hover:scale-[1.02] sm:w-auto"
          >
            Back to Quizzes
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen w-full max-w-full overflow-x-hidden px-4 py-6 text-white sm:p-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="break-words font-orbitron text-3xl font-black tracking-[.12em] min-[420px]:text-4xl sm:tracking-[.15em]">
            MY <span className="text-amber-400">QUIZZES</span>
          </h1>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <p className="text-base text-slate-400 sm:text-lg">
              {quizzes.length} quizzes generated
            </p>

            <span className="hidden text-slate-600 sm:inline">·</span>

            <QuotaBar used={quotaUsed} max={quotaMax} />
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            Free tier: 3 quiz generations/day
          </p>
        </div>

        <button
          onClick={() => {
            setStep('generate');
            setGenerateForm({
              difficulty: 'medium',
              numQuestions: 5,
            });
          }}
          disabled={isAtLimit}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-bold shadow-[0_0_20px_rgba(255,171,0,.3)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:w-auto sm:px-6"
        >
          {isAtLimit ? '🚫 Limit Reached' : '+ New Quiz'}
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-slate-400">
            No quizzes yet. Generate your first quiz!
          </p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz._id}
              className="min-w-0 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 backdrop-blur transition hover:bg-amber-400/10 sm:p-6"
            >
              <h3 className="break-words font-orbitron text-sm font-bold text-amber-200 sm:truncate">
                {quiz.title}
              </h3>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="capitalize">{quiz.difficulty}</span>
                <span>·</span>
                <span>{quiz.questions?.length || 0} questions</span>
              </div>

              <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row">
                <button
                  onClick={() => startQuiz(quiz)}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-bold transition hover:scale-[1.02] min-[420px]:flex-1"
                >
                  Take Quiz
                </button>

                <button
                  onClick={() => handleDelete(quiz._id)}
                  className="w-full rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 transition hover:bg-red-400/10 min-[420px]:w-auto"
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
