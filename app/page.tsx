"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarDays,
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

const locations = [
  "서울특별시 종로구 청운효자동",
  "서울특별시 마포구 연남동",
  "부산광역시 수영구 광안동",
  "경기도 성남시 분당구 정자동",
];

const exampleQuestions = [
  "우리 동네 쓰레기 언제 버려?",
  "가까운 주민센터 어디야?",
  "이번 주 동네 행사 있어?",
];

const notices = [
  {
    category: "생활 안내",
    title: "생활폐기물 배출 정보 확인 안내",
    description: "배출 요일과 품목별 기준은 거주지 지자체의 공식 공지를 확인해 주세요.",
    date: "2026.11.03",
  },
  {
    category: "주민센터 안내",
    title: "우리 동네 공공시설 정보 안내",
    description: "공공시설 운영 여부와 이용 시간은 각 기관의 공지에서 확인할 수 있어요.",
    date: "2026.11.01",
  },
];

const localNews = [
  {
    category: "동네 소식",
    title: "이웃과 함께 만드는 동네 소식",
    description: "이 영역에는 선택한 지역의 생활 소식이 표시될 예정이에요.",
    date: "2026.11.03",
  },
  {
    category: "생활 정보",
    title: "우리 동네에 필요한 정보를 모아요",
    description: "지역별 소식과 일정은 실제 데이터 연동 후 제공됩니다.",
    date: "2026.11.02",
  },
];

type SearchResult = {
  question: string;
  location: string;
};

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [location, setLocation] = useState(locations[0]);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationOpen, setLocationOpen] = useState(true);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [myMenuOpen, setMyMenuOpen] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const filteredLocations = locations.filter((item) => item.includes(locationSearch.trim()));

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setResult({ question: trimmedQuestion, location });
  }

  function renderFeed(items: typeof notices) {
    return items.map((item) => (
      <article className="feed-card" key={item.title}>
        <div className="feed-card-heading">
          <span className="feed-category">{item.category}</span>
          <span className="sample-tag">예시 데이터</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <div className="feed-card-meta"><CalendarDays size={14} /> {item.date}</div>
      </article>
    ));
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
          <span className="header-status"><span /> 예시 화면</span>
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
                <p>동네를 선택하면 지역에 맞는 생활정보를 찾아볼 수 있어요.</p>
              </div>
              <button
                className="region-toggle"
                type="button"
                aria-expanded={locationOpen}
                aria-controls="region-picker"
                onClick={() => setLocationOpen((isOpen) => !isOpen)}
              >
                {locationOpen ? "접기" : "동네 선택"} <ChevronDown size={16} />
              </button>
            </div>

            <div
              className={`region-content${locationOpen ? " is-open" : ""}`}
              id="region-picker"
              aria-hidden={!locationOpen}
            >
              <div className="region-content-inner" inert={!locationOpen}>
                <label className="region-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">동네 검색</span>
                  <input
                    value={locationSearch}
                    onChange={(event) => setLocationSearch(event.target.value)}
                    placeholder="시·군·구 또는 읍·면·동 검색"
                  />
                  <span className="region-search-note">예시 지역</span>
                </label>
                <div className="location-options" aria-label="선택 가능한 예시 지역">
                  {filteredLocations.length > 0 ? filteredLocations.map((item) => (
                    <button
                      className={`location-option${location === item ? " is-selected" : ""}`}
                      key={item}
                      type="button"
                      aria-pressed={location === item}
                      onClick={() => setLocation(item)}
                    >
                      <MapPin size={14} /> {item}
                    </button>
                  )) : <p className="no-locations">일치하는 예시 지역이 없어요.</p>}
                </div>
                <p className="selected-location"><span>선택한 동네</span><strong>{location}</strong></p>
              </div>
            </div>
          </div>
        </section>

        <section className="home-hero" id="search">
          <div className="home-hero-inner content-width">
            <div className="hero-copy home-hero-copy">
              <span className="eyebrow"><Sparkles size={15} /> AI 통합검색 <span className="hero-example-label">예시 답변</span></span>
              <h2>궁금한 우리 동네일,<br /><span>무엇이든지 물어보세요.</span></h2>
              <p>선택한 동네의 생활정보를 자연어로 검색해 보세요.</p>
              <div className="hero-note"><ShieldCheck size={15} /> 실제 AI·지역 데이터는 아직 연결되지 않았어요</div>
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
                  <span className="sr-only">검색할 읍·면·동 선택</span>
                  <select value={location} onChange={(event) => setLocation(event.target.value)}>
                    {locations.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <span className="search-divider" />
                <label className="question-input">
                  <Search size={20} aria-hidden="true" />
                  <span className="sr-only">동네 생활정보 질문</span>
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="우리 동네 쓰레기 언제 버려?"
                  />
                </label>
                <button className="search-button" type="submit" aria-label="검색하기"><span>검색하기</span><Search size={17} /></button>
              </form>
              <div className="example-questions">
                <span>이렇게 물어보세요</span>
                {exampleQuestions.map((item) => (
                  <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>
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
                <h2 id="result-title">“{result.question}”</h2>
              </div>
              <span className="sample-badge"><span /> 예시 데이터</span>
            </div>
            <article className="result-card">
              <div className="answer-block">
                <span className="answer-label"><Sparkles size={15} /> 동네일의 답변 예시</span>
                <p>배출 요일과 품목별 방법은 동네마다 달라요. 현재는 실제 지역 공지를 조회하지 않은 예시 화면이에요. 거주지 주민센터 안내에서 배출 요일과 지정 장소를 확인해 주세요.</p>
              </div>
              <dl className="result-meta">
                <div><dt>공식 출처</dt><dd>정부24 · 지자체 생활정보 확인 경로</dd></div>
                <div><dt>적용 지역</dt><dd>{result.location}</dd></div>
                <div><dt>기준일</dt><dd>2026년 11월 3일</dd></div>
              </dl>
              <a className="official-link" href="https://www.gov.kr/" target="_blank" rel="noreferrer">
                정부24 공식 홈페이지에서 확인하기 <ExternalLink size={16} />
              </a>
            </article>
          </section>
        )}

        <section className="home-content content-width" aria-labelledby="home-content-title">
          <div className="home-content-heading">
            <div>
              <span className="section-kicker">우리 동네 업데이트</span>
              <h2 id="home-content-title">오늘의 동네 소식</h2>
            </div>
            <span className="area-badge"><MapPin size={14} /> {location}</span>
          </div>
          <div className="home-feed-grid">
            <section className="feed-panel" id="notices" aria-labelledby="notices-title">
              <div className="feed-panel-heading">
                <div className="feed-panel-icon notices-icon"><Newspaper size={19} /></div>
                <div><h2 id="notices-title">주요 공지</h2><p>선택한 동네의 생활 안내</p></div>
                <a href="#waste-info" aria-label="생활폐기물 배출 정보 더 보기"><ChevronRight size={19} /></a>
              </div>
              <div className="feed-list">{renderFeed(notices)}</div>
            </section>
            <section className="feed-panel" id="news" aria-labelledby="news-title">
              <div className="feed-panel-heading">
                <div className="feed-panel-icon news-icon"><MessagesSquare size={19} /></div>
                <div><h2 id="news-title">동네 소식</h2><p>이웃과 나누는 우리 동네 이야기</p></div>
                <span className="coming-soon">준비 중</span>
              </div>
              <div className="feed-list">{renderFeed(localNews)}</div>
            </section>
          </div>
          <p className="feed-disclaimer"><ShieldCheck size={14} /> 공지와 소식은 화면 구성용 예시 데이터이며, 실제 지역 게시물이나 실시간 정보가 아닙니다.</p>
        </section>

        <section className="info-details content-width" aria-labelledby="info-details-title">
          <div className="info-details-heading">
            <div><span className="section-kicker">동네 정보</span><h2 id="info-details-title">생활에 필요한 정보를 찾아요</h2></div>
            <span>공식 정보 연동 전 예시 화면</span>
          </div>
          <div className="info-detail-grid">
            <article className="info-detail-card" id="waste-info">
              <span className="detail-icon waste-detail-icon"><Newspaper size={20} /></span>
              <span className="detail-status">연동 예정</span>
              <h3>생활폐기물 배출 정보</h3>
              <p>배출 요일과 품목별 안내는 지역별 공식 공지를 확인해 주세요. 동네일은 아직 해당 정보를 조회하지 않습니다.</p>
              <a href="https://www.gov.kr/" target="_blank" rel="noreferrer">정부24에서 확인 <ExternalLink size={14} /></a>
            </article>
            <article className="info-detail-card" id="town-map">
              <span className="detail-icon map-detail-icon"><MapPinned size={20} /></span>
              <span className="detail-status">연동 예정</span>
              <h3>동네 지도</h3>
              <p>지도와 주변 공공시설 검색은 아직 연결되지 않았습니다. 기관별 공식 안내를 이용해 주세요.</p>
              <a href="https://www.mois.go.kr/" target="_blank" rel="noreferrer">행정안전부에서 확인 <ExternalLink size={14} /></a>
            </article>
          </div>
        </section>

        <section className="service-note" aria-label="서비스 연동 안내">
          <div className="service-note-inner content-width">
            <ShieldCheck size={20} />
            <p><strong>동네일은 현재 예시 화면입니다.</strong> AI 검색·지역별 공지·지도·회원 기능은 이후 단계에서 연결할 예정입니다.</p>
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

