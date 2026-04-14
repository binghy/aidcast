export type EntryLike = {
  id: number;
  fid?: number | null;
  type: "request" | "offer";
  raw_text: string;
  category: string | null;
  priority?: string | null;
  summary?: string | null;
  status?: string | null;
  created_at?: string;
  support_mode?: "online" | "in_person" | "both" | null;
  location_text?: string | null;
};

export type MatchEvaluation = {
  isMatch: boolean;
  score: number;
  reason: string;
  breakdown: {
    category: number;
    textOverlap: number;
    requestPriority: number;
    offerUrgency: number;
    recency: number;
    location: number;
    supportMode: number;
    intent: number;
  };
};

const STOPWORDS = new Set([
  "i",
  "can",
  "help",
  "the",
  "a",
  "an",
  "to",
  "from",
  "with",
  "and",
  "or",
  "for",
  "of",
  "in",
  "on",
  "at",
  "by",
  "is",
  "are",
  "this",
  "that",
  "it",
  "be",
  "as",
  "into",
  "my",
  "your",
  "their",
  "our",
  "need",
  "needs",
]);

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function stem(word: string): string {
  return word
    .replace(/ing$/, "")
    .replace(/ed$/, "")
    .replace(/tion$/, "")
    .replace(/s$/, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .filter((w) => !STOPWORDS.has(w))
    .map(stem);
}

function uniqueWords(words: string[]) {
  return Array.from(new Set(words));
}

function getCommonWords(a: string, b: string): string[] {
  const aWords = new Set(uniqueWords(tokenize(a)));
  const bWords = new Set(uniqueWords(tokenize(b)));
  return Array.from(aWords).filter((word) => bWords.has(word));
}

function extractCity(location: string | null | undefined): string | null {
  if (!location) return null;
  return location.split(",")[0]?.trim().toLowerCase() || null;
}

function getRecencyBoost(createdAt?: string | null) {
  if (!createdAt) return 0;

  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffHours = (now - created) / (1000 * 60 * 60);

  if (diffHours < 1) return 6;
  if (diffHours < 24) return 4;
  if (diffHours < 72) return 2;
  return 0;
}

function inferOfferUrgency(text: string) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("right now") ||
    normalized.includes("immediately") ||
    normalized.includes("urgent") ||
    normalized.includes("available now") ||
    normalized.includes("can give immediately") ||
    normalized.includes("can help immediately")
  ) {
    return 10;
  }

  if (
    normalized.includes("today") ||
    normalized.includes("asap") ||
    normalized.includes("soon")
  ) {
    return 6;
  }

  return 0;
}

function getRequestPriorityBoost(priority?: string | null) {
  if (priority === "high") return 12;
  if (priority === "medium") return 6;
  return 0;
}

function categoryKind(category: string | null) {
  const normalized = (category || "").toLowerCase();

  const objectLike = new Set([
    "logistics",
    "tools",
    "physical_goods",
    "objects",
    "equipment",
  ]);

  if (objectLike.has(normalized)) return "object";
  return "service";
}

function inferIntent(text: string) {
  const t = normalizeText(text);

  if (t.includes("loan") || t.includes("rent") || t.includes("borrow")) {
    return "loan";
  }

  if (t.includes("give") || t.includes("provide")) {
    return "give";
  }

  if (t.includes("help") || t.includes("assist")) {
    return "help";
  }

  if (t.includes("explain") || t.includes("teach") || t.includes("tutor")) {
    return "explain";
  }

  return "generic";
}

function supportCompatibility(request: EntryLike, offer: EntryLike) {
  const requestMode = request.support_mode || "online";
  const offerMode = offer.support_mode || "online";
  const kind = categoryKind(request.category);

  if (kind === "object") {
    if (requestMode === "online" || offerMode === "online") {
      return {
        isCompatible: false,
        score: 0,
        reason: "object/tool requests are not supported online",
      };
    }

    return {
      isCompatible: true,
      score: 8,
      reason: "in-person compatible for object/tool exchange",
    };
  }

  if (requestMode === "in_person") {
    if (offerMode === "online") {
      return {
        isCompatible: false,
        score: 0,
        reason: "request explicitly requires in-person support",
      };
    }

    return {
      isCompatible: true,
      score: 8,
      reason: "request requires in-person and offer supports it",
    };
  }

  if (requestMode === "both") {
    if (
      offerMode === "online" ||
      offerMode === "in_person" ||
      offerMode === "both"
    ) {
      return {
        isCompatible: true,
        score: 6,
        reason: "service request is flexible on support mode",
      };
    }
  }

  if (requestMode === "online") {
    return {
      isCompatible: true,
      score: 6,
      reason: "service can be satisfied online by default",
    };
  }

  return {
    isCompatible: true,
    score: 0,
    reason: "generic support mode compatibility",
  };
}

function locationCompatibility(request: EntryLike, offer: EntryLike) {
  const requestCity = extractCity(request.location_text);
  const offerCity = extractCity(offer.location_text);
  const kind = categoryKind(request.category);
  const requestMode = request.support_mode || "online";
  const offerMode = offer.support_mode || "online";

  const locationRelevant =
    kind === "object" ||
    requestMode === "in_person" ||
    requestMode === "both" ||
    offerMode === "in_person" ||
    offerMode === "both";

  if (!locationRelevant) {
    return {
      isCompatible: true,
      score: 0,
      reason: "location not relevant",
    };
  }

  if (kind === "object") {
    if (!requestCity || !offerCity) {
      return {
        isCompatible: false,
        score: 0,
        reason: "object/tool exchange requires city information",
      };
    }

    if (requestCity !== offerCity) {
      return {
        isCompatible: false,
        score: 0,
        reason: "object/tool exchange requires same city",
      };
    }

    return {
      isCompatible: true,
      score: 20,
      reason: `same city: ${requestCity}`,
    };
  }

  if (requestCity && offerCity && requestCity === offerCity) {
    return {
      isCompatible: true,
      score: 10,
      reason: `same city: ${requestCity}`,
    };
  }

  return {
    isCompatible: true,
    score: 0,
    reason: "different city or no city bonus",
  };
}

export function evaluateOfferForRequest(
  request: EntryLike,
  offer: EntryLike
): MatchEvaluation {
  if (!request.category || !offer.category || request.category !== offer.category) {
    return {
      isMatch: false,
      score: 0,
      reason: "different category",
      breakdown: {
        category: 0,
        textOverlap: 0,
        requestPriority: 0,
        offerUrgency: 0,
        recency: 0,
        location: 0,
        supportMode: 0,
        intent: 0,
      },
    };
  }

  const support = supportCompatibility(request, offer);
  if (!support.isCompatible) {
    return {
      isMatch: false,
      score: 0,
      reason: support.reason,
      breakdown: {
        category: 20,
        textOverlap: 0,
        requestPriority: 0,
        offerUrgency: 0,
        recency: 0,
        location: 0,
        supportMode: 0,
        intent: 0,
      },
    };
  }

  const location = locationCompatibility(request, offer);
  if (!location.isCompatible) {
    return {
      isMatch: false,
      score: 0,
      reason: location.reason,
      breakdown: {
        category: 20,
        textOverlap: 0,
        requestPriority: 0,
        offerUrgency: 0,
        recency: 0,
        location: 0,
        supportMode: support.score,
        intent: 0,
      },
    };
  }

  const requestText = request.summary || request.raw_text;
  const offerText = offer.summary || offer.raw_text;

  const commonWords = getCommonWords(requestText, offerText);
  const textOverlapScore = Math.min(commonWords.length * 6, 24);

  const requestPriorityScore = getRequestPriorityBoost(request.priority);
  const offerUrgencyScore = inferOfferUrgency(offerText);
  const recencyScore = getRecencyBoost(offer.created_at);
  const categoryScore = 20;

  const requestIntent = inferIntent(requestText);
  const offerIntent = inferIntent(offerText);

  let intentScore = 0;

  if (requestIntent === offerIntent) {
    intentScore = 12;
  } else if (
    (requestIntent === "loan" && offerIntent === "give") ||
    (requestIntent === "give" && offerIntent === "loan")
  ) {
    intentScore = 8;
  } else {
    intentScore = 2;
  }

  const score =
    categoryScore +
    textOverlapScore +
    requestPriorityScore +
    offerUrgencyScore +
    recencyScore +
    location.score +
    support.score +
    intentScore;

  const reasons = [
    "same category",
    requestIntent === offerIntent ? `same intent: ${requestIntent}` : null,
    commonWords.length > 0 ? `shared words: ${commonWords.slice(0, 4).join(", ")}` : null,
    request.priority ? `request priority: ${request.priority}` : null,
    offerUrgencyScore > 0 ? "offer indicates immediate availability" : null,
    recencyScore > 0 ? "recent offer" : null,
    location.score > 0 ? location.reason : null,
    support.score > 0 ? support.reason : null,
  ].filter(Boolean) as string[];

  return {
    isMatch: true,
    score: Math.min(score, 100),
    reason: reasons.join(" • "),
    breakdown: {
      category: categoryScore,
      textOverlap: textOverlapScore,
      requestPriority: requestPriorityScore,
      offerUrgency: offerUrgencyScore,
      recency: recencyScore,
      location: location.score,
      supportMode: support.score,
      intent: intentScore,
    },
  };
}