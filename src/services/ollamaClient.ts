import axios from "axios";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct-q4_K_M";

export async function ollamaChat(params: {
  system: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const { system, user, temperature = 0.8, timeoutMs = 120_000 } = params;

  const resp = await axios.post(
    `${OLLAMA_BASE_URL}/api/chat`,
    {
      model: OLLAMA_MODEL,
      stream: false,
      options: { temperature },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: timeoutMs }
  );

  const text = (resp.data?.message?.content || "").trim();
  return text.replace(/^["']|["']$/g, "");
}
