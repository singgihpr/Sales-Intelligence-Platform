import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, RefreshCw, Edit2, Trash2, Plus, Users, Database, Store, X, LogOut, ArrowLeft, Link2, Target, Award, Download, FileSpreadsheet, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

function PaginationControls({ type, meta, onChange }) {
  const { page, limit, total, search } = meta;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const goPage = (p) => { if (p >= 1 && p <= totalPages) onChange(type, { page: p }); };
  const setLimit = (l) => onChange(type, { page: 1, limit: parseInt(l) });
  const setSearch = (s) => onChange(type, { page: 1, search: s });

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onChange(type, { page: 1, search }); }}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 whitespace-nowrap">{start}-{end} dari {total}</span>
        <select value={limit} onChange={e => setLimit(e.target.value)} className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-xs font-bold px-2">{page} / {totalPages}</span>
          <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [vacantOutlets, setVacantOutlets] = useState([]);
  const [targets, setTargets] = useState([]);
  const [allSalesUsers, setAllSalesUsers] = useState([]);

  const [pagination, setPagination] = useState({
    records: { page: 1, limit: 10, total: 0, search: '' },
    users: { page: 1, limit: 10, total: 0, search: '' },
    outlets: { page: 1, limit: 10, total: 0, search: '' },
    assignments: { page: 1, limit: 10, total: 0, search: '' },
    vacant: { page: 1, limit: 10, total: 0, search: '' },
    targets: { page: 1, limit: 10, total: 0, search: '' },
  });

  // Form States
  const [editingRecord, setEditingRecord] = useState(null);
  const [recForm, setRecForm] = useState({ outlet: '', sales: '', date: '', be: '', sku: '' });
  const [showRecForm, setShowRecForm] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'sales', region: '', level: 'L2', password: '' });
  const [showUserForm, setShowUserForm] = useState(false);

  const [editingOutlet, setEditingOutlet] = useState(null);
  const [outletForm, setOutletForm] = useState({ name: '', type: '', address: '', contact_person: '', branch_area: '' });
  const [showOutletForm, setShowOutletForm] = useState(false);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ outlet_id: '', salesman_id: '', notes: '' });

  // Inline & Bulk Assignment States
  const [selectedVacantIds, setSelectedVacantIds] = useState([]);
  const [bulkSalesmanId, setBulkSalesmanId] = useState('');
  const [inlineAssignments, setInlineAssignments] = useState({});
  const [assigningOutlets, setAssigningOutlets] = useState(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetForm, setTargetForm] = useState({ user_id: '', month: new Date().getMonth()+1, year: new Date().getFullYear(), target_be: 2000 });
  const [editingTarget, setEditingTarget] = useState(null);

  const [showVacant, setShowVacant] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  const token = localStorage.getItem('token');

  const fetchTable = async (type, overrides = {}) => {
    const p = pagination[type];
    const page = overrides.page !== undefined ? overrides.page : p.page;
    const limit = overrides.limit !== undefined ? overrides.limit : p.limit;
    const search = overrides.search !== undefined ? overrides.search : p.search;
    const isVacant = type === 'vacant';
    const urlType = isVacant ? 'assignments' : type;
    const url = `/api?type=${urlType}${isVacant ? '&mode=vacant' : ''}&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      const list = result.data || [];
      const total = result.total || 0;
      if (type === 'records') setRecords(list);
      if (type === 'users') setUsers(list);
      if (type === 'outlets') setOutlets(list);
      if (type === 'assignments') setAssignments(list);
      if (type === 'vacant') setVacantOutlets(list);
      if (type === 'targets') setTargets(list);
      setPagination(prev => ({ ...prev, [type]: { ...prev[type], page, limit, total, search } }));
    } catch (e) { setMessage(`❌ Fetch ${type} error: ${e.message}`); }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all(['records', 'users', 'outlets', 'assignments', 'targets'].map(t => fetchTable(t)));
    setLoading(false);
  };

  const fetchAllSalesUsers = async () => {
    try {
      const res = await fetch(`/api?type=users&limit=9999&search=`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setAllSalesUsers((result.data || []).filter(u => u.role === 'sales'));
    } catch (e) { /* silently ignore to avoid disrupting UI */ }
  };

  useEffect(() => { fetchAll(); fetchAllSalesUsers(); }, []);
  useEffect(() => { if (showVacant) fetchTable('vacant'); }, [showVacant]);

  // Handle navigation state from "Kelola" button
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
    if (location.state?.showVacant) {
      setShowVacant(true);
    }
    // Clean up location state after reading
    if (location.state?.activeTab || location.state?.showVacant) {
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  const handleCrud = async (type, method, id, form, setList, resetState) => {
    try {
      const url = id ? `/api?type=${type}&id=${id}` : `/api?type=${type}`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      await fetchTable(type);
      resetState();
      setMessage(`✅ ${type.charAt(0).toUpperCase()+type.slice(1)} ${method==='POST'?'created':method==='PUT'?'updated':'deleted'}.`);
    } catch (e) { setMessage(`❌ ${e.message}`); }
  };

  // Inline assignment for single vacant outlet
  const handleInlineAssign = async (outletId, salesmanId) => {
    if (!salesmanId) {
      setMessage('❌ Please select a salesman first');
      return;
    }
    setAssigningOutlets(prev => new Set(prev).add(outletId));
    setMessage('');
    try {
      const url = `/api?type=assignments`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ outlet_id: outletId, salesman_id: salesmanId, notes: '' })
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchTable('vacant');
      await fetchTable('assignments');
      setMessage('✅ Outlet assigned successfully');
      // Remove from selected if it was selected
      setSelectedVacantIds(prev => prev.filter(id => id !== outletId));
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    } finally {
      setAssigningOutlets(prev => {
        const next = new Set(prev);
        next.delete(outletId);
        return next;
      });
    }
  };

  // Bulk assignment for multiple vacant outlets
  const handleBulkAssign = async () => {
    if (!bulkSalesmanId) {
      setMessage('❌ Please select a salesman for bulk assignment');
      return;
    }
    if (selectedVacantIds.length === 0) {
      setMessage('❌ No outlets selected');
      return;
    }
    setBulkAssigning(true);
    setBulkProgress({ current: 0, total: selectedVacantIds.length });
    setMessage('');
    let success = 0;
    let failed = 0;
    for (let i = 0; i < selectedVacantIds.length; i++) {
      const outletId = selectedVacantIds[i];
      setBulkProgress({ current: i + 1, total: selectedVacantIds.length });
      try {
        const url = `/api?type=assignments`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ outlet_id: outletId, salesman_id: bulkSalesmanId, notes: '' })
        });
        if (!res.ok) throw new Error(await res.text());
        success++;
      } catch (e) {
        failed++;
        console.error(`Failed to assign outlet ${outletId}:`, e);
      }
    }
    await fetchTable('vacant');
    await fetchTable('assignments');
    setSelectedVacantIds([]);
    setBulkSalesmanId('');
    setBulkAssigning(false);
    setBulkProgress({ current: 0, total: 0 });
    if (failed === 0) {
      setMessage(`✅ ${success} outlets assigned successfully`);
    } else {
      setMessage(`⚠️ ${success} assigned, ${failed} failed`);
    }
  };

  const toggleSelectVacant = (outletId) => {
    setSelectedVacantIds(prev =>
      prev.includes(outletId)
        ? prev.filter(id => id !== outletId)
        : [...prev, outletId]
    );
  };

  const toggleAllVacant = () => {
    const currentPageIds = vacantOutlets.map(o => o.id);
    const allSelected = currentPageIds.every(id => selectedVacantIds.includes(id));
    if (allSelected) {
      setSelectedVacantIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedVacantIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
    setPreviewData(null);
  };

  const handlePreview = async () => {
    if (!uploadFile) { setMessage('❌ Please select a file first'); return; }
    setPreviewLoading(true);
    setMessage('');
    const fd = new FormData(); fd.append('file', uploadFile);
    try {
      const res = await fetch('/api?action=preview', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setPreviewData(d);
      setMessage(`✅ Preview: ${d.valid} valid, ${d.invalid} invalid out of ${d.total} rows`);
    } catch (e) { setMessage(`❌ Preview failed: ${e.message}`); }
    finally { setPreviewLoading(false); }
  };

  const handleUpload = async () => {
    if (!uploadFile) { setMessage('❌ Please select a file first'); return; }
    if (uploadLoading) return;
    setUploadLoading(true);
    setMessage('');
    const fd = new FormData(); fd.append('file', uploadFile);
    try {
      const res = await fetch('/api', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json(); setMessage(`✅ Uploaded ${d.inserted} records.`); await fetchTable('records'); setPreviewData(null); setUploadFile(null);
    } catch(e) { setMessage('❌ Upload failed'); }
    finally { setUploadLoading(false); }
  };

  const downloadCsvTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/upload-template.csv';
    link.download = 'upload-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadXlsxTemplate = () => {
    const data = [
      ['Outlet Name', 'Sales Name', 'Date', 'Volume BE', 'SKU'],
      ['Toko Buah Sejahtera', 'Budi Santoso', '2026-05-03', 45.5, 'Pisang Cavendish'],
      ['Toko Buah Sejahtera', 'Budi Santoso', '2026-05-10', 52.0, 'Nanas Madu'],
      ['Fresh Market Cilandak', 'Budi Santoso', '2026-05-05', 85.0, 'Jeruk Siam'],
      ['Fresh Market Cilandak', 'Budi Santoso', '2026-05-12', 35.5, 'Apel Fuji'],
      ['RM Padang Sederhana', 'Budi Santoso', '2026-05-08', 28.0, 'Semangka Merah'],
      ['Resto Ayam Penyet', 'Dewi Lestari', '2026-05-02', 40.0, 'Mangga Harum Manis'],
      ['Resto Ayam Penyet', 'Dewi Lestari', '2026-05-07', 55.0, 'Pisang Cavendish'],
      ['Indomaret Point', 'Dewi Lestari', '2026-05-04', 62.5, 'Nanas Madu'],
      ['Indomaret Point', 'Dewi Lestari', '2026-05-11', 48.0, 'Jeruk Siam'],
      ['Warung Kopi Nusantara', 'Dewi Lestari', '2026-05-09', 33.5, 'Apel Fuji']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'upload-template.xlsx');
  };

  const openRecordEdit = (r = null) => { setEditingRecord(r); setRecForm(r || { outlet: '', sales: '', date: '', be: '', sku: '' }); setShowRecForm(true); };
  const openUserEdit = (u = null) => { setEditingUser(u); setUserForm(u || { name: '', email: '', role: 'sales', region: '', level: 'L2', password: '' }); setShowUserForm(true); };
  const openOutletEdit = (o = null) => { setEditingOutlet(o); setOutletForm(o || { name: '', type: '', address: '', contact_person: '', branch_area: '' }); setShowOutletForm(true); };
  const openTargetEdit = (t = null) => {
    setEditingTarget(t);
    setTargetForm(t ? { user_id: t.user_id, month: t.month, year: t.year, target_be: t.target_be } : { user_id: '', month: new Date().getMonth()+1, year: new Date().getFullYear(), target_be: 2000 });
    setShowTargetForm(true);
  };

  const tabs = [
    { id: 'records', label: 'Data Records', icon: Database },
    { id: 'outlets', label: 'Outlet Management', icon: Store },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: Link2 },
    { id: 'targets', label: 'Bonus Targets', icon: Target }
  ];

  const formatRp = (n) => 'Rp ' + (Number(n)||0).toLocaleString('id-ID');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 lg:px-10 py-4 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={()=>navigate('/')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Back to Sales Dashboard"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400"/></button>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto min-w-0">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg overflow-x-auto flex-1 min-w-0 max-w-full">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center justify-center gap-1.5 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${activeTab === t.id ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              ))}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-2 md:px-3 py-2 bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/80 transition-colors shrink-0 text-xs md:text-sm">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {message && <div className="max-w-[1400px] mx-auto px-6 lg:px-10 mt-4"><div className={`p-3 rounded-lg text-sm font-medium ${message.includes('✅') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'}`}>{message} <button onClick={() => setMessage('')} className="ml-2 underline">Dismiss</button></div></div>}

      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6">
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} disabled={uploadLoading || previewLoading} className="block w-full sm:w-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed" />
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handlePreview} disabled={!uploadFile || previewLoading} className="px-4 py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    {previewLoading ? 'Previewing...' : 'Preview'}
                  </button>
                  <button onClick={handleUpload} disabled={!uploadFile || uploadLoading || (previewData && previewData.invalid > 0)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {uploadLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Importing...
                      </>
                    ) : 'Import'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
                <div className="text-xs text-slate-500 space-y-1">
                  <p><strong>Format yang didukung:</strong> File <code>rincian_faktur_penjualan</code> Ayotama (.xlsx / .xls)</p>
                  <p>Kolom yang diproses: <code>Cabang</code>, <code>Pelanggan</code>, <code>Barang</code>, <code>Qty harian</code> (per kolom tanggal)</p>
                  <p>Satuan: <code>BOX</code> (extract KG dari nama → konversi BE), <code>KG</code> (langsung /12), <code>PAX/PCS/KRJ</code> (1 BE per qty)</p>
                </div>
              </div>
            </div>

            {previewData && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">Preview</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">{previewData.valid} Valid</span>
                    <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-full">{previewData.invalid} Invalid</span>
                    <button onClick={() => setPreviewData(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Outlet</th>
                        <th className="px-3 py-2">Sales</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Vol BE</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewData.rows.map((r, idx) => (
                        <tr key={idx} className={r.isNewOutlet ? 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}>
                          <td className="px-3 py-2 font-mono text-xs text-slate-400">{r.row}</td>
                          <td className="px-3 py-2">
                            {r.outletName || '-'}
                            {r.isNewOutlet && (
                              <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1 py-0.5 rounded-full">NEW</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{r.salesName || '-'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.date || '-'}</td>
                          <td className="px-3 py-2">{r.volume !== null ? r.volume : '-'}</td>
                          <td className="px-3 py-2 text-slate-500">{r.sku || '-'}</td>
                          <td className="px-3 py-2">
                            {r.warnings && r.warnings.length > 0 ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full" title={r.warnings.join('; ')}>
                                {r.warnings.length} WARNING{r.warnings.length > 1 ? 'S' : ''}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">VALID</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showRecForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('records', editingRecord ? 'PUT' : 'POST', editingRecord?.id, recForm, setRecords, () => setShowRecForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Outlet</label><select required value={recForm.outlet} onChange={e=>setRecForm({...recForm, outlet:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800"><option value="" disabled>Select Outlet</option>{outlets.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}</select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Sales</label><select required value={recForm.sales} onChange={e=>setRecForm({...recForm, sales:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800"><option value="" disabled>Select Sales</option>{users.map(u => <option key={u.id} value={u.name}>{u.name} ({u.role})</option>)}</select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Date</label><input type="date" required value={recForm.date} onChange={e=>setRecForm({...recForm, date:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Vol BE</label><input type="number" step="0.1" required value={recForm.be} onChange={e=>setRecForm({...recForm, be:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">SKU</label><input value={recForm.sku} onChange={e=>setRecForm({...recForm, sku:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Optional" /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Save</button><button type="button" onClick={()=>setShowRecForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Manage Records</h2>
                <button onClick={() => fetchTable('records')} disabled={loading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button>
              </div>
              <PaginationControls type="records" meta={pagination.records} onChange={(t, o) => fetchTable(t, o)} />
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Sales</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Vol BE</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  records.length === 0 ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">No records. Upload or add manually.</td></tr> :
                  records.map(r => (<tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{r.outlet}</td><td className="px-4 py-3">{r.sales}</td><td className="px-4 py-3 font-mono text-xs">{r.date}</td><td className="px-4 py-3 text-slate-500">{r.sku||'-'}</td><td className="px-4 py-3 font-bold text-emerald-600">{parseFloat(r.be).toFixed(1)}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openRecordEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('records','DELETE',r.id,{},setRecords,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {activeTab === 'outlets' && (
          <div className="space-y-6">
            {showOutletForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('outlets', editingOutlet ? 'PUT' : 'POST', editingOutlet?.id, outletForm, setOutlets, () => setShowOutletForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Name</label><input required value={outletForm.name} onChange={e=>setOutletForm({...outletForm, name:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Outlet Name" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Type</label><input value={outletForm.type} onChange={e=>setOutletForm({...outletForm, type:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Warung, Hotel..." /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Branch Area</label><input value={outletForm.branch_area} onChange={e=>setOutletForm({...outletForm, branch_area:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Jakarta Selatan" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Address</label><input value={outletForm.address} onChange={e=>setOutletForm({...outletForm, address:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Address" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Contact</label><input value={outletForm.contact_person} onChange={e=>setOutletForm({...outletForm, contact_person:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Person/Phone" /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Save</button><button type="button" onClick={()=>setShowOutletForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Outlet Database</h2>
                <button onClick={()=>openOutletEdit()} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-4 h-4"/> Add Outlet</button>
              </div>
              <PaginationControls type="outlets" meta={pagination.outlets} onChange={(t, o) => fetchTable(t, o)} />
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Branch Area</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  outlets.length === 0 ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">No outlets found.</td></tr> :
                  outlets.map(o => (<tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{o.name}</td><td className="px-4 py-3">{o.type||'-'}</td><td className="px-4 py-3">{o.branch_area||'-'}</td><td className="px-4 py-3 text-slate-500">{o.address||'-'}</td><td className="px-4 py-3 text-slate-500">{o.contact_person||'-'}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openOutletEdit(o)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('outlets','DELETE',o.id,{},setOutlets,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {showUserForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('users', editingUser ? 'PUT' : 'POST', editingUser?.id, userForm, setUsers, () => setShowUserForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Name</label><input required value={userForm.name} onChange={e=>setUserForm({...userForm, name:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Full Name" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Email</label><input required type="email" value={userForm.email} onChange={e=>setUserForm({...userForm, email:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="email@domain.com" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Role</label><select value={userForm.role} onChange={e=>setUserForm({...userForm, role:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent"><option value="sales">Sales</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Level</label><select value={userForm.level||''} onChange={e=>setUserForm({...userForm, level:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent"><option value="">-</option><option value="L2">L2</option><option value="L3">L3</option></select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Region</label><input value={userForm.region} onChange={e=>setUserForm({...userForm, region:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Region" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Password</label><input type="password" value={userForm.password} onChange={e=>setUserForm({...userForm, password:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder={editingUser ? "Leave blank to keep current" : "Set initial password"} /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Save</button><button type="button" onClick={()=>setShowUserForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Team Members</h2>
                <button onClick={()=>openUserEdit()} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-4 h-4"/> Add User</button>
              </div>
              <PaginationControls type="users" meta={pagination.users} onChange={(t, o) => fetchTable(t, o)} />
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Region</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  users.length === 0 ? <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">No users found.</td></tr> :
                  users.map(u => (<tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email || '-'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role==='admin'?'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400':u.role==='supervisor'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}`}>{u.role}</span></td>
                    <td className="px-4 py-3 text-slate-500">{u.level||'-'}</td>
                    <td className="px-4 py-3 text-slate-500">{u.region||'-'}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openUserEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('users','DELETE',u.id,{},setUsers,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="space-y-6">
            {showAssignForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('assignments', 'POST', null, assignForm, setAssignments, () => { setShowAssignForm(false); setAssignForm({ outlet_id: '', salesman_id: '', notes: '' }); }); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Outlet</label>
                  <select required value={assignForm.outlet_id} onChange={e=>setAssignForm({...assignForm, outlet_id:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800">
                    <option value="" disabled>Select Outlet</option>
                    {(() => {
                      // Merge outlets + vacantOutlets for dropdown, deduplicate, sort by name
                      const mergedMap = new Map();
                      outlets.forEach(o => mergedMap.set(o.id, o));
                      vacantOutlets.forEach(o => mergedMap.set(o.id, o));
                      const merged = Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
                      return merged.map(o => <option key={o.id} value={o.id}>{o.name} {o.branch_area ? `(${o.branch_area})` : ''}</option>);
                    })()}
                  </select>
                </div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Salesman</label><select value={assignForm.salesman_id} onChange={e=>setAssignForm({...assignForm, salesman_id:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800"><option value="">Vacant</option>{allSalesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Notes</label><input value={assignForm.notes} onChange={e=>setAssignForm({...assignForm, notes:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" placeholder="Optional notes" /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Assign</button><button type="button" onClick={()=>setShowAssignForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Outlet Assignments</h2>
                <div className="flex gap-2">
                  <button onClick={()=>setShowVacant(!showVacant)} className={`px-3 py-2 rounded-lg text-sm font-medium ${showVacant?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{showVacant?'Hide Vacant':'Show Vacant'}</button>
                </div>
              </div>
              {showVacant && (
                <div className="mb-6 space-y-3">
                  <h3 className="text-sm font-bold text-amber-700 mb-2">Vacant Outlets (No Salesman Assigned)</h3>
                  <PaginationControls type="vacant" meta={pagination.vacant} onChange={(t, o) => fetchTable(t, o)} />

                  {/* Bulk Assign Bar */}
                  {selectedVacantIds.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                        {selectedVacantIds.length} outlet selected
                      </span>
                      <div className="flex-1 w-full sm:w-auto">
                        <select
                          value={bulkSalesmanId}
                          onChange={e => setBulkSalesmanId(e.target.value)}
                          className="w-full sm:w-auto px-3 py-2 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        >
                          <option value="">Select Salesman...</option>
                          {allSalesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={handleBulkAssign}
                        disabled={bulkAssigning}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {bulkAssigning ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Assigning {bulkProgress.current}/{bulkProgress.total}...
                          </>
                        ) : (
                          <>Assign {selectedVacantIds.length} Outlet{selectedVacantIds.length > 1 ? 's' : ''}</>
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedVacantIds([])}
                        className="px-3 py-2 text-slate-500 text-sm hover:text-slate-700"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[800px]">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr>
                      <th className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={vacantOutlets.length > 0 && vacantOutlets.every(o => selectedVacantIds.includes(o.id))}
                          onChange={toggleAllVacant}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Branch Area</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Salesman</th>
                      <th className="px-4 py-3 text-right">Quick Assign</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {vacantOutlets.length === 0 ? <tr><td colSpan="6" className="px-4 py-4 text-center text-slate-400">No vacant outlets.</td></tr> :
                      vacantOutlets.map(o => {
                        const isAssigning = assigningOutlets.has(o.id);
                        const isSelected = selectedVacantIds.includes(o.id);
                        return (
                          <tr key={o.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectVacant(o.id)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">{o.name}</td>
                            <td className="px-4 py-3">{o.branch_area||'-'}</td>
                            <td className="px-4 py-3">{o.type||'-'}</td>
                            <td className="px-4 py-3">
                              <select
                                value={inlineAssignments[o.id] || ''}
                                onChange={e => {
                                  setInlineAssignments(prev => ({ ...prev, [o.id]: e.target.value }));
                                }}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent text-xs"
                              >
                                <option value="">Select...</option>
                                {allSalesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleInlineAssign(o.id, inlineAssignments[o.id])}
                                disabled={isAssigning}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ml-auto"
                              >
                                {isAssigning ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Assigning...
                                  </>
                                ) : (
                                  'Assign'
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                </div>
              )}
              <PaginationControls type="assignments" meta={pagination.assignments} onChange={(t, o) => fetchTable(t, o)} />
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Branch Area</th><th className="px-4 py-3">Salesman</th><th className="px-4 py-3">Assigned At</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  assignments.length === 0 ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No active assignments.</td></tr> :
                  assignments.map(a => (<tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{a.outlet_name}</td><td className="px-4 py-3">{a.branch_area||'-'}</td><td className="px-4 py-3">{a.salesman_name || <span className="text-amber-600 font-bold">Vacant</span>}</td><td className="px-4 py-3 text-slate-500">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('id-ID') : '-'}</td>
                     <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>handleCrud('assignments','PUT',a.id,{},setAssignments,()=>{})} className="flex items-center gap-1.5 px-3 py-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg text-xs font-bold" title="Unassign"><Link2 className="w-4 h-4"/>Unassign</button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {activeTab === 'targets' && (
          <div className="space-y-6">
            {showTargetForm && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const body = { ...targetForm, level: allSalesUsers.find(u => u.id === targetForm.user_id)?.level || 'L2' };
                handleCrud('targets', editingTarget ? 'PUT' : 'POST', editingTarget?.id, body, setTargets, () => { setShowTargetForm(false); setTargetForm({ user_id: '', month: new Date().getMonth()+1, year: new Date().getFullYear(), target_be: 2000 }); setEditingTarget(null); });
              }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Salesman</label><select required value={targetForm.user_id} onChange={e=>setTargetForm({...targetForm, user_id:e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent dark:bg-slate-800"><option value="" disabled>Select Salesman</option>{allSalesUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.level||'-'})</option>)}</select></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Month</label><input type="number" min="1" max="12" required value={targetForm.month} onChange={e=>setTargetForm({...targetForm, month:Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Year</label><input type="number" min="2024" max="2100" required value={targetForm.year} onChange={e=>setTargetForm({...targetForm, year:Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Target BE</label><input type="number" step="0.1" required value={targetForm.target_be} onChange={e=>setTargetForm({...targetForm, target_be:Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Save</button><button type="button" onClick={()=>setShowTargetForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Bonus Targets & Configurations</h2>
                <button onClick={()=>openTargetEdit()} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-4 h-4"/> Add Target</button>
              </div>
              <PaginationControls type="targets" meta={pagination.targets} onChange={(t, o) => fetchTable(t, o)} />
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[700px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Salesman</th><th className="px-4 py-3">Month</th><th className="px-4 py-3">Year</th><th className="px-4 py-3">Target BE</th><th className="px-4 py-3">Percentage</th><th className="px-4 py-3">Volume</th><th className="px-4 py-3">Active Outlets</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  targets.length === 0 ? <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">No targets configured.</td></tr> :
                  targets.map(t => {
                    const salesman = users.find(u => u.id === t.user_id);
                    const pc = t.percentage_config || {};
                    const vc = (t.volume_config || {}).tiers || [];
                    const ac = t.active_outlets_config || {};
                    return (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium">{salesman?.name || t.user_id}</td>
                      <td className="px-4 py-3">{t.month}</td>
                      <td className="px-4 py-3">{t.year}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{t.target_be}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{pc.base_reward ? formatRp(pc.base_reward) : '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{vc.length ? vc.map(v=>`${v.threshold}BE`).join(', ') : '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{ac.base_reward ? formatRp(ac.base_reward) : '-'}</td>
                      <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openTargetEdit(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('targets','DELETE',t.id,{},setTargets,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                    </tr>);
                  })}
                </tbody>
              </table></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
