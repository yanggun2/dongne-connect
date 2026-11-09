import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pageLink, mainSection, type PageView } from "../lib/navigation";
import { communityDemoPosts, filterCommunityPosts } from "../lib/community-demo";
import { CommunityBoard } from "../components/CommunityBoard";
import { SectionContent } from "../components/SectionPages";

test("dedicated page links retain neighborhood and encode query text without auto-searching", () => {
  const url = new URL(pageLink("/life/map", "중원구|은행1동"), "http://localhost");
  assert.equal(url.pathname, "/life/map");
  assert.equal(url.searchParams.get("neighborhood"), "중원구|은행1동");
  const search = new URL(pageLink("/", "분당구|정자3동", "체육시설 & 지도"), "http://localhost");
  assert.equal(search.searchParams.get("question"), "체육시설 & 지도");
  assert.equal(pageLink("/community"), "/community");
  for (const view of ["life", "facilities", "waste", "map"] as PageView[]) assert.equal(mainSection(view), "life");
  for (const view of ["news", "notices", "events", "calendar"] as PageView[]) assert.equal(mainSection(view), "news");
  assert.equal(mainSection("community"), "community");
});

test("demo posts filter locally, retain unique IDs without preview copy", () => {
  assert.equal(communityDemoPosts.length, 7);
  assert.equal(new Set(communityDemoPosts.map((post) => post.id)).size, 7);
  assert.equal(filterCommunityPosts("나눔", "").length, 1);
  assert.equal(filterCommunityPosts("전체", " 저녁 ").length, 1);
  assert.equal(filterCommunityPosts("동네질문", "저녁").length, 0);
  assert.equal(filterCommunityPosts("전체", "없는검색어").length, 0);
  for (const post of communityDemoPosts) assert.doesNotMatch(post.body, /예시|미리보기/);
});

test("community renders wireframe hierarchy, example cards and local illustrations without a posting form", () => {
  const html = renderToStaticMarkup(<CommunityBoard neighborhood="은행1동" />);
  assert.match(html, /\[은행1동\] 커뮤니티/);
  assert.match(html, /서비스 준비 중/);
  assert.equal((html.match(/class="community-post"/g) ?? []).length, 7);
  assert.match(html, /공원 산책 일러스트/);
  assert.ok(!html.includes("<form") && !html.includes("<textarea") && !html.includes("https://"));
});

test("life landing offers three real dedicated destinations instead of long in-page sections", () => {
  const html = renderToStaticMarkup(<SectionContent view="life" neighborhood="중원구|은행1동" location="경기도 성남시 중원구 은행1동" locationDisplay="중원구 은행1동" ready events={[]} />);
  for (const path of ["/life/facilities?", "/life/waste?", "/life/map?"]) assert.ok(html.includes(path));
  assert.equal((html.match(/class="section-navigation-card"/g) ?? []).length, 3);
  assert.ok(!html.includes('id="town-map"') && !html.includes('id="waste-info"'));
});
