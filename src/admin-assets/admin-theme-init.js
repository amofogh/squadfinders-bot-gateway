(function () {
  const STORAGE_KEY = 'sf-admin-theme';
  const LEGACY_KEYS = ['sf-dashboard-theme', 'sf-analytics-theme'];

  const isThemeValue = (value) => value === 'dark' || value === 'light';

  const applyTheme = (theme) => {
    const mode = theme === 'dark' ? 'dark' : 'light';
    const root = document.documentElement;

    if (!root) {
      return;
    }

    root.setAttribute('data-admin-theme', mode);
    root.classList.toggle('sf-dark-theme', mode === 'dark');

    if (document.body) {
      document.body.setAttribute('data-admin-theme', mode);
      document.body.classList.toggle('sf-dark-theme', mode === 'dark');
    }
  };

  const readStoredTheme = () => {
    try {
      const stored = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (isThemeValue(stored)) {
        return stored;
      }

      for (const key of LEGACY_KEYS) {
        const legacyValue = window.localStorage ? window.localStorage.getItem(key) : null;
        if (isThemeValue(legacyValue)) {
          window.localStorage.setItem(STORAGE_KEY, legacyValue);
          LEGACY_KEYS.filter((legacyKey) => legacyKey !== key).forEach((legacyKey) => {
            window.localStorage.removeItem(legacyKey);
          });
          return legacyValue;
        }
      }
    } catch (error) {
      // Swallow errors from localStorage access (e.g., disabled storage)
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  };

  const writeTheme = (theme) => {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, theme);
        LEGACY_KEYS.forEach((legacyKey) => window.localStorage.removeItem(legacyKey));
      }
    } catch (error) {
      // Ignore persistence errors (e.g., in private mode)
    }
  };

  const dispatchThemeChange = (theme) => {
    try {
      window.dispatchEvent(new CustomEvent('sf-admin-theme-change', { detail: { theme } }));
    } catch (error) {
      // Ignore dispatch issues
    }
  };

  const initialize = () => {
    const initialTheme = readStoredTheme();
    applyTheme(initialTheme);
    dispatchThemeChange(initialTheme);
    return initialTheme;
  };

  const setTheme = (theme) => {
    const mode = theme === 'dark' ? 'dark' : 'light';
    writeTheme(mode);
    applyTheme(mode);
    dispatchThemeChange(mode);
  };

  const themeApi = {
    getStoredTheme: readStoredTheme,
    applyTheme,
    setTheme,
  };

  window.__squadfindersAdminTheme = themeApi;

  initialize();

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event) => {
      const stored = readStoredTheme();
      if (!isThemeValue(stored)) {
        setTheme(event.matches ? 'dark' : 'light');
      }
    };

    if (media.addEventListener) {
      media.addEventListener('change', handleSystemChange);
    } else if (media.addListener) {
      media.addListener(handleSystemChange);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && isThemeValue(event.newValue)) {
      applyTheme(event.newValue);
      dispatchThemeChange(event.newValue);
    }

    if (LEGACY_KEYS.includes(event.key) && isThemeValue(event.newValue)) {
      setTheme(event.newValue);
    }
  });
})();
