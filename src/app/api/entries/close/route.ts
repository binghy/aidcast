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
        .select("id, type, status")
        .eq("id", selectedOfferEntryId)
        .single();

      if (selectedOfferError || !selectedOffer) {
        return NextResponse.json(
          { error: "Selected offer not found" },
          { status: 404 }
        );
      }

      if (selectedOffer.type !== "offer") {
        return NextResponse.json(
          { error: "Selected entry is not an offer" },
          { status: 400 }
        );
      }

      validatedSelectedOfferId = selectedOffer.id;
    }

    const now = new Date().toISOString();

    const { data: updatedRequest, error: requestUpdateError } = await supabase
      .from("entries")
      .update({
        status: "closed",
        closed_at: now,
        closed_by_fid: fid,
        selected_offer_entry_id: validatedSelectedOfferId,
      })
      .eq("id", requestId)
      .eq("type", "request")
      .select("id, status, selected_offer_entry_id, closed_by_fid")
      .single();

    if (requestUpdateError) {
      console.error("Close request update error:", requestUpdateError);
      return NextResponse.json(
        { error: requestUpdateError.message },
        { status: 500 }
      );
    }

    if (!updatedRequest || updatedRequest.status !== "closed") {
      return NextResponse.json(
        { error: "Request was not actually closed" },
        { status: 500 }
      );
    }

    let updatedOffer: unknown = null;

    if (validatedSelectedOfferId) {
      const { data: closedOffer, error: offerUpdateError } = await supabase
        .from("entries")
        .update({
          status: "closed",
          closed_at: now,
          closed_by_fid: fid,
          selected_for_request_id: requestId,
        })
        .eq("id", validatedSelectedOfferId)
        .eq("type", "offer")
        .select("id, status, selected_for_request_id, closed_by_fid")
        .single();

      if (offerUpdateError) {
        console.error("Close selected offer update error:", offerUpdateError);
        return NextResponse.json(
          { error: offerUpdateError.message },
          { status: 500 }
        );
      }

      updatedOffer = closedOffer;
    }

    return NextResponse.json({
      success: true,
      requestId,
      updatedRequest,
      updatedOffer,
    });
  } catch (error) {
    console.error("Close request route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}