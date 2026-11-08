import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const endpoint =
  "https://apis.data.go.kr/1741000/household_waste_info/info";
const seongnamCode = "3780000";
const rowsPerPage = 10;

type WasteItem = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function displayValue(value: unknown): string {
  return stringValue(value) ?? "없음";
}

function normalizeServiceKey(value: string): string {
  try {
    return decodeURIComponent(value.trim());
  } catch (error) {
    if (error instanceof URIError) {
      throw new Error("DATA_GO_API_KEY의 URL 인코딩 형식을 확인하세요.");
    }
    throw error;
  }
}

function getItems(body: Record<string, unknown>): WasteItem[] {
  const items = body.items;
  if (!isRecord(items)) {
    return [];
  }

  const item = items.item;
  if (Array.isArray(item)) {
    return item.filter(isRecord);
  }
  return isRecord(item) ? [item] : [];
}

async function main() {
  const configuredKey = process.env.DATA_GO_API_KEY;
  if (!configuredKey?.trim()) {
    console.error(
      "DATA_GO_API_KEY가 비어 있습니다. .env.local에 발급받은 인증키를 설정하세요.",
    );
    process.exitCode = 1;
    return;
  }

  const params = new URLSearchParams({
    serviceKey: normalizeServiceKey(configuredKey),
    pageNo: "1",
    numOfRows: String(rowsPerPage),
    returnType: "json",
    "cond[OPN_ATMY_GRP_CD::EQ]": seongnamCode,
  });
  const url = `${endpoint}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    console.error(
      "요청에 실패했습니다. 네트워크 연결과 API 상태를 확인하세요. 요청 주소와 원본 오류는 출력하지 않았습니다.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`HTTP 상태: ${response.status}`);
  if (!response.ok) {
    console.error("API가 성공 상태를 반환하지 않았습니다. 응답 본문은 출력하지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("JSON 응답을 읽을 수 없습니다. 응답 본문은 출력하지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  if (!isRecord(payload) || !isRecord(payload.response)) {
    console.error("공식 명세와 다른 응답 구조입니다. 응답 본문은 출력하지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  const apiResponse = payload.response;
  const header = isRecord(apiResponse.header) ? apiResponse.header : {};
  const body = isRecord(apiResponse.body) ? apiResponse.body : {};
  const resultCode = stringValue(header.resultCode);
  if (resultCode) {
    console.log(`API 결과 코드: ${resultCode}`);
  }

  if (resultCode && !["0", "00"].includes(resultCode)) {
    console.error("API가 성공 결과 코드를 반환하지 않았습니다. 원본 오류는 출력하지 않았습니다.");
    process.exitCode = 1;
    return;
  }

  const items = getItems(body);
  const totalCount =
    typeof body.totalCount === "number" ? body.totalCount : undefined;
  const matchingItems = items.filter(
    (item) => stringValue(item.OPN_ATMY_GRP_CD) === seongnamCode,
  );

  console.log(`응답 레코드 수: ${items.length}`);
  if (totalCount !== undefined) {
    console.log(`조회 조건의 전체 건수: ${totalCount}`);
  }
  console.log(
    `경기성남시 자료 여부: ${
      matchingItems.length > 0
        ? "확인됨"
        : items.length > 0
          ? "응답 자료에서 확인되지 않음"
          : totalCount === 0
            ? "조회 결과 없음"
            : "현재 응답만으로 확인 불가"
    }`,
  );

  if (matchingItems.length === 0) {
    console.log("적용 지역 및 기준일: 응답에 확인 가능한 성남 레코드 없음");
    return;
  }

  console.log("성남시 배출 정보:");
  for (const [index, item] of matchingItems.entries()) {
    console.log(`\n레코드 ${index + 1}`);
    console.log(
      `적용 지역: ${[
        displayValue(item.CTPV_NM),
        displayValue(item.SGG_NM),
        displayValue(item.MNG_ZONE_NM),
        displayValue(item.MNG_ZONE_TRGT_RGN_NM),
      ].join(" / ")}`,
    );
    console.log(`배출 장소: ${displayValue(item.EMSN_PLC)}`);
    console.log(`배출 장소 유형: ${displayValue(item.EMSN_PLC_TYPE)}`);
    console.log(
      `일반 생활폐기물 배출 방법: ${displayValue(item.LF_WST_EMSN_MTHD)}`,
    );
    console.log(
      `음식물류 폐기물 배출 방법: ${displayValue(item.FOD_WST_EMSN_MTHD)}`,
    );
    console.log(
      `재활용품 배출 방법: ${displayValue(item.RCYCL_EMSN_MTHD)}`,
    );
    console.log(
      `일시적 다량폐기물 배출 방법: ${displayValue(item.TMPRY_BULK_WASTE_EMSN_MTHD)}`,
    );
    console.log(
      `일시적 다량폐기물 배출 장소: ${displayValue(item.TMPRY_BULK_WASTE_EMSN_PLC)}`,
    );
    console.log(
      `일반 생활폐기물 배출 요일·시간: ${displayValue(item.LF_WST_EMSN_DOW)} / ${displayValue(item.LF_WST_EMSN_BGNG_TM)}-${displayValue(item.LF_WST_EMSN_END_TM)}`,
    );
    console.log(
      `음식물류 폐기물 배출 요일·시간: ${displayValue(item.FOD_WST_EMSN_DOW)} / ${displayValue(item.FOD_WST_EMSN_BGNG_TM)}-${displayValue(item.FOD_WST_EMSN_END_TM)}`,
    );
    console.log(
      `재활용품 배출 요일·시간: ${displayValue(item.RCYCL_EMSN_DOW)} / ${displayValue(item.RCYCL_EMSN_BGNG_TM)}-${displayValue(item.RCYCL_EMSN_END_TM)}`,
    );
    console.log(
      `일시적 다량폐기물 배출 시간: ${displayValue(item.TMPRY_BULK_WASTE_EMSN_BGNG_TM)}-${displayValue(item.TMPRY_BULK_WASTE_EMSN_END_TM)}`,
    );
    console.log(`미수거일: ${displayValue(item.UNCLLT_DAY)}`);
    console.log(`데이터 기준일: ${displayValue(item.DAT_CRTR_YMD)}`);
  }
}

void main().catch(() => {
  console.error("수동 조회를 완료하지 못했습니다. 원본 오류는 출력하지 않았습니다.");
  process.exitCode = 1;
});
