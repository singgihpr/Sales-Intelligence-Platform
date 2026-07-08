import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Target, Package, ShoppingBag, Navigation, CheckCircle, Info, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3, X, Store as StoreIcon, Calendar, Zap, MapPin, Gift, AlertTriangle, Activity, PieChart } from 'lucide-react';
import { BonusSummaryCard, PercentageBonusCard, VolumeBonusCard, ActiveOutletsBonusCard } from './BonusCards';
import DateRangeFilter from './DateRangeFilter';

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

export default function SalesDashboard({ data, onVisitClick, dateFilter }) {
  const { user, dashboardStats, bonusSummary, outlets, skuPerformance, analytics, groupedData, activeIncentives, daysElapsed, daysInMonth } = data || {};
  const groupBy = dateFilter?.groupBy || data?.dateRange?.groupBy || 'month';

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

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Halo, {user?.name}</h2>
        <p className="text-sm text-slate-500">{user?.region || ''} {user?.level ? `• ${user.level}` : ''} • {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
      </section>

      {/* Date Range Filter */}
      {dateFilter && (
        <Card className="p-4">
          <DateRangeFilter
            activePreset={dateFilter.preset}
            dateStart={dateFilter.dateStart}
            dateEnd={dateFilter.dateEnd}
            groupBy={dateFilter.groupBy}
            onPresetChange={dateFilter.onPresetChange}
            onCustomChange={dateFilter.onCustomChange}
            onGroupByChange={dateFilter.onGroupByChange}
          />
        </Card>
      )}

      {/* Main Attainment Gauge */}
      <Card className="flex flex-col items-center py-8">
        <ProgressCircle percent={attainment} />
        <div className="mt-6 w-full grid grid-cols-2 gap-4 divide-x divide-slate-100 dark:divide-slate-800">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Aktual (BE)</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {dashboardStats.currentBE.toFixed(1)}
              {dashboardStats.incentiveBE > 0 && (
                <span className="text-xs font-medium text-emerald-500 ml-1">+{dashboardStats.incentiveBE.toFixed(1)} insentif</span>
              )}
              <span className="text-xs font-normal text-slate-400"> / {dashboardStats.monthlyTargetBE}</span>
            </p>
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

      {/* Analytics KPIs */}
      {analytics && (
        <section className="space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white px-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" /> Insight Analitik
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Velocity */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Velocity</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{analytics.avgVelocity.toFixed(1)}</p>
              <p className="text-[10px] text-slate-400">BE / hari rata-rata</p>
            </Card>

            {/* Coverage */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <StoreIcon className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Cakupan</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{analytics.coveragePct}%</p>
              <p className="text-[10px] text-slate-400">{analytics.activeOutletsCount}/{analytics.totalAssignedOutlets} outlet aktif</p>
            </Card>
          </div>
        </section>
      )}

      {/* Grouped Data Chart */}
      {groupedData && groupedData.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">
              Volume {groupBy === 'day' ? 'Per Hari' : groupBy === 'week' ? 'Per Minggu' : 'Per Bulan'}
            </span>
          </div>
          <div className="space-y-2">
            {groupedData.slice(-14).map((item, idx) => {
              const maxVol = Math.max(...groupedData.map(g => g.volume), 1);
              const barWidth = (item.volume / maxVol) * 100;
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-slate-500 truncate text-right text-[10px]">
                    {item.weekStart ? new Date(item.weekStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : item.label}
                  </span>
                  <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="w-16 text-right font-bold text-slate-700 dark:text-slate-300 text-[10px]">{item.volume.toFixed(0)} BE</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Active Incentive Badges */}
      {(activeIncentives || []).length > 0 && (
        <section className="space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white px-1 flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-500" /> Insentif SKU Aktif
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeIncentives.map((inc, idx) => (
              <div key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 dark:bg-pink-950/30 border border-pink-100 dark:border-pink-900/50 rounded-full text-xs font-medium text-pink-700 dark:text-pink-400">
                <Gift className="w-3 h-3" />
                <span>{inc.sku_name}</span>
                <span className="font-bold">+{inc.bonus_be} BE</span>
                {inc.notes && <span className="text-pink-500/70 text-[10px] truncate max-w-24" title={inc.notes}>{inc.notes}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* Where to Visit / What to Sell */}
      {analytics && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {/* Where to Visit */}
            {analytics.whereToVisit && analytics.whereToVisit.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase">Outlet yang Perlu Dikunjungi</span>
                  {analytics.lostCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                      {analytics.lostCount} hilang dari periode sebelumnya
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {analytics.whereToVisit.map((o, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{o.name}</span>
                        <span className="text-slate-400">{o.branchArea || o.type}</span>
                      </div>
                      <span className={`font-bold ${o.daysSince > 7 ? 'text-red-500' : 'text-amber-500'}`}>
                        {o.daysSince === 'Today' ? 'Hari ini' : `${o.daysSince} hari`}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* What to Sell */}
            {analytics.whatToSell && analytics.whatToSell.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase">Produk untuk Digeber</span>
                </div>
                <div className="space-y-1.5">
                  {analytics.whatToSell.map((sku, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{sku.name}</span>
                        {sku.activeIncentive && <span className="text-[10px] font-bold text-pink-500 bg-pink-50 dark:bg-pink-950/30 px-1.5 py-0.5 rounded">+Insentif</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">Penetrasi {sku.penetration}%</span>
                        <span className="font-bold text-emerald-600">+{sku.momTrend.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Total Bonus Summary */}
      <BonusSummaryCard bonusSummary={bonusSummary} />

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
      <SkuAnalysisSection skuPerformance={skuPerformance} />

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

// --- SKU Analysis Sub-component ---
export function SkuDetailModal({ sku, onClose }) {
  if (!sku) return null;
  const monthlyHistory = sku.monthlyHistory || [sku.volume * 0.8, sku.volume * 0.9, sku.volume * 0.95, sku.volume];
  const maxHistory = Math.max(...monthlyHistory, 1);
  const topOutletContrib = sku.topOutletContrib || 0;
  const transactions = sku.transactions || [];
  const prevTransactions = sku.prevTransactions || [];
  const trendColor = sku.momTrend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const trendBg = sku.momTrend > 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50' : 'bg-red-50 border-red-100 dark:bg-red-950/30 dark:border-red-900/50';
  const hasIncentive = (sku.incentiveBE || 0) > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300 shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{sku.name}</h3>
            <p className="text-xs text-slate-500 font-medium">Detail Analisis Produk</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Volume Periode Ini</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {sku.totalBE ? sku.totalBE.toFixed(1) : sku.volume.toFixed(1)} <span className="text-xs font-normal text-slate-400">BE</span>
              </p>
              {hasIncentive && (
                <p className="text-[10px] font-medium text-pink-600 mt-0.5">
                  <span className="text-slate-400">Default: {sku.volume.toFixed(1)}</span> + {sku.incentiveBE.toFixed(1)} BE insentif
                </p>
              )}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Volume Periode Lalu</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{sku.prevVolume > 0 ? sku.prevVolume.toFixed(1) : '0'} <span className="text-xs font-normal text-slate-400">BE</span></p>
            </div>
            <div className={`p-4 rounded-xl border ${trendBg}`}>
              <p className="text-[10px] uppercase font-bold tracking-wider mb-1 text-slate-500 dark:text-slate-400">vs Bulan Lalu</p>
              <div className={`text-xl font-bold flex items-center gap-1 ${trendColor}`}>
                {sku.momTrend > 0 ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                {Math.abs(sku.momTrend).toFixed(1)}%
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
              <BarChart3 className="w-4 h-4 text-blue-500"/> Volume 4 Minggu Terakhir
            </h4>
            <div className="h-40 flex items-end gap-3 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              {monthlyHistory.map((val, idx) => {
                const height = maxHistory > 0 ? (val / maxHistory) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 justify-end h-full">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{val.toFixed ? val.toFixed(0) : val}</span>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t-md relative overflow-hidden" style={{ height: `${Math.max(height, 5)}%` }}>
                       <div className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-all duration-700 ease-out ${sku.momTrend > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ height: '100%' }}></div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">M{idx+1}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
             <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
              <StoreIcon className="w-4 h-4 text-orange-500"/> Kontribusi Outlet Terbesar
            </h4>
            <Card className="flex items-center justify-between p-4">
               <div>
                 <p className="text-sm font-bold text-slate-900 dark:text-white">{sku.topOutlet}</p>
                 <p className="text-xs text-slate-500 mt-0.5">{topOutletContrib}% dari total volume SKU ini</p>
               </div>
               <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                 <span className="text-xs font-bold text-orange-600">{topOutletContrib}%</span>
               </div>
            </Card>
          </div>

          {transactions.length > 0 && (
            <div>
              <h4 className="font-bold text-sm mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
                <Package className="w-4 h-4 text-emerald-500"/> Transaksi Bulan Ini ({transactions.length})
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Total {sku.volume.toFixed(1)} BE
                {sku.avgOrder > 0 ? ` — rata-rata ${sku.avgOrder.toFixed(1)} BE/order` : ''}
              </p>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-emerald-50 dark:bg-emerald-900/30 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Tanggal</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Outlet</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-right">BE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{new Date(tx.date).toLocaleDateString('id-ID')}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={tx.outlet}>{tx.outlet}</td>
                          <td className="px-3 py-2 text-xs font-bold text-slate-900 dark:text-white text-right">{tx.be.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {prevTransactions.length > 0 && (
            <div>
              <h4 className="font-bold text-sm mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
                <Package className="w-4 h-4 text-slate-400"/> Transaksi Bulan Lalu ({prevTransactions.length})
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Total {sku.prevVolume.toFixed(1)} BE
                {sku.prevTransactionCount > 0 && sku.prevVolume > 0 ? ` — rata-rata ${(sku.prevVolume / sku.prevTransactionCount).toFixed(1)} BE/order` : ''}
              </p>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outlet</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">BE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {prevTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{new Date(tx.date).toLocaleDateString('id-ID')}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={tx.outlet}>{tx.outlet}</td>
                          <td className="px-3 py-2 text-xs font-bold text-slate-900 dark:text-white text-right">{tx.be.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
        <div className="h-6"></div>
      </div>
    </div>
  );
}

export function SkuAnalysisSection({ skuPerformance }) {
  const [showInfo, setShowInfo] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [selectedSku, setSelectedSku] = useState(null);

  const formatTrend = (val) => {
    if (val > 0) return { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', sign: '+' };
    if (val < 0) return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', sign: '' };
    return { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-50', sign: '' };
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-orange-500" /> Analisa Produk</h3>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-orange-500 transition-colors">
          <Info className="w-3.5 h-3.5" /> Info
        </button>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-500" /> Analisa Produk</h3>
              <button onClick={() => setShowInfo(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronDown className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p><strong>Ranking:</strong> Diurutkan berdasarkan total <strong>Box Equivalent (BE)</strong> bulan ini.</p>
              <p><strong>MoM Trend:</strong> Perbandingan volume bulan ini vs <strong>bulan lalu</strong>.</p>
              <p><strong>Mix %:</strong> Kontribusi SKU terhadap total BE semua produk.</p>
              <p><strong>Transaksi:</strong> Jumlah catatan/entry untuk SKU tersebut.</p>
              <p><strong>Rata-rata:</strong> Volume BE rata-rata per transaksi.</p>
            </div>
            <button onClick={() => setShowInfo(false)} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 active:scale-95 transition-all">
              Mengerti
            </button>
          </div>
        </div>
      )}

      <Card className="space-y-3">
        {(skuPerformance || []).length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Tidak ada data SKU untuk bulan ini.</p>
        )}
        {(skuPerformance || []).map((sku, idx) => {
          const isExpanded = expandedIdx === idx;
          const mom = formatTrend(sku.momTrend);
          const MomIcon = mom.icon;
          const barWidth = skuPerformance.length > 0 ? Math.min((sku.volume / (skuPerformance[0].volume || 1)) * 100, 100) : 0;

          return (
            <div key={idx} className="space-y-2">
              {/* Main Row */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-700 dark:text-slate-200">{sku.name}</span>
                    {(sku.incentiveBE || 0) > 0 && (
                      <span className="text-[9px] font-bold text-pink-600 bg-pink-50 dark:bg-pink-950/40 px-1.5 py-0.5 rounded">+{sku.incentiveBE.toFixed(1)}</span>
                    )}
                    <span className="text-[10px] font-medium text-slate-400">({sku.mixPercent.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-300">{sku.volume.toFixed(1)} BE</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }}></div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Trends - Only MoM, clickable */}
                  <button
                    onClick={() => setSelectedSku(sku)}
                    className={`w-full flex items-center gap-1.5 p-2 rounded-lg ${mom.bg} dark:bg-opacity-20 hover:opacity-80 transition-opacity text-left`}
                  >
                    <MomIcon className={`w-3.5 h-3.5 ${mom.color}`} />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">vs Bulan Lalu (Klik untuk detail)</p>
                      <p className={`text-xs font-bold ${mom.color}`}>{mom.sign}{sku.momTrend.toFixed(1)}%</p>
                    </div>
                    <ArrowUpRight className={`w-3.5 h-3.5 ${mom.color} opacity-50`} />
                  </button>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Transaksi</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{sku.transactionCount}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{sku.avgOrder.toFixed(1)} BE</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Penetrasi</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{sku.penetration || 0}%</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
      {selectedSku && <SkuDetailModal sku={selectedSku} onClose={() => setSelectedSku(null)} />}
    </section>
  );
}
