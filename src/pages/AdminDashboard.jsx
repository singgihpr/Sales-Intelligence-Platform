import { useState } from 'react';
import { Upload, Edit2, Trash2, Save } from 'lucide-react';

export default function AdminDashboard() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [records, setRecords] = useState([]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/.netlify/functions/api', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      
      const data = await res.json();
      setMessage(`✅ Successfully uploaded ${data.inserted} records.`);
    } catch (err) {
      setMessage(`❌ Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Admin Dashboard</h1>
      
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Upload className="w-5 h-5" /> Upload XLS Data</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
          <p className="text-xs text-slate-500">Expected columns: <code>Outlet Name, Sales Name, Date, Volume BE, SKU</code></p>
          {message && <p className={`text-sm font-medium ${message.includes('✅') ? 'text-emerald-600' : 'text-red-500'}`}>{message}</p>}
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5" /> Manage Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Outlet</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Volume BE</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">No records uploaded yet. Use the form above.</td></tr>
              ) : (
                records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium">{r.outlet}</td>
                    <td className="px-4 py-3">{r.sales}</td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3 font-bold">{r.be} BE</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Save className="w-4 h-4"/></button>
                      <button className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}