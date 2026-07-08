import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, Calendar, MessageSquare, History, MapPin, ChevronRight, Info, X, ChevronLeft, ChevronDown, TrendingUp, TrendingDown, Activity, RefreshCw } from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';

const OHSInfoModal = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-6 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Outlet Health Score (OHS)</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          OHS menunjukkan seberapa &quot;sehat&quot; outlet berdasarkan historical transaksi 3 bulan terakhir. Semakin tinggi skor, semakin sehat outlet tersebut.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">70 - 100</p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-500/70">Sehat — volume & trend BE stabil/naik, transaksi rutin</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">40 - 69</p>
              <p className="text-[10px] text-amber-700/70 dark:text-amber-500/70">Perlu Perhatian — volume atau trend BE menurun</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 dark:text-red-400">0 - 39</p>
              <p className="text-[10px] text-red-700/70 dark:text-red-500/70">Tidak Sehat — volume BE rendah atau turun drastis</p>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 text-center pt-1 space-y-1">
          <p><strong>Rumus:</strong> Kombinasi 3 faktor (3 bulan terakhir)</p>
          <p>40% Volume BE + 40% Trend MoM + 20% Frekuensi Transaksi</p>
        </div>
        <button onClick={onClose} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all">
          Mengerti
        </button>
      </div>
    </div>
  );
};

const HealthBadge = ({ score, onClick }) => {
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 40) colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  if (score >= 70) colorClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colorClass} ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-transform' : ''}`}
    >
      OHS: {score}
    </button>
  );
};

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : ''} ${className}`}>
    {children}
  </div>
);

// Progress bar component for OHS breakdown
const ProgressBar = ({ label, value, color, percentage }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
      <span className="text-[10px] font-bold text-slate-700">{value} <span className="text-slate-400">({percentage}%)</span></span>
    </div>
    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  </div>
);

export function OutletListView({ outlets, onSelectOutlet, dateFilter }) {
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [filterOHS, setFilterOHS] = useState('all'); // all, healthy, warning, unhealthy
  const [sortBy, setSortBy] = useState('ohs-desc'); // ohs-desc, ohs-asc, be-desc, name-asc
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter
  let filtered = (outlets || []).filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.branchArea || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchSearch) return false;
    
    if (filterOHS === 'healthy') return o.health >= 70;
    if (filterOHS === 'warning') return o.health >= 40 && o.health < 70;
    if (filterOHS === 'unhealthy') return o.health < 40;
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'ohs-desc': return b.health - a.health;
      case 'ohs-asc': return a.health - b.health;
      case 'be-desc': return b.beMonth - a.beMonth;
      case 'name-asc': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4 pb-32 animate-in fade-in">
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
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500 font-medium">{filtered.length} outlet ditemukan</p>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors">
          <Info className="w-3.5 h-3.5" /> OHS
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Cari nama outlet atau area..." 
          className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
          value={search} 
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} 
        />
      </div>

      {/* Filter & Sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select 
            value={filterOHS} 
            onChange={(e) => { setFilterOHS(e.target.value); setCurrentPage(1); }}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 pl-3 pr-8 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="healthy">Sehat (≥70)</option>
            <option value="warning">Perlu Perhatian (40-69)</option>
            <option value="unhealthy">Tidak Sehat (&lt;40)</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 pl-3 pr-8 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ohs-desc">OHS Tertinggi</option>
            <option value="ohs-asc">OHS Terendah</option>
            <option value="be-desc">BE Tertinggi</option>
            <option value="name-asc">Nama A-Z</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Outlet List */}
      <div className="space-y-3">
        {paginated.map(outlet => (
          <Card key={outlet.id} onClick={() => onSelectOutlet(outlet)} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 font-bold">
                {outlet.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm text-left font-bold">{outlet.name}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <HealthBadge score={outlet.health} onClick={() => setShowInfo(true)} />
                  {outlet.branchArea && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{outlet.branchArea}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 dark:text-white">{outlet.beMonth.toFixed(1)} BE</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Bulan Ini</p>
            </div>
          </Card>
        ))}
        {paginated.length === 0 && <p className="text-center text-xs text-slate-400 py-8">Tidak ada outlet ditemukan.</p>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
          </button>
          <span className="text-xs font-bold text-slate-500">
            Hal {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
          >
            Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <OHSInfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}

export function OutletDetailView({ outlet, onBack }) {
  const [note, setNote] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_LIMIT = 5;
  
  useEffect(() => {
    const fetchHistory = async () => {
      if (!outlet?.id) return;
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api?type=outlet-history&outlet_id=${outlet.id}&page=${historyPage}&limit=${HISTORY_LIMIT}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load transaction history');
        const data = await res.json();
        setTransactionHistory(data.data || []);
        setHistoryTotal(data.total || 0);
      } catch (e) {
        setHistoryError(e.message);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [outlet?.id, historyPage]);
  
  const trendPositive = (outlet.trend || 0) >= 0;
  const trendValue = Math.abs(outlet.trend || 0).toFixed(1);
  
  // Prepare 3-month history data
  const history3Mo = [
    { label: 'Bulan Ini', be: outlet.beMonth || 0, current: true },
    { label: 'Bulan Lalu', be: (outlet.avgBE || 0) * 3 - (outlet.beMonth || 0) - ((outlet.avgBE || 0) * 3 - (outlet.beMonth || 0) - (outlet.totalBE3Mo || 0)) / 2, be: outlet.totalBE3Mo ? outlet.totalBE3Mo - outlet.beMonth - ((outlet.totalBE3Mo - outlet.beMonth) * (trendPositive ? 1/(1+outlet.trend/100) : 1/(1-outlet.trend/100))) : 0 },
  ];
  
  // Better approach: calculate prev and prev2 from total
  const total3Mo = outlet.totalBE3Mo || 0;
  const current = outlet.beMonth || 0;
  const prevTotal = total3Mo - current;
  let prev, prev2;
  
  if (outlet.trend && outlet.trend !== 0 && prevTotal > 0) {
    // If trend is MoM from prev to current: current = prev * (1 + trend/100)
    // So prev = current / (1 + trend/100)
    const trendFactor = 1 + (outlet.trend / 100);
    prev = current / trendFactor;
    prev2 = prevTotal - prev;
  } else {
    // Fallback: split evenly
    prev = prevTotal / 2;
    prev2 = prevTotal / 2;
  }
  
  const monthlyHistory = [
    { label: 'Bulan Ini', be: current, current: true },
    { label: 'Bulan Lalu', be: Math.max(0, prev) },
    { label: '2 Bulan Lalu', be: Math.max(0, prev2) },
  ];

  const breakdown = outlet.healthBreakdown || { volume: 0, trend: 0, freq: 0 };

  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      {/* Header */}
      <section>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{outlet.name}</h2>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" /> {outlet.address || 'Alamat tidak tersedia'}
            </p>
            {outlet.branchArea && <p className="text-xs text-slate-400 mt-0.5 font-medium">Area: {outlet.branchArea}</p>}
          </div>
          <div className="text-right">
            <HealthBadge score={outlet.health} onClick={() => setShowInfo(true)} />
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Status: Aktif</p>
          </div>
        </div>
      </section>

      <OHSInfoModal open={showInfo} onClose={() => setShowInfo(false)} />

      {/* OHS Score Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Outlet Health Score</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{outlet.health || 0}</p>
          </div>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            outlet.health >= 70 ? 'bg-emerald-100 text-emerald-600' : 
            outlet.health >= 40 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
          }`}>
            <Activity className="w-7 h-7" />
          </div>
        </div>
        
        {/* OHS Breakdown Bars */}
        <div className="space-y-3">
          <ProgressBar 
            label="Volume BE (40%)" 
            value={Math.round(breakdown.volume || 0)} 
            color="bg-emerald-500" 
            percentage={40}
          />
          <ProgressBar 
            label="Trend MoM (40%)" 
            value={Math.round(breakdown.trend || 0)} 
            color="bg-blue-500" 
            percentage={40}
          />
          <ProgressBar 
            label="Frekuensi (20%)" 
            value={Math.round(breakdown.freq || 0)} 
            color="bg-violet-500" 
            percentage={20}
          />
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Total BE 3 Bulan</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{(outlet.totalBE3Mo || 0).toFixed(1)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Rata-rata BE/Bln</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{(outlet.avgBE || 0).toFixed(1)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] text-slate-400 uppercase font-bold">Trend MoM</p>
            {trendPositive ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
          </div>
          <p className={`text-lg font-black mt-1 ${trendPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendPositive ? '+' : ''}{trendValue}%
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Frekuensi (3 Bln)</p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{outlet.freq3Mo || 0} <span className="text-xs font-medium text-slate-400">transaksi</span></p>
        </Card>
      </div>

      {/* Contact & Last Order */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Contact Person</p>
          <p className="text-sm font-bold mt-1">{outlet.contact || "Bpk. Manager"}</p>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Last Order</p>
          <p className="text-sm font-bold mt-1">{outlet.lastOrder || '-'}</p>
        </Card>
      </div>

      {/* 3-Month BE History */}
      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
          <History className="w-4 h-4 text-emerald-600" /> Riwayat BE 3 Bulan
        </h3>
        <Card className="p-0 overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {monthlyHistory.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.current ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.label.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-sm font-bold">{item.be.toFixed(1)} BE</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Transaction History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-emerald-600" /> Riwayat Transaksi (3 Bulan)
          </h3>
          {historyLoading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>
        <Card className="p-0 overflow-hidden">
          {historyLoading && transactionHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs">Memuat riwayat...</p>
            </div>
          )}
          {historyError && (
            <div className="p-4 text-center">
              <p className="text-xs text-red-500 mb-2">{historyError}</p>
              <button onClick={() => setHistoryPage(1)} className="text-xs text-emerald-600 font-bold">Coba Lagi</button>
            </div>
          )}
          {!historyLoading && !historyError && transactionHistory.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-400">Tidak ada riwayat transaksi 3 bulan terakhir</p>
          )}
          {transactionHistory.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-300" />
                <div>
                  <span className="text-sm font-medium">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {item.sku && <p className="text-[10px] text-slate-400 mt-0.5">{item.sku}</p>}
                </div>
              </div>
              <span className="text-sm font-bold">{Number(item.be).toFixed(1)} BE</span>
            </div>
          ))}
        </Card>
        
        {/* Pagination */}
        {historyTotal > HISTORY_LIMIT && (
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1 || historyLoading}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
            </button>
            <span className="text-xs font-bold text-slate-500">
              Hal {historyPage} / {Math.ceil(historyTotal / HISTORY_LIMIT)}
            </span>
            <button
              onClick={() => setHistoryPage(p => Math.min(Math.ceil(historyTotal / HISTORY_LIMIT), p + 1))}
              disabled={historyPage >= Math.ceil(historyTotal / HISTORY_LIMIT) || historyLoading}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
            >
              Selanjutnya <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-slate-400 text-center mt-2">
          {historyTotal} transaksi ditemukan
        </p>
      </section>

      {/* Visit Log */}
      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4 text-emerald-600" /> Log Kunjungan
        </h3>
        <Card>
          <textarea className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="Tulis hasil kunjungan atau kendala outlet..." rows="3" value={note} onChange={(e) => setNote(e.target.value)}></textarea>
          <button className="w-full mt-3 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-transform">Simpan Laporan</button>
        </Card>
      </section>
    </div>
  );
}
