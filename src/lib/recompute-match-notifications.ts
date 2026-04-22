import { createClient } from "@supabase/supabase-js";
import { sendNotificationToFid } from "@/lib/notifications";
import { evaluateOfferForRequest } from "@/lib/match-engine";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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

    const { data: offers, error: offerError } = await supabase
      .from("entries")
      .select("*")
      .eq("type", "offer")
      .eq("status", "open")
      .eq("category", request.category);

    if (offerError) {
      console.error("recomputeMatchNotifications offers error:", offerError);
      continue;
    }

    const ranked = (offers || [])
      .map((offer: any) => {
        const evaluation = evaluateOfferForRequest(request, offer);
        if (!evaluation.isMatch) return null;

        return {
          ...offer,
          computed_score: evaluation.score,
          computed_reason: evaluation.reason,
        };
      })
      .filter(Boolean)
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
        console.error(
          "recomputeMatchNotifications insert state error:",
          insertStateError
        );
      }

      continue;
    }

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
        console.error(
          "recomputeMatchNotifications update state error:",
          updateStateError
        );
      }
    }
  }

  return { ok: true };
}