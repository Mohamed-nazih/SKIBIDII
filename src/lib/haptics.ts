/**
 * Apple Taptic Engine Simulation
 * 
 * Devices behave differently:
 * 1. Android devices support `navigator.vibrate()`.
 * 2. iOS Safari blocks `navigator.vibrate()` on web pages, but supports synthesized
 *    transient audio impulses via Web Audio API once the user interacts with the page.
 * 
 * This engine unifies both:
 * - Robust vibration patterns with sufficient duration for physical motors (30ms - 80ms)
 * - Low-frequency transient pressure clicks for iOS/Safari simulating physical taptic feedback
 */

const STORAGE_KEY = 'pg_food_haptics_enabled';

let audioCtx: AudioContext | null = null;

function unlockAudioContext() {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch {
    // Ignore
  }
}

// Automatically listen to first user gesture to unlock audio for iOS
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const onFirstInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach(e => window.removeEventListener(e, onFirstInteraction));
  };
  unlockEvents.forEach(e => window.addEventListener(e, onFirstInteraction, { passive: true, once: true }));
}

/**
 * Creates a synthetic Taptic impulse:
 * Rapid low-frequency impulse with sudden decay to replicate physical feedback
 */
function playTapticImpulse(freq = 150, duration = 0.025, volume = 0.35) {
  try {
    unlockAudioContext();
    if (!audioCtx || audioCtx.state !== 'running') return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Silently continue
  }
}

function doVibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers block vibration if not strictly user-initiated
    }
  }
}

export const haptics = {
  isEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(STORAGE_KEY);
    return val === null ? true : val === 'true';
  },

  setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, String(enabled));
  },

  /** Light impact — nav bar tabs, light toggles */
  light() {
    if (!this.isEnabled()) return;
    doVibrate(25);
    playTapticImpulse(220, 0.02, 0.25);
  },

  /** Medium impact — avatar selection, buttons, actions */
  medium() {
    if (!this.isEnabled()) return;
    doVibrate(45);
    playTapticImpulse(180, 0.03, 0.4);
  },

  /** Heavy impact — "Taken" button, main action trigger */
  heavy() {
    if (!this.isEnabled()) return;
    doVibrate([55, 30, 45]);
    playTapticImpulse(120, 0.045, 0.6);
  },

  /** Success impact — double feedback burst */
  success() {
    if (!this.isEnabled()) return;
    doVibrate([35, 40, 50]);
    playTapticImpulse(240, 0.025, 0.35);
    setTimeout(() => {
      playTapticImpulse(320, 0.03, 0.4);
    }, 60);
  },

  /** Selection change — subtle tap */
  selection() {
    if (!this.isEnabled()) return;
    doVibrate(18);
    playTapticImpulse(260, 0.015, 0.2);
  },
};

