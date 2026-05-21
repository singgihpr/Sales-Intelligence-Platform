import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Target, Package, ShoppingBag, Navigation, CheckCircle } from 'lucide-react';
import { BonusSummaryCard, PercentageBonusCard, VolumeBonusCard, ActiveOutletsBonusCard } from './BonusCards';

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
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100 dark:text-slate-800" />
        <circle cx={size/2} cy={size/2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`${color} transition-all duration-1000 ease-out`} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-800 dark:text-white">{Math.round(percent)}%</span>
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Attainment</span>
      </div>
    </div>
  );
};

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : ''} ${className}`}>
    {children}
  </div>
);

export default function SalesDashboard({ data, onVisitClick }) {
  const { user, dashboardStats, bonusSummary, outlets, skuPerformance, daysElapsed, daysInMonth } = data || {};
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedBE, setSimulatedBE] = useState(dashboardStats?.currentBE || 0);

  if (!dashboardStats) return <div className="text-center text-slate-400 py-20">Loading dashboard...</div>;

  const attainment = dashboardStats.monthlyTargetBE > 0
    ? (dashboardStats.currentBE / dashboardStats.monthlyTargetBE) * 100
    : 0;
  const runRate = daysElapsed > 0
    ? (dashboardStats.currentBE / daysElapsed) * daysInMonth
    : 0;
  const projectedAttainment = dashboardStats.monthlyTargetBE > 0
    ? (runRate / dashboardStats.monthlyTargetBE) * 100
    : 0;
  const daysLeft = daysInMonth - daysElapsed;
  const shortfall = Math.max(0, dashboardStats.monthlyTargetBE - dashboardStats.currentBE);
  const shortfallPerDay = daysLeft > 0
    ? (shortfall / daysLeft).toFixed(1)
    : 0;

  const simAttainment = dashboardStats.monthlyTargetBE > 0
    ? (simulatedBE / dashboardStats.monthlyTargetBE) * 100
    : 0;

  // Projected total bonus for simulator
  const simPercentageBonus = (() => {
    const cfg = dashboardStats.percentageConfig;
    if (!cfg || !cfg.tiers) return 0;
    let activeTier = null;
    for (const tier of cfg.tiers) {
      if (simAttainment >= tier.threshold) activeTier = tier;
    }
    return activeTier ? activeTier.reward : 0;
  })();
  const simVolumeBonus = (() => {
    const cfg = dashboardStats.volumeConfig;
    if (!cfg || !cfg.tiers) return 0;
    let activeTier = null;
    for (const tier of cfg.tiers) {
      if (simulatedBE >= tier.threshold) activeTier = tier;
    }
    return activeTier ? activeTier.reward : 0;
  })();
  const simTotal = simPercentageBonus + simVolumeBonus + (bonusSummary?.activeOutlets?.bonus || 0);
  const currentTotal = bonusSummary?.total || 0;

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Halo, {user?.name}</h2>
        <p className="text-sm text-slate-500">{user?.region || ''} {user?.level ? `• ${user.level}` : ''} • {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
      </section>

      {/* Main Attainment Gauge */}
      <Card className="flex flex-col items-center py-8">
        <ProgressCircle percent={attainment} />
        <div className="mt-6 w-full grid grid-cols-2 gap-4 divide-x divide-slate-100 dark:divide-slate-800">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aktual (BE)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{dashboardStats.currentBE.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {dashboardStats.monthlyTargetBE}</span></p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Proyeksi Akhir</p>
            <div className="flex items-center justify-center gap-1">
              <p className={`text-lg font-bold ${projectedAttainment >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {Math.round(projectedAttainment)}%
              </p>
              {projectedAttainment >= 100 ? <ArrowUpRight className="w-4 h-4 text-emerald-500" /> : <ArrowDownRight className="w-4 h-4 text-amber-500" />}
            </div>
          </div>
        </div>
      </Card>

      {/* Actionable Insights */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-4">
          <div className="bg-emerald-500 p-2 rounded-xl text-white"><Target className="w-5 h-5" /></div>
          <div>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Kebutuhan Harian</p>
            <p className="text-sm text-emerald-900 dark:text-emerald-200 mt-0.5">
              Anda butuh <span className="font-bold">{shortfallPerDay} BE per hari</span> untuk mencapai target 100%
              <span className="text-emerald-700/70 dark:text-emerald-500/70"> ({daysLeft} hari tersisa)</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Total Bonus Summary */}
      <BonusSummaryCard bonusSummary={bonusSummary} />

      {/* What-If Master Simulator */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Simulasi Bonus "What-If"</h3>
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all border border-blue-200 dark:border-blue-800"
          >
            {isSimulating ? 'Tutup Simulasi' : 'Buka Simulasi'}
          </button>
        </div>
        {isSimulating && (
          <Card className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proyeksi BE Akhir Bulan</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={simulatedBE} onChange={e => setSimulatedBE(Math.max(0, Number(e.target.value)))} className="w-24 text-right text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" />
                  <span className="text-xs text-slate-400 font-medium">BE</span>
                </div>
              </div>
              <input type="range" min="0" max={Math.round(dashboardStats.monthlyTargetBE * 1.3)} step="1" value={simulatedBE} onChange={e => setSimulatedBE(Number(e.target.value))} className="w-full accent-emerald-600" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium"><span>0 BE</span><span>{Math.round(dashboardStats.monthlyTargetBE * 1.3)} BE</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Attainment</p>
                <p className={`text-lg font-bold ${simAttainment >= 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{Math.round(simAttainment)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Total Bonus</p>
                <p className="text-lg font-bold text-emerald-600">{`Rp ${(simTotal/1000000).toFixed(1)}jt`}</p>
              </div>
            </div>
            {simTotal !== currentTotal && (
              <div className={`text-xs font-bold text-center py-2.5 rounded-lg ${simTotal > currentTotal ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                {simTotal > currentTotal ? `+Rp ${((simTotal - currentTotal)/1000000).toFixed(1)}jt vs realitas saat ini` : `-Rp ${((currentTotal - simTotal)/1000000).toFixed(1)}jt vs realitas saat ini`}
              </div>
            )}
          </Card>
        )}
      </section>

      {/* Detailed Bonus Cards */}
      <section className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white px-1">Detail Bonus</h3>
        <PercentageBonusCard
          currentBE={dashboardStats.currentBE}
          targetBE={dashboardStats.monthlyTargetBE}
          config={dashboardStats.percentageConfig}
          result={bonusSummary?.percentage}
        />
        <VolumeBonusCard
          currentBE={dashboardStats.currentBE}
          config={dashboardStats.volumeConfig}
          result={bonusSummary?.volume}
        />
        <ActiveOutletsBonusCard
          totalAssigned={outlets?.length || 0}
          activeCount={bonusSummary?.activeOutlets?.activeCount || 0}
          config={dashboardStats.activeOutletsConfig}
          result={bonusSummary?.activeOutlets}
        />
      </section>

      {/* Product Analysis (SKU) */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-orange-500" /> Analisa Produk</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Volume (BE)</span>
        </div>
        <Card className="space-y-4">
          {(skuPerformance || []).length === 0 && <p className="text-xs text-slate-400 text-center py-4">Tidak ada data SKU untuk bulan ini.</p>}
          {(skuPerformance || []).map((sku, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">{sku.name}</span>
                <span className="flex items-center gap-1">{sku.volume.toFixed(1)} BE <span className={sku.trend > 0 ? 'text-emerald-500' : 'text-red-500'}>({sku.trend > 0 ? '+' : ''}{sku.trend}%)</span></span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min((sku.volume / (skuPerformance[0]?.volume || 1)) * 100, 100)}%` }}></div>
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
          {(outlets || []).slice(0, 4).map((outlet, idx) => (
            <Card key={outlet.id} className={`p-4 ${outlet.alert ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{String(9 + idx * 2.5).padStart(2, '0')}:00</span>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 my-1"></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{outlet.name}</h4>
                    <p className={`text-left text-[10px] font-bold uppercase tracking-tight ${outlet.alert ? 'text-red-500' : 'text-slate-400'}`}>{outlet.type || 'Regular Visit'}{outlet.branchArea ? ` • ${outlet.branchArea}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => onVisitClick && onVisitClick(outlet)} className="text-[10px] font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg active:scale-95 transition-transform">Check-in</button>
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
          {(outlets || []).filter(o => o.health < 50).map(outlet => (
            <div key={outlet.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${outlet.health < 40 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}><Package className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm text-left font-bold text-slate-900 dark:text-white">{outlet.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">{outlet.alert || 'Perlu perhatian'} {outlet.branchArea ? `• ${outlet.branchArea}` : ''}</p>
                </div>
              </div>
              <button className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full"><CheckCircle className="w-4 h-4 text-slate-400" /></button>
            </div>
          ))}
          {(outlets || []).filter(o => o.health < 50).length === 0 && (
            <p className="text-center text-xs text-slate-400 py-4">Semua outlet dalam kondisi baik.</p>
          )}
        </div>
      </section>
    </div>
  );
}
