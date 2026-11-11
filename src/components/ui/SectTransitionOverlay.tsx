import React, { useEffect, useState } from 'react';
import {
  sectTransitionManager,
  TransitionState,
} from '../../systems/SectTransitionManager';

export function SectTransitionOverlay() {
  const [trans, setTrans] = useState<TransitionState>(() =>
    sectTransitionManager.getState()
  );

  useEffect(() => {
    return sectTransitionManager.subscribe(setTrans);
  }, []);

  if (!trans.isTransitioning) {
    return null;
  }

  const { style, phase, progress, title, subtitle, runesFocalText } = trans;

  // Phase breakdown calculations for smooth interpolated CSS transforms
  // Phase 1 (0.00 - 0.22): Initiating — ambient gathering, backdrop fades in (0 -> 1)
  // Phase 2 (0.22 - 0.72): Portal opens, runes spin faster, vortex reaches peak coverage
  // Phase 3 (0.72 - 1.00): Revealing target scene, portal expands to edge and fades out
  const isReduced = sectTransitionManager.prefersReducedMotion();

  // Opacity of overall dark veil: ramps up fast to 0.95, holds at midpoint, fades out at end
  let veilOpacity = 1;
  if (progress < 0.25) {
    veilOpacity = Math.min(1, progress / 0.2);
  } else if (progress > 0.75) {
    veilOpacity = Math.max(0, 1 - (progress - 0.75) / 0.25);
  }

  // Scale of central sigil / portal:
  // Starts small (0.4), expands to 1.15 at midpoint, then expands outward (2.8) to reveal scene
  let portalScale = 1;
  let portalOpacity = 1;
  let portalRotationDeg = progress * 360;

  if (progress < 0.25) {
    portalScale = 0.45 + (progress / 0.25) * 0.55;
    portalOpacity = progress / 0.25;
  } else if (progress < 0.72) {
    const pMid = (progress - 0.25) / 0.47;
    portalScale = 1.0 + pMid * 0.25;
    portalOpacity = 1;
    portalRotationDeg = 90 + pMid * 270;
  } else {
    const pEnd = (progress - 0.72) / 0.28;
    portalScale = 1.25 + pEnd * 1.8;
    portalOpacity = Math.max(0, 1 - pEnd * 1.2);
    portalRotationDeg = 360 + pEnd * 120;
  }

  return (
    <div
      data-testid="sect-transition-overlay"
      className="absolute inset-0 z-50 pointer-events-auto select-none overflow-hidden flex flex-col items-center justify-center"
      style={{
        backgroundColor: `rgba(4, 2, 8, ${veilOpacity * 0.92})`,
        transition: isReduced ? 'opacity 0.2s ease' : undefined,
      }}
    >
      {/* ====================================================================
          STYLE 1: MA TRẬN KHÔNG GIAN (CONCENTRIC ROTATING DEMONIC SIGIL)
         ==================================================================== */}
      {style === 'ma_tran_khong_gian' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: isReduced ? 'none' : `scale(${portalScale})`,
            opacity: portalOpacity,
            transition: 'transform 0.08s linear',
          }}
        >
          {/* Radial Demonic Light Aura */}
          <div
            className="absolute w-[360px] h-[360px] rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, rgba(168,85,247,0.55) 0%, rgba(220,38,38,0.45) 45%, rgba(185,28,28,0.15) 70%, transparent 100%)',
            }}
          />

          {/* SVG Complex Demonic Magic Circle */}
          <svg
            className="w-[320px] h-[320px] drop-shadow-[0_0_25px_rgba(220,38,38,0.75)]"
            viewBox="0 0 400 400"
            style={{
              transform: isReduced ? 'none' : `rotate(${portalRotationDeg}deg)`,
            }}
          >
            <defs>
              <linearGradient id="portalGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#9333ea" />
              </linearGradient>
              <linearGradient id="portalGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="70%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <radialGradient id="portalEye">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="35%" stopColor="#dc2626" />
                <stop offset="75%" stopColor="#581c87" />
                <stop offset="100%" stopColor="#0f051d" />
              </radialGradient>
            </defs>

            {/* Concentric Outer Rune Rings */}
            <circle
              cx="200"
              cy="200"
              r="185"
              fill="none"
              stroke="url(#portalGrad1)"
              strokeWidth="2.5"
              strokeDasharray="14 6 4 6"
            />
            <circle
              cx="200"
              cy="200"
              r="170"
              fill="none"
              stroke="url(#portalGrad2)"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
            <circle
              cx="200"
              cy="200"
              r="150"
              fill="none"
              stroke="url(#portalGrad1)"
              strokeWidth="2"
              strokeDasharray="6 8"
            />

            {/* Sacred Demonic Geometry: Overlapping Rotated Squares (Octagram) */}
            <rect
              x="90"
              y="90"
              width="220"
              height="220"
              fill="none"
              stroke="url(#portalGrad2)"
              strokeWidth="1.8"
              strokeOpacity="0.85"
            />
            <rect
              x="90"
              y="90"
              width="220"
              height="220"
              fill="none"
              stroke="url(#portalGrad1)"
              strokeWidth="1.8"
              strokeOpacity="0.85"
              transform="rotate(45 200 200)"
            />

            {/* Inner Hexagram Rings */}
            <circle
              cx="200"
              cy="200"
              r="105"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            <polygon
              points="200,95 290,250 110,250"
              fill="none"
              stroke="url(#portalGrad2)"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />
            <polygon
              points="200,305 290,150 110,150"
              fill="none"
              stroke="url(#portalGrad1)"
              strokeWidth="1.5"
              strokeOpacity="0.75"
            />

            {/* Central Portal Eye Aperture */}
            <circle
              cx="200"
              cy="200"
              r="60"
              fill="url(#portalEye)"
              stroke="#fef08a"
              strokeWidth="3"
            />

            {/* Arcane Sigil Characters on Outer Perimeter */}
            {['乾', '坎', '艮', '震', '巽', '離', '坤', '兌'].map((rune, idx) => {
              const angle = (idx * 45 * Math.PI) / 180;
              const rx = 200 + Math.cos(angle) * 160;
              const ry = 200 + Math.sin(angle) * 160;
              return (
                <text
                  key={idx}
                  x={rx}
                  y={ry}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fbbf24"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="Cinzel, serif"
                >
                  {rune}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      {/* ====================================================================
          STYLE 2: MA KHÍ CUỒNG PHONG (SWIRLING DARK MIASMA TORNADO)
         ==================================================================== */}
      {style === 'ma_khi_cuong_phong' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: portalOpacity,
          }}
        >
          {/* Left Demonic Cloud Bank */}
          <div
            className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-red-950 via-purple-950 to-transparent"
            style={{
              transform: isReduced
                ? 'none'
                : `translateX(${progress < 0.5 ? (progress / 0.5) * 20 : 20 + ((progress - 0.5) / 0.5) * -120}%)`,
              opacity: progress < 0.6 ? 0.9 : Math.max(0, 1 - (progress - 0.6) / 0.4),
              filter: 'blur(12px)',
            }}
          />

          {/* Right Demonic Cloud Bank */}
          <div
            className="absolute top-0 bottom-0 right-0 w-1/2 bg-gradient-to-l from-red-950 via-purple-950 to-transparent"
            style={{
              transform: isReduced
                ? 'none'
                : `translateX(${progress < 0.5 ? -(progress / 0.5) * 20 : -20 + ((progress - 0.5) / 0.5) * 120}%)`,
              opacity: progress < 0.6 ? 0.9 : Math.max(0, 1 - (progress - 0.6) / 0.4),
              filter: 'blur(12px)',
            }}
          />

          {/* Central Cyclone Core */}
          <div
            className="w-[280px] h-[280px] rounded-full border-4 border-dashed border-red-500 shadow-[0_0_50px_rgba(168,85,247,0.85)] flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle, rgba(220,38,38,0.65) 0%, rgba(88,28,135,0.7) 50%, transparent 80%)',
              transform: isReduced
                ? 'none'
                : `scale(${portalScale}) rotate(${progress * -480}deg)`,
            }}
          >
            <div className="w-[140px] h-[140px] rounded-full border-2 border-amber-300 animate-spin flex items-center justify-center bg-black/60">
              <span className="text-2xl">🌪️</span>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          STYLE 3: HUYẾT NGUYỆT (BLOOD MOON DIMENSIONAL RIFT)
         ==================================================================== */}
      {style === 'huyet_nguyet' && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: portalOpacity,
          }}
        >
          {/* Blood Moon Eclipse Sphere */}
          <div
            className="relative w-[260px] h-[260px] rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(220,38,38,0.9)]"
            style={{
              background:
                'radial-gradient(circle at 40% 40%, #ff4d4d 0%, #b91c1c 45%, #450a0a 80%, #000 100%)',
              transform: isReduced ? 'none' : `scale(${portalScale * 1.05})`,
              transition: 'transform 0.08s linear',
            }}
          >
            {/* Dark Lunar Corona */}
            <div
              className="absolute -inset-4 rounded-full border-2 border-red-500/60 blur-xs"
              style={{
                transform: `rotate(${progress * 180}deg)`,
              }}
            />
            <div
              className="absolute -inset-8 rounded-full border border-amber-400/40 blur-sm"
              style={{
                transform: `rotate(${progress * -120}deg)`,
              }}
            />

            {/* Silhouette of Demonic Crest / Runes */}
            <div className="text-amber-300/80 text-3xl font-bold font-['Cinzel'] tracking-widest drop-shadow-[0_0_12px_rgba(254,240,138,0.8)]">
              🜂 🩸 🜂
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          CINEMATIC BANNER CARD & RUNES TITLE (TIÊN HIỆP – MA ĐẠO)
         ==================================================================== */}
      <div
        className="relative z-10 px-4 py-3 rounded-2xl border-2 border-amber-500/70 text-center max-w-[88%] shadow-[0_0_30px_rgba(220,38,38,0.5)] flex flex-col items-center gap-1.5"
        style={{
          backgroundColor: 'rgba(12, 6, 20, 0.88)',
          backdropFilter: 'blur(8px)',
          transform: isReduced
            ? 'none'
            : `translateY(${progress < 0.2 ? (1 - progress / 0.2) * 16 : progress > 0.8 ? (progress - 0.8) / 0.2 * -16 : 0}px)`,
          opacity: Math.min(1, Math.min(progress / 0.18, (1 - progress) / 0.18)),
          transition: 'transform 0.12s ease-out, opacity 0.12s ease-out',
        }}
      >
        {/* Runes Focal Line */}
        <div className="text-[11px] font-bold tracking-widest text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
          {runesFocalText || '🐉 🜂 MA GIÁO QUANG MINH ĐỈNH 🜂 🐉'}
        </div>

        {/* Grand Title */}
        <div className="text-sm sm:text-base font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-red-400 to-purple-300 uppercase font-['Cinzel'] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          {title}
        </div>

        {/* Subtitle / Lore Advice */}
        {subtitle && (
          <div className="text-[10px] text-stone-300 font-medium tracking-wide">
            {subtitle}
          </div>
        )}

        {/* Phase Indicator Dots */}
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              phase === 'initiating' ? 'bg-amber-400 scale-125' : 'bg-stone-700'
            }`}
          />
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              phase === 'portal_open' ? 'bg-red-500 scale-125 shadow-[0_0_8px_#ef4444]' : 'bg-stone-700'
            }`}
          />
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              phase === 'revealing' ? 'bg-emerald-400 scale-125' : 'bg-stone-700'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
