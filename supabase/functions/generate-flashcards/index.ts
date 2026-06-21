import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { callClaude, parseJsonResponse } from "../_shared/claude.ts";

interface GeneratedFlashcard {
  front: string;
  back: string;
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

    const { documentId, cardCount = 12 } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

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

    const systemPrompt = `You are a flashcard generator for a study app. Create flashcards that each present ONE important piece of information from the notes as a short paragraph. Respond with ONLY a raw JSON array, no markdown fences, no preamble.

Each item must match this shape:
{ "front": "string (a short topic/heading, 2-6 words)", "back": "string (a 2-4 sentence paragraph explaining that specific point, written clearly enough to understand without the original document)" }

Rules:
- Generate exactly ${cardCount} flashcards.
- Each card must cover a DIFFERENT topic or concept from the notes — no two cards should repeat the same information, even if phrased differently.
- Do NOT use question format on the front (no "What is...", no "Define...") — use short topic labels instead (e.g. "Mitochondria Function", "French Revolution Causes").
- Cover the most important, distinct concepts across the entire document, spread out rather than clustered on one section.
- Each back must be self-contained and informative — a student should learn something concrete just by reading it.`;

    const userPrompt = `Notes content:\n\n${sourceText}`;

    const raw = await callClaude(systemPrompt, userPrompt, 3000);
    const cards = parseJsonResponse<GeneratedFlashcard[]>(raw);

    const { data: set, error: setError } = await supabase
      .from("flashcard_sets")
      .insert({
        document_id: documentId,
        user_id: user.id,
        title: `Flashcards: ${document?.title ?? "Untitled"}`,
      })
      .select()
      .single();

    if (setError) throw setError;

    const cardRows = cards.map((c, idx) => ({
      set_id: set.id,
      front: c.front,
      back: c.back,
      order_index: idx,
    }));

    const { error: insertError } = await supabase
      .from("flashcards")
      .insert(cardRows);

    if (insertError) throw insertError;

    await supabase.from("credit_usage").insert({
      user_id: user.id,
      action: "flashcards",
      credits_used: 3,
    });

    return new Response(
      JSON.stringify({ setId: set.id, cardCount: cards.length }),
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