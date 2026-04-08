import type { Metadata } from "next";
import Link from "next/link";
import Card from "@/components/Card";

export const metadata: Metadata = {
  title: "AIdCast",
  description:
    "AI-powered mutual aid app connecting people who need help with those who can offer it",
  openGraph: {
    title: "AIdCast",
    description:
      "AI-powered mutual aid app connecting people who need help with those who can offer it",
    images: ["https://aidcast.vercel.app/og-image.png"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://aidcast.vercel.app/og-image.png",
      button: {
        title: "Open AIdCast",
        action: {
          type: "launch_miniapp",
          url: "https://aidcast.vercel.app",
          name: "AIdCast",
          splashImageUrl: "https://aidcast.vercel.app/splash.png",
          splashBackgroundColor: "#ffffff",
        },
      },
    }),
  },
};

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-100 via-white to-violet-100 px-4 py-6">
      <div className="pointer-events-none absolute inset-0 opacity-10 bg-[url('/og-image.png')] bg-cover bg-center" />

      <div className="relative mx-auto flex max-w-md flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-bold text-white shadow-lg">
            AId
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
              AIdCast
            </h1>
            <p className="text-sm leading-6 text-zinc-700">
              AI-powered mutual aid app connecting people who need help with those
              who can offer it.
            </p>
          </div>
        </div>

        <Card className="p-5">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-zinc-900">
              How it works
            </h2>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>Post a request or offer support</li>
              <li>AI classifies and ranks relevant matches</li>
              <li>Connect faster with the right people</li>
            </ul>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3">
          <a
            href="/submit"
            className="inline-flex items-center justify-center rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
          >
            Create Request or Offer
          </a>

          <a
            href="/board"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white/90 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
          >
            View Community Board
          </a>
        </div>
      </div>
    </main>
  );
}