import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import ProfileView from '../components/ProfileView';

// Mock fetch globally
global.fetch = vi.fn();

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'sales',
  level: 'L3',
  region: 'Jakarta',
};

const mockDashboardData = {
  user: mockUser,
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
};

function renderProfileView(props = {}) {
  return render(
    <ProfileView
      role="sales"
      dashboardData={mockDashboardData}
      onLogout={vi.fn()}
      onProfileUpdate={vi.fn()}
      {...props}
    />
  );
}

describe('ProfileView', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    document.documentElement.classList.remove('dark');
  });

  describe('✅ Profile Display', () => {
    it('renders profile card with user data', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('sales')).toBeInTheDocument();
      expect(screen.getByText('L3')).toBeInTheDocument();
    });

    it('renders quick stats for sales role', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      expect(screen.getByText('Attainment')).toBeInTheDocument();
      expect(screen.getByText('Bonus')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText(/Rp/)).toBeInTheDocument();
    });

    it('renders supervisor stats when role is supervisor', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { ...mockUser, role: 'supervisor' } }),
      });

      const supervisorData = {
        ...mockDashboardData,
        teamStats: { teamAttainment: 85, vacantOutlets: 3 },
      };

      render(
        <ProfileView
          role="supervisor"
          dashboardData={supervisorData}
          onLogout={vi.fn()}
        />
      );

      await waitFor(() => screen.getByText('John Doe'));

      expect(screen.getByText('Team Attainment')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('Vacant')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders region info if available', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('Jakarta')).toBeInTheDocument();
    });

    it('renders app version info', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));
      expect(screen.getByText('Versi Aplikasi')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0 • PWA Enabled')).toBeInTheDocument();
    });
  });

  describe('✅ Edit Name', () => {
    it('opens edit name modal when edit button clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const editButton = screen.getAllByRole('button')[0];
      await userEvent.click(editButton);

      expect(screen.getByText('Edit Nama')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Masukkan nama')).toBeInTheDocument();
    });

    it('updates name successfully', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockUser }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { ...mockUser, name: 'Jane Doe' } }),
        });

      const onProfileUpdate = vi.fn();
      renderProfileView({ onProfileUpdate });
      await waitFor(() => screen.getByText('John Doe'));

      const editButton = screen.getAllByRole('button')[0];
      await userEvent.click(editButton);

      const input = screen.getByPlaceholderText('Masukkan nama');
      await userEvent.clear(input);
      await userEvent.type(input, 'Jane Doe');

      const saveButton = screen.getByText('Simpan');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Nama berhasil diperbarui')).toBeInTheDocument();
      });
    });
  });

  describe('✅ Change Password', () => {
    it('opens password change modal', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const changePasswordButton = screen.getAllByText('Ganti Password')[0];
      await userEvent.click(changePasswordButton);

      expect(screen.getByText('Password Saat Ini')).toBeInTheDocument();
      expect(screen.getByText('Password Baru')).toBeInTheDocument();
      expect(screen.getByText('Konfirmasi Password Baru')).toBeInTheDocument();
    });

    it('validates password minimum length', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const changePasswordButton = screen.getAllByText('Ganti Password')[0];
      await userEvent.click(changePasswordButton);

      const newPasswordInput = screen.getByPlaceholderText('Minimal 6 karakter');
      await userEvent.type(newPasswordInput, '123');

      const confirmInput = screen.getByPlaceholderText('Ulangi password baru');
      await userEvent.type(confirmInput, '123');

      const submitButton = screen.getByText('Perbarui Password');
      await userEvent.click(submitButton);

      expect(screen.getByText('Password baru minimal 6 karakter')).toBeInTheDocument();
    });

    it('validates password confirmation match', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const changePasswordButton = screen.getAllByText('Ganti Password')[0];
      await userEvent.click(changePasswordButton);

      const newPasswordInput = screen.getByPlaceholderText('Minimal 6 karakter');
      await userEvent.type(newPasswordInput, 'password123');

      const confirmInput = screen.getByPlaceholderText('Ulangi password baru');
      await userEvent.type(confirmInput, 'password456');

      const submitButton = screen.getByText('Perbarui Password');
      await userEvent.click(submitButton);

      expect(screen.getByText('Konfirmasi password tidak cocok')).toBeInTheDocument();
    });

    it('changes password successfully', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockUser }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockUser }),
        });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const changePasswordButton = screen.getAllByText('Ganti Password')[0];
      await userEvent.click(changePasswordButton);

      const newPasswordInput = screen.getByPlaceholderText('Minimal 6 karakter');
      await userEvent.type(newPasswordInput, 'newpass123');

      const confirmInput = screen.getByPlaceholderText('Ulangi password baru');
      await userEvent.type(confirmInput, 'newpass123');

      const submitButton = screen.getByText('Perbarui Password');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password berhasil diperbarui')).toBeInTheDocument();
      });
    });
  });

  describe('✅ Dark Mode Toggle', () => {
    it('toggles dark mode on', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const darkModeToggle = screen.getByText('Tampilan').closest('button');
      await userEvent.click(darkModeToggle);

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('toggles dark mode off', async () => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      renderProfileView();
      await waitFor(() => screen.getByText('John Doe'));

      const darkModeToggle = screen.getByText('Tampilan').closest('button');
      await userEvent.click(darkModeToggle);

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('theme')).toBe('light');
    });
  });

  describe('✅ Logout', () => {
    it('triggers logout when logout button clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockUser }),
      });

      const onLogout = vi.fn();
      renderProfileView({ onLogout });
      await waitFor(() => screen.getByText('John Doe'));

      const logoutButton = screen.getByText('Logout');
      await userEvent.click(logoutButton);

      expect(onLogout).toHaveBeenCalled();
    });
  });

  describe('✅ Loading & Error States', () => {
    it('shows loading state initially', () => {
      fetch.mockReturnValue(new Promise(() => {})); // Never resolves
      renderProfileView();
      expect(screen.getByText('Memuat profil...')).toBeInTheDocument();
    });

    it('shows error when fetch fails', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      renderProfileView();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });
});
