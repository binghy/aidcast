import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { quickAuthClient } from "@/lib/quick-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const payload = await quickAuthClient.verifyJwt({
      token,
      domain: "aidcast.vercel.app",
    });

    console.log("Verified Quick Auth payload (close route):", payload);

    const fid = Number(payload.sub);

    console.log("Resolved fid (close route):", fid);

    if (!fid || Number.isNaN(fid)) {
      return NextResponse.json({ error: "Invalid fid" }, { status: 401 });
    }

    const { requestId, selectedOfferEntryId } = await req.json();

    if (!requestId || typeof requestId !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid requestId" },
        { status: 400 }
      );
    }

    const { data: requestEntry, error: requestError } = await supabase
      .from("entries")
      .select("id, fid, type, status")
      .eq("id", requestId)
      .single();

    if (requestError || !requestEntry) {
      return NextResponse.json(
        { error: "Request entry not found" },
        { status: 404 }
      );
    }

    if (requestEntry.type !== "request") {
      return NextResponse.json(
        { error: "Only requests can be closed" },
        { status: 400 }
      );
    }

    if (Number(requestEntry.fid) !== fid) {
      return NextResponse.json(
        { error: "Only the request owner can close it" },
        { status: 403 }
      );
    }

    let validatedSelectedOfferId: number | null = null;

    if (
      typeof selectedOfferEntryId === "number" &&
      Number.isFinite(selectedOfferEntryId)
    ) {
      const { data: selectedOffer, error: selectedOfferError } = await supabase
        .from("entries")
        .select("id, type")
        .eq("id", selectedOfferEntryId)
        .single();

      if (!selectedOfferError && selectedOffer && selectedOffer.type === "offer") {
        validatedSelectedOfferId = selectedOffer.id;
      }
    }

    const { data: updatedEntry, error: updateError } = await supabase
      .from("entries")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by_fid: fid,
        selected_offer_entry_id: validatedSelectedOfferId,
      })
      .eq("id", requestId)
      .eq("type", "request")
      .select("id, status, selected_offer_entry_id, closed_by_fid")
      .single();

    if (updateError) {
      console.error("Close request update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedEntry || updatedEntry.status !== "closed") {
      return NextResponse.json(
        { error: "Request was not actually closed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      updatedEntry,
    });
  } catch (error) {
    console.error("Close request route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}