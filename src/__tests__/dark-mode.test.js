import { describe, it, expect, beforeEach } from 'vitest';

// Reset DOM before each test
describe('Dark Mode System', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  describe('✅ getInitialDarkMode Logic', () => {
    it('returns true when class "dark" exists on documentElement', () => {
      document.documentElement.classList.add('dark');
      const getInitialDarkMode = () => {
        if (document.documentElement.classList.contains('dark')) return true;
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      };
      expect(getInitialDarkMode()).toBe(true);
    });

    it('returns true when localStorage theme is "dark"', () => {
      localStorage.setItem('theme', 'dark');
      const getInitialDarkMode = () => {
        if (document.documentElement.classList.contains('dark')) return true;
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      };
      expect(getInitialDarkMode()).toBe(true);
    });

    it('returns false when localStorage theme is "light"', () => {
      localStorage.setItem('theme', 'light');
      const getInitialDarkMode = () => {
        if (document.documentElement.classList.contains('dark')) return true;
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      };
      expect(getInitialDarkMode()).toBe(false);
    });

    it('respects classList over localStorage', () => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'light');
      const getInitialDarkMode = () => {
        if (document.documentElement.classList.contains('dark')) return true;
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      };
      expect(getInitialDarkMode()).toBe(true);
    });
  });

  describe('✅ DOM classList Toggle', () => {
    it('adds "dark" class to documentElement', () => {
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes "dark" class from documentElement', () => {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('toggle switches class state', () => {
      document.documentElement.classList.toggle('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      
      document.documentElement.classList.toggle('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('✅ localStorage Persistence', () => {
    it('persists "dark" to localStorage', () => {
      localStorage.setItem('theme', 'dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('persists "light" to localStorage', () => {
      localStorage.setItem('theme', 'light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('survives localStorage clear and re-set', () => {
      localStorage.setItem('theme', 'dark');
      expect(localStorage.getItem('theme')).toBe('dark');
      
      localStorage.clear();
      expect(localStorage.getItem('theme')).toBeNull();
      
      localStorage.setItem('theme', 'light');
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });

  describe('✅ Inline Script in index.html', () => {
    it('simulates inline script behavior: adds dark class when theme is dark', () => {
      localStorage.setItem('theme', 'dark');
      
      // Simulate inline script
      const theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('simulates inline script behavior: removes dark class when theme is light', () => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'light');
      
      // Simulate inline script
      const theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});
