import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Ticket,
  AlertTriangle,
  Sparkles,
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ShieldCheck,
  X,
  Music
} from 'lucide-react';
import Navbar from './components/Navbar';
import AuditoriumMap from './components/AuditoriumMap';
import BookingModal from './components/BookingModal';
import ETicketModal from './components/ETicketModal';
import GateScanner from './components/GateScanner';
import AdminPortal from './components/AdminPortal';
import LiveMonitor from './components/LiveMonitor';

export default function App() {
  const [activeTab, setActiveTab] = useState('BOOKING'); // 'BOOKING' | 'MONITOR' | 'SCANNER' | 'ADMIN'
  const [seats, setSeats] = useState([]);
  const [stats, setStats] = useState({ total: 504, available: 504, booked: 0, blocked: 0, checkedIn: 0, occupancyRate: 0 });
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMaxLimitModal, setShowMaxLimitModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [recentSeatIds, setRecentSeatIds] = useState([]);
  const [recentCheckIns, setRecentCheckIns] = useState([]);

  // Load seats from server
  const loadSeats = async () => {
    try {
      const res = await fetch('/api/seats');
      const data = await res.json();
      if (data.success) {
        setSeats(data.seats);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load auditorium seats:', err);
    }
  };

  // Load recent check-ins for live feed
  const loadRecentCheckIns = async () => {
    try {
      const res = await fetch('/api/gate/recent');
      const data = await res.json();
      if (data.success) {
        setRecentCheckIns(data.checkIns);
      }
    } catch (err) {
      console.error('Failed to load recent check-ins:', err);
    }
  };

  useEffect(() => {
    loadSeats();
    loadRecentCheckIns();

    // Socket.io Real-time connection
    const socket = io();

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('seats:updated', (payload) => {
      if (payload.seats) setSeats(payload.seats);
      if (payload.stats) setStats(payload.stats);
    });

    socket.on('gate:checked_in', (payload) => {
      if (payload.stats) setStats(payload.stats);

      // Trigger pulse animation on checked-in seats for 15 seconds
      if (payload.seatIds && Array.isArray(payload.seatIds)) {
        setRecentSeatIds(prev => [...new Set([...prev, ...payload.seatIds])]);
        setTimeout(() => {
          setRecentSeatIds(prev => prev.filter(id => !payload.seatIds.includes(id)));
        }, 15000);
      }

      // Add to live entrance feed
      setRecentCheckIns(prev => [
        {
          id: crypto.randomUUID(),
          guest_name: payload.guestName,
          nic: payload.nic,
          institution_ref: payload.institutionRef,
          seat_ids: payload.seatIds,
          checked_in_at: payload.checkedInAt,
          gate_officer: 'Main Gate'
        },
        ...prev.slice(0, 49)
      ]);

      loadSeats();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Simulate entrance scan
  const handleSimulateCheckIn = async () => {
    const res = await fetch('/api/gate/simulate-checkin', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to simulate check-in');
    }
    await loadSeats();
    await loadRecentCheckIns();
    return data;
  };

  // Handle seat click warning when attempting 4th seat
  const handleMaxLimitWarning = () => {
    setShowMaxLimitModal(true);
  };

  // Submit booking
  const handleConfirmBooking = async (formData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          nic: formData.nic,
          phone: formData.phone,
          institutionRef: formData.institutionRef,
          seatIds: selectedSeatIds
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsBookingModalOpen(false);
        setSelectedSeatIds([]);
        setActiveTicket(data.booking);
        loadSeats();
      } else {
        alert(data.error || 'Failed to complete reservation');
      }
    } catch (err) {
      alert('Network error while creating booking: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedSeatsCount={selectedSeatIds.length}
        isConnected={isConnected}
        occupancyRate={stats.occupancyRate || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-24">
        {activeTab === 'BOOKING' && (
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
            {/* 3D Animated Concert Hero Banner */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden hover-3d-tilt">
              {/* Dynamic 3D Moving Stage Spotlights */}
              <div className="absolute -top-32 left-1/4 w-72 h-96 bg-gradient-to-b from-cyan-400/20 via-cyan-400/5 to-transparent blur-2xl pointer-events-none animate-spotlight-left" />
              <div className="absolute -top-32 right-1/4 w-72 h-96 bg-gradient-to-b from-purple-500/20 via-purple-500/5 to-transparent blur-2xl pointer-events-none animate-spotlight-right" />
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-80 bg-gradient-to-b from-amber-300/15 via-amber-300/5 to-transparent blur-xl pointer-events-none animate-spotlight-center" />

              {/* Floating 3D Musical Notes */}
              <span className="absolute left-8 top-14 text-cyan-400/60 font-bold select-none pointer-events-none text-2xl animate-music-1">♪</span>
              <span className="absolute left-1/3 top-20 text-amber-300/60 font-bold select-none pointer-events-none text-xl animate-music-2">♫</span>
              <span className="absolute right-1/3 top-10 text-emerald-400/60 font-bold select-none pointer-events-none text-2xl animate-music-3">♩</span>

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Left Column (7 cols): Event Branding & Details */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/10">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Free Admission Pass • ආසන වෙන්කිරීම සම්පූර්ණයෙන්ම නොමිලේ</span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2">
                      <Music className="w-4 h-4 text-emerald-400" />
                      <span>ශ්‍රී ලංකා විභාග දෙපාර්තමේන්තු සුභසාධක සංගමය ඉදිරිපත් කරන</span>
                    </p>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                      "විභාසි" (Vibhasi) ප්‍රසංගය
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>බත්තරමුල්ල සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>2026 ඔක්තෝබර් 05 (සඳුදා)</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span>ප.ව. 05:00 (දොරටු විවෘත කිරීම ප.ව. 03:30)</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
                    පහත අන්තර්ක්‍රියාකාරී ශාලා සිතියමෙන් ඔබගේ ආසන තෝරාගන්න.
                    එක් අයෙකුට <strong>උපරිම වශයෙන් ආසන 3ක්</strong> වෙන්කර ගත හැක. වෙන්කළ සැණින් ඔබගේ ඩිජිටල් ඊ-ටිකට්පත් හා QR කේත ලබාදෙනු ලැබේ.
                  </p>

                  {/* 3 Quick 3D Key Highlights */}
                  <div className="grid grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 text-center shadow-lg transition-transform hover:-translate-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">මුළු ආසන</span>
                      <span className="font-mono font-black text-sm text-emerald-400 block mt-0.5">504 Seats</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 text-center shadow-lg transition-transform hover:-translate-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ආසන සීමාව</span>
                      <span className="font-mono font-black text-sm text-amber-300 block mt-0.5">Max 3 Seats</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-2.5 text-center shadow-lg transition-transform hover:-translate-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">ගාස්තු</span>
                      <span className="font-mono font-black text-sm text-sky-400 block mt-0.5">100% Free</span>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): 3D Concert Stage Isometric Showcase */}
                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative w-full max-w-sm">
                    {/* 3D Stage Card */}
                    <div className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl shadow-emerald-500/10 animate-float-3d">
                      {/* Marquee Badge */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 shadow-md shadow-rose-500/50"></span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black tracking-tight text-white">
                              සජීවී ප්‍රසංගය 2026
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full font-extrabold">
                              LIVE
                            </span>
                          </div>
                        </div>
                        {/* Audio Wave Equalizer Animation */}
                        <div className="flex items-end gap-1 h-5 px-2 py-0.5 bg-slate-950 rounded-lg border border-slate-800" title="Live Concert Ambiance">
                          <div className="w-1 bg-cyan-400 rounded-full animate-eq-1" />
                          <div className="w-1 bg-emerald-400 rounded-full animate-eq-2" />
                          <div className="w-1 bg-amber-400 rounded-full animate-eq-3" />
                          <div className="w-1 bg-pink-400 rounded-full animate-eq-4" />
                          <div className="w-1 bg-sky-400 rounded-full animate-eq-5" />
                        </div>
                      </div>

                      {/* 3D Tilted Concert Stage Visual */}
                      <div className="my-4 py-6 px-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-slate-800/80 relative overflow-hidden flex flex-col items-center justify-center">
                        {/* Stage Spotlight Glow */}
                        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-cyan-500/10 pointer-events-none" />

                        {/* 3D Platform */}
                        <div className="w-full h-24 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl border border-slate-600/50 stage-platform-3d flex items-center justify-center shadow-2xl relative">
                          {/* Footlights LEDs */}
                          <div className="absolute bottom-1 inset-x-4 flex justify-between">
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400 animate-pulse" />
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400 animate-pulse" />
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400 animate-pulse" />
                            <span className="w-2 h-2 rounded-full bg-pink-400 shadow-lg shadow-pink-400 animate-pulse" />
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400 animate-pulse" />
                          </div>

                          <div className="text-center">
                            <span className="text-[11px] font-mono tracking-widest text-emerald-400 font-extrabold block">
                              ◄ SUHURUPAYA 17M STAGE ►
                            </span>
                            <span className="text-base font-black tracking-widest text-white drop-shadow-md block">
                              "විභාසි" සජීවී ප්‍රසංගය
                            </span>
                            <span className="text-[10px] font-mono text-cyan-300 font-bold tracking-wider inline-block bg-slate-900/80 px-2 py-0.5 rounded-full border border-cyan-500/30 mt-0.5">
                              ● 2026 LIVE CONCERT
                            </span>
                          </div>
                        </div>

                        {/* Stage Front Apron Curve */}
                        <div className="w-4/5 h-3 bg-gradient-to-r from-emerald-500/40 via-teal-400/80 to-emerald-500/40 rounded-full blur-[2px] mt-1" />
                      </div>

                      {/* Footer Badge on Card */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                          <span>21 Seating Rows (A to V)</span>
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          Free Digital Passes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Seating Layout */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-emerald-400" />
                    <span>Auditorium Seating Layout</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Front Stage area (17m × 4m-6m) • Left and Right blocks separated by central aisle
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span>Available: <strong className="text-emerald-400">{stats.available}</strong></span>
                  <span>•</span>
                  <span>Reserved: <strong className="text-rose-400">{stats.booked}</strong></span>
                  <span>•</span>
                  <span>VIP Locked: <strong className="text-slate-400">{stats.blocked}</strong></span>
                </div>
              </div>

              {/* Prominent Selection Banner when user selects seats */}
              {selectedSeatIds.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-500/20 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                        <span>ඔබ ආසන {selectedSeatIds.length} ක් තෝරාගෙන ඇත:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedSeatIds.map(id => (
                            <span key={id} className="text-xs font-mono font-extrabold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-emerald-200 mt-0.5">
                        නොමිලේ ඩිජිටල් ප්‍රවේශ පත්‍රය (Free E-Ticket) ලබා ගැනීමට ඉදිරියට යන්න බොත්තම ඔබන්න.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsBookingModalOpen(true)}
                    className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2 transition-transform transform active:scale-95 shrink-0"
                  >
                    <span>ඉදිරියට යන්න (Continue to Book)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              <AuditoriumMap
                seats={seats}
                selectedSeatIds={selectedSeatIds}
                onSeatClick={setSelectedSeatIds}
                maxSeatLimitWarning={handleMaxLimitWarning}
                onProceedBooking={() => setIsBookingModalOpen(true)}
                recentSeatIds={recentSeatIds}
                isAdmin={false}
              />
            </div>
          </div>
        )}

        {/* Live Hall Fill Monitor View */}
        {activeTab === 'MONITOR' && (
          <LiveMonitor
            seats={seats}
            stats={stats}
            isConnected={isConnected}
            recentSeatIds={recentSeatIds}
            recentCheckIns={recentCheckIns}
            onSimulateCheckIn={handleSimulateCheckIn}
          />
        )}

        {/* Gate Scanner View */}
        {activeTab === 'SCANNER' && <GateScanner />}

        {/* Admin Portal View */}
        {activeTab === 'ADMIN' && (
          <AdminPortal
            seats={seats}
            stats={stats}
            onRefreshSeats={loadSeats}
          />
        )}
      </main>

      {/* Floating Bottom Booking Action Bar (When user has selected seats in BOOKING mode) */}
      {activeTab === 'BOOKING' && selectedSeatIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto z-40 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/50 rounded-3xl p-4 shadow-2xl shadow-emerald-500/20 flex items-center justify-between gap-4 animate-slideUp">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-semibold">Selected Seats ({selectedSeatIds.length}/3):</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold font-mono">
                100% Free
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {selectedSeatIds.map(id => (
                <span key={id} className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {id}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectedSeatIds([])}
              className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/30 flex items-center gap-1.5 transition-all transform active:scale-95"
            >
              <span>Continue Booking</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4th Seat Limit Warning Modal */}
      {showMaxLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              Maximum Seat Limit Reached!
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              To ensure fair access for everyone, booking is strictly limited to a{' '}
              <strong className="text-amber-400">maximum of 3 seats per attendee</strong>.
              <br /><br />
              (එක් අයදුම්කරුවෙකුට වෙන්කරවා ගත හැකි උපරිම ආසන සංඛ්‍යාව ආසන 3 කි).
            </p>

            <button
              onClick={() => setShowMaxLimitModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors"
            >
              Understood / තේරුම් ගත්තා
            </button>
          </div>
        </div>
      )}

      {/* Attendee Booking Form Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        selectedSeats={selectedSeatIds}
        onSubmitBooking={handleConfirmBooking}
        isLoading={isSubmitting}
      />

      {/* Digital E-Ticket Modal with QR & Download */}
      {activeTicket && (
        <ETicketModal
          ticketData={activeTicket}
          onClose={() => setActiveTicket(null)}
        />
      )}
    </div>
  );
}
