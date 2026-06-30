import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { TrendingUp, Users, Store, Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react';
import SalesDashboard from './components/SalesDashboard';
import SupervisorDashboard from './components/SupervisorDashboard';
import { OutletListView, OutletDetailView } from './components/OutletViews';
import ProfileView from './components/ProfileView';
import InstallPrompt from './components/InstallPrompt';

function usePullToRefresh(enabled = true) {
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [triggered, setTriggered] = useState(false);
  const THRESHOLD = 80;

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(pointer: coarse)').matches === false) return;

    let startY = 0;
    let currentY = 0;
    let isAtTop = false;

    const onTouchStart = (e) => {
      if (window.scrollY <= 5) {
        isAtTop = true;
        startY = e.touches[0].clientY;
        currentY = startY;
      }
    };

    const onTouchMove = (e) => {
      if (!isAtTop) return;
      currentY = e.touches[0].clientY;
      const delta = currentY - startY;
      if (delta > 0) {
        e.preventDefault();
        setPulling(true);
        const progress = Math.min(delta / THRESHOLD, 1.5);
        setPullProgress(progress);
        if (delta >= THRESHOLD) {
          setTriggered(true);
        } else {
          setTriggered(false);
        }
      }
    };

    const onTouchEnd = () => {
      if (!isAtTop) return;
      const delta = currentY - startY;
      if (delta >= THRESHOLD) {
        window.location.reload();
      }
      setPulling(false);
      setPullProgress(0);
      setTriggered(false);
      isAtTop = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled]);

  return { pulling, pullProgress, triggered };
}

export default function App() {
  const navigate = useNavigate();
  const [role, setRole] = useState(localStorage.getItem('user_role') || 'sales');
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { pulling, pullProgress, triggered } = usePullToRefresh(true);

  // PWA silent auto-reload on update
  useRegisterSW({
    onNeedRefresh() {
      window.location.reload();
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, [token, navigate]);

  // Initialize dark mode
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load dashboard');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        throw new Error('Unexpected response format. The API returned a list instead of dashboard data. Please check backend routing.');
      }
      setDashboardData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const navigateToOutlet = (outlet) => {
    setSelectedOutlet(outlet);
    setActiveTab('outlet-detail');
  };

  const handleNavigate = (target) => {
    if (target === 'assignments') {
      navigate('/admin', { state: { activeTab: 'assignments', showVacant: true } });
    }
  };

  const renderContent = () => {
    if (loading && !dashboardData) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Memuat dashboard...</p>
        </div>
      );
    }

    if (error && !dashboardData) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <p className="text-red-500 font-medium mb-2">{error}</p>
          <button onClick={fetchDashboard} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Coba Lagi</button>
        </div>
      );
    }

    if (activeTab === 'outlet-detail' && selectedOutlet) {
      return <OutletDetailView outlet={selectedOutlet} onBack={() => setActiveTab('outlets')} />;
    }

    switch (activeTab) {
      case 'home':
        if (role === 'sales') {
          return <SalesDashboard data={dashboardData} onVisitClick={navigateToOutlet} />;
        }
        return <SupervisorDashboard data={dashboardData} onNavigate={handleNavigate} />;
      case 'outlets':
        return <OutletListView outlets={dashboardData?.outlets || []} onSelectOutlet={navigateToOutlet} />;
      case 'team':
        if (role === 'supervisor' || role === 'admin') {
          return <SupervisorDashboard data={dashboardData} onNavigate={handleNavigate} />;
        }
        return (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 italic">
            <Users className="w-12 h-12 mb-4 opacity-20" />
            <p>Team view tersedia untuk Supervisor.</p>
          </div>
        );
      case 'profile':
        return (
          <ProfileView
            user={dashboardData?.user}
            role={role}
            dashboardData={dashboardData}
            onLogout={() => { localStorage.removeItem('token'); localStorage.removeItem('user_role'); navigate('/login'); }}
            onProfileUpdate={(updatedUser) => {
              if (dashboardData && updatedUser) {
                setDashboardData({ ...dashboardData, user: updatedUser });
              }
            }}
          />
        );
      default:
        return role === 'sales'
          ? <SalesDashboard data={dashboardData} onVisitClick={navigateToOutlet} />
          : <SupervisorDashboard data={dashboardData} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* Pull to Refresh Indicator */}
      {pulling && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none"
          style={{
            transform: `translateY(${Math.min(pullProgress * 60, 60)}px)`,
            opacity: Math.min(pullProgress * 2, 1),
            transition: 'transform 0.1s ease-out'
          }}
        >
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full shadow-lg border border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${triggered ? 'text-emerald-500 animate-spin' : 'text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {triggered ? 'Release to refresh' : 'Pull down to refresh'}
            </span>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg lg:max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-normal text-slate-900 dark:text-white leading-tight mb-1">Fruit Intelligence</h1>
              <div className="flex items-center gap-1">
                {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
                  {isOnline ? 'Online' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Admin Panel"
              >
                <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            )}
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full font-bold uppercase text-slate-500">
              {role}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-lg lg:max-w-[1400px] mx-auto p-4 pt-6">
        {renderContent()}
      </main>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-6 py-3 safe-area-bottom">
        <div className="max-w-lg lg:max-w-[1400px] mx-auto flex items-center justify-between">
          <button
            onClick={() => { setActiveTab('home'); setSelectedOutlet(null); }}
            className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Beranda</span>
          </button>
          <button
            onClick={() => { setActiveTab('outlets'); setSelectedOutlet(null); }}
            className={`flex flex-col items-center gap-1 ${activeTab === 'outlets' || activeTab === 'outlet-detail' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Store className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Outlet</span>
          </button>
          <button
            onClick={() => { setActiveTab('team'); setSelectedOutlet(null); }}
            className={`flex flex-col items-center gap-1 ${activeTab === 'team' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Tim</span>
          </button>
          <button
            onClick={() => { setActiveTab('profile'); setSelectedOutlet(null); }}
            className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
              <span className="text-[10px] font-bold">ME</span>
            </div>
            <span className="text-[10px] font-bold uppercase">Profil</span>
          </button>
        </div>
      </div>

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  );
}
