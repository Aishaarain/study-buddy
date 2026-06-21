import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getEmbeddingsBatch } from "../_shared/embeddings.ts";

// Uses the SERVICE ROLE key because this runs as a background job triggered
// by upload-document, not directly by the end user's browser session.
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 150;
const EMBEDDING_BATCH_SIZE = 20; // chunks per OpenAI batch call

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

async function extractText(
  fileBytes: ArrayBuffer,
  fileType: string,
): Promise<string> {
  if (fileType === "txt") {
    return new TextDecoder().decode(fileBytes);
  }

  if (fileType === "pdf") {
    // Lightweight PDF text extraction for Deno edge runtime.
    // For production-grade PDF parsing, consider routing through an
    // external parsing service or a WASM-based PDF lib pinned via esm.sh.
    const { default: pdfParse } = await import(
      "npm:pdf-parse@1.1.1"
    );
    const result = await pdfParse(new Uint8Array(fileBytes));
    return result.text;
  }

  if (fileType === "docx") {
    const mammoth = await import("npm:mammoth@1.8.0");
    const result = await mammoth.extractRawText({
      buffer: new Uint8Array(fileBytes),
    });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Load the document row
    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) throw new Error("Document not found");

    // 2. Download the file from Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin
      .storage.from("documents")
      .download(document.file_path);

    if (downloadError) throw downloadError;

    const fileBytes = await fileData.arrayBuffer();

    // 3. Extract text
    const fullText = await extractText(fileBytes, document.file_type);

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No extractable text found in document");
    }

    // 4. Chunk
    const chunks = chunkText(fullText);

    // 5. Embed in batches and insert progressively (avoids huge memory spikes —
    //    this is the direct fix for the Node.js OOM crashes you were hitting)
    let chunkIndex = 0;
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const embeddings = await getEmbeddingsBatch(batch);

      const rows = batch.map((content, j) => ({
        document_id: document.id,
        user_id: document.user_id,
        chunk_index: chunkIndex + j,
        content,
        embedding: embeddings[j],
      }));

      const { error: insertError } = await supabaseAdmin
        .from("document_chunks")
        .insert(rows);

      if (insertError) throw insertError;
      chunkIndex += batch.length;
    }

    // 6. Mark document ready
    await supabaseAdmin
      .from("documents")
      .update({ status: "ready", page_count: chunks.length })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, chunksCreated: chunks.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);

    // Mark document failed so the frontend can show an error state instead of spinning forever
    try {
      const body = await req.clone().json();
      if (body?.documentId) {
        await supabaseAdmin
          .from("documents")
          .update({ status: "failed" })
          .eq("id", body.documentId);
      }
    } catch {
      // ignore secondary error
    }

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});