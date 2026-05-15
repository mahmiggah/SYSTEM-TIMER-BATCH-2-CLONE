window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('✅ Service Worker registered from preload:', reg))
      .catch(err => console.error('❌ SW registration failed:', err));
  }
});