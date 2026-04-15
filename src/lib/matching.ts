import { EntryLike, evaluateOfferForRequest } from "@/lib/match-engine";

export type ScoredMatch = EntryLike & {
  matchScore: number;
  matchReason: string;
  scoreSource: "unified";
};

export async function findMatchesForRequest(
  request: EntryLike,
  limit = 3
): Promise<ScoredMatch[]> {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId: request.id }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Match API failed with status ${res.status}`);
    }

    const json = await res.json();
    return json.matches || [];
  } catch (apiError) {
    console.error("Match API fallback to local evaluation:", apiError);

    const boardRes = await fetch("/api/board", {
      method: "GET",
      cache: "no-store",
    });

    if (!boardRes.ok) {
      throw new Error(`Board API failed with status ${boardRes.status}`);
    }

    const boardJson = await boardRes.json();
    const entries = (boardJson.entries || []) as EntryLike[];

    const offers = entries.filter(
      (entry) => entry.type === "offer" && entry.status === "open"
    );

    const scored = offers
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
      .filter(Boolean)
      .sort((a, b) => (b!.matchScore - a!.matchScore))
      .slice(0, limit) as ScoredMatch[];

    return scored;
  }
}