let enabled = true;
try { enabled = localStorage.getItem('svela-sound') !== 'off'; } catch { /* Optional preference. */ }
let context: AudioContext | undefined;
export const soundEnabled = () => enabled;
export function toggleSound(): boolean {
  enabled = !enabled;
  try { localStorage.setItem('svela-sound', enabled ? 'on' : 'off'); } catch { /* Keep session setting. */ }
  return enabled;
}
/** Short synthesized cues, only triggered by a player action. No background track. */
export function playSound(kind: 'select' | 'release' | 'blocked' | 'win') {
  if (!enabled || document.hidden) return;
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume().then(() => {
      if (!enabled || document.hidden) return;
      const notes = kind === 'win' ? [523, 659, 784] : kind === 'release' ? [659, 988] : kind === 'blocked' ? [180] : [440];
      notes.forEach((frequency, index) => {
        const start = audio.currentTime + index * .075;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(.035, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .25);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(start); oscillator.stop(start + .28);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    }).catch(() => {});
  } catch { /* Audio availability must never prevent play. */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) void context?.suspend(); });

let haptics = true;
try { haptics = localStorage.getItem('svela-haptics') !== 'off'; } catch { /* Optional preference. */ }
// Desktop browsers expose the API without a motor: offer it only on touch devices.
export const hapticsAvailable = typeof navigator !== 'undefined' && 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
export const hapticsEnabled = () => haptics;
export function toggleHaptics(): boolean {
  haptics = !haptics;
  try { localStorage.setItem('svela-haptics', haptics ? 'on' : 'off'); } catch { /* Keep session setting. */ }
  return haptics;
}
/** A brief buzz on phones that support it; silently absent elsewhere. */
export function vibrate(kind: 'blocked' | 'win') {
  if (!haptics || !hapticsAvailable || document.hidden) return;
  try { navigator.vibrate(kind === 'blocked' ? [18, 40, 18] : [24, 60, 36]); } catch { /* Never prevent play. */ }
}
