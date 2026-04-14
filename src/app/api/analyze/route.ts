import { NextRequest, NextResponse } from "next/server";

type AnalyzeResult = {
  category: string;
  priority: "low" | "medium" | "high";
  summary: string;
  source: "llm" | "fallback";
};

function normalizeCategory(rawCategory: string, text: string) {
  const t = text.toLowerCase();
  const category = (rawCategory || "").toLowerCase().trim();

  const logisticsKeywords = [
    "drill",
    "screwdriver",
    "hammer",
    "ladder",
    "tool",
    "tools",
    "wrench",
    "saw",
    "borrow",
    "lend",
    "loan",
    "rent",
    "equipment",
    "tripod",
    "bike pump",
    "bicycle pump",
  ];

  if (logisticsKeywords.some((kw) => t.includes(kw))) {
    return "logistics";
  }

  if (category === "translation") return "translation";
  if (category === "mentoring") return "mentoring";
  if (category === "coding") return "coding";
  if (category === "legal") return "legal";
  if (category === "logistics") return "logistics";

  return "other";
}

function fallbackAnalyze(text: string): AnalyzeResult {
  const t = text.toLowerCase();

  let category = "other";

  if (
    t.includes("translate") ||
    t.includes("translation") ||
    t.includes("document review in english") ||
    t.includes("localization")
  ) {
    category = "translation";
  } else if (
    t.includes("mentor") ||
    t.includes("mentoring") ||
    t.includes("cv") ||
    t.includes("resume") ||
    t.includes("math") ||
    t.includes("tutor") ||
    t.includes("teaching")
  ) {
    category = "mentoring";
  } else if (
    t.includes("react") ||
    t.includes("next.js") ||
    t.includes("nextjs") ||
    t.includes("javascript") ||
    t.includes("typescript") ||
    t.includes("coding") ||
    t.includes("developer")
  ) {
    category = "coding";
  } else if (
    t.includes("legal") ||
    t.includes("contract") ||
    t.includes("lawyer") ||
    t.includes("agreement")
  ) {
    category = "legal";
  } else if (
    t.includes("drill") ||
    t.includes("tool") ||
    t.includes("tools") ||
    t.includes("screwdriver") ||
    t.includes("hammer") ||
    t.includes("ladder") ||
    t.includes("wrench") ||
    t.includes("rent") ||
    t.includes("borrow") ||
    t.includes("lend") ||
    t.includes("loan") ||
    t.includes("equipment")
  ) {
    category = "logistics";
  }

  let priority: "low" | "medium" | "high" = "medium";

  if (
    t.includes("urgent") ||
    t.includes("immediately") ||
    t.includes("right now") ||
    t.includes("today") ||
    t.includes("asap") ||
    t.includes("tomorrow")
  ) {
    priority = "high";
  } else if (
    t.includes("whenever") ||
    t.includes("no rush") ||
    t.includes("eventually")
  ) {
    priority = "low";
  }

  const summary =
    text.length > 60 ? `${text.slice(0, 57).trim()}...` : text.trim();

  return {
    category,
    priority,
    summary,
    source: "fallback",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body?.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "Missing text" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model =
      process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

    if (!apiKey) {
      const fallback = fallbackAnalyze(text);
      return NextResponse.json(fallback);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You analyze a mutual-aid entry and return ONLY valid JSON. " +
              "Return keys: category, priority, summary. " +
              "Allowed categories: translation, mentoring, coding, legal, logistics, other. " +
              "Use logistics for tools, objects, equipment, borrowing/lending/renting physical items. " +
              "Priority must be low, medium, or high. " +
              "Summary must be short and clear in English.",
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const fallback = fallbackAnalyze(text);
      return NextResponse.json(fallback);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (!content) {
      const fallback = fallbackAnalyze(text);
      return NextResponse.json(fallback);
    }

    const parsed = JSON.parse(content);

    const result: AnalyzeResult = {
      category: normalizeCategory(parsed.category || "other", text),
      priority:
        parsed.priority === "high" || parsed.priority === "low"
          ? parsed.priority
          : "medium",
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : text.length > 60
          ? `${text.slice(0, 57).trim()}...`
          : text.trim(),
      source: "llm",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze route error:", error);
    return NextResponse.json(fallbackAnalyze(""), { status: 200 });
  }
}