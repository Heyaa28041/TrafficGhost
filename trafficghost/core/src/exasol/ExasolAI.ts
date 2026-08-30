/// <reference types="node" />

import * as https from "node:https";
import * as http from "node:http";
import { URL } from "node:url";
import type { ExasolClient, QueryResult } from "./ExasolClient.js";
import { AI_SCHEMA_CONTEXT } from "./ExasolDDL.js";

export interface AiQueryResult {
  question: string;
  sql: string;
  columns: string[];
  rows: unknown[][];
  error?: string;
  durationMs: number;
}

// Default: use a free/open model API endpoint. Can be overridden in settings.
// Compatible with OpenAI, Together AI, Groq, Ollama, etc.
const DEFAULT_AI_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

export async function runAiQuery(
  question: string,
  exasolClient: ExasolClient,
  options: {
    apiKey?: string;
    endpoint?: string;
    model?: string;
  } = {}
): Promise<AiQueryResult> {
  const start = Date.now();

  if (!exasolClient.isConnected()) {
    return {
      question,
      sql: "",
      columns: [],
      rows: [],
      error: "Exasol is not connected. Run `exasol start` or `exasol install local` first.",
      durationMs: Date.now() - start,
    };
  }

  // Step 1: Generate SQL via LLM
  let sql: string;
  try {
    sql = await generateSql(question, options);
  } catch (e) {
    // Fallback: try to construct a basic SQL ourselves for common patterns
    sql = buildFallbackSql(question);
    if (!sql) {
      return {
        question,
        sql: "",
        columns: [],
        rows: [],
        error: `AI SQL generation failed: ${(e as Error).message}. Set trafficghost.exasol.aiApiKey to enable AI.`,
        durationMs: Date.now() - start,
      };
    }
  }

  // Step 2: Execute against Exasol
  let result: QueryResult;
  try {
    result = await exasolClient.execute(sql);
  } catch (e) {
    return {
      question,
      sql,
      columns: [],
      rows: [],
      error: `SQL execution failed: ${(e as Error).message}`,
      durationMs: Date.now() - start,
    };
  }

  return {
    question,
    sql,
    columns: result.columns,
    rows: result.rows,
    durationMs: Date.now() - start,
  };
}

// ─── LLM SQL Generation ────────────────────────────────────────────────────────

async function generateSql(
  question: string,
  options: { apiKey?: string; endpoint?: string; model?: string }
): Promise<string> {
  const endpoint = options.endpoint ?? DEFAULT_AI_ENDPOINT;
  const model = options.model ?? DEFAULT_MODEL;
  const apiKey = options.apiKey;

  if (!apiKey) {
    throw new Error("No AI API key configured");
  }

  const messages = [
    { role: "system", content: AI_SCHEMA_CONTEXT },
    { role: "user", content: `Write an Exasol SQL query to answer this question:\n${question}` },
  ];

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0,
    max_tokens: 512,
  });

  const raw = await httpPost(endpoint, body, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  });

  const parsed = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }

  const content = parsed.choices?.[0]?.message?.content ?? "";
  // Strip markdown code fences if present
  return content
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim();
}

// ─── Fallback: keyword-based SQL without LLM ──────────────────────────────────

function buildFallbackSql(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("error") || q.includes("500") || q.includes("fail")) {
    return `SELECT METHOD, PATH, COUNT(*) AS ERROR_COUNT
            FROM TRAFFICGHOST.REQUEST_LOGS
            WHERE STATUS_CODE >= 500
            GROUP BY METHOD, PATH
            ORDER BY ERROR_COUNT DESC
            LIMIT 10`;
  }

  if (q.includes("slow") || q.includes("latency") || q.includes("duration")) {
    return `SELECT METHOD, PATH, AVG(DURATION_MS) AS AVG_MS,
                   MAX(DURATION_MS) AS MAX_MS, COUNT(*) AS HITS
            FROM TRAFFICGHOST.REQUEST_LOGS
            GROUP BY METHOD, PATH
            ORDER BY AVG_MS DESC
            LIMIT 10`;
  }

  if (q.includes("popular") || q.includes("most called") || q.includes("busiest") || q.includes("hit")) {
    return `SELECT METHOD, PATH, COUNT(*) AS HITS
            FROM TRAFFICGHOST.REQUEST_LOGS
            GROUP BY METHOD, PATH
            ORDER BY HITS DESC
            LIMIT 10`;
  }

  if (q.includes("total") || q.includes("count") || q.includes("how many")) {
    return `SELECT COUNT(*) AS TOTAL_REQUESTS,
                   COUNT(DISTINCT PATH) AS UNIQUE_PATHS,
                   AVG(DURATION_MS) AS AVG_DURATION_MS
            FROM TRAFFICGHOST.REQUEST_LOGS`;
  }

  if (q.includes("status") || q.includes("breakdown")) {
    return `SELECT STATUS_CODE, COUNT(*) AS COUNT
            FROM TRAFFICGHOST.REQUEST_LOGS
            GROUP BY STATUS_CODE
            ORDER BY COUNT DESC`;
  }

  if (q.includes("recent") || q.includes("last") || q.includes("latest")) {
    return `SELECT TS, METHOD, PATH, STATUS_CODE, DURATION_MS
            FROM TRAFFICGHOST.REQUEST_LOGS
            ORDER BY TS DESC
            LIMIT 20`;
  }

  return "";
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

function httpPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("AI request timed out (30s)"));
    });
    req.write(body);
    req.end();
  });
}
