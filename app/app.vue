<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <!--
      必须有 <NuxtLayout>，否则 layers/waline 里的 waline 布局不会被应用
      （Nuxt 会抛出 NUXT_E4007 警告，页面也会缺少顶部导航栏）。
    -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
