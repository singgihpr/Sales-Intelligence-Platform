import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-utils';
import userEvent from '@testing-library/user-event';
import AdminDashboard from '../pages/AdminDashboard';

global.fetch = vi.fn();

function ok(body = {}) {
  return { ok: true, text: async () => JSON.stringify(body), json: async () => body };
}

function fail(body = {}) {
  return { ok: false, text: async () => JSON.stringify(body), json: async () => body };
}

const emptyPage = { data: [], total: 0, page: 1, limit: 10 };

function setupDefaultMocks() {
  fetch.mockImplementation(async (url) => {
    if (url.includes('role=sales')) return ok(emptyPage);
    if (url.includes('role=supervisor')) return ok(emptyPage);
    return ok(emptyPage);
  });
}

function mockUsersTab(users) {
  fetch.mockImplementation(async (url) => {
    if (url.includes('role=sales')) return ok(emptyPage);
    if (url.includes('role=supervisor')) return ok(emptyPage);
    if (url.includes('type=users') && url.includes('page=1') && url.includes('limit=10') && !url.includes('role=')) {
      return ok({ data: users, total: users.length, page: 1, limit: 10 });
    }
    return ok(emptyPage);
  });
}

function mockUsersCreateThenRefresh(userData) {
  let callCount = 0;
  fetch.mockImplementation(async (url) => {
    if (url.includes('role=sales')) return ok(emptyPage);
    if (url.includes('role=supervisor')) return ok(emptyPage);
    // First POST to users API is the create
    if (url.includes('type=users') && !url.includes('page=')) {
      if (callCount === 0) {
        callCount++;
        return userData instanceof Error
          ? fail({ error: userData.message })
          : ok(userData);
      }
      return ok(emptyPage);
    }
    if (url.includes('type=users') && url.includes('page=') && !url.includes('role=')) {
      return ok({ data: [{ id: 'u1', name: 'New User', email: 'u@test.com', role: 'sales', region: 'Jakarta', level: 'L2' }], total: 1, page: 1, limit: 10 });
    }
    return ok(emptyPage);
  });
}

function mockUsersDeleteThenRefresh() {
  fetch.mockImplementation(async (url) => {
    if (url.includes('role=sales')) return ok(emptyPage);
    if (url.includes('role=supervisor')) return ok(emptyPage);
    // DELETE request
    if (url.includes('id=') && url.includes('method=DELETE')) {
      return ok({ success: true });
    }
    // POST/PUT/DELETE to users without page → delete
    if (url.includes('type=users') && url.includes('id=') && !url.includes('page=')) {
      return ok({ success: true });
    }
    if (url.includes('type=users') && url.includes('page=') && !url.includes('role=')) {
      return ok(emptyPage);
    }
    return ok(emptyPage);
  });
}

describe('AdminDashboard AlertModal on CRUD', () => {
  beforeEach(() => {
    fetch.mockReset();
    localStorage.clear();
    localStorage.setItem('token', 'admin-token');
    localStorage.setItem('user_role', 'admin');
  });

  function renderAdmin() {
    return render(<AdminDashboard />, { route: '/admin' });
  }

  describe('handleCrud success', () => {
    it('shows success AlertModal after creating a user', async () => {
      setupDefaultMocks();
      mockUsersCreateThenRefresh({ id: 'u1' });

      renderAdmin();
      await waitFor(() => screen.getByText('Data Records'));
      await userEvent.click(screen.getByText('Manajemen User'));
      await waitFor(() => screen.getByText('Tambah User'));
      await userEvent.click(screen.getByText('Tambah User'));

      await userEvent.type(screen.getByPlaceholderText('Nama Lengkap'), 'New User');
      await userEvent.type(screen.getByPlaceholderText('email@domain.com'), 'u@test.com');
      await userEvent.type(screen.getByPlaceholderText('Atur password awal'), 'Password12345');
      await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

      await waitFor(() => {
        expect(screen.getByText(/users telah dibuat/i)).toBeInTheDocument();
      });
    });

    it('shows success AlertModal after deleting a user via ConfirmModal', async () => {
      setupDefaultMocks();
      mockUsersDeleteThenRefresh();
      // Override the users list fetch to return data
      fetch.mockImplementation(async (url) => {
        if (url.includes('role=sales')) return ok(emptyPage);
        if (url.includes('role=supervisor')) return ok(emptyPage);
        if (url.includes('type=users') && url.includes('page=') && !url.includes('role=')) {
          return ok({ data: [{ id: 'u1', name: 'User One', email: 'u1@test.com', role: 'sales', region: 'Jakarta', level: 'L2' }], total: 1, page: 1, limit: 10 });
        }
        if ((url.includes('id=') || url.includes('method=DELETE')) && url.includes('type=users')) {
          return ok({ success: true });
        }
        return ok(emptyPage);
      });

      renderAdmin();
      await waitFor(() => screen.getByText('Data Records'));
      await userEvent.click(screen.getByText('Manajemen User'));
      await waitFor(() => screen.getByText('User One'));

      const row = screen.getByText('User One').closest('tr');
      const deleteBtn = Array.from(row.querySelectorAll('button')).find(
        (b) => b.querySelector('.lucide-trash2')
      );
      await userEvent.click(deleteBtn);

      await waitFor(() => screen.getByText('Konfirmasi Hapus'));
      await userEvent.click(screen.getByText('adminDashboard.common.delete'));

      await waitFor(() => {
        expect(screen.getByText(/users telah dihapus/i)).toBeInTheDocument();
      });
    });
  });

  describe('handleCrud error', () => {
    it('shows error AlertModal when API call fails', async () => {
      setupDefaultMocks();
      mockUsersCreateThenRefresh(new Error('Email sudah digunakan'));

      renderAdmin();
      await waitFor(() => screen.getByText('Data Records'));
      await userEvent.click(screen.getByText('Manajemen User'));
      await waitFor(() => screen.getByText('Tambah User'));
      await userEvent.click(screen.getByText('Tambah User'));

      await userEvent.type(screen.getByPlaceholderText('Nama Lengkap'), 'User');
      await userEvent.type(screen.getByPlaceholderText('email@domain.com'), 'u@test.com');
      await userEvent.type(screen.getByPlaceholderText('Atur password awal'), 'Password12345');
      await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

      await waitFor(() => {
        expect(screen.getByText(/Email sudah digunakan/i)).toBeInTheDocument();
      });
    });
  });

  describe('consecutive CRUD ops', () => {
    it('shows the latest alert when fast consecutive ops complete', async () => {
      let resolveCreate;
      const createPromise = new Promise((r) => { resolveCreate = r; });

      setupDefaultMocks();
      let createCallCount = 0;
      fetch.mockImplementation(async (url) => {
        if (url.includes('role=sales')) return ok(emptyPage);
        if (url.includes('role=supervisor')) return ok(emptyPage);
        if (url.includes('type=users') && url.includes('page=') && !url.includes('role=')) {
          return ok({ data: [{ id: 'u1', name: 'User One', email: 'u1@test.com', role: 'sales', region: 'Jakarta', level: 'L2' }], total: 1, page: 1, limit: 10 });
        }
        // First POST → slow (create)
        if (url.includes('type=users') && !url.includes('page=') && !url.includes('id=') && !url.includes('role=')) {
          if (createCallCount === 0) {
            createCallCount++;
            const result = await createPromise;
            return ok(result);
          }
          return ok({ id: 'u2' });
        }
        // DELETE request
        if (url.includes('type=users') && url.includes('id=')) {
          return ok({ success: true });
        }
        return ok(emptyPage);
      });

      renderAdmin();
      await waitFor(() => screen.getByText('Data Records'));
      await userEvent.click(screen.getByText('Manajemen User'));
      await waitFor(() => screen.getByText('User One'));

      // Start slow create
      await userEvent.click(screen.getByText('Tambah User'));
      await userEvent.type(screen.getByPlaceholderText('Nama Lengkap'), 'Slow');
      await userEvent.type(screen.getByPlaceholderText('email@domain.com'), 'slow@test.com');
      await userEvent.type(screen.getByPlaceholderText('Atur password awal'), 'Password12345');
      await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

      // While pending, delete
      const row = screen.getByText('User One').closest('tr');
      const deleteBtn = Array.from(row.querySelectorAll('button')).find(
        (b) => b.querySelector('.lucide-trash2')
      );
      await userEvent.click(deleteBtn);
      await waitFor(() => screen.getByText('Konfirmasi Hapus'));
      await userEvent.click(screen.getByText('adminDashboard.common.delete'));

      await waitFor(() => {
        expect(screen.getByText(/users telah dihapus/i)).toBeInTheDocument();
      });

      resolveCreate({ id: 'u2' });

      await waitFor(() => {
        expect(screen.getByText(/users telah dibuat/i)).toBeInTheDocument();
      });
    });
  });
});
