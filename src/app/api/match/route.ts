import { NextRequest, NextResponse } from "next/server";
import { openrouter } from "@/lib/openrouter";

function normalize(text: string) {
  return text.toLowerCase();
}

function detectSourceLanguageSpecificity(text: string) {
  const lower = normalize(text);

  const patterns = [
    "from italian",
    "from english",
    "from french",
    "from spanish",
    "from german",
    "from chinese",
    "from portuguese",
    "from russian",
  ];

  return patterns.some((pattern) => lower.includes(pattern));
}

function requestSpecifiesSourceLanguage(text: string) {
  const lower = normalize(text);

  return (
    lower.includes("from italian") ||
    lower.includes("from english") ||
    lower.includes("from french") ||
    lower.includes("from spanish") ||
    lower.includes("from german") ||
    lower.includes("from chinese") ||
    lower.includes("from portuguese") ||
    lower.includes("from russian")
  );
}

function hasLegalConstraint(text: string) {
  return text.toLowerCase().includes("legal");
}

function hasUrgencyConstraint(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("urgent") ||
    lower.includes("urgently") ||
    lower.includes("tomorrow") ||
    lower.includes("asap")
  );
}

function mentionsEnglish(text: string) {
  return text.toLowerCase().includes("english");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const requestText = String(body?.requestText || "").trim();
    const offerText = String(body?.offerText || "").trim();

    if (!requestText || !offerText) {
      return NextResponse.json(
        { error: "Missing requestText or offerText" },
        { status: 400 }
      );
    }

    const model = process.env.OPENROUTER_MODEL || "openrouter/auto";

    const completion = await openrouter.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You evaluate whether an offer can satisfy a request in a mutual-aid app. " +
            "Be strict about constraints like language, location, timing, or specialization. " +
            "If the request does not specify a constraint (for example source language), and the offer is specific (for example 'from Italian'), reduce the score slightly to reflect uncertainty. " +
            "If the offer clearly conflicts with the request constraints, return a low score and isMatch=false. " +
            "Return ONLY valid JSON with keys: isMatch, score, reason. " +
            "isMatch must be true or false. " +
            "score must be an integer from 0 to 100. " +
            "reason must be short and clear in English.",
        },
        {
          role: "user",
          content: `Request: ${requestText}\n\nOffer: ${offerText}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    let isMatch = Boolean(parsed.isMatch);
    let score = Number(parsed.score ?? 0);
    let reason = String(parsed.reason ?? "No reason provided");

    const offerHasSpecificSourceLanguage =
      detectSourceLanguageSpecificity(offerText);
    const requestHasSpecificSourceLanguage =
      requestSpecifiesSourceLanguage(requestText);

    if (offerHasSpecificSourceLanguage && !requestHasSpecificSourceLanguage) {
      score = Math.max(0, score - 10);
      reason +=
        " Reduced slightly because the offer specifies a source language not explicitly stated in the request.";
    }

    if (hasLegalConstraint(requestText) && hasLegalConstraint(offerText)) {
        score += 4;
        reason += " Covers legal specialization.";
    }

    if (mentionsEnglish(requestText) && mentionsEnglish(offerText)) {
    score += 2;
    }

    if (hasUrgencyConstraint(requestText) && hasUrgencyConstraint(offerText)) {
    score += 3;
    reason += " Aligns with urgency.";
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return NextResponse.json({
      isMatch,
      score,
      reason,
    });
  } catch (error) {
    console.error("Match route error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}