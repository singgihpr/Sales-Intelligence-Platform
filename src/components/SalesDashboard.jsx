import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Target, Package, ShoppingBag, Info, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3, X, Store as StoreIcon, Zap, MapPin, Gift, Activity } from 'lucide-react';
import { BonusSummaryCard, PercentageBonusCard, VolumeBonusCard, ActiveOutletsBonusCard } from './BonusCards';
import DateRangeFilter from './DateRangeFilter';
import Hint from './Hint';
import { useTranslation } from '../lib/i18n.jsx';

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

const Card = ({ children, className = "", onClick, hint }) => (
  <div onClick={onClick} className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : ''} ${className}`}>
    {hint && <Hint text={hint} />}
    {children}
  </div>
);

export default function SalesDashboard({ data, dateFilter }) {
  const { t, dateLocale } = useTranslation();
  const { user, dashboardStats, bonusSummary, outlets, skuPerformance, analytics, groupedData, activeIncentives, daysElapsed, daysInMonth } = data || {};
  const groupBy = dateFilter?.groupBy || data?.dateRange?.groupBy || 'month';

  if (!dashboardStats) return <div className="text-center text-slate-400 py-20">{t('salesDashboard.loading')}</div>;

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

  const groupLabel = groupBy === 'day'
    ? t('dateRangeFilter.groups.day')
    : groupBy === 'week'
      ? t('dateRangeFilter.groups.week')
      : t('dateRangeFilter.groups.month');

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Info */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('common.greeting', { name: user?.name })}</h2>
        <p className="text-sm text-slate-500">{user?.region || ''} {user?.level ? `• ${user.level}` : ''} • {new Date().toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })}</p>
      </section>

      {/* Date Range Filter */}
      {dateFilter && (
        <DateRangeFilter
          activePreset={dateFilter.preset}
          dateStart={dateFilter.dateStart}
          dateEnd={dateFilter.dateEnd}
          groupBy={dateFilter.groupBy}
          onPresetChange={dateFilter.onPresetChange}
          onCustomChange={dateFilter.onCustomChange}
          onGroupByChange={dateFilter.onGroupByChange}
        />
      )}

      {/* Main Attainment Gauge */}
      <Card className="flex flex-col items-center py-8" hint={t('salesDashboard.hints.attainmentGauge')}>
        <ProgressCircle percent={attainment} />
        <div className="mt-6 w-full grid grid-cols-2 gap-4 divide-x divide-slate-100 dark:divide-slate-800">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('salesDashboard.actual')}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {dashboardStats.currentBE.toFixed(1)}
              {dashboardStats.incentiveBE > 0 && (
                <span className="text-xs font-medium text-emerald-500 ml-1">+{dashboardStats.incentiveBE.toFixed(1)} {t('salesDashboard.incentive')}</span>
              )}
              <span className="text-xs font-normal text-slate-400"> / {dashboardStats.monthlyTargetBE}</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('salesDashboard.projectedEnd')}</p>
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
            <Activity className="w-4 h-4 text-blue-500" /> {t('salesDashboard.analytics')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Velocity */}
            <Card className="p-4" hint={t('salesDashboard.hints.velocity')}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('salesDashboard.velocity')}</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{analytics.avgVelocity.toFixed(1)}</p>
              <p className="text-[10px] text-slate-400">{t('salesDashboard.velocityHint')}</p>
            </Card>

            {/* Coverage */}
            <Card className="p-4" hint={t('salesDashboard.hints.coverage')}>
              <div className="flex items-center gap-2 mb-1">
                <StoreIcon className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('salesDashboard.coverage')}</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{analytics.coveragePct}%</p>
              <p className="text-[10px] text-slate-400">{t('salesDashboard.coverageHint', { active: analytics.activeOutletsCount, total: analytics.totalAssignedOutlets })}</p>
            </Card>
          </div>
        </section>
      )}

      {/* Grouped Data Chart */}
      {groupedData && groupedData.length > 0 && (
        <Card className="p-4" hint={t('salesDashboard.hints.groupedChart')}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-slate-500 uppercase">
              {t('salesDashboard.volume')} {groupLabel}
            </span>
          </div>
          <div className="space-y-2">
            {groupedData.slice(-14).map((item, idx) => {
              const maxVol = Math.max(...groupedData.map(g => g.volume), 1);
              const barWidth = (item.volume / maxVol) * 100;
              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-slate-500 truncate text-right text-[10px]">
                    {item.weekStart ? new Date(item.weekStart).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }) : item.label}
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
            <Gift className="w-4 h-4 text-pink-500" /> {t('salesDashboard.activeIncentives')}
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
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">{t('salesDashboard.dailyNeed')}</p>
            <p className="text-sm text-emerald-900 dark:text-emerald-200 mt-0.5">
              {t('salesDashboard.dailyNeedText', { be: shortfallPerDay, days: daysLeft })}
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
              <Card className="p-4" hint={t('salesDashboard.hints.whereToVisit')}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase">{t('salesDashboard.whereToVisit')}</span>
                  {analytics.lostCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
                      {t('salesDashboard.lostFromPrevious', { count: analytics.lostCount })}
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
                        {o.daysSince === 'Today' ? t('common.today') : t('salesDashboard.daysSince', { days: o.daysSince })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* What to Sell */}
            {analytics.whatToSell && analytics.whatToSell.length > 0 && (
              <Card className="p-4" hint={t('salesDashboard.hints.whatToSell')}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase">{t('salesDashboard.whatToSell')}</span>
                </div>
                <div className="space-y-1.5">
                  {analytics.whatToSell.map((sku, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{sku.name}</span>
                        {sku.activeIncentive && <span className="text-[10px] font-bold text-pink-500 bg-pink-50 dark:bg-pink-950/30 px-1.5 py-0.5 rounded">{t('salesDashboard.incentiveTag')}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{t('salesDashboard.penetration')} {sku.penetration}%</span>
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
      <BonusSummaryCard bonusSummary={bonusSummary} hint={t('salesDashboard.hints.bonusSummary')} />

      {/* Detailed Bonus Cards */}
      <section className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white px-1">{t('salesDashboard.bonusDetails')}</h3>
        <PercentageBonusCard
          currentBE={dashboardStats.currentBE}
          targetBE={dashboardStats.monthlyTargetBE}
          config={dashboardStats.percentageConfig}
          result={bonusSummary?.percentage}
          hint={t('salesDashboard.hints.percentageBonus')}
        />
        <VolumeBonusCard
          currentBE={dashboardStats.currentBE}
          config={dashboardStats.volumeConfig}
          result={bonusSummary?.volume}
          hint={t('salesDashboard.hints.volumeBonus')}
        />
        <ActiveOutletsBonusCard
          totalAssigned={outlets?.length || 0}
          activeCount={bonusSummary?.activeOutlets?.activeCount || 0}
          config={dashboardStats.activeOutletsConfig}
          result={bonusSummary?.activeOutlets}
          hint={t('salesDashboard.hints.activeOutletsBonus')}
        />
      </section>

      {/* Product Analysis (SKU) */}
      <SkuAnalysisSection skuPerformance={skuPerformance} />
    </div>
  );
}

// --- SKU Analysis Sub-component ---
export function SkuDetailModal({ sku, onClose }) {
  const { t, dateLocale } = useTranslation();
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
            <p className="text-xs text-slate-500 font-medium">{t('salesDashboard.skuDetail.title')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('salesDashboard.skuDetail.volumeThis')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {sku.totalBE ? sku.totalBE.toFixed(1) : sku.volume.toFixed(1)} <span className="text-xs font-normal text-slate-400">BE</span>
              </p>
              {hasIncentive && (
                <p className="text-[10px] font-medium text-pink-600 mt-0.5">
                  <span className="text-slate-400">Default: {sku.volume.toFixed(1)}</span> + {sku.incentiveBE.toFixed(1)} BE {t('salesDashboard.incentive')}
                </p>
              )}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">{t('salesDashboard.skuDetail.volumeLast')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{sku.prevVolume > 0 ? sku.prevVolume.toFixed(1) : '0'} <span className="text-xs font-normal text-slate-400">BE</span></p>
            </div>
            <div className={`p-4 rounded-xl border ${trendBg}`}>
              <p className="text-[10px] uppercase font-bold tracking-wider mb-1 text-slate-500 dark:text-slate-400">{t('salesDashboard.skuDetail.vsLastMonth')}</p>
              <div className={`text-xl font-bold flex items-center gap-1 ${trendColor}`}>
                {sku.momTrend > 0 ? <TrendingUp className="w-5 h-5"/> : <TrendingDown className="w-5 h-5"/>}
                {Math.abs(sku.momTrend).toFixed(1)}%
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
              <BarChart3 className="w-4 h-4 text-blue-500"/> {t('salesDashboard.skuDetail.last4Weeks')}
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
              <StoreIcon className="w-4 h-4 text-orange-500"/> {t('salesDashboard.skuDetail.topOutlet')}
            </h4>
            <Card className="flex items-center justify-between p-4" hint={t('salesDashboard.hints.skuAnalysis')}>
               <div>
                 <p className="text-sm font-bold text-slate-900 dark:text-white">{sku.topOutlet}</p>
                 <p className="text-xs text-slate-500 mt-0.5">{topOutletContrib}{t('salesDashboard.skuDetail.topOutletHint')}</p>
               </div>
               <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                 <span className="text-xs font-bold text-orange-600">{topOutletContrib}%</span>
               </div>
            </Card>
          </div>

          {transactions.length > 0 && (
            <div>
              <h4 className="font-bold text-sm mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
                <Package className="w-4 h-4 text-emerald-500"/> {t('salesDashboard.skuDetail.transactionsThis')} ({transactions.length})
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {t('salesDashboard.skuDetail.total')} {sku.volume.toFixed(1)} BE
                {sku.avgOrder > 0 ? ` — ${t('salesDashboard.skuDetail.avgPerOrder', { avg: sku.avgOrder.toFixed(1) })}` : ''}
              </p>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-emerald-50 dark:bg-emerald-900/30 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{t('common.date')}</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{t('common.outlet')}</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-right">BE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{new Date(tx.date).toLocaleDateString(dateLocale)}</td>
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
                <Package className="w-4 h-4 text-slate-400"/> {t('salesDashboard.skuDetail.transactionsLast')} ({prevTransactions.length})
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                {t('salesDashboard.skuDetail.total')} {sku.prevVolume.toFixed(1)} BE
                {sku.prevTransactionCount > 0 && sku.prevVolume > 0 ? ` — ${t('salesDashboard.skuDetail.avgPerOrder', { avg: (sku.prevVolume / sku.prevTransactionCount).toFixed(1) })}` : ''}
              </p>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.date')}</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('common.outlet')}</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">BE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {prevTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300">{new Date(tx.date).toLocaleDateString(dateLocale)}</td>
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
  const { t } = useTranslation();
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
        <h3 className="font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-orange-500" /> {t('salesDashboard.productAnalysis')}</h3>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-orange-500 transition-colors">
          <Info className="w-3.5 h-3.5" /> {t('salesDashboard.productAnalysisInfo')}
        </button>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-orange-500" /> {t('salesDashboard.productAnalysisModal.title')}</h3>
              <button onClick={() => setShowInfo(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><ChevronDown className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p><strong>Ranking:</strong> {t('salesDashboard.productAnalysisModal.ranking')}</p>
              <p><strong>MoM Trend:</strong> {t('salesDashboard.productAnalysisModal.mom')}</p>
              <p><strong>Mix %:</strong> {t('salesDashboard.productAnalysisModal.mix')}</p>
              <p><strong>Transaksi:</strong> {t('salesDashboard.productAnalysisModal.transactions')}</p>
              <p><strong>Rata-rata:</strong> {t('salesDashboard.productAnalysisModal.average')}</p>
            </div>
            <button onClick={() => setShowInfo(false)} className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 active:scale-95 transition-all">
              {t('salesDashboard.productAnalysisModal.close')}
            </button>
          </div>
        </div>
      )}

      <Card className="space-y-3" hint={t('salesDashboard.hints.skuAnalysis')}>
        {(skuPerformance || []).length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">{t('salesDashboard.productAnalysisModal.noData')}</p>
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
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{t('salesDashboard.skuDetail.vsLastMonth')} ({t('salesDashboard.productAnalysisModal.clickDetail')})</p>
                      <p className={`text-xs font-bold ${mom.color}`}>{mom.sign}{sku.momTrend.toFixed(1)}%</p>
                    </div>
                    <ArrowUpRight className={`w-3.5 h-3.5 ${mom.color} opacity-50`} />
                  </button>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{t('salesDashboard.productAnalysisModal.transactions')}</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{sku.transactionCount}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{t('salesDashboard.productAnalysisModal.average')}</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{sku.avgOrder.toFixed(1)} BE</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{t('salesDashboard.penetration')}</p>
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
