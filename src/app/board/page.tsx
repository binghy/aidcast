"use client";

import { useEffect, useState } from "react";
import { findMatchesForRequest, ScoredMatch } from "@/lib/matching";

type Entry = {
  id: number;
  type: "request" | "offer";
  raw_text: string;
  summary: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  created_at: string;
  support_mode: "online" | "in_person" | "both" | null;
  location_text: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function entrySortScore(entry: Entry, matchesMap: Record<number, ScoredMatch[]>) {
  const isOpen = entry.status === "open";
  const isRequest = entry.type === "request";
  const hasMatches = isRequest && (matchesMap[entry.id]?.length || 0) > 0;

  if (isOpen && isRequest && hasMatches) return 0;
  if (isOpen && isRequest) return 1;
  if (isOpen && entry.type === "offer") return 2;
  return 3;
}

export default function BoardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matchesMap, setMatchesMap] = useState<Record<number, ScoredMatch[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/board", { cache: "no-store" });
        const json = await res.json();

        const fetchedEntries = json.entries || [];

        const requests = fetchedEntries.filter(
          (e: Entry) => e.type === "request" && e.status === "open"
        );

        const map: Record<number, ScoredMatch[]> = {};

        for (const req of requests) {
          try {
            const matches = await findMatchesForRequest(req, 3);
            map[req.id] = matches;
          } catch (e) {
            console.error("match error", e);
          }
        }

        const sorted = [...fetchedEntries].sort((a, b) => {
          const gA = entrySortScore(a, map);
          const gB = entrySortScore(b, map);

          if (gA !== gB) return gA - gB;

          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setEntries(sorted);
        setMatchesMap(map);
      } catch (err) {
        console.error("board error", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Community Board</h1>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="border rounded-lg p-3 bg-white">
            {/* HEADER */}
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{entry.type}</span>
              <span>{formatDate(entry.created_at)}</span>
            </div>

            {/* TITLE */}
            <div className="text-base font-medium">
              {entry.summary || entry.raw_text}
            </div>

            {/* TAGS */}
            <div className="flex flex-wrap gap-1 text-xs text-gray-600 mt-1">
              {entry.category && <span>{entry.category}</span>}
              {entry.support_mode && <span>{entry.support_mode}</span>}
              {entry.location_text && <span>{entry.location_text}</span>}
            </div>

            {/* MATCHES */}
            {entry.type === "request" &&
              matchesMap[entry.id] &&
              matchesMap[entry.id].length > 0 && (
                <div className="mt-3 pt-2 border-t">
                  <div className="text-sm font-medium mb-2">
                    Best matches
                  </div>

                  <div className="space-y-2">
                    {matchesMap[entry.id].map((m) => (
                      <div
                        key={m.id}
                        className="border rounded-md p-2 bg-gray-50"
                      >
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>offer</span>
                          <span>{m.matchScore}</span>
                        </div>

                        <div className="text-sm font-medium">
                          {m.summary || m.raw_text}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          {m.matchReason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ))}
      </div>
    </main>
  );
}