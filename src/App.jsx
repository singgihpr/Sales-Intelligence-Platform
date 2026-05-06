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
  Target,
  Search,
  ArrowLeft,
  Calendar,
  MessageSquare,
  History,
  MapPin,
  Navigation,
  ShoppingBag
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
  { 
    id: 1, 
    name: "Toko Buah Sejahtera", 
    type: "Warung", 
    health: 85, 
    trend: 12, 
    lastOrder: "2 days ago", 
    beMonth: 120, 
    address: "Jl. Radio Dalam No. 12, Jakarta",
    contact: "Bapak Haji Usman",
    history: [
      { date: '2026-04-10', be: 45, status: 'Completed' },
      { date: '2026-03-28', be: 52, status: 'Completed' }
    ]
  },
  { 
    id: 2, 
    name: "Fresh Market Cilandak", 
    type: "Supermarket", 
    health: 42, 
    trend: -35, 
    lastOrder: "9 days ago", 
    beMonth: 210, 
    alert: "Decline detected",
    address: "Cilandak Town Square, Ground Floor",
    contact: "Ibu Maya (Manager)",
    history: [
      { date: '2026-04-05', be: 20, status: 'Completed' },
      { date: '2026-03-15', be: 85, status: 'Completed' }
    ]
  },
  { id: 3, name: "Hotel Grand Menteng", type: "Hotel", health: 78, trend: -5, lastOrder: "1 day ago", beMonth: 45, address: "Jl. Matraman Raya No. 21" },
  { id: 4, name: "Resto Ayam Penyet", type: "Restaurant", health: 30, trend: -22, lastOrder: "14 days ago", beMonth: 32, alert: "Risk of Churn", address: "Kuningan Food Court" }
];

const TEAM_STATS = [
  { name: "Budi Santoso", attainment: 67.6, status: "warning", trend: "up" },
  { name: "Siti Aminah", attainment: 92.1, status: "success", trend: "up" },
  { name: "Agus Prayogo", attainment: 45.3, status: "danger", trend: "down" },
  { name: "Dewi Lestari", attainment: 78.0, status: "warning", trend: "stable" }
];

const SKU_PERFORMANCE = [
  { name: "Pisang Cavendish", volume: 450, trend: 15, color: "bg-yellow-400" },
  { name: "Nanas Madu", volume: 210, trend: -5, color: "bg-orange-400" },
  { name: "Jeruk Siam", volume: 185.5, trend: 22, color: "bg-emerald-400" }
];

const SCHEDULE = [
  { id: 1, time: "09:00", outlet: "Toko Buah Sejahtera", type: "Regular Visit", status: "completed" },
  { id: 2, time: "11:30", outlet: "Fresh Market Cilandak", type: "Urgent: Drop in Volume", status: "pending", priority: "high" },
  { id: 3, time: "14:00", outlet: "Hotel Grand Menteng", type: "Re-stock Check", status: "pending" },
  { id: 4, time: "16:00", outlet: "Resto Ayam Penyet", type: "New Product Intro", status: "pending" }
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

const Card = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : ''} ${className}`}
  >
    {children}
  </div>
);

const HealthBadge = ({ score }) => {
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 50) colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  if (score >= 80) colorClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colorClass}`}>
      OHS: {score}
    </span>
  );
};

const Navbar = ({ role, setRole, isOnline }) => (
  <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3">
    <div className="flex items-center justify-between max-w-lg mx-auto">
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

const SalesDashboard = ({ onVisitClick }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedBE, setSimulatedBE] = useState(DASHBOARD_STATS.currentBE);

  const attainment = Math.round((DASHBOARD_STATS.currentBE / DASHBOARD_STATS.monthlyTargetBE) * 100);
  const runRate = Math.round((DASHBOARD_STATS.currentBE / DASHBOARD_STATS.daysElapsed) * DASHBOARD_STATS.totalWorkingDays);
  const projectedAttainment = Math.round((runRate / DASHBOARD_STATS.monthlyTargetBE) * 100);
  const daysLeft = DASHBOARD_STATS.totalWorkingDays - DASHBOARD_STATS.daysElapsed;
  const shortfallPerDay = ((DASHBOARD_STATS.monthlyTargetBE - DASHBOARD_STATS.currentBE) / daysLeft).toFixed(1);

  const getBonus = (att) => {
    let bonus = 0;
    for (const tier of DASHBOARD_STATS.incentiveTiers) {
      if (att >= tier.threshold) bonus = tier.reward;
    }
    return bonus;
  };

  const currentBonus = getBonus(attainment);
  const simAttainment = Math.round((simulatedBE / DASHBOARD_STATS.monthlyTargetBE) * 100);
  const projectedBonus = getBonus(simAttainment);

  const nextTier = DASHBOARD_STATS.incentiveTiers.find(t => t.threshold > attainment);
  const beNeededForNextTier = nextTier
    ? Math.ceil((nextTier.threshold / 100) * DASHBOARD_STATS.monthlyTargetBE - DASHBOARD_STATS.currentBE)
    : null;

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
          <span 
            className="text-xs text-blue-600 font-semibold cursor-pointer select-none"
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? 'Tutup Simulasi' : 'Simulasi "What-If"'}
          </span>
        </div>
        <Card className="space-y-4">
          <div className="relative pt-2">
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out" 
                style={{ width: `${Math.min(attainment, 110)}%` }}
              ></div>
              {isSimulating && (
                <div 
                  className="ghost-bar dark:opacity-60"
                  style={{ width: `${Math.min((simulatedBE / DASHBOARD_STATS.monthlyTargetBE) * 100, 110)}%` }}
                ></div>
              )}
            </div>
            
            <div className="flex justify-between mt-4">
              {DASHBOARD_STATS.incentiveTiers.map((tier, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className={`text-[10px] font-bold mb-1 ${attainment >= tier.threshold ? 'text-emerald-600' : 'text-slate-400'} flex items-center gap-0.5`}>
                    {tier.threshold}%
                    {attainment >= tier.threshold && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                  </div>
                  <div className={`h-2 w-0.5 ${attainment >= tier.threshold ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                  <div className={`mt-1 text-[10px] font-medium ${attainment >= tier.threshold ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    Rp {(tier.reward / 1000000).toFixed(1)}jt
                  </div>
                </div>
              ))}
            </div>

            {nextTier && (
              <p className="text-xs text-slate-500 mt-3 text-center">
                Butuh <span className="font-bold text-slate-700 dark:text-slate-300">{beNeededForNextTier} BE</span> lagi untuk <span className="font-bold text-emerald-600">{nextTier.label}</span> (Rp {(nextTier.reward / 1000000).toFixed(1)}jt)
              </p>
            )}
          </div>
          
          <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Estimasi Bonus Saat Ini:</span>
            <span className="text-sm font-bold text-emerald-600">
              Rp {currentBonus.toLocaleString('id-ID')}
            </span>
          </div>

          {/* What-If Simulator Panel */}
          {isSimulating && (
            <div className="animate-slide-down pt-4 border-t border-slate-50 dark:border-slate-800">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proyeksi BE Akhir Bulan</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={simulatedBE}
                        onChange={(e) => setSimulatedBE(Math.max(0, Number(e.target.value)))}
                        className="w-24 text-right text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                      />
                      <span className="text-xs text-slate-400 font-medium">BE</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.round(DASHBOARD_STATS.monthlyTargetBE * 1.3)}
                    step="1"
                    value={simulatedBE}
                    onChange={(e) => setSimulatedBE(Number(e.target.value))}
                    className="sim-slider"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                    <span>0 BE</span>
                    <span>{Math.round(DASHBOARD_STATS.monthlyTargetBE * 1.3)} BE</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Attainment</p>
                    <p className={`text-lg font-bold ${simAttainment >= 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                      {simAttainment}%
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Bonus</p>
                    <p className="text-lg font-bold text-emerald-600">
                      Rp {(projectedBonus / 1000000).toFixed(1)}jt
                    </p>
                  </div>
                </div>

                {projectedBonus !== currentBonus && (
                  <div className={`text-xs font-bold text-center py-2.5 rounded-lg ${
                    projectedBonus > currentBonus 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' 
                      : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                  }`}>
                    {projectedBonus > currentBonus 
                      ? `+Rp ${((projectedBonus - currentBonus) / 1000000).toFixed(1)}jt vs realitas saat ini`
                      : `-Rp ${((currentBonus - projectedBonus) / 1000000).toFixed(1)}jt vs realitas saat ini`
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* Product Analysis (SKU) */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-orange-500" /> Analisa Produk</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Volume (BE)</span>
        </div>
        <Card className="space-y-4">
          {SKU_PERFORMANCE.map((sku, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">{sku.name}</span>
                <span className="flex items-center gap-1">
                  {sku.volume} BE
                  <span className={sku.trend > 0 ? 'text-emerald-500' : 'text-red-500'}>
                    ({sku.trend > 0 ? '+' : ''}{sku.trend}%)
                  </span>
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${sku.color} rounded-full`}
                  style={{ width: `${(sku.volume / SKU_PERFORMANCE[0].volume) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {/* Activity Schedule (Visits) */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold flex items-center gap-2"><Navigation className="w-4 h-4 text-emerald-600" /> Jadwal Kunjungan</h3>
          <span className="text-xs text-slate-400 font-medium underline">Lihat Peta</span>
        </div>
        <div className="space-y-3">
          {SCHEDULE.map((task) => (
            <Card key={task.id} className={`p-4 ${task.status === 'completed' ? 'opacity-60 bg-slate-50' : task.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{task.time}</span>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 my-1"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{task.outlet}</h4>
                    <p className={`text-left text-[10px] font-bold uppercase tracking-tight ${task.priority === 'high' ? 'text-red-500' : 'text-slate-400'}`}>{task.type}</p>
                  </div>
                </div>
                {task.status === 'completed' ? (
                  <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-full"><CheckCircle className="w-4 h-4" /></div>
                ) : (
                  <button
                    onClick={() => onVisitClick && onVisitClick(OUTLETS.find(o => o.name === task.outlet))}
                    className="text-[10px] font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  >
                    Check-in
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
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
                  <h4 className="text-sm text-left font-bold text-slate-900 dark:text-white">{outlet.name}</h4>
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
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
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

const OutletListView = ({ onSelectOutlet }) => {
  const [search, setSearch] = useState("");
  const filtered = OUTLETS.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4 pb-32 animate-in fade-in">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama outlet..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.map(outlet => (
          <Card key={outlet.id} onClick={() => onSelectOutlet(outlet)} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 font-bold">
                {outlet.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold">{outlet.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <HealthBadge score={outlet.health} />
                  <span className={`text-[10px] font-bold ${outlet.trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {outlet.trend > 0 ? '↑' : '↓'} {Math.abs(outlet.trend)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{outlet.beMonth} BE</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Bulan Ini</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const OutletDetailView = ({ outlet, onBack }) => {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <section>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{outlet.name}</h2>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {outlet.address}
            </p>
          </div>
          <div className="text-right">
             <HealthBadge score={outlet.health} />
             <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Status: Aktif</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Contact Person</p>
          <p className="text-sm font-bold mt-1">{outlet.contact || "Bpk. Manager"}</p>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Last Order</p>
          <p className="text-sm font-bold mt-1">{outlet.lastOrder}</p>
        </Card>
      </div>

      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" /> Riwayat Transaksi
        </h3>
        <Card className="p-0 overflow-hidden">
          {(outlet.history || []).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-medium">{new Date(item.date).toLocaleDateString('id-ID')}</span>
              </div>
              <span className="text-sm font-bold">{item.be} BE</span>
            </div>
          ))}
          {(!outlet.history || outlet.history.length === 0) && (
             <p className="p-4 text-center text-xs text-slate-400">Tidak ada riwayat transaksi 30 hari terakhir</p>
          )}
        </Card>
      </section>

      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> Log Kunjungan
        </h3>
        <Card>
          <textarea
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            placeholder="Tulis hasil kunjungan atau kendala outlet..."
            rows="3"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          ></textarea>
          <button className="w-full mt-3 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-transform">
            Simpan Laporan
          </button>
        </Card>
      </section>
    </div>
  );
};

export default function App() {
  const [role, setRole] = useState('sales');
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);

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

  const navigateToOutlet = (outlet) => {
    setSelectedOutlet(outlet);
    setActiveTab('outlet-detail');
  };

  const renderContent = () => {
    if (activeTab === 'outlet-detail' && selectedOutlet) {
      return <OutletDetailView outlet={selectedOutlet} onBack={() => setActiveTab('outlets')} />;
    }

    switch (activeTab) {
      case 'home':
        return role === 'sales' ? <SalesDashboard onVisitClick={navigateToOutlet} /> : <SupervisorDashboard />;
      case 'outlets':
        return <OutletListView onSelectOutlet={navigateToOutlet} />;
      case 'team':
        return <SupervisorDashboard />;
      case 'profile':
        return (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 italic">
            <Menu className="w-12 h-12 mb-4 opacity-20" />
            <p>Profil & Pengaturan segera hadir.</p>
          </div>
        );
      default:
        return role === 'sales' ? <SalesDashboard onVisitClick={navigateToOutlet} /> : <SupervisorDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      <Navbar role={role} setRole={setRole} isOnline={isOnline} />

      <main className="max-w-lg mx-auto p-4 pt-6">
        {renderContent()}
      </main>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 px-6 py-3 safe-area-bottom">
        <div className="max-w-lg mx-auto flex items-center justify-between">
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
               <span className="text-[10px] font-bold">BS</span>
            </div>
            <span className="text-[10px] font-bold uppercase">Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
}