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
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to complete reservation' };
      }
    } catch (err) {
      return { success: false, error: 'Network error while creating booking: ' + err.message };
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
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
            {/* Elegant Modern Concert Header Card */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                      <Music className="w-3.5 h-3.5 text-emerald-400" />
                      Dept. of Examinations Welfare Society
                    </span>
                    <span className="text-[11px] font-mono font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      LIVE RESERVATION
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    "VIBHASI" Annual Musical Concert 2026
                  </h1>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-300 pt-1">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      19th Floor Auditorium, Suhurupaya, Battaramulla
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                      Monday, October 05, 2026 at 5:00 PM
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
                  <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl px-4 py-2.5 text-center shadow-lg">
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block">Admission</span>
                    <span className="text-base font-extrabold text-white">100% Free</span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 text-center shadow-lg">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Booking Limit</span>
                    <span className="text-base font-mono font-bold text-amber-300">Max 3 Seats</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Seating Layout Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-emerald-400" />
                    <span>Auditorium Seating Layout</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Front Stage area (17m × 4m-6m) • Left and Right blocks separated by central aisle
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-slate-900/90 px-3.5 py-2 rounded-2xl border border-slate-800 shadow-sm">
                  <span>Available: <strong className="text-emerald-400 font-bold">{stats.available}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>Reserved: <strong className="text-rose-400 font-bold">{stats.booked}</strong></span>
                  <span className="text-slate-600">•</span>
                  <span>VIP Locked: <strong className="text-slate-400 font-bold">{stats.blocked}</strong></span>
                </div>
              </div>

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

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              To ensure fair access for all guests, reservations are strictly limited to a{' '}
              <strong className="text-amber-400">maximum of 3 seats per attendee</strong>.
            </p>

            <button
              onClick={() => setShowMaxLimitModal(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              I Understand
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
