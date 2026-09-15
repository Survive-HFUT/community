/**
 * 选修课评价 layer。
 *
 * 提供：
 *   - 页面：/electives/overview、/electives/details/:id、/electives/rate
 *   - 接口：/api/electives/courses、/api/electives/courses/:id、/api/electives/reviews
 *
 * 数据源由 `server/electives/` 合并官方目录快照与 D1 中的用户提交数据。
 */
export default defineNuxtConfig({
  routeRules: {
    // 三个页面都依赖浏览器端数据请求（打分页还依赖 localStorage 里的登录态），
    // 与 layers/waline 的后台页面保持一致关闭 SSR，避免 hydration 不匹配。
    '/electives/**': { ssr: false },
  },
});
