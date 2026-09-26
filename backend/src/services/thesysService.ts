import OpenAI from "openai";

function getThesysClient() {
  const apiKey = process.env.THESYS_API_KEY;
  if (!apiKey) {
    throw new Error("THESYS_API_KEY is not set");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.thesys.dev/v1/embed",
  });
}

export async function sendToThesys(message: string) {
  return getThesysClient().chat.completions.create({
    model: "c1/anthropic/claude-sonnet-4/v-20251230",
    messages: [
      {
        role: "system",
        content:
          "You are the Plan2Field AI Assistant. Help project managers and field engineers understand project progress, field reports, schedules, activities, delays, risks, evidence, and project data. Give concise, practical answers.",
      },
      {
        role: "user",
        content: message,
      },
    ],
  });
}
