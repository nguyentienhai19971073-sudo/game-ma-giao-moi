import React, { useMemo } from 'react';
import { ActiveSceneType, MiniGamePreCountdownState, ReturnToHallCountdownState } from '../../types/magiao';
import { sectGameManager } from '../../systems/SectGameManager';

interface MiniGameCountdownOverlayProps {
  countdown?: MiniGamePreCountdownState;
  returnCountdown?: ReturnToHallCountdownState;
  activeScene?: ActiveSceneType;
  isOBSMode?: boolean;
}

export const MiniGameCountdownOverlay: React.FC<MiniGameCountdownOverlayProps> = ({
  countdown,
  returnCountdown,
  activeScene = 'main_hall',
  isOBSMode = false,
}) => {
  const isEntering = Boolean(countdown && countdown.isActive && activeScene === 'main_hall');
  const isReturning = Boolean(returnCountdown && returnCountdown.isActive);

  // If neither countdown is active, do not render
  if (!isEntering && !isReturning) {
    return null;
  }

  const isReturnMode = isReturning;
  const currentCount = isReturnMode ? (returnCountdown?.count ?? 3) : (countdown?.count ?? 3);

  // Visual decorations
  const visuals = useMemo(() => {
    if (isReturnMode) {
      return {
        badge: 'HỒI QUY ĐẠI ĐIỆN',
        title: returnCountdown?.title || 'SẮP TRỞ VỀ ĐẠI SẢNH',
        subtitle: returnCountdown?.subtitle || 'Hành trình Ma Đạo tiếp tục...',
        runes: '☯ 🜂 歸 大 殿 🜂 ☯',
        actionHint: 'Vận chuyển ma công, toàn thể đệ tử hồi quy chính điện!',
        keywords: [] as string[],
      };
    }

    const gameId = countdown?.gameId;
    let hint = 'Tập trung khí hải, sẵn sàng tham chiến!';
    let runes = '🐉 🜂 龍 魔 🜂 🐉';

    if (gameId === 'ma_quyen_loan_vu') {
      runes = '⚡ 🜂 拳 亂 武 🜂 ⚡';
      hint = 'Bình luận từ khóa MÚA để thi triển Ma Quyền!';
    } else if (gameId === 'ma_anh_than_phap') {
      runes = '☯ 🜏 影 身 法 🜏 ☯';
      hint = 'Quan sát chướng ngại vật: TRAI / PHAI / NHAY!';
    } else if (gameId === 'tam_khi_ma_tran') {
      runes = '🔥 ❄️ 氣 魔 陣 ❄️ 🌪️';
      hint = 'Khắc chế nguyên tố: LỬA – BĂNG – GIÓ!';
    }

    return {
      badge: 'MINIGAME SẮP BẮT ĐẦU',
      title: countdown?.gameName || 'Luyện Võ Ma Giáo',
      subtitle: countdown?.gameSubtitle || 'Toàn bộ đệ tử chuẩn bị vào sân thi thố!',
      runes,
      actionHint: hint,
      keywords: countdown?.keywords || [],
    };
  }, [isReturnMode, returnCountdown?.title, returnCountdown?.subtitle, countdown?.gameId, countdown?.gameName, countdown?.gameSubtitle, countdown?.keywords]);

  return (
    <div
      data-testid={isReturnMode ? 'minigame-return-countdown-overlay' : 'minigame-pre-countdown-overlay'}
      className="absolute inset-0 z-45 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-[2.5px] transition-all duration-300 pointer-events-auto select-none"
    >
      {/* Background Demonic Ambient Mist & Swirling Dark Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.18)_0%,rgba(220,38,38,0.15)_40%,transparent_70%)] animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* Main Demonic Notification Card */}
      <div className="relative w-full max-w-[390px] sm:max-w-[430px] rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-[#1b081e]/98 via-[#0d0413]/98 to-[#170512]/98 p-4 sm:p-5 text-center shadow-[0_0_60px_rgba(220,38,38,0.5),inset_0_0_25px_rgba(147,51,234,0.35)] overflow-hidden transition-transform duration-300">
        {/* Ornate Corner Accents */}
        <div className="absolute top-1 left-2 text-xs text-amber-400/60 font-serif select-none pointer-events-none">
          🜂 ☯
        </div>
        <div className="absolute top-1 right-2 text-xs text-amber-400/60 font-serif select-none pointer-events-none">
          ☯ 🜂
        </div>
        <div className="absolute bottom-1 left-2 text-xs text-amber-400/60 font-serif select-none pointer-events-none">
          🜏 ⚡
        </div>
        <div className="absolute bottom-1 right-2 text-xs text-amber-400/60 font-serif select-none pointer-events-none">
          ⚡ 🜏
        </div>

        {/* Ambient Top Glow Bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/40 bg-purple-950/60 shadow-[0_0_15px_rgba(147,51,234,0.4)] mb-2">
          <span className="text-amber-400 text-xs">✦</span>
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-amber-200">
            {visuals.badge}
          </span>
          <span className="text-amber-400 text-xs">✦</span>
        </div>

        {/* Ancient Runes focal ribbon */}
        <div className="text-[11px] sm:text-xs text-red-400/80 tracking-[0.25em] font-serif mb-1 select-none">
          {visuals.runes}
        </div>

        {/* Exact Title (Minigame Name or SẮP TRỞ VỀ ĐẠI SẢNH) */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-cinzel tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 drop-shadow-[0_2px_12px_rgba(234,179,8,0.7)] uppercase mb-1">
          {visuals.title}
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-amber-100/75 italic font-serif mb-3 line-clamp-1">
          {visuals.subtitle}
        </p>

        {/* Central Talisman & Large Countdown Display (3 -> 2 -> 1) */}
        <div className="relative my-3 sm:my-4 flex flex-col items-center justify-center">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
            {/* Spinning decorative ring */}
            <div className="absolute inset-0 rounded-full border border-amber-500/30 border-dashed animate-spin [animation-duration:22s] pointer-events-none" />

            {/* Glowing magic circle backdrop */}
            <div className="absolute inset-2 rounded-full border-2 border-amber-400/70 bg-gradient-to-b from-purple-950/80 via-black/90 to-red-950/80 shadow-[0_0_35px_rgba(234,179,8,0.6),inset_0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center transition-all duration-300">
              {/* Radiating pulse ring on each count tick */}
              <div
                key={`pulse-${currentCount}`}
                className="absolute inset-0 rounded-full border-2 border-amber-400/60 animate-ping [animation-duration:950ms] pointer-events-none"
              />

              {/* Number (3 -> 2 -> 1) */}
              <div
                key={`count-num-${currentCount}`}
                className="flex flex-col items-center justify-center transition-transform duration-200"
              >
                <span className="text-6xl sm:text-7xl md:text-8xl font-black font-cinzel text-amber-300 drop-shadow-[0_0_30px_rgba(234,179,8,0.95)] leading-none select-none">
                  {currentCount > 0 ? currentCount : 1}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-200/90 tracking-widest uppercase mt-1">
                  GIÂY
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Hint / Keyword Guide */}
        <div className="bg-black/50 rounded-lg p-2 border border-amber-500/25 mb-3">
          <div className="text-[11px] sm:text-xs text-amber-300 font-medium">
            💡 {visuals.actionHint}
          </div>
          {visuals.keywords.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider">Lệnh:</span>
              {visuals.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[10px] sm:text-[11px] font-bold text-amber-200 px-1.5 py-0.5 rounded bg-red-950/70 border border-red-500/40 shadow-sm"
                >
                  "{kw}"
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 3-Second Phase Dots (3, 2, 1) */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {[3, 2, 1].map(num => {
            const isPassed = currentCount < num;
            const isCurrent = currentCount === num;
            return (
              <div
                key={num}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-mono transition-all duration-300 ${
                  isCurrent
                    ? 'scale-125 bg-amber-400 text-black shadow-[0_0_15px_rgba(234,179,8,1)] border border-white'
                    : isPassed
                    ? 'bg-red-800/80 text-amber-200 border border-red-500/50'
                    : 'bg-stone-900/80 text-stone-500 border border-stone-800'
                }`}
              >
                {num}
              </div>
            );
          })}
        </div>

        {/* Host / Admin Quick Cancel Option (Hidden on OBS) */}
        {!isOBSMode && (
          <div className="mt-2 pt-2 border-t border-stone-800/60 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (isReturnMode) {
                  sectGameManager.returnToMainHall();
                } else {
                  sectGameManager.cancelMiniGameCountdown();
                }
              }}
              className="text-[11px] text-stone-400 hover:text-red-400 transition-colors flex items-center gap-1 px-2.5 py-0.5 rounded hover:bg-stone-900/60 cursor-pointer"
            >
              <span>✕</span> {isReturnMode ? 'Về Ngay Sảnh Chính' : 'Hủy Đếm Ngược'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
