import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { callClaude } from "../_shared/claude.ts";
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
    const { documentId, style = "concise" } = await req.json();
    // style: "concise" | "detailed" | "bullet-points"
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
      .order("chunk_index", { ascending: true });
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
    const styleInstructions: Record<string, string> = {
      concise: "Write a concise summary in 3-5 short paragraphs.",
      detailed: "Write a thorough, detailed summary covering all key points and sub-topics.",
      "bullet-points": "Write the summary as organized bullet points grouped by topic.",
    };
    const systemPrompt = `You are a study assistant that summarizes notes for students. ${styleInstructions[style] ?? styleInstructions.concise} Use clear, student-friendly language. Do not include a title or preamble — start directly with the summary content.`;
    const summary = await callClaude(systemPrompt, sourceText, 2500);
    const { data: savedSummary, error: insertError } = await supabase
      .from("summaries")
      .insert({
        document_id: documentId,
        user_id: user.id,
        title: `Summary: ${document?.title ?? "Untitled"}`,
        content: summary,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    await supabase.from("credit_usage").insert({
      user_id: user.id,
      action: "summary",
      credits_used: 2,
    });
    return new Response(JSON.stringify({ summary: savedSummary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});       