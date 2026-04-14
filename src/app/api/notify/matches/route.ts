import { NextResponse } from "next/server";
import { recomputeMatchNotifications } from "@/lib/recompute-match-notifications";

export async function POST() {
  try {
    const result = await recomputeMatchNotifications();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Notify matches route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}