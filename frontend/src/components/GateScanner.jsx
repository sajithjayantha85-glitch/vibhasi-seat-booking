import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  User,
  IdCard,
  Ticket,
  Clock,
  ShieldAlert,
  Volume2,
  FlipHorizontal,
  Zap,
  ArrowRight
} from 'lucide-react';
import { sounds } from '../utils/audio';

export default function GateScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { valid, isDuplicate, guest, message, error }
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [stats, setStats] = useState({ checkedInToday: 0 });

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Fetch recent scans on mount
  useEffect(() => {
    fetchRecentScans();
  }, []);

  const fetchRecentScans = async () => {
    try {
      const res = await fetch('/api/gate/recent');
      const data = await res.json();
      if (data.success) {
        setRecentScans(data.checkIns);
        setStats({ checkedInToday: data.checkIns.length });
      }
    } catch (e) {
      console.error('Failed to load recent gate scans:', e);
    }
  };

  // Discover available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer environment / back camera
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Camera detection error (may need permission):', err);
      });

    return () => {
      stopCameraScanner();
    };
  }, []);

  const startCameraScanner = async () => {
    if (!selectedCameraId && cameras.length === 0) {
      alert('No camera found or camera permissions not granted.');
      return;
    }

    try {
      const qrCode = new Html5Qrcode('qr-reader-viewport');
      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.max(200, Math.floor(minEdge * 0.8));
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0
      };

      await qrCode.start(
        selectedCameraId || { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleVerifyPayload(decodedText);
          // Briefly pause scanner so it doesn't fire 5 times a second
          if (html5QrCodeRef.current) {
            html5QrCodeRef.current.pause(true);
            setTimeout(() => {
              try {
                if (html5QrCodeRef.current && isScanning) {
                  html5QrCodeRef.current.resume();
                }
              } catch (e) {}
            }, 3000);
          }
        },
        (errorMessage) => {
          // ignore common frame decode skips
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start camera scanner:', err);
      alert('Camera error: ' + (err.message || 'Unable to access camera feed'));
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Failed to stop camera:', err);
      }
    }
    setIsScanning(false);
  };

  const handleVerifyPayload = async (payload, targetSeatId = null) => {
    if (!payload || isVerifying) return;
    setIsVerifying(true);

    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrPayload: payload,
          targetSeatId,
          gateOfficer: 'Main Gate 1'
        })
      });

      const data = await res.json();
      setScanResult(data);

      if (data.valid && !data.isDuplicate) {
        // SUCCESS: Valid ticket - first scan
        sounds.playSuccessChime();
        fetchRecentScans();
      } else if (data.isDuplicate) {
        // FRAUD / DUPLICATE WARNING
        sounds.playWarningBuzzer();
      } else {
        // INVALID TICKET
        sounds.playWarningBuzzer();
      }
    } catch (err) {
      console.error('Verification request failed:', err);
      setScanResult({
        valid: false,
        error: 'Network or server error during verification: ' + err.message
      });
      sounds.playWarningBuzzer();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleVerifyPayload(manualCode.trim());
    setManualCode('');
  };

  const handleClearResult = () => {
    setScanResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Gate Security Access Control</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Suhurupaya Gate QR Scanner</h1>
          <p className="text-xs text-slate-400 mt-1">
            Instant single-use attendee verification & duplicate fraud protection
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Checked In</span>
            <span className="text-xl font-mono font-bold text-emerald-400">{stats.checkedInToday}</span>
          </div>
          <button
            onClick={() => {
              if (isScanning) stopCameraScanner();
              else startCameraScanner();
            }}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${
              isScanning
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isScanning ? 'Stop Camera' : 'Start Camera Scanner'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Scanner Viewport + Manual Input + Verification Badge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Live Camera Feed (7 cols) */}
        <div className="md:col-span-7 space-y-4">
          <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[340px] flex flex-col items-center justify-center p-4">
            {/* Viewport element for html5-qrcode */}
            <div
              id="qr-reader-viewport"
              className={`w-full max-w-[320px] rounded-2xl overflow-hidden ${!isScanning ? 'hidden' : 'block'}`}
            />

            {!isScanning && (
              <div className="text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-200 text-base">Camera Viewfinder Ready</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Click <strong>Start Camera Scanner</strong> above to use your phone or laptop camera to scan attendees' E-Tickets.
                </p>
                {cameras.length > 1 && (
                  <div className="pt-2">
                    <select
                      value={selectedCameraId || ''}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none"
                    >
                      {cameras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label || `Camera ${c.id.substring(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {isScanning && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Scanner Active • Aim at ticket QR code</span>
              </div>
            )}
          </div>

          {/* Fallback Manual Code Entry */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Manual Ticket Reference / Code Lookup
            </span>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter Booking Ref (e.g. VBH-2026-1234 or Seat Pass Code)"
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isVerifying || !manualCode.trim()}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                <span>Verify</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Instant Verification Result Badge (5 cols) */}
        <div className="md:col-span-5 space-y-4">
          {scanResult ? (
            <div
              className={`rounded-3xl border p-6 shadow-2xl relative transition-all animate-fadeIn ${
                scanResult.valid && !scanResult.isDuplicate
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100 shadow-emerald-500/20'
                  : scanResult.isDuplicate
                  ? 'bg-rose-950/90 border-rose-500 text-rose-100 shadow-rose-500/30 ring-4 ring-rose-500/40'
                  : 'bg-slate-900 border-rose-500 text-rose-200'
              }`}
            >
              {/* Header Status */}
              <div className="flex items-start justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  {scanResult.valid && !scanResult.isDuplicate ? (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                  ) : scanResult.isDuplicate ? (
                    <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold animate-bounce">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-bold">
                      <XCircle className="w-7 h-7" />
                    </div>
                  )}

                  <div>
                    <h2
                      className={`text-lg font-black tracking-tight ${
                        scanResult.valid && !scanResult.isDuplicate
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }`}
                    >
                      {scanResult.valid && !scanResult.isDuplicate
                        ? 'VALID TICKET - ADMIT'
                        : scanResult.isDuplicate
                        ? 'DUPLICATE ENTRY DETECTED!'
                        : 'INVALID TICKET'}
                    </h2>
                    <p className="text-[11px] text-white/70">
                      {scanResult.message || scanResult.error}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleClearResult}
                  className="text-white/60 hover:text-white p-1 rounded-lg text-xs"
                >
                  Clear
                </button>
              </div>

              {/* Guest Information Details */}
              {scanResult.guest && (
                <div className="py-4 space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-white/60 uppercase tracking-wider block">Attendee Name</span>
                    <span className="text-base font-bold text-white block">{scanResult.guest.fullName}</span>
                  </div>

                  {/* High Visibility Attendee ID & Attendance Reference */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/90 rounded-2xl border border-white/15">
                    <div>
                      <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">
                        🪪 ID / NIC Number
                      </span>
                      <span className="font-mono font-black text-sm text-white block mt-0.5">
                        {scanResult.guest.nic}
                      </span>
                    </div>
                    <div className="border-l border-white/10 pl-3">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                        📋 Attendance Ref
                      </span>
                      <span className="font-mono font-black text-sm text-amber-300 block mt-0.5">
                        {scanResult.guest.institutionRef}
                      </span>
                    </div>
                  </div>

                  {/* Single Seat Pass Highlight */}
                  {scanResult.checkedSeat && (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Admitted Seat Pass</span>
                          <span className="text-base font-mono font-black text-white">{scanResult.checkedSeat}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black rounded-lg text-xs">
                        PASSED
                      </span>
                    </div>
                  )}

                  {/* Seat Assignment & Admission Status Breakdown */}
                  <div className="p-3 bg-black/30 rounded-2xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/60 uppercase tracking-wider block">
                        All Booking Seats ({(scanResult.allSeats || scanResult.guest?.allSeats || scanResult.guest?.seats || []).length} Total):
                      </span>
                      {scanResult.pendingSeats?.length > 0 && (
                        <span className="text-[10px] text-amber-300 font-semibold">
                          {scanResult.pendingSeats.length} attendee(s) yet to arrive
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(scanResult.allSeats || scanResult.guest?.allSeats || scanResult.guest?.seats || []).map((seatId) => {
                        const isThisScanned = scanResult.checkedSeat === seatId;
                        const isAlreadyChecked = (scanResult.checkedSeats || []).includes(seatId) || isThisScanned;

                        return (
                          <div
                            key={seatId}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                              isThisScanned
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 ring-2 ring-emerald-300'
                                : isAlreadyChecked
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            <span>{seatId}</span>
                            <span className="text-[9px] font-sans font-bold px-1 rounded bg-black/30">
                              {isThisScanned ? 'JUST ADMITTED' : isAlreadyChecked ? 'ADMITTED' : 'AWAITING'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Manual admit button for remaining pending seats if searched by booking code */}
                    {scanResult.pendingSeats?.length > 0 && (
                      <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] text-slate-400">Admit arriving attendee:</span>
                        {scanResult.pendingSeats.map(pSeat => (
                          <button
                            key={pSeat}
                            type="button"
                            onClick={() => handleVerifyPayload(scanResult.guest?.bookingRef, pSeat)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded text-[11px] font-bold transition-colors"
                          >
                            Admit {pSeat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Check-in timestamp / Duplicate info */}
                  {scanResult.isDuplicate ? (
                    <div className="p-3 bg-rose-900/60 border border-rose-400 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-rose-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-300" />
                        <span>PREVIOUS ADMISSION TIME:</span>
                      </div>
                      {scanResult.seatId && (
                        <div className="text-xs text-rose-200 font-mono font-bold pl-5">
                          Seat: <span className="bg-rose-950 px-2 py-0.5 rounded text-white">{scanResult.seatId}</span>
                        </div>
                      )}
                      <div className="font-mono text-rose-100 text-xs pl-5">
                        {new Date(scanResult.guest.checkedInAt).toLocaleTimeString()} (
                        {new Date(scanResult.guest.checkedInAt).toLocaleDateString()})
                      </div>
                      <div className="text-[10px] text-rose-300 pl-5">
                        Scanned at: {scanResult.guest.gateOfficer || 'Main Gate'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-300/80 flex items-center gap-1.5 pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Admitted at: {new Date(scanResult.guest.checkedInAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Ready for next button */}
              <button
                onClick={handleClearResult}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors mt-2"
              >
                Ready for Next Attendee
              </button>
            </div>
          ) : (
            /* Standby Card */
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Ticket className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-300 text-sm">Awaiting Ticket Scan</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Scan a digital or printed QR code from the camera or enter a reference code to verify admission.
                </p>
              </div>
            </div>
          )}

          {/* Recent Gate Activity Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>Recent Gate Activity</span>
              </span>
              <button
                onClick={fetchRecentScans}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                title="Refresh Log"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {recentScans.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">No attendees checked in yet.</div>
              ) : (
                recentScans.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-200 block">{log.guest_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Ref: {log.institution_ref} • {log.seat_count} Seat(s)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-semibold">
                        Admitted
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        {new Date(log.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
