import { supabase } from "./supabase";

type Entry = {
  id: number;
  type: "request" | "offer";
  raw_text: string;
  category: string | null;
  priority: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

export type ScoredMatch = Entry & {
  matchScore: number;
  matchReason: string;
  scoreSource: "lexical" | "llm";
};

const STOPWORDS = new Set([
  "i",
  "can",
  "help",
  "the",
  "a",
  "an",
  "to",
  "from",
  "with",
  "and",
  "or",
  "for",
  "of",
  "in",
  "on",
  "at",
  "by",
  "is",
  "are",
  "this",
  "that",
  "it",
  "be",
  "as",
  "into",
]);

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function stem(word: string): string {
  return word
    .replace(/ing$/, "")
    .replace(/ed$/, "")
    .replace(/tion$/, "")
    .replace(/s$/, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

function uniqueWords(words: string[]) {
  return Array.from(new Set(words));
}

function getCommonWords(a: string, b: string): string[] {
  const aWords = new Set(uniqueWords(tokenize(a)));
  const bWords = new Set(uniqueWords(tokenize(b)));

  return Array.from(aWords).filter((word) => bWords.has(word));
}

function getPriorityBoost(priority: string | null) {
  if (priority === "high") return 15;
  if (priority === "medium") return 8;
  return 0;
}

function getRecencyBoost(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffHours = (now - created) / (1000 * 60 * 60);

  if (diffHours < 1) return 10;
  if (diffHours < 24) return 6;
  if (diffHours < 72) return 3;
  return 0;
}

async function evaluateMatchWithLLM(
  requestText: string,
  offerText: string
): Promise<{ isMatch: boolean; score: number; reason: string } | null> {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestText,
        offerText,
      }),
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("LLM match evaluation failed:", error);
    return null;
  }
}

export async function findMatchesForRequest(
  request: Entry,
  limit = 3
): Promise<ScoredMatch[]> {
  if (!request.category) return [];

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("type", "offer")
    .eq("status", "open")
    .eq("category", request.category);

  if (error) {
    console.error("Matching error:", error);
    return [];
  }

  const offers = (data || []) as Entry[];

  const filtered = offers.filter((offer) => offer.id !== request.id);

  const seen = new Set<string>();
  const deduped: Entry[] = [];

  for (const offer of filtered) {
    const fingerprint = normalizeText(offer.summary || offer.raw_text || "");

    if (!fingerprint) continue;

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      deduped.push(offer);
    }
  }

  const lexicalScored: ScoredMatch[] = deduped.map((offer) => {
    let score = 50;

    const commonWords = getCommonWords(
      request.summary || request.raw_text,
      offer.summary || offer.raw_text
    );

    const keywordBoost = commonWords.length * 5;
    const priorityBoost = getPriorityBoost(offer.priority);
    const recencyBoost = getRecencyBoost(offer.created_at);

    score += keywordBoost + priorityBoost + recencyBoost;

    const reasons: string[] = [`same category: ${request.category}`];

    if (commonWords.length > 0) {
      reasons.push(`shared words: ${commonWords.slice(0, 4).join(", ")}`);
    }

    if (offer.priority) {
      reasons.push(`priority: ${offer.priority}`);
    }

    if (recencyBoost > 0) {
      reasons.push("recent offer");
    }

    return {
      ...offer,
      matchScore: score,
      matchReason: reasons.join(" • "),
      scoreSource: "lexical",
    };
  });

  lexicalScored.sort((a, b) => b.matchScore - a.matchScore);

  // Pre-filtro: teniamo solo i migliori 5 candidati lessicali
  const topCandidates = lexicalScored.slice(0, 5);

  const llmEvaluated: ScoredMatch[] = [];

  for (const candidate of topCandidates) {
    const llmResult = await evaluateMatchWithLLM(
      request.summary || request.raw_text,
      candidate.summary || candidate.raw_text
    );

    if (!llmResult) {
      // fallback: se LLM fallisce, tieni il match lessicale
      llmEvaluated.push(candidate);
      continue;
    }

    if (!llmResult.isMatch) {
      continue;
    }

    llmEvaluated.push({
      ...candidate,
      matchScore: llmResult.score,
      matchReason: llmResult.reason,
      scoreSource: "llm",
    });
  }

  llmEvaluated.sort((a, b) => b.matchScore - a.matchScore);

  return llmEvaluated.slice(0, limit);
}