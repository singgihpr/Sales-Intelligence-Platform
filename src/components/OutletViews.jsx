import React, { useState } from 'react';
import { Search, ArrowLeft, Calendar, MessageSquare, History, MapPin, ChevronRight, Info, X } from 'lucide-react';

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
          OHS menunjukkan seberapa &quot;sehat&quot; outlet berdasarkan waktu transaksi terakhir. Semakin tinggi skor, semakin aktif outlet tersebut.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">80 - 100</p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-500/70">Sangat Aktif — transaksi dalam 7 hari terakhir</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">50 - 79</p>
              <p className="text-[10px] text-amber-700/70 dark:text-amber-500/70">Perlu Perhatian — transaksi 7-25 hari lalu</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 dark:text-red-400">0 - 49</p>
              <p className="text-[10px] text-red-700/70 dark:text-red-500/70">Berisiko Churn — transaksi &gt;25 hari lalu</p>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center pt-1">
          Rumus: <code>100 - (hari sejak transaksi terakhir &times; 2)</code>
        </p>
        <button onClick={onClose} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all">
          Mengerti
        </button>
      </div>
    </div>
  );
};

const HealthBadge = ({ score, onClick }) => {
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 50) colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  if (score >= 80) colorClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
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

export function OutletListView({ outlets, onSelectOutlet }) {
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const filtered = (outlets || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.branchArea || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-32 animate-in fade-in">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-500 font-medium">{filtered.length} outlet ditemukan</p>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors">
          <Info className="w-3.5 h-3.5" /> OHS
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Cari nama outlet atau area..." className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.map(outlet => (
          <Card key={outlet.id} onClick={() => onSelectOutlet(outlet)} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 font-bold">
                {outlet.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-sm font-bold">{outlet.name}</h4>
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
        {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-8">Tidak ada outlet ditemukan.</p>}
      </div>

      <OHSInfoModal open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}

export function OutletDetailView({ outlet, onBack }) {
  const [note, setNote] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="space-y-6 pb-24 animate-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

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

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Contact Person</p>
          <p className="text-sm font-bold mt-1">{outlet.contact || "Bpk. Manager"}</p>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-800/50 border-none p-4">
          <p className="text-[10px] text-slate-400 uppercase font-bold">Last Order</p>
          <p className="text-sm font-bold mt-1">{outlet.lastOrder || '-'}</p>
        </Card>
      </div>

      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" /> Riwayat Transaksi
        </h3>
        <Card className="p-0 overflow-hidden">
          {(outlet.history || []).length === 0 && <p className="p-4 text-center text-xs text-slate-400">Tidak ada riwayat transaksi 30 hari terakhir</p>}
          {(outlet.history || []).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b last:border-none border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-medium">{new Date(item.date).toLocaleDateString('id-ID')}</span>
              </div>
              <span className="text-sm font-bold">{item.be} BE</span>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h3 className="font-bold mb-3 flex items-center gap-2">
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
