"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";
import Card from "@/components/Card";

type SupportMode = "online" | "in_person" | "both";
type EntryType = "request" | "offer";

export default function SubmitPage() {
  const { context } = useMiniApp();

  const [type, setType] = useState<EntryType>("request");
  const [supportMode, setSupportMode] = useState<SupportMode>("online");
  const [locationText, setLocationText] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    sdk.actions.ready().catch(console.error);
  }, []);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setGeoMessage(
        "Geolocation is not supported in this context. You can still use the city text field."
      );
      return;
    }

    setGeoLoading(true);
    setGeoMessage("Detecting current location...");

    try {
      if ("permissions" in navigator && navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });

          if (permission.state === "denied") {
            setGeoMessage(
              "Location permission is denied in this context. You can still continue using the city text field."
            );
            setGeoLoading(false);
            return;
          }
        } catch (permError) {
          console.error("Permissions API check failed:", permError);
        }
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setGeoMessage(
            "Current coordinates saved successfully. Distance-based matching can now be used."
          );
          setGeoLoading(false);
        },
        (error) => {
          console.error("Geolocation error:", error);

          let nextMessage =
            "Could not retrieve current location in this app context. City-based fallback will still work.";

          if (error.code === error.PERMISSION_DENIED) {
            nextMessage =
              "Location permission was denied. City-based fallback will still work.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            nextMessage =
              "Current location is unavailable right now. City-based fallback will still work.";
          } else if (error.code === error.TIMEOUT) {
            nextMessage =
              "Location request timed out. City-based fallback will still work.";
          }

          setGeoMessage(nextMessage);
          setGeoLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        }
      );
    } catch (err) {
      console.error("Unexpected geolocation error:", err);
      setGeoMessage(
        "Could not access precise location here. You can still submit using the city text field."
      );
      setGeoLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setMessage("Please enter a description.");
      return;
    }

    if (!context?.user?.fid) {
      setMessage(
        "Open AIdCast inside Farcaster to submit authenticated requests and offers."
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      const analyzeJson = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setMessage(analyzeJson?.error || "Analysis failed.");
        setLoading(false);
        return;
      }

      const { category, priority, summary } = analyzeJson;

      const entriesRes = await sdk.quickAuth.fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          raw_text: text.trim(),
          category,
          priority,
          summary,
          support_mode: supportMode,
          location_text: locationText.trim() || null,
          latitude,
          longitude,
        }),
      });

      const entriesJson = await entriesRes.json();

      if (!entriesRes.ok) {
        setMessage(
          entriesJson?.error || "Unexpected error while saving entry."
        );
        setLoading(false);
        return;
      }

      setMessage("Saved successfully with LLM analysis.");
      setText("");
      setLocationText("");
      setType("request");
      setSupportMode("online");
      setLatitude(null);
      setLongitude(null);
      setGeoMessage("");
    } catch (err) {
      console.error("Submit error:", err);
      setMessage(
        err instanceof Error
          ? err.message
          : "Unexpected error while saving entry."
      );
    }

    setLoading(false);
  };

  const showGeoControls = supportMode === "in_person" || supportMode === "both";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-100 via-slate-50 to-violet-100 px-4 py-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[url('/og-image-v2.png')] bg-cover bg-center" />
      <div className="pointer-events-none absolute inset-0 bg-white/35" />

      <div className="relative mx-auto flex max-w-md flex-col gap-4">
        <a href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Back home
        </a>

        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
            Submit
          </h1>
          <p className="text-base leading-7 text-zinc-700">
            Create a request if you need help, or an offer if you can support
            someone.
          </p>
        </div>

        <Card className="rounded-3xl border border-black/15 bg-white/85 p-5 shadow-md backdrop-blur-md">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg font-medium text-zinc-900">Type</p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("request")}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    type === "request"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  Request
                </button>

                <button
                  type="button"
                  onClick={() => setType("offer")}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    type === "offer"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  Offer
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-lg font-medium text-zinc-900">Support mode</p>

              <div className="grid grid-cols-3 gap-2">
                {(["online", "in_person", "both"] as SupportMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSupportMode(mode)}
                      className={`rounded-2xl border px-3 py-3 text-sm font-medium capitalize transition ${
                        supportMode === mode
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-900"
                      }`}
                    >
                      {mode === "in_person" ? "In person" : mode}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-lg font-medium text-zinc-900">
                Location
              </label>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Example: Milan, Italy"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              />
              <p className="text-sm text-zinc-500">
                Optional text location. Useful for in-person support or hybrid requests.
              </p>
            </div>

            {showGeoControls && (
              <div className="space-y-3">
                <p className="text-lg font-medium text-zinc-900">
                  Precise location for object matching
                </p>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={geoLoading}
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {geoLoading ? "Detecting location..." : "Use current location"}
                </button>

                <p className="text-sm text-zinc-500">
                  If precise coordinates are unavailable, AIdCast will fall back to city-based matching.
                </p>

                {geoMessage && (
                  <p className="text-sm text-zinc-600">{geoMessage}</p>
                )}

                {latitude !== null && longitude !== null && (
                  <p className="text-xs text-zinc-500">
                    Coordinates saved: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-lg font-medium text-zinc-900">
                Description
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Example: I need help translating legal documents into English by tomorrow."
                rows={6}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-7 text-zinc-900 outline-none transition focus:border-zinc-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl border border-black bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit"}
            </button>

            {message && (
              <div className="rounded-2xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">
                {message}
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}