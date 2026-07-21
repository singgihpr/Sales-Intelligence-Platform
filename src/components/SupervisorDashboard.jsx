import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Target, Award, Store, ChevronRight, ArrowLeft, CheckCircle, X } from 'lucide-react';
import { SkuAnalysisSection } from './SalesDashboard';
import { useTranslation } from '../lib/i18n.jsx';
import { AlertModal } from './Modal';

const formatRp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${className}`}>
    {children}
  </div>
);

export default function SupervisorDashboard({ data, onNavigate }) {
  const { t } = useTranslation();
  const { team, teamStats } = data || {};
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [alert, setAlert] = useState(null);
  const token = localStorage.getItem('token');

  // Use team members directly for target config
  const teamUsers = (team || []).map(m => ({ id: m.id, name: m.name, level: m.level }));

  const handleSaveTarget = async (e, form) => {
    e.preventDefault();
    try {
      const body = {
        user_id: form.user_id,
        month: Number(form.month),
        year: Number(form.year),
        target_be: Number(form.target_be),
        level: teamUsers.find(u => u.id === form.user_id)?.level || 'L2'
      };
      const res = await fetch('/api?type=targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      setAlert({ type: 'success', message: t('supervisorDashboard.targetUpdated') });
    } catch (err) { setAlert({ type: 'error', message: err.message }); }
  };

  if (!team) return <div className="text-center text-slate-400 py-20">{t('supervisorDashboard.loading')}</div>;

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('supervisorDashboard.title')}</h2>
        <p className="text-sm text-slate-500">{t('supervisorDashboard.activeSalesmen', { count: team.length })} • {t('supervisorDashboard.vacantOutlets', { count: teamStats?.vacantOutlets || 0 })}</p>
      </section>

      {/* Aggregated Team Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-none">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t('supervisorDashboard.teamAttainment')}</p>
            <p className="text-3xl font-bold text-white mt-1">{teamStats?.teamAttainment || 0}%</p>
            <p className="text-xs text-slate-400 mt-2">{t('supervisorDashboard.total', { total: (teamStats?.totalTeamBE || 0).toFixed(1) })} / {t('supervisorDashboard.target', { target: (teamStats?.totalTarget || 0).toFixed(1) })}</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
            <Users className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </Card>

      {/* Team Ranking */}
      <section>
        <h3 className="font-bold text-slate-900 dark:text-white mb-3">{t('supervisorDashboard.rankingBonus')}</h3>
        <Card className="p-0 overflow-hidden">
          {(team || []).sort((a, b) => b.attainment - a.attainment).map((rep, idx) => (
            <div key={rep.id} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</div>
                <div>
                  <p className="text-sm font-bold text-left text-slate-900 dark:text-white">{rep.name}</p>
                  <p className="text-[10px] text-slate-500 text-left uppercase">{rep.level || t('common.sales')} • {rep.totalAssigned} {t('common.outlets')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${rep.attainment >= 90 ? 'text-emerald-500' : rep.attainment < 50 ? 'text-red-500' : 'text-amber-500'}`}>{rep.attainment}%</p>
                <div className="w-20 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div className={`h-full ${rep.attainment >= 90 ? 'bg-emerald-500' : rep.attainment < 50 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(rep.attainment, 100)}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 mt-1">{formatRp(rep.totalBonus)}</p>
              </div>
            </div>
          ))}
          {(team || []).length === 0 && <p className="p-4 text-center text-xs text-slate-400">{t('supervisorDashboard.noTeamData')}</p>}
        </Card>
      </section>

      {/* Bonus Config Panel Toggle */}
      <section>
        <button onClick={() => setConfigPanelOpen(!configPanelOpen)} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Target className="w-4 h-4" /> {configPanelOpen ? t('supervisorDashboard.closeConfig') : t('supervisorDashboard.setTargetBonus')}
        </button>
      </section>

      {configPanelOpen && (
        <Card className="space-y-4">
          <AlertModal open={!!alert} type={alert?.type} message={alert?.message} onClose={() => setAlert(null)} />
          <h3 className="font-bold text-slate-900 dark:text-white">{t('supervisorDashboard.setTargetBonusTitle')}</h3>
          <TargetConfigForm users={teamUsers} onSave={handleSaveTarget} />
        </Card>
      )}

      {/* Product Analysis */}
      {data?.skuPerformance && data.skuPerformance.length > 0 && (
        <SkuAnalysisSection skuPerformance={data.skuPerformance} />
      )}

      {/* Decline Alerts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">{t('supervisorDashboard.alertsVacant')}</h3>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{t('supervisorDashboard.vacant', { count: teamStats?.vacantOutlets || 0 })}</span>
        </div>
        <div className="space-y-3">
          <Card className="border-l-4 border-l-amber-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase">{t('supervisorDashboard.vacantOutletsTitle')}</p>
                <h4 className="text-sm font-bold mt-1 text-slate-900 dark:text-white">{t('supervisorDashboard.outletsWithoutSalesman', { count: teamStats?.vacantOutlets || 0 })}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{t('supervisorDashboard.supervisorMustHandle')}</p>
              </div>
              <button onClick={() => onNavigate && onNavigate('assignments')} className="text-[10px] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-lg font-bold">{t('supervisorDashboard.manage')}</button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function TargetConfigForm({ users, onSave }) {
  const { t } = useTranslation();
  const now = new Date();
  const [form, setForm] = useState({ user_id: '', month: now.getMonth()+1, year: now.getFullYear(), target_be: 2000 });
  const selectedUser = users.find(u => u.id === form.user_id);

  return (
    <form onSubmit={(e) => onSave(e, form)} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{t('supervisorDashboard.form.salesman')}</label>
        <select required value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800 text-sm">
          <option value="" disabled>{t('supervisorDashboard.form.selectSalesman')}</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.level || '-'})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('supervisorDashboard.form.month')}</label>
          <input type="number" min="1" max="12" required value={form.month} onChange={e => setForm({...form, month: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('supervisorDashboard.form.year')}</label>
          <input type="number" min="2024" max="2100" required value={form.year} onChange={e => setForm({...form, year: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('supervisorDashboard.form.targetBE')}</label>
          <input type="number" step="0.1" required value={form.target_be} onChange={e => setForm({...form, target_be: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
      </div>
      {selectedUser && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500">
          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">{t('supervisorDashboard.defaultsForLevel', { level: selectedUser.level || 'L2' })}</p>
          <p>{t('supervisorDashboard.percentageBase', { value: selectedUser.level === 'L3' ? 'Rp 1.200.000' : 'Rp 1.000.000' })}</p>
          <p>{t('supervisorDashboard.volumeTiers', { tiers: '1500BE → 250K, 2500BE → 500K, 3500BE → 750K' })}</p>
          <p>{t('supervisorDashboard.activeOutletsBase', { value: selectedUser.level === 'L3' ? 'Rp 400.000' : 'Rp 300.000' })}</p>
        </div>
      )}
      <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700">{t('supervisorDashboard.form.saveTarget')}</button>
    </form>
  );
}
