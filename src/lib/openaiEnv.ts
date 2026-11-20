export function openaiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return key;
}

export function openaiModel() {
  return process.env.OPENAI_MODEL || "gpt-6-luna";
}
