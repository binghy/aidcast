"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Card from "@/components/Card";

type AnalysisResult = {
  category: string;
  priority: "low" | "medium" | "high";
  summary: string;
  source: "llm" | "fallback";
};

export default function SubmitPage() {
  const [text, setText] = useState("");
  const [type, setType] = useState<"request" | "offer">("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) {
      setMessage("Please enter a description.");
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

      const { error } = await supabase.from("entries").insert([
        {
          type,
          raw_text: text.trim(),
          category: analysis.category,
          priority: analysis.priority,
          summary: analysis.summary,
          status: "open",
        },
      ]);

      if (error) {
        setMessage(`Error saving entry: ${error.message}`);
        return;
      }

      setMessage(`Saved successfully with ${analysis.source.toUpperCase()} analysis.`);
      setText("");
      setType("request");
    } catch (err) {
      console.error(err);
      setMessage("Unexpected error while saving entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Submit
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Create a request if you need help, or an offer if you can support someone.
          </p>
        </div>

        <Card className="p-5">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-800">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("request")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium border ${
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
                  className={`rounded-xl px-4 py-3 text-sm font-medium border ${
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
                className="min-h-[160px] w-full rounded-2xl border border-zinc-300 bg-white p-4 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-400"
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