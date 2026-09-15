let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function unlockAudio(): void {
  if (unlocked) return;
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  unlocked = true;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
  if (!unlocked) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function playSuccess(): void {
  playTone(523.25, 0.15, 'sine', 0.25);
  setTimeout(() => playTone(659.25, 0.2, 'sine', 0.25), 120);
}

export function playError(): void {
  playTone(220, 0.3, 'square', 0.15);
  setTimeout(() => playTone(180, 0.3, 'square', 0.12), 200);
}

export function playScan(): void {
  playTone(1200, 0.08, 'sine', 0.2);
}

export function playNotification(): void {
  playTone(880, 0.1, 'triangle', 0.2);
  setTimeout(() => playTone(1100, 0.15, 'triangle', 0.2), 100);
}
