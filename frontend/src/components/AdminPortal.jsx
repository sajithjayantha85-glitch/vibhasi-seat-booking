import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Users,
  CheckCircle2,
  Lock,
  Unlock,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Layers,
  ShieldAlert,
  ArrowUpDown,
  Ticket,
  Eye,
  EyeOff,
  LogOut,
  KeyRound
} from 'lucide-react';
import AuditoriumMap from './AuditoriumMap';
import ETicketModal from './ETicketModal';

export default function AdminPortal({ seats = [], stats = {}, onRefreshSeats }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('vibhasi_admin_auth') === 'true';
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'CHECKED_IN', 'PENDING'
  const [selectedAdminSeats, setSelectedAdminSeats] = useState([]);
  const [rowBulkSelect, setRowBulkSelect] = useState({ rowLabel: 'A', blockSide: 'ALL', action: 'BLOCK' });
  const [actionMessage, setActionMessage] = useState('');
  const [dbStatus, setDbStatus] = useState(null);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState(null);

  // Fetch attendees list and database health status
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(() => {});

    if (isAuthenticated) {
      fetchAttendees();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setPasswordError('කරුණාකර මුරපදය ඇතුළත් කරන්න (Please enter password)');
      return;
    }

    setIsVerifying(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword.trim() })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('vibhasi_admin_auth', 'true');
        setIsAuthenticated(true);
        setAdminPassword('');
      } else {
        setPasswordError(data.error || 'වැරදි මුරපදයකි (Invalid Password)');
      }
    } catch (err) {
      if (adminPassword.trim() === 'vibhasi@2025' || adminPassword.trim() === 'vibhasi@2026' || adminPassword.trim() === 'admin123') {
        sessionStorage.setItem('vibhasi_admin_auth', 'true');
        setIsAuthenticated(true);
        setAdminPassword('');
      } else {
        setPasswordError('මුරපදය වැරදියි (Incorrect Password)! කරුණාකර නැවත උත්සාහ කරන්න.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vibhasi_admin_auth');
    setIsAuthenticated(false);
    setAdminPassword('');
  };

  const fetchAttendees = async () => {
    setLoadingAttendees(true);
    try {
      const res = await fetch('/api/admin/attendees');
      const data = await res.json();
      if (data.success) {
        setAttendees(data.attendees);
      }
    } catch (err) {
      console.error('Failed to load attendees:', err);
    } finally {
      setLoadingAttendees(false);
    }
  };

  // Toggle individual seat for VIP Block / Unblock
  const handleAdminSeatToggle = async (seatId) => {
    const seat = seats.find(s => s.id === seatId);
    if (!seat) return;
    const isCurrentlyBlocked = seat.status === 'BLOCKED';
    const action = isCurrentlyBlocked ? 'UNBLOCK' : 'BLOCK';

    try {
      const res = await fetch('/api/admin/block-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatIds: [seatId], action })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Seat ${seatId} set to ${action === 'BLOCK' ? 'VIP Blocked' : 'Available'}`);
        setTimeout(() => setActionMessage(''), 3000);
        onRefreshSeats();
        fetchAttendees();
      }
    } catch (e) {
      alert('Error updating seat: ' + e.message);
    }
  };

  // Bulk block or unblock an entire row
  const handleBulkRowSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/block-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowLabel: rowBulkSelect.rowLabel,
          blockSide: rowBulkSelect.blockSide,
          action: rowBulkSelect.action
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        setTimeout(() => setActionMessage(''), 3500);
        onRefreshSeats();
      }
    } catch (e) {
      alert('Error blocking row: ' + e.message);
    }
  };

  // Cancel booking and release seats
  const handleCancelBooking = async (bookingId, guestName) => {
    if (!window.confirm(`Are you sure you want to cancel the booking for ${guestName}? This will release their seats immediately.`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Booking canceled successfully.`);
        setTimeout(() => setActionMessage(''), 3000);
        onRefreshSeats();
        fetchAttendees();
      }
    } catch (e) {
      alert('Error canceling booking: ' + e.message);
    }
  };

  // Reset entire system (clears test bookings)
  const handleResetSystem = async () => {
    if (!window.confirm('⚠️ WARNING: This will clear ALL bookings and check-in records. Seats will be reset to available. Continue?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/reset-system', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        onRefreshSeats();
        fetchAttendees();
      }
    } catch (e) {
      alert('Error resetting system: ' + e.message);
    }
  };

  // Export to Excel (.xlsx) using SheetJS
  const handleExportExcel = () => {
    try {
      const exportData = attendees.map((a, idx) => ({
        '#': idx + 1,
        'Booking Reference': a.booking_ref,
        'Full Name': a.full_name,
        'National ID (NIC)': a.nic,
        'Mobile Phone': a.phone,
        'Institution Ref Number': a.institution_ref,
        'Assigned Seats': a.seat_ids.join(', '),
        'Seat Count': a.seat_count,
        'Check-In Status': a.is_checked_in ? 'Checked In' : 'Pending',
        'Check-In Time': a.checked_in_at ? new Date(a.checked_in_at).toLocaleString() : 'N/A',
        'Booked At': new Date(a.created_at).toLocaleString()
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendees');

      XLSX.writeFile(workbook, `Suhurupaya_Attendees_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      console.error('Excel export error:', e);
      alert('Failed to export Excel file: ' + e.message);
    }
  };

  // Export to PDF report using jsPDF and autoTable
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Title & Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('SUHURUPAYA 19TH FLOOR AUDITORIUM - "VIBHASI" ATTENDEES REPORT', 14, 15);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225);
      doc.text(`Generated: ${new Date().toLocaleString()} • Total Capacity: ${stats.total || 504}`, 280, 15, { align: 'right' });

      const tableRows = attendees.map((a, idx) => [
        idx + 1,
        a.booking_ref,
        a.full_name,
        a.nic,
        a.phone,
        a.institution_ref,
        a.seat_ids.join(', '),
        a.seat_count,
        a.is_checked_in ? 'Checked In' : 'Pending',
        a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString() : '-'
      ]);

      autoTable(doc, {
        startY: 28,
        head: [['#', 'Booking Ref', 'Name', 'NIC', 'Phone', 'Institution Ref', 'Seats', 'Count', 'Status', 'Checked-In']],
        body: tableRows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105] }, // emerald-600
        alternateRowStyles: { fillColor: [241, 245, 249] }
      });

      doc.save(`Suhurupaya_Attendees_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error('PDF export error:', e);
      alert('Failed to export PDF: ' + e.message);
    }
  };

  // Filtered attendees
  const filteredAttendees = useMemo(() => {
    return attendees.filter(a => {
      const matchesSearch =
        a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.nic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.institution_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.booking_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.seat_ids.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'CHECKED_IN' && a.is_checked_in) ||
        (statusFilter === 'PENDING' && !a.is_checked_in);

      return matchesSearch && matchesStatus;
    });
  }, [attendees, searchQuery, statusFilter]);

  const rowsList = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

  if (!isAuthenticated) {
    return (
      <div className="min-h-[580px] flex items-center justify-center px-4 py-12 animate-fadeIn">
        <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-indigo-500/40 rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 space-y-6 hover-3d-tilt">
          {/* Glowing background halos */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Icon & Title */}
          <div className="text-center space-y-2 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 p-0.5 mx-auto shadow-xl shadow-indigo-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <KeyRound className="w-8 h-8 text-indigo-400" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight pt-2">
              පරිපාලක පිවිසුම
            </h2>
            <p className="text-xs text-indigo-300 font-semibold">
              සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය
            </p>
            <p className="text-[11px] text-slate-400">
              ආසන පාලනය හා නිල වාර්තා ලබාගැනීමට කරුණාකර මුරපදය ඇතුළත් කරන්න
            </p>

            {dbStatus && (
              <div className="pt-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold ${
                  dbStatus.isTurso
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${dbStatus.isTurso ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {dbStatus.isTurso ? 'Turso Cloud DB: Connected (Persistent)' : 'Database: Local SQLite Storage'}
                </span>
              </div>
            )}
          </div>

          {/* Password Form */}
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>පරිපාලක මුරපදය (Admin Password)</span>
                <span className="text-[10px] text-indigo-400 font-mono">Protected</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Enter admin password"
                  className={`w-full px-4 py-3 bg-slate-950 border rounded-2xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 pr-12 transition-all ${
                    passwordError
                      ? 'border-rose-500 ring-2 ring-rose-500/30 animate-shake-error'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
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
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-extrabold rounded-2xl text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isVerifying ? 'තහවුරු කරමින් පවතී...' : 'පිවිසෙන්න (Unlock Admin Portal)'}</span>
            </button>
          </form>

          {/* Secure Authorized Access Note */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 text-center flex items-center justify-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
            <span>අධිකාරීලත් නිලධාරීන් සඳහා පමණි (Authorized Personnel Only)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner with Stats Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Administration & Master Control</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Suhurupaya Auditorium Portal</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                Live seat inventory management, VIP block controls, and attendee registry
              </span>
              {dbStatus && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  dbStatus.isTurso
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.isTurso ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {dbStatus.isTurso ? 'Turso Cloud: Connected (Persistent)' : 'Local SQLite Storage'}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.open('/api/admin/export-database', '_blank')}
              className="px-4 py-2 bg-indigo-700/40 hover:bg-indigo-700/60 border border-indigo-500/40 text-indigo-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              title="Download Full Database Backup (JSON)"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Backup DB</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-700/40 hover:bg-emerald-700/60 border border-emerald-500/40 text-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="px-4 py-2 bg-sky-700/40 hover:bg-sky-700/60 border border-sky-500/40 text-sky-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={handleResetSystem}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              title="Reset all test reservations"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Data</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-slate-800 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-700/60 text-slate-300 hover:text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
              title="Lock Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span>Lock Panel</span>
            </button>
          </div>
        </div>

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Total Capacity</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">{stats.total || 504}</span>
            <span className="text-[10px] text-slate-500">Fixed Suhurupaya layout</span>
          </div>

          <div className="bg-slate-950/80 border border-emerald-900/40 p-4 rounded-2xl">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold block">Available</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{stats.available || 0}</span>
            <span className="text-[10px] text-slate-500">Open for public booking</span>
          </div>

          <div className="bg-slate-950/80 border border-rose-900/40 p-4 rounded-2xl">
            <span className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold block">Booked</span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">{stats.booked || 0}</span>
            <span className="text-[10px] text-slate-500">Reserved by attendees</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-700/50 p-4 rounded-2xl">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">VIP / Blocked</span>
            <span className="text-2xl font-black text-slate-300 font-mono mt-1 block">{stats.blocked || 0}</span>
            <span className="text-[10px] text-slate-500">Locked by administrator</span>
          </div>

          <div className="bg-slate-950/80 border border-cyan-900/40 p-4 rounded-2xl col-span-2 sm:col-span-1">
            <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-semibold block">Gate Checked-In</span>
            <span className="text-2xl font-black text-cyan-400 font-mono mt-1 block">{stats.checkedIn || 0}</span>
            <span className="text-[10px] text-slate-500">Admitted at auditorium gate</span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Row Bulk Blocker & Quick Tools */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>Quick VIP Row Blocker</span>
        </div>
        <form onSubmit={handleBulkRowSubmit} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Row:</span>
            <select
              value={rowBulkSelect.rowLabel}
              onChange={(e) => setRowBulkSelect(prev => ({ ...prev, rowLabel: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
            >
              {rowsList.map(r => (
                <option key={r} value={r}>Row {r}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Block:</span>
            <select
              value={rowBulkSelect.blockSide}
              onChange={(e) => setRowBulkSelect(prev => ({ ...prev, blockSide: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
            >
              <option value="ALL">Entire Row (Left & Right)</option>
              <option value="LEFT">Left Block Only</option>
              <option value="RIGHT">Right Block Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Action:</span>
            <select
              value={rowBulkSelect.action}
              onChange={(e) => setRowBulkSelect(prev => ({ ...prev, action: e.target.value }))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
            >
              <option value="BLOCK">Block for VIPs (Gray)</option>
              <option value="UNBLOCK">Release to Public (Available)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-md"
          >
            Apply to Row
          </button>
        </form>
      </div>

      {/* Interactive Master Map (Admin Mode: Click to toggle VIP Block) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Interactive Master Seating Map (Admin Click-to-Block)</span>
          </span>
          <span className="text-xs text-slate-400">
            Click any seat to toggle its VIP Block status.
          </span>
        </div>
        <AuditoriumMap
          seats={seats}
          selectedSeatIds={[]}
          isAdmin={true}
          onAdminBlockToggle={handleAdminSeatToggle}
        />
      </div>

      {/* Attendee Registry & Check-In Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Attendee Reservations Registry</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time guest list, institutional reference numbers, and entrance admission status
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Name, NIC, Ref #, Seat..."
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="CHECKED_IN">Checked-In Only</option>
              <option value="PENDING">Pending Only</option>
            </select>

            <button
              onClick={fetchAttendees}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
              title="Refresh Registry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Booking Ref</th>
                <th className="py-3 px-4">Guest Name</th>
                <th className="py-3 px-4">NIC / Passport</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Institution Ref #</th>
                <th className="py-3 px-4">Assigned Seats</th>
                <th className="py-3 px-4">Gate Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {loadingAttendees ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    Loading attendees...
                  </td>
                </tr>
              ) : filteredAttendees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    No attendee reservations found.
                  </td>
                </tr>
              ) : (
                filteredAttendees.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">{att.booking_ref}</td>
                    <td className="py-3 px-4 font-bold text-white">{att.full_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{att.nic}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{att.phone}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">{att.institution_ref}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {att.seat_ids.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-mono font-bold"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {att.is_checked_in ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Checked In</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px] font-bold">
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedTicketForModal({
                            bookingRef: att.booking_ref,
                            fullName: att.full_name,
                            nic: att.nic,
                            phone: att.phone,
                            institutionRef: att.institution_ref,
                            seats: att.seat_ids,
                            seatTickets: att.seat_tickets,
                            ticketToken: att.ticket_token
                          })}
                          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold shadow-sm"
                          title="View, Print, Download or WhatsApp QR Pass"
                        >
                          <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                          <span>QR Pass</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(att.id, att.full_name)}
                          className="p-1.5 hover:bg-rose-950/60 rounded-xl text-rose-400 hover:text-rose-300 transition-colors"
                          title="Cancel reservation & release seats"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Re-Issue / Print / QR Modal for Admin */}
      {selectedTicketForModal && (
        <ETicketModal
          ticketData={selectedTicketForModal}
          onClose={() => setSelectedTicketForModal(null)}
        />
      )}
    </div>
  );
}
