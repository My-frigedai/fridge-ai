// lib/openai.ts
// Minimal, single-call wrapper with cache and small utilities.
// - Default model selection: gpt-4o-mini (low cost). If preferHighQuality true => gpt-4o.
// - No automatic retries here to minimize token usage.
// - extractTextFromResponse + extractJsonFromText utilities included.

type CallOpts = {
  model?: string; // optional override
  preferHighQuality?: boolean; // if true use gpt-4o, else gpt-4o-mini
  input: string;
  max_output_tokens?: number;
  temperature?: number;
};

const CACHE_TTL_MS = 1000 * 60 * 3; // cache 3 minutes
const responseCache = new Map<string, { ts: number; value: any }>();

function cacheKeyFor(opts: CallOpts) {
  // We deliberately avoid including timestamps etc.
  return JSON.stringify({
    model: opts.model ?? (opts.preferHighQuality ? "gpt-4o" : "gpt-4o-mini"),
    input: opts.input,
    max_output_tokens: opts.max_output_tokens ?? null,
    temperature: opts.temperature ?? null,
  });
}

export async function callOpenAIOnce(
  opts: CallOpts,
  timeoutMs = 15_000
): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    const err: any = new Error("OPENAI_API_KEY is not set");
    err.status = 500;
    throw err;
  }

  const key = cacheKeyFor(opts);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    // return cached copy
    return cached.value;
  }

  const model = opts.model ?? (opts.preferHighQuality ? "gpt-4o" : "gpt-4o-mini");

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: any = {
      model,
      input: opts.input,
    };
    if (typeof opts.max_output_tokens === "number") body.max_output_tokens = opts.max_output_tokens;
    if (typeof opts.temperature === "number") body.temperature = opts.temperature;

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(id);

    const rawText = await res.text().catch(() => "");

    if (!res.ok) {
      const err: any = new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.raw = rawText;
      throw err;
    }

    // parse JSON body
    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch {
      // fallback: return text shaped as { text: rawText }
      json = { output_text: rawText };
    }

    // cache and return
    responseCache.set(key, { ts: Date.now(), value: json });
    return json;
  } catch (e: any) {
    clearTimeout(id);
    if (e.name === "AbortError") {
      const err: any = new Error("OpenAI request timed out");
      err.status = 504;
      throw err;
    }
    throw e;
  }
}

/**
 * extractTextFromResponse
 * Handles Responses API format + fallbacks
 */
export function extractTextFromResponse(respJson: any): string {
  if (!respJson) return "";

  // 1) Responses API (respJson.output is array)
  try {
    if (Array.isArray(respJson.output) && respJson.output.length > 0) {
      const parts: string[] = [];
      for (const o of respJson.output) {
        // o.content may be array
        if (Array.isArray(o.content)) {
          for (const c of o.content) {
            if (typeof c.text === "string" && c.text.trim()) parts.push(c.text);
            else if (typeof c === "string") parts.push(c);
          }
        } else if (typeof o.text === "string") {
          parts.push(o.text);
        } else if (typeof o === "string") {
          parts.push(o);
        }
      }
      if (parts.length) return parts.join("\n\n");
    }
  } catch {
    // ignore
  }

  // 2) Older chat format
  try {
    if (Array.isArray(respJson.choices) && respJson.choices.length > 0) {
      const c = respJson.choices[0];
      if (c.message && typeof c.message.content === "string") return c.message.content;
      if (typeof c.text === "string") return c.text;
    }
  } catch {
    // ignore
  }

  // 3) direct field
  if (typeof respJson.output_text === "string" && respJson.output_text.trim()) return respJson.output_text;
  if (typeof respJson.text === "string") return respJson.text;

  // 4) stringify fallback
  try {
    return JSON.stringify(respJson);
  } catch {
    return String(respJson);
  }
}

/**
 * extractJsonFromText
 * Find the longest (most likely complete) JSON substring (object or array).
 * Returns the string, or null if none.
 */
export function extractJsonFromText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  // find balanced braces/brackets; collect candidates and return longest
  const candidates: string[] = [];

  // helper to scan for matching pair
  const scanPairs = (openChar: string, closeChar: string) => {
    const stack: number[] = [];
    let start = -1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === openChar) {
        if (stack.length === 0) start = i;
        stack.push(i);
      } else if (ch === closeChar) {
        if (stack.length > 0) {
          stack.pop();
          if (stack.length === 0 && start >= 0) {
            candidates.push(text.slice(start, i + 1));
            start = -1;
          }
        }
      }
    }
  };

  scanPairs("{", "}");
  scanPairs("[", "]");

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}
