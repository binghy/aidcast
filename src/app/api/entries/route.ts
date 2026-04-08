import { NextRequest, NextResponse } from "next/server";
import { quickAuthClient } from "@/lib/quick-auth";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization");
    console.log("Authorization header present:", !!authorization);
    console.log("Authorization header prefix:", authorization?.slice(0, 20));

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401 }
      );
    }

    const token = authorization.split(" ")[1];

    const payload = await quickAuthClient.verifyJwt({
      token,
      domain: "aidcast.vercel.app",
    });

    console.log("Verified Quick Auth payload:", payload);

    const fid = Number(payload.sub);

    console.log("Resolved fid:", fid);

    const body = await req.json();

    const {
      type,
      raw_text,
      category,
      priority,
      summary,
      status,
      support_mode,
      location_text,
      username,
      display_name,
      pfp_url,
    } = body;

    const { error } = await supabase.from("entries").insert([
      {
        fid,
        username: username || null,
        display_name: display_name || null,
        pfp_url: pfp_url || null,
        type,
        raw_text,
        category,
        priority,
        summary,
        status,
        support_mode,
        location_text,
      },
    ]);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, fid });
  } catch (error) {
    console.error("Entries route error:", error);
    return NextResponse.json(
      { error: "Unauthorized or server error" },
      { status: 401 }
    );
  }
}