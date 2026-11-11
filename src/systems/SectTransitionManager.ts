import { ActiveSceneType, MiniGameId } from '../types/magiao';
import { sectGameManager, SectGameManager } from './SectGameManager';
import { soundSynthesizer } from './SoundSynthesizer';

export type TransitionStyle = 'ma_tran_khong_gian' | 'ma_khi_cuong_phong' | 'huyet_nguyet';

export type TransitionType = 'enter_minigame' | 'exit_to_main' | 'switch_minigame';

export type TransitionPhase = 'idle' | 'initiating' | 'portal_open' | 'revealing' | 'settled';

export interface TransitionState {
  isTransitioning: boolean;
  style: TransitionStyle;
  type: TransitionType;
  phase: TransitionPhase;
  fromScene: ActiveSceneType;
  toScene: ActiveSceneType;
  fromMiniGameId: MiniGameId | null;
  toMiniGameId: MiniGameId | null;
  progress: number; // 0.0 to 1.0
  elapsedMs: number;
  totalDurationMs: number;
  title: string;
  subtitle: string;
  runesFocalText?: string;
}

export type TransitionListener = (state: TransitionState) => void;

const MINI_GAME_TITLES: Record<MiniGameId, { name: string; subtitle: string; runes: string }> = {
  ma_quyen_loan_vu: {
    name: 'Ma Quyền Loạn Vũ',
    subtitle: 'Đồng Diễn Thần Quyền • Vạn Ma Hợp Lực',
    runes: '⚡ 🜂 拳 亂 武 🜂 ⚡',
  },
  ma_anh_than_phap: {
    name: 'Ma Ảnh Thân Pháp',
    subtitle: 'Né Chướng Ngại Vật • Hóa Ảnh Cuồng Tung',
    runes: '☯ 🜏 影 身 法 🜏 ☯',
  },
  tam_khi_ma_tran: {
    name: 'Tam Khí Ma Trận',
    subtitle: 'Lửa – Băng – Gió • Khắc Chế Vạn Vật',
    runes: '🔥 ❄️ 氣 魔 陣 ❄️ 🌪️',
  },
};

export class SectTransitionManager {
  private gameManager: SectGameManager | null = null;
  private state: TransitionState = {
    isTransitioning: false,
    style: 'ma_tran_khong_gian',
    type: 'enter_minigame',
    phase: 'idle',
    fromScene: 'main_hall',
    toScene: 'main_hall',
    fromMiniGameId: null,
    toMiniGameId: null,
    progress: 0,
    elapsedMs: 0,
    totalDurationMs: 1100,
    title: '',
    subtitle: '',
  };

  private listeners = new Set<TransitionListener>();
  private animFrameId: number | null = null;
  private switchCommitted = false;
  private startTime = 0;
  private onMidpointCallback: (() => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private defaultStyle: TransitionStyle = 'ma_tran_khong_gian';

  public setGameManager(gm: SectGameManager) {
    this.gameManager = gm;
  }

  public getGameManager(): SectGameManager {
    return this.gameManager || sectGameManager;
  }

  public getState(): TransitionState {
    return { ...this.state };
  }

  public subscribe(fn: TransitionListener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const snap = this.getState();
    this.listeners.forEach(fn => {
      try {
        fn(snap);
      } catch (err) {
        console.error('[TransitionManager] Listener error:', err);
      }
    });
  }

  public setDefaultStyle(style: TransitionStyle) {
    this.defaultStyle = style;
  }

  public getDefaultStyle(): TransitionStyle {
    return this.defaultStyle;
  }

  /**
   * Helper to check if reduced motion is requested
   */
  public prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * 1. Transition: Main Game -> Minigame (Duration ~1.0-1.2s, default 1100ms)
   */
  /**
   * 1. Transition: Main Game -> Minigame (Duration ~1.0-1.2s, default 1100ms)
   */
  public transitionToMiniGame(
    targetGameId: MiniGameId,
    style?: TransitionStyle,
    onComplete?: () => void,
    customGm?: SectGameManager
  ): boolean {
    if (this.state.isTransitioning) {
      console.warn('[TransitionManager] Đang có chuyển cảnh chạy dở, bỏ qua lệnh mới.');
      return false;
    }

    const mgr = customGm || this.getGameManager();
    const currentScene = mgr.getSnapshot().activeScene;
    const currentMg = mgr.getSnapshot().miniGame;
    const chosenStyle = style || this.defaultStyle;
    const info = MINI_GAME_TITLES[targetGameId] || {
      name: 'Luyện Võ Ma Giáo',
      subtitle: 'Khai Mở Sân Luyện',
      runes: '🐉 🜂 龍 魔 🜂 🐉',
    };

    const duration = this.prefersReducedMotion() ? 500 : 1100;

    this.startTransition({
      style: chosenStyle,
      type: 'enter_minigame',
      fromScene: currentScene,
      toScene: 'training_ground',
      fromMiniGameId: currentMg.isActive ? currentMg.gameId : null,
      toMiniGameId: targetGameId,
      totalDurationMs: duration,
      title: `TIẾN VÀO ${info.name.toUpperCase()}`,
      subtitle: info.subtitle,
      runesFocalText: info.runes,
      onMidpoint: () => {
        // Prepare target Minigame on game manager behind the portal
        soundSynthesizer.stopActiveMiniGameAudio();
        mgr.startMiniGame(targetGameId, false, undefined, true, mgr.getCurrentTurnId());
      },
      onComplete: () => {
        mgr.onMiniGameTransitionComplete();
        if (onComplete) onComplete();
      },
    });

    return true;
  }

  /**
   * 2. Transition: Minigame -> Main Game (Exit/Return, Duration ~0.7-1.0s, default 850ms)
   */
  public transitionToMainHall(
    style?: TransitionStyle,
    onComplete?: () => void,
    customGm?: SectGameManager
  ): boolean {
    if (this.state.isTransitioning) {
      console.warn('[TransitionManager] Đang có chuyển cảnh chạy dở, bỏ qua lệnh mới.');
      return false;
    }

    const mgr = customGm || this.getGameManager();
    const currentScene = mgr.getSnapshot().activeScene;
    const currentMg = mgr.getSnapshot().miniGame;
    const chosenStyle = style || this.defaultStyle;
    const duration = this.prefersReducedMotion() ? 450 : 850;

    this.startTransition({
      style: chosenStyle,
      type: 'exit_to_main',
      fromScene: currentScene,
      toScene: 'main_hall',
      fromMiniGameId: currentMg.isActive ? currentMg.gameId : null,
      toMiniGameId: null,
      totalDurationMs: duration,
      title: 'HỒI QUY ĐẠI ĐIỆN MA GIÁO',
      subtitle: 'Thu Hồi Pháp Trận • Đệ Tử Trở Về Hàng Ngũ',
      runesFocalText: '🏛️ 🜔 歸 大 殿 🜔 🏛️',
      onMidpoint: () => {
        soundSynthesizer.stopActiveMiniGameAudio();
        mgr.switchSceneNow('main_hall');
      },
      onComplete: () => {
        mgr.onMainHallTransitionComplete();
        if (onComplete) onComplete();
      },
    });

    return true;
  }

  /**
   * 3. Transition: Minigame A -> Minigame B directly (Duration ~0.9-1.2s, default 1050ms)
   */
  public switchBetweenMiniGames(
    fromGameId: MiniGameId,
    toGameId: MiniGameId,
    style?: TransitionStyle,
    onComplete?: () => void,
    customGm?: SectGameManager
  ): boolean {
    if (fromGameId === toGameId) {
      return false;
    }

    if (this.state.isTransitioning) {
      console.warn('[TransitionManager] Đang có chuyển cảnh chạy dở, bỏ qua lệnh mới.');
      return false;
    }

    const mgr = customGm || this.getGameManager();
    const chosenStyle = style || this.defaultStyle;
    const info = MINI_GAME_TITLES[toGameId] || {
      name: 'Chuyển Đổi Kỳ Thi',
      subtitle: 'Hoán Chuyển Ma Trận',
      runes: '⚡ 🜏 換 陣 🜏 ⚡',
    };
    const duration = this.prefersReducedMotion() ? 500 : 1050;

    this.startTransition({
      style: chosenStyle,
      type: 'switch_minigame',
      fromScene: 'training_ground',
      toScene: 'training_ground',
      fromMiniGameId: fromGameId,
      toMiniGameId: toGameId,
      totalDurationMs: duration,
      title: `HOÁN TRẬN: ${info.name.toUpperCase()}`,
      subtitle: info.subtitle,
      runesFocalText: info.runes,
      onMidpoint: () => {
        soundSynthesizer.stopActiveMiniGameAudio();
        mgr.startMiniGame(toGameId, false, undefined, true);
      },
      onComplete: () => {
        mgr.onMiniGameTransitionComplete();
        if (onComplete) onComplete();
      },
    });

    return true;
  }

  /**
   * Emergency cancel (e.g. Diệt Môn event bursts in or user quits immediately)
   */
  public cancelTransition() {
    if (!this.state.isTransitioning) return;

    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Ensure midpoint callback was executed if not yet committed
    if (!this.switchCommitted && this.onMidpointCallback) {
      try {
        this.onMidpointCallback();
      } catch (e) {
        console.error('[TransitionManager] Error during cancel fallback:', e);
      }
    }

    this.switchCommitted = true;
    const previousType = this.state.type;
    this.state = {
      ...this.state,
      isTransitioning: false,
      phase: 'idle',
      progress: 0,
      elapsedMs: 0,
    };
    const mgr = this.getGameManager();
    if (previousType === 'exit_to_main') {
      mgr.onMainHallTransitionComplete();
    } else {
      mgr.onMiniGameTransitionComplete();
    }

    this.onMidpointCallback = null;
    this.onCompleteCallback = null;
    this.notify();
  }

  private startTransition(params: {
    style: TransitionStyle;
    type: TransitionType;
    fromScene: ActiveSceneType;
    toScene: ActiveSceneType;
    fromMiniGameId: MiniGameId | null;
    toMiniGameId: MiniGameId | null;
    totalDurationMs: number;
    title: string;
    subtitle: string;
    runesFocalText?: string;
    onMidpoint: () => void;
    onComplete?: () => void;
  }) {
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.switchCommitted = false;
    this.onMidpointCallback = params.onMidpoint;
    this.onCompleteCallback = params.onComplete || null;
    this.startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.state = {
      isTransitioning: true,
      style: params.style,
      type: params.type,
      phase: 'initiating',
      fromScene: params.fromScene,
      toScene: params.toScene,
      fromMiniGameId: params.fromMiniGameId,
      toMiniGameId: params.toMiniGameId,
      progress: 0,
      elapsedMs: 0,
      totalDurationMs: params.totalDurationMs,
      title: params.title,
      subtitle: params.subtitle,
      runesFocalText: params.runesFocalText,
    };

    // Trigger audio effect for portal opening
    soundSynthesizer.playPortalTransition(params.style);

    this.notify();
    this.loop();
  }

  private loop = () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - this.startTime;
    const total = this.state.totalDurationMs;
    const rawProgress = Math.max(0, Math.min(1, elapsed / total));

    // Phase division:
    // 0.0 - 0.22: Initiating (button glow, gathering miasma)
    // 0.22 - 0.72: Portal Open & Central vortex
    // 0.72 - 1.0: Revealing new game and clearing mist
    let currentPhase: TransitionPhase = 'initiating';
    if (rawProgress >= 0.72) {
      currentPhase = 'revealing';
    } else if (rawProgress >= 0.22) {
      currentPhase = 'portal_open';
    }

    // Midpoint commit: Exactly at progress ~0.48-0.52 when the portal is covering the center
    if (!this.switchCommitted && rawProgress >= 0.48) {
      this.switchCommitted = true;
      if (this.onMidpointCallback) {
        try {
          this.onMidpointCallback();
        } catch (err) {
          console.error('[TransitionManager] Midpoint switch error:', err);
        }
      }
      soundSynthesizer.playPortalReveal();
    }

    this.state.progress = rawProgress;
    this.state.elapsedMs = elapsed;
    this.state.phase = currentPhase;
    this.notify();

    if (rawProgress < 1) {
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animFrameId = requestAnimationFrame(this.loop);
      } else {
        setTimeout(this.loop, 16);
      }
    } else {
      // Completed transition
      this.state.phase = 'settled';
      this.state.isTransitioning = false;
      this.state.progress = 1;
      this.notify();

      if (this.onCompleteCallback) {
        try {
          this.onCompleteCallback();
        } catch (err) {
          console.error('[TransitionManager] onComplete error:', err);
        }
      }

      this.onMidpointCallback = null;
      this.onCompleteCallback = null;
      this.animFrameId = null;
    }
  };
}

export const sectTransitionManager = new SectTransitionManager();
