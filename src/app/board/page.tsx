"use client";

import { useEffect, useState } from "react";
import { findMatchesForRequest, ScoredMatch } from "@/lib/matching";
import Card from "@/components/Card";
import Badge from "@/components/Badge";

type Entry = {
  id: number;
  fid: number | null;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
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

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function typeBadgeClass(type: Entry["type"]) {
  return type === "request"
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-violet-100 text-violet-700 border-violet-200";
}

function priorityBadgeClass(priority: string | null) {
  if (priority === "high") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "medium") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  return "bg-sky-100 text-sky-700 border-sky-200";
}

function statusBadgeClass(status: string | null) {
  if (status === "closed") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function entrySortScore(
  entry: Entry,
  matchesMap: Record<number, ScoredMatch[]>
) {
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
  const [matchesMap, setMatchesMap] = useState<Record<number, ScoredMatch[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchEntries() {
      setLoading(true);
      setErrorMessage("");

      try {
        const res = await fetch("/api/board", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Board fetch failed with status ${res.status}`);
        }

        const json = await res.json();
        const fetchedEntries = (json?.entries || []) as Entry[];

        if (!isMounted) return;

        const requestEntries = fetchedEntries.filter(
          (e) => e.type === "request" && e.status === "open"
        );

        const settled = await Promise.allSettled(
          requestEntries.map(async (request) => {
            const matches = await findMatchesForRequest(request, 3);
            return { requestId: request.id, matches };
          })
        );

        if (!isMounted) return;

        const nextMatchesMap: Record<number, ScoredMatch[]> = {};

        for (const result of settled) {
          if (result.status === "fulfilled") {
            nextMatchesMap[result.value.requestId] = result.value.matches;
          } else {
            console.error("Board match computation error:", result.reason);
          }
        }

        const sortedEntries = [...fetchedEntries].sort((a, b) => {
          const aGroup = entrySortScore(a, nextMatchesMap);
          const bGroup = entrySortScore(b, nextMatchesMap);

          if (aGroup !== bGroup) return aGroup - bGroup;

          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();

          return bTime - aTime;
        });

        setEntries(sortedEntries);
        setMatchesMap(nextMatchesMap);
      } catch (error) {
        console.error("Board page error:", error);

        if (!isMounted) return;

        setEntries([]);
        setMatchesMap({});
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unexpected error while loading the board."
        );
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchEntries();

    return () => {
      isMounted = false;
    };
  }, []);

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
            Community Board
          </h1>
          <p className="text-base leading-7 text-zinc-700">
            Open requests and offers, ranked by AI and enriched with support mode
            and location.
          </p>
        </div>

        {loading ? (
          <Card className="rounded-3xl border border-black/15 bg-white/85 p-5 shadow-md backdrop-blur-md">
            <p className="text-sm text-zinc-600">Loading board...</p>
          </Card>
        ) : errorMessage ? (
          <Card className="rounded-3xl border border-red-200 bg-red-50/90 p-5 shadow-md backdrop-blur-md">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </Card>
        ) : entries.length === 0 ? (
          <Card className="rounded-3xl border border-black/15 bg-white/85 p-5 shadow-md backdrop-blur-md">
            <p className="text-sm text-zinc-600">No open entries yet.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <Card
                key={entry.id}
                className="rounded-3xl border border-black/15 bg-white/85 p-5 shadow-md backdrop-blur-md"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${typeBadgeClass(
                          entry.type
                        )}`}
                      >
                        {entry.type}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${priorityBadgeClass(
                          entry.priority
                        )}`}
                      >
                        {entry.priority || "medium"}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                          entry.status
                        )}`}
                      >
                        {entry.status || "open"}
                      </span>
                    </div>

                    <span className="text-xs text-zinc-500">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold leading-8 text-zinc-950">
                      {entry.summary || entry.raw_text}
                    </h2>

                    <div className="flex flex-wrap gap-2">
                      {entry.category && <Badge>{entry.category}</Badge>}

                      {entry.support_mode && (
                        <Badge>
                          {entry.support_mode === "in_person"
                            ? "In person"
                            : entry.support_mode}
                        </Badge>
                      )}

                      {entry.location_text && <Badge>{entry.location_text}</Badge>}
                    </div>
                  </div>

                  {entry.type === "request" &&
                    entry.status === "open" &&
                    matchesMap[entry.id] &&
                    matchesMap[entry.id].length > 0 && (
                      <div className="space-y-3 border-t border-black/10 pt-4">
                        <h3 className="text-sm font-semibold text-zinc-900">
                          Best matches
                        </h3>

                        <div className="space-y-3">
                          {matchesMap[entry.id].map((match) => (
                            <div
                              key={match.id}
                              className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3"
                            >
                              <div className="mb-2 flex items-start justify-between gap-3">
                                <span className="rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                                  offer
                                </span>
                                <span className="text-xs font-medium text-zinc-600">
                                  Score {match.matchScore}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <p className="text-base font-medium leading-7 text-zinc-950">
                                  {match.summary || match.raw_text}
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {match.category && <Badge>{match.category}</Badge>}
                                  {match.support_mode && (
                                    <Badge>
                                      {match.support_mode === "in_person"
                                        ? "In person"
                                        : match.support_mode}
                                    </Badge>
                                  )}
                                  {match.location_text && (
                                    <Badge>{match.location_text}</Badge>
                                  )}
                                </div>

                                <p className="text-xs leading-6 text-zinc-600">
                                  {match.matchReason}
                                </p>

                                <p className="text-xs text-zinc-500">
                                  {(match.priority || "low") +
                                    " • " +
                                    match.scoreSource}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}