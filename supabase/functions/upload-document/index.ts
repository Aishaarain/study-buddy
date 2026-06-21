import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

// NOTE: The actual file bytes are uploaded directly from the frontend to
// Supabase Storage using supabase-js (storage upload doesn't need an Edge
// Function). This function just registers the document row + kicks off
// background processing (text extraction + embedding) by invoking
// process-document.

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

    const { title, filePath, fileType, fileSizeBytes } = await req.json();

    if (!title || !filePath || !fileType) {
      return new Response(
        JSON.stringify({ error: "title, filePath, fileType are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert the document row (status: processing)
    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title,
        file_path: filePath,
        file_type: fileType,
        file_size_bytes: fileSizeBytes ?? null,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Fire-and-forget: trigger background processing (text extraction + embeddings)
    const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-document`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId: document.id }),
    }).catch((err) => console.error("Failed to trigger processing:", err));

    return new Response(JSON.stringify({ document }), {
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