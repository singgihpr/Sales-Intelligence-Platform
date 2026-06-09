import React, { useState } from 'react';
import { Target, TrendingUp, Store, CheckCircle, Award, ChevronDown, ChevronUp, Calculator } from 'lucide-react';

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
  const [isSimulating, setIsSimulating] = useState(false);
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
      
      {/* Simulator Toggle */}
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
        <button 
          onClick={() => setIsSimulating(!isSimulating)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          {isSimulating ? 'Tutup Simulasi' : 'Buka Simulasi'}
          {isSimulating ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        
        {isSimulating && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Proyeksi BE</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" 
                    value={simulatedBE} 
                    onChange={e => setSimulatedBE(Math.max(0, Number(e.target.value)))} 
                    className="w-20 text-right text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                  />
                  <span className="text-xs text-slate-400 font-medium">BE</span>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max={Math.round(targetBE * 1.3)} 
                step="1" 
                value={simulatedBE} 
                onChange={e => setSimulatedBE(Number(e.target.value))} 
                className="w-full accent-emerald-600" 
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0</span><span>{Math.round(targetBE * 1.3)} BE</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Attainment</p>
                <p className={`text-lg font-bold ${simAttainment >= 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{Math.round(simAttainment)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Bonus</p>
                <p className="text-lg font-bold text-emerald-600">{formatRp(simTier ? simTier.reward : 0)}</p>
              </div>
            </div>
            {simTier && currentTier && simTier.reward !== currentTier.reward && (
              <div className={`text-xs font-bold text-center py-2.5 rounded-lg ${simTier.reward > currentTier.reward ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                {simTier.reward > currentTier.reward 
                  ? `+${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini` 
                  : `${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini`
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const VolumeBonusCard = ({ currentBE, config, result }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedBE, setSimulatedBE] = useState(currentBE);
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
  const simTier = getTier(simulatedBE);

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

      {/* Simulator Toggle */}
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
        <button 
          onClick={() => setIsSimulating(!isSimulating)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          {isSimulating ? 'Tutup Simulasi' : 'Buka Simulasi'}
          {isSimulating ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        
        {isSimulating && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Proyeksi BE</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" 
                    value={simulatedBE} 
                    onChange={e => setSimulatedBE(Math.max(0, Number(e.target.value)))} 
                    className="w-20 text-right text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  />
                  <span className="text-xs text-slate-400 font-medium">BE</span>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max={Math.round(maxThreshold * 1.3)} 
                step="1" 
                value={simulatedBE} 
                onChange={e => setSimulatedBE(Number(e.target.value))} 
                className="w-full accent-blue-600" 
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0</span><span>{Math.round(maxThreshold * 1.3)} BE</span>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Bonus</p>
              <p className="text-lg font-bold text-blue-600">{formatRp(simTier ? simTier.reward : 0)}</p>
            </div>
            {simTier && currentTier && simTier.reward !== currentTier.reward && (
              <div className={`text-xs font-bold text-center py-2.5 rounded-lg ${simTier.reward > currentTier.reward ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                {simTier.reward > currentTier.reward 
                  ? `+${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini` 
                  : `${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini`
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ActiveOutletsBonusCard = ({ totalAssigned, activeCount, config, result }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedActive, setSimulatedActive] = useState(activeCount);
  if (!config || !config.tiers) return null;
  const percent = totalAssigned > 0 ? (activeCount / totalAssigned) * 100 : 0;
  const simPercent = totalAssigned > 0 ? (simulatedActive / totalAssigned) * 100 : 0;

  const getTier = (pct) => {
    let activeTier = null;
    for (const tier of config.tiers) {
      if (pct >= tier.threshold) activeTier = tier;
    }
    return activeTier;
  };

  const currentTier = getTier(percent);
  const simTier = getTier(simPercent);

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

      {/* Simulator Toggle */}
      <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
        <button 
          onClick={() => setIsSimulating(!isSimulating)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          {isSimulating ? 'Tutup Simulasi' : 'Buka Simulasi'}
          {isSimulating ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        
        {isSimulating && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase">Proyeksi Active Outlets</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" 
                    max={totalAssigned}
                    value={simulatedActive} 
                    onChange={e => setSimulatedActive(Math.max(0, Math.min(totalAssigned, Number(e.target.value))))} 
                    className="w-20 text-right text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-amber-500 outline-none transition-shadow"
                  />
                  <span className="text-xs text-slate-400 font-medium">/ {totalAssigned}</span>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max={totalAssigned}
                step="1" 
                value={simulatedActive} 
                onChange={e => setSimulatedActive(Number(e.target.value))} 
                className="w-full accent-amber-600" 
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>0</span><span>{totalAssigned} outlets</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Active Rate</p>
                <p className={`text-lg font-bold ${simPercent >= 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>{Math.round(simPercent)}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Est. Bonus</p>
                <p className="text-lg font-bold text-amber-600">{formatRp(simTier ? simTier.reward : 0)}</p>
              </div>
            </div>
            {simTier && currentTier && simTier.reward !== currentTier.reward && (
              <div className={`text-xs font-bold text-center py-2.5 rounded-lg ${simTier.reward > currentTier.reward ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                {simTier.reward > currentTier.reward 
                  ? `+${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini` 
                  : `${formatRp(simTier.reward - currentTier.reward)} vs realitas saat ini`
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
