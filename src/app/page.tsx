import type { Metadata } from "next";
import HomeClient from "@/components/HomeClient";

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

export default function Page() {
  return <HomeClient />;
}