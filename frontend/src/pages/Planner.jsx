
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

export default function Planner() {
  const [plans, setPlans] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  const [step, setStep] = useState('list');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ examDate: '', planTitle: '' });

  useEffect(() => {
    loadPlans();
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

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('study_plans')
        .select('id, title, exam_date, status, created_at, study_plan_tasks(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      setPlans(
        (data || []).map((p) => ({
          _id: p.id,
          title: p.title,
          examDate: p.exam_date,
          tasks: { length: p.study_plan_tasks?.[0]?.count || 0 },
        }))
      );
    } catch {
      // silent
    }
  };

  const loadFullPlan = async (planId) => {
    const { data: plan, error: planError } = await supabase
      .from('study_plans')
      .select('*')
      .eq('id', planId)
      .single();
    if (planError) throw planError;

    const { data: tasks, error: tasksError } = await supabase
      .from('study_plan_tasks')
      .select('*')
      .eq('plan_id', planId)
      .order('scheduled_date', { ascending: true });
    if (tasksError) throw tasksError;

    return {
      _id: plan.id,
      title: plan.title,
      examDate: plan.exam_date,
      tasks: (tasks || []).map((t) => ({
        _id: t.id,
        topic: t.title,
        description: t.description,
        date: t.scheduled_date,
        durationMinutes: 60,
        completed: t.is_completed,
      })),
    };
  };

  const handleGenerate = async () => {
    if (selectedDocIds.length === 0) return toast.error('Select at least one document');
    if (!form.examDate) return toast.error('Pick an exam date');

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          documentIds: selectedDocIds,
          examDate: form.examDate,
          planTitle: form.planTitle || undefined,
        },
      });
      if (error) throw error;

      toast.success('Study plan created!');
      await loadPlans();

      const fullPlan = await loadFullPlan(data.planId);
      setActivePlan(fullPlan);
      setStep('view');
    } catch (err) {
      toast.error(err.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const openPlan = async (plan) => {
    try {
      const fullPlan = await loadFullPlan(plan._id);
      setActivePlan(fullPlan);
      setStep('view');
    } catch {
      toast.error('Failed to load plan');
    }
  };

  const toggleTask = async (taskId, completed) => {
    if (!activePlan) return;
    try {
      const { error } = await supabase
        .from('study_plan_tasks')
        .update({ is_completed: completed })
        .eq('id', taskId);
      if (error) throw error;

      const updated = { ...activePlan };
      updated.tasks = updated.tasks.map((t) => (t._id === taskId ? { ...t, completed } : t));
      setActivePlan(updated);
    } catch {
      toast.error('Failed to update task');
    }
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('study_plans').delete().eq('id', id);
      if (error) throw error;
      toast.success('Plan deleted');
      loadPlans();
      if (activePlan?._id === id) { setActivePlan(null); setStep('list'); }
    } catch {
      toast.error('Delete failed');
    }
  };

  if (step === 'generate') {
    return (
      <section className="min-h-screen p-8 text-white">
        <h1 className="mb-8 font-orbitron text-3xl font-black tracking-[.15em]">
          NEW <span className="text-blue-400">PLAN</span>
        </h1>
        <div className="mx-auto max-w-lg rounded-2xl border border-blue-400/30 bg-blue-400/5 p-8 backdrop-blur">
          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-blue-300 font-bold">Plan Title (optional)</label>
            <input value={form.planTitle} onChange={(e) => setForm((f) => ({ ...f, planTitle: e.target.value }))}
              className="w-full rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm text-white focus:border-blue-400 focus:outline-none"
              placeholder="e.g. Calculus Final Prep" />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-blue-300 font-bold">Exam Date *</label>
            <input type="date" value={form.examDate} onChange={(e) => setForm((f) => ({ ...f, examDate: e.target.value }))}
              className="w-full rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm text-white focus:border-blue-400 focus:outline-none" />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-xs uppercase tracking-wider text-blue-300 font-bold">Documents to Cover *</label>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-blue-400/20 bg-blue-400/5 p-3">
              {documents.length === 0 && (
                <p className="text-xs text-blue-300/60 p-2">No processed documents yet — upload one first.</p>
              )}
              {documents.map((doc) => (
                <label key={doc.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-blue-400/10 transition">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                    className="accent-blue-400"
                  />
                  {doc.title}
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-bold transition hover:scale-105 disabled:opacity-50 shadow-[0_0_20px_rgba(41,121,255,.3)]">
            {loading ? 'Creating...' : 'Create Plan'}
          </button>
          <button onClick={() => setStep('list')} className="mt-3 w-full rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-bold hover:bg-blue-400/15 transition">
            Back to Plans
          </button>
        </div>
      </section>
    );
  }

  if (step === 'view' && activePlan) {
    const totalTasks = activePlan.tasks?.length || 0;
    const completedTasks = activePlan.tasks?.filter((t) => t.completed).length || 0;
    const progressPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
      <section className="min-h-screen p-8 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <h1 className="font-orbitron text-2xl font-bold text-blue-300">{activePlan.title}</h1>
            {activePlan.examDate && <p className="text-xs text-slate-500 mt-1">Exam: {new Date(activePlan.examDate).toLocaleDateString()}</p>}
          </div>

          <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-400/5 p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-blue-200 font-bold">Progress</span>
              <span className="text-sm text-blue-300">{completedTasks}/{totalTasks} ({progressPct}%)</span>
            </div>
            <div className="h-2 rounded-full bg-blue-400/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="space-y-3">
            {(activePlan.tasks || []).map((task) => (
              <div key={task._id} className={`flex items-center gap-4 rounded-2xl border p-5 backdrop-blur transition ${
                task.completed ? 'border-green-400/20 bg-green-400/5' : 'border-blue-400/20 bg-blue-400/5'
              }`}>
                <input type="checkbox" checked={task.completed} onChange={(e) => toggleTask(task._id, e.target.checked)}
                  className="h-5 w-5 accent-blue-400 cursor-pointer" />
                <div className="flex-1">
                  <p className={`text-md lg:text-md ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.topic}</p>
                  {task.description && <p className="mt-1 text-md lg:text-md text-slate-500">{task.description}</p>}
                  <p className="mt-1 text-md lg:text-shadow-md text-slate-600">{task.date}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep('list')} className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-6 py-3 text-sm font-bold hover:bg-blue-400/15 transition">Back to Plans</button>
            <button onClick={() => handleDelete(activePlan._id)} className="rounded-xl border border-red-400/30 px-6 py-3 text-sm text-red-400 hover:bg-red-400/10 transition">Delete Plan</button>
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
            STUDY <span className="text-blue-400">PLANS</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">{plans.length} plans</p>
        </div>
        <button onClick={() => { setStep('generate'); setForm({ examDate: '', planTitle: '' }); setSelectedDocIds([]); }}
          className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(41,121,255,.3)]">
          + New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-slate-400">No study plans yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan._id} className="rounded-2xl border border-blue-400/20 bg-blue-400/5 p-6 backdrop-blur transition hover:bg-blue-400/10">
              <h3 className="font-orbitron text-md font-bold text-blue-200 truncate">{plan.title}</h3>
              {plan.examDate && <p className="mt-1 text-md text-slate-400">Exam: {new Date(plan.examDate).toLocaleDateString()}</p>}
              <div className="mt-2 flex gap-2 text-md text-slate-500">
                <span>{plan.tasks?.length || 0} tasks</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openPlan(plan)} className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-xs font-bold transition hover:scale-105">
                  View
                </button>
                <button onClick={() => handleDelete(plan._id)} className="rounded-xl border border-red-400/30 px-4 py-2 text-xs text-red-400 hover:bg-red-400/10 transition">
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