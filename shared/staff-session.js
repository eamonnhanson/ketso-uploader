(() => {
  const token = sessionStorage.getItem('ketso_staff_session');
  if (!token) { location.replace('/?programme=staff'); return; }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/api/staff-uploads')) {
      const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('Authorization', `Bearer ${token}`);
      return originalFetch(input, { ...options, headers });
    }
    return originalFetch(input, options);
  };
})();
