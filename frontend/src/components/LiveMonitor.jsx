import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Radio,
  Volume2,
  VolumeX,
  Sparkles,
  Ticket,
  Maximize2,
  TrendingUp,
  RefreshCw,
  Play
} from 'lucide-react';
import AuditoriumMap from './AuditoriumMap';
import { sounds } from '../utils/audio';

export default function LiveMonitor({
  seats = [],
  stats = {},
  isConnected = false,
  recentSeatIds = [],
  recentCheckIns = [],
  onSimulateCheckIn
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState('');

  // Total auditorium capacity
  const totalSeats = stats.total || 504;
  const checkedInSeats = stats.checkedInSeats || 0;
  const bookedAwaiting = stats.bookedAwaiting || Math.max(0, (stats.booked || 0) - checkedInSeats);
  const availableSeats = stats.available || (totalSeats - (stats.booked || 0) - (stats.blocked || 0));
  const blockedSeats = stats.blocked || 0;

  // Occupancy percentages
  const occupancyPercent = totalSeats > 0 ? ((checkedInSeats / totalSeats) * 100).toFixed(1) : 0;
  const leftPercent = 252 > 0 ? (((stats.leftOccupied || 0) / 252) * 100).toFixed(1) : 0;
  const rightPercent = 252 > 0 ? (((stats.rightOccupied || 0) / 252) * 100).toFixed(1) : 0;

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSimulationMessage('');
    try {
      if (onSimulateCheckIn) {
        await onSimulateCheckIn();
        if (soundEnabled) sounds.playSuccessChime();
        setSimulationMessage('ආදර්ශන ඇතුල්වීම සාර්ථකයි! ශාලාව පිරී යාම යාවත්කාලීන විය.');
      }
    } catch (err) {
      setSimulationMessage('දෝෂයකි: ' + err.message);
    } finally {
      setIsSimulating(false);
      setTimeout(() => setSimulationMessage(''), 4000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Hero Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-sky-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/15 border border-sky-500/30 rounded-full text-sky-400 text-xs font-semibold uppercase tracking-wider">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-sky-400' : 'text-slate-500'}`} />
                <span>{isConnected ? 'Real-Time Gate Sync Active' : 'Connecting to Gate...'}</span>
              </span>
              <span className="text-slate-400 text-xs">• සජීවී දොරටු පරීක්ෂාව</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ශාලාව පිරීයාමේ සජීවී නිරීක්ෂකය
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              "විභාසි" (Vibhasi) ප්‍රසංගය • දොරටුවේදී ටිකට්පත් ස්කෑන් කර ඇතුළත් කිරීමේදී ආසන පිරෙන අන්දම සජීවීව නිරීක්ෂණය කරන්න.
            </p>
          </div>

          {/* Quick Control Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setSoundEnabled(prev => !prev)}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                soundEnabled
                  ? 'bg-slate-800/90 text-sky-400 border-sky-500/30 hover:bg-slate-700'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title={soundEnabled ? 'Entrance Chime Enabled' : 'Entrance Chime Muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Chime On' : 'Chime Muted'}</span>
            </button>

            <button
              onClick={handleSimulate}
              disabled={isSimulating}
              className="py-2.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'ස්කෑන් කරමින්...' : 'ආදර්ශන ස්කෑන් (Simulate Scan)'}</span>
            </button>
          </div>
        </div>

        {simulationMessage && (
          <div className="mt-3 p-2.5 bg-sky-950/80 border border-sky-500/40 rounded-xl text-xs text-sky-200 flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{simulationMessage}</span>
          </div>
        )}
      </div>

      {/* Main KPI Stats & Liquid Fill Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Main Hall Occupancy Progress */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                මුළු ශාලාවේ පිරීයාම (Total Hall Occupancy)
              </h2>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-sky-400 font-mono">
                {occupancyPercent}%
              </span>
              <span className="text-xs text-slate-400 ml-2 font-mono">
                ({checkedInSeats} / {totalSeats} ආසන)
              </span>
            </div>
          </div>

          {/* Liquid Progress Bar */}
          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 transition-all duration-700 shadow-md shadow-sky-500/50 relative overflow-hidden"
              style={{ width: `${Math.min(100, Math.max(0, occupancyPercent))}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none" />
            </div>
          </div>

          {/* Left vs Right Block Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">වම් කොටස (Left Block)</span>
                <span className="font-mono font-bold text-sky-400">
                  {stats.leftOccupied || 0} / 252 ({leftPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${leftPercent}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">දකුණු කොටස (Right Block)</span>
                <span className="font-mono font-bold text-cyan-400">
                  {stats.rightOccupied || 0} / 252 ({rightPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${rightPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4 Status Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Checked-in Seats (Inside Hall) */}
          <div className="bg-gradient-to-br from-sky-950/40 to-slate-950/80 border border-sky-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden shadow-sm">
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-sky-300 block uppercase tracking-wider">
              ශාලාව තුළ අසුන්ගෙන ඇත
            </span>
            <div className="text-2xl font-black text-sky-400 font-mono">
              {checkedInSeats}
            </div>
            <p className="text-[10px] text-slate-400">
              {stats.checkedIn || 0} දෙනෙක් දොරටුවෙන් ඇතුල් විය
            </p>
          </div>

          {/* 2. Booked Seats (Awaiting Gate Arrival) */}
          <div className="bg-gradient-to-br from-rose-950/40 to-slate-950/80 border border-rose-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden shadow-sm">
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-rose-300 block uppercase tracking-wider">
              පැමිණීමට නියමිත
            </span>
            <div className="text-2xl font-black text-rose-400 font-mono">
              {bookedAwaiting}
            </div>
            <p className="text-[10px] text-slate-400">
              ටිකට් වෙන්කර ඇති නමුත් තවම ඇතුල් වී නැත
            </p>
          </div>

          {/* 3. Available Seats */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden shadow-sm">
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Ticket className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-300 block uppercase tracking-wider">
              හිස් ආසන (Available)
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {availableSeats}
            </div>
            <p className="text-[10px] text-slate-400">
              කිසිවෙකු වෙන්කර නොමැත
            </p>
          </div>

          {/* 4. VIP Blocked */}
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-950/80 border border-slate-700/50 rounded-2xl p-4 space-y-1 relative overflow-hidden shadow-sm">
            <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-700/30 flex items-center justify-center text-slate-300">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-300 block uppercase tracking-wider">
              VIP / Blocked
            </span>
            <div className="text-2xl font-black text-slate-200 font-mono">
              {blockedSeats}
            </div>
            <p className="text-[10px] text-slate-400">
              පරිපාලක විසින් වෙන්කර ඇත
            </p>
          </div>
        </div>
      </div>

      {/* Main Map & Live Entrance Stream Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Interactive Auditorium Map in Live Monitor Mode (3 Cols) */}
        <div className="xl:col-span-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>සජීවී ආසන සිතියම (Live Seating Visualizer)</span>
            </h3>
            <span className="text-xs text-sky-400 font-mono font-medium">
              නිල් පැහැති ආසන = ශාලාවේ අසුන්ගෙන ඇත
            </span>
          </div>

          <AuditoriumMap
            seats={seats}
            selectedSeatIds={[]}
            isLiveMonitor={true}
            recentSeatIds={recentSeatIds}
            isAdmin={false}
          />
        </div>

        {/* Live Entrance Activity Stream (1 Col) */}
        <div className="xl:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col h-[650px] sm:h-[750px] shadow-xl">
          <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                සජීවී ඇතුල්වීම් ප්‍රවාහය
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Live Feed
            </span>
          </div>

          {/* Activity Cards List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {recentCheckIns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs">
                <Ticket className="w-8 h-8 text-slate-600 mb-2" />
                <p className="font-medium">තවම කිසිවෙකු ඇතුල් වී නැත</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  දොරටුවේදී ටිකට්පත් ස්කෑන් කළ විට මෙහි දිස්වේ
                </p>
              </div>
            ) : (
              recentCheckIns.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 bg-slate-950/80 border border-slate-800/80 hover:border-sky-500/40 rounded-xl space-y-1.5 transition-all text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[130px]">
                      {item.guest_name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(item.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-amber-400">
                      {item.institution_ref}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.gate_officer || 'Gate 1'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(item.seat_ids || []).map((seatId) => (
                      <span
                        key={seatId}
                        className="px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded text-[10px] font-mono font-bold"
                      >
                        {seatId}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-center">
            <span className="text-[10px] text-slate-400">
              ස්කෑන් කළ වහාම මෙම තිරය ස්වයංක්‍රීයව අලුත් වේ.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
