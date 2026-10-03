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
  Play,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('vibhasi_monitor_auth') === 'true' || sessionStorage.getItem('vibhasi_admin_auth') === 'true';
  });
  const [monitorPassword, setMonitorPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!monitorPassword.trim()) {
      setPasswordError('කරුණාකර මුරපදය ඇතුළත් කරන්න (Please enter password)');
      return;
    }

    setIsVerifying(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: monitorPassword.trim() })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('vibhasi_monitor_auth', 'true');
        setIsAuthenticated(true);
        setMonitorPassword('');
      } else {
        setPasswordError(data.error || 'වැරදි මුරපදයකි (Invalid Password)');
      }
    } catch (err) {
      if (monitorPassword.trim() === 'vibhasi@2026' || monitorPassword.trim() === 'vibhasi@2025' || monitorPassword.trim() === 'admin123') {
        sessionStorage.setItem('vibhasi_monitor_auth', 'true');
        setIsAuthenticated(true);
        setMonitorPassword('');
      } else {
        setPasswordError('මුරපදය වැරදියි (Incorrect Password)! කරුණාකර නැවත උත්සාහ කරන්න.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vibhasi_monitor_auth');
    setIsAuthenticated(false);
    setMonitorPassword('');
  };

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

  // Password Protection Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-[580px] flex items-center justify-center px-4 py-12 animate-fadeIn">
        <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-sky-500/40 rounded-3xl p-8 shadow-2xl shadow-sky-500/10 space-y-6 hover-3d-tilt">
          {/* Glowing background halos */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Icon & Title */}
          <div className="text-center space-y-2 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-cyan-500 p-0.5 mx-auto shadow-xl shadow-sky-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Activity className="w-8 h-8 text-sky-400" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight pt-2">
              සජීවී නිරීක්ෂක පිවිසුම
            </h2>
            <p className="text-xs text-sky-300 font-semibold">
              Department of Examinations, Sri Lanka
            </p>
            <p className="text-[11px] text-slate-400">
              ශාලාවේ ආසන පිරීයාමේ සජීවී දත්ත නැරඹීමට කරුණාකර මුරපදය ඇතුළත් කරන්න
            </p>
          </div>

          {/* Password Form */}
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>මුරපදය (Access Password)</span>
                <span className="text-[10px] text-sky-400 font-mono">Protected</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={monitorPassword}
                  onChange={(e) => {
                    setMonitorPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Enter monitor password"
                  className={`w-full px-4 py-3 bg-slate-950 border rounded-2xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 pr-12 transition-all ${
                    passwordError
                      ? 'border-rose-500 ring-2 ring-rose-500/30 animate-shake-error'
                      : 'border-slate-800 focus:border-sky-500 focus:ring-sky-500/30'
                  }`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium pt-1 animate-fadeIn">
                  <span>⚠️ {passwordError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold rounded-2xl text-sm shadow-xl shadow-sky-600/30 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>තහවුරු කරමින් පවතී...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>පිවිසෙන්න (Access Monitor)</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated Live Monitor View
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fadeIn">
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

            <button
              onClick={handleLogout}
              className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700/60 text-slate-300 hover:text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              title="Lock Live Monitor"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span>Lock Monitor</span>
            </button>
          </div>
        </div>

        {/* Simulation Feedback Banner */}
        {simulationMessage && (
          <div className="mt-4 p-3 bg-sky-950/70 border border-sky-500/40 rounded-2xl text-xs text-sky-300 font-medium flex items-center gap-2 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
            <span>{simulationMessage}</span>
          </div>
        )}
      </div>

      {/* Main Stats KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Admitted & Inside Hall */}
        <div className="bg-slate-900/90 border border-sky-500/30 rounded-2xl p-4 shadow-lg shadow-sky-500/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">ශාලාව තුළ (Inside)</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-sky-400 font-mono">
              {checkedInSeats}
            </span>
            <span className="text-xs text-slate-500">/ {totalSeats}</span>
          </div>
          <div className="mt-2 text-xs font-mono text-sky-300">
            {occupancyPercent}% Occupancy Rate
          </div>
        </div>

        {/* Booked - Awaiting Arrival */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">පැමිණීමට නියමිත</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono">
              {bookedAwaiting}
            </span>
            <span className="text-xs text-slate-500">reserved</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            ටිකට් ලබාගෙන ඇත
          </div>
        </div>

        {/* Left Block Occupancy */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">වම් බ්ලොක් (Left)</span>
            <span className="text-[10px] font-mono text-slate-500">Rows A-V</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {stats.leftOccupied || 0}
            </span>
            <span className="text-xs text-slate-500">/ 252</span>
          </div>
          <div className="mt-2 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${leftPercent}%` }}
            />
          </div>
        </div>

        {/* Right Block Occupancy */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider">දකුණු බ්ලොක් (Right)</span>
            <span className="text-[10px] font-mono text-slate-500">Rows A-V</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {stats.rightOccupied || 0}
            </span>
            <span className="text-xs text-slate-500">/ 252</span>
          </div>
          <div className="mt-2 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${rightPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Dual Grid: Interactive Live Hall Map + Live Entrance Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Real-Time Live Seating Layout */}
        <div className="lg:col-span-8 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                ශාලාවේ සජීවී ආසන සිතියම (Live Hall Map)
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              ස්කෑන් කළ සැණින් අදාළ ආසන නිල් පැහැයෙන් දැල්වේ
            </span>
          </div>

          <AuditoriumMap
            seats={seats}
            selectedSeatIds={[]}
            onSeatClick={() => {}}
            isAdmin={false}
            isLiveMonitor={true}
            recentSeatIds={recentSeatIds}
          />
        </div>

        {/* Right Column (4 cols): Live Gate Entrance Activity Stream */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col h-[540px] sm:h-[650px] lg:h-[750px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="font-bold text-sm text-white">දොරටු සජීවී ප්‍රවාහය</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {recentCheckIns.length} Entrances
            </span>
          </div>

          {/* Scrollable Check-in Items */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {recentCheckIns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Ticket className="w-8 h-8 opacity-40 stroke-1" />
                <p className="text-xs">තවමත් කිසිවෙකු ඇතුළත් වී නොමැත.</p>
                <p className="text-[10px] text-slate-600">දොරටුවේදී QR ස්කෑන් කළ විට මෙහි තොරතුරු දිස්වේ.</p>
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
