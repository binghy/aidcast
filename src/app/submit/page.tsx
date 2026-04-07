"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

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

      setMessage(`Entry analyzed with ${analysis.source} and saved successfully.`);
      setText("");
      setType("request");
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage("Unexpected error while saving entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Submit</h1>

      <div className="mb-4">
        <label className="block mb-2 font-medium">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "request" | "offer")}
          className="border p-2 rounded w-full"
        >
          <option value="request">Request</option>
          <option value="offer">Offer</option>
        </select>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your request or offer..."
        className="w-full border p-3 rounded mb-4 min-h-[140px]"
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Submit"}
      </button>

      {message && <p className="mt-4">{message}</p>}
    </main>
  );
}