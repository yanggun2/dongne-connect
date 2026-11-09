import "server-only";
import { buildAnswerRequest, readAnswerCompletion, type AnswerEvidence } from "./answer-generation";

export const HAIKU_MODEL = "bedrock-haiku";
const evidence: AnswerEvidence = {
  sourceId: "synthetic-city-guide", id: "paper-collection",
  content: "이것은 실제 지역에 적용되지 않는 가상 테스트 자료입니다. 별빛시 종이류 수거시간은 오전 8시부터 낮 12시까지입니다. 배출 요일과 배출시간은 확인되지 않았습니다.",
  regionName: "가상 별빛시", dataAsOf: "2026-11-09", checkedAt: "2026-11-09",
};
const cases = [
  { id: "supported", region: "가상 별빛시", question: "별빛시 종이류 수거시간은 언제인가요?", review: "수거시간 8~12시를 안내하고 배출시간으로 바꾸지 않는지 확인" },
  { id: "unknown-weekday", region: "가상 별빛시", question: "별빛시 종이류는 무슨 요일에 버리나요?", review: "배출 요일을 추정하지 않고 확인되지 않았다고 안내하는지 확인" },
  { id: "other-region", region: "가상 달빛시", question: "달빛시 종이류 수거시간은 언제인가요?", review: "다른 지역 근거를 보내지 않고 모델 호출 없이 차단" },
] as const;

export function describeHaikuPlan() {
  return { model: HAIKU_MODEL, guideModel: "Claude Haiku 4.5", caseCount: cases.length, maxRequests: 2, maxOutputTokensPerRequest: 400, maxRetries: 0, timeoutMs: 15_000, data: "직접 작성한 가상 생활정보만 사용", cases };
}

type Completion = Parameters<typeof readAnswerCompletion>[0] & {
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
};
type Complete = (request: ReturnType<typeof buildAnswerRequest>, options: { maxRetries: 0; timeout: number; signal: AbortSignal }) => Promise<Completion>;
type Result = { id: string; status: "needs_review" | "blocked_region" | "failed"; review: string; answer?: string; sourceIds?: string[]; usage?: { inputTokens: number; outputTokens: number } | null; failure?: "budget_exceeded" | "request_failed"; reason?: "http_error" | "network_error" | "timeout" | "invalid_response" | "unknown"; httpStatus?: number };

function safeFailure(error: unknown): Pick<Result, "failure" | "reason" | "httpStatus"> {
  const budget = error instanceof Error && /budget.*exceed|insufficient_quota/iu.test(error.message);
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  const httpStatus = typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
  const name = error instanceof Error ? error.name : "";
  const reason = httpStatus ? "http_error" : ["APIConnectionTimeoutError", "TimeoutError", "AbortError"].includes(name) ? "timeout" : name === "APIConnectionError" ? "network_error" : error instanceof Error && error.message === "UNUSABLE_ANSWER" ? "invalid_response" : "unknown";
  return { failure: budget ? "budget_exceeded" : "request_failed", reason, ...(httpStatus !== undefined ? { httpStatus } : {}) };
}

// No credentials/files/environment access. Only the explicitly invoked CLI supplies a transport.
export async function runHaikuEvaluation(complete: Complete): Promise<Result[]> {
  const results: Result[] = [];
  for (const entry of cases) {
    if (entry.region !== evidence.regionName) {
      results.push({ id: entry.id, status: "blocked_region", review: entry.review });
      continue;
    }
    try {
      const completion = await complete(buildAnswerRequest(entry.question, [evidence], HAIKU_MODEL), { maxRetries: 0, timeout: 15_000, signal: AbortSignal.timeout(15_000) });
      results.push({ id: entry.id, status: "needs_review", review: entry.review,
        answer: readAnswerCompletion(completion), sourceIds: [evidence.sourceId],
        usage: completion.usage ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens } : null });
    } catch (error) {
      results.push({ id: entry.id, status: "failed", review: entry.review, ...safeFailure(error) });
      break;
    }
  }
  return results;
}
