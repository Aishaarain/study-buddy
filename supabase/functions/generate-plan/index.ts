import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";

interface GeneratedTask {
  title: string;
  description: string;
  scheduledDate: string; // YYYY-MM-DD
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentIds, examDate, planTitle } = await req.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "documentIds (array) is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!examDate) {
      return new Response(JSON.stringify({ error: "examDate is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Gather titles + a sample of content per document for topic context
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("id, title")
      .in("id", documentIds)
      .eq("user_id", user.id);

    if (docsError) throw docsError;

    const topicList = (documents ?? []).map((d) => `- ${d.title}`).join("\n");
    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a study planner for a student preparing for an exam. Create a day-by-day revision schedule from today (${today}) until the exam date (${examDate}), covering all listed topics with balanced spacing and a final light-review day before the exam. Respond with ONLY a raw JSON array, no markdown fences, no preamble.

Each item must match this shape:
{ "title": "string (short task title)", "description": "string (what to do)", "scheduledDate": "YYYY-MM-DD" }

Distribute tasks realistically (don't cram everything on one day). Include revision/practice tasks, not just "read chapter X".`;

    const userPrompt = `Topics to cover:\n${topicList}\n\nExam date: ${examDate}`;

    const raw = await callClaude(systemPrompt, userPrompt, 3000);
    const tasks = parseJsonResponse<GeneratedTask[]>(raw);

    // 2. Persist plan + tasks
    const { data: plan, error: planError } = await supabase
      .from("study_plans")
      .insert({
        user_id: user.id,
        title: planTitle ?? `Study Plan (exam ${examDate})`,
        exam_date: examDate,
        status: "active",
      })
      .select()
      .single();

    if (planError) throw planError;

    const taskRows = tasks.map((t, idx) => ({
      plan_id: plan.id,
      document_id: documentIds[0] ?? null, // optionally map per-task to a doc with smarter logic
      title: t.title,
      description: t.description,
      scheduled_date: t.scheduledDate,
      order_index: idx,
    }));

    const { error: insertError } = await supabase
      .from("study_plan_tasks")
      .insert(taskRows);

    if (insertError) throw insertError;

    await supabase.from("credit_usage").insert({
      user_id: user.id,
      action: "planner",
      credits_used: 4,
    });

    return new Response(
      JSON.stringify({ planId: plan.id, taskCount: tasks.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});