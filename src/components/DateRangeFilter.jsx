import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const PRESETS = [
  { key: 'yesterday', label: 'Kemarin', getRange: () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const s = d.toISOString().split('T')[0]; return { start: s, end: s };
  }},
  { key: 'last7', label: '7 Hari', getRange: () => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }},
  { key: 'last30', label: '30 Hari', getRange: () => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }},
  { key: 'thisWeek', label: 'Minggu Ini', getRange: () => {
    const now = new Date(); const day = now.getDay() || 7;
    const start = new Date(); start.setDate(now.getDate() - day + 1);
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }},
  { key: 'thisMonth', label: 'Bulan Ini', getRange: () => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { start, end: now.toISOString().split('T')[0] };
  }},
  { key: 'lastMonth', label: 'Bulan Lalu', getRange: () => {
    const now = new Date();
    const m = now.getMonth(); const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonth = m === 0 ? 12 : m;
    const lastDay = new Date(y, prevMonth, 0).getDate();
    return {
      start: `${y}-${String(prevMonth).padStart(2, '0')}-01`,
      end: `${y}-${String(prevMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    };
  }},
];

const GROUP_OPTIONS = [
  { key: 'month', label: 'Per Bulan' },
  { key: 'week', label: 'Per Minggu' },
  { key: 'day', label: 'Per Hari' },
];

export default function DateRangeFilter({ activePreset, dateStart, dateEnd, groupBy, onPresetChange, onCustomChange, onGroupByChange }) {
  const [customStart, setCustomStart] = useState(dateStart || '');
  const [customEnd, setCustomEnd] = useState(dateEnd || '');
  const [showCustom, setShowCustom] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(activePreset || 'thisMonth');

  const handlePreset = (preset) => {
    const range = preset.getRange();
    setSelectedPreset(preset.key);
    setShowCustom(false);
    onPresetChange(preset.key, range.start, range.end);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setSelectedPreset('custom');
      onCustomChange(customStart, customEnd);
    }
  };

  const isActive = (key) => selectedPreset === key;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Periode Analisa</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
              isActive(p.key)
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
            isActive('custom')
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Custom <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            max={customEnd || undefined}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <span className="text-xs text-slate-400">s/d</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            min={customStart || undefined}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Terapkan
          </button>
        </div>
      )}

      {onGroupByChange && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-slate-400">Grup:</span>
          <div className="flex gap-1">
            {GROUP_OPTIONS.map(g => (
              <button
                key={g.key}
                onClick={() => onGroupByChange(g.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  groupBy === g.key
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
