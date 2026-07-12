import { useState, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useTranslation } from '../lib/i18n.jsx';

const PRESETS = [
  { key: 'yesterday', labelKey: 'yesterday', getRange: () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const s = d.toISOString().split('T')[0]; return { start: s, end: s };
  }},
  { key: 'last7', labelKey: 'last7', getRange: () => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }},
  { key: 'last30', labelKey: 'last30', getRange: () => {
    const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - 29);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }},
  { key: 'thisWeek', labelKey: 'thisWeek', getRange: () => {
    const now = new Date(); const day = now.getDay() || 7;
    const start = new Date(); start.setDate(now.getDate() - day + 1);
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }},
  { key: 'thisMonth', labelKey: 'thisMonth', getRange: () => {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { start, end: now.toISOString().split('T')[0] };
  }},
  { key: 'lastMonth', labelKey: 'lastMonth', getRange: () => {
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
  { key: 'month', labelKey: 'month' },
  { key: 'week', labelKey: 'week' },
  { key: 'day', labelKey: 'day' },
];

export default function DateRangeFilter({ activePreset, dateStart, dateEnd, groupBy, onPresetChange, onCustomChange, onGroupByChange }) {
  const { t } = useTranslation();
  const [customStart, setCustomStart] = useState(dateStart || '');
  const [customEnd, setCustomEnd] = useState(dateEnd || '');
  const [showCustom, setShowCustom] = useState(activePreset === 'custom');
  const [selectedPreset, setSelectedPreset] = useState(activePreset || 'thisMonth');

  useEffect(() => {
    if (activePreset) {
      setSelectedPreset(activePreset);
      setShowCustom(activePreset === 'custom');
    }
  }, [activePreset]);

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
    <div className="space-y-3 sticky top-[6rem] z-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-2 will-change-transform">
      <div className="flex items-center gap-2 mb-1 cursor-pointer select-none" onClick={() => setShowCustom(s => !s)}>
        <Calendar className="w-4 h-4 text-emerald-500 pointer-events-none" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('dateRangeFilter.title')}</span>
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
            {t(`dateRangeFilter.presets.${p.labelKey}`)}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(s => !s)}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
            isActive('custom')
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {t('dateRangeFilter.custom')} <ChevronDown className={`w-3 h-3 transition-transform pointer-events-none ${showCustom ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-col sm:flex-row gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2">
          <div
            className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[48px] touch-manipulation cursor-pointer flex items-center"
            onClick={(e) => { const inp = e.currentTarget.querySelector('input'); try { inp.showPicker(); } catch { inp.focus(); } }}
          >
            <span className="text-sm sm:text-xs text-slate-700 dark:text-slate-300 pointer-events-none">
              {customStart || t('dateRangeFilter.startDate')}
            </span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              max={customEnd || undefined}
              className="sr-only"
              aria-label={t('dateRangeFilter.startDate')}
            />
          </div>
          <span className="text-xs text-slate-400 self-center">{t('dateRangeFilter.fromTo')}</span>
          <div
            className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[48px] touch-manipulation cursor-pointer flex items-center"
            onClick={(e) => { const inp = e.currentTarget.querySelector('input'); try { inp.showPicker(); } catch { inp.focus(); } }}
          >
            <span className="text-sm sm:text-xs text-slate-700 dark:text-slate-300 pointer-events-none">
              {customEnd || t('dateRangeFilter.endDate')}
            </span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              min={customStart || undefined}
              className="sr-only"
              aria-label={t('dateRangeFilter.endDate')}
            />
          </div>
          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="w-full sm:w-auto px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('dateRangeFilter.apply')}
          </button>
        </div>
      )}

      {onGroupByChange && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-slate-400">{t('dateRangeFilter.group')}:</span>
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
                {t(`dateRangeFilter.groups.${g.labelKey}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
