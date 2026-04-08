import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type SendNotificationArgs = {
  fid: number;
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
};

export async function sendNotificationToFid({
  fid,
  notificationId,
  title,
  body,
  targetUrl,
}: SendNotificationArgs) {
  const { data, error } = await supabase
    .from("notification_subscriptions")
    .select("*")
    .eq("fid", fid)
    .eq("is_active", true);

  if (error) {
    console.error("Notification lookup error:", error);
    return;
  }

  const subscriptions = data || [];

  for (const sub of subscriptions) {
    try {
      const res = await fetch(sub.notification_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sub.notification_token}`,
        },
        body: JSON.stringify({
          notificationId,
          title,
          body,
          targetUrl,
          tokens: [sub.notification_token],
        }),
      });

      const json = await res.json().catch(() => null);
      console.log("Notification send response:", json);

      if (!res.ok) {
        console.error("Notification send failed:", res.status, json);
      }
    } catch (err) {
      console.error("Notification fetch error:", err);
    }
  }
}