import React from 'react';
import { Ticket, ShieldAlert, Settings, Radio, Sparkles, Building2, Activity, Lock } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, selectedSeatsCount, isConnected, occupancyRate = 0 }) {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo & Venue Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                VIBHASI 2026
              </span>
              <span className="hidden sm:inline-block px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold rounded-full border border-emerald-500/20">
                Dept. of Examinations Welfare Society
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5">
              Suhurupaya 19th Floor Auditorium • Official Seat Reservation
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('BOOKING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'BOOKING'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Book Seats</span>
            {selectedSeatsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                {selectedSeatsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('MONITOR')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'MONITOR'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Live Monitor</span>
            {occupancyRate > 0 && (
              <span className="hidden md:inline-block px-1.5 py-0.2 bg-sky-500/20 text-sky-300 text-[10px] font-mono rounded">
                {occupancyRate}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SCANNER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'SCANNER'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Gate Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('ADMIN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ADMIN'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Admin</span>
          </button>
        </nav>

        {/* Live Sync Status indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-full text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-400 font-mono text-[10px]">
            {isConnected ? 'Real-time Sync Active' : 'Connecting...'}
          </span>
        </div>
      </div>
    </header>
  );
}
