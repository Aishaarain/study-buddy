// Uses Groq's free-tier API (OpenAI-compatible format) instead of Gemini.
// Function name kept as callClaude so no other files need to change.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2000,
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`Groq API returned no text: ${JSON.stringify(data)}`);
  }

  return text;
}

export function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  return JSON.parse(cleaned) as T;
}