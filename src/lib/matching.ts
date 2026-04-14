import { supabase } from "./supabase";
import { evaluateOfferForRequest } from "./match-engine";

type Entry = {
  id: number;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  type: "request" | "offer";
  raw_text: string;
  category: string | null;
  priority: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
  support_mode: "online" | "in_person" | "both" | null;
  location_text: string | null;
};

export type ScoredMatch = Entry & {
  matchScore: number;
  matchReason: string;
  scoreSource: "unified";
};

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function shouldDisableSelfMatch() {
  return process.env.NEXT_PUBLIC_DISABLE_SELF_MATCH === "true";
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
  const disableSelfMatch = shouldDisableSelfMatch();

  const filteredByOwnership = offers.filter((offer) => {
    if (!disableSelfMatch) return true;
    if (!request.fid || !offer.fid) return true;
    return offer.fid !== request.fid;
  });

  const seen = new Set<string>();
  const deduped: Entry[] = [];

  for (const offer of filteredByOwnership) {
    const fingerprint = normalizeText(offer.summary || offer.raw_text || "");
    if (!fingerprint) continue;

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      deduped.push(offer);
    }
  }

  const scored = deduped
    .map((offer) => {
      const evaluation = evaluateOfferForRequest(request, offer);

      if (!evaluation.isMatch) return null;

      return {
        ...offer,
        matchScore: evaluation.score,
        matchReason: evaluation.reason,
        scoreSource: "unified" as const,
      };
    })
    .filter(Boolean) as ScoredMatch[];

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
}