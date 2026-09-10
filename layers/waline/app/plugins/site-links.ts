/**
 * 注册评论系统自身的站点入口。
 *
 * 这个文件同时是「新 layer 如何添加入口」的参考实现：
 * 在自己的 layer 里新建 `app/plugins/site-links.ts`，照下面的写法调用
 * `registerSiteLinks()` 即可，无需改动本 layer 的任何文件。
 */
export default defineNuxtPlugin(() => {
  registerSiteLinks(
    {
      to: '/comments',
      label: '评论管理',
      icon: 'i-lucide-message-square-text',
      description: '审核、置顶、回复与删除评论',
      requiresAdmin: true,
      order: 20,
    },
    {
      to: '/user',
      label: '用户管理',
      icon: 'i-lucide-users',
      description: '维护注册用户、角色与封禁',
      requiresAdmin: true,
      order: 30,
    },
    {
      to: '/setting',
      label: '站点设置',
      icon: 'i-lucide-sliders-horizontal',
      description: '前端版本与评论策略',
      requiresAdmin: true,
      order: 40,
    },
    // 个人资料已经在右上角账户菜单里，这里只放到首页卡片
    {
      to: '/profile',
      label: '个人资料',
      icon: 'i-lucide-user-round',
      description: '昵称、主页、密码与两步验证',
      scope: 'home',
      requiresAuth: true,
      order: 15,
    },
  );
});
