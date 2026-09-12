/**
 * 把选修课评价的入口注册到站点导航（顶栏 + 首页）。
 *
 * 参考 `layers/waline/app/composables/useSiteLinks.ts` 的说明：
 * 新 layer 只要在自己的 plugin 里调用 `registerSiteLinks()`，
 * 不需要改动 waline layer 的任何文件。
 */
export default defineNuxtPlugin(() => {
  registerSiteLinks(
    {
      to: '/electives/overview',
      label: '选修课评价',
      icon: 'i-lucide-graduation-cap',
      description: '查看课程评分与同学的真实体验',
      order: 10,
    },
    // 打分入口只放首页，避免顶栏过于拥挤
    {
      to: '/electives/rate',
      label: '写选修课评价',
      icon: 'i-lucide-pen-line',
      description: '给上过的课打分，帮学弟学妹避坑',
      scope: 'home',
      requiresAuth: true,
      order: 12,
    },
  );
});
