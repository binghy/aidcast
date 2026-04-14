import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Board API error:", error);
      return NextResponse.json(
        { error: error.message, entries: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    console.error("Board API unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected server error", entries: [] },
      { status: 500 }
    );
  }
}