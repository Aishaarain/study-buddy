import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";

interface GeneratedQuestion {
  type: "mcq" | "short" | "conceptual";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
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

    const {
      documentId,
      difficulty = "medium",
      mcqCount = 5,
      shortCount = 3,
      conceptualCount = 2,
    } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Pull document chunks (use first N chunks as source material;
    //    for very long docs you could sample across chunks instead)
    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("document_id", documentId)
      .eq("user_id", user.id)
      .order("chunk_index", { ascending: true })
      .limit(15);

    if (chunksError) throw chunksError;
    if (!chunks || chunks.length === 0) {
      throw new Error("No content found for this document");
    }

    const { data: document } = await supabase
      .from("documents")
      .select("title")
      .eq("id", documentId)
      .single();

    const sourceText = chunks.map((c) => c.content).join("\n\n");

    // 2. Prompt Claude for structured JSON quiz output
    const systemPrompt = `You are a quiz generator for a study app. Generate exam-style questions strictly based on the provided notes. Respond with ONLY a raw JSON array, no markdown fences, no preamble.

Each item must match this shape:
{
  "type": "mcq" | "short" | "conceptual",
  "question": "string",
  "options": ["A", "B", "C", "D"]   // ONLY for type "mcq", omit otherwise
  "correctAnswer": "string",
  "explanation": "string"
}

Generate exactly:
- ${mcqCount} multiple choice questions (4 options each)
- ${shortCount} short-answer questions
- ${conceptualCount} conceptual/essay-style questions

Difficulty level: ${difficulty}`;

    const userPrompt = `Notes content:\n\n${sourceText}`;

    const raw = await callClaude(systemPrompt, userPrompt, 4000);
    const questions = parseJsonResponse<GeneratedQuestion[]>(raw);

    // 3. Persist quiz + questions
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        document_id: documentId,
        user_id: user.id,
        title: `Quiz: ${document?.title ?? "Untitled"}`,
        difficulty,
      })
      .select()
      .single();

    if (quizError) throw quizError;

    const questionRows = questions.map((q, idx) => ({
      quiz_id: quiz.id,
      question_type: q.type,
      question: q.question,
      options: q.options ? JSON.stringify(q.options) : null,
      correct_answer: q.correctAnswer,
      explanation: q.explanation ?? null,
      order_index: idx,
    }));

    const { error: insertError } = await supabase
      .from("quiz_questions")
      .insert(questionRows);

    if (insertError) throw insertError;

    // 4. Log credit usage
    await supabase.from("credit_usage").insert({
      user_id: user.id,
      action: "quiz",
      credits_used: 5,
    });

    return new Response(
      JSON.stringify({ quizId: quiz.id, questionCount: questions.length }),
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