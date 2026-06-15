import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../pages/Login';
import { BrowserRouter } from 'react-router-dom';

// Mock fetch
global.fetch = vi.fn();

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
}

describe('Login', () => {
  beforeEach(() => {
    fetch.mockClear();
    mockNavigate.mockClear();
    localStorage.clear();
  });

  describe('✅ Render', () => {
    it('renders login form with all elements', () => {
      renderLogin();

      expect(screen.getByText('Sales Intelligence')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Use your admin/sales credentials')).toBeInTheDocument();
    });
  });

  describe('✅ Password Visibility Toggle', () => {
    it('toggles password visibility', async () => {
      renderLogin();

      const passwordInput = screen.getByPlaceholderText('••••••••');
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getAllByRole('button')[0];
      await userEvent.click(toggleButton);

      expect(passwordInput).toHaveAttribute('type', 'text');

      await userEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('✅ Form Submission', () => {
    it('submits login with valid credentials and redirects to home', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          user: { id: '1', name: 'Test', role: 'sales', region: 'Jakarta', level: 'L2' },
        }),
      });

      renderLogin();

      const emailInput = screen.getByPlaceholderText('name@company.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByText('Sign In');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/.netlify/functions/api?type=auth&action=login',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
          })
        );
      });

      expect(localStorage.getItem('token')).toBe('test-token');
      expect(localStorage.getItem('user_role')).toBe('sales');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('submits login with admin role and redirects to /admin', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'admin-token',
          user: { id: '1', name: 'Admin', role: 'admin', region: 'Jakarta', level: 'L3' },
        }),
      });

      renderLogin();

      const emailInput = screen.getByPlaceholderText('name@company.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByText('Sign In');

      await userEvent.type(emailInput, 'admin@example.com');
      await userEvent.type(passwordInput, 'admin123');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin');
      });
    });

    it('shows error on invalid credentials', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid email or password' }),
      });

      renderLogin();

      const emailInput = screen.getByPlaceholderText('name@company.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByText('Sign In');

      await userEvent.type(emailInput, 'wrong@example.com');
      await userEvent.type(passwordInput, 'wrongpass');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      fetch.mockReturnValue(new Promise(() => {})); // Never resolves

      renderLogin();

      const emailInput = screen.getByPlaceholderText('name@company.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');
      const submitButton = screen.getByText('Sign In');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });
  });
});
