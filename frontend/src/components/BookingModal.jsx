import React, { useState } from 'react';
import { X, CheckCircle, ShieldCheck, User, Phone, IdCard, Building2, Ticket, AlertCircle, Sparkles } from 'lucide-react';

export default function BookingModal({
  isOpen,
  onClose,
  selectedSeats = [],
  onSubmitBooking,
  isLoading
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    nic: '',
    phone: '',
    institutionRef: ''
  });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!formData.nic.trim()) {
      setError('Please enter your National ID Number (NIC / Passport).');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your Mobile Phone Number.');
      return;
    }
    if (!formData.institutionRef.trim()) {
      setError('Please enter your Institution Arrival / Reference Number.');
      return;
    }

    const res = await onSubmitBooking(formData);
    if (res && !res.success) {
      setError(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header gradient banner */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 bg-black/20 hover:bg-black/40 rounded-full transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Dept. of Examinations Welfare Society</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">"VIBHASI" Musical Concert 2026</h2>
          <p className="text-emerald-100 text-xs mt-1">
            Suhurupaya 19th Floor Auditorium • Free Admission Pass Reservation
          </p>
        </div>

        {/* Selected Seats Bar */}
        <div className="bg-slate-800/80 px-6 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">Selected Seats ({selectedSeats.length}/3):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSeats.map(seatId => (
              <span
                key={seatId}
                className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold"
              >
                {seatId}
              </span>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Full Name *</span>
            </label>
            <input
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              placeholder="e.g. Kasun Chamara Perera"
              className="w-full px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
            />
          </div>

          {/* NIC / Passport */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <IdCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>National ID Number (NIC / Passport) *</span>
            </label>
            <input
              type="text"
              name="nic"
              required
              value={formData.nic}
              onChange={handleChange}
              placeholder="e.g. 199512345678 or 951234567V"
              className="w-full px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm uppercase transition-all"
            />
          </div>

          {/* Mobile Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mobile Phone Number *</span>
            </label>
            <input
              type="tel"
              name="phone"
              required
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. 0771234567"
              className="w-full px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition-all"
            />
          </div>

          {/* Institution Arrival / Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Institution Arrival / Reference Number *</span>
            </label>
            <input
              type="text"
              name="institutionRef"
              required
              value={formData.institutionRef}
              onChange={handleChange}
              placeholder="e.g. DOE-REF-2026-0841"
              className="w-full px-4 py-2.5 bg-slate-800/70 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono transition-all"
            />
          </div>

          {/* Security & Free Badge */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-[11px] text-emerald-300">
              <strong className="font-semibold text-emerald-200">100% Free Admission:</strong> No payment required. An encrypted digital E-Ticket with verifiable QR code will be generated immediately.
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-2 py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Reserving Seats...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Issue My Free E-Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
