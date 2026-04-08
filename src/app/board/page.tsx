"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { findMatchesForRequest, ScoredMatch } from "@/lib/matching";
import Badge from "@/components/Badge";
import Card from "@/components/Card";

type Entry = {
  id: number;
  type: "request" | "offer";
  raw_text: string;
  category: string | null;
  priority: string | null;
  summary: string | null;
  status: string | null;
  created_at: string;
  support_mode: "online" | "in_person" | "both" | null;
  location_text: string | null;
};

function supportModeLabel(mode: string | null) {
  if (mode === "in_person") return "In person";
  if (mode === "both") return "Both";
  return "Online";
}

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
        .eq("status", "open")
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
    <main className="min-h-screen bg-zinc-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
        <div>
          <div className="mb-2">
            <a href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
              ← Back home
            </a>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Community Board
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Open requests and offers, ranked by AI.
          </p>
        </div>

        {loading && (
          <Card className="p-4">
            <p className="text-sm text-zinc-600">Loading...</p>
          </Card>
        )}

        {message && (
          <Card className="p-4">
            <p className="text-sm text-red-600">{message}</p>
          </Card>
        )}

        {!loading && entries.length === 0 && !message && (
          <Card className="p-5">
            <p className="text-sm text-zinc-600">No open entries yet.</p>
          </Card>
        )}

        {entries.map((entry) => (
          <Card key={entry.id} className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={entry.type === "request" ? "request" : "offer"}>
                  {entry.type}
                </Badge>
                <Badge variant={entry.priority as "high" | "medium" | "low"}>
                  {entry.priority || "priority"}
                </Badge>
                <Badge variant={entry.status === "open" ? "open" : "closed"}>
                  {entry.status || "unknown"}
                </Badge>
              </div>

              <span className="text-xs text-zinc-400">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>

            <p className="text-lg font-semibold leading-7 text-zinc-900">
              {entry.summary || entry.raw_text}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{entry.category || "other"}</Badge>
              <Badge>{supportModeLabel(entry.support_mode)}</Badge>
              {entry.location_text && <Badge>{entry.location_text}</Badge>}
            </div>

            {entry.type === "request" &&
              matches[entry.id] &&
              matches[entry.id].length > 0 && (
                <div className="mt-4 border-t border-zinc-200 pt-4">
                  <p className="mb-3 text-sm font-semibold text-zinc-800">
                    Best matches
                  </p>

                  <div className="space-y-3">
                    {matches[entry.id].map((m) => (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Badge variant="offer">offer</Badge>
                          <span className="text-xs font-medium text-zinc-500">
                            Score {m.matchScore}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-zinc-900">
                          {m.summary || m.raw_text}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge>{m.category || "other"}</Badge>
                          <Badge>{supportModeLabel(m.support_mode)}</Badge>
                          {m.location_text && <Badge>{m.location_text}</Badge>}
                        </div>

                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                          {m.matchReason}
                        </p>

                        <p className="mt-2 text-xs text-zinc-400">
                          {m.priority || "—"} • {m.scoreSource}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </Card>
        ))}
      </div>
    </main>
  );
}