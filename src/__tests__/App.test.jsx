import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock fetch
global.fetch = vi.fn();

// Mock modules
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn().mockReturnValue({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

function renderApp() {
  return render(<App />);
}

describe('App', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user_role', 'sales');
  });

  describe('✅ Navigation & Tabs', () => {
    it('renders all 4 bottom navigation tabs', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Test', role: 'sales', region: 'Jakarta', level: 'L2' },
          dashboardStats: {
            monthlyTargetBE: 1000,
            currentBE: 750,
            daysElapsed: 15,
            totalWorkingDays: 22,
            daysInMonth: 30,
          },
          bonusSummary: {
            total: 2500000,
            percentage: { attainment: 75, bonus: 500000 },
            volume: { bonus: 1000000 },
            activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000 },
          },
          outlets: [],
          skuPerformance: [],
        }),
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('Beranda')).toBeInTheDocument();
      });

      expect(screen.getByText('Outlet')).toBeInTheDocument();
      expect(screen.getByText('Tim')).toBeInTheDocument();
      expect(screen.getByText('Profil')).toBeInTheDocument();
    });

    it('switches to Outlet tab when clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Test', role: 'sales', region: 'Jakarta', level: 'L2' },
          dashboardStats: {
            monthlyTargetBE: 1000,
            currentBE: 750,
            daysElapsed: 15,
            totalWorkingDays: 22,
            daysInMonth: 30,
          },
          bonusSummary: {
            total: 2500000,
            percentage: { attainment: 75, bonus: 500000 },
            volume: { bonus: 1000000 },
            activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000 },
          },
          outlets: [
            { id: '1', name: 'Outlet A', type: 'Retail', address: 'Jakarta', health: 80, beMonth: 100, alert: null },
          ],
          skuPerformance: [],
        }),
      });

      renderApp();
      await waitFor(() => screen.getByText('Beranda'));

      const outletTab = screen.getByText('Outlet');
      await userEvent.click(outletTab);

      expect(screen.getByText('Outlet A')).toBeInTheDocument();
    });

    it('switches to Profile tab when clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Test', role: 'sales', region: 'Jakarta', level: 'L2' },
          dashboardStats: {
            monthlyTargetBE: 1000,
            currentBE: 750,
            daysElapsed: 15,
            totalWorkingDays: 22,
            daysInMonth: 30,
          },
          bonusSummary: {
            total: 2500000,
            percentage: { attainment: 75, bonus: 500000 },
            volume: { bonus: 1000000 },
            activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000 },
          },
          outlets: [],
          skuPerformance: [],
        }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: '1', name: 'Test', email: 'test@example.com', role: 'sales', level: 'L2' } }),
      });

      renderApp();
      await waitFor(() => screen.getByText('Beranda'));

      const profileTab = screen.getByText('Profil');
      await userEvent.click(profileTab);

      await waitFor(() => {
        expect(screen.getByText('Profil & Pengaturan')).toBeInTheDocument();
      });
    });
  });

  describe('✅ Admin Navigation', () => {
    it('shows admin settings icon when role is admin', async () => {
      localStorage.setItem('user_role', 'admin');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Admin', role: 'admin', region: 'Jakarta', level: 'L3' },
          team: [],
          teamStats: { teamAttainment: 0, vacantOutlets: 0 },
          outlets: [],
          skuPerformance: [],
        }),
      });

      renderApp();
      await waitFor(() => screen.getByText('Beranda'));

      // Admin settings button should be in the nav
      const adminButton = screen.getByTitle('Admin Panel');
      expect(adminButton).toBeInTheDocument();
    });

    it('does not show admin settings icon when role is sales', async () => {
      localStorage.setItem('user_role', 'sales');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Sales', role: 'sales', region: 'Jakarta', level: 'L2' },
          dashboardStats: {
            monthlyTargetBE: 1000,
            currentBE: 750,
            daysElapsed: 15,
            totalWorkingDays: 22,
            daysInMonth: 30,
          },
          bonusSummary: {
            total: 2500000,
            percentage: { attainment: 75, bonus: 500000 },
            volume: { bonus: 1000000 },
            activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000 },
          },
          outlets: [],
          skuPerformance: [],
        }),
      });

      renderApp();
      await waitFor(() => screen.getByText('Beranda'));

      const adminButton = screen.queryByTitle('Admin Panel');
      expect(adminButton).not.toBeInTheDocument();
    });
  });

  describe('✅ Online/Offline Status', () => {
    it('shows Online status when navigator.onLine is true', async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { id: '1', name: 'Test', role: 'sales', region: 'Jakarta', level: 'L2' },
          dashboardStats: {
            monthlyTargetBE: 1000,
            currentBE: 750,
            daysElapsed: 15,
            totalWorkingDays: 22,
            daysInMonth: 30,
          },
          bonusSummary: {
            total: 2500000,
            percentage: { attainment: 75, bonus: 500000 },
            volume: { bonus: 1000000 },
            activeOutlets: { activeCount: 8, totalAssigned: 10, bonus: 1000000 },
          },
          outlets: [],
          skuPerformance: [],
        }),
      });

      renderApp();
      await waitFor(() => screen.getByText('Beranda'));

      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });
});
