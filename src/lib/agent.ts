export type AgentResult = {
  category: string;
  priority: "low" | "medium" | "high";
  summary: string;
};

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function analyzeEntryText(text: string): AgentResult {
  const lower = text.toLowerCase();

  let category = "other";
  let priority: "low" | "medium" | "high" = "medium";

  if (
    hasAny(lower, [
      "teacher",
      "tutor",
      "tutoring",
      "math",
      "school",
      "student",
      "study",
      "educat",
      "lesson",
      "learning",
    ])
  ) {
    category = "education";
  } else if (
    hasAny(lower, [
      "translat",
      "english",
      "italian",
      "french",
      "spanish",
      "german",
      "document",
      "language",
      "localiz",
    ])
  ) {
    category = "translation";
  } else if (
    hasAny(lower, [
      "design",
      "designer",
      "logo",
      "figma",
      "ui",
      "ux",
      "brand",
      "branding",
      "visual",
    ])
  ) {
    category = "design";
  } else if (
    hasAny(lower, [
      "code",
      "coding",
      "developer",
      "develop",
      "program",
      "react",
      "next",
      "javascript",
      "typescript",
      "frontend",
      "backend",
      "fullstack",
      "app",
      "website",
    ])
  ) {
    category = "coding";
  } else if (
    hasAny(lower, [
      "mentor",
      "mentoring",
      "career",
      "cv",
      "resume",
      "guidance",
      "coach",
      "coaching",
      "advice",
    ])
  ) {
    category = "mentoring";
  } else if (
    hasAny(lower, [
      "delivery",
      "transport",
      "logistic",
      "shipping",
      "pickup",
      "dropoff",
      "courier",
    ])
  ) {
    category = "logistics";
  }

  if (
    hasAny(lower, [
      "urgent",
      "asap",
      "immediately",
      "today",
      "tomorrow",
      "deadline",
      "as soon as possible",
    ])
  ) {
    priority = "high";
  } else if (
    hasAny(lower, [
      "whenever",
      "no rush",
      "not urgent",
      "eventually",
      "sometime",
    ])
  ) {
    priority = "low";
  }

  const cleanText = text.trim();

  const summary =
    cleanText.length > 80 ? `${cleanText.slice(0, 77).trim()}...` : cleanText;

  return {
    category,
    priority,
    summary,
  };
}