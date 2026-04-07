import { NextRequest, NextResponse } from "next/server";
import { openrouter } from "@/lib/openrouter";
import { analyzeEntryText } from "@/lib/agent";

type AnalyzeResponse = {
  category: string;
  priority: "low" | "medium" | "high";
  summary: string;
  source: "llm" | "fallback";
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = String(body?.text || "").trim();

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    try {
      const model = process.env.OPENROUTER_MODEL || "openrouter/auto";

      const completion = await openrouter.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You classify mutual-aid entries for a Farcaster mini app. " +
              "Return ONLY valid JSON with keys: category, priority, summary. " +
              "Allowed categories: education, translation, design, coding, mentoring, logistics, other. " +
              "Allowed priorities: low, medium, high. " +
              "Summary must be short and clear in English.",
          },
          {
            role: "user",
            content: `Text: ${text}`,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);

      const result: AnalyzeResponse = {
        category: parsed.category ?? "other",
        priority: parsed.priority ?? "medium",
        summary: parsed.summary ?? text,
        source: "llm",
      };

      return NextResponse.json(result);
    } catch (llmError) {
      console.error("OpenRouter analyze failed, fallback:", llmError);

      const fallback = analyzeEntryText(text);

      return NextResponse.json({
        ...fallback,
        source: "fallback",
      } satisfies AnalyzeResponse);
    }
  } catch (error) {
    console.error("Analyze route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}