import "server-only";

import OpenAI from "openai";

let client: OpenAI | undefined;

export function getLlmClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY?.trim();
  const baseURL = process.env.LLM_BASE_URL?.trim();

  if (!apiKey) {
    throw new Error("LLM_API_KEY must be set before using the LLM gateway.");
  }
  if (!baseURL) {
    throw new Error("LLM_BASE_URL must be set before using the LLM gateway.");
  }

  if (!client) {
    client = new OpenAI({ apiKey, baseURL });
  }

  return client;
}

export function getLlmModel(): string {
  const model = process.env.LLM_MODEL?.trim();

  if (!model) {
    throw new Error("LLM_MODEL must be set before using the LLM gateway.");
  }

  return model;
}
