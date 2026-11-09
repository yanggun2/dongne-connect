"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Eye, MessageCircle, Search, X } from "lucide-react";
import { communityCategories, filterCommunityPosts, type CommunityCategory, type DemoPost } from "@/lib/community-demo";

function PostIllustration({ kind }: { kind: "park" | "books" }) {
  return <svg viewBox="0 0 180 140" role="img" aria-label={kind === "park" ? "공원 산책 일러스트" : "책 나눔 일러스트"}>
    <rect width="180" height="140" rx="14" fill={kind === "park" ? "#d9efe6" : "#fff0d8"} />
    {kind === "park" ? <>
      <circle cx="143" cy="30" r="15" fill="#ffdb88" /><path d="M0 100 Q40 60 90 98 T180 83 V140 H0Z" fill="#9ecbb5" />
      <path d="M65 140 Q125 100 89 82" fill="none" stroke="#fff8e5" strokeWidth="17" />
      <path d="M32 97V53M139 101V64" stroke="#497960" strokeWidth="6" /><circle cx="32" cy="46" r="23" fill="#4d9876" /><circle cx="139" cy="59" r="20" fill="#67a688" />
      <circle cx="91" cy="76" r="6" fill="#254a5a" /><path d="M91 85V102M91 101L82 116M91 101L102 114M90 87L79 98" fill="none" stroke="#254a5a" strokeWidth="5" strokeLinecap="round" />
    </> : <>
      <rect x="27" y="99" width="126" height="9" rx="4" fill="#d6a876" />
      <path d="M39 93V42H60V93M67 93V29H91V93M97 93L109 39L131 44L119 98" fill="#78a6b4" stroke="#315d71" strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 51H56M71 39H87M106 54L125 58" stroke="#fff7e6" strokeWidth="5" /><circle cx="145" cy="27" r="8" fill="#efb56b" />
    </>}
  </svg>;
}

export function CommunityBoard({ neighborhood }: { neighborhood: string }) {
  const [category, setCategory] = useState<CommunityCategory>("전체");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DemoPost | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const posts = filterCommunityPosts(category, query);
  useEffect(() => { if (selected) dialog.current?.showModal(); }, [selected]);
  return <section className="community-board">
    <div className="community-demo-note">서비스 준비 중</div>
    <div className="community-board-heading"><div><span className="section-kicker">이웃과 나누는 이야기</span><h1>[{neighborhood}] 커뮤니티</h1><p>궁금한 일도, 소소한 일상도 함께 나눠요.</p></div><span className="community-count">게시글 {posts.length}개</span></div>
    <div className="community-tools"><div className="community-filters" role="group" aria-label="게시글 카테고리">{communityCategories.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="community-search"><Search size={18} /><span className="sr-only">게시글 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="궁금한 이야기를 찾아보세요" /></label></div>
    <div className="community-layout"><div className="community-posts">
      {posts.map((post) => <button className="community-post" type="button" key={post.id} onClick={() => setSelected(post)}>
        <span className="community-post-copy"><span className={`post-category category-${post.id === "demo-books" ? "sharing" : "default"}`}>{post.category}</span><strong>{post.title}</strong><span className="post-excerpt">{post.excerpt}</span><span className="post-meta"><span>{post.ago}</span><span><Eye size={14} aria-hidden="true" /> 조회 {post.views}</span><span><MessageCircle size={14} aria-hidden="true" /> {post.comments}</span></span></span>
        {post.illustration && <span className="community-thumbnail"><PostIllustration kind={post.illustration} /></span>}
      </button>)}
      {!posts.length && <div className="page-empty"><Search size={26} /><h2>찾으시는 글이 없어요</h2><p>다른 검색어나 카테고리를 선택해 보세요.</p><button type="button" onClick={() => { setCategory("전체"); setQuery(""); }}>전체 글 보기</button></div>}
    </div><aside className="community-aside"><span className="community-aside-icon"><MessageCircle size={25} /></span><h2>가까운 이웃,<br />반가운 이야기</h2><p>서로 다른 생각을 존중하고<br />따뜻한 말로 이야기해요.</p><a href="#community-top">위로 이동 <ArrowUpRight size={16} /></a></aside></div>
    <dialog ref={dialog} className="community-dialog" onClose={() => setSelected(null)} aria-labelledby="community-post-title">
      {selected && <><button className="dialog-close" type="button" aria-label="게시글 닫기" onClick={() => dialog.current?.close()}><X size={21} /></button><span className="post-category">{selected.category}</span><h2 id="community-post-title">{selected.title}</h2><p className="dialog-post-meta">{selected.author} · {selected.ago} · 조회 {selected.views}</p>{selected.illustration && <div className="dialog-illustration"><PostIllustration kind={selected.illustration} /></div>}{selected.body.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="dialog-comment-note"><MessageCircle size={18} /> 댓글 서비스 준비 중</div></>}
    </dialog>
  </section>;
}
