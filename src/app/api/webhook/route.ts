import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("Webhook raw envelope:", JSON.stringify(body, null, 2));

    const header = body?.header;
    const payloadEncoded = body?.payload;
    const signature = body?.signature;

    if (!header || !payloadEncoded || !signature) {
      return NextResponse.json(
        { error: "Invalid webhook envelope" },
        { status: 400 }
      );
    }

    const decodedPayloadString = decodeBase64Url(payloadEncoded);
    const payload = JSON.parse(decodedPayloadString);

    console.log("Webhook decoded payload:", JSON.stringify(payload, null, 2));
    console.log("Webhook eventType:", payload?.event);
    console.log(
      "Webhook fid candidates:",
      payload?.fid,
      payload?.user?.fid,
      payload?.data?.fid
    );
    console.log("Webhook notificationDetails:", payload?.notificationDetails);

    const eventType =
      payload?.event ||
      payload?.type ||
      payload?.eventType ||
      null;

    const fid =
      payload?.fid ??
      payload?.user?.fid ??
      payload?.data?.fid ??
      null;

    const notificationDetails =
      payload?.notificationDetails ??
      payload?.data?.notificationDetails ??
      null;

    const token =
      notificationDetails?.token ??
      payload?.token ??
      null;

    const url =
      notificationDetails?.url ??
      payload?.url ??
      null;

    const client =
      payload?.client ??
      payload?.data?.client ??
      null;

    if (
      (
        eventType === "miniapp_added" ||
        eventType === "notifications_enabled" ||
        eventType === "frame_added"
      ) &&
      fid &&
      token &&
      url
    ) {
      const { data: existing, error: selectError } = await supabase
        .from("notification_subscriptions")
        .select("id")
        .eq("fid", Number(fid))
        .eq("notification_token", token)
        .maybeSingle();

      if (selectError) {
        console.error("Webhook select error:", selectError);
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("notification_subscriptions")
          .update({
            notification_url: url,
            client,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Webhook update error:", updateError);
          return NextResponse.json(
            { error: updateError.message },
            { status: 400 }
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from("notification_subscriptions")
          .insert([
            {
              fid: Number(fid),
              notification_token: token,
              notification_url: url,
              client,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error("Webhook insert error:", insertError);
          return NextResponse.json(
            { error: insertError.message },
            { status: 400 }
          );
        }
      }
    }

    if (
      eventType === "miniapp_removed" ||
      eventType === "notifications_disabled" ||
      eventType === "frame_removed"
    ) {
      if (fid) {
        const { error: disableError } = await supabase
          .from("notification_subscriptions")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("fid", Number(fid));

        if (disableError) {
          console.error("Webhook disable error:", disableError);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}