(() => {
  const key = 'cert-practice.theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) preference = saved;
  } catch {
    // The picker still works for this page when device storage is unavailable.
  }

  function applyTheme() {
    const dark = preference === 'dark' || (preference === 'system' && system.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111b20' : '#142d32';
  }

  applyTheme();
  if (system.addEventListener) system.addEventListener('change', applyTheme);
  else system.addListener(applyTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('theme-picker');
    picker.value = preference;
    picker.addEventListener('change', () => {
      preference = picker.value;
      applyTheme();
      try {
        localStorage.setItem(key, preference);
      } catch {
        // Keep the chosen theme for this page.
      }
    });
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      preference = valid(event.newValue) ? event.newValue : 'system';
      picker.value = preference;
      applyTheme();
    });
  });
})();
