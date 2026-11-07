import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  try {
    const { getLlmClient, getLlmModel } = await import("../lib/server/llm");
    const client = getLlmClient();
    const model = getLlmModel();
    const models = await client.models.list();

    console.log(`사용 가능한 모델 (${models.data.length}개):`);
    for (const availableModel of models.data) {
      console.log(`- ${availableModel.id}`);
    }

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "짧게 '준비 완료'라고 답해 주세요." }],
      max_tokens: 32,
    });
    const answer = completion.choices[0]?.message.content?.trim();

    if (!answer) {
      throw new Error("The model returned an empty response.");
    }

    console.log(`\n${model} 응답: ${answer}`);
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number"
        ? ` (HTTP ${error.status})`
        : "";

    console.error(
      `LLM 수동 테스트 실패${status}. 환경변수, 키, 게이트웨이 연결 상태를 확인하세요.`,
    );
    process.exitCode = 1;
  }
}

void main();
