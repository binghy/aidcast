import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateOfferForRequest, EntryLike } from "@/lib/match-engine";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type DbEntry = EntryLike & {
  id: number;
  fid?: number | null;
  status?: string | null;
  created_at?: string | null;
};

//const OFFER_TTL_HOURS = 48;
const OFFER_TTL_HOURS = 0.02;

function isExpiredOffer(entry: { type: string; created_at?: string | null }) {
  if (entry.type !== "offer") return false;
  if (!entry.created_at) return false;

  const createdAt = new Date(entry.created_at).getTime();
  const now = Date.now();
  const ageHours = (now - createdAt) / (1000 * 60 * 60);

  return ageHours > OFFER_TTL_HOURS;
}

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json();

    if (!requestId || typeof requestId !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid requestId" },
        { status: 400 }
      );
    }

    const { data: requestEntry, error: requestError } = await supabase
      .from("entries")
      .select("*")
      .eq("id", requestId)
      .single<DbEntry>();

    if (requestError || !requestEntry) {
      console.error("Match route request lookup error:", requestError);
      return NextResponse.json(
        { error: "Request entry not found" },
        { status: 404 }
      );
    }

    const requestStatus = requestEntry.status ?? "open";

    if (requestEntry.type !== "request" || requestStatus !== "open") {
      await supabase.from("request_match_state").delete().eq("request_id", requestId);

      return NextResponse.json({
        requestId,
        matches: [],
      });
    }

    const { data: offers, error: offersError } = await supabase
      .from("entries")
      .select("*")
      .eq("type", "offer")
      .order("created_at", { ascending: false });

    if (offersError) {
      console.error("Match route offers lookup error:", offersError);
      return NextResponse.json(
        { error: offersError.message },
        { status: 500 }
      );
    }

    const scoredMatches = (offers || [])
      .filter((offer) => (offer.status ?? "open") === "open")
      .filter((offer) => !isExpiredOffer(offer))
      .map((offer) => {
        const evaluation = evaluateOfferForRequest(
          requestEntry,
          offer as DbEntry
        );

        if (!evaluation.isMatch) return null;

        return {
          ...(offer as DbEntry),
          matchScore: evaluation.score,
          matchReason: evaluation.reason,
          scoreSource: "unified" as const,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.matchScore - a!.matchScore)
      .slice(0, 3);

    const bestMatch = scoredMatches[0];

    if (bestMatch) {
      await supabase.from("request_match_state").upsert(
        {
          request_id: requestEntry.id,
          fid: requestEntry.fid ?? null,
          best_match_entry_id: bestMatch.id,
          best_score: bestMatch.matchScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id" }
      );
    } else {
      await supabase.from("request_match_state").delete().eq("request_id", requestId);
    }

    return NextResponse.json({
      requestId,
      matches: scoredMatches,
    });
  } catch (error) {
    console.error("Match route unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}