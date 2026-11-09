import { describeHaikuPlan, runHaikuEvaluation } from "../lib/server/haiku-evaluation";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--live", "--acknowledge-cost"].includes(arg))) {
    console.error("지원하지 않는 옵션입니다.");
    process.exitCode = 1;
    return;
  }
  if (!args.length) {
    console.log("외부 호출 없는 실행 계획입니다. 환경파일은 읽지 않습니다.");
    console.log(JSON.stringify(describeHaikuPlan(), null, 2));
    return;
  }
  if (!args.includes("--live") || !args.includes("--acknowledge-cost")) {
    console.error("실제 호출은 --live와 --acknowledge-cost를 함께 지정해야 합니다. 비용이 발생할 수 있습니다.");
    process.exitCode = 1;
    return;
  }
  // Do not load .env files or enable application search generation.
  if (!process.env.LLM_API_KEY?.trim() || !process.env.LLM_BASE_URL?.trim()) {
    console.error("실행 환경의 LLM_API_KEY와 LLM_BASE_URL이 필요합니다. 값은 출력하지 않습니다.");
    process.exitCode = 1;
    return;
  }
  try {
    const { getLlmClient } = await import("../lib/server/llm");
    const client = getLlmClient();
    console.log("bedrock-haiku 가상 자료 검증: 최대 2회 호출, 건당 출력 400 tokens, 재시도 없음.");
    const results = await runHaikuEvaluation((request, options) => client.chat.completions.create(request, options));
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => result.status === "failed")) process.exitCode = 1;
    console.log(results.some((result) => result.status === "failed")
      ? "실패로 남은 호출을 중단했습니다. reason·httpStatus만 확인하고 인증값·오류 원문은 공유하지 마세요."
      : "답변의 자연스러움·사실 일치는 검토 항목을 기준으로 직접 확인해야 합니다.");
  } catch {
    console.error("Haiku 검증을 진행하지 못했습니다. 설정·접근 권한을 확인하세요. 인증값·오류 원문은 출력하지 않습니다.");
    process.exitCode = 1;
  }
}

void main();
