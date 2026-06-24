import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, Target, Award, Store, ChevronRight, ArrowLeft, CheckCircle, X } from 'lucide-react';
import { SkuAnalysisSection } from './SalesDashboard';

const formatRp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${className}`}>
    {children}
  </div>
);

export default function SupervisorDashboard({ data, onNavigate }) {
  const { team, teamStats } = data || {};
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api?type=users&limit=9999&search=', { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      setUsers((result.data || []).filter(u => u.role === 'sales'));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (configPanelOpen) fetchUsers(); }, [configPanelOpen]);

  const handleSaveTarget = async (e, form) => {
    e.preventDefault();
    try {
      const body = {
        user_id: form.user_id,
        month: Number(form.month),
        year: Number(form.year),
        target_be: Number(form.target_be),
        level: users.find(u => u.id === form.user_id)?.level || 'L2'
      };
      const res = await fetch('/api?type=targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage('✅ Target updated');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) { setMessage(`❌ ${err.message}`); }
  };

  if (!team) return <div className="text-center text-slate-400 py-20">Loading...</div>;

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <section>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Team Performance</h2>
        <p className="text-sm text-slate-500">{team.length} Active Salesmen • {teamStats?.vacantOutlets || 0} Vacant Outlets</p>
      </section>

      {/* Aggregated Team Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-none">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Team Attainment</p>
            <p className="text-3xl font-bold text-white mt-1">{teamStats?.teamAttainment || 0}%</p>
            <p className="text-xs text-slate-400 mt-2">Total: {(teamStats?.totalTeamBE || 0).toFixed(1)} BE / Target: {(teamStats?.totalTarget || 0).toFixed(1)} BE</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
            <Users className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </Card>

      {/* Team Ranking */}
      <section>
        <h3 className="font-bold text-slate-900 dark:text-white mb-3">Ranking & Bonus</h3>
        <Card className="p-0 overflow-hidden">
          {(team || []).sort((a, b) => b.attainment - a.attainment).map((rep, idx) => (
            <div key={rep.id} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{rep.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase">{rep.level || 'Sales'} • {rep.totalAssigned} outlets</p>
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
          {(team || []).length === 0 && <p className="p-4 text-center text-xs text-slate-400">No team data.</p>}
        </Card>
      </section>

      {/* Bonus Config Panel Toggle */}
      <section>
        <button onClick={() => setConfigPanelOpen(!configPanelOpen)} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <Target className="w-4 h-4" /> {configPanelOpen ? 'Tutup Konfigurasi' : 'Atur Target & Bonus'}
        </button>
      </section>

      {configPanelOpen && (
        <Card className="space-y-4">
          {message && <div className={`text-xs font-bold p-2 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</div>}
          <h3 className="font-bold text-slate-900 dark:text-white">Set Target & Bonus</h3>
          <TargetConfigForm users={users} onSave={handleSaveTarget} />
        </Card>
      )}

      {/* Product Analysis */}
      {data?.skuPerformance && data.skuPerformance.length > 0 && (
        <SkuAnalysisSection skuPerformance={data.skuPerformance} />
      )}

      {/* Decline Alerts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">Alerts & Vacant</h3>
          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{teamStats?.vacantOutlets || 0} Vacant</span>
        </div>
        <div className="space-y-3">
          <Card className="border-l-4 border-l-amber-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase">Vacant Outlets</p>
                <h4 className="text-sm font-bold mt-1 text-slate-900 dark:text-white">{teamStats?.vacantOutlets || 0} outlets tanpa salesman</h4>
                <p className="text-xs text-slate-500 mt-0.5">Supervisor harus menangani atau assign salesman.</p>
              </div>
              <button onClick={() => onNavigate && onNavigate('assignments')} className="text-[10px] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 rounded-lg font-bold">Kelola</button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function TargetConfigForm({ users, onSave }) {
  const now = new Date();
  const [form, setForm] = useState({ user_id: '', month: now.getMonth()+1, year: now.getFullYear(), target_be: 2000 });
  const selectedUser = users.find(u => u.id === form.user_id);

  return (
    <form onSubmit={(e) => onSave(e, form)} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Salesman</label>
        <select required value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800 text-sm">
          <option value="" disabled>Pilih Salesman</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.level || '-'})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Bulan</label>
          <input type="number" min="1" max="12" required value={form.month} onChange={e => setForm({...form, month: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tahun</label>
          <input type="number" min="2024" max="2100" required value={form.year} onChange={e => setForm({...form, year: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Target BE</label>
          <input type="number" step="0.1" required value={form.target_be} onChange={e => setForm({...form, target_be: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-sm" />
        </div>
      </div>
      {selectedUser && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-500">
          <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Defaults untuk Level {selectedUser.level || 'L2'}:</p>
          <p>Percentage Base: {selectedUser.level === 'L3' ? 'Rp 1.200.000' : 'Rp 1.000.000'}</p>
          <p>Volume Tiers: 1500BE → 250K, 2500BE → 500K, 3500BE → 750K</p>
          <p>Active Outlets Base: {selectedUser.level === 'L3' ? 'Rp 400.000' : 'Rp 300.000'}</p>
        </div>
      )}
      <button type="submit" className="w-full py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700">Simpan Target</button>
    </form>
  );
}
