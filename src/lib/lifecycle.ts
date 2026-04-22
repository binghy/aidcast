import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const ENTRY_TTL_HOURS = 24;

function ttlThresholdIso() {
  return new Date(Date.now() - ENTRY_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function cleanupLifecycleState() {
  const nowIso = new Date().toISOString();
  const thresholdIso = ttlThresholdIso();

  // 1) auto-close old open requests
  const { data: oldRequests, error: oldRequestsError } = await supabase
    .from("entries")
    .select("id")
    .eq("type", "request")
    .eq("status", "open")
    .lt("created_at", thresholdIso);

  if (oldRequestsError) {
    console.error("cleanupLifecycleState oldRequests error:", oldRequestsError);
    throw oldRequestsError;
  }

  const oldRequestIds = (oldRequests || []).map((r) => r.id);

  if (oldRequestIds.length > 0) {
    const { error: closeOldRequestsError } = await supabase
      .from("entries")
      .update({
        status: "closed",
        closed_at: nowIso,
      })
      .in("id", oldRequestIds);

    if (closeOldRequestsError) {
      console.error(
        "cleanupLifecycleState closeOldRequests error:",
        closeOldRequestsError
      );
      throw closeOldRequestsError;
    }
  }

  // 2) get open requests after auto-close
  const { data: openRequests, error: openRequestsError } = await supabase
    .from("entries")
    .select("id")
    .eq("type", "request")
    .eq("status", "open");

  if (openRequestsError) {
    console.error("cleanupLifecycleState openRequests error:", openRequestsError);
    throw openRequestsError;
  }

  const openRequestIds = (openRequests || []).map((r) => r.id);
  const openRequestIdSet = new Set(openRequestIds);

  // 3) clean stale request_match_state rows
  const { data: matchStates, error: matchStatesError } = await supabase
    .from("request_match_state")
    .select("request_id, best_match_entry_id");

  if (matchStatesError) {
    console.error("cleanupLifecycleState matchStates error:", matchStatesError);
    throw matchStatesError;
  }

  const staleRequestIds = (matchStates || [])
    .filter((row) => !openRequestIdSet.has(row.request_id))
    .map((row) => row.request_id);

  if (staleRequestIds.length > 0) {
    const { error: deleteStaleStatesError } = await supabase
      .from("request_match_state")
      .delete()
      .in("request_id", staleRequestIds);

    if (deleteStaleStatesError) {
      console.error(
        "cleanupLifecycleState deleteStaleStates error:",
        deleteStaleStatesError
      );
      throw deleteStaleStatesError;
    }
  }

  // 4) recompute locked offer ids from current valid request_match_state
  const { data: validMatchStates, error: validMatchStatesError } = await supabase
    .from("request_match_state")
    .select("request_id, best_match_entry_id");

  if (validMatchStatesError) {
    console.error(
      "cleanupLifecycleState validMatchStates error:",
      validMatchStatesError
    );
    throw validMatchStatesError;
  }

  const lockedOfferIds = Array.from(
    new Set(
      (validMatchStates || [])
        .filter((row) => openRequestIdSet.has(row.request_id))
        .map((row) => row.best_match_entry_id)
        .filter((id): id is number => typeof id === "number")
    )
  );

  // 5) delete expired open offers that are NOT locked
  const { data: oldOpenOffers, error: oldOpenOffersError } = await supabase
    .from("entries")
    .select("id")
    .eq("type", "offer")
    .eq("status", "open")
    .lt("created_at", thresholdIso);

  if (oldOpenOffersError) {
    console.error("cleanupLifecycleState oldOpenOffers error:", oldOpenOffersError);
    throw oldOpenOffersError;
  }

  const deletableOfferIds = (oldOpenOffers || [])
    .map((o) => o.id)
    .filter((id) => !lockedOfferIds.includes(id));

  if (deletableOfferIds.length > 0) {
    const { error: deleteOffersError } = await supabase
      .from("entries")
      .delete()
      .in("id", deletableOfferIds);

    if (deleteOffersError) {
      console.error(
        "cleanupLifecycleState deleteOffers error:",
        deleteOffersError
      );
      throw deleteOffersError;
    }
  }

  return {
    closedRequestIds: oldRequestIds,
    lockedOfferIds,
    deletedOfferIds: deletableOfferIds,
  };
}