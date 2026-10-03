import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Lock, User, Info, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function AuditoriumMap({
  seats = [],
  selectedSeatIds = [],
  onSeatClick,
  isAdmin = false,
  isLiveMonitor = false,
  recentSeatIds = [],
  onAdminBlockToggle,
  onAdminRowSelect,
  maxSeatLimitWarning,
  onProceedBooking
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  // Map seats into quick lookup map: id -> seat
  const seatMap = useMemo(() => {
    const map = new Map();
    for (const seat of seats) {
      map.set(seat.id, seat);
    }
    return map;
  }, [seats]);

  // Handle zoom
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.2, 2.4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.2, 0.6));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.seat-button') || e.target.closest('.control-button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers for mobile devices
  const touchStartRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      setPan({
        x: e.touches[0].clientX - touchStartRef.current.x,
        y: e.touches[0].clientY - touchStartRef.current.y
      });
    }
  };

  // Compute curved seat coordinates
  // Suhurupaya layout: 21 curved rows (A-H, J-T, U, V; 504 seats)
  const rowsConfig = useMemo(() => [
    // Upper Flared Section (Rows A - H)
    { rowLabel: 'A', rowIndex: 1, leftSeats: 11, rightSeats: 11 }, // 22
    { rowLabel: 'B', rowIndex: 2, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'C', rowIndex: 3, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'D', rowIndex: 4, leftSeats: 13, rightSeats: 13 }, // 26
    { rowLabel: 'E', rowIndex: 5, leftSeats: 13, rightSeats: 13 }, // 26
    { rowLabel: 'F', rowIndex: 6, leftSeats: 14, rightSeats: 14 }, // 28
    { rowLabel: 'G', rowIndex: 7, leftSeats: 14, rightSeats: 14 }, // 28
    { rowLabel: 'H', rowIndex: 8, leftSeats: 15, rightSeats: 15 }, // 30 (widest row)

    // Lower Main Section (Rows J - T: 12 seats each side)
    { rowLabel: 'J', rowIndex: 9, leftSeats: 12, rightSeats: 12 },  // 24
    { rowLabel: 'K', rowIndex: 10, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'L', rowIndex: 11, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'M', rowIndex: 12, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'N', rowIndex: 13, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'O', rowIndex: 14, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'P', rowIndex: 15, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'Q', rowIndex: 16, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'R', rowIndex: 17, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'S', rowIndex: 18, leftSeats: 12, rightSeats: 12 }, // 24
    { rowLabel: 'T', rowIndex: 19, leftSeats: 12, rightSeats: 12 }, // 24

    // Rear Section near Entrance (Rows U, V - Last Row)
    { rowLabel: 'U', rowIndex: 20, leftSeats: 10, rightSeats: 10 }, // 20
    { rowLabel: 'V', rowIndex: 21, leftSeats: 6, rightSeats: 6 },   // 12 (Last Row)
  ], []);

  // Center coordinate for SVG
  const svgWidth = 1150;
  const svgHeight = 1150;
  const stageCenterX = 575;
  const stageCenterY = -400; // Arc origin well above stage for gentle curve

  // Calculate seat position along arc
  const getSeatPosition = (rowIndex, block, seatNum, totalSeatsInBlock) => {
    const baseRadius = 600 + rowIndex * 28; // distance from origin to row
    const aisleGapAngle = 0.040; // angle of central aisle (gap in radians)
    const seatAngleSpan = 0.024; // angular distance between seats

    let angle;
    if (block === 'LEFT') {
      // Left block: seat 1 is closest to aisle, higher numbers go towards outer left wall
      angle = Math.PI / 2 + aisleGapAngle / 2 + (seatNum - 0.5) * seatAngleSpan;
    } else {
      // Right block: seat 1 is closest to aisle, higher numbers go towards outer right wall
      angle = Math.PI / 2 - aisleGapAngle / 2 - (seatNum - 0.5) * seatAngleSpan;
    }

    const x = stageCenterX + baseRadius * Math.cos(angle);
    const y = stageCenterY + baseRadius * Math.sin(angle);
    const rotationDeg = (angle * 180) / Math.PI - 90;

    return { x, y, rotationDeg };
  };

  const getSeatStatus = (seatId) => {
    if (selectedSeatIds.includes(seatId)) return 'SELECTED';
    const s = seatMap.get(seatId);
    if (!s) return 'AVAILABLE';
    if (s.status === 'BLOCKED') return 'BLOCKED';
    if (s.is_checked_in) return 'CHECKED_IN';
    return s.status; // 'AVAILABLE', 'BOOKED'
  };

  const handleSeatClickInternal = (seatId, e) => {
    e.stopPropagation();
    sounds.playSeatClick();
    const currentStatus = getSeatStatus(seatId);

    if (isLiveMonitor) {
      // In live monitor mode, clicking can set hovered seat to inspect
      const seatObj = seatMap.get(seatId);
      if (seatObj) {
        setHoveredSeat({
          id: seatId,
          row: seatObj.row_label,
          num: seatObj.seat_num,
          block: seatObj.block === 'LEFT' ? 'Left' : 'Right',
          status: currentStatus,
          guestName: seatObj.guest_name,
          institutionRef: seatObj.institution_ref,
          checkedInAt: seatObj.checked_in_at
        });
        setTooltipPos({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (isAdmin) {
      if (onAdminBlockToggle) onAdminBlockToggle(seatId);
      return;
    }

    if (currentStatus === 'BOOKED' || currentStatus === 'CHECKED_IN' || currentStatus === 'BLOCKED') {
      return; // disabled
    }

    // Toggle user selection
    if (selectedSeatIds.includes(seatId)) {
      onSeatClick(selectedSeatIds.filter((id) => id !== seatId));
    } else {
      if (selectedSeatIds.length >= 3) {
        if (maxSeatLimitWarning) maxSeatLimitWarning();
        return;
      }
      onSeatClick([...selectedSeatIds, seatId]);
    }
  };

  return (
    <div className="relative w-full h-[650px] sm:h-[750px] bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col select-none">
      {/* Floating Control Bar */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-lg text-slate-300">
        <button
          onClick={handleZoomIn}
          className="control-button p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-200 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="control-button p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-200 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetView}
          className="control-button p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-200 hover:text-white"
          title="Reset View"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono px-2 py-1 bg-slate-800 rounded text-slate-400">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Legend Header */}
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center gap-2.5 bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          <span className="text-slate-200">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50"></span>
          <span className="text-slate-200">Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          <span className="text-slate-200">Booked (Awaiting)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-sky-500 border border-sky-300 shadow-sm shadow-sky-500/50 flex items-center justify-center text-[9px] text-white font-bold">✓</span>
          <span className="text-sky-300 font-semibold">Checked In (ශාලාවේ)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-600 shadow-sm flex items-center justify-center text-[9px] text-white">
            <Lock className="w-2.5 h-2.5" />
          </span>
          <span className="text-slate-400">VIP / Blocked</span>
        </div>
      </div>

      {/* Interactive SVG Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className={`w-full flex-1 overflow-hidden cursor-${isDragging ? 'grabbing' : 'grab'} flex items-center justify-center p-4`}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full max-h-full transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
          }}
        >
          <defs>
            {/* Stage Wood Gradient */}
            <linearGradient id="stageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            {/* Stage Light Spotlight */}
            <radialGradient id="stageGlow" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid Accent */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          </pattern>
          <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

          {/* ======================================================== */}
          {/* AUDITORIUM WALLS & ARCHITECTURAL OUTLINE                 */}
          {/* ======================================================== */}
          <g className="auditorium-walls" stroke="#475569" strokeWidth="2.5" fill="none" opacity="0.6">
            {/* Flared upper section and stepped lower section */}
            <path d="
              M 90,180
              L 165,180
              L 190,230
              L 80,450
              L 140,465
              L 140,1050
              L 440,1065
              L 470,1095
              L 515,1095
            " />
            <path d="
              M 1060,180
              L 985,180
              L 960,230
              L 1070,450
              L 1010,465
              L 1010,1050
              L 710,1065
              L 680,1095
              L 635,1095
            " />
          </g>

          {/* ======================================================== */}
          {/* 1. STAGE (17m Width x 4m-6m Depth)                       */}
          {/* ======================================================== */}
          <g className="stage-area" transform="translate(0, 40)">
            {/* Stage Outer Wall / Shell */}
            <rect
              x="150"
              y="20"
              width="850"
              height="110"
              rx="8"
              fill="url(#stageGradient)"
              stroke="#475569"
              strokeWidth="2.5"
            />
            {/* Stage Glow highlight */}
            <rect x="150" y="20" width="850" height="110" fill="url(#stageGlow)" rx="8" />

            {/* Stage Floor Subtle Planks Accent */}
            <line x1="150" y1="55" x2="1000" y2="55" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="6 4" />
            <line x1="150" y1="90" x2="1000" y2="90" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="6 4" />

            {/* Curved Apron (front extending 4m-6m) */}
            <path
              d="M 230,130 Q 575,185 920,130 L 920,120 L 230,120 Z"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2"
            />

            {/* Stage Footlight LED Gems along the Apron */}
            <g className="stage-footlights" opacity="0.9">
              {[280, 340, 400, 460, 520, 575, 630, 690, 750, 810, 870].map((fx, i) => {
                const fy = 132 + Math.sin(((fx - 230) / (920 - 230)) * Math.PI) * 45;
                const colors = ['#f59e0b', '#38bdf8', '#10b981', '#f43f5e', '#38bdf8'];
                const c = colors[i % colors.length];
                return (
                  <circle
                    key={fx}
                    cx={fx}
                    cy={fy}
                    r="3.5"
                    fill={c}
                    filter="drop-shadow(0 0 4px rgba(56,189,248,0.8))"
                  />
                );
              })}
            </g>

            {/* Stage Side Stairs (Wings) */}
            {/* Left wing stairs */}
            <g stroke="#94a3b8" strokeWidth="1.5" fill="#0f172a">
              <rect x="180" y="90" width="45" height="35" rx="2" />
              <line x1="180" y1="102" x2="225" y2="102" />
              <line x1="180" y1="114" x2="225" y2="114" />
            </g>
            {/* Right wing stairs */}
            <g stroke="#94a3b8" strokeWidth="1.5" fill="#0f172a">
              <rect x="875" y="90" width="45" height="35" rx="2" />
              <line x1="875" y1="102" x2="920" y2="102" />
              <line x1="875" y1="114" x2="920" y2="114" />
            </g>

            {/* Stage Labels & Live Concert Marquee */}
            <rect x="430" y="52" width="290" height="46" rx="8" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <text
              x="575"
              y="73"
              textAnchor="middle"
              className="fill-cyan-400 font-black tracking-widest text-sm font-sans"
            >
              "විභාසි" සජීවී ප්‍රසංගය 2026
            </text>
            <text
              x="575"
              y="89"
              textAnchor="middle"
              className="fill-amber-300 font-extrabold tracking-wider text-[11px] font-mono"
            >
              LIVE CONCERT STAGE (17m × 4m-6m)
            </text>
            <text x="575" y="16" textAnchor="middle" className="fill-slate-400 text-xs font-mono font-bold">
              ◄── 17 m MAIN AUDITORIUM STAGE ──►
            </text>
          </g>

          {/* Block Section Headers */}
          <g className="section-labels" transform="translate(0, 230)">
            <text x="340" y="0" textAnchor="middle" className="fill-slate-400 font-semibold text-xs tracking-wider">
              LEFT BLOCK (වම් කොටස)
            </text>
            <text x="810" y="0" textAnchor="middle" className="fill-slate-400 font-semibold text-xs tracking-wider">
              RIGHT BLOCK (දකුණු කොටස)
            </text>
            {/* Central Aisle Guide Line */}
            <line
              x1="575"
              y1="10"
              x2="575"
              y2="1050"
              stroke="#334155"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.5"
            />
            <text
              x="575"
              y="600"
              textAnchor="middle"
              className="fill-slate-400 text-[10px] tracking-widest font-mono"
              transform="rotate(-90 575 600)"
            >
              CENTRAL AISLE
            </text>
          </g>

          {/* ======================================================== */}
          {/* 2. SEATS (CURVED ROWS CONCENTRIC WITH STAGE)             */}
          {/* ======================================================== */}
          <g className="seats-layer">
            {rowsConfig.map((row) => {
              // Row Label buttons (left side & right side)
              const leftPos = getSeatPosition(row.rowIndex, 'LEFT', row.leftSeats, row.leftSeats);
              const rightPos = getSeatPosition(row.rowIndex, 'RIGHT', row.rightSeats, row.rightSeats);

              return (
                <g key={`row-${row.rowLabel}`} className="row-group">
                  {/* Row Indicator Badge Left */}
                  <g
                    transform={`translate(${leftPos.x - 30}, ${leftPos.y})`}
                    className="cursor-pointer"
                    onClick={() => isAdmin && onAdminRowSelect && onAdminRowSelect(row.rowLabel, 'LEFT')}
                  >
                    <rect
                      x="-14"
                      y="-10"
                      width="28"
                      height="20"
                      rx="4"
                      fill={isAdmin ? '#1e293b' : 'transparent'}
                      stroke={isAdmin ? '#38bdf8' : '#475569'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      className={`text-[11px] font-bold ${isAdmin ? 'fill-sky-400 hover:fill-sky-300' : 'fill-slate-400'}`}
                    >
                      {row.rowLabel}
                    </text>
                  </g>

                  {/* Row Indicator Badge Right */}
                  <g
                    transform={`translate(${rightPos.x + 30}, ${rightPos.y})`}
                    className="cursor-pointer"
                    onClick={() => isAdmin && onAdminRowSelect && onAdminRowSelect(row.rowLabel, 'RIGHT')}
                  >
                    <rect
                      x="-14"
                      y="-10"
                      width="28"
                      height="20"
                      rx="4"
                      fill={isAdmin ? '#1e293b' : 'transparent'}
                      stroke={isAdmin ? '#38bdf8' : '#475569'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      className={`text-[11px] font-bold ${isAdmin ? 'fill-sky-400 hover:fill-sky-300' : 'fill-slate-400'}`}
                    >
                      {row.rowLabel}
                    </text>
                  </g>

                  {/* Left Block Seats */}
                  {Array.from({ length: row.leftSeats }, (_, i) => i + 1).map((seatNum) => {
                    const seatId = `${row.rowLabel}-L${seatNum}`;
                    const pos = getSeatPosition(row.rowIndex, 'LEFT', seatNum, row.leftSeats);
                    const status = getSeatStatus(seatId);
                    const seatObj = seatMap.get(seatId);
                    const isRecent = recentSeatIds.includes(seatId);

                    return (
                      <SeatIcon
                        key={seatId}
                        seatId={seatId}
                        rowLabel={row.rowLabel}
                        seatNum={seatNum}
                        block="Left"
                        pos={pos}
                        status={status}
                        isAdmin={isAdmin}
                        isRecent={isRecent}
                        onClick={(e) => handleSeatClickInternal(seatId, e)}
                        onMouseEnter={(e) => {
                          setHoveredSeat({
                            id: seatId,
                            row: row.rowLabel,
                            num: seatNum,
                            block: 'Left',
                            status,
                            guestName: seatObj?.guest_name,
                            institutionRef: seatObj?.institution_ref,
                            checkedInAt: seatObj?.checked_in_at
                          });
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredSeat(null)}
                      />
                    );
                  })}

                  {/* Right Block Seats */}
                  {Array.from({ length: row.rightSeats }, (_, i) => i + 1).map((seatNum) => {
                    const seatId = `${row.rowLabel}-R${seatNum}`;
                    const pos = getSeatPosition(row.rowIndex, 'RIGHT', seatNum, row.rightSeats);
                    const status = getSeatStatus(seatId);
                    const seatObj = seatMap.get(seatId);
                    const isRecent = recentSeatIds.includes(seatId);

                    return (
                      <SeatIcon
                        key={seatId}
                        seatId={seatId}
                        rowLabel={row.rowLabel}
                        seatNum={seatNum}
                        block="Right"
                        pos={pos}
                        status={status}
                        isAdmin={isAdmin}
                        isRecent={isRecent}
                        onClick={(e) => handleSeatClickInternal(seatId, e)}
                        onMouseEnter={(e) => {
                          setHoveredSeat({
                            id: seatId,
                            row: row.rowLabel,
                            num: seatNum,
                            block: 'Right',
                            status,
                            guestName: seatObj?.guest_name,
                            institutionRef: seatObj?.institution_ref,
                            checkedInAt: seatObj?.checked_in_at
                          });
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredSeat(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* ======================================================== */}
          {/* 3. ENTRANCE & DOORS AT BOTTOM                            */}
          {/* ======================================================== */}
          <g className="entrance-area" transform="translate(575, 1120)">
            {/* Entrance doors symbol */}
            <path d="M -50,-15 L -20,-15 L -5,10" stroke="#94a3b8" strokeWidth="2" fill="none" />
            <path d="M 50,-15 L 20,-15 L 5,10" stroke="#94a3b8" strokeWidth="2" fill="none" />
            {/* Arrow into hall */}
            <line x1="0" y1="35" x2="0" y2="5" stroke="#38bdf8" strokeWidth="3" markerEnd="url(#arrow)" />
            <polygon points="0,-2 -7,10 7,10" fill="#38bdf8" />
            <rect
              x="-65"
              y="40"
              width="130"
              height="30"
              rx="6"
              fill="#0f172a"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="60"
              textAnchor="middle"
              className="fill-slate-300 font-bold text-xs tracking-widest font-mono"
            >
              ENTRANCE
            </text>
          </g>
        </svg>
      </div>

      {/* Floating Tooltip */}
      {hoveredSeat && (
        <div
          className="fixed pointer-events-none z-50 bg-slate-900/95 border border-slate-700 text-slate-100 text-xs px-3.5 py-2.5 rounded-xl shadow-2xl -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-bold text-white flex items-center gap-1.5">
            <span>Row {hoveredSeat.row}</span>
            <span>•</span>
            <span>Seat {hoveredSeat.block} {hoveredSeat.num}</span>
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1">
            Status:
            <span
              className={`font-semibold ${
                hoveredSeat.status === 'AVAILABLE'
                  ? 'text-emerald-400'
                  : hoveredSeat.status === 'SELECTED'
                  ? 'text-amber-400'
                  : hoveredSeat.status === 'CHECKED_IN'
                  ? 'text-sky-400 font-bold'
                  : hoveredSeat.status === 'BOOKED'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {hoveredSeat.status === 'CHECKED_IN'
                ? 'Checked In (ශාලාවේ අසුන්ගෙන ඇත)'
                : hoveredSeat.status === 'BOOKED'
                ? 'Reserved (පැමිණීමට නියමිතයි)'
                : hoveredSeat.status}
            </span>
          </div>

          {hoveredSeat.guestName && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] space-y-0.5">
              <div className="text-slate-200">
                <span className="text-slate-400">Guest:</span> <strong>{hoveredSeat.guestName}</strong>
              </div>
              {hoveredSeat.institutionRef && (
                <div className="text-amber-400 font-mono">
                  <span className="text-slate-400">Ref:</span> {hoveredSeat.institutionRef}
                </div>
              )}
              {hoveredSeat.checkedInAt && (
                <div className="text-slate-400">
                  <span className="text-slate-500">Admitted:</span> {new Date(hoveredSeat.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Info & Instructions */}
      <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {isLiveMonitor
              ? 'සජීවී ශාලා පිරීයාම් නිරීක්ෂකය: QR කේතය ස්කෑන් කර ඇතුල්වන විට අදාළ ආසන නිල් පැහැයෙන් දැල්වේ.'
              : isAdmin
              ? 'Admin Mode: Click any seat to toggle VIP Block/Unblock, or click row letters (A-DD).'
              : selectedSeatIds.length > 0
              ? 'Seats selected! Click the button to the right to complete reservation.'
              : 'Click any available green seat to select. Maximum 3 seats per booking.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-mono text-slate-300">
            Selected: <strong className="text-amber-400 font-bold">{selectedSeatIds.length}</strong> / 3
          </div>

          {!isAdmin && !isLiveMonitor && selectedSeatIds.length > 0 && onProceedBooking && (
            <button
              onClick={onProceedBooking}
              className="py-1.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 transition-all animate-pulse transform active:scale-95"
            >
              <span>ඉදිරියට යන්න (Book Now)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Seat SVG Component with interactive states
 */
function SeatIcon({ seatId, rowLabel, seatNum, block, pos, status, isAdmin, isRecent, onClick, onMouseEnter, onMouseLeave }) {
  // Styles based on status
  let fillColor = '#10b981'; // AVAILABLE (emerald-500)
  let strokeColor = '#059669';
  let cursorClass = 'cursor-pointer hover:opacity-80';

  if (status === 'SELECTED') {
    fillColor = '#f59e0b'; // amber-500
    strokeColor = '#d97706';
  } else if (status === 'CHECKED_IN') {
    fillColor = '#0284c7'; // sky-600 / electric blue (occupied inside hall)
    strokeColor = '#38bdf8';
    cursorClass = 'cursor-pointer hover:opacity-90';
  } else if (status === 'BOOKED') {
    fillColor = '#f43f5e'; // rose-500 (reserved, awaiting arrival)
    strokeColor = '#be123c';
    cursorClass = isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-75';
  } else if (status === 'BLOCKED') {
    fillColor = '#475569'; // slate-600
    strokeColor = '#334155';
    cursorClass = isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60';
  }

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rotationDeg})`}
      className={`seat-button ${cursorClass} ${isRecent ? 'animate-pulse' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Ripple ring for recently checked in seat */}
      {isRecent && (
        <circle cx="0" cy="-2" r="14" fill="none" stroke="#38bdf8" strokeWidth="2.5" opacity="0.8" className="animate-ping" />
      )}

      {/* Seat Backrest */}
      <rect
        x="-10"
        y="-11"
        width="20"
        height="18"
        rx="4"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={status === 'CHECKED_IN' ? '1.8' : '1.2'}
        className="transition-all duration-300"
      />
      {/* Seat Cushion */}
      <rect
        x="-8"
        y="-2"
        width="16"
        height="10"
        rx="2"
        fill={fillColor}
        opacity="0.85"
      />

      {/* Seat Indicator mark */}
      {status === 'BLOCKED' ? (
        <circle cx="0" cy="-2" r="2.5" fill="#ffffff" opacity="0.8" />
      ) : status === 'SELECTED' ? (
        <circle cx="0" cy="-2" r="3" fill="#ffffff" />
      ) : status === 'CHECKED_IN' ? (
        <circle cx="0" cy="-2" r="2.8" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
      ) : (
        <text
          x="0"
          y="1"
          textAnchor="middle"
          className="fill-slate-900 font-bold text-[7.5px] pointer-events-none select-none font-mono"
        >
          {seatNum}
        </text>
      )}
    </g>
  );
}
