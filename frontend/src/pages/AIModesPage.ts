import { AILevelGenerator, GameMode, Difficulty, AILevelConfig } from '../services/AILevelGenerator';
import type { Unit } from '../services/GameService';
import { AudioManager } from '../services/AudioManager';

// ── Modos disponibles ─────────────────────────────────────────────────────────
interface ModeInfo {
  id: GameMode;
  icon: string;
  name: string;
  desc: string;
  tag: string;
  tagColor: string;
}

const MODES: ModeInfo[] = [
  {
    id: 'SKIRMISH', icon: '⚔️', name: 'Escaramuza',
    desc: 'Batalla táctica estándar. Terreno variado, fuerzas equilibradas.',
    tag: 'CLÁSICO', tagColor: '#a0c8ff',
  },
  {
    id: 'SURVIVAL', icon: '🌊', name: 'Supervivencia',
    desc: 'Fuerzas enemigas muy superiores en número. Sobrevive si puedes.',
    tag: 'DESAFIANTE', tagColor: '#ffb060',
  },
  {
    id: 'CONQUEST', icon: '🏰', name: 'Conquista',
    desc: 'Seis fuertes estratégicos. Controla el campo de batalla.',
    tag: 'ESTRATEGIA', tagColor: '#a0f0c0',
  },
  {
    id: 'AMBUSH', icon: '🌲', name: 'Emboscada',
    desc: 'Tu equipo ha sido rodeado en el bosque. Rompe el cerco.',
    tag: 'DIFÍCIL', tagColor: '#ff9a9a',
  },
  {
    id: 'ARENA', icon: '🏟️', name: 'Arena',
    desc: 'Combate de campeones 3 vs 3 en un coliseo cerrado.',
    tag: 'DUELO', tagColor: '#f0c040',
  },
];

// Colores del mini-mapa (deben coincidir con TERRAIN_COLORS de GamePage)
const TERRAIN_COLORS: Record<number, string> = {
  0: '#4a7a30', // pradera
  1: '#1d5c1d', // bosque
  2: '#6a6a6a', // montaña
  3: '#1a4e99', // agua
  4: '#8a6422', // fuerte
  5: '#b09868', // camino
};

const CLASS_ICONS: Record<string, string> = {
  Lord: '⚔', Paladin: '🛡', Myrmidon: '🗡', Archer: '🏹',
  Mage: '🔮', Healer: '✚', Warrior: '🪓', Knight: '⚔',
  Bandit: '💀', Sorcerer: '🌑', General: '⚔', DarkGeneral: '💀',
};

// ════════════════════════════════════════════════════════════════════════════
export class AIModesPage {

  private container!: HTMLElement;
  private selectedMode: GameMode   = 'SKIRMISH';
  private selectedDiff: Difficulty = 2;
  private config: AILevelConfig | null = null;

  render(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = this.buildHTML();
    this.bindEvents();
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  private buildHTML(): string {
    return `
      <main class="aimode-main">

        <!-- Cabecera -->
        <div class="aimode-header">
          <div style="font-size:2rem;margin-bottom:8px;">🤖</div>
          <h1 class="aimode-title">Modos de Juego IA</h1>
          <p class="aimode-subtitle">Generación procedural — cada partida es única e irrepetible</p>
          <div class="aimode-badge">MOTOR DE IA ∙ 5 MODOS ∙ 5 DIFICULTADES ∙ SEMILLA REPRODUCIBLE</div>
        </div>

        <!-- Grid de modos -->
        <div class="aimode-grid" id="mode-grid">
          ${MODES.map(m => this.modeCard(m)).join('')}
        </div>

        <!-- Fila: dificultad + semilla + generar -->
        <div class="aimode-config">
          <div>
            <div class="aimode-config-label">Dificultad</div>
            <div class="aimode-diff-stars" id="diff-stars">
              ${[1,2,3,4,5].map(n => `
                <button class="aimode-star ${n <= this.selectedDiff ? 'aimode-star-active' : ''}"
                        data-diff="${n}" title="Dificultad ${n}">★</button>
              `).join('')}
            </div>
          </div>

          <div style="flex:1; min-width:10px;"></div>

          <div>
            <div class="aimode-config-label">Semilla (opcional — para rejugar)</div>
            <input class="aimode-seed-input" id="seed-input"
                   type="number" placeholder="ej. 482391" min="1" max="999999"
                   title="Introduce la semilla de un nivel anterior para volver a jugarlo">
          </div>

          <button class="aimode-generate-btn" id="btn-generate">
            ⚡ GENERAR NIVEL
          </button>
        </div>

        <!-- Vista previa (oculta hasta generar) -->
        <div class="aimode-preview" id="preview-panel" style="display:none;">

          <!-- Mini-mapa del terreno generado -->
          <div class="aimode-minimap-wrap">
            <canvas id="ai-minimap" width="200" height="150" class="aimode-minimap"></canvas>
            <div class="aimode-minimap-legend">
              <span style="color:#4a7a30">■ Pradera</span>
              <span style="color:#1d5c1d">■ Bosque</span>
              <span style="color:#6a6a6a">■ Montaña</span>
              <span style="color:#1a4e99">■ Agua</span>
              <span style="color:#8a6422">■ Fuerte</span>
              <span style="color:#b09868">■ Camino</span>
            </div>
          </div>

          <!-- Info del nivel + unidades -->
          <div class="aimode-preview-info">
            <div class="aimode-preview-name" id="prev-name">—</div>
            <div class="aimode-preview-desc" id="prev-desc"></div>
            <div class="aimode-preview-obj"  id="prev-obj"></div>

            <!-- Roster de unidades -->
            <div class="aimode-roster" id="prev-roster">
              <div class="aimode-roster-team" id="roster-player"></div>
              <div class="aimode-roster-vs">VS</div>
              <div class="aimode-roster-team" id="roster-enemy"></div>
            </div>

            <div class="aimode-preview-seed" id="prev-seed"></div>
          </div>

          <!-- Botón iniciar -->
          <div class="aimode-preview-actions">
            <button class="aimode-start-btn" id="btn-start" disabled>
              ▶ INICIAR BATALLA
            </button>
          </div>
        </div>

        <button class="aimode-back-btn" id="btn-back">↩ VOLVER AL MENÚ</button>
      </main>`;
  }

  private modeCard(m: ModeInfo): string {
    const active = m.id === this.selectedMode ? 'aimode-card-active' : '';
    return `
      <button class="aimode-card ${active}" data-mode="${m.id}">
        <span class="aimode-card-icon">${m.icon}</span>
        <div class="aimode-card-name">${m.name}</div>
        <div class="aimode-card-desc">${m.desc}</div>
        <div class="aimode-card-tag" style="border-color:${m.tagColor};color:${m.tagColor};">${m.tag}</div>
      </button>`;
  }

  // ── Eventos ────────────────────────────────────────────────────────────────

  private bindEvents(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.aimode-card').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMode = btn.dataset.mode as GameMode;
        AudioManager.playSfx?.('cursor');
        this.refreshCards();
        this.hidePreview();
      });
    });

    this.container.querySelectorAll<HTMLButtonElement>('.aimode-star').forEach(star => {
      star.addEventListener('click', () => {
        this.selectedDiff = Number(star.dataset.diff) as Difficulty;
        AudioManager.playSfx?.('cursor');
        this.refreshStars();
        this.hidePreview();
      });
    });

    this.container.querySelector('#btn-generate')?.addEventListener('click', () => {
      AudioManager.playSfx?.('confirm');
      this.doGenerate();
    });

    this.container.querySelector('#btn-start')?.addEventListener('click', () => {
      if (!this.config) return;
      AudioManager.playSfx?.('confirm');
      this.startGame();
    });

    this.container.querySelector('#btn-back')?.addEventListener('click', () => {
      AudioManager.playSfx?.('cancel');
      import('./MenuPage').then(({ MenuPage }) => new MenuPage().render(this.container));
    });
  }

  // ── Generación ────────────────────────────────────────────────────────────

  private doGenerate(): void {
    const btn = this.container.querySelector('#btn-generate') as HTMLButtonElement;
    btn.textContent = '⚡ GENERANDO…';
    btn.disabled = true;

    // Leer semilla manual
    const seedInput = this.container.querySelector('#seed-input') as HTMLInputElement;
    const rawSeed = seedInput?.value.trim();
    const seed = rawSeed ? Math.abs(parseInt(rawSeed)) || undefined : undefined;

    // Timeout mínimo para que el navegador pinte el texto "GENERANDO…"
    setTimeout(() => {
      this.config = AILevelGenerator.generate(this.selectedMode, this.selectedDiff, seed);
      this.showPreview(this.config);
      btn.textContent = '⚡ REGENERAR';
      btn.disabled = false;
    }, 60);
  }

  // ── Preview: mini-mapa + roster + info ───────────────────────────────────

  private showPreview(cfg: AILevelConfig): void {
    const panel = this.container.querySelector('#preview-panel') as HTMLElement;
    panel.style.display = '';

    // Texto del nivel
    const modeInfo  = MODES.find(m => m.id === cfg.mode)!;
    const stars     = '★'.repeat(cfg.difficulty) + '☆'.repeat(5 - cfg.difficulty);
    const players   = cfg.state.units.filter(u => u.team === 'player');
    const enemies   = cfg.state.units.filter(u => u.team === 'enemy');

    this.setText('#prev-name', `${modeInfo.icon} ${cfg.name}`);
    this.setText('#prev-desc', cfg.description);
    this.setText('#prev-obj',  `OBJETIVO: ${cfg.objective} · ${stars}`);
    this.setText('#prev-seed', `Semilla: ${cfg.seed}`);

    // Habilitar botón
    const startBtn = this.container.querySelector('#btn-start') as HTMLButtonElement;
    startBtn.disabled = false;

    // Roster de unidades
    const pEl = this.container.querySelector('#roster-player') as HTMLElement;
    const eEl = this.container.querySelector('#roster-enemy')  as HTMLElement;
    if (pEl) pEl.innerHTML = this.renderRoster(players, 'player');
    if (eEl) eEl.innerHTML = this.renderRoster(enemies, 'enemy');

    // Mini-mapa
    this.drawMinimap(cfg);

    // Animar entrada del panel
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(10px)';
    panel.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    requestAnimationFrame(() => {
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
  }

  private renderRoster(units: Unit[], team: string): string {
    const isPlayer = team === 'player';
    const color    = isPlayer ? '#4a9eff' : '#ff4a4a';
    const label    = isPlayer ? `⚔ ${units.length} aliados` : `💀 ${units.length} enemigos`;

    const badges = units.map(u => {
      const icon = CLASS_ICONS[u.unitClass] ?? '?';
      return `<span class="aimode-badge-unit" title="${u.name} — ${u.unitClass}"
                    style="border-color:${color};color:${color};">${icon} ${u.name}</span>`;
    }).join('');

    return `<div class="aimode-roster-label" style="color:${color};">${label}</div>
            <div class="aimode-roster-units">${badges}</div>`;
  }

  // ── Mini-mapa del terreno ─────────────────────────────────────────────────

  private drawMinimap(cfg: AILevelConfig): void {
    const canvas = this.container.querySelector('#ai-minimap') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const drawUnits = () => {
      const COLS_MAP = 20, ROWS_MAP = 15;
      const cw = canvas.width  / COLS_MAP;
      const ch = canvas.height / ROWS_MAP;
      for (const unit of cfg.state.units) {
        const isPlayer = unit.team === 'player';
        const cx = (unit.position.x + 0.5) * cw;
        const cy = (unit.position.y + 0.5) * ch;
        const r  = Math.max(2.5, Math.min(cw, ch) * 0.38);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(cx + 0.5, cy + 0.8, r * 0.85, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isPlayer ? '#2060c0' : '#8b1010';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = isPlayer ? '#4a9eff' : '#ff4a4a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(200,146,42,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (cfg.mapImagePath) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawUnits();
      };
      img.onerror = () => drawUnits();
      img.src = cfg.mapImagePath;
    } else {
      drawUnits();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private darken(hex: string, factor: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 0xff) * factor);
    const g = Math.round(((n >>  8) & 0xff) * factor);
    const b = Math.round(( n        & 0xff) * factor);
    return `rgb(${r},${g},${b})`;
  }

  private setText(sel: string, text: string): void {
    const el = this.container.querySelector(sel) as HTMLElement | null;
    if (el) el.textContent = text;
  }

  private hidePreview(): void {
    this.config = null;
    const panel = this.container.querySelector('#preview-panel') as HTMLElement;
    if (panel) panel.style.display = 'none';
    const startBtn = this.container.querySelector('#btn-start') as HTMLButtonElement;
    if (startBtn) startBtn.disabled = true;
    const btn = this.container.querySelector('#btn-generate') as HTMLButtonElement;
    if (btn) btn.textContent = '⚡ GENERAR NIVEL';
  }

  private refreshCards(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.aimode-card').forEach(btn => {
      btn.classList.toggle('aimode-card-active', btn.dataset.mode === this.selectedMode);
    });
  }

  private refreshStars(): void {
    this.container.querySelectorAll<HTMLButtonElement>('.aimode-star').forEach(star => {
      star.classList.toggle('aimode-star-active', Number(star.dataset.diff) <= this.selectedDiff);
    });
  }

  // ── Lanzar juego ──────────────────────────────────────────────────────────

  private startGame(): void {
    if (!this.config) return;
    const cfg      = this.config;
    const modeInfo = MODES.find(m => m.id === cfg.mode)!;
    const label    = `${modeInfo.name.toUpperCase()} · ${cfg.name} · ${'★'.repeat(cfg.difficulty)}`;

    import('./GamePage').then(({ GamePage }) => {
      const app = document.getElementById('app') ?? this.container;
      new GamePage().render(app, cfg.state, undefined, label, cfg.mapImagePath);
    });
  }
}
