'use client';

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';
import {
  QrCode,
  ShieldCheck,
  Users,
  Eye,
  EyeOff,
  Search,
  Upload,
  UserPlus,
  CheckCircle2,
  RefreshCw,
  Download,
  Lock,
  LogOut,
  Award,
} from 'lucide-react';

export default function AdminPortal() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ totalIssued: 0, totalScanned: 0, qrVisible: false });
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  const [newReg, setNewReg] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addStudentMsg, setAddStudentMsg] = useState('');

  const [searchReg, setSearchReg] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<any>(null);
  const [searchMessage, setSearchMessage] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message);
    } else {
      setUser(data.user);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const fetchStats = async () => {
    setRefreshingStats(true);
    const res = await fetch('/api/admin');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
    setRefreshingStats(false);
  };

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const handleToggleQrVisibility = async () => {
    const nextState = !stats.qrVisible;
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_qr_visibility', visible: nextState }),
    });
    if (res.ok) {
      setStats((prev) => ({ ...prev, qrVisible: nextState }));
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'reg_no,name,email\n23BCE1001,Aarav Sharma,aarav.23bce1001@vitbhopal.ac.in\n23BCE1002,Priya Verma,priya.23bce1002@vitbhopal.ac.in';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'anavitra_sample_students.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('Reading CSV file...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setUploadStatus(`Uploading ${results.data.length} students & generating AnaVITra passes...`);
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert_students',
            students: results.data,
          }),
        });

        const data = await res.json();
        setUploading(false);
        if (res.ok) {
          setUploadStatus(`Successfully generated ${data.count} AnaVITra passes!`);
          fetchStats();
        } else {
          setUploadStatus(`Error: ${data.error}`);
        }
      },
    });
  };

  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentMsg('Generating AnaVITra pass...');
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_students',
        students: [{ reg_no: newReg, name: newName, email: newEmail }],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddStudentMsg(`Registered ${newName} (${newReg}) for AnaVITra`);
      setNewReg('');
      setNewName('');
      setNewEmail('');
      fetchStats();
    } else {
      setAddStudentMsg(`Error: ${data.error}`);
    }
  };

  const handleSearchReg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchMessage('Searching database...');
    setSearchedStudent(null);
    const res = await fetch(`/api/admin?reg_no=${encodeURIComponent(searchReg)}`);
    const data = await res.json();
    if (data.student) {
      setSearchedStudent(data.student);
      setSearchMessage('');
    } else {
      setSearchMessage('No AnaVITra pass found with that registration number.');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center font-sans font-bold">Loading Admin Portal...</div>;
  }

  const scanPercentage = stats.totalIssued > 0 ? Math.min(100, Math.round((stats.totalScanned / stats.totalIssued) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#2C3E50] font-sans">
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#1A2530] text-[#D4AF37] flex items-center justify-center shadow">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-base text-[#1A2530]">LuVITma Admin Portal</span>
              <p className="text-[11px] text-slate-500">Hostel Event Committee (HEC)</p>
            </div>
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {!user ? (
          <div className="max-w-md mx-auto rounded-3xl bg-[#F4F6F9] border border-white p-8 mt-12 shadow-[10px_10px_20px_#d1d9e6,-10px_-10px_20px_#ffffff]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-white mx-auto mb-5 shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-black text-[#1A2530] mb-1 text-center">HEC Admin Login</h2>
            <p className="text-xs text-slate-500 mb-6 text-center">Enter your Supabase Auth administrator credentials.</p>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@vitbhopal.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4.5 py-3 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4.5 py-3 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]"
                />
              </div>
              {loginError && <p className="text-xs text-red-600 font-bold">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-3.5 bg-[#1A2530] hover:bg-[#2C3E50] text-white font-black rounded-2xl text-sm transition shadow-[4px_4px_10px_rgba(0,0,0,0.15)] cursor-pointer mt-2"
              >
                Authenticate Admin
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white border border-white p-5 rounded-3xl shadow-[6px_6px_14px_#d1d9e6,-6px_-6px_14px_#ffffff]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#1A2530] text-[#D4AF37] flex items-center justify-center shadow">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#1A2530]">Welcome</h2>
                  <p className="text-xs text-slate-500">AnaVITra Passes & Ticket Counter Telemetry</p>
                </div>
              </div>
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EAEFF5] hover:bg-[#dce3ec] border-0 text-xs font-bold text-[#1A2530] transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingStats ? 'animate-spin' : ''}`} />
                Sync Stats
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-3xl bg-[#F4F6F9] border border-white p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Total Issued Passes</span>
                  <Users className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <p className="text-4xl font-black text-[#1A2530]">{stats.totalIssued.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">AnaVITra registered tickets</p>
              </div>

              <div className="rounded-3xl bg-[#F4F6F9] border border-white p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider">Counter Check-Ins</span>
                  <QrCode className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-emerald-600">{stats.totalScanned.toLocaleString()}</p>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    {scanPercentage}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#EAEFF5] rounded-full overflow-hidden mt-3 shadow-inner">
                  <div className="h-full bg-emerald-500 transition-all duration-500 rounded-full" style={{ width: `${scanPercentage}%` }} />
                </div>
              </div>

              <div className="rounded-3xl bg-[#F4F6F9] border border-white p-6 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider">AnaVITra Pass Visibility</span>
                  {stats.qrVisible ? <Eye className="w-5 h-5 text-emerald-600" /> : <EyeOff className="w-5 h-5 text-red-500" />}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  {stats.qrVisible ? 'Passes visible on student portal' : 'Passes hidden until festival day'}
                </p>
                <button
                  onClick={handleToggleQrVisibility}
                  className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs tracking-wide transition-all shadow-md cursor-pointer ${
                    stats.qrVisible ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                >
                  {stats.qrVisible ? '🟢 PASSES LIVE (Click to Hide)' : '🔴 PASSES HIDDEN (Click to Reveal)'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-[#F4F6F9] border border-white p-7 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff]">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Search className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-lg font-black text-[#1A2530]">AnaVITra Pass Lookup</h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">Verify pass validity and scan timestamp by registration number.</p>
              <form onSubmit={handleSearchReg} className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Enter Registration Number..."
                  value={searchReg}
                  onChange={(e) => setSearchReg(e.target.value)}
                  className="flex-1 px-4.5 py-3.5 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] font-mono shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]"
                />
                <button type="submit" className="px-7 py-3.5 bg-[#1A2530] hover:bg-[#2C3E50] text-white rounded-2xl font-black text-sm transition cursor-pointer">
                  Lookup
                </button>
              </form>

              {searchMessage && <p className="text-xs text-slate-500 mt-4 font-medium">{searchMessage}</p>}

              {searchedStudent && (
                <div className="mt-5 p-5 rounded-2xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shadow-inner">
                  <div>
                    <span className="text-slate-400 uppercase font-bold block mb-0.5">Attendee Name</span>
                    <span className="font-black text-[#1A2530] text-base">{searchedStudent.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block mb-0.5">Registration Number</span>
                    <span className="font-mono font-black text-[#D4AF37] text-base">{searchedStudent.reg_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block mb-0.5">Official Email</span>
                    <span className="text-slate-600 font-medium">{searchedStudent.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase font-bold block mb-0.5">Counter Status</span>
                    {searchedStudent.is_scanned ? (
                      <span className="text-emerald-600 font-black text-sm flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> CHECKED IN</span>
                    ) : (
                      <span className="text-amber-600 font-black text-sm">⏳ PENDING ENTRY</span>
                    )}
                  </div>
                  {searchedStudent.is_scanned && (
                    <div className="sm:col-span-2 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 uppercase font-bold block mb-0.5">Counter Operator</span>
                        <span className="font-bold text-[#1A2530]">{searchedStudent.scanned_by}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 uppercase font-bold block mb-0.5">Scan Timestamp</span>
                        <span className="text-slate-600 font-mono">{new Date(searchedStudent.scanned_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-3xl bg-[#F4F6F9] border border-white p-7 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-5 h-5 text-[#D4AF37]" />
                      <h3 className="text-base font-black text-[#1A2530]">Bulk CSV Upload (20k+)</h3>
                    </div>
                    <button type="button" onClick={downloadSampleCsv} className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] hover:underline bg-[#EAEFF5] px-3 py-1 rounded-xl cursor-pointer">
                      <Download className="w-3.5 h-3.5" /> Sample CSV
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-6">Headers required: <code className="text-[#1A2530] font-bold">reg_no, name, email</code></p>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#D4AF37] rounded-2xl p-7 cursor-pointer bg-[#EAEFF5] transition group shadow-inner">
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-[#D4AF37] mb-2" />
                    <span className="text-xs font-extrabold text-[#1A2530]">{uploading ? 'Processing CSV...' : 'Click to Upload AnaVITra CSV'}</span>
                    <input type="file" accept=".csv" disabled={uploading} onChange={handleCsvUpload} className="hidden" />
                  </label>
                </div>
                {uploadStatus && <div className="mt-5 text-xs p-4 rounded-2xl bg-white border border-emerald-200 text-emerald-800 font-bold">{uploadStatus}</div>}
              </div>

              <form onSubmit={handleAddSingleStudent} className="rounded-3xl bg-[#F4F6F9] border border-white p-7 shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] space-y-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-[#1A2530]">Register Individual Pass</h3>
                </div>
                <input type="text" required placeholder="Registration Number" value={newReg} onChange={(e) => setNewReg(e.target.value)} className="w-full px-4.5 py-3 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] font-mono shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]" />
                <input type="text" required placeholder="Student Full Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4.5 py-3 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]" />
                <input type="email" required placeholder="Official College Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-4.5 py-3 rounded-2xl bg-[#EAEFF5] border-0 text-sm text-[#1A2530] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5)]" />
                <button type="submit" className="w-full py-3.5 bg-[#1A2530] hover:bg-[#2C3E50] text-white font-black rounded-2xl text-sm transition cursor-pointer">
                  Generate AnaVITra Pass
                </button>
                {addStudentMsg && <p className="text-xs text-emerald-700 font-bold">{addStudentMsg}</p>}
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
