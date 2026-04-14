import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  ParseWebhookEvent,
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  const requestJson = await request.json();

  console.log("Webhook raw envelope:", JSON.stringify(requestJson, null, 2));

  let data: Awaited<ReturnType<typeof parseWebhookEvent>>;

  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;
    console.error("Webhook verification error:", error);

    switch (error.name) {
      case "VerifyJsonFarcasterSignature.InvalidDataError":
      case "VerifyJsonFarcasterSignature.InvalidEventDataError":
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        );

      case "VerifyJsonFarcasterSignature.InvalidAppKeyError":
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 401 }
        );

      case "VerifyJsonFarcasterSignature.VerifyAppKeyError":
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );

      default:
        return NextResponse.json(
          { success: false, error: "Unknown webhook verification error" },
          { status: 500 }
        );
    }
  }

  console.log("Verified webhook event:", JSON.stringify(data, null, 2));

  const fid = data.fid;
  const event = data.event;

  console.log("Verified fid:", fid);
  console.log("Verified event name:", event.event);

  switch (event.event) {
    case "miniapp_added": {
      if (event.notificationDetails) {
        console.log("Saving notification details:", event.notificationDetails);

        const { data: existing, error: selectError } = await supabase
          .from("notification_subscriptions")
          .select("id")
          .eq("fid", fid)
          .eq("notification_token", event.notificationDetails.token)
          .maybeSingle();

        if (selectError) {
          console.error("Webhook select error:", selectError);
          return NextResponse.json(
            { success: false, error: selectError.message },
            { status: 400 }
          );
        }

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("notification_subscriptions")
            .update({
              notification_url: event.notificationDetails.url,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Webhook update error:", updateError);
            return NextResponse.json(
              { success: false, error: updateError.message },
              { status: 400 }
            );
          }
        } else {
          const { error: insertError } = await supabase
            .from("notification_subscriptions")
            .insert([
              {
                fid,
                notification_token: event.notificationDetails.token,
                notification_url: event.notificationDetails.url,
                is_active: true,
                updated_at: new Date().toISOString(),
              },
            ]);

          if (insertError) {
            console.error("Webhook insert error:", insertError);
            return NextResponse.json(
              { success: false, error: insertError.message },
              { status: 400 }
            );
          }
        }
      } else {
        // App aggiunta ma senza notifiche abilitate/token disponibile
        const { error: disableError } = await supabase
          .from("notification_subscriptions")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("fid", fid);

        if (disableError) {
          console.error("Webhook disable-on-add error:", disableError);
        }
      }

      break;
    }

    case "miniapp_removed": {
      const { error: disableError } = await supabase
        .from("notification_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("fid", fid);

      if (disableError) {
        console.error("Webhook disable error:", disableError);
      }

      break;
    }

    case "notifications_enabled": {
      const { data: existing, error: selectError } = await supabase
        .from("notification_subscriptions")
        .select("id")
        .eq("fid", fid)
        .eq("notification_token", event.notificationDetails.token)
        .maybeSingle();

      if (selectError) {
        console.error("Webhook select error:", selectError);
        return NextResponse.json(
          { success: false, error: selectError.message },
          { status: 400 }
        );
      }

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("notification_subscriptions")
          .update({
            notification_url: event.notificationDetails.url,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Webhook update error:", updateError);
          return NextResponse.json(
            { success: false, error: updateError.message },
            { status: 400 }
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from("notification_subscriptions")
          .insert([
            {
              fid,
              notification_token: event.notificationDetails.token,
              notification_url: event.notificationDetails.url,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error("Webhook insert error:", insertError);
          return NextResponse.json(
            { success: false, error: insertError.message },
            { status: 400 }
          );
        }
      }

      break;
    }

    case "notifications_disabled": {
      const { error: disableError } = await supabase
        .from("notification_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("fid", fid);

      if (disableError) {
        console.error("Webhook disable error:", disableError);
      }

      break;
    }
  }

  return NextResponse.json({ success: true });
}