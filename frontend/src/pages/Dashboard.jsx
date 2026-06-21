import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Student');

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        setUserName(profile?.full_name || 'Student');
      }

      // Run all counts in parallel for speed
      const [
        documentsRes,
        quizzesRes,
        flashcardSetsRes,
        studyPlansRes,
        conversationsRes,
        planTasksRes,
      ] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('quizzes').select('id', { count: 'exact', head: true }),
        supabase.from('flashcard_sets').select('id', { count: 'exact', head: true }),
        supabase.from('study_plans').select('id', { count: 'exact', head: true }),
        supabase.from('chats').select('id', { count: 'exact', head: true }),
        supabase.from('study_plan_tasks').select('id, is_completed'),
      ]);

      const totalTasks = planTasksRes.data?.length || 0;
      const completedTasks = planTasksRes.data?.filter((t) => t.is_completed).length || 0;

      setOverview({
        documents: documentsRes.count ?? 0,
        quizzes: quizzesRes.count ?? 0,
        flashcardSets: flashcardSetsRes.count ?? 0,
        studyPlans: studyPlansRes.count ?? 0,
        conversations: conversationsRes.count ?? 0,
        knownCards: 0, // not tracked yet — flashcards table has no "known" column currently
        averageQuizScore: 0, // not tracked yet — quiz attempts/scores aren't persisted currently
        totalQuizAttempts: 0,
        completedTasks,
        totalTasks,
        uploadedWords: 0, // not tracked — would need a word-count column on documents
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Documents', value: overview?.documents ?? '-', icon: '📄', color: 'teal' },
    { label: 'Quizzes', value: overview?.quizzes ?? '-', icon: '✓', color: 'amber' },
    { label: 'Flashcard Sets', value: overview?.flashcardSets ?? '-', icon: '⟳', color: 'red' },
    { label: 'Study Plans', value: overview?.studyPlans ?? '-', icon: '📅', color: 'blue' },
    { label: 'Conversations', value: overview?.conversations ?? '-', icon: '💬', color: 'violet' },
    { label: 'Known Cards', value: overview?.knownCards ?? '-', icon: '★', color: 'pink' },
  ];

  const colorMap = {
    teal: 'border-teal-400/30 bg-teal-400/5 text-teal-300',
    amber: 'border-amber-400/30 bg-amber-400/5 text-amber-300',
    red: 'border-red-400/30 bg-red-400/5 text-red-300',
    blue: 'border-blue-400/30 bg-blue-400/5 text-blue-300',
    violet: 'border-violet-400/30 bg-violet-400/5 text-violet-300',
    pink: 'border-pink-400/30 bg-pink-400/5 text-pink-300',
  };

  return (
    <section className="min-h-screen p-8 text-white">
      <div className="mb-8">
        <h1 className="font-orbitron text-3xl font-black tracking-[.1em]">
          DASH<span className="text-violet-400">BOARD</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">Welcome back, {userName}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border p-5 backdrop-blur ${colorMap[card.color]}`}
              >
                <div className="mb-2 text-2xl">{card.icon}</div>
                <div className="text-2xl font-bold font-orbitron">{card.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider opacity-70">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 backdrop-blur">
              <h3 className="mb-4 font-orbitron text-sm font-bold text-amber-300">Quiz Performance</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Average Score</span>
                  <span className="font-bold text-amber-300">{overview?.averageQuizScore ?? 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Attempts</span>
                  <span className="font-bold text-amber-300">{overview?.totalQuizAttempts ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-6 backdrop-blur">
              <h3 className="mb-4 font-orbitron text-sm font-bold text-blue-300">Study Progress</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tasks Completed</span>
                  <span className="font-bold text-blue-300">
                    {overview?.completedTasks ?? 0} / {overview?.totalTasks ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Words Uploaded</span>
                  <span className="font-bold text-blue-300">{overview?.uploadedWords?.toLocaleString() ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-6 backdrop-blur">
            <h3 className="mb-4 font-orbitron text-sm font-bold text-violet-300">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Upload Notes', to: '/upload', icon: '↑' },
                { label: 'Ask AI', to: '/chat', icon: '💬' },
                { label: 'Take Quiz', to: '/quiz', icon: '✓' },
                { label: 'Study Cards', to: '/flashcards', icon: '⟳' },
              ].map((action) => (
                <a
                  key={action.to}
                  href={action.to}
                  className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-center text-sm font-bold text-violet-200 transition hover:bg-violet-400/20"
                >
                  <span className="mr-2">{action.icon}</span>
                  {action.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}