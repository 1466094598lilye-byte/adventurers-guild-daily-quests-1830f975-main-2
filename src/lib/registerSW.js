/**
 * Service Worker 注册
 * vite-plugin-pwa 会自动生成 service worker，这里只需要注册更新逻辑
 */

export function registerSW() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    // vite-plugin-pwa 会自动注册 service worker
    // 这里只需要处理更新逻辑
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

