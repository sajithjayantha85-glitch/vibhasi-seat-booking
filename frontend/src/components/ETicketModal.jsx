import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import jsPDF from 'jspdf';
import {
  X,
  Download,
  Printer,
  Share2,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
  Ticket,
  ShieldCheck,
  Copy,
  Check,
  Send,
  Sparkles
} from 'lucide-react';

export default function ETicketModal({ ticketData, onClose }) {
  const [selectedPassIndex, setSelectedPassIndex] = useState(0);
  const [qrMap, setQrMap] = useState({}); // { [seatId]: dataUrl }
  const [copied, setCopied] = useState(false);
  const ticketCardRef = useRef(null);

  // Normalize seat passes list
  const seatPasses = React.useMemo(() => {
    if (!ticketData) return [];
    if (ticketData.seatTickets && ticketData.seatTickets.length > 0) {
      return ticketData.seatTickets;
    }
    const seats = ticketData.seats || [];
    return seats.map((sid, idx) => ({
      seatId: sid,
      seatIndex: idx + 1,
      totalSeats: seats.length,
      seatRef: `${ticketData.bookingRef}-${sid}`,
      ticketToken: ticketData.ticketToken
    }));
  }, [ticketData]);

  const currentPass = seatPasses[selectedPassIndex] || seatPasses[0] || {};
  const currentSeatId = currentPass.seatId || (ticketData?.seats && ticketData.seats[0]) || '';

  useEffect(() => {
    if (!ticketData || seatPasses.length === 0) return;

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Generate individual high resolution QR codes for all seat passes
    const generateAllQrs = async () => {
      const map = {};
      for (const pass of seatPasses) {
        const payload = pass.ticketToken || pass.seatRef || ticketData.bookingRef;
        try {
          const url = await QRCode.toDataURL(payload, {
            width: 400,
            margin: 2,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            },
            errorCorrectionLevel: 'M' // Optimized for lightning-fast camera scanning with larger high-contrast modules
          });
          map[pass.seatId] = url;
        } catch (e) {
          console.error(`QR gen error for ${pass.seatId}:`, e);
        }
      }
      setQrMap(map);
    };

    generateAllQrs();
  }, [ticketData, seatPasses]);

  if (!ticketData) return null;

  const handleCopyCode = () => {
    const code = currentPass.seatRef || `${ticketData.bookingRef}-${currentSeatId}`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = (pass) => {
    const seatId = pass.seatId;
    const nicNumber = pass.nic || ticketData.nic || 'N/A';
    const attnNumber = pass.institutionRef || ticketData.institutionRef || 'N/A';
    const text = encodeURIComponent(
      `🏛️ *"විභාසි" (Vibhasi) ප්‍රසංගය - ශ්‍රී ලංකා විභාග දෙපාර්තමේන්තු සුභසාධක සංගමය*\n\n` +
      `🎟️ *ආසන අංකය (Seat Number):* ${seatId}\n` +
      `👤 *නම (Attendee Name):* ${pass.fullName || ticketData.fullName}\n` +
      `🪪 *හැඳුනුම්පත් අංකය (ID / NIC):* ${nicNumber}\n` +
      `📋 *පැමිණීමේ අංකය (Attendance No):* ${attnNumber}\n` +
      `📍 *ස්ථානය (Venue):* සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය, බත්තරමුල්ල\n` +
      `📅 *දිනය & වේලාව:* 2026 ඔක්තෝබර් 05 සඳුදා (ප.ව. 05:00)\n` +
      `🔖 *Pass Reference:* ${pass.seatRef || `${ticketData.bookingRef}-${seatId}`}\n\n` +
      `කරුණාකර දොරටුවේදී මෙම විස්තර සහ QR කේතය ඉදිරිපත් කරන්න.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Helper to draw one seat ticket page in jsPDF
  const renderPdfPage = (doc, pass, index, total) => {
    // Background styling
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 148, 210, 'F');

    // Top banner
    doc.setFillColor(5, 150, 105); // emerald-600
    doc.rect(0, 0, 148, 28, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SUHURUPAYA 19TH FLOOR AUDITORIUM', 74, 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('DEPT. OF EXAMINATIONS WELFARE ASSOCIATION', 74, 17, { align: 'center' });
    doc.setFontSize(7.5);
    doc.text(`OFFICIAL CONCERT PASS • SEAT PASS ${index + 1} OF ${total}`, 74, 23, { align: 'center' });

    // Event Title Box
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(12, 33, 124, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text('"VIBHASI" CONCERT 2026', 74, 42, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text('Presented by Welfare Association, Dept. of Examinations', 74, 49, { align: 'center' });

    // Attendee & Seat Details Box
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(12, 59, 124, 55, 3, 3, 'F');

    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('ATTENDEE NAME:', 18, 69);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(ticketData.fullName || ''), 60, 69);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('ID NUMBER (NIC):', 18, 77);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(pass.nic || ticketData.nic || ''), 60, 77);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('ATTENDANCE NO (REF):', 18, 85);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11); // amber-400
    doc.text(String(pass.institutionRef || ticketData.institutionRef || ''), 60, 85);

    // Dedicated Single Seat Highlight
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(56, 189, 248);
    doc.text('ASSIGNED SEAT:', 18, 94);
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`SEAT ${pass.seatId}`, 60, 95);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('PASS REFERENCE:', 18, 104);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(pass.seatRef || `${ticketData.bookingRef}-${pass.seatId}`), 60, 104);

    // QR Code embedding for this exact seat
    const qrUrl = qrMap[pass.seatId];
    if (qrUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(44, 116, 60, 60, 3, 3, 'F');
      doc.addImage(qrUrl, 'PNG', 46, 118, 56, 56);

      // Explicit ID & Attendance caption under QR
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`ID: ${pass.nic || ticketData.nic}   |   ATTENDANCE: ${pass.institutionRef || ticketData.institutionRef}`, 74, 180, { align: 'center' });
    }

    // Security Notice
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(234, 179, 8); // yellow-500
    doc.text(`PASS VALID STRICTLY FOR SEAT: ${pass.seatId}`, 74, 186, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Valid for one-time gate scan. Independent entry permitted.', 74, 191, { align: 'center' });
    doc.text('මෙම QR කේතය අදාළ ආසනය සඳහා පමණක් වලංගු වන තනි ප්‍රවේශපත්‍රයකි.', 74, 196, { align: 'center' });
  };

  // Download All Passes into a multi-page PDF
  const handleDownloadAllPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });

      seatPasses.forEach((pass, idx) => {
        if (idx > 0) doc.addPage('a5', 'portrait');
        renderPdfPage(doc, pass, idx, seatPasses.length);
      });

      doc.save(`Vibhasi-Passes-${ticketData.bookingRef}.pdf`);
    } catch (err) {
      console.error('Failed to create PDF ticket:', err);
    }
  };

  // Download Current Seat Pass only
  const handleDownloadCurrentPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5'
      });
      renderPdfPage(doc, currentPass, selectedPassIndex, seatPasses.length);
      doc.save(`Vibhasi-Seat-${currentSeatId}-${ticketData.bookingRef}.pdf`);
    } catch (err) {
      console.error('Failed to create single PDF ticket:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Top Control Bar */}
        <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="font-bold text-sm text-slate-200 block">Reservation Confirmed!</span>
              <span className="text-[10px] text-emerald-400 block -mt-0.5">
                {seatPasses.length} Individual Seat Pass{seatPasses.length > 1 ? 'es' : ''} Issued
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seat Pass Switcher Tabs (When user booked more than 1 seat) */}
        {seatPasses.length > 1 && (
          <div className="bg-slate-950/90 px-4 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">Select Pass:</span>
            <div className="flex gap-1.5">
              {seatPasses.map((pass, idx) => (
                <button
                  key={pass.seatId}
                  onClick={() => setSelectedPassIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                    selectedPassIndex === idx
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Ticket className="w-3 h-3" />
                  <span>Seat {pass.seatId}</span>
                  <span className="text-[10px] opacity-75">({idx + 1}/{seatPasses.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Printable Ticket Card */}
        <div ref={ticketCardRef} className="p-6 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-700 relative">
            {/* Cutout notches */}
            <div className="absolute -left-9 -bottom-3.5 w-7 h-7 rounded-full bg-slate-950 border-r border-slate-700"></div>
            <div className="absolute -right-9 -bottom-3.5 w-7 h-7 rounded-full bg-slate-950 border-l border-slate-700"></div>

            <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[11px] font-semibold tracking-wider uppercase mb-1">
              Free Admission Pass • නිල ආසන ප්‍රවේශපත්‍රය
            </div>
            <p className="text-[11px] text-emerald-400 font-semibold mb-0.5">
              ශ්‍රී ලංකා විභාග දෙපාර්තමේන්තු සුභසාධක සංගමය ඉදිරිපත් කරන
            </p>
            <h3 className="text-xl font-black tracking-tight text-white">
              "විභාසි" (Vibhasi) ප්‍රසංගය
            </h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>බත්තරමුල්ල සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය</span>
            </p>
          </div>

          {/* Details Grid */}
          <div className="py-4 space-y-3 text-xs border-b border-slate-800">
            {/* Primary Verification Badge: ID NUMBER & ATTENDANCE NUMBER */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950/90 rounded-2xl border border-sky-500/30 shadow-inner">
              <div className="space-y-0.5">
                <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>හැඳුනුම්පත් අංකය (ID NO)</span>
                </span>
                <span className="font-mono font-black text-sm text-white tracking-wide block">
                  {currentPass.nic || ticketData.nic}
                </span>
              </div>
              <div className="space-y-0.5 border-l border-slate-800 pl-3">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                  <span>පැමිණීමේ අංකය (ATTENDANCE)</span>
                </span>
                <span className="font-mono font-black text-sm text-amber-300 tracking-wide block">
                  {currentPass.institutionRef || ticketData.institutionRef}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Attendee Name (නම)</span>
                <span className="font-bold text-slate-100 text-sm truncate block">{currentPass.fullName || ticketData.fullName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Date & Time</span>
                <span className="font-medium text-slate-200 block">05 Oct 2026 (සඳුදා) • 05:00 PM</span>
              </div>
            </div>

            {/* Dedicated Single Seat Highlight */}
            <div className="p-3 bg-slate-950/90 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  මෙම ප්‍රවේශපත්‍රයේ ආසනය (This Seat Pass)
                </span>
                <div className="text-lg font-mono font-black text-emerald-400 flex items-center gap-1.5 mt-0.5">
                  <Ticket className="w-5 h-5 text-emerald-400" />
                  <span>SEAT {currentSeatId}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Pass Sequence</span>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {selectedPassIndex + 1} of {seatPasses.length}
                </span>
              </div>
            </div>
          </div>

          {/* Individual QR Code Section */}
          <div className="pt-4 flex flex-col items-center text-center">
            <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-emerald-500/50 mb-2 relative">
              {qrMap[currentSeatId] ? (
                <img
                  src={qrMap[currentSeatId]}
                  alt={`E-Ticket QR for Seat ${currentSeatId}`}
                  className="w-48 h-48 rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-slate-500 text-xs font-mono">
                  Generating QR for Seat {currentSeatId}...
                </div>
              )}

              {/* Little seat tag badge on the QR box */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900 border border-emerald-500 text-emerald-400 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold shadow-md">
                SEAT {currentSeatId}
              </div>
            </div>

            {/* Clear ID & Attendance Number subtitle banner right under QR */}
            <div className="mt-2 text-center text-[11px] font-mono bg-slate-950/90 px-3 py-1 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-center gap-2">
              <span>ID: <strong className="text-white">{currentPass.nic || ticketData.nic}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Attn: <strong className="text-amber-400">{currentPass.institutionRef || ticketData.institutionRef}</strong></span>
            </div>

            {/* Pass Reference Code */}
            <div className="flex items-center gap-2 mb-2 mt-1">
              <span className="text-xs text-slate-400 font-mono">Pass Code:</span>
              <span className="font-mono font-bold text-xs text-sky-400 bg-sky-950/60 px-2.5 py-0.5 rounded border border-sky-800/60">
                {currentPass.seatRef || `${ticketData.bookingRef}-${currentSeatId}`}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                title="Copy Pass Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* WhatsApp Share Button */}
            <button
              onClick={() => handleShareWhatsApp(currentPass)}
              className="mt-1 py-1.5 px-3.5 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3 h-3 text-emerald-400" />
              <span>Seat {currentSeatId} ප්‍රවේශපත්‍රය මිතුරාට WhatsApp කරන්න</span>
            </button>

            <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed mt-2.5">
              මෙම එක් එක් QR කේතය අදාළ ආසනය සඳහා පමණක් වෙන වෙනම වලංගු වේ. මිතුරන් වෙනස් වේලාවන්හිදී පැමිණියද ස්වාධීනව ඇතුල් විය හැක.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
          {seatPasses.length > 1 ? (
            <>
              <button
                onClick={handleDownloadAllPdf}
                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download All Passes ({seatPasses.length} Pages PDF)</span>
              </button>

              <button
                onClick={handleDownloadCurrentPdf}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Seat {currentSeatId} PDF</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleDownloadCurrentPdf}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download E-Pass (PDF)</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
