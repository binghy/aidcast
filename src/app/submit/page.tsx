"use client";

import { useEffect, useMemo, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useMiniApp } from "@neynar/react";
import Card from "@/components/Card";

type SupportMode = "online" | "in_person" | "both";
type EntryType = "request" | "offer";
type EntryKind = "service" | "object";

export default function SubmitPage() {
  const { context } = useMiniApp();

  const [type, setType] = useState<EntryType>("request");
  const [entryKind, setEntryKind] = useState<EntryKind>("service");
  const [supportMode, setSupportMode] = useState<SupportMode>("online");
  const [locationText, setLocationText] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    sdk.actions.ready().catch(console.error);
  }, []);

  useEffect(() => {
    if (entryKind === "object") {
      setSupportMode("in_person");
    }
  }, [entryKind]);

  const descriptionPlaceholder = useMemo(() => {
    if (entryKind === "object" && type === "request") {
      return "Example: I need to borrow a drill for one day.";
    }

    if (entryKind === "object" && type === "offer") {
      return "Example: I can lend a drill in Rome this week.";
    }

    if (entryKind === "service" && type === "request") {
      return "Example: I need help reviewing a legal document by tomorrow.";
    }

    return "Example: I can help with legal document review online.";
  }, [entryKind, type]);

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

    if (entryKind === "object" && !locationText.trim()) {
      setMessage("Please enter a city for object exchanges.");
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
        body: JSON.stringify({
          text: text.trim(),
          entryKind,
        }),
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
          support_mode: entryKind === "object" ? "in_person" : supportMode,
          location_text: locationText.trim() || null,
          entry_kind: entryKind,
          username: context.user.username ?? null,
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
      setEntryKind("service");
      setSupportMode("online");
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

  const isObject = entryKind === "object";

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
              <p className="text-lg font-medium text-zinc-900">
                What is this about?
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryKind("service")}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    entryKind === "service"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  Service
                </button>

                <button
                  type="button"
                  onClick={() => setEntryKind("object")}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    entryKind === "object"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  Object
                </button>
              </div>

              <p className="text-sm text-zinc-500">
                Services include tutoring, review, translation, mentoring, or
                legal/coding help. Objects include tools, equipment, and
                physical items to lend, borrow, or give.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-lg font-medium text-zinc-900">Support mode</p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => !isObject && setSupportMode("online")}
                  disabled={isObject}
                  className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                    supportMode === "online" && !isObject
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  } ${isObject ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  Online
                </button>

                <button
                  type="button"
                  onClick={() => setSupportMode("in_person")}
                  className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                    supportMode === "in_person"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  }`}
                >
                  In person
                </button>

                <button
                  type="button"
                  onClick={() => !isObject && setSupportMode("both")}
                  disabled={isObject}
                  className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                    supportMode === "both" && !isObject
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 bg-white text-zinc-900"
                  } ${isObject ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  Both
                </button>
              </div>

              {isObject && (
                <p className="text-sm text-zinc-500">
                  Physical objects and tools are currently matched only in
                  person.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-lg font-medium text-zinc-900">
                Location
              </label>
              <input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Example: Rome, Italy"
                className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
              />
              <p className="text-sm text-zinc-500">
                {isObject
                  ? "Required for object exchanges. Use a city such as Rome, Italy."
                  : "Optional. Useful for in-person support or hybrid requests."}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-lg font-medium text-zinc-900">
                Description
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={descriptionPlaceholder}
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