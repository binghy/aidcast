import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanupLifecycleState } from "@/lib/lifecycle";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET() {
  try {
    await cleanupLifecycleState();

    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Board route fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
    });
  } catch (error) {
    console.error("Board route unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}