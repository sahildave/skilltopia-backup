import { useEffect, useState } from 'react';
import { ThemeProviderContext, type Theme } from '@/lib/theme-context';

interface WebThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

/** Browser-only theme provider — no Tauri preferences or events. */
export function WebThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
}: WebThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (isDark: boolean) => {
      root.classList.remove('light', 'dark');
      root.classList.add(isDark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      applyTheme(mediaQuery.matches);
      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    applyTheme(theme === 'dark');
  }, [theme]);

  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        setTheme: (newTheme: Theme) => {
          localStorage.setItem(storageKey, newTheme);
          setTheme(newTheme);
        },
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}
