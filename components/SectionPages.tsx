"use client";

import React from "react";
import { ArrowRight, ArrowUpRight, Building2, CalendarDays, ChevronRight, MapPinned, Newspaper, Recycle } from "lucide-react";
import { pageLink, mainSection, type PageView } from "@/lib/navigation";
import { officialNotices } from "@/lib/official-notices";
import { getEventDates, getUpcomingEvents, type OfficialEvent } from "@/lib/official-events";
import { OfficialEventCard } from "./OfficialEventCard";
import { OfficialNoticeList } from "./OfficialNoticeList";
import { CommunityCalendar } from "./CommunityCalendar";
import { WasteGuide } from "./WasteGuide";
import { TownMap } from "./TownMap";
import { CommunityBoard } from "./CommunityBoard";
import { PublicFacilities } from "./PublicFacilities";

const lifeLinks = [
  { path: "/life/facilities", title: "공공시설", text: "운동하고, 배우고, 함께 쓰는 동네 공간", icon: Building2, color: "blue" },
  { path: "/life/waste", title: "생활폐기물 배출 안내", text: "언제, 어떻게 버리는지 품목별로 확인해요", icon: Recycle, color: "green" },
  { path: "/life/map", title: "동네 지도", text: "주민센터와 주변 공공시설을 한눈에", icon: MapPinned, color: "violet" },
];
const newsLinks = [
  { path: "/news/notices", title: "주요 공지", text: "놓치지 말아야 할 성남시 소식", icon: Newspaper, color: "blue" },
  { path: "/news/events", title: "동네 행사", text: "우리 지역 행사와 함께하는 프로그램", icon: CalendarDays, color: "green" },
  { path: "/news/calendar", title: "생활 캘린더", text: "행사·강좌 일정을 날짜별로 살펴봐요", icon: CalendarDays, color: "violet" },
];

function NavigationCards({ items, neighborhood }: { items: typeof lifeLinks; neighborhood: string }) {
  return <div className="section-navigation">{items.map(({ path, title, text, icon: Icon, color }) => <a key={path} className="section-navigation-card" href={pageLink(path, neighborhood)}><span className={`navigation-card-icon tone-${color}`}><Icon size={26} /></span><span><strong>{title}</strong><span>{text}</span></span><ArrowRight size={21} /></a>)}</div>;
}

function NoticeHeadlines() {
  return <ul className="headline-list">{officialNotices.slice(0, 3).map((notice) => <li key={notice.id}><a href={notice.sourceUrl} target="_blank" rel="noreferrer"><span><small>성남시 공지 · {notice.publishedOn}</small><strong>{notice.title}</strong></span><ArrowUpRight size={18} /></a></li>)}</ul>;
}
function EventHeadlines({ events }: { events: readonly OfficialEvent[] }) {
  const upcoming = getUpcomingEvents(undefined, events).slice(0, 3);
  return upcoming.length ? <ul className="headline-list">{upcoming.map((event) => <li key={event.id}><a href={event.sourceUrl} target="_blank" rel="noreferrer"><span><small>{event.displayRegion} · {getEventDates(event).join(" · ")}</small><strong>{event.title}</strong></span><ArrowUpRight size={18} /></a></li>)}</ul> : <p className="section-empty">확인된 예정 소식이 아직 없어요. 다른 일정은 공식 안내에서 살펴보세요.</p>;
}

export function HomeOverview({ neighborhood, events }: { neighborhood: string; events: readonly OfficialEvent[] }) {
  return <div className="home-overview content-width">
    <section className="home-shortcuts" aria-labelledby="home-life-title"><div className="section-heading"><div><span className="section-kicker">자주 찾는 생활정보</span><h2 id="home-life-title">어떤 정보가 필요하세요?</h2></div><a href={pageLink("/life", neighborhood)}>생활안내 <ChevronRight size={18} /></a></div><NavigationCards items={lifeLinks} neighborhood={neighborhood} /></section>
    <section className="home-news-preview" aria-labelledby="home-news-title"><div className="section-heading"><div><span className="section-kicker">우리 동네 업데이트</span><h2 id="home-news-title">가까이 있는 소식</h2></div><a href={pageLink("/news", neighborhood)}>전체 소식 <ChevronRight size={18} /></a></div><div className="preview-grid"><article className="preview-panel"><div className="preview-panel-heading"><h3><Newspaper size={20} /> 주요 공지</h3><a href={pageLink("/news/notices", neighborhood)}>더 보기 <ChevronRight size={16} /></a></div><NoticeHeadlines /></article><article className="preview-panel"><div className="preview-panel-heading"><h3><CalendarDays size={20} /> 동네 행사</h3><a href={pageLink("/news/events", neighborhood)}>더 보기 <ChevronRight size={16} /></a></div><EventHeadlines events={events} /></article></div><p className="preview-source-note">출처: 성남시 공식 게시물 · 자세한 내용과 신청 여부는 원문에서 확인해 주세요.</p></section>
  </div>;
}

const pageCopy: Partial<Record<PageView, { title: string; description: string }>> = {
  life: { title: "우리 동네 생활안내", description: "공공시설부터 쓰레기 배출까지, 일상에 필요한 정보를 찾아요." },
  facilities: { title: "함께 이용하는 공공시설", description: "운동하고, 배우고, 모일 수 있는 성남시 공공시설을 살펴보세요." },
  waste: { title: "생활폐기물 배출 안내", description: "품목과 주택 유형에 맞는 방법을 확인해 보세요." },
  map: { title: "동네를 가까이, 동네 지도", description: "주민센터와 주변 시설을 지도에서 살펴보세요." },
  news: { title: "우리 동네 소식", description: "성남시 공지와 지역 행사, 생활 일정을 모았어요." },
  notices: { title: "성남시 주요 공지", description: "확인된 공식 소식을 전해드려요. 자세한 내용은 원문에서 확인해 주세요." },
  events: { title: "동네에서 만나는 행사", description: "선택한 구의 행사와 성남시 공통 프로그램을 확인하세요." },
  calendar: { title: "우리 동네 생활 캘린더", description: "강좌·행사일을 살펴보고, 날짜를 눌러 자세히 확인해 보세요." },
};

export function SectionContent({ view, neighborhood, location, locationDisplay, ready, events }: { view: PageView; neighborhood: string; location: string; locationDisplay: string; ready: boolean; events: readonly OfficialEvent[] }) {
  const copy = pageCopy[view];
  const parent = mainSection(view);
  return <div className={`section-page content-width page-${view}`} id="community-top">
    <nav className="page-breadcrumb" aria-label="현재 위치"><a href={pageLink("/", neighborhood)}>홈</a><ChevronRight size={14} /><a href={pageLink(parent === "life" ? "/life" : parent === "news" ? "/news" : "/community", neighborhood)}>{parent === "life" ? "생활안내" : parent === "news" ? "동네소식" : "커뮤니티"}</a>{!["life", "news", "community"].includes(view) && <><ChevronRight size={14} /><span>{copy?.title}</span></>}</nav>
    {view === "community" ? <CommunityBoard key={neighborhood} neighborhood={locationDisplay === "성남시 전체" ? "성남시" : locationDisplay.split(" ").at(-1)!} /> : <>
      <header className="section-page-heading"><span className="section-kicker"><MapPinned size={15} /> {locationDisplay}</span><h1>{copy?.title}</h1><p>{copy?.description}</p></header>
      {view === "life" && <><NavigationCards items={lifeLinks} neighborhood={neighborhood} /><div className="life-information-note"><Recycle size={25} /><div><h2>생활정보도, 우리 동네에 맞게</h2><p>선택한 동의 배출 안내와 주민센터를 확인하고, 더 넓은 범위의 공공시설도 찾아보세요.</p></div><a href={pageLink("/", neighborhood)}>궁금한 내용 검색하기 <ArrowRight size={17} /></a></div></>}
      {view === "facilities" && <PublicFacilities key={neighborhood} location={location} />}
      {view === "waste" && <div className="standalone-waste"><WasteGuide key={location} location={location} /></div>}
      {view === "map" && (ready ? <TownMap key={neighborhood} locationId={neighborhood} /> : <p role="status">동네 정보를 불러오고 있어요.</p>)}
      {view === "news" && <><NavigationCards items={newsLinks} neighborhood={neighborhood} /><div className="preview-grid news-preview-grid"><article className="preview-panel"><div className="preview-panel-heading"><h2>주요 공지</h2><a href={pageLink("/news/notices", neighborhood)}>더 보기 <ChevronRight size={16} /></a></div><NoticeHeadlines /></article><article className="preview-panel"><div className="preview-panel-heading"><h2>예정된 동네 행사</h2><a href={pageLink("/news/events", neighborhood)}>더 보기 <ChevronRight size={16} /></a></div><EventHeadlines events={events} /></article></div></>}
      {view === "notices" && <section className="section-reading-panel"><OfficialNoticeList notices={officialNotices} /><a className="official-directory-link" href="https://www.seongnam.go.kr/bbs010101" target="_blank" rel="noreferrer">성남시 공식 공지 전체 보기 <ArrowUpRight size={18} /></a></section>}
      {view === "events" && <section className="section-reading-panel">{events.map((event) => <OfficialEventCard key={event.id} event={event} />)}{!events.length && <p>확인된 행사 자료가 없어요. 성남시 공식 안내에서 더 많은 소식을 확인해 주세요.</p>}<a className="official-directory-link" href="https://www.seongnam.go.kr/apply/index" target="_blank" rel="noreferrer">성남시 공식 행사·모집 보기 <ArrowUpRight size={18} /></a></section>}
      {view === "calendar" && <CommunityCalendar schedules={events} />}
    </>}
  </div>;
}
