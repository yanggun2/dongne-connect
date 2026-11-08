export type WasteCategory = "general" | "food" | "recycling" | "inert" | "bulky";
export type WasteHousing = "unknown" | "single" | "apartment";
export const wasteCategories: readonly WasteCategory[] = ["general", "food", "recycling", "inert", "bulky"];
export const wasteHousingTypes: readonly WasteHousing[] = ["unknown", "single", "apartment"];
export const wasteCategoryLabels: Record<WasteCategory, string> = {
  general: "일반쓰레기", food: "음식물", recycling: "재활용", inert: "불연성", bulky: "대형폐기물",
};

export const WASTE_CHECKED_AT = "2026-11-08";
export const WASTE_PORTAL_URL = "https://recycle.seongnam.go.kr/platforminfo/trash";
export const WASTE_BOOKLET_URL = `https://recycle.seongnam.go.kr/v1/download/${encodeURIComponent("슬기로운 에코라이프 생활폐기물 배출 안내 책자(2025).pdf")}/echolife2025.pdf`;
export const WASTE_BULKY_PORTAL_URL = "https://waste.isdc.co.kr/";

export type WasteProvider = { district: string; name: string; phone: string; dongs: readonly string[] };
// PDF page 4; cross-checked against the separately downloadable July 2024 company table.
// These are booklet-listed providers, not a live contracting database.
export const wasteProviders: readonly WasteProvider[] = [
  { district: "수정구", name: "삼성환경", phone: "031-757-7186", dongs: ["신흥1동", "복정동", "신촌동", "고등동"] },
  { district: "수정구", name: "두림환경", phone: "031-707-3900", dongs: ["수진1동", "시흥동", "위례동"] },
  { district: "수정구", name: "환경개발", phone: "031-777-8689", dongs: ["단대동", "산성동", "양지동", "태평2동"] },
  { district: "수정구", name: "성남환경", phone: "031-714-6016", dongs: ["태평3동", "태평4동", "수진2동"] },
  { district: "수정구", name: "평화", phone: "031-755-5832", dongs: ["신흥2동", "신흥3동", "태평1동"] },
  { district: "중원구", name: "금성환경", phone: "031-734-4008", dongs: ["금광1동", "상대원2동", "하대원동"] },
  { district: "중원구", name: "대림환경", phone: "031-754-2561", dongs: ["성남동"] },
  { district: "중원구", name: "비케이엔텍", phone: "031-703-3341", dongs: ["금광2동", "상대원3동"] },
  { district: "중원구", name: "엘앤케이비즈", phone: "031-753-3545", dongs: ["중앙동", "은행2동"] },
  { district: "중원구", name: "나눔환경", phone: "031-721-0436", dongs: ["은행1동", "상대원1동", "도촌동"] },
  { district: "분당구", name: "한성산업", phone: "031-732-7363", dongs: ["야탑1동", "야탑2동", "야탑3동"] },
  { district: "분당구", name: "한진용역", phone: "031-753-6401", dongs: ["정자2동", "구미동", "구미1동"] },
  { district: "분당구", name: "창성산업", phone: "031-781-6661", dongs: ["이매1동", "삼평동", "백현동"] },
  { district: "분당구", name: "강산이앤에쓰", phone: "031-756-0301", dongs: ["분당동", "수내2동", "서현1동"] },
  { district: "분당구", name: "중앙기업", phone: "031-716-4747", dongs: ["수내1동", "수내3동", "정자동", "서현2동"] },
  { district: "분당구", name: "디엔에스사회적기업", phone: "031-744-2114", dongs: ["정자1동", "정자3동", "금곡동"] },
  { district: "분당구", name: "진앤이치", phone: "031-778-6288", dongs: ["이매2동", "판교동", "운중동"] },
];

export function getWasteProvider(location: string): WasteProvider | undefined {
  const tokens = location.split(/\s+/u);
  return wasteProviders.find((provider) => tokens.includes(provider.district) && provider.dongs.some((dong) => tokens.includes(dong)));
}

export type WasteGuidance = {
  category: WasteCategory; housing: WasteHousing; region: string;
  disposalTime: string; collectionTime: string | null;
  methods: string[]; cautions: string[]; pdfPages: number[];
  provider: WasteProvider | undefined;
  checkedAt: string;
  license: "KOGL-4";
  generationAllowed: false;
};

export function getWasteGuidance(location: string, category: WasteCategory = "general", housing: WasteHousing = "unknown"): WasteGuidance | null {
  if (!location.split(/\s+/u).includes("성남시")) return null;
  const methods: string[] = [];
  const cautions: string[] = [];
  let pdfPages = [4, 5];
  if (category === "general") {
    methods.push("소각용 종량제봉투에 담아 배출해 주세요.");
    if (housing !== "apartment") methods.push("단독주택·상가는 내 집 또는 점포 앞에 배출해 주세요.");
    if (housing !== "single") methods.push("공동주택은 지정된 배출장소를 이용해 주세요.");
    cautions.push("음식물·재활용·불연성 폐기물은 섞지 않고 분리해 주세요.");
  } else if (category === "food") {
    methods.push("음식물의 물기와 이물질을 제거해 주세요.");
    if (housing !== "apartment") methods.push("단독주택·상가: 음식물 전용 종량제봉투(노란색) 또는 음식물 종량기(RFID)를 이용해 주세요.");
    if (housing !== "single") methods.push("공동주택: RFID 종량기 또는 전용용기를 사용하며, 납부필증·배출장소는 관리사무소 안내를 확인해 주세요.");
    cautions.push("동물 뼈·갑각류/조개 껍데기·단단한 과일 씨·티백 등은 음식물류에서 분리해 소각용 종량제봉투로 배출하는 항목입니다.");
  } else if (category === "recycling") {
    pdfPages = [4, 9, 10];
    methods.push("재질별로 나누고 내용물과 이물질을 제거한 뒤 배출해 주세요.", "물에 젖지 않도록 투명비닐 등에 담고, 공동주택은 지정 수거함·장소를 이용해 주세요.");
    if (housing !== "apartment") cautions.push("단독주택의 투명 페트병은 다른 플라스틱과 구분해 투명비닐에 따로 배출하는 안내가 있습니다.");
    cautions.push("품목별 세부 기준이 다르므로 오염된 재질·깨진 유리 등은 일반 재활용으로 단정하지 마세요.");
  } else if (category === "inert") {
    methods.push("도자기·화분·유리 등 불에 타지 않는 폐기물은 불연성 전용마대로 배출해 주세요.");
    cautions.push("불에 타는 쓰레기와 혼합하지 마세요. 공사·사업장 폐기물은 종류·물량에 따른 별도 처리 기준을 먼저 확인해 주세요.");
  } else {
    pdfPages = [12];
    methods.push("배출할 품목·크기·수량과 장소를 확인해 대형폐기물 신고를 해 주세요.", "안내된 수수료·배출일을 확인하고 신고접수번호를 표시해 지정 장소에 배출해 주세요.");
    cautions.push("수수료는 품목과 규격에 따라 달라요. 현행 금액은 공식 신청 화면에서 확인해 주세요.", "별도 수수료표의 발행·개정일이 확인되지 않아 금액을 현재 가격으로 확정하지 않습니다.");
  }
  if (category !== "bulky") {
    cautions.push("요일·주말 세부 조건은 공식 안내 또는 수거업체에 확인해 주세요. 책자와 현재 웹 안내의 주말 수거 표기가 달라 동별 요일을 단정하지 않습니다.", "공동주택은 관리 일정에 따라 수거일이 달라질 수 있고, 설·추석 등 연휴에는 별도 공지를 확인해야 해요.");
  }
  return {
    category, housing, region: location,
    disposalTime: category === "bulky" ? "신고할 때 안내받은 배출일과 장소를 따라 주세요." : "수거 전날 일몰 후부터 다음 날 오전 5시까지",
    collectionTime: category === "bulky" ? null : "오전 6시~오후 3시 (배출시간과 다릅니다)",
    methods, cautions, pdfPages, provider: getWasteProvider(location), checkedAt: WASTE_CHECKED_AT,
    license: "KOGL-4", generationAllowed: false,
  };
}

export function parseWasteQuestion(question: string): { category: WasteCategory; housing: WasteHousing } {
  const category: WasteCategory = /대형|침대|매트리스|장롱/u.test(question) ? "bulky"
    : /불연성|도자기|화분|깨진\s*유리/u.test(question) ? "inert"
    : /음식물/u.test(question) ? "food"
    : /재활용|페트|플라스틱|종이팩|비닐|분리수거/u.test(question) ? "recycling" : "general";
  const apartment = /공동주택|아파트/u.test(question);
  const single = /단독|상가/u.test(question);
  const housing: WasteHousing = apartment && single ? "unknown" : apartment ? "apartment" : single ? "single" : "unknown";
  return { category, housing };
}

export function formatWasteAnswer(guide: WasteGuidance): string {
  const paragraphs: string[] = [];
  if (guide.category === "bulky") {
    paragraphs.push(`${guide.region}에서 대형폐기물을 버리려면 먼저 품목과 크기를 확인해 신고해 주세요. 안내받은 수수료와 배출일을 확인한 뒤 신고접수번호를 표시해 지정 장소에 내놓으면 됩니다. 수수료는 품목·규격에 따라 달라 공식 신고 화면에서 확인하는 것이 정확해요.`);
  } else {
    const collectionTime = guide.collectionTime?.replace(/\s*\([^)]*\)/gu, "");
    paragraphs.push(`${guide.region}의 ${wasteCategoryLabels[guide.category]} 배출은 성남시 공통 안내를 기준으로 설명해 드릴게요. ${guide.disposalTime} 배출해 주세요.${collectionTime ? ` 수거 안내 시간은 ${collectionTime}예요. 쓰레기를 내놓는 시간과 수거시간은 다르니 구분해 주세요.` : ""}`);
    paragraphs.push(guide.methods.join(" "));
    if (guide.category !== "general") paragraphs.push(guide.cautions.filter((caution) => !caution.includes("요일·주말") && !caution.includes("공동주택은 관리 일정")).join(" "));
    paragraphs.push("정확한 배출 요일과 주말·공휴일 예외는 공식 안내를 한 번 더 확인해 주세요. 책자와 웹 안내의 주말 표기가 달라 모든 집의 배출 요일을 같다고 안내하기는 어려워요. 공동주택은 관리사무소에서 정한 일정도 확인해 주세요.");
  }
  if (guide.provider) paragraphs.push(`안내책자에 나온 해당 동 수거업체는 ${guide.provider.name}(${guide.provider.phone})입니다. 업체가 변경됐을 수 있으니 상세 배출일과 함께 확인해 주세요.`);
  return paragraphs.filter(Boolean).join("\n\n");
}

export function isWasteGuideQuestion(question: string): boolean {
  if (/오늘|내일|이번|명절|설날|추석|공휴일|의료|병원|약품|화학|유해|방사|농약|석면|사업장|건설|산업|다량|관리구역|관할/u.test(question)) return false;
  if (/\d{1,4}\s*(?:년|월|일)|\d{4}[-/.]\d{1,2}/u.test(question)) return false;
  return /쓰레기|폐기물|재활용|종량제|분리수거/u.test(question) && /배출|버리|버려|버릴|방법|시간|요일|분리|업체|담당|처리|신고/u.test(question);
}
