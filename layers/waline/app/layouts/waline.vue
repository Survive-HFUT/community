<template>
  <div class="flex min-h-svh flex-col">
    <AppNavbar />

    <!-- flex-col：让登录/注册这类页面可以用 flex-1 撑满并垂直居中 -->
    <main class="flex flex-1 flex-col">
      <slot />
    </main>

    <footer class="border-t border-default">
      <UContainer
        class="flex h-14 items-center justify-between text-xs text-muted"
      >
        <span>Powered by Nuxt UI</span>
      </UContainer>
    </footer>
  </div>
</template>
