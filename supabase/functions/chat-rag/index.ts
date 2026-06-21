import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getEmbedding } from "../_shared/embeddings.ts";
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

    const { chatId, documentId, message } = await req.json();

    if (!documentId || !message) {
      return new Response(
        JSON.stringify({ error: "documentId and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Get or create the chat
    let activeChatId = chatId;
    if (!activeChatId) {
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          user_id: user.id,
          document_id: documentId,
          title: message.slice(0, 50),
        })
        .select()
        .single();
      if (chatError) throw chatError;
      activeChatId = newChat.id;
    }

    // 2. Save user message
    await supabase.from("chat_messages").insert({
      chat_id: activeChatId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    // 3. Embed the question
    const queryEmbedding = await getEmbedding(message);

    // 4. Retrieve top matching chunks via pgvector RPC
    const { data: chunks, error: matchError } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding,
        match_document_id: documentId,
        match_user_id: user.id,
        match_count: 5,
      },
    );

    if (matchError) throw matchError;

    const context = (chunks ?? [])
      .map((c: { content: string }) => c.content)
      .join("\n\n---\n\n");

    // 5. Build prompt and call Claude
    const systemPrompt = `You are a helpful study assistant. Answer the student's question using ONLY the context below from their uploaded notes. If the answer isn't in the context, say so honestly rather than guessing.

Context from the student's notes:
${context}`;

    const answer = await callClaude(systemPrompt, message, 1500);

    // 6. Save assistant message
    const { data: assistantMessage, error: saveError } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: activeChatId,
        user_id: user.id,
        role: "assistant",
        content: answer,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({ chatId: activeChatId, message: assistantMessage }),
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