import React, { useState } from 'react';
import { Target, TrendingUp, Store, CheckCircle, Award } from 'lucide-react';

const formatRp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const BonusProgressBar = ({ label, current, max, markers, colorClass = 'bg-emerald-500' }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900 dark:text-white">{Math.round(pct)}%</span>
      </div>
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative">
        <div className={`h-full ${colorClass} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
        {markers && markers.map((m, i) => (
          <div key={i} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${Math.min((m / max) * 100, 100)}%` }}></div>
        ))}
      </div>
    </div>
  );
};

export const BonusSummaryCard = ({ bonusSummary }) => {
  const { percentage, volume, activeOutlets, total } = bonusSummary || {};
  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-sm border border-slate-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Total Est. Bonus</p>
          <p className="text-2xl font-bold mt-1">{formatRp(total || 0)}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Award className="w-6 h-6 text-emerald-400" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-700/50">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Percentage</p>
          <p className="text-sm font-bold text-emerald-300">{formatRp(percentage?.bonus || 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Volume</p>
          <p className="text-sm font-bold text-blue-300">{formatRp(volume?.bonus || 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Active Outlets</p>
          <p className="text-sm font-bold text-amber-300">{formatRp(activeOutlets?.bonus || 0)}</p>
        </div>
      </div>
    </div>
  );
};

export const PercentageBonusCard = ({ currentBE, targetBE, config, result }) => {
  const [simulatedBE, setSimulatedBE] = useState(currentBE);
  if (!config || !config.tiers) return null;

  const attainment = targetBE > 0 ? (currentBE / targetBE) * 100 : 0;
  const simAttainment = targetBE > 0 ? (simulatedBE / targetBE) * 100 : 0;

  const getTier = (att) => {
    let activeTier = null;
    for (const tier of config.tiers) {
      if (att >= tier.threshold) activeTier = tier;
    }
    return activeTier;
  };

  const currentTier = getTier(attainment);
  const simTier = getTier(simAttainment);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Target className="w-4 h-4 text-emerald-600" /> Percentage Based</h3>
        <span className="text-xs font-bold text-slate-400">Base: {formatRp(config.base_reward)}</span>
      </div>
      <BonusProgressBar label="Attainment" current={currentBE} max={targetBE} markers={config.tiers.map(t => (t.threshold / 100) * targetBE)} />
      <div className="flex justify-between mt-2">
        {config.tiers.map((tier, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div className={`text-[10px] font-bold mb-1 ${attainment >= tier.threshold ? 'text-emerald-600' : 'text-slate-400'} flex items-center gap-0.5`}>
              {tier.threshold}%
              {attainment >= tier.threshold && <CheckCircle className="w-3 h-3 text-emerald-500" />}
            </div>
            <div className={`h-2 w-0.5 ${attainment >= tier.threshold ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
            <div className={`mt-1 text-[10px] font-medium ${attainment >= tier.threshold ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              {formatRp(tier.reward)}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500">Current:</span>
        <span className="text-sm font-bold text-emerald-600">{formatRp(currentTier ? currentTier.reward : 0)}</span>
      </div>
      {/* Mini simulator inside card */}
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800 space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase">Simulate BE</label>
        <input type="range" min="0" max={Math.round(targetBE * 1.3)} step="1" value={simulatedBE} onChange={e => setSimulatedBE(Number(e.target.value))} className="w-full accent-emerald-600" />
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>0</span><span>{Math.round(targetBE * 1.3)} BE</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Projected:</span>
          <span className="text-sm font-bold text-blue-600">{formatRp(simTier ? simTier.reward : 0)} ({Math.round(simAttainment)}%)</span>
        </div>
      </div>
    </div>
  );
};

export const VolumeBonusCard = ({ currentBE, config, result }) => {
  if (!config || !config.tiers) return null;
  const maxTier = config.tiers[config.tiers.length - 1];
  const maxThreshold = maxTier?.threshold || 3500;

  const getTier = (be) => {
    let activeTier = null;
    for (const tier of config.tiers) {
      if (be >= tier.threshold) activeTier = tier;
    }
    return activeTier;
  };

  const currentTier = getTier(currentBE);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Tier Volume Based</h3>
      </div>
      <BonusProgressBar label="Volume BE" current={currentBE} max={maxThreshold} markers={config.tiers.map(t => t.threshold)} colorClass="bg-blue-500" />
      <div className="grid grid-cols-3 gap-2 mt-2">
        {config.tiers.map((tier, idx) => (
          <div key={idx} className={`text-center p-2 rounded-lg ${currentBE >= tier.threshold ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800'}`}>
            <p className="text-[10px] font-bold uppercase text-slate-400">{tier.label}</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">{tier.threshold} BE</p>
            <p className={`text-sm font-bold mt-1 ${currentBE >= tier.threshold ? 'text-blue-600' : 'text-slate-400'}`}>{formatRp(tier.reward)}</p>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500">Current Reward:</span>
        <span className="text-sm font-bold text-blue-600">{formatRp(currentTier ? currentTier.reward : 0)}</span>
      </div>
    </div>
  );
};

export const ActiveOutletsBonusCard = ({ totalAssigned, activeCount, config, result }) => {
  if (!config || !config.tiers) return null;
  const percent = totalAssigned > 0 ? (activeCount / totalAssigned) * 100 : 0;

  const getTier = (pct) => {
    let activeTier = null;
    for (const tier of config.tiers) {
      if (pct >= tier.threshold) activeTier = tier;
    }
    return activeTier;
  };

  const currentTier = getTier(percent);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Store className="w-4 h-4 text-amber-600" /> Active Outlets</h3>
        <span className="text-xs font-bold text-slate-400">Base: {formatRp(config.base_reward)}</span>
      </div>
      <BonusProgressBar label="Active Rate" current={activeCount} max={totalAssigned} markers={config.tiers.map(t => (t.threshold / 100) * totalAssigned)} colorClass="bg-amber-500" />
      <div className="flex justify-center gap-1 text-xs font-medium text-slate-500">
        <span className="font-bold text-slate-900 dark:text-white">{activeCount}</span> / <span>{totalAssigned}</span> outlets active ({Math.round(percent)}%)
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {config.tiers.map((tier, idx) => (
          <div key={idx} className={`text-center p-2 rounded-lg ${percent >= tier.threshold ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800'}`}>
            <p className="text-[10px] font-bold uppercase text-slate-400">{tier.label}</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">{tier.threshold}%</p>
            <p className={`text-sm font-bold mt-1 ${percent >= tier.threshold ? 'text-amber-600' : 'text-slate-400'}`}>{formatRp(tier.reward)}</p>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500">Current Reward:</span>
        <span className="text-sm font-bold text-amber-600">{formatRp(currentTier ? currentTier.reward : 0)}</span>
      </div>
    </div>
  );
};
