// Uses Cohere's free-tier embeddings API.
// Cohere's embed-english-v3.0 outputs 1024 dimensions.

const COHERE_API_KEY = Deno.env.get("COHERE_API_KEY")!;

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts: [text],
      model: "embed-english-v3.0",
      input_type: "search_document",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cohere embedding error: ${errText}`);
  }

  const data = await res.json();
  return data.embeddings.float[0] as number[];
}

// Cohere supports up to 96 texts per call — batch properly instead of
// looping one at a time.
export async function getEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  const res = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts,
      model: "embed-english-v3.0",
      input_type: "search_document",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cohere embedding error: ${errText}`);
  }

  const data = await res.json();
  return data.embeddings.float as number[][];
}