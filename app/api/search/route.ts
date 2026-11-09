import { NextResponse, type NextRequest } from "next/server";
import { allowSearchRequest } from "@/lib/server/search";
import { searchWithAssistant } from "@/lib/server/search-assistant";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_BODY_BYTES = 4_096;
const MAX_QUESTION_LENGTH = 500;
const MAX_LOCATION_LENGTH = 100;
const MAX_SEARCH_PAGE = 100;

async function readBoundedBody(request: NextRequest): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("EMPTY_BODY");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function POST(request: NextRequest) {
  if (!allowSearchRequest()) {
    return NextResponse.json(
      { message: "요청이 잠시 많아요. 1분 후 다시 시도해 주세요." },
      { status: 429 },
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ message: "JSON 요청만 지원합니다." }, { status: 415 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readBoundedBody(request));
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
    return NextResponse.json(
      { message: tooLarge ? "검색 요청이 너무 큽니다." : "검색 요청 형식을 확인해 주세요." },
      { status: tooLarge ? 413 : 400 },
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("question" in payload) ||
    !("location" in payload) ||
    typeof payload.question !== "string" ||
    typeof payload.location !== "string"
  ) {
    return NextResponse.json({ message: "질문과 지역을 입력해 주세요." }, { status: 400 });
  }

  const question = payload.question.trim();
  const location = payload.location.trim();
  const page = "page" in payload ? payload.page : 1;
  if (
    !question ||
    question.length > MAX_QUESTION_LENGTH ||
    !location ||
    location.length > MAX_LOCATION_LENGTH ||
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_SEARCH_PAGE
  ) {
    return NextResponse.json(
      { message: "질문은 1~500자, 지역은 1~100자, 검색 페이지는 1~100으로 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await searchWithAssistant({ question, location, page });
    return NextResponse.json(result);
  } catch {
    console.error("Search answer generation failed.");
    return NextResponse.json(
      { message: "답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }
}
