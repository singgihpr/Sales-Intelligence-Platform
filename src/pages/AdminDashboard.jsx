import { useState, useEffect } from 'react';
import { Upload, RefreshCw, Edit2, Trash2, Plus, Users, Database, Store, X } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('records');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);

  // Form States
  const [editingRecord, setEditingRecord] = useState(null);
  const [recForm, setRecForm] = useState({ outlet: '', sales: '', date: '', be: '', sku: '' });
  const [showRecForm, setShowRecForm] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', role: 'sales', region: '' });
  const [showUserForm, setShowUserForm] = useState(false);

  const [editingOutlet, setEditingOutlet] = useState(null);
  const [outletForm, setOutletForm] = useState({ name: '', type: '', address: '', contact_person: '' });
  const [showOutletForm, setShowOutletForm] = useState(false);

  // Fetchers
  const fetchData = async () => {
    setLoading(true);
    const endpoints = ['/api?type=records', '/api?type=users', '/api?type=outlets'];
    try {
      const results = await Promise.all(endpoints.map(url => fetch(`/.netlify/functions${url}`).then(r => r.json())));
      setRecords(results[0] || []);
      setUsers(results[1] || []);
      setOutlets(results[2] || []);
    } catch (e) { setMessage('❌ Fetch error'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  // Generic CRUD Handler
  const handleCrud = async (type, method, id, form, setList, resetState) => {
    try {
      const url = id ? `/.netlify/functions/api?type=${type}&id=${id}` : `/.netlify/functions/api?type=${type}`;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      fetchData();
      resetState();
      setMessage(`✅ ${type.charAt(0).toUpperCase()+type.slice(1)} ${method==='POST'?'created':method==='PUT'?'updated':'deleted'}.`);
    } catch (e) { setMessage(`❌ ${e.message}`); }
  };

  // Upload Handler
  const handleUpload = async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/.netlify/functions/api', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(res.status);
      const d = await res.json(); setMessage(`✅ Uploaded ${d.inserted} records.`); fetchData();
    } catch(e) { setMessage('❌ Upload failed'); }
  };

  // Form Handlers
  const openRecordEdit = (r = null) => { setEditingRecord(r); setRecForm(r || { outlet: '', sales: '', date: '', be: '', sku: '' }); setShowRecForm(true); };
  const openUserEdit = (u = null) => { setEditingUser(u); setUserForm(u || { name: '', role: 'sales', region: '' }); setShowUserForm(true); };
  const openOutletEdit = (o = null) => { setEditingOutlet(o); setOutletForm(o || { name: '', type: '', address: '', contact_person: '' }); setShowOutletForm(true); };

  const tabs = [
    { id: 'records', label: 'Data Records', icon: Database },
    { id: 'outlets', label: 'Outlet Management', icon: Store },
    { id: 'users', label: 'User Management', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 lg:px-8 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {message && <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-4"><div className={`p-3 rounded-lg text-sm font-medium ${message.includes('✅') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'}`}>{message} <button onClick={() => setMessage('')} className="ml-2 underline">Dismiss</button></div></div>}

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
        {/* RECORDS TAB */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="block w-full sm:w-auto text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                <p className="text-xs text-slate-500">Columns: <code>Outlet Name, Sales Name, Date, Volume BE, SKU</code></p>
              </form>
            </div>

            {showRecForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('records', editingRecord ? 'PUT' : 'POST', editingRecord?.id, recForm, setRecords, () => setShowRecForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Outlet</label><input required value={recForm.outlet} onChange={e=>setRecForm({...recForm, outlet:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Outlet Name" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Sales</label><input required value={recForm.sales} onChange={e=>setRecForm({...recForm, sales:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Sales Name" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Date</label><input type="date" required value={recForm.date} onChange={e=>setRecForm({...recForm, date:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">Vol BE</label><input type="number" required value={recForm.be} onChange={e=>setRecForm({...recForm, be:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" /></div>
                <div className="md:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">SKU</label><input value={recForm.sku} onChange={e=>setRecForm({...recForm, sku:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Optional" /></div>
                <div className="md:col-span-1 flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Save</button><button type="button" onClick={()=>setShowRecForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Manage Records</h2><button onClick={fetchData} disabled={loading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button></div>
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

        {/* OUTLETS TAB */}
        {activeTab === 'outlets' && (
          <div className="space-y-6">
            {showOutletForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('outlets', editingOutlet ? 'PUT' : 'POST', editingOutlet?.id, outletForm, setOutlets, () => setShowOutletForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Name</label><input required value={outletForm.name} onChange={e=>setOutletForm({...outletForm, name:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Outlet Name" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Type</label><input value={outletForm.type} onChange={e=>setOutletForm({...outletForm, type:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Warung, Hotel..." /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Address</label><input value={outletForm.address} onChange={e=>setOutletForm({...outletForm, address:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Address" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Contact</label><input value={outletForm.contact_person} onChange={e=>setOutletForm({...outletForm, contact_person:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Person/Phone" /></div>
                <div className="flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Save</button><button type="button" onClick={()=>setShowOutletForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Outlet Database</h2>
                <button onClick={()=>openOutletEdit()} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-4 h-4"/> Add Outlet</button>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[600px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  outlets.length === 0 ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No outlets found.</td></tr> :
                  outlets.map(o => (<tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{o.name}</td><td className="px-4 py-3">{o.type||'-'}</td><td className="px-4 py-3 text-slate-500">{o.address||'-'}</td><td className="px-4 py-3 text-slate-500">{o.contact_person||'-'}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openOutletEdit(o)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('outlets','DELETE',o.id,{},setOutlets,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {showUserForm && (
              <form onSubmit={(e) => { e.preventDefault(); handleCrud('users', editingUser ? 'PUT' : 'POST', editingUser?.id, userForm, setUsers, () => setShowUserForm(false)); }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label><input required value={userForm.name} onChange={e=>setUserForm({...userForm, name:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Name" /></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Role</label><select value={userForm.role} onChange={e=>setUserForm({...userForm, role:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent"><option value="sales">Sales</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-xs font-medium text-slate-500 mb-1">Region</label><input value={userForm.region} onChange={e=>setUserForm({...userForm, region:e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-transparent" placeholder="Region" /></div>
                <div className="flex gap-2"><button type="submit" className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">Save</button><button type="button" onClick={()=>setShowUserForm(false)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"><X className="w-4 h-4 mx-auto"/></button></div>
              </form>
            )}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-bold">Team Members</h2>
                <button onClick={()=>openUserEdit()} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"><Plus className="w-4 h-4"/> Add User</button>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm text-left min-w-[500px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Region</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400 animate-pulse">Loading...</td></tr> :
                  users.length === 0 ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No users found.</td></tr> :
                  users.map(u => (<tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{u.name}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role==='admin'?'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400':u.role==='supervisor'?'bg-blue-100 text-blue-700':'bg-emerald-100 text-emerald-700'}`}>{u.role}</span></td><td className="px-4 py-3 text-slate-500">{u.region||'-'}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end"><button onClick={()=>openUserEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 className="w-4 h-4"/></button><button onClick={()=>handleCrud('users','DELETE',u.id,{},setUsers,()=>{})} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4"/></button></td>
                  </tr>))}
                </tbody>
              </table></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}