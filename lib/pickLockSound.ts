let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

/** Call synchronously from a click handler so later sounds can play after async saves. */
export function ensurePickLockAudio(): void {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.12,
  frequencyEnd?: number
): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (frequencyEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(frequencyEnd, 1),
      now + duration
    );
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Satisfying latch — short click + settle. */
export function playPickLockSound(): void {
  ensurePickLockAudio();
  playTone(920, 0.05, "square", 0.06);
  playTone(380, 0.14, "sine", 0.1, 240);
}

/** Lighter rising click — lock opening. */
export function playPickUnlockSound(): void {
  ensurePickLockAudio();
  playTone(420, 0.07, "sine", 0.08, 880);
  playTone(660, 0.09, "triangle", 0.05);
}

/** Short tick when stepping a score up. */
export function playScoreStepUpSound(): void {
  ensurePickLockAudio();
  playTone(640, 0.028, "triangle", 0.065, 920);
}

/** Short tick when stepping a score down. */
export function playScoreStepDownSound(): void {
  ensurePickLockAudio();
  playTone(520, 0.028, "triangle", 0.065, 360);
}
