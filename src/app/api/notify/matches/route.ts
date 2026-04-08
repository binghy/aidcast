import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendNotificationToFid } from "@/lib/notifications";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function extractCity(location: string | null): string | null {
  if (!location) return null;
  return location.split(",")[0]?.trim().toLowerCase() || null;
}

function locationBoost(request: any, offer: any) {
  const requestMode = request.support_mode || "online";
  const offerMode = offer.support_mode || "online";

  const requestNeedsLocation =
    requestMode === "in_person" || requestMode === "both";
  const offerNeedsLocation =
    offerMode === "in_person" || offerMode === "both";

  if (!requestNeedsLocation && !offerNeedsLocation) return 0;

  const requestCity = extractCity(request.location_text);
  const offerCity = extractCity(offer.location_text);

  if (requestCity && offerCity && requestCity === offerCity) return 12;
  return 0;
}

export async function POST() {
  try {
    const { data: requests, error: reqError } = await supabase
      .from("entries")
      .select("*")
      .eq("type", "request")
      .eq("status", "open");

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 400 });
    }

    for (const request of requests || []) {
      if (!request.fid || !request.category) continue;

      const { data: offers, error: offerError } = await supabase
        .from("entries")
        .select("*")
        .eq("type", "offer")
        .eq("status", "open")
        .eq("category", request.category);

      if (offerError) continue;

      const ranked = (offers || [])
        .map((offer: any) => ({
          ...offer,
          computed_score:
            50 +
            (offer.priority === "high" ? 15 : offer.priority === "medium" ? 8 : 0) +
            locationBoost(request, offer),
        }))
        .sort((a: any, b: any) => b.computed_score - a.computed_score);

      const best = ranked[0];
      if (!best) continue;

      const { data: state } = await supabase
        .from("request_match_state")
        .select("*")
        .eq("request_id", request.id)
        .maybeSingle();

      const targetUrl = "https://aidcast.vercel.app/board";

      if (!state) {
        await sendNotificationToFid({
          fid: request.fid,
          notificationId: `first-match-${request.id}-${best.id}`,
          title: "New match found",
          body: `AIdCast found your first match for: ${request.summary}`,
          targetUrl,
        });

        await supabase.from("request_match_state").insert([
          {
            request_id: request.id,
            fid: request.fid,
            best_match_entry_id: best.id,
            best_score: best.computed_score,
            first_notified_at: new Date().toISOString(),
            last_notified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        continue;
      }

      if ((best.computed_score || 0) > (state.best_score || 0)) {
        await sendNotificationToFid({
          fid: request.fid,
          notificationId: `better-match-${request.id}-${best.id}`,
          title: "Better match available",
          body: `A stronger match is now available for: ${request.summary}`,
          targetUrl,
        });

        await supabase
          .from("request_match_state")
          .update({
            best_match_entry_id: best.id,
            best_score: best.computed_score,
            last_notified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("request_id", request.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notify matches route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}