import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Shield, MapPin, LogOut, Moon, Sun,
  ChevronRight, CheckCircle, AlertCircle, Eye, EyeOff,
  Smartphone, Target, Wallet, Edit3, X, Globe
} from 'lucide-react';
import { useTranslation } from '../lib/i18n.jsx';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${className}`}>
    {children}
  </div>
);

const formatRp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export default function ProfileView({ role, dashboardData, onLogout, onProfileUpdate }) {
  const { t, language, setLanguage } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  // Edit name states
  const [showEditName, setShowEditName] = useState(false);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api?type=profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data.data);
      setEditName(data.data?.name || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api?type=profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (!res.ok) throw new Error('Failed to update name');
      const data = await res.json();
      setProfile(data.data);
      setShowEditName(false);
      setMessage(t('profileView.nameUpdated'));
      onProfileUpdate && onProfileUpdate(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!passwordForm.current.trim()) {
      setPasswordError(t('profileView.currentPasswordRequired'));
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordError(t('profileView.passwordMin'));
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError(t('profileView.passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api?type=profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: passwordForm.new, current_password: passwordForm.current })
      });
      if (!res.ok) throw new Error('Failed to update password');
      setShowChangePassword(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setMessage(t('profileView.passwordUpdated'));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  const stats = dashboardData?.dashboardStats;
  const bonus = dashboardData?.bonusSummary;
  const userData = profile || dashboardData?.user || {};

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p>{t('profileView.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* Header */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('profileView.title')}</h2>
        <p className="text-sm text-slate-500">{t('profileView.subtitle')}</p>
      </section>

      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-xs font-bold underline">{t('profileView.close')}</button>
        </div>
      )}

      {/* Profile Card */}
      <Card className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xl font-bold shrink-0">
          {(userData.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{userData.name || '-'}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> {userData.email || '-'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold uppercase text-slate-500">
              {userData.role || role}
            </span>
            {userData.level && (
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full font-bold uppercase text-emerald-600">
                {userData.level}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setShowEditName(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <Edit3 className="w-4 h-4 text-slate-400" />
        </button>
      </Card>

      {/* Quick Stats (Sales only) */}
      {role === 'sales' && stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Target className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('profileView.attainment')}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.monthlyTargetBE > 0 ? Math.round((stats.currentBE / stats.monthlyTargetBE) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{stats.currentBE.toFixed(1)} / {stats.monthlyTargetBE} BE</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('profileView.bonus')}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatRp(bonus?.total || 0)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('profileView.totalBonusThisMonth')}</p>
          </Card>
        </div>
      )}

      {/* Supervisor Quick Stats */}
      {role === 'supervisor' && dashboardData?.teamStats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <UsersIcon className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('profileView.teamAttainment')}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{dashboardData.teamStats.teamAttainment}%</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('profileView.vacant')}</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{dashboardData.teamStats.vacantOutlets}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('profileView.outletsWithoutSalesman')}</p>
          </Card>
        </div>
      )}

      {/* Settings */}
      <section>
        <h3 className="font-bold text-slate-900 dark:text-white mb-3 px-1">{t('profileView.settings')}</h3>
        <Card className="p-0 overflow-hidden">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {darkMode ? <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profileView.appearance')}</p>
                <p className="text-xs text-slate-500">{darkMode ? t('profileView.darkMode') : t('profileView.lightMode')}</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>

          {/* Change Password */}
          <button
            onClick={() => { setShowChangePassword(true); setPasswordError(''); }}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Shield className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profileView.changePassword')}</p>
                <p className="text-xs text-slate-500">{t('profileView.changePasswordSub')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Globe className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profileView.language')}</p>
                <p className="text-xs text-slate-500">{language === 'id' ? 'Bahasa Indonesia' : 'English'}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase">{language === 'id' ? 'ID' : 'EN'}</span>
          </button>

          {/* Region Info */}
          {userData.region && (
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t('common.region')}</p>
                  <p className="text-xs text-slate-500">{userData.region}</p>
                </div>
              </div>
            </div>
          )}

          {/* App Info */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Smartphone className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('profileView.appVersion')}</p>
                <p className="text-xs text-slate-500">{t('profileView.version')}</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full py-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold rounded-xl border border-red-100 dark:border-red-900/50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <LogOut className="w-4 h-4" /> {t('profileView.logout')}
      </button>

      {/* Edit Name Modal */}
      {showEditName && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditName(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('profileView.editName')}</h3>
              <button onClick={() => setShowEditName(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('profileView.fullName')}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                  placeholder={t('profileView.enterName')}
                />
              </div>
              <button
                disabled={savingName}
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {savingName ? t('profileView.saving') : t('profileView.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowChangePassword(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('profileView.changePassword')}</h3>
              <button onClick={() => setShowChangePassword(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-700 dark:text-red-400 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('profileView.currentPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={e => { setPasswordForm({ ...passwordForm, current: e.target.value }); setPasswordError(''); }}
                    className="w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(p => ({ ...p, current: !p.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('profileView.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword.new ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={passwordForm.new}
                    onChange={e => { setPasswordForm({ ...passwordForm, new: e.target.value }); setPasswordError(''); }}
                    className="w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                    placeholder={t('profileView.min6Chars')}
                  />
                  <button type="button" onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">{t('profileView.confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    required
                    value={passwordForm.confirm}
                    onChange={e => { setPasswordForm({ ...passwordForm, confirm: e.target.value }); setPasswordError(''); }}
                    className="w-full px-4 py-3 pr-10 border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                    placeholder={t('profileView.repeatPassword')}
                  />
                  <button type="button" onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                disabled={savingPassword}
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {savingPassword ? t('profileView.saving') : t('profileView.updatePassword')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
