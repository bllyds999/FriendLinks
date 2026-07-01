/**
 * 友链路由表（按使用频率降序排列，优先探测常见路由）
 *
 * 探测脚本从根域名下的这些路径寻找友链页面。
 */
export const FRIEND_ROUTES: string[] = [
  "/links", "/link", "/friends", "/links.html", "/link/", "/friend",
  "/friends/", "/friends.html", "/", "/friend-links", "/flink",
  "/friend/link", "/links/",
  "/about", "/ask/friends", "/blogroll/", "/Friends.html",
  "/friendship-links/", "/newBlog/friend", "/other/friends.html",
  "/page/friendlinks/", "/pages/link", "/pages/links.html", "/roll/",
  "/you", "/you-lian", "/yourenzhang", "/?page_id=476",
];
