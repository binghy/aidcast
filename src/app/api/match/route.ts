import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateOfferForRequest, EntryLike } from "@/lib/match-engine";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type DbEntry = EntryLike & {
  id: number;
};

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

    if (requestEntry.type !== "request") {
      return NextResponse.json(
        { error: "Only requests can be matched" },
        { status: 400 }
      );
    }

    const requestStatus = requestEntry.status ?? "open";
    if (requestStatus !== "open") {
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