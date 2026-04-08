"use client";

import { useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";
import Card from "@/components/Card";

type AnalysisResult = {
  category: string;
  priority: "low" | "medium" | "high";
  summary: string;
  source: "llm" | "fallback";
};

export default function SubmitPage() {
  const { context } = useMiniApp();

  const [text, setText] = useState("");
  const [type, setType] = useState<"request" | "offer">("request");
  const [supportMode, setSupportMode] = useState<"online" | "in_person" | "both">("online");
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) {
      setMessage("Please enter a description.");
      return;
    }

     if (!context?.user?.fid) {
        setMessage("Open AIdCast inside Farcaster to submit authenticated requests and offers.");
        return;
     }

    try {
      setLoading(true);
      setMessage("");

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!analyzeRes.ok) {
        throw new Error("Failed to analyze entry");
      }

      const analysis = (await analyzeRes.json()) as AnalysisResult;
      console.log("Mini app context user:", context?.user);
      console.log("About to call sdk.quickAuth.fetch");

      const saveRes = await sdk.quickAuth.fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          raw_text: text.trim(),
          category: analysis.category,
          priority: analysis.priority,
          summary: analysis.summary,
          status: "open",
          support_mode: supportMode,
          location_text: locationText.trim() || null,
          username: context?.user?.username || null,
          display_name: context?.user?.displayName || null,
          pfp_url: context?.user?.pfpUrl || null,
        }),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => null);
        throw new Error(err?.error || "Failed to save entry");
      }

      setMessage(`Saved successfully with ${analysis.source.toUpperCase()} analysis.`);
      setText("");
      setType("request");
      setSupportMode("online");
      setLocationText("");
    } catch (err) {
    console.error("Submit error:", err);
    setMessage(
        err instanceof Error ? err.message : "Unexpected error while saving entry."
    );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-violet-50 px-4 py-6">
      <div className="pointer-events-none absolute inset-0 opacity-5 bg-[url('/splash.png')] bg-cover bg-center" />
      <div className="relative mx-auto max-w-md">
        <div className="mb-5">
          <div className="mb-2">
            <a href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
              ← Back home
            </a>
          </div>

          <h1 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            Submit
          </h1>
          <p className="mt-2 text-center text-sm text-zinc-600">
            Create a request if you need help, or an offer if you can support someone.
          </p>
        </div>

        <Card className="p-5 shadow-xl">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("request")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium border transition ${
                    type === "request"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-zinc-800 border-zinc-300"
                  }`}
                >
                  Request
                </button>
                <button
                  type="button"
                  onClick={() => setType("offer")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium border transition ${
                    type === "offer"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-zinc-800 border-zinc-300"
                  }`}
                >
                  Offer
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Support mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["online", "in_person", "both"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSupportMode(mode as "online" | "in_person" | "both")}
                    className={`rounded-xl px-3 py-3 text-sm font-medium border transition ${
                      supportMode === mode
                        ? "bg-zinc-900 text-white border-zinc-900"
                        : "bg-white text-zinc-800 border-zinc-300"
                    }`}
                  >
                    {mode === "online"
                      ? "Online"
                      : mode === "in_person"
                      ? "In person"
                      : "Both"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Location
              </label>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Example: Milan, Italy"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 outline-none"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Optional. Useful for in-person support or hybrid requests.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Description
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  type === "request"
                    ? "Example: I need help translating legal documents into English by tomorrow."
                    : "Example: I can help with React and Next.js development."
                }
                className="min-h-[160px] w-full rounded-2xl border border-zinc-300 bg-white p-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Submit"}
            </button>

            {message && (
              <div className="rounded-xl bg-zinc-100 px-3 py-3 text-sm text-zinc-700">
                {message}
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}