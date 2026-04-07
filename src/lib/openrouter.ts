import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("Missing OPENROUTER_API_KEY");
}

export const openrouter = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});