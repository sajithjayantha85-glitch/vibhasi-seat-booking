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
            {/* Compact Mobile-Friendly Concert Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold mb-0.5">
                    <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>ශ්‍රී ලංකා විභාග දෙපාර්තමේන්තු සුභසාධක සංගමය</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <span>"විභාසි" (Vibhasi) ප්‍රසංගය 2026</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full font-bold">
                      LIVE
                    </span>
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      බත්තරමුල්ල සුහුරුපාය 19 වන මහල
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      2026 ඔක්තෝබර් 05 (සඳුදා) ප.ව. 05:00
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl text-xs text-emerald-300 self-start sm:self-center font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>නොමිලේ ප්‍රවේශය • උපරිම ආසන 3ක් තෝරන්න</span>
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
