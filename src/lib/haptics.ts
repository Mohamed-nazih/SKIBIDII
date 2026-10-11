/**
 * Haptic feedback utility using the Navigator Vibration API & Web Audio API fallback.
 * Provides Apple-like Taptic Engine sensation presets (light, medium, heavy, success, warning, selection).
 * Respects user's preference saved in localStorage.
 */

const STORAGE_KEY = 'pg_food_haptics_enabled';

// Web Audio API context for subtle acoustic click fallback on devices without vibration motors
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Play a subtle, clean Apple-like acoustic micro-tap */
function playSubtleClick(frequency = 440, duration = 0.015, gainVal = 0.05) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio errors
  }
}

export const haptics = {
  /** Check if haptics are currently enabled */
  isEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === 'true';
  },

  /** Set haptics enabled state */
  setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(enabled));
  },

  /** Light impact — for navigation tab clicks, segmented controls */
  light() {
    if (!this.isEnabled()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    playSubtleClick(800, 0.01, 0.03);
  },

  /** Medium impact — for standard button clicks, selection toggle */
  medium() {
    if (!this.isEnabled()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(22);
    }
    playSubtleClick(500, 0.018, 0.05);
  },

  /** Heavy impact — for primary actions like "Taken" */
  heavy() {
    if (!this.isEnabled()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([35, 10, 15]);
    }
    playSubtleClick(320, 0.03, 0.08);
  },

  /** Success notification — double burst */
  success() {
    if (!this.isEnabled()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40, 30]);
    }
    playSubtleClick(600, 0.02, 0.06);
    setTimeout(() => playSubtleClick(900, 0.02, 0.06), 50);
  },

  /** Selection change — ultra-light crisp click */
  selection() {
    if (!this.isEnabled()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
    playSubtleClick(1200, 0.008, 0.025);
  },
};
