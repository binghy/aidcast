"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { findMatchesForRequest, ScoredMatch } from "@/lib/matching";

type Entry = {
  id: number;
  type: "request" | "offer";
  raw_text: string;
  category: string | null;
  priority: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
};

export default function BoardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<Record<number, ScoredMatch[]>>({});

  useEffect(() => {
    const fetchEntries = async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Board fetch error:", error);
        setMessage(`Error loading entries: ${error.message}`);
        setLoading(false);
        return;
      }

      const entriesData = (data || []) as Entry[];
      setEntries(entriesData);

      const matchMap: Record<number, ScoredMatch[]> = {};

      for (const entry of entriesData) {
        if (entry.type === "request" && entry.category) {
          const offers = await findMatchesForRequest(entry, 3);
          matchMap[entry.id] = offers;
        }
      }

      setMatches(matchMap);
      setLoading(false);
    };

    fetchEntries();
  }, []);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Board</h1>

      {loading && <p>Loading...</p>}
      {message && <p className="mb-4 text-red-600">{message}</p>}
      {!loading && entries.length === 0 && !message && <p>No entries yet.</p>}

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm px-2 py-1 rounded border">
                {entry.type}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>

            <p className="mb-2 font-medium">
              {entry.summary || entry.raw_text}
            </p>

            <div className="flex gap-2 text-sm text-gray-600 flex-wrap">
              <span>Category: {entry.category || "—"}</span>
              <span>Priority: {entry.priority || "—"}</span>
              <span>Status: {entry.status || "—"}</span>
            </div>

            {entry.type === "request" &&
              matches[entry.id] &&
              matches[entry.id].length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <p className="text-sm font-medium mb-2">Matches:</p>

                  <ul className="text-sm space-y-2">
                    {matches[entry.id].map((m) => (
                      <li key={m.id} className="border rounded p-2">
                        <div className="text-xs text-gray-500 mb-1">offer</div>

                        <div className="font-medium">
                          {m.summary || m.raw_text}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          Score: {m.matchScore}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          Reason: {m.matchReason}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          Source: {m.scoreSource}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          {m.category || "—"} • {m.priority || "—"} •{" "}
                          {new Date(m.created_at).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        ))}
      </div>
    </main>
  );
}