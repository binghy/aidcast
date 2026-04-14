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

function baseScore(request: any, offer: any) {
  let score = 50;

  if (offer.priority === "high") score += 15;
  else if (offer.priority === "medium") score += 8;

  score += locationBoost(request, offer);

  return score;
}

export async function recomputeMatchNotifications(params?: {
  onlyCategory?: string | null;
}) {
  const { onlyCategory = null } = params || {};

  let requestQuery = supabase
    .from("entries")
    .select("*")
    .eq("type", "request")
    .eq("status", "open");

  if (onlyCategory) {
    requestQuery = requestQuery.eq("category", onlyCategory);
  }

  const { data: requests, error: reqError } = await requestQuery;

  if (reqError) {
    console.error("recomputeMatchNotifications requests error:", reqError);
    return { ok: false, error: reqError.message };
  }

  for (const request of requests || []) {
    if (!request.fid || !request.category) continue;

    let offersQuery = supabase
      .from("entries")
      .select("*")
      .eq("type", "offer")
      .eq("status", "open")
      .eq("category", request.category);

    const { data: offers, error: offerError } = await offersQuery;

    if (offerError) {
      console.error("recomputeMatchNotifications offers error:", offerError);
      continue;
    }

    const ranked = (offers || [])
      .map((offer: any) => ({
        ...offer,
        computed_score: baseScore(request, offer),
      }))
      .sort((a: any, b: any) => b.computed_score - a.computed_score);

    const best = ranked[0];
    if (!best) continue;

    const { data: state, error: stateError } = await supabase
      .from("request_match_state")
      .select("*")
      .eq("request_id", request.id)
      .maybeSingle();

    if (stateError) {
      console.error("recomputeMatchNotifications state error:", stateError);
      continue;
    }

    const targetUrl = "https://aidcast.vercel.app/board";

    // Primo match
    if (!state) {
      await sendNotificationToFid({
        fid: request.fid,
        notificationId: `first-match-${request.id}-${best.id}`,
        title: "New match found",
        body: `AIdCast found your first match for: ${request.summary || request.raw_text}`,
        targetUrl,
      });

      const { error: insertStateError } = await supabase
        .from("request_match_state")
        .insert([
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

      if (insertStateError) {
        console.error("recomputeMatchNotifications insert state error:", insertStateError);
      }

      continue;
    }

    // Match migliore
    if ((best.computed_score || 0) > (state.best_score || 0)) {
      await sendNotificationToFid({
        fid: request.fid,
        notificationId: `better-match-${request.id}-${best.id}`,
        title: "Better match available",
        body: `A stronger match is now available for: ${request.summary || request.raw_text}`,
        targetUrl,
      });

      const { error: updateStateError } = await supabase
        .from("request_match_state")
        .update({
          best_match_entry_id: best.id,
          best_score: best.computed_score,
          last_notified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("request_id", request.id);

      if (updateStateError) {
        console.error("recomputeMatchNotifications update state error:", updateStateError);
      }
    }
  }

  return { ok: true };
}