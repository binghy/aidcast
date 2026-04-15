import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { quickAuthClient } from "@/lib/quick-auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    console.log("Verified Quick Auth payload:", payload);

    const fid = Number(payload.sub);

    console.log("Resolved fid:", fid);

    if (!fid || Number.isNaN(fid)) {
      return NextResponse.json({ error: "Invalid fid" }, { status: 401 });
    }

    const body = await req.json();

    const {
      type,
      raw_text,
      category,
      priority,
      summary,
      support_mode,
      location_text,
    } = body;

    if (!type || (type !== "request" && type !== "offer")) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!raw_text || typeof raw_text !== "string") {
      return NextResponse.json({ error: "Invalid raw_text" }, { status: 400 });
    }

    const insertPayload = {
      fid,
      type,
      raw_text: raw_text.trim(),
      category: category || "other",
      priority: priority || "medium",
      summary: summary || raw_text.trim(),
      support_mode: support_mode || "online",
      location_text: location_text || null,
      status: "open",
    };

    const { data, error } = await supabase
      .from("entries")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Entries insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entry: data,
    });
  } catch (error) {
    console.error("Entries route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}