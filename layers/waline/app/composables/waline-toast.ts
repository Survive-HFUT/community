type ToastApi = ReturnType<typeof useToast>;

let api: ToastApi | null = null;

/**
 * 捕获 Nuxt UI 的 toast API。必须在 `<UApp>` 内部组件（如 waline 布局）的 setup
 * 里调用一次，之后就能在模块作用域的函数中直接使用 `toast()`。
 */
export function installToast(): void {
  api ??= useToast();
}

/** 弹出一条自动消失的提示 */
export function toast(message: string, type: 'ok' | 'err' = 'ok'): void {
  if (!api) return;
  api.add({
    title: message,
    color: type === 'err' ? 'error' : 'success',
    duration: 3000,
  });
}
