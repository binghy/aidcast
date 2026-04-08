import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Webhook body:", body);

    // Adattiamo il parser in modo tollerante perché gli eventi possono variare.
    // Cerchiamo fid, token e url nei campi più probabili.
    const fid =
      body?.fid ??
      body?.user?.fid ??
      body?.data?.fid ??
      body?.payload?.fid ??
      null;

    const notificationToken =
      body?.token ??
      body?.notificationToken ??
      body?.data?.token ??
      body?.payload?.token ??
      null;

    const notificationUrl =
      body?.url ??
      body?.notificationUrl ??
      body?.data?.url ??
      body?.payload?.url ??
      null;

    const client =
      body?.client ??
      body?.data?.client ??
      body?.payload?.client ??
      null;

    // Se riceviamo dati validi, li salviamo/upsertiamo
    if (fid && notificationToken && notificationUrl) {
      const { error } = await supabase
        .from("notification_subscriptions")
        .upsert(
          [
            {
              fid: Number(fid),
              notification_token: notificationToken,
              notification_url: notificationUrl,
              client,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: "fid,notification_token",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.error("Webhook save error:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // Se il client segnala disattivazione, si può marcare inactive
    const disabledFid =
      body?.disabled?.fid ??
      body?.data?.disabled?.fid ??
      body?.payload?.disabled?.fid ??
      null;

    if (disabledFid) {
      await supabase
        .from("notification_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("fid", Number(disabledFid));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}