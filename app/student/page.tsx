'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Award, CheckCircle2, AlertCircle, LogOut, Ticket, ShieldAlert } from 'lucide-react';

export default function StudentPortal() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/student?email=${encodeURIComponent(cleanEmail)}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      setUserEmail(cleanEmail);

      if (!res.ok || !data.ticket) {
        setTicket(null);
        setErrorMsg(data.error || 'No AnaVITra pass found registered with this email address.');
      } else {
        setTicket(data.ticket);
      }
    } catch (err: any) {
      setUserEmail(cleanEmail);
      setTicket(null);
      setErrorMsg(err?.message || 'Network error while loading your pass.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUserEmail(null);
    setTicket(null);
    setEmailInput('');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F4F6F9] font-sans flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#D4AF37] via-[#FF5722] to-[#9C27B0]" />

      <header className="border-b border-white/10 bg-[#121212]/90 backdrop-blur-md shadow-lg z-10">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#1A1A1A] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center shadow">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-base text-[#D4AF37] tracking-wider">AnaVITra '26 Pass</span>
              <p className="text-[11px] text-slate-400">Hostel Event Committee (HEC)</p>
            </div>
          </div>
          {userEmail && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/50 border border-red-800/50 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8 w-full flex-1 flex flex-col justify-center relative z-10">
        {!userEmail ? (
          <div className="rounded-3xl bg-[#161616] border border-[#D4AF37]/30 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-center space-y-6">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-black mx-auto mb-4 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                <Award className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-[#D4AF37] mb-1">A Journey Through India</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your official student email address below to view your AnaVITra '26 pass.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Official College Email</label>
                <input
                  type="email"
                  required
                  placeholder="student@vitbhopal.ac.in"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-4.5 py-3.5 rounded-2xl bg-[#0B0B0B] border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#C5A059] hover:from-[#e5c158] hover:to-[#d4af37] text-black font-black rounded-2xl text-sm transition shadow-lg cursor-pointer mt-1"
              >
                {loading ? 'Searching...' : 'View My Pass'}
              </button>
            </form>
          </div>
        ) : errorMsg ? (
          <div className="rounded-3xl bg-[#161616] border border-red-500/30 p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-950/60 text-red-400 flex items-center justify-center mx-auto border border-red-800/40">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-white">Pass Not Found</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
            <p className="text-[11px] text-slate-500 font-mono">Searched Email: {userEmail}</p>
            <button
              onClick={handleReset}
              className="mt-2 px-5 py-2.5 rounded-xl bg-[#0B0B0B] border border-white/10 text-xs font-bold text-[#D4AF37] cursor-pointer hover:bg-[#1a1a1a]"
            >
              Try Another Email
            </button>
          </div>
        ) : ticket && !ticket.qr_visible ? (
          <div className="rounded-3xl bg-[#161616] border border-amber-500/30 p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/60 text-amber-400 flex items-center justify-center mx-auto border border-amber-800/40">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-white">Passes Currently Hidden</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              AnaVITra '26 passes are currently hidden by HEC administrators and will be revealed closer to the event date.
            </p>
          </div>
        ) : ticket && ticket.qr_visible ? (
          <div className="rounded-3xl bg-[#161616] border-2 border-[#D4AF37]/60 p-7 shadow-[0_0_40px_rgba(212,175,55,0.15)] relative overflow-hidden text-center space-y-6">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#D4AF37] via-[#FF5722] to-[#D4AF37]" />

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#0B0B0B] bg-[#D4AF37] px-3 py-1 rounded-full shadow">
                7 Houses • 28 States • 1 Celebration
              </span>
              <h2 className="text-3xl font-black text-[#D4AF37] mt-3 tracking-wide">AnaVITra '26</h2>
              <p className="text-xs text-slate-400">A Journey Through India</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-inner border border-[#D4AF37]/30 inline-block mx-auto">
              <QRCodeSVG
                value={ticket.ticket_hash || JSON.stringify({ reg_no: ticket.reg_no, email: ticket.email })}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">{ticket.full_name}</h3>
              <p className="text-xs text-slate-400 font-medium">{ticket.email}</p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-center">
              {ticket.is_scanned ? (
                <div className="flex items-center gap-2 text-emerald-400 font-black text-xs bg-emerald-950/60 border border-emerald-800/50 px-4 py-2 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" /> CHECKED IN AT GATE
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs bg-amber-950/60 border border-amber-800/50 px-4 py-2 rounded-xl">
                  <span>⏳</span> READY FOR GATE SCAN
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-500 font-medium z-10">
        AnaVITra '26 Gate Ticketing &bull; Hostel Event Committee
      </footer>
    </div>
  );
}
