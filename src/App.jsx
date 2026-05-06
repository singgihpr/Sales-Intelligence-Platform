import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Store, 
  AlertTriangle, 
  CheckCircle, 
  ChevronRight, 
  Menu, 
  Bell, 
  Wifi, 
  WifiOff,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Package,
  Target
} from 'lucide-react';

// --- Mock Data ---
const CURRENT_USER = {
  name: "Budi Santoso",
  role: "Salesperson",
  region: "South Jakarta",
  id: "SLS-001"
};

const DASHBOARD_STATS = {
  monthlyTargetBE: 1250,
  currentBE: 845.5,
  daysElapsed: 15,
  totalWorkingDays: 22,
  incentiveTiers: [
    { threshold: 90, reward: 1000000, label: "Tier 1" },
    { threshold: 100, reward: 2000000, label: "Tier 2" },
    { threshold: 110, reward: 3500000, label: "Tier 3" }
  ]
};

const OUTLETS = [
  { id: 1, name: "Toko Buah Sejahtera", type: "Warung", health: 85, trend: 12, lastOrder: "2 days ago", beMonth: 120 },
  { id: 2, name: "Fresh Market Cilandak", type: "Supermarket", health: 42, trend: -35, lastOrder: "9 days ago", beMonth: 210, alert: "Decline detected" },
  { id: 3, name: "Hotel Grand Menteng", type: "Hotel", health: 78, trend: -5, lastOrder: "1 day ago", beMonth: 45 },
  { id: 4, name: "Resto Ayam Penyet", type: "Restaurant", health: 30, trend: -22, lastOrder: "14 days ago", beMonth: 32, alert: "Risk of Churn" }
];

const TEAM_STATS = [
  { name: "Budi Santoso", attainment: 67.6, status: "warning", trend: "up" },
  { name: "Siti Aminah", attainment: 92.1, status: "success", trend: "up" },
  { name: "Agus Prayogo", attainment: 45.3, status: "danger", trend: "down" },
  { name: "Dewi Lestari", attainment: 78.0, status: "warning", trend: "stable" }
];

// --- Components ---

const ProgressCircle = ({ percent, size = 160, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;
  
  let color = "stroke-red-500";
  if (percent >= 70) color = "stroke-amber-500";
  if (percent >= 90) color = "stroke-emerald-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-800 dark:text-white">{percent}%</span>
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Attainment</span>
      </div>
    </div>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${className}`}>
    {children}
  </div>
);

const Navbar = ({ role, setRole, isOnline }) => (
  <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3">
    <div className="flex items-center justify-between max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <TrendingUp className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">FruitIntelligence</h1>
          <div className="flex items-center gap-1">
             {isOnline ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
             <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">
               {isOnline ? 'Online' : 'Offline Mode'}
             </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select 
          value={role} 
          onChange={(e) => setRole(e.target.value)}
          className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-full px-3 py-1 font-medium"
        >
          <option value="sales">Sales View</option>
          <option value="supervisor">Supervisor View</option>
        </select>
        <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative">
          <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-950"></span>
        </button>
      </div>
    </div>
  </nav>
);

const SalesDashboard = () => {
  const attainment = Math.round((DASHBOARD_STATS.currentBE / DASHBOARD_STATS.monthlyTargetBE) * 100);
  const runRate = Math.round((DASHBOARD_STATS.currentBE / DASHBOARD_STATS.daysElapsed) * DASHBOARD_STATS.totalWorkingDays);
  const projectedAttainment = Math.round((runRate / DASHBOARD_STATS.monthlyTargetBE) * 100);
  const daysLeft = DASHBOARD_STATS.totalWorkingDays - DASHBOARD_STATS.daysElapsed;
  const shortfallPerDay = ((DASHBOARD_STATS.monthlyTargetBE - DASHBOARD_STATS.currentBE) / daysLeft).toFixed(1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Halo, {CURRENT_USER.name}</h2>
        <p className="text-sm text-slate-500">Jakarta Selatan • {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
      </section>

      {/* Main Attainment Gauge */}
      <Card className="flex flex-col items-center py-8">
        <ProgressCircle percent={attainment} />
        <div className="mt-6 w-full grid grid-cols-2 gap-4 divide-x divide-slate-100 dark:divide-slate-800">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aktual (BE)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{DASHBOARD_STATS.currentBE} <span className="text-xs font-normal text-slate-400">/ {DASHBOARD_STATS.monthlyTargetBE}</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Proyeksi Akhir</p>
            <div className="flex items-center justify-center gap-1">
              <p className={`text-lg font-bold ${projectedAttainment >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {projectedAttainment}%
              </p>
              {projectedAttainment >= 100 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-amber-500" />}
            </div>
          </div>
        </div>
      </Card>

      {/* Actionable Insights */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-4">
          <div className="bg-emerald-500 p-2 rounded-xl text-white">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Kebutuhan Harian</p>
            <p className="text-sm text-emerald-900 dark:text-emerald-200 mt-0.5">
              Anda butuh <span className="font-bold">{shortfallPerDay} BE per hari</span> untuk mencapai target 100%.
            </p>
          </div>
        </div>
      </div>

      {/* Incentive Tracker */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Progress Insentif</h3>
          <span className="text-xs text-blue-600 font-semibold cursor-pointer">Simulasi "What-If"</span>
        </div>
        <Card className="space-y-6">
          <div className="relative pt-2">
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" 
                style={{ width: `${Math.min(attainment, 110)}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between mt-4">
              {DASHBOARD_STATS.incentiveTiers.map((tier, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className={`text-[10px] font-bold mb-1 ${attainment >= tier.threshold ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {tier.threshold}%
                  </div>
                  <div className={`h-2 w-0.5 ${attainment >= tier.threshold ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                  <div className={`mt-1 text-[10px] font-medium ${attainment >= tier.threshold ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    Rp {(tier.reward / 1000000).toFixed(1)}jt
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Estimasi Bonus Saat Ini:</span>
            <span className="text-sm font-bold text-emerald-600">
              Rp {attainment >= 90 ? '1.000.000' : '0'}
            </span>
          </div>
        </Card>
      </section>

      {/* Outlet Health Section */}
      <section className="pb-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Outlet Perlu Perhatian</h3>
          <span className="text-xs text-slate-500">Lihat Semua</span>
        </div>
        <div className="space-y-3">
          {OUTLETS.filter(o => o.health < 50).map(outlet => (
            <div key={outlet.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${outlet.health < 40 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{outlet.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">{outlet.alert} • Turun {Math.abs(outlet.trend)}%</p>
                </div>
              </div>
              <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const SupervisorDashboard = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Team Performance</h2>
        <p className="text-sm text-slate-500">Region: Jakarta Selatan • 4 Active Reps</p>
      </section>

      {/* Aggregated Team Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-none">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Team Attainment</p>
            <p className="text-3xl font-bold text-white mt-1">70.8%</p>
            <p className="text-xs text-slate-400 mt-2">Target Region: 5.000 BE</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
            <Users className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </Card>

      {/* Team Table */}
      <section>
        <h3 className="font-bold text-slate-900 dark:text-white mb-3">Ranking Attainment</h3>
        <Card className="p-0 overflow-hidden">
          {TEAM_STATS.sort((a, b) => a.attainment - b.attainment).map((rep, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{rep.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Salesperson</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${rep.attainment >= 90 ? 'text-emerald-500' : rep.attainment < 50 ? 'text-red-500' : 'text-amber-500'}`}>
                  {rep.attainment}%
                </p>
                <div className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full ${rep.attainment >= 90 ? 'bg-emerald-500' : rep.attainment < 50 ? 'bg-red-500' : 'bg-amber-500'}`} 
                    style={{ width: `${rep.attainment}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Decline Alerts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Alerts Menunggu Respon</h3>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">2 Urgent</span>
        </div>
        <div className="space-y-3">
          <Card className="border-l-4 border-l-red-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase">Volume Drop {'>'}30%</p>
                <h4 className="text-sm font-bold mt-1 text-slate-900 dark:text-white">Fresh Market Cilandak</h4>
                <p className="text-xs text-slate-500 mt-0.5">Assigned: Budi Santoso</p>
              </div>
              <button className="text-[10px] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-lg font-bold">
                Log Kunjungan
              </button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default function App() {
  const [role, setRole] = useState('sales');
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(true);

  // Simulate network toggle for mockup
  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      <Navbar role={role} setRole={setRole} isOnline={isOnline} />
      
      <main className="max-w-lg mx-auto p-4 pt-6">
        {role === 'sales' ? <SalesDashboard /> : <SupervisorDashboard />}
      </main>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-6 py-3 safe-area-bottom">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Beranda</span>
          </button>
          <button 
            onClick={() => setActiveTab('outlets')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'outlets' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Store className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Outlet</span>
          </button>
          <button 
            onClick={() => setActiveTab('team')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'team' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Users className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Tim</span>
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
               <span className="text-[10px] font-bold">BS</span>
            </div>
            <span className="text-[10px] font-bold uppercase">Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
}