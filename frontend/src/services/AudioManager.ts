import { Howl } from 'howler';

const MUSIC_BASE = '/src/assets/Music/0. Heroes/';

export const TRACKS = {
  menu:        MUSIC_BASE + 'FEH_04 (Menu).mp3',
  map1:        MUSIC_BASE + 'FEH_08 (Map 1).mp3',
  map2:        MUSIC_BASE + 'FEH_09 (Map 2).mp3',
  map3:        MUSIC_BASE + 'FEH_10 (Map 3).mp3',
  map4:        MUSIC_BASE + 'FEH_28 (Map 4).mp3',
  map5:        MUSIC_BASE + 'FEH_32 (Map 5).mp3',
  map6:        MUSIC_BASE + 'FEH_45 (Map 6).mp3',
  boss:        MUSIC_BASE + 'FEH_15 (Battle - Boss).mp3',
  battlePlayer:MUSIC_BASE + 'FEH_13 (Battle - Player).mp3',
  battleEnemy: MUSIC_BASE + 'FEH_14 (Battle - Enemy).mp3',
};

const LEVEL_MUSIC: Record<string, string> = {
  'level-1':  TRACKS.map1,
  'level-2':  TRACKS.map1,
  'level-3':  TRACKS.map2,
  'level-4':  TRACKS.map2,
  'level-5':  TRACKS.map3,
  'level-6':  TRACKS.map3,
  'level-7':  TRACKS.boss,
  'level-8':  TRACKS.map4,
  'level-9':  TRACKS.map4,
  'level-10': TRACKS.map5,
  'level-11': TRACKS.map5,
  'level-12': TRACKS.map6,
  'level-13': TRACKS.map6,
  'level-14': TRACKS.boss,
};

export class AudioManager {
  private static music: Howl | null = null;
  private static vol = 0.6;
  private static currentSrc = '';

  static playMusic(src: string, loop = true): void {
    if (this.currentSrc === src && this.music?.playing()) return;
    this.stop();
    this.currentSrc = src;
    this.music = new Howl({
      src:    [src],
      loop,
      volume: this.vol,
      onloaderror: (_id: number, err: unknown) => console.warn('Audio load error:', err),
    });
    this.music.play();
  }

  static playLevelMusic(levelId?: string): void {
    const src = (levelId && LEVEL_MUSIC[levelId]) ?? TRACKS.map1;
    this.playMusic(src);
  }

  static stop(): void {
    if (this.music) { this.music.unload(); this.music = null; this.currentSrc = ''; }
  }

  static pause(): void { this.music?.pause(); }
  static resume(): void { if (this.music && !this.music.playing()) this.music.play(); }

  static setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    this.music?.volume(this.vol);
  }

  // ── Efectos de sonido (Web Audio API) ────────────────────────────────────────
  private static audioCtx: AudioContext | null = null;

  private static getCtx(): AudioContext {
    if (!this.audioCtx) this.audioCtx = new AudioContext();
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
    return this.audioCtx;
  }

  private static tone(
    ctx: AudioContext, freq: number, vol: number, dur: number,
    type: OscillatorType = 'sine', delay = 0
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  private static noise(ctx: AudioContext, vol: number, dur: number, delay = 0): void {
    const frames = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain(); src.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t);
  }

  private static sweep(
    ctx: AudioContext, f0: number, f1: number, vol: number, dur: number, delay = 0
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    const t = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  static playSfx(type: 'hit' | 'magic' | 'cursor' | 'confirm' | 'cancel' | 'levelup' | 'death' | 'miss'): void {
    try {
      const c = this.getCtx();
      switch (type) {
        case 'cursor':
          this.tone(c, 880, 0.04, 0.06, 'square');
          break;
        case 'confirm':
          this.tone(c, 660, 0.10, 0.10, 'sine');
          this.tone(c, 880, 0.10, 0.10, 'sine', 0.10);
          break;
        case 'cancel':
          this.tone(c, 440, 0.10, 0.14, 'sine');
          this.tone(c, 330, 0.08, 0.12, 'sine', 0.06);
          break;
        case 'hit':
          this.noise(c, 0.30, 0.06);
          this.tone(c, 180, 0.18, 0.12, 'sawtooth');
          break;
        case 'magic':
          this.sweep(c, 300, 1200, 0.18, 0.28);
          this.sweep(c, 600, 200,  0.12, 0.20, 0.10);
          break;
        case 'miss':
          this.tone(c, 330, 0.06, 0.14, 'sine');
          break;
        case 'death':
          this.tone(c, 330, 0.20, 0.10, 'sawtooth');
          this.tone(c, 220, 0.18, 0.28, 'sawtooth', 0.10);
          this.tone(c, 110, 0.14, 0.50, 'sawtooth', 0.24);
          this.noise(c, 0.10, 0.40, 0.10);
          break;
        case 'levelup':
          [523, 659, 784, 1047].forEach((f, i) => this.tone(c, f, 0.14, 0.16, 'sine', i * 0.12));
          break;
      }
    } catch { /* silently ignore audio errors */ }
  }
}
