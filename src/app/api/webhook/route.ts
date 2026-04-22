import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// const neynarApiKey = process.env.NEYNAR_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

type NotificationDetails = {
  token?: string;
  url?: string;
};

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extractFid(data: unknown): number | null {
  const root = getObject(data);
  if (!root) return null;

  const rootFid = getNumber(root["fid"]);
  if (rootFid !== null) return rootFid;

  const user = getObject(root["user"]);
  const userFid = getNumber(user?.["fid"]);
  if (userFid !== null) return userFid;

  const eventObj = getObject(root["event"]);
  const eventFid = getNumber(eventObj?.["fid"]);
  if (eventFid !== null) return eventFid;

  return null;
}

function extractEventName(data: unknown): string | null {
  const root = getObject(data);
  if (!root) return null;

  const directEvent = getString(root["event"]);
  if (directEvent) return directEvent;

  const eventObj = getObject(root["event"]);
  const nestedEvent = getString(eventObj?.["event"]);
  if (nestedEvent) return nestedEvent;

  return null;
}

function extractNotificationDetails(data: unknown): NotificationDetails | null {
  const root = getObject(data);
  if (!root) return null;

  const direct = getObject(root["notificationDetails"]);
  const directToken = getString(direct?.["token"]);
  const directUrl = getString(direct?.["url"]);

  if (directToken || directUrl) {
    return {
      token: directToken ?? undefined,
      url: directUrl ?? undefined,
    };
  }

  const eventObj = getObject(root["event"]);
  const nested = getObject(eventObj?.["notificationDetails"]);
  const nestedToken = getString(nested?.["token"]);
  const nestedUrl = getString(nested?.["url"]);

  if (nestedToken || nestedUrl) {
    return {
      token: nestedToken ?? undefined,
      url: nestedUrl ?? undefined,
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const requestJson = await req.json();

    console.log("Webhook raw envelope:", JSON.stringify(requestJson, null, 2));

    const verified = await parseWebhookEvent(
      requestJson,
      verifyAppKeyWithNeynar
    );

    console.log("Verified webhook event:", JSON.stringify(verified, null, 2));

    const fid = extractFid(verified);
    const eventName = extractEventName(verified);
    const notificationDetails = extractNotificationDetails(verified);

    console.log("Verified fid:", fid);
    console.log("Verified event name:", eventName);
    console.log("Webhook notificationDetails:", notificationDetails);

    if (!fid || !eventName) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "Missing fid or event name",
      });
    }

    if (eventName === "miniapp_added" || eventName === "frame_added") {
      if (notificationDetails?.token && notificationDetails?.url) {
        const { error } = await supabase
          .from("notification_subscriptions")
          .upsert(
            {
              fid,
              notification_token: notificationDetails.token,
              notification_url: notificationDetails.url,
              client: "farcaster",
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "fid" }
          );

        if (error) {
          console.error("Webhook insert error:", error);
          return NextResponse.json(
            { error: error.message },
            { status: 500 }
          );
        }
      } else {
        console.log("No notificationDetails present on add event");
      }
    }

    if (eventName === "miniapp_removed" || eventName === "frame_removed") {
      const { error } = await supabase
        .from("notification_subscriptions")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("fid", fid);

      if (error) {
        console.error("Webhook deactivate error:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook route unexpected error:", error);
    return NextResponse.json(
      { error: "Unexpected webhook error" },
      { status: 500 }
    );
  }
}