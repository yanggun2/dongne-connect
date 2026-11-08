"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  FacilitySearchRecord,
  ResidentCenterSearchRecord,
  SearchCitation,
  SearchResult,
} from "@/lib/search-types";
import { filterEventsByLocation, getUpcomingEvents, officialEvents } from "@/lib/official-events";
import { OfficialEventCard } from "@/components/OfficialEventCard";
import { officialNotices } from "@/lib/official-notices";
import { OfficialNoticeList } from "@/components/OfficialNoticeList";
import { WasteGuide } from "@/components/WasteGuide";
import { wasteCategories, wasteHousingTypes } from "@/lib/waste-guide";
import { CommunityCalendar } from "@/components/CommunityCalendar";
import { DirectionsLink } from "@/components/DirectionsLink";
import { ResidentCenterMap } from "@/components/ResidentCenterMap";
import { TownMap } from "@/components/TownMap";
import { NeighborhoodMap, type MapPoint } from "@/components/NeighborhoodMap";
import { getCoordinates, getNaverMapSearchUrl } from "@/lib/map-links";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  House,
  MapPin,
  MapPinned,
  MessagesSquare,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const exampleQuestions = [
  "우리 동네 쓰레기 언제 버려?",
  "가까운 주민센터 어디야?",
  "이번 주 동네 행사 있어?",
];


type DisplayedResult = {
  result: SearchResult;
  question: string;
  location: string;
  scopeLabel: string;
};

type NeighborhoodOption = {
  id: string;
  city: string;
  district: string;
  dong: string;
  label: string;
  administrativeCode: string | null;
};

function isNeighborhoodOption(value: unknown): value is NeighborhoodOption {
  if (typeof value !== "object" || value === null) return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.id === "string" &&
    typeof option.city === "string" &&
    typeof option.district === "string" &&
    typeof option.dong === "string" &&
    typeof option.label === "string" &&
    (typeof option.administrativeCode === "string" ||
      option.administrativeCode === null)
  );
}

function isNeighborhoodPayload(
  value: unknown,
): value is { locations: NeighborhoodOption[] } {
  if (typeof value !== "object" || value === null || !("locations" in value)) {
    return false;
  }
  const payload = value as { locations: unknown };
  return Array.isArray(payload.locations) && payload.locations.every(isNeighborhoodOption);
}

function getResultScopeLabel(
  question: string,
  location: string,
  result: SearchResult,
): string {
  if (result.status === "waste_results") return `${result.regionName} 배출 안내`;
  const citywideSource = result.sources.find(
    (source) => source.category === "waste" && source.regionLevel === "city",
  );
  if (citywideSource) return `${citywideSource.regionName} 공통 안내`;
  if (result.status === "event_results") return "성남시 행사·모집 안내";
  if (result.status === "notice_results") return "성남시 공식 공지 안내";

  if (result.status === "resident_center_results") {
    return `${result.center.district} ${result.center.dong}`;
  }

  const explicitDong = question.match(/([가-힣0-9]{2,}동)(?![가-힣])/u)?.[1];
  if (explicitDong) {
    const explicitDistrict = question.match(/(수정구|중원구|분당구)/u)?.[1];
    const selectedDistrict = location.match(/(수정구|중원구|분당구)/u)?.[1];
    return `${explicitDistrict ?? selectedDistrict ?? ""} ${explicitDong}`.trim();
  }

  const explicitArea = question.match(
    /(?:(?:경기도\s*)?성남시(?:\s+[가-힣0-9]+구)?|서울특별시(?:\s+[가-힣0-9]+구)?|부산광역시(?:\s+[가-힣0-9]+구)?)(?:\s+[가-힣0-9]+동)?/u,
  )?.[0];
  if (explicitArea) return explicitArea.replace(/\s+/gu, " ").trim();

  const selectedDong = location.match(/([가-힣0-9]{2,}동)/u)?.[1];
  if (selectedDong) {
    const selectedDistrict = location.match(/(수정구|중원구|분당구)/u)?.[1];
    return `${selectedDistrict ?? ""} ${selectedDong}`.trim();
  }
  return location;
}

function isValidDestination(facility: FacilitySearchRecord): boolean {
  return getCoordinates(facility) !== null;
}

function isCitation(value: unknown): value is SearchCitation {
  if (typeof value !== "object" || value === null) return false;
  const citation = value as Record<string, unknown>;
  return (
    typeof citation.id === "string" &&
    ["waste", "facility", "notice", "event", "resident_center", "library", "general"].includes(String(citation.category)) &&
    typeof citation.title === "string" &&
    typeof citation.sourceName === "string" &&
    typeof citation.sourceUrl === "string" &&
    /^https?:\/\//i.test(citation.sourceUrl) &&
    typeof citation.regionName === "string" &&
    ["national", "city", "district", "dong"].includes(String(citation.regionLevel)) &&
    (typeof citation.dataAsOf === "string" || citation.dataAsOf === null) &&
    typeof citation.checkedAt === "string" &&
    Array.isArray(citation.fieldIds) &&
    citation.fieldIds.every((fieldId) => typeof fieldId === "string")
  );
}

function isFacilitySearchRecord(value: unknown): value is FacilitySearchRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    [
      "id",
      "name",
      "place",
      "facilityType",
      "address",
      "closedDays",
      "weekdayHours",
      "weekendHours",
      "isPaid",
      "fee",
      "capacity",
      "amenities",
      "applicationMethod",
      "latitude",
      "longitude",
    ].every((key) => typeof record[key] === "string") &&
    (typeof record.administrativeDongName === "string" ||
      record.administrativeDongName === null)
  );
}

function isResidentCenterSearchRecord(
  value: unknown,
): value is ResidentCenterSearchRecord {
  if (typeof value !== "object" || value === null) return false;
  const center = value as Record<string, unknown>;
  return (
    typeof center.id === "string" &&
    (typeof center.administrativeCode === "string" ||
      center.administrativeCode === null) &&
    typeof center.district === "string" &&
    typeof center.dong === "string" &&
    typeof center.centerName === "string" &&
    typeof center.postalCode === "string" &&
    typeof center.address === "string" &&
    typeof center.phone === "string" &&
    (typeof center.latitude === "number" || center.latitude === null) &&
    (typeof center.longitude === "number" || center.longitude === null) &&
    typeof center.dataAsOf === "string"
  );
}

function isSearchResult(value: unknown): value is SearchResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.sources) || !result.sources.every(isCitation)) return false;
  if (result.status === "answered") return typeof result.answer === "string";
  if (result.status === "waste_results") return typeof result.answer === "string" && typeof result.message === "string" && typeof result.regionName === "string" &&
    wasteCategories.some((category) => category === result.category) && wasteHousingTypes.some((housing) => housing === result.housing);
  if (result.status === "notice_results") {
    return typeof result.message === "string" && Array.isArray(result.notices) && result.notices.every((notice) =>
      notice && typeof notice === "object" && officialNotices.some((known) => JSON.stringify(known) === JSON.stringify(notice)));
  }
  if (result.status === "event_results") {
    return typeof result.message === "string" && Array.isArray(result.events) && result.events.every((event) =>
      event && typeof event === "object" && officialEvents.some((known) => known.id === event.id && JSON.stringify(known) === JSON.stringify(event)));
  }
  if (result.status === "facility_results") {
    return (
      typeof result.message === "string" &&
      Number.isInteger(result.total) &&
      Number.isInteger(result.page) &&
      Number.isInteger(result.pageSize) &&
      Array.isArray(result.facilities) &&
      result.facilities.every(isFacilitySearchRecord)
    );
  }
  if (result.status === "resident_center_results") {
    return (
      typeof result.message === "string" &&
      isResidentCenterSearchRecord(result.center)
    );
  }
  return (
    ["link_only", "insufficient", "region_mismatch", "timeout"].includes(String(result.status)) &&
    typeof result.message === "string"
  );
}

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [neighborhoodError, setNeighborhoodError] = useState("");
  const [neighborhoodFilter, setNeighborhoodFilter] = useState("");
  const [showNeighborhoodSuggestions, setShowNeighborhoodSuggestions] = useState(false);
  const [activeNeighborhoodSuggestion, setActiveNeighborhoodSuggestion] = useState(-1);
  const [selectedLocationId, setSelectedLocationId] = useState("citywide");
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [myMenuOpen, setMyMenuOpen] = useState(false);
  const [result, setResult] = useState<DisplayedResult | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [mapSelectionVersion, setMapSelectionVersion] = useState(0);
  const searchRequestId = useRef(0);
  const searchAbortController = useRef<AbortController | null>(null);
  const selectedNeighborhood = neighborhoods.find(
    (neighborhood) => neighborhood.id === selectedLocationId,
  );
  const location = selectedNeighborhood?.label ?? "경기도 성남시";
  const localSchedules = filterEventsByLocation(officialEvents, location);
  const upcomingEvents = getUpcomingEvents(undefined, localSchedules);
  const locationDisplay = selectedNeighborhood
    ? `${selectedNeighborhood.district} ${selectedNeighborhood.dong}`
    : "성남시 전체";
  const filteredNeighborhoods = useMemo(() => {
    const filter = neighborhoodFilter.trim().toLocaleLowerCase();
    const matches = filter
      ? neighborhoods.filter((neighborhood) =>
          `${neighborhood.district} ${neighborhood.dong} ${neighborhood.label}`
            .toLocaleLowerCase()
            .includes(filter),
        )
      : neighborhoods;
    return matches;
  }, [neighborhoodFilter, neighborhoods]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/locations", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("LOCATIONS_UNAVAILABLE");
        const payload: unknown = await response.json();
        if (!isNeighborhoodPayload(payload)) throw new Error("INVALID_LOCATIONS");
        setNeighborhoods(payload.locations);
        const requestedNeighborhood = new URLSearchParams(window.location.search).get("neighborhood");
        if (requestedNeighborhood === "citywide" || payload.locations.some((item) => item.id === requestedNeighborhood)) {
          setSelectedLocationId(requestedNeighborhood!);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNeighborhoodError(
          error instanceof Error && error.message === "LOCATIONS_UNAVAILABLE"
            ? "행정동 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
            : "행정동 목록을 확인할 수 없어요.",
        );
      });
    return () => controller.abort();
  }, []);
  const facilityPoints = useMemo<MapPoint[]>(() => {
    if (result?.result.status !== "facility_results") return [];
    return result.result.facilities
      .filter(isValidDestination)
      .map((facility) => ({
        id: facility.id,
        name: facility.name,
        latitude: Number(facility.latitude),
        longitude: Number(facility.longitude),
      }));
  }, [result]);
  const selectFacility = useCallback((id: string) => {
    setSelectedFacilityId(id);
    setMapSelectionVersion((version) => version + 1);
  }, []);

  function updateQuestion(value: string) {
    searchRequestId.current += 1;
    searchAbortController.current?.abort();
    searchAbortController.current = null;
    setQuestion(value);
    setResult(null);
    setSearchError("");
    setIsSearching(false);
    setCurrentPage(1);
    setSelectedFacilityId(null);
  }

  function updateLocation(value: string) {
    if (value === selectedLocationId) return;
    if (value !== "citywide" && !neighborhoods.some((item) => item.id === value)) return;
    searchRequestId.current += 1;
    searchAbortController.current?.abort();
    searchAbortController.current = null;
    setSelectedLocationId(value);
    setResult(null);
    setSearchError("");
    setIsSearching(false);
    setCurrentPage(1);
    setSelectedFacilityId(null);
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("neighborhood", value);
    pageUrl.hash = "neighborhood";
    window.location.assign(pageUrl.toString());
  }

  function selectNeighborhoodSuggestion(neighborhood: NeighborhoodOption) {
    updateLocation(neighborhood.id);
    setNeighborhoodFilter(neighborhood.dong);
    setShowNeighborhoodSuggestions(false);
    setActiveNeighborhoodSuggestion(-1);
  }

  async function performSearch(page: number, append = false) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    searchRequestId.current += 1;
    const requestId = searchRequestId.current;
    searchAbortController.current?.abort();
    const abortController = new AbortController();
    searchAbortController.current = abortController;
    if (!append) {
      setResult(null);
      setCurrentPage(1);
      setSelectedFacilityId(null);
    }
    setSearchError("");
    setIsSearching(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, location, page }),
        signal: abortController.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload &&
          typeof payload.message === "string"
            ? payload.message
            : "검색 요청을 완료하지 못했어요.";
        throw new Error(message);
      }
      if (!isSearchResult(payload)) {
        throw new Error("검색 응답을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.");
      }
      if (requestId !== searchRequestId.current) return;
      setResult((previous) => {
        if (
          append &&
          previous?.result.status === "facility_results" &&
          payload.status === "facility_results" &&
          previous.question === trimmedQuestion &&
          previous.location === location
        ) {
          return {
            ...previous,
            result: {
              ...payload,
              facilities: [...previous.result.facilities, ...payload.facilities],
            },
          };
        }
        return {
          result: payload,
          question: trimmedQuestion,
          location,
          scopeLabel: getResultScopeLabel(trimmedQuestion, location, payload),
        };
      });
      setCurrentPage(payload.status === "facility_results" ? payload.page : 1);
    } catch (error) {
      if (abortController.signal.aborted || requestId !== searchRequestId.current) return;
      setSearchError(
        error instanceof Error ? error.message : "검색 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      if (requestId === searchRequestId.current) {
        searchAbortController.current = null;
        setIsSearching(false);
      }
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performSearch(1);
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="app-brand" href="#top" aria-label="동네일 홈">
            <span className="brand-mark"><House size={19} strokeWidth={2.7} /></span>
            <span>동네일</span>
          </a>
          <nav className="app-nav" aria-label="주요 메뉴">
            <a className="app-nav-link is-current" href="#top">홈</a>
            <button
              className={`app-nav-link info-menu-trigger${infoMenuOpen ? " is-open" : ""}`}
              type="button"
              aria-expanded={infoMenuOpen}
              onClick={() => setInfoMenuOpen((isOpen) => !isOpen)}
            >
              동네 정보 <ChevronDown size={15} />
            </button>
            <a className="app-nav-link" href="#news">동네 소식</a>
            <button
              className={`app-nav-link my-menu-trigger${myMenuOpen ? " is-open" : ""}`}
              type="button"
              aria-expanded={myMenuOpen}
              onClick={() => setMyMenuOpen((isOpen) => !isOpen)}
            >My</button>
          </nav>
          {myMenuOpen && (
            <div className="my-menu" role="status">
              <strong>My 메뉴</strong>
              <p>회원 기능은 아직 연결되지 않았어요.</p>
              <a href="#neighborhood">내 동네 설정 보기 <ChevronRight size={14} /></a>
            </div>
          )}
        </div>
      </header>

      <div className={`info-subnav-wrap${infoMenuOpen ? " is-open" : ""}`} aria-hidden={!infoMenuOpen}>
        <nav className="info-subnav content-width" aria-label="동네 정보 하위 메뉴" inert={!infoMenuOpen}>
          <a href="#notices" onClick={() => setInfoMenuOpen(false)}>주요 공지</a>
          <a href="#waste-info" onClick={() => setInfoMenuOpen(false)}>생활폐기물 배출 정보</a>
          <a href="#town-map" onClick={() => setInfoMenuOpen(false)}>동네 지도</a>
        </nav>
      </div>

      <main id="top">
        <section className="region-section" id="neighborhood">
          <div className="region-panel content-width">
            <div className="region-heading">
              <span className="region-icon"><MapPin size={19} /></span>
              <div>
                <h1>어느 동네에 살고 있으세요?</h1>
                <p>행정동을 선택하면 기본 검색 지역으로 적용돼요. 성남시 전체 검색도 별도로 선택할 수 있어요.</p>
              </div>
            </div>

            <div className="region-controls">
              <div className="region-field region-dong-filter" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setShowNeighborhoodSuggestions(false);
                  setActiveNeighborhoodSuggestion(-1);
                }
              }}>
                <label htmlFor="neighborhood-search">행정동 검색</label>
                <input
                  id="neighborhood-search"
                  type="search"
                  value={neighborhoodFilter}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="neighborhood-suggestions"
                  aria-expanded={showNeighborhoodSuggestions && neighborhoodFilter.trim().length > 0}
                  aria-activedescendant={activeNeighborhoodSuggestion >= 0 ? `neighborhood-suggestion-${activeNeighborhoodSuggestion}` : undefined}
                  onFocus={() => setShowNeighborhoodSuggestions(true)}
                  onChange={(event) => {
                    setNeighborhoodFilter(event.target.value);
                    setShowNeighborhoodSuggestions(true);
                    setActiveNeighborhoodSuggestion(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === "Escape") { setShowNeighborhoodSuggestions(false); setActiveNeighborhoodSuggestion(-1); return; }
                    if (!neighborhoodFilter.trim() || !filteredNeighborhoods.length) return;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      setShowNeighborhoodSuggestions(true);
                      setActiveNeighborhoodSuggestion((index) => event.key === "ArrowDown"
                        ? (index + 1) % filteredNeighborhoods.length
                        : (index <= 0 ? filteredNeighborhoods.length - 1 : index - 1));
                    } else if (event.key === "Enter" && showNeighborhoodSuggestions && activeNeighborhoodSuggestion >= 0) {
                      event.preventDefault();
                      selectNeighborhoodSuggestion(filteredNeighborhoods[activeNeighborhoodSuggestion]);
                    }
                  }}
                  placeholder="예: 은행 → 은행1동, 은행2동"
                  maxLength={30}
                />
                {showNeighborhoodSuggestions && neighborhoodFilter.trim() && (
                  <ul id="neighborhood-suggestions" className="neighborhood-suggestions" role="listbox" aria-label="행정동 검색 결과">
                    {filteredNeighborhoods.map((neighborhood, index) => (
                      <li key={neighborhood.id} role="presentation">
                        <button
                          id={`neighborhood-suggestion-${index}`}
                          type="button" role="option"
                          aria-selected={activeNeighborhoodSuggestion === index}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectNeighborhoodSuggestion(neighborhood)}
                        >
                          <strong>{neighborhood.dong}</strong><span>성남시 {neighborhood.district}</span>
                        </button>
                      </li>
                    ))}
                    {filteredNeighborhoods.length === 0 && <li role="presentation">일치하는 행정동이 없어요.</li>}
                  </ul>
                )}
              </div>
              <label className="region-field region-neighborhood-select">
                <span>검색 기본 지역</span>
                <select
                  value={selectedLocationId}
                  onChange={(event) => updateLocation(event.target.value)}
                  aria-label="기본 검색 지역 선택"
                >
                  <option value="citywide">경기도 성남시 전체</option>
                  {(["수정구", "중원구", "분당구"] as const).map((district) => {
                    const districtLocations = neighborhoods.filter(
                      (neighborhood) => neighborhood.district === district,
                    );
                    return districtLocations.length > 0 ? (
                      <optgroup key={district} label={district}>
                        {districtLocations.map((neighborhood) => (
                          <option key={neighborhood.id} value={neighborhood.id}>
                            {neighborhood.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </label>
            </div>
            {neighborhoodError && <p className="search-feedback search-feedback-error" role="alert">{neighborhoodError}</p>}
            <p className="selected-location">
              현재 기본 지역: <strong>{location}</strong>
              {!selectedNeighborhood && <span>· 시 단위</span>}
            </p>
          </div>
        </section>

        <section className="home-hero" id="search">
          <div className="home-hero-inner content-width">
            <div className="hero-copy home-hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> 근거 기반 검색</span>
              <h2>궁금한 우리 동네일,<br /><span>무엇이든지 물어보세요.</span></h2>
              <p>선택한 동네의 생활정보를 검색해 보세요.</p>
              <div className="hero-note"><ShieldCheck size={15} /> 검증된 근거가 있을 때만 AI 답변을 생성해요</div>
            </div>

            <div className="hero-art" aria-hidden="true">
              <span className="sun-disc" />
              <span className="cloud cloud-one" />
              <span className="cloud cloud-two" />
              <span className="hill hill-back" />
              <span className="hill hill-front" />
              <div className="town-scene">
                <div className="building building-small"><i /><i /><i /><i /></div>
                <div className="building building-mid"><i /><i /><i /><i /><i /><i /></div>
                <div className="town-hall"><MapPinned size={30} strokeWidth={1.6} /><span>우리 동네</span></div>
                <div className="building building-tall"><i /><i /><i /><i /><i /><i /></div>
                <div className="tree tree-one" /><div className="tree tree-two" />
              </div>
            </div>

            <div className="search-wrap home-search-wrap">
              <form className="search-form" onSubmit={handleSearch}>
                <label className="location-select">
                  <MapPin size={19} aria-hidden="true" />
                  <span className="sr-only">기본 검색 지역</span>
                  <span>{locationDisplay} · {selectedNeighborhood ? "행정동" : "시 단위"}</span>
                </label>
                <span className="search-divider" />
                <label className="question-input">
                  <Search size={20} aria-hidden="true" />
                  <span className="sr-only">동네 생활정보 질문</span>
                  <input
                    value={question}
                    onChange={(event) => updateQuestion(event.target.value)}
                    placeholder="우리 동네 쓰레기 언제 버려?"
                    maxLength={500}
                  />
                </label>
                <button className="search-button" type="submit" aria-label="검색하기" disabled={isSearching}>
                  <span>{isSearching ? "검색 중" : "검색하기"}</span><Search size={17} />
                </button>
              </form>
              {isSearching && <p className="search-feedback" role="status">자료를 확인하고 있어요…</p>}
              {searchError && <p className="search-feedback search-feedback-error" role="alert">{searchError}</p>}
              <div className="example-questions">
                <span>이렇게 물어보세요</span>
                {exampleQuestions.map((item) => (
                <button key={item} type="button" onClick={() => updateQuestion(item)}>{item}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {result && (
          <section className="result-section content-width" aria-live="polite" aria-labelledby="result-title">
            <div className="result-heading">
              <div>
                <span className="section-kicker">검색 결과</span>
                <h2 id="result-title">
                  {result.scopeLabel.endsWith("안내")
                    ? result.scopeLabel
                    : `${result.scopeLabel}의 검색 결과`}
                </h2>
                <p className="result-question">질문: “{result.question}”</p>
              </div>
              <span className={`search-result-badge search-result-${result.result.status}`}>
                {result.result.status === "answered"
                  ? "검증 근거 기반 답변"
                  : result.result.status === "waste_results"
                    ? "공식 배출 안내"
                  : result.result.status === "notice_results"
                    ? "공식 공지 목록"
                  : result.result.status === "event_results"
                    ? "공식 행사·모집 일정"
                  : result.result.status === "facility_results"
                    ? "공공시설 자료 검색"
                    : result.result.status === "resident_center_results"
                      ? "행정복지센터 자료"
                    : result.result.status === "link_only"
                      ? "공식 사이트에서 확인"
                      : "공식 출처 확인 안내"}
              </span>
            </div>
            <article className="result-card">
              <div className="answer-block">
                <span className="answer-label">
                  <Sparkles size={15} />
                  {result.result.status === "answered"
                    ? "자료에 근거한 답변"
                    : result.result.status === "waste_results"
                      ? "생활폐기물 배출 안내"
                    : result.result.status === "notice_results"
                      ? "확인한 공지 게시물"
                    : result.result.status === "event_results"
                      ? "공식 행사일·모집기간"
                    : result.result.status === "facility_results"
                      ? "공식 시설 자료 검색 결과"
                      : result.result.status === "resident_center_results"
                        ? "주민센터 정보"
                      : result.result.status === "link_only"
                        ? "공식 안내 페이지"
                        : "답변 생성 안 함"}
                </span>
                {(result.result.status === "answered" || result.result.status === "waste_results"
                  ? result.result.answer : result.result.message).split(/\n\n/u).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              </div>
              {result.result.status === "event_results" && result.result.events.map((event) => <OfficialEventCard key={event.id} event={event} />)}
              {result.result.status === "notice_results" && <OfficialNoticeList notices={result.result.notices} />}
              {result.result.status === "facility_results" && (
                <div className="facility-results">
                  <p className="facility-result-count">
                    총 {result.result.total}건 중 {result.result.facilities.length}건을 표시해요.
                  </p>
                  <div id="facility-web-map" tabIndex={-1}>
                  <NeighborhoodMap
                    points={facilityPoints}
                    selectedPointId={selectedFacilityId}
                    selectionVersion={mapSelectionVersion}
                    onSelectPoint={selectFacility}
                  />
                  </div>
                  {result.result.facilities.map((facility) => (
                    <article
                      className={`facility-result${selectedFacilityId === facility.id ? " is-selected" : ""}`}
                      key={facility.id}
                    >
                      <div className="facility-result-heading">
                        <span>{facility.facilityType}</span>
                        <button
                          className="facility-select"
                          type="button"
                          aria-pressed={selectedFacilityId === facility.id}
                          onClick={() => selectFacility(facility.id)}
                        >
                          {facility.name}
                        </button>
                      </div>
                      <p>{facility.address}</p>
                      <dl>
                        {facility.closedDays && <div><dt>휴관일</dt><dd>{facility.closedDays}</dd></div>}
                        {(facility.weekdayHours || facility.weekendHours) && (
                          <div>
                            <dt>운영시간</dt>
                            <dd>
                              {facility.weekdayHours ? `평일 ${facility.weekdayHours}` : ""}
                              {facility.weekdayHours && facility.weekendHours ? " · " : ""}
                              {facility.weekendHours ? `주말 ${facility.weekendHours}` : ""}
                            </dd>
                          </div>
                        )}
                        {facility.isPaid && (
                          <div>
                            <dt>이용료 유료 여부</dt>
                            <dd>{facility.isPaid === "Y" ? `예${facility.fee ? ` · ${facility.fee}` : " · 금액 정보 없음"}` : "아니오"}</dd>
                          </div>
                        )}
                      </dl>
                      {facility.capacity && (
                        <p className="facility-result-note">수용 인원 {facility.capacity}</p>
                      )}
                      {isValidDestination(facility) && (
                        <DirectionsLink
                          destination={facility}
                          searchUrl={getNaverMapSearchUrl(facility.name, "성남시")!}
                        />
                      )}
                    </article>
                  ))}
                  {result.result.facilities.length < result.result.total && (
                    <button
                      className="search-button facility-results-more"
                      type="button"
                      disabled={isSearching}
                      onClick={() => void performSearch(currentPage + 1, true)}
                    >
                      {isSearching ? "불러오는 중…" : "더 보기"}
                    </button>
                  )}
                </div>
              )}
              {result.result.status === "resident_center_results" && (
                <article className="resident-center-result">
                  <div className="resident-center-result-heading">
                    <span>{result.result.center.district} · {result.result.center.dong}</span>
                    <h3>{result.result.center.centerName}</h3>
                  </div>
                  <dl>
                    {result.result.center.address && (
                      <div><dt>주소</dt><dd>{result.result.center.address}</dd></div>
                    )}
                    {result.result.center.postalCode && (
                      <div><dt>우편번호</dt><dd>{result.result.center.postalCode}</dd></div>
                    )}
                    {result.result.center.phone && (
                      <div><dt>전화</dt><dd><a href={`tel:${result.result.center.phone}`}>{result.result.center.phone}</a></dd></div>
                    )}
                  </dl>
                  {result.result.center.centerName.trim() && (
                    <ResidentCenterMap key={result.result.center.id} center={result.result.center} />
                  )}
                </article>
              )}
              {result.result.sources.length > 0 ? (
                <div className="result-sources">
                  <h3>
                    {result.result.status === "event_results"
                      ? "행사·모집 출처"
                      : result.result.status === "facility_results"
                      ? "시설 자료 출처"
                      : result.result.status === "resident_center_results"
                        ? "주민센터 자료 출처"
                      : result.result.status === "link_only"
                        ? "공식 안내 사이트"
                        : "공식 자료 및 확인 경로"}
                  </h3>
                  {result.result.sources.map((source) => (
                    <article className="result-source" key={source.id}>
                      <div>
                        <strong>{source.title}</strong>
                        <p>
                          적용 범위: {source.regionName}
                          {source.dataAsOf ? ` · 데이터 기준일: ${source.dataAsOf}` : ""}
                          {" · 확인일: "}{source.checkedAt}
                        </p>
                      </div>
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                        {source.sourceName}에서 확인 <ExternalLink size={14} />
                      </a>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="result-location-note">검색 지역: {result.location}</p>
              )}
            </article>
          </section>
        )}

        <section className="home-content content-width" aria-labelledby="home-content-title">
          <div className="home-content-heading">
            <div>
              <span className="section-kicker">우리 동네 업데이트</span>
              <h2 id="home-content-title">오늘의 동네 소식</h2>
            </div>
            <span className="area-badge"><MapPin size={14} /> {locationDisplay}</span>
          </div>
          <div className="home-feed-grid">
            <section className="feed-panel" id="notices" aria-labelledby="notices-title">
              <div className="feed-panel-heading">
                <div className="feed-panel-icon notices-icon"><Newspaper size={19} /></div>
                <div><h2 id="notices-title">주요 공지</h2><p>성남시 공지</p></div>
                <a href="https://www.seongnam.go.kr/bbs010101" target="_blank" rel="noreferrer" aria-label="성남시 공식 공지 확인">
                  <ChevronRight size={19} />
                </a>
              </div>
              <p className="feed-empty">성남시의 최근 소식을 확인해 보세요.</p>
              <OfficialNoticeList notices={officialNotices.slice(0, 3)} />
              <a className="feed-official-link" href="https://www.seongnam.go.kr/bbs010101" target="_blank" rel="noreferrer">
                성남시 공지사항 <ExternalLink size={14} />
              </a>
            </section>
            <section className="feed-panel" id="news" aria-labelledby="news-title">
              <div className="feed-panel-heading">
                <div className="feed-panel-icon news-icon"><MessagesSquare size={19} /></div>
                <div><h2 id="news-title">동네 소식</h2><p>공식 행사·모집·프로그램</p></div>
                <span className="coming-soon">예정 일정 {upcomingEvents.length}건</span>
              </div>
              <p className="feed-empty">우리 지역 행사와 성남시민을 위한 프로그램을 만나보세요.</p>
              {upcomingEvents.map((event) => <OfficialEventCard key={event.id} event={event} />)}
              {upcomingEvents.length === 0 && <p className="feed-empty">아직 등록된 예정 일정이 없어요. 더 많은 소식은 성남시 공식 안내에서 확인해 보세요.</p>}
              <a className="feed-official-link" href="https://www.seongnam.go.kr/apply/index" target="_blank" rel="noreferrer">
                성남시 공식 행사·모집 확인 <ExternalLink size={14} />
              </a>
              <a className="feed-official-link" href="#local-calendar">생활 캘린더로 이동 <ChevronRight size={14} /></a>
            </section>
          </div>
          <CommunityCalendar schedules={localSchedules} />
        </section>

        <section className="info-details content-width" aria-labelledby="info-details-title">
          <div className="info-details-heading">
            <div><span className="section-kicker">동네 정보</span><h2 id="info-details-title">생활에 필요한 정보를 찾아요</h2></div>
            <span>확인된 자료만 표시</span>
          </div>
          <div className="info-detail-grid">
            <WasteGuide key={location} location={location} />
            {neighborhoods.length > 0 ? <TownMap key={selectedLocationId} locationId={selectedLocationId} /> : <article className="info-detail-card" id="town-map"><h3>동네 지도</h3><p>동네 목록을 불러오면 시설 지도를 표시해요.</p></article>}
          </div>
        </section>

        <section className="service-note" aria-label="서비스 연동 안내">
          <div className="service-note-inner content-width">
            <ShieldCheck size={20} />
            <p><strong>우리 동네의 공식 소식을 모아 안내해 드려요.</strong> 일정과 이용 방법은 바뀔 수 있으니 방문·신청 전 공식 안내를 확인해 주세요.</p>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner content-width">
          <div className="footer-intro">
            <a className="app-brand footer-brand" href="#top"><span className="brand-mark"><House size={17} strokeWidth={2.7} /></span><span>동네일</span></a>
            <p>우리 동네 생활정보를 더 가깝게</p>
          </div>
          <div className="official-sites">
            <h2>공공기관 공식 사이트</h2>
            <a href="https://www.gov.kr/" target="_blank" rel="noreferrer">정부24 <ExternalLink size={13} /></a>
            <a href="https://www.mois.go.kr/" target="_blank" rel="noreferrer">행정안전부 <ExternalLink size={13} /></a>
            <a href="https://www.epeople.go.kr/" target="_blank" rel="noreferrer">국민신문고 <ExternalLink size={13} /></a>
          </div>
          <span className="footer-copyright">© 2026 동네일 · 서비스 준비 중</span>
        </div>
      </footer>
    </>
  );
}
