export const communityCategories = ["전체", "동네질문", "같이해요", "생활이야기", "나눔"] as const;
export type CommunityCategory = typeof communityCategories[number];
export type DemoPost = {
  id: string; category: Exclude<CommunityCategory, "전체">; title: string; excerpt: string;
  body: string; author: string; ago: string; views: number; comments: number; illustration?: "park" | "books";
};

// Authored demonstration content only; no resident accounts or real posts.
export const communityDemoPosts: readonly DemoPost[] = [
  { id: "demo-walk", category: "같이해요", title: "저녁에 가볍게 동네 산책하실 분 있나요?", excerpt: "걷기 좋은 길을 함께 찾아봐요. 천천히 한 바퀴 걸어요.", body: "퇴근하고 가볍게 걸으며 동네 이야기를 나눠보고 싶어요. 여러분이 좋아하는 산책길은 어디인가요?", author: "산책하는 이웃", ago: "6시간 전", views: 24, comments: 3, illustration: "park" },
  { id: "demo-question", category: "동네질문", title: "처음 이사 왔어요. 동네에서 꼭 알아둘 곳 있을까요?", excerpt: "산책길이나 자주 가는 공공시설이 궁금해요.", body: "새로운 동네가 아직 낯설어요. 주민센터와 도서관처럼 생활에 도움이 되는 곳을 알아가는 중이에요.", author: "새로운 이웃", ago: "7시간 전", views: 42, comments: 5 },
  { id: "demo-books", category: "나눔", title: "다 읽은 책, 필요한 이웃에게 나누고 싶어요", excerpt: "책장에 잠들어 있던 책이 새로운 독자를 만나면 좋겠어요.", body: "책을 함께 읽고 이야기하는 동네가 되면 좋겠어요.", author: "책 좋아하는 이웃", ago: "8시간 전", views: 31, comments: 2, illustration: "books" },
  { id: "demo-weekend", category: "생활이야기", title: "주말 아침, 우리 동네를 천천히 둘러봤어요", excerpt: "평소 지나치던 골목에도 작은 풍경이 많네요.", body: "바쁘게 지나던 길을 천천히 걸어보니 동네가 새롭게 느껴졌어요. 이웃들은 어떤 풍경을 좋아하시나요?", author: "느긋한 이웃", ago: "10시간 전", views: 18, comments: 1 },
  { id: "demo-sports", category: "같이해요", title: "함께 운동하는 습관을 만들어보고 싶어요", excerpt: "잘하지 않아도 괜찮아요. 꾸준히 움직이는 게 목표예요.", body: "가벼운 운동을 꾸준히 하는 습관을 만들어보고 싶어요.", author: "움직이는 이웃", ago: "어제", views: 55, comments: 4 },
  { id: "demo-recycling", category: "동네질문", title: "분리배출할 때 헷갈리는 품목, 다들 어떻게 확인하세요?", excerpt: "공식 안내를 참고하면서 하나씩 알아가고 있어요.", body: "종류가 다양해서 헷갈릴 때가 있네요. 정확한 방법은 생활안내의 공식 배출 안내에서 확인해 주세요.", author: "배워가는 이웃", ago: "어제", views: 38, comments: 3 },
  { id: "demo-greeting", category: "생활이야기", title: "엘리베이터에서 나눈 짧은 인사가 반가웠어요", excerpt: "작은 인사 하나로 하루가 조금 따뜻해졌네요.", body: "서로 가볍게 인사하는 동네가 되면 좋겠어요.", author: "인사하는 이웃", ago: "2일 전", views: 29, comments: 2 },
];

export function filterCommunityPosts(category: CommunityCategory, query: string): DemoPost[] {
  const keyword = query.trim().toLocaleLowerCase();
  return communityDemoPosts.filter((post) => (category === "전체" || category === post.category) &&
    (!keyword || `${post.title} ${post.excerpt}`.toLocaleLowerCase().includes(keyword)));
}
