import React, { useState } from 'react';
import { Search, ArrowLeft, Calendar, MessageSquare, History, MapPin, ChevronRight } from 'lucide-react';

const HealthBadge = ({ score }) => {
  let colorClass = "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (score >= 50) colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  if (score >= 80) colorClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colorClass}`}>
      OHS: {score}
    </span>
  );
};

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 ${onClick ? 'active:scale-[0.98] cursor-pointer transition-transform' : ''} ${className}`}>
    {children}
  </div>
);

export function OutletListView({ outlets, onSelectOutlet }) {
  const [search, setSearch] = useState("");
  const filtered = (outlets || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.branchArea || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-32 animate-in fade-in">
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
                  <HealthBadge score={outlet.health} />
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
    </div>
  );
}

export function OutletDetailView({ outlet, onBack }) {
  const [note, setNote] = useState("");
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
            <HealthBadge score={outlet.health} />
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Status: Aktif</p>
          </div>
        </div>
      </section>

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
