import {
  GameService, GameState, Unit, Position, CombatPreview, EnemyTurnResult, CombatResult, Weapon
} from '../services/GameService';
import { AudioManager } from '../services/AudioManager';

// ── Constantes del mapa ────────────────────────────────────────────────────────
const COLS = 20, ROWS = 15, TILE = 66;
const VIEWPORT_W = 880, VIEWPORT_H = 660;

// 0=PLAINS 1=FOREST 2=MOUNTAIN 3=WATER 4=FORT 5=ROAD
const MAP_LAYOUT = [
  [5,5,5,0,0,1,1,0,0,2,2,2,0,0,3,3,3,0,0,0],
  [5,0,0,0,1,1,0,0,2,2,0,0,0,3,3,0,0,0,1,0],
  [5,0,0,1,1,0,0,2,2,0,0,0,0,3,0,0,0,1,1,0],
  [5,5,0,1,0,0,2,2,0,0,0,0,0,3,0,0,1,1,0,0],
  [0,5,5,0,0,2,2,0,0,0,4,0,0,3,3,0,1,0,0,0],
  [0,0,5,0,0,2,0,0,0,0,0,0,3,3,0,0,0,0,0,0],
  [0,0,5,5,0,0,0,0,0,0,0,3,3,0,0,0,1,1,1,0],
  [0,0,0,5,5,0,0,0,0,0,3,3,0,0,0,1,1,0,0,0],
  [0,0,0,0,5,0,1,1,0,3,3,0,0,0,0,1,0,0,0,0],
  [0,0,0,0,5,5,1,0,3,3,0,0,0,0,0,0,0,0,4,0],
  [2,2,0,0,0,5,0,3,3,0,0,0,0,0,0,0,0,0,0,0],
  [2,2,2,0,0,5,3,3,0,0,0,0,0,0,0,0,0,1,0,0],
  [2,0,0,0,0,5,3,0,0,0,0,0,0,0,1,1,1,1,0,0],
  [0,0,0,0,0,5,0,0,0,1,1,1,0,0,1,0,0,0,0,0],
  [0,0,4,0,0,5,5,5,5,5,0,0,0,0,0,0,0,0,4,0],
];

const TERRAIN_COLORS: { [k: number]: [string, string] } = {
  0: ['#4a7a30','#5a8f3c'],   // plains
  1: ['#256025','#2e7a2e'],   // forest
  2: ['#7a7a7a','#909090'],   // mountain
  3: ['#1a5099','#2268c0'],   // water
  4: ['#8a6020','#a07030'],   // fort
  5: ['#b09868','#c0aa80'],   // road
};

const TERRAIN_AVOID = [0, 20, 30, 0, 20, 0];
const TERRAIN_COST  = [1,  2,  3, 99, 1, 1];

// ── Fondos de batalla por tipo de terreno ──────────────────────────────────────
const BG_BASE = '/src/assets/Backgrounds/Battle Backgrounds';
const TERRAIN_BG_FOLDER: Record<number, string> = {
  0: '002_Plain',
  1: '001_BraveForest',
  2: '001_EmbraMountain',
  3: '002_PlainRiver',
  4: '001_BraveAttackInside',
  5: '002_Plain',
};

// ── Triángulo de armas ─────────────────────────────────────────────────────────
const ADV: Record<string, string>  = { SWORD:'AXE', AXE:'LANCE', LANCE:'SWORD', ANIMA:'LIGHT', LIGHT:'DARK', DARK:'ANIMA' };
const DIS: Record<string, string>  = { AXE:'SWORD', LANCE:'AXE', SWORD:'LANCE', LIGHT:'ANIMA', DARK:'LIGHT', ANIMA:'DARK' };

function weaponTriangle(a: string, d: string): [number, number] {
  if (ADV[a] === d) return [+15, +1];
  if (DIS[a] === d) return [-15, -1];
  return [0, 0];
}

// ── Cálculo local de preview ───────────────────────────────────────────────────
function calcPreview(atk: Unit, def: Unit, layout: number[][]): CombatPreview {
  const aw = atk.equippedWeapon;
  const dw = def.equippedWeapon;
  const defAvoid = TERRAIN_AVOID[layout[def.position.y]?.[def.position.x] ?? 0];
  const atkAvoid = TERRAIN_AVOID[layout[atk.position.y]?.[atk.position.x] ?? 0];

  const [aHitT, aDmgT] = aw && dw ? weaponTriangle(aw.type, dw.type) : [0, 0];
  const [dHitT, dDmgT] = aw && dw ? weaponTriangle(dw.type, aw.type) : [0, 0];

  const atkHit  = aw ? Math.max(0, Math.min(100, atk.skl*2 + atk.lck/2 + aw.hit - def.spd*2 - defAvoid + aHitT)) : 50;
  const atkCrit = aw ? Math.max(0, Math.floor(atk.skl/2) + aw.crit - Math.floor(def.lck/2)) : 0;
  const atkDmg  = aw ? (aw.magical
    ? Math.max(0, atk.mag + aw.might - def.res + aDmgT)
    : Math.max(0, atk.str + aw.might - def.def + aDmgT)) : Math.max(0, atk.str - def.def);
  const atkDouble = atk.spd >= def.spd + 4;

  const canCounter = !!(dw && dist(atk.position, def.position) >= dw.minRange && dist(atk.position, def.position) <= dw.maxRange);
  const defHit  = canCounter && dw ? Math.max(0, Math.min(100, def.skl*2 + def.lck/2 + dw.hit - atk.spd*2 - atkAvoid + dHitT)) : 0;
  const defCrit = canCounter && dw ? Math.max(0, Math.floor(def.skl/2) + dw.crit - Math.floor(atk.lck/2)) : 0;
  const defDmg  = canCounter && dw ? (dw.magical
    ? Math.max(0, def.mag + dw.might - atk.res + dDmgT)
    : Math.max(0, def.str + dw.might - atk.def + dDmgT)) : 0;
  const defDouble = canCounter && def.spd >= atk.spd + 4;

  let advantage = 'NONE';
  if (aw && dw) {
    if (ADV[aw.type] === dw.type)      advantage = 'ATTACKER';
    else if (DIS[aw.type] === dw.type) advantage = 'DEFENDER';
  }

  return {
    attackerId: atk.id, defenderId: def.id,
    attackerName: atk.name, defenderName: def.name,
    attackerHp: atk.currentHp, defenderHp: def.currentHp,
    attackerDamage: atkDmg, defenderDamage: defDmg,
    attackerHitRate: atkHit, defenderHitRate: defHit,
    attackerCritRate: atkCrit, defenderCritRate: defCrit,
    attackerDoubleAttacks: atkDouble, defenderDoubleAttacks: defDouble,
    defenderCanCounter: canCounter,
    weaponAdvantage: advantage,
    attackerWeaponName: aw?.name ?? 'Sin arma',
    defenderWeaponName: dw?.name ?? 'Sin arma',
  };
}

function dist(a: Position, b: Position) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// ── Mapa de imágenes por nivel (14 niveles) ───────────────────────────────────
const LEVEL_MAP_IMAGES: Record<string, string> = {
  'level-1':  '/src/assets/maps/Story/S0101.png',
  'level-2':  '/src/assets/maps/Story/S0201.png',
  'level-3':  '/src/assets/maps/Story/S0401.png',
  'level-4':  '/src/assets/maps/Story/S0501.png',
  'level-5':  '/src/assets/maps/Story/S0601.png',
  'level-6':  '/src/assets/maps/Story/S0701.png',
  'level-7':  '/src/assets/maps/Story/S0901.png',
  'level-8':  '/src/assets/maps/Story/S0102.png',
  'level-9':  '/src/assets/maps/Story/S0202.png',
  'level-10': '/src/assets/maps/Story/S0302.png',
  'level-11': '/src/assets/maps/Story/S0502.png',
  'level-12': '/src/assets/maps/Story/S0702.png',
  'level-13': '/src/assets/maps/Story/S1001.png',
  'level-14': '/src/assets/maps/Story/S1101.png',
};
const DEFAULT_MAP_IMG = '/src/assets/maps/map-01-noche-valdris.jpg';

// ── Clase principal ────────────────────────────────────────────────────────────
export class GamePage {

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private container!: HTMLElement;
  private gameState!: GameState;
  private levelId?: string;
  private useProceduralMap = false;
  private aiLevelLabel = '';
  private aiMapImagePath?: string;

  private selectedUnit:   Unit | null = null;
  private reachableTiles: Position[]  = [];
  private pendingAttack:  Unit | null = null;   // enemigo seleccionado para atacar
  private highlightUnit:  Unit | null = null;   // resaltado durante fase IA

  private mapImage: HTMLImageElement | null = null;
  private charImages: Record<string, HTMLImageElement> = {};

  private floats: Array<{ x:number; y:number; text:string; color:string; frame:number }> = [];
  private animFrame = 0;
  private flashTargets = new Map<string, number>(); // unitId → flash alpha
  private deathAlphas  = new Map<string, number>(); // unitId → opacity (1=visible, 0=gone)

  // ── Animación de caminata ──────────────────────────────────────────────────
  private walkOffsets  = new Map<string, number>(); // unitId → dy de rebote (px)
  private isAnimating  = false;

  // ── Animación de sprites ───────────────────────────────────────────────────
  private facingRight   = new Map<string, boolean>();
  private combatOffsets = new Map<string, {x:number,y:number}>();
  private combatImpact  = new Map<string, number>();
  private charAtkImages: Record<string, HTMLImageElement> = {};
  private inAttackAnim  = new Set<string>();

  // ── Battle Screen overlay ─────────────────────────────────────────────────
  private battleOvl:    HTMLDivElement | null = null;
  private battleCvs:    HTMLCanvasElement | null = null;
  private battleOvlRaf  = 0;
  private battleBgLayers: HTMLImageElement[] = [];
  private battleAtkOff  = 0;   // px horizontal offset for attacker sprite
  private battleDefOff  = 0;   // px horizontal offset for defender sprite
  private battleAtkFlash = 0;  // 0-1 red flash intensity
  private battleDefFlash = 0;
  private battleFloats: Array<{ text: string; color: string; x: number; y: number; age: number }> = [];

  // ── Cámara ────────────────────────────────────────────────────────────────
  private camera    = { x: 0, y: 0 };
  private cameraTgt = { x: 0, y: 0 };

  // ── Toque táctil ──────────────────────────────────────────────────────────
  private touchStartX    = 0;
  private touchStartY    = 0;
  private touchStartCamX = 0;
  private touchStartCamY = 0;
  private touchMoved     = false;

  // ── Cursor de teclado/ratón ────────────────────────────────────────────────
  private cursor:      Position   = { x: 0, y: 0 };
  private showCursor   = false;
  private hoveredPath: Position[] = [];
  private boundKeyDown?: (e: KeyboardEvent) => void;

  /** Layout activo: backend o fallback hardcodeado */
  private get layout(): number[][] {
    return this.gameState?.mapLayout ?? MAP_LAYOUT;
  }

  // ── Render principal ───────────────────────────────────────────────────────
  async render(
    container: HTMLElement,
    initialState?: GameState,
    levelId?: string,
    aiLabel?: string,
    aiMapImage?: string,
  ): Promise<void> {
    this.container = container;
    this.levelId   = levelId;
    this.aiLevelLabel     = aiLabel ?? '';
    this.useProceduralMap = !levelId; // sin levelId → renderiza con colores de terreno
    this.aiMapImagePath   = aiMapImage;

    container.innerHTML = this.buildHTML();
    this.canvas = container.querySelector('#game-canvas') as HTMLCanvasElement;
    this.ctx    = this.canvas.getContext('2d')!;

    if (initialState) {
      this.gameState = initialState;
    } else {
      try {
        this.gameState = await GameService.newGame();
      } catch {
        this.gameState = this.fallbackState();
      }
    }

    await Promise.all([this.loadMap(), this.loadChars()]);
    AudioManager.playLevelMusic(levelId);

    // Centrar cámara en la primera unidad del jugador al iniciar
    const firstPlayer = this.gameState.units.find(u => u.team === 'player' && u.alive);
    if (firstPlayer) {
      this.centerCameraOn(firstPlayer.position);
      this.camera = { ...this.cameraTgt }; // sin animación al inicio
    }

    this.draw();
    this.bindEvents();
  }

  // ── Calcula el tamaño de pantalla óptimo para el canvas ───────────────────
  private calcDisplaySize(): { w: number; h: number } {
    const topbarH  = 58;   // topbar height + gaps
    const padTotal = 20;   // padding
    const sidebarW = 256;  // 240px sidebar + gap + border
    const availH   = window.innerHeight - topbarH - padTotal;
    const availW   = window.innerWidth  - sidebarW - padTotal;
    const scale    = Math.min(availH / VIEWPORT_H, availW / VIEWPORT_W);
    return { w: Math.round(VIEWPORT_W * scale), h: Math.round(VIEWPORT_H * scale) };
  }

  // ── HTML ───────────────────────────────────────────────────────────────────
  private buildHTML(): string {
    const W = VIEWPORT_W, H = VIEWPORT_H;
    const { w: dw, h: dh } = this.calcDisplaySize();
    const aiHtml = this.aiLevelLabel
      ? `<span id="game-ai-label">🤖 ${this.aiLevelLabel}</span>`
      : '';
    return `
      <div class="game-wrapper">
        <div class="game-topbar">
          <span id="game-phase">⚔ FASE DEL JUGADOR</span>
          ${aiHtml}
          <span id="game-turn">TURNO 1</span>
        </div>
        <div class="game-layout">
          <div class="game-map-wrapper" style="position:relative;">
            <canvas id="game-canvas" width="${W}" height="${H}" style="width:${dw}px;height:${dh}px;"></canvas>
            <div id="combat-preview" style="display:none; position:absolute; bottom:0; left:0; right:0;
              background:rgba(13,17,23,0.97); border-top:1px solid rgba(200,146,42,0.5);
              padding:12px 16px; font-family:var(--font-ui,monospace); color:#fff; font-size:0.6rem;">
              <div style="display:flex; gap:16px; align-items:center;">
                <div id="prev-atk" style="flex:1; text-align:center;"></div>
                <div style="color:#f0c040; font-size:0.75rem; font-weight:bold;">VS</div>
                <div id="prev-def" style="flex:1; text-align:center;"></div>
              </div>
              <div style="display:flex; gap:8px; margin-top:10px; justify-content:center;">
                <button id="btn-confirm-atk" class="game-btn game-btn-gold" style="flex:1; max-width:120px;">⚔ ATACAR</button>
                <button id="btn-cancel-atk"  class="game-btn game-btn-red"  style="flex:1; max-width:120px;">✕ CANCELAR</button>
              </div>
            </div>
          </div>

          <div class="game-sidebar">
            <div class="unit-card" id="unit-info" style="min-height:160px;">
              <div class="unit-card-name" id="ui-name" style="color:#888;">— Sin selección —</div>
              <div id="ui-body"></div>
            </div>

            <div class="game-msgbox" id="game-msg">Selecciona una unidad aliada.</div>

            <div class="game-controls">
              <button class="game-btn game-btn-gold" id="btn-endturn">▶ FIN DE TURNO</button>
              <button class="game-btn" id="btn-wait">⏸ ESPERAR</button>
              <button class="game-btn" id="btn-menu">↩ MENÚ</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Carga de assets ────────────────────────────────────────────────────────
  private loadMap(): Promise<void> {
    const src = this.useProceduralMap
      ? this.aiMapImagePath ?? ''
      : (this.levelId && LEVEL_MAP_IMAGES[this.levelId]) ?? DEFAULT_MAP_IMG;
    if (!src) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { this.mapImage = img; resolve(); };
      img.onerror = () => {
        if (src !== DEFAULT_MAP_IMG) {
          const fallback = new Image();
          fallback.onload  = () => { this.mapImage = fallback; resolve(); };
          fallback.onerror = () => resolve();
          fallback.src = DEFAULT_MAP_IMG;
        } else {
          resolve();
        }
      };
      img.src = src;
    });
  }

  private async loadChars(): Promise<void> {
    // sprite-*.png = retratos BtlFace de FEH, fallback a portraits originales
    const BASE = '/src/assets/characters';
    const idleMap: Record<string, string[]> = {
      Lord:        [`${BASE}/sprite-lord.png`,     `${BASE}/lord.png`,       `${BASE}/character-2.png`],
      Paladin:     [`${BASE}/sprite-paladin.png`,  `${BASE}/paladin.png`,    `${BASE}/character-3.png`],
      Cavalier:    [`${BASE}/sprite-cavalier.png`, `${BASE}/cavalier.png`,   `${BASE}/character-3.png`],
      Healer:      [`${BASE}/sprite-healer.png`,   `${BASE}/healer.png`,     `${BASE}/character-5.png`],
      Mage:        [`${BASE}/sprite-mage-p.png`,   `${BASE}/mage-player.png`,`${BASE}/character-5.png`],
      Warrior:     [`${BASE}/sprite-warrior.png`,  `${BASE}/warrior.png`,    `${BASE}/character-4.png`],
      Bandit:      [`${BASE}/sprite-warrior.png`,  `${BASE}/bandit.png`,     `${BASE}/character-4.png`],
      Knight:      [`${BASE}/sprite-knight.png`,   `${BASE}/knight.png`,     `${BASE}/character-3.png`],
      General:     [`${BASE}/sprite-knight.png`,   `${BASE}/knight.png`,     `${BASE}/character-3.png`],
      DarkGeneral: [`${BASE}/sprite-knight.png`,   `${BASE}/knight.png`,     `${BASE}/character-3.png`],
      Myrmidon:    [`${BASE}/sprite-myrmidon.png`, `${BASE}/myrmidon.png`,   `${BASE}/character-2.png`],
      Archer:      [`${BASE}/sprite-archer.png`,   `${BASE}/archer.png`,     `${BASE}/character-6.png`],
      Thief:       [`${BASE}/sprite-thief.png`,    `${BASE}/thief.png`,      `${BASE}/character-6.png`],
      Sorcerer:    [`${BASE}/sprite-sorcerer.png`, `${BASE}/mage-enemy.png`, `${BASE}/character-5.png`],
      'Mage-enemy':[`${BASE}/sprite-mage-e.png`,   `${BASE}/mage-enemy.png`, `${BASE}/character-5.png`],
    };
    const atkMap: Record<string, string[]> = {
      Lord:        [`${BASE}/sprite-lord-atk.png`],
      Paladin:     [`${BASE}/sprite-paladin-atk.png`],
      Cavalier:    [`${BASE}/sprite-cavalier-atk.png`],
      Healer:      [`${BASE}/sprite-healer-atk.png`],
      Mage:        [`${BASE}/sprite-mage-p-atk.png`],
      Warrior:     [`${BASE}/sprite-warrior-atk.png`],
      Bandit:      [`${BASE}/sprite-warrior-atk.png`],
      Knight:      [`${BASE}/sprite-knight-atk.png`],
      General:     [`${BASE}/sprite-knight-atk.png`],
      DarkGeneral: [`${BASE}/sprite-knight-atk.png`],
      Myrmidon:    [`${BASE}/sprite-myrmidon-atk.png`],
      Archer:      [`${BASE}/sprite-archer-atk.png`],
      Thief:       [`${BASE}/sprite-thief-atk.png`],
      Sorcerer:    [`${BASE}/sprite-sorcerer-atk.png`],
      'Mage-enemy':[`${BASE}/sprite-mage-e-atk.png`],
    };
    const load = (src: string) => new Promise<HTMLImageElement | null>(res => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
    });
    await Promise.all([
      ...Object.entries(idleMap).map(async ([cls, paths]) => {
        for (const p of paths) { const img = await load(p); if (img) { this.charImages[cls] = img; break; } }
      }),
      ...Object.entries(atkMap).map(async ([cls, paths]) => {
        for (const p of paths) { const img = await load(p); if (img) { this.charAtkImages[cls] = img; break; } }
      }),
    ]);
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  private draw(): void {
    const ctx = this.ctx;

    // Lerp suave de cámara hacia el objetivo
    const lp = 0.12;
    this.camera.x += (this.cameraTgt.x - this.camera.x) * lp;
    this.camera.y += (this.cameraTgt.y - this.camera.y) * lp;
    if (Math.abs(this.camera.x - this.cameraTgt.x) < 0.5) this.camera.x = this.cameraTgt.x;
    if (Math.abs(this.camera.y - this.cameraTgt.y) < 0.5) this.camera.y = this.cameraTgt.y;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    // Terreno — imagen real (campaña o IA con imagen asignada) o tiles procedurales
    if (this.mapImage) {
      ctx.drawImage(this.mapImage, 0, 0, COLS * TILE, ROWS * TILE);
    } else {
      for (let y = 0; y < ROWS; y++)
        for (let x = 0; x < COLS; x++) {
          const t = this.layout[y]?.[x] ?? 0;
          this.drawTerrainTile(ctx, t, x, y, (x + y) % 2 === 0);
        }
    }

    // Grid sutil
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x*TILE,0); ctx.lineTo(x*TILE,ROWS*TILE); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0,y*TILE); ctx.lineTo(COLS*TILE,y*TILE); ctx.stroke(); }

    // Tiles de movimiento (azul)
    for (const p of this.reachableTiles) {
      ctx.fillStyle = 'rgba(74,158,255,0.32)';
      ctx.fillRect(p.x*TILE, p.y*TILE, TILE, TILE);
      ctx.strokeStyle = '#4a9eff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x*TILE+1, p.y*TILE+1, TILE-2, TILE-2);
    }

    // Rango de ataque (rojo) si hay unidad seleccionada y ya se movió
    if (this.selectedUnit) {
      const enemies = this.getAttackableEnemies(this.selectedUnit);
      for (const e of enemies) {
        ctx.fillStyle = 'rgba(255,74,74,0.32)';
        ctx.fillRect(e.position.x*TILE, e.position.y*TILE, TILE, TILE);
        ctx.strokeStyle = '#ff4a4a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(e.position.x*TILE+1, e.position.y*TILE+1, TILE-2, TILE-2);
      }
    }

    // Unidades (incluye las que están en animación de muerte)
    for (const unit of this.gameState?.units ?? []) {
      if (!unit.alive && !this.deathAlphas.has(unit.id)) continue;
      this.drawUnit(unit);
    }

    // Selección amarilla (pulso animado)
    if (this.selectedUnit) {
      const p = this.selectedUnit.position;
      const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 200);
      ctx.strokeStyle = `rgba(240,192,64,${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x*TILE+2, p.y*TILE+2, TILE-4, TILE-4);
    }

    // Resaltado IA (azul claro)
    if (this.highlightUnit) {
      const p = this.highlightUnit.position;
      ctx.strokeStyle = '#80cfff';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x*TILE+2, p.y*TILE+2, TILE-4, TILE-4);
    }

    // Camino de hover (línea blanca punteada)
    if (this.hoveredPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(this.hoveredPath[0].x*TILE + TILE/2, this.hoveredPath[0].y*TILE + TILE/2);
      for (let i = 1; i < this.hoveredPath.length; i++)
        ctx.lineTo(this.hoveredPath[i].x*TILE + TILE/2, this.hoveredPath[i].y*TILE + TILE/2);
      ctx.stroke();
      // Flecha en el destino
      const last = this.hoveredPath[this.hoveredPath.length - 1];
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(last.x*TILE + TILE/2, last.y*TILE + TILE/2, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Cursor (teclado o ratón)
    if (this.showCursor) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 170);
      ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(this.cursor.x*TILE + 2, this.cursor.y*TILE + 2, TILE-4, TILE-4);
      ctx.setLineDash([]);
    }

    // Números flotantes de daño
    this.drawFloats();
    ctx.restore();
    this.updateSidebar();
  }

  private drawUnit(unit: Unit): void {
    const ctx  = this.ctx;
    const cOff = this.combatOffsets.get(unit.id) ?? { x: 0, y: 0 };
    const walkDy = this.walkOffsets.get(unit.id) ?? 0;
    const impact = this.combatImpact.get(unit.id) ?? 1;

    const px = Math.round(unit.position.x * TILE + cOff.x);
    const py = Math.round(unit.position.y * TILE + walkDy + cOff.y);

    const deathAlpha = this.deathAlphas.get(unit.id) ?? 1;
    const isDone     = unit.hasMoved || unit.hasActed;
    const isAtk      = this.inAttackAnim.has(unit.id);
    const clsKey     = unit.unitClass === 'Mage' && unit.team === 'enemy' ? 'Mage-enemy' : unit.unitClass;
    const img        = isAtk ? (this.charAtkImages[clsKey] ?? this.charImages[clsKey]) : this.charImages[clsKey];
    const facingR    = this.facingRight.get(unit.id) ?? (unit.team === 'player');

    ctx.save();
    ctx.globalAlpha = deathAlpha * (isDone ? 0.5 : 1);

    // Sombra elíptica bajo el personaje
    ctx.beginPath();
    ctx.ellipse(px + TILE/2, py + TILE - 2, TILE * 0.30, TILE * 0.08, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Dimensiones del sprite con squash/stretch de impacto
    const sprW = Math.round(TILE * 0.90 * impact);
    const sprH = Math.round(TILE * 0.90 / impact);
    const sprX = px + Math.round((TILE - sprW) / 2);
    const sprY = py + TILE - sprH - 2;

    // Fondo de equipo (rectángulo con gradiente visual)
    const teamBg = unit.team === 'player' ? 'rgba(20,60,130,0.82)' : 'rgba(110,15,15,0.82)';
    ctx.fillStyle = teamBg;
    ctx.fillRect(sprX - 1, sprY - 1, sprW + 2, sprH + 2);

    // Imagen del personaje (con volteo horizontal para orientación)
    ctx.save();
    if (!facingR) {
      ctx.translate(px + TILE / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(px + TILE / 2), 0);
    }
    if (img) {
      if (isDone) ctx.filter = 'grayscale(65%) brightness(0.6)';
      const { width: iw, height: ih } = img;
      // Mostrar retrato completo (FEH BtlFace muestra cabeza/torso)
      ctx.drawImage(img, 0, 0, iw, ih, sprX, sprY, sprW, sprH);
      ctx.filter = 'none';
    } else {
      ctx.font        = `${Math.round(TILE * 0.42)}px serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle   = '#fff';
      ctx.fillText(unit.team === 'player' ? '⚔' : '💀', px + TILE / 2, sprY + sprH / 2);
    }
    ctx.restore();

    // Borde de equipo (brillante si no ha actuado)
    const teamClr = unit.team === 'player' ? '#4a9eff' : '#ff4a4a';
    ctx.strokeStyle = teamClr;
    ctx.lineWidth   = isDone ? 1 : 2;
    if (!isDone) { ctx.shadowColor = teamClr; ctx.shadowBlur = 6; }
    ctx.strokeRect(sprX - 1, sprY - 1, sprW + 2, sprH + 2);
    ctx.shadowBlur = 0;

    // Barra de HP
    const barW  = TILE - 4;
    const barX  = px + 2;
    const barY  = py + TILE - 1;
    const hpPct = unit.currentHp / unit.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#f0c040' : '#e53935';
    ctx.fillRect(barX, barY, Math.round(barW * hpPct), 5);

    // Badge de nombre encima del sprite
    const nameText = unit.name.substring(0, 5);
    ctx.font = `bold ${Math.round(TILE * 0.19)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = 'rgba(0,0,0,0.8)';
    ctx.fillRect(px + 1, py, TILE - 2, Math.round(TILE * 0.22));
    ctx.fillStyle = unit.team === 'player' ? '#a8d8ff' : '#ffb8b8';
    ctx.fillText(nameText, px + TILE / 2, py + 2);

    // Flash de daño
    const flashAlpha = this.flashTargets.get(unit.id) ?? 0;
    if (flashAlpha > 0) {
      ctx.globalAlpha = flashAlpha * deathAlpha;
      ctx.fillStyle   = '#ff1010';
      ctx.fillRect(sprX, sprY, sprW, sprH);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawFloats(): void {
    const ctx = this.ctx;
    const alive: typeof this.floats = [];
    for (const f of this.floats) {
      const alpha = Math.max(0, 1 - f.frame / 55);
      const offsetY = -(f.frame * 0.6);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${TILE*0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y + offsetY);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y + offsetY);
      ctx.globalAlpha = 1;
      f.frame++;
      if (f.frame < 55) alive.push(f);
    }
    this.floats = alive;
  }

  private drawTerrainTile(ctx: CanvasRenderingContext2D, type: number, tx: number, ty: number, even: boolean): void {
    const px = tx * TILE, py = ty * TILE;
    switch (type) {
      case 0: { // PLAINS — graduated green with grass streaks
        const g = ctx.createLinearGradient(px, py, px, py + TILE);
        g.addColorStop(0, even ? '#5a9040' : '#4e8238'); g.addColorStop(1, even ? '#48782e' : '#3e6826');
        ctx.fillStyle = g; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.8;
        for (let i = 1; i < 4; i++) {
          const lx = px + i * TILE / 4;
          ctx.beginPath(); ctx.moveTo(lx, py + 6); ctx.lineTo(lx - 4, py + TILE - 6); ctx.stroke();
        }
        break;
      }
      case 1: { // FOREST — deep green with tree crowns
        ctx.fillStyle = even ? '#1d5c1d' : '#256825'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = even ? '#14481a' : '#1c5420';
        for (let i = 0; i < 3; i++) {
          const cx2 = px + 10 + i * 18, cy2 = py + 20;
          ctx.beginPath(); ctx.arc(cx2, cy2, 9, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = even ? '#0d3612' : '#163e18';
        for (let i = 0; i < 2; i++) {
          const cx2 = px + 19 + i * 18, cy2 = py + 30;
          ctx.beginPath(); ctx.arc(cx2, cy2, 8, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 2: { // MOUNTAIN — gray with triangular peak and snow cap
        ctx.fillStyle = even ? '#686868' : '#7a7a7a'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = even ? '#4e4e4e' : '#5e5e5e';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py + 4);
        ctx.lineTo(px + 4, py + TILE - 8);
        ctx.lineTo(px + TILE - 4, py + TILE - 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8d8d8';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py + 4);
        ctx.lineTo(px + TILE / 2 - 8, py + 18);
        ctx.lineTo(px + TILE / 2 + 8, py + 18);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 3: { // WATER — blue with animated-look wave lines
        const gw = ctx.createLinearGradient(px, py, px, py + TILE);
        gw.addColorStop(0, even ? '#1a4e99' : '#1e58aa'); gw.addColorStop(1, even ? '#133c7a' : '#164488');
        ctx.fillStyle = gw; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const wy = py + 12 + i * 16;
          ctx.beginPath(); ctx.moveTo(px, wy);
          for (let wx = 0; wx < TILE; wx += 8)
            ctx.quadraticCurveTo(px + wx + 4, wy - 4, px + wx + 8, wy);
          ctx.stroke();
        }
        break;
      }
      case 4: { // FORT — stone brick pattern
        ctx.fillStyle = even ? '#8a6422' : '#9a7230'; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = even ? '#5a4010' : '#6a4e18'; ctx.lineWidth = 1;
        const bh = Math.round(TILE / 3);
        for (let row = 0; row < 3; row++) {
          const off = row % 2 === 0 ? 0 : Math.round(TILE / 4);
          const byr = py + row * bh;
          ctx.strokeRect(px - 1, byr, TILE + 2, bh);
          for (let bx2 = -Math.round(TILE / 4); bx2 < TILE; bx2 += Math.round(TILE / 2))
            ctx.strokeRect(px + bx2 + off, byr, Math.round(TILE / 2), bh);
        }
        break;
      }
      case 5: { // ROAD — sandy path with worn tracks
        const gr = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
        gr.addColorStop(0, even ? '#baa878' : '#cabb8e'); gr.addColorStop(1, even ? '#a89060' : '#b8a270');
        ctx.fillStyle = gr; ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px + TILE * 0.28, py); ctx.lineTo(px + TILE * 0.28, py + TILE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + TILE * 0.72, py); ctx.lineTo(px + TILE * 0.72, py + TILE); ctx.stroke();
        break;
      }
      default: {
        const [c1, c2] = TERRAIN_COLORS[type] ?? TERRAIN_COLORS[0];
        ctx.fillStyle = even ? c1 : c2; ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }

  private addFloat(pos: Position, text: string, color = '#fff'): void {
    this.floats.push({ x: pos.x*TILE + TILE/2, y: pos.y*TILE + TILE*0.4, text, color, frame: 0 });
    if (!this.animFrame) this.startAnim();
  }

  private needsAnim(): boolean {
    const camMoving = Math.abs(this.camera.x - this.cameraTgt.x) > 0.5
                   || Math.abs(this.camera.y - this.cameraTgt.y) > 0.5;
    return camMoving
      || this.floats.length > 0
      || this.selectedUnit !== null
      || this.flashTargets.size > 0
      || this.deathAlphas.size > 0
      || this.walkOffsets.size > 0
      || this.combatOffsets.size > 0
      || this.combatImpact.size > 0
      || this.showCursor;
  }

  private centerCameraOn(pos: Position): void {
    const maxCamX = COLS * TILE - VIEWPORT_W;
    const maxCamY = ROWS * TILE - VIEWPORT_H;
    this.cameraTgt = {
      x: Math.max(0, Math.min(maxCamX, pos.x * TILE + TILE / 2 - VIEWPORT_W  / 2)),
      y: Math.max(0, Math.min(maxCamY, pos.y * TILE + TILE / 2 - VIEWPORT_H / 2)),
    };
    if (!this.animFrame) this.startAnim();
  }

  private startAnim(): void {
    const loop = () => {
      if (this.needsAnim()) {
        this.draw();
        this.animFrame = requestAnimationFrame(loop);
      } else {
        this.animFrame = 0;
      }
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  private updateSidebar(): void {
    const phaseEl = this.container.querySelector('#game-phase') as HTMLElement;
    const turnEl  = this.container.querySelector('#game-turn')  as HTMLElement;
    const nameEl  = this.container.querySelector('#ui-name')    as HTMLElement;
    const bodyEl  = this.container.querySelector('#ui-body')    as HTMLElement;

    if (phaseEl) phaseEl.textContent = this.gameState.currentPhase === 'PLAYER'
      ? '⚔ FASE DEL JUGADOR' : '💀 FASE ENEMIGA';
    if (turnEl)  turnEl.textContent  = `TURNO ${this.gameState.turnNumber}`;

    const u = this.selectedUnit;
    if (!u || !nameEl || !bodyEl) return;

    nameEl.textContent = `${u.team === 'player' ? '⚔' : '💀'} ${u.name.toUpperCase()}`;
    nameEl.style.color = u.team === 'player' ? '#f0c040' : '#ff8888';

    const hpPct = (u.currentHp / u.maxHp * 100).toFixed(0);
    const hpCol = u.currentHp/u.maxHp > 0.5 ? '#4caf50' : u.currentHp/u.maxHp > 0.25 ? '#f0c040' : '#e53935';
    const w = u.equippedWeapon;

    bodyEl.innerHTML = `
      <div class="unit-stat">Clase: <span>${u.unitClass}</span>  Lv<span>${u.level}</span>  EXP:<span>${u.exp}/100</span></div>
      <div class="unit-stat">HP: <span style="color:${hpCol}">${u.currentHp}/${u.maxHp}</span></div>
      <div class="unit-hpbar-bg"><div class="unit-hpbar" style="width:${hpPct}%;background:${hpCol};"></div></div>
      <div class="unit-stat">STR:<span>${u.str}</span>  MAG:<span>${u.mag}</span>  SKL:<span>${u.skl}</span></div>
      <div class="unit-stat">SPD:<span>${u.spd}</span>  LCK:<span>${u.lck}</span>  DEF:<span>${u.def}</span>  RES:<span>${u.res}</span></div>
      <div class="unit-stat">MOV:<span>${u.mov}</span></div>
      ${w ? `<div class="unit-stat" style="margin-top:4px;">🗡 <span style="color:#f0c040">${w.name}</span>
        <span style="font-size:0.55rem;color:#aaa;"> MT:${w.might} HIT:${w.hit} CRT:${w.crit}</span></div>` : ''}
      <div class="unit-stat" style="margin-top:4px;">${u.hasMoved ? '⏸ <span style="color:#aaa">Ya actuó</span>' : '✓ <span style="color:#6f6">Listo</span>'}</div>`;
  }

  private msg(text: string): void {
    const el = this.container.querySelector('#game-msg') as HTMLElement;
    if (el) el.textContent = text;
  }

  // ── Lógica de movimiento ───────────────────────────────────────────────────
  private calcMovement(unit: Unit): Position[] {
    const reachable: Position[] = [];
    const costs = new Map<string, number>();
    const key = (p: Position) => `${p.x},${p.y}`;
    costs.set(key(unit.position), 0);
    reachable.push({ ...unit.position });

    let frontier = [{ x: unit.position.x, y: unit.position.y, cost: 0 }];
    while (frontier.length > 0) {
      const cur = frontier.shift()!;
      for (const nb of [
        { x: cur.x+1, y: cur.y }, { x: cur.x-1, y: cur.y },
        { x: cur.x, y: cur.y+1 }, { x: cur.x, y: cur.y-1 },
      ]) {
        if (nb.x < 0 || nb.x >= COLS || nb.y < 0 || nb.y >= ROWS) continue;
        const t = this.layout[nb.y]?.[nb.x] ?? 0;
        const movCost = TERRAIN_COST[t] ?? 99;
        if (movCost === 99) continue;
        const blocker = this.gameState.units.find(u => u.alive && u.position.x === nb.x && u.position.y === nb.y && u.id !== unit.id);
        if (blocker) continue;
        const newCost = cur.cost + movCost;
        const k = key(nb);
        if (newCost <= unit.mov && (!costs.has(k) || costs.get(k)! > newCost)) {
          costs.set(k, newCost);
          reachable.push(nb);
          frontier.push({ ...nb, cost: newCost });
          frontier.sort((a, b) => a.cost - b.cost);
        }
      }
    }
    return reachable;
  }

  private getAttackableEnemies(unit: Unit): Unit[] {
    const w = unit.equippedWeapon;
    const minR = w ? w.minRange : 1;
    const maxR = w ? w.maxRange : 1;
    return this.gameState.units.filter(u =>
      u.alive && u.team !== unit.team &&
      dist(unit.position, u.position) >= minR &&
      dist(unit.position, u.position) <= maxR
    );
  }

  private getUnitAt(x: number, y: number): Unit | undefined {
    return this.gameState.units.find(u => u.alive && u.position.x === x && u.position.y === y);
  }

  // ── Acciones del jugador ───────────────────────────────────────────────────
  private selectUnit(unit: Unit): void {
    this.selectedUnit  = unit;
    this.pendingAttack = null;
    this.reachableTiles = unit.hasMoved ? [] : this.calcMovement(unit);
    const enemies = this.getAttackableEnemies(unit);
    if (enemies.length > 0)
      this.msg(`${unit.name}: puede atacar ${enemies.length} enemigo(s) en rojo.`);
    else
      this.msg(`${unit.name} seleccionado. Casillas azules = movimiento.`);
    this.centerCameraOn(unit.position);
    this.draw();
    if (!this.animFrame) this.startAnim();
  }

  private async moveSelectedTo(x: number, y: number): Promise<void> {
    if (!this.selectedUnit || this.isAnimating) return;
    const unit   = this.selectedUnit;
    const from   = { x: unit.position.x, y: unit.position.y };
    unit.hasMoved      = true;
    this.reachableTiles = [];
    this.selectedUnit   = null;
    this.hoveredPath    = [];
    this.isAnimating    = true;
    this.msg(`${unit.name} se mueve…`);
    this.startAnim();
    await this.animatePlayerMovement(unit, from, { x, y });
    this.isAnimating = false;
    this.msg(`${unit.name} se movió a (${x},${y}).`);
    this.draw();
    this.checkAllMoved();
  }

  private showCombatPreview(attacker: Unit, defender: Unit): void {
    this.pendingAttack = defender;
    const p = calcPreview(attacker, defender, this.layout);
    const advSymbol = p.weaponAdvantage === 'ATTACKER' ? '▲' : p.weaponAdvantage === 'DEFENDER' ? '▼' : '–';

    const atkBlock = this.container.querySelector('#prev-atk') as HTMLElement;
    const defBlock = this.container.querySelector('#prev-def') as HTMLElement;
    if (!atkBlock || !defBlock) return;

    const row = (label: string, val: string, color = '#e0e0e0') =>
      `<div style="display:flex;justify-content:space-between;gap:8px;line-height:1.7;">
         <span style="color:#777;white-space:nowrap;">${label}</span>
         <span style="color:${color};font-weight:bold;white-space:nowrap;">${val}</span>
       </div>`;

    const fmt = (name: string, hp: number, maxHp: number, dmg: number, hit: number, crit: number, dbl: boolean, weapon: string) =>
      `<div style="font-size:0.72rem;font-weight:bold;color:#f0c040;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
       <div style="font-size:0.55rem;color:#888;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🗡 ${weapon}</div>
       <div style="font-size:0.62rem;">
         ${row('HP', `${hp}/${maxHp}`, hp/maxHp > 0.5 ? '#4caf50' : hp/maxHp > 0.25 ? '#f0c040' : '#e53935')}
         ${row('DMG', String(dmg), '#ff9a9a')}
         ${row('HIT', `${hit}%`)}
         ${row('CRT', `${crit}%${dbl ? ' ×2' : ''}`, crit > 0 ? '#ffee66' : '#e0e0e0')}
       </div>`;

    atkBlock.innerHTML = fmt(p.attackerName, p.attackerHp, attacker.maxHp, p.attackerDamage, p.attackerHitRate, p.attackerCritRate, p.attackerDoubleAttacks, p.attackerWeaponName)
      + `<div style="margin-top:5px;font-size:0.6rem;color:#f0c040;text-align:center;">WPN ${advSymbol}</div>`;
    defBlock.innerHTML = p.defenderCanCounter
      ? fmt(p.defenderName, p.defenderHp, defender.maxHp, p.defenderDamage, p.defenderHitRate, p.defenderCritRate, p.defenderDoubleAttacks, p.defenderWeaponName)
      : `<div style="font-size:0.72rem;font-weight:bold;color:#666;margin-bottom:5px;">${p.defenderName}</div>
         <div style="font-size:0.6rem;color:#555;margin-bottom:4px;">Sin contraataque</div>
         ${`<div style="font-size:0.62rem;">${row('HP', `${p.defenderHp}/${defender.maxHp}`, '#4caf50')}</div>`}`;

    const panel = this.container.querySelector('#combat-preview') as HTMLElement;
    if (panel) panel.style.display = 'block';
  }

  private hideCombatPreview(): void {
    const panel = this.container.querySelector('#combat-preview') as HTMLElement;
    if (panel) panel.style.display = 'none';
    this.pendingAttack = null;
  }

  private async executeAttack(attacker: Unit, defender: Unit): Promise<void> {
    this.hideCombatPreview();
    this.isAnimating = true;
    AudioManager.playSfx('confirm');

    // Vars that survive the try/catch for post-close cleanup
    let defDefeated = false, atkDefeated = false, expGained = 0;
    let levelUpGains: string[] = [];

    // Modo IA: usar combate local directamente (estado no existe en backend)
    if (this.useProceduralMap) {
      await this.localAttack(attacker, defender);
      attacker.hasMoved = true; attacker.hasActed = true;
      this.selectedUnit = null; this.reachableTiles = [];
      this.isAnimating  = false;
      this.draw(); this.checkWin(); this.checkAllMoved();
      return;
    }

    // Open overlay ONCE before try/catch — never inside
    await this.openBattleScreen(attacker, defender);

    try {
      const result = await GameService.attackUnit(attacker.id, defender.id);

      for (const round of result.rounds) {
        const isAtkTurn = round.attackerId === attacker.id;
        const tgt       = isAtkTurn ? defender : attacker;
        const atkSide   = (isAtkTurn ? 'attacker' : 'defender') as 'attacker' | 'defender';
        const defSide   = (isAtkTurn ? 'defender' : 'attacker') as 'attacker' | 'defender';
        const magical   = !!(isAtkTurn ? attacker : defender).equippedWeapon?.magical;

        await this.battleLunge(atkSide);

        if (!round.missed && round.damage > 0) {
          tgt.currentHp = Math.max(0, tgt.currentHp - round.damage);
          await this.battleHit(defSide, round.damage, round.crit, magical);
        } else if (round.missed) {
          this.battleMiss(defSide);
          await this.delay(220);
        }
        await this.delay(55);
      }

      attacker.currentHp = result.attackerFinalHp;
      defender.currentHp = result.defenderFinalHp;
      defDefeated  = result.defenderDefeated;
      atkDefeated  = result.attackerDefeated;
      expGained    = result.attackerExpGained;
      levelUpGains = result.attackerLevelUpGains ?? [];

      if (expGained > 0) {
        attacker.exp += expGained;
        if (attacker.exp >= 100) {
          attacker.exp -= 100; attacker.level++;
          const W = this.battleCvs?.width ?? 880, H = this.battleCvs?.height ?? 660;
          this.battleFloats.push({ text: '★ LV UP!', color: '#f0c040', x: Math.round(W*0.22), y: Math.round(H*0.38), age: 0 });
          AudioManager.playSfx('levelup');
          await this.delay(900);
        }
      }
      if (defDefeated || atkDefeated) { AudioManager.playSfx('death'); await this.delay(350); }

    } catch {
      // Fallback: simulación local completa (contra, doble ataque, crít)
      const r = await this.executeLocalCombatRounds(attacker, defender);
      defDefeated = r.defDefeated; atkDefeated = r.atkDefeated;
      if (defDefeated || atkDefeated) { AudioManager.playSfx('death'); await this.delay(350); }
    }

    // Close overlay ONCE — always runs regardless of try/catch outcome
    await this.closeBattleScreen();

    // Apply death animations on map AFTER overlay is gone
    if (defDefeated) { await this.deathAnimation(defender); defender.alive = false; }
    if (atkDefeated) { await this.deathAnimation(attacker); attacker.alive = false; }

    if (expGained > 0 || defDefeated || atkDefeated) {
      if (defDefeated)      this.msg(`¡${defender.name} derrotado! +${expGained} EXP`);
      else if (atkDefeated) this.msg(`¡${attacker.name} fue derrotado en el contraataque!`);
      else                  this.msg(`${attacker.name} atacó a ${defender.name}. +${expGained} EXP`);
      if (levelUpGains.length > 0 && !levelUpGains[0].startsWith('¡Sin'))
        this.msg(`★ ${attacker.name} ¡SUBE DE NIVEL! ${levelUpGains.join(' ')}`);
    }

    attacker.hasMoved   = true;
    attacker.hasActed   = true;
    this.selectedUnit   = null;
    this.reachableTiles = [];
    this.isAnimating    = false;
    this.draw();
    this.checkWin();
    this.checkAllMoved();
  }

  // ── Fase enemiga (animación correcta: sin aplicar finalState antes de animar) ─
  private async animateEnemyPhase(result: EnemyTurnResult): Promise<void> {
    this.gameState.currentPhase = 'ENEMY';
    this.draw();
    this.msg('Fase enemiga — ¡Los enemigos atacan!');
    await this.delay(400);

    for (const action of result.actions) {
      // Buscar la unidad en el estado ACTUAL (no en finalState)
      const unit = this.gameState.units.find(u => u.id === action.unitId);
      if (!unit || !unit.alive) continue;

      // 1. Resaltar la unidad que va a actuar
      this.highlightUnit = unit;
      this.centerCameraOn(unit.position);
      this.draw();
      await this.delay(250);

      // 2. Animar el movimiento desde posición actual hasta destino
      const from = { x: unit.position.x, y: unit.position.y };
      const to   = { x: action.toX, y: action.toY };
      if (from.x !== to.x || from.y !== to.y) {
        this.centerCameraOn(to);
        await this.animateMovement(unit, from, to);
      }
      await this.delay(150);

      // 3. Combate (si atacó) — usando battle screen overlay
      if (action.attacked && action.combatResult) {
        const cr  = action.combatResult;
        const tgt = this.gameState.units.find(u => u.id === action.targetId);

        if (tgt) {
          await this.openBattleScreen(unit, tgt);

          for (const round of cr.rounds ?? []) {
            const attIsEnemy = round.attackerId === unit.id;
            const atkSide    = attIsEnemy ? 'attacker' : 'defender' as 'attacker' | 'defender';
            const defSide    = attIsEnemy ? 'defender' : 'attacker' as 'attacker' | 'defender';
            const dmgUnit    = attIsEnemy ? tgt : unit;
            const magical    = !!(attIsEnemy ? unit : tgt).equippedWeapon?.magical;

            await this.battleLunge(atkSide);

            if (!round.missed && round.damage > 0) {
              dmgUnit.currentHp = Math.max(0, dmgUnit.currentHp - round.damage);
              await this.battleHit(defSide, round.damage, round.crit, magical);
            } else if (round.missed) {
              this.battleMiss(defSide);
              await this.delay(200);
            }
            await this.delay(55);
          }

          tgt.currentHp = cr.defenderFinalHp;
          if (cr.defenderDefeated || cr.attackerDefeated) {
            AudioManager.playSfx('death');
            await this.delay(350);
          }

          await this.closeBattleScreen();

          if (cr.defenderDefeated) { await this.deathAnimation(tgt); tgt.alive = false; this.msg(`¡${tgt.name} derrotado!`); }
          else { this.msg(`${unit.name} atacó a ${tgt.name}!`); }
          if (cr.attackerDefeated) { await this.deathAnimation(unit); unit.alive = false; }
          await this.delay(200);
        }
      }

      this.highlightUnit = null;
      this.draw();
    }

    // Ahora sí sincronizamos el estado final del servidor
    // (turnNumber, phase, y cualquier cosa que hayamos podido perder)
    this.gameState.turnNumber   = result.finalState.turnNumber;
    this.gameState.currentPhase = 'PLAYER';
    this.gameState.status       = result.finalState.status;

    // Resetear flags de jugador para el nuevo turno
    for (const u of this.gameState.units) {
      if (u.team === 'player') { u.hasMoved = false; u.hasActed = false; }
    }

    this.selectedUnit   = null;
    this.reachableTiles = [];
    this.draw();
    this.msg(`Turno ${this.gameState.turnNumber} — ¡Tu turno! Selecciona una unidad.`);
  }

  // ── Pathfinding BFS con reconstrucción de camino ──────────────────────────
  private findPath(unit: Unit, from: Position, to: Position): Position[] {
    const key    = (p: Position) => `${p.x},${p.y}`;
    const parent = new Map<string, string | null>();
    const costs  = new Map<string, number>();

    parent.set(key(from), null);
    costs.set(key(from), 0);
    const frontier: Array<{ x: number; y: number; cost: number }> = [{ ...from, cost: 0 }];

    while (frontier.length > 0) {
      frontier.sort((a, b) => a.cost - b.cost);
      const cur = frontier.shift()!;
      if (cur.x === to.x && cur.y === to.y) break;

      for (const nb of [
        { x: cur.x+1, y: cur.y }, { x: cur.x-1, y: cur.y },
        { x: cur.x, y: cur.y+1 }, { x: cur.x, y: cur.y-1 },
      ]) {
        if (nb.x < 0 || nb.x >= COLS || nb.y < 0 || nb.y >= ROWS) continue;
        const t       = this.layout[nb.y]?.[nb.x] ?? 0;
        const movCost = TERRAIN_COST[t] ?? 99;
        if (movCost === 99) continue;
        const isTarget = nb.x === to.x && nb.y === to.y;
        const blocker  = this.gameState.units.find(
          u => u.alive && u.position.x === nb.x && u.position.y === nb.y && u.id !== unit.id
        );
        if (blocker && !isTarget) continue;

        const newCost = costs.get(key(cur))! + movCost;
        const k = key(nb);
        if (!costs.has(k) || costs.get(k)! > newCost) {
          costs.set(k, newCost);
          parent.set(k, key(cur));
          frontier.push({ ...nb, cost: newCost });
        }
      }
    }

    // Reconstruir camino desde destino hasta origen
    const path: Position[] = [];
    let cur: string | null | undefined = key(to);
    while (cur) {
      const parts = (cur as string).split(',');
      path.unshift({ x: Number(parts[0]), y: Number(parts[1]) });
      cur = parent.get(cur as string);
    }
    return path.length > 1 ? path : [from, to];
  }

  // ── Movimiento jugador: tile a tile con hop de caminata ────────────────────
  private async animatePlayerMovement(unit: Unit, from: Position, to: Position): Promise<void> {
    const path = this.findPath(unit, from, to);
    for (let i = 1; i < path.length; i++) {
      this.centerCameraOn(path[i]);
      await this.animateWalkStep(unit, path[i - 1], path[i]);
    }
    unit.position = to;
    this.walkOffsets.delete(unit.id);
    this.draw();
  }

  private animateWalkStep(unit: Unit, from: Position, to: Position): Promise<void> {
    // Actualizar orientación según la dirección del movimiento
    if (to.x !== from.x) this.facingRight.set(unit.id, to.x > from.x);

    return new Promise(resolve => {
      const dur   = 155; // ms por casilla
      const start = performance.now();
      const dx = to.x - from.x;
      const dy = to.y - from.y;

      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
        unit.position = { x: from.x + dx*e, y: from.y + dy*e };
        // Hop sinusoidal más pronunciado (caminar visible)
        this.walkOffsets.set(unit.id, -Math.sin(t * Math.PI) * TILE * 0.32);
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else {
          unit.position = to;
          this.walkOffsets.delete(unit.id);
          this.draw();
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  // ── Movimiento suave con easing ease-in-out ─────────────────────────────────
  private animateMovement(unit: Unit, from: Position, to: Position): Promise<void> {
    return new Promise(resolve => {
      const dur   = 320;
      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        // Ease-in-out cuadrático
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        unit.position = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else { unit.position = to; this.draw(); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  // ── Animación de muerte (fade out) ──────────────────────────────────────────
  private deathAnimation(unit: Unit): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const dur   = 500;
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        this.deathAlphas.set(unit.id, 1 - t);
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else { this.deathAlphas.delete(unit.id); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BATTLE SCREEN OVERLAY — fondo de batalla estilo FEH
  // ════════════════════════════════════════════════════════════════════════════

  private async openBattleScreen(attacker: Unit, defender: Unit): Promise<void> {
    const wrapper = this.container.querySelector('.game-map-wrapper') as HTMLElement;
    const W = this.canvas.width, H = this.canvas.height;

    const ovl = document.createElement('div');
    ovl.style.cssText =
      'position:absolute;top:0;left:0;right:0;bottom:0;z-index:20;opacity:0;transition:opacity 0.18s ease;';

    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    cvs.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    ovl.appendChild(cvs);
    wrapper.appendChild(ovl);
    this.battleOvl = ovl;
    this.battleCvs = cvs;

    // Load background layers for terrain under defender
    const row = Math.round(defender.position.y), col = Math.round(defender.position.x);
    const terrain = this.layout[row]?.[col] ?? 0;
    const folder  = TERRAIN_BG_FOLDER[terrain] ?? '002_Plain';
    const imgBase = `${BG_BASE}/${folder}/images`;
    this.battleBgLayers = (await Promise.all(
      ['BG_02.png', 'BG_03.png', 'BG_04.png'].map(f =>
        new Promise<HTMLImageElement | null>(res => {
          const img = new Image();
          img.onload = () => res(img); img.onerror = () => res(null);
          img.src = `${imgBase}/${f}`;
        })
      )
    )).filter(Boolean) as HTMLImageElement[];

    // Reset animation state
    this.battleAtkOff = 0; this.battleDefOff = 0;
    this.battleAtkFlash = 0; this.battleDefFlash = 0;
    this.battleFloats = [];

    // Start render loop
    this.battleOvlRaf = 0;
    const loop = () => {
      if (!this.battleCvs) return;
      this.drawBattleScene(attacker, defender);
      this.battleOvlRaf = requestAnimationFrame(loop);
    };
    this.battleOvlRaf = requestAnimationFrame(loop);

    // Fade in
    requestAnimationFrame(() => { ovl.style.opacity = '1'; });
    await this.delay(200);
  }

  private async closeBattleScreen(): Promise<void> {
    if (!this.battleOvl) return;
    cancelAnimationFrame(this.battleOvlRaf);
    this.battleOvl.style.opacity = '0';
    await this.delay(200);
    this.battleOvl.remove();
    this.battleOvl = null; this.battleCvs = null;
  }

  private drawBattleScene(attacker: Unit, defender: Unit): void {
    const cvs = this.battleCvs!;
    const ctx = cvs.getContext('2d')!;
    const W = cvs.width, H = cvs.height;
    const SPR_H = Math.round(H * 0.66);
    const SPR_W = Math.round(SPR_H * 0.72);
    const SPR_Y = Math.round(H * 0.10);

    // Background layers (or gradient fallback)
    ctx.clearRect(0, 0, W, H);
    if (this.battleBgLayers.length > 0) {
      for (const layer of this.battleBgLayers)
        ctx.drawImage(layer, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0c1220'); g.addColorStop(0.55, '#162a14'); g.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // VS divider glow
    ctx.fillStyle = 'rgba(240,192,64,0.12)';
    ctx.fillRect(W / 2 - 1, 0, 2, H);

    // Attacker (left, faces right)
    const atkCls = attacker.unitClass === 'Mage' && attacker.team === 'enemy' ? 'Mage-enemy' : attacker.unitClass;
    const atkImg = this.charImages[atkCls];
    const atkX   = Math.round(W * 0.22 - SPR_W / 2) + Math.round(this.battleAtkOff);
    this.drawBattleSprite(ctx, atkImg, atkX, SPR_Y, SPR_W, SPR_H, false, this.battleAtkFlash);

    // Defender (right, faces left = mirror)
    const defCls = defender.unitClass === 'Mage' && defender.team === 'enemy' ? 'Mage-enemy' : defender.unitClass;
    const defImg = this.charImages[defCls];
    const defX   = Math.round(W * 0.78 - SPR_W / 2) + Math.round(this.battleDefOff);
    this.drawBattleSprite(ctx, defImg, defX, SPR_Y, SPR_W, SPR_H, true, this.battleDefFlash);

    // HUD panels
    this.drawBattleHUD(ctx, W, H, attacker, defender);

    // Floating damage numbers
    const alive: typeof this.battleFloats = [];
    for (const f of this.battleFloats) {
      const alpha = Math.max(0, 1 - f.age / 45);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(H * 0.085)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
      ctx.strokeText(f.text, f.x, f.y - f.age * 1.8);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.age * 1.8);
      ctx.restore();
      f.age++;
      if (f.age < 45) alive.push(f);
    }
    this.battleFloats = alive;
  }

  private drawBattleSprite(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | undefined,
    x: number, y: number, w: number, h: number,
    mirror: boolean, flash: number
  ): void {
    ctx.save();
    if (mirror) { ctx.translate(x + w, 0); ctx.scale(-1, 1); x = 0; }
    if (img) {
      ctx.drawImage(img, x, y, w, h);
    } else {
      ctx.font = `${Math.round(h * 0.5)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(mirror ? '💀' : '⚔', x + w / 2, y + h / 2);
    }
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#ff1010';
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawBattleHUD(
    ctx: CanvasRenderingContext2D, W: number, H: number, atk: Unit, def: Unit
  ): void {
    const pH = Math.round(H * 0.17);
    const pY = H - pH - 6;
    const pad = 14;

    const drawPanel = (unit: Unit, ox: number, pw: number, hpX: number): void => {
      const teamBg = unit.team === 'player' ? 'rgba(16,44,96,0.93)' : 'rgba(96,16,16,0.93)';
      const teamBd = unit.team === 'player' ? '#4a9eff' : '#ff4a4a';
      ctx.fillStyle = teamBg; ctx.fillRect(ox, pY, pw, pH);
      ctx.strokeStyle = teamBd; ctx.lineWidth = 2; ctx.strokeRect(ox, pY, pw, pH);

      ctx.font = `bold ${Math.round(H * 0.034)}px monospace`;
      ctx.fillStyle = '#f0c040'; ctx.textAlign = 'left';
      ctx.fillText(unit.name.toUpperCase(), ox + pad, pY + 22);

      const hpPct = Math.max(0, unit.currentHp / unit.maxHp);
      const barW  = pw - pad * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hpX, pY + 32, barW, 10);
      ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#f0c040' : '#e53935';
      ctx.fillRect(hpX, pY + 32, Math.round(barW * hpPct), 10);

      ctx.font = `${Math.round(H * 0.028)}px monospace`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`HP  ${unit.currentHp} / ${unit.maxHp}`, ox + pad, pY + 58);
      if (unit.equippedWeapon)
        ctx.fillText(`⚔ ${unit.equippedWeapon.name}`, ox + pad, pY + 76);
    };

    drawPanel(atk, 6,           W / 2 - 10, 6 + pad);
    drawPanel(def, W / 2 + 4,   W / 2 - 10, W / 2 + 4 + pad);

    // VS label
    ctx.font = `bold ${Math.round(H * 0.045)}px monospace`;
    ctx.fillStyle = '#f0c040'; ctx.textAlign = 'center';
    ctx.fillText('VS', W / 2, pY + pH / 2 + 6);
  }

  // Lunge animation on battle overlay
  private async battleLunge(side: 'attacker' | 'defender'): Promise<void> {
    const dist = Math.round(this.canvas.width * 0.10);
    const dir  = side === 'attacker' ? 1 : -1;
    await this.tweenBattleOff(side, 0,       -dir * 16,  75);
    await this.tweenBattleOff(side, -dir*16,  dir * dist, 95);
    await this.tweenBattleOff(side,  dir*dist, 0,         120);
  }

  private tweenBattleOff(side: 'attacker' | 'defender', from: number, to: number, dur: number): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        if (side === 'attacker') this.battleAtkOff = from + (to - from) * e;
        else                     this.battleDefOff = from + (to - from) * e;
        if (t < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  private async battleHit(
    side: 'attacker' | 'defender', damage: number, crit: boolean, magical: boolean
  ): Promise<void> {
    const W = this.battleCvs?.width ?? 880;
    const H = this.battleCvs?.height ?? 660;
    const x = side === 'defender' ? Math.round(W * 0.75) : Math.round(W * 0.25);
    const y = Math.round(H * 0.50);

    this.battleFloats.push({
      text: crit ? `${damage}!!` : String(damage),
      color: crit ? '#ff0' : '#fff',
      x, y, age: 0,
    });

    if (side === 'attacker') this.battleAtkFlash = 1;
    else                     this.battleDefFlash = 1;

    AudioManager.playSfx(magical ? 'magic' : 'hit');
    await this.delay(70);
    if (side === 'attacker') this.battleAtkFlash = 0;
    else                     this.battleDefFlash = 0;
    await this.delay(180);
  }

  private battleMiss(side: 'attacker' | 'defender'): void {
    const W = this.battleCvs?.width ?? 880;
    const H = this.battleCvs?.height ?? 660;
    const x = side === 'defender' ? Math.round(W * 0.75) : Math.round(W * 0.25);
    const y = Math.round(H * 0.50);
    this.battleFloats.push({ text: 'FALLO', color: '#88f', x, y, age: 0 });
    AudioManager.playSfx('miss');
  }

  // ── Teclado y cursor ───────────────────────────────────────────────────────
  private onKeyDown(e: KeyboardEvent): void {
    if (this.isAnimating || this.gameState?.currentPhase !== 'PLAYER') return;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); AudioManager.playSfx('cursor'); this.moveCursor(-1,  0); break;
      case 'ArrowRight': e.preventDefault(); AudioManager.playSfx('cursor'); this.moveCursor( 1,  0); break;
      case 'ArrowUp':    e.preventDefault(); AudioManager.playSfx('cursor'); this.moveCursor( 0, -1); break;
      case 'ArrowDown':  e.preventDefault(); AudioManager.playSfx('cursor'); this.moveCursor( 0,  1); break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        AudioManager.playSfx('confirm');
        this.handleTileClick(this.cursor.x, this.cursor.y);
        break;
      case 'Escape':
      case 'Backspace':
        AudioManager.playSfx('cancel');
        this.selectedUnit   = null;
        this.reachableTiles = [];
        this.hoveredPath    = [];
        this.hideCombatPreview();
        this.msg('Selección cancelada.');
        this.draw();
        break;
    }
  }

  private moveCursor(dx: number, dy: number): void {
    this.cursor = {
      x: Math.max(0, Math.min(COLS-1, this.cursor.x + dx)),
      y: Math.max(0, Math.min(ROWS-1, this.cursor.y + dy)),
    };
    this.showCursor = true;
    if (this.selectedUnit && !this.selectedUnit.hasMoved) {
      const isReach = this.reachableTiles.some(p => p.x === this.cursor.x && p.y === this.cursor.y);
      const hasUnit = this.getUnitAt(this.cursor.x, this.cursor.y);
      this.hoveredPath = (isReach && !hasUnit)
        ? this.findPath(this.selectedUnit, this.selectedUnit.position, this.cursor)
        : [];
    }
    this.centerCameraOn(this.cursor);
    this.draw();
  }

  private onCanvasHover(e: MouseEvent): void {
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mx = Math.floor(((e.clientX - rect.left) * scaleX + this.camera.x) / TILE);
    const my = Math.floor(((e.clientY - rect.top)  * scaleY + this.camera.y) / TILE);
    if (mx < 0 || mx >= COLS || my < 0 || my >= ROWS) return;
    this.cursor    = { x: mx, y: my };
    this.showCursor = true;

    if (this.selectedUnit && !this.selectedUnit.hasMoved) {
      const isReach = this.reachableTiles.some(p => p.x === mx && p.y === my);
      const hasUnit = this.getUnitAt(mx, my);
      this.hoveredPath = (isReach && !hasUnit)
        ? this.findPath(this.selectedUnit, this.selectedUnit.position, { x: mx, y: my })
        : [];
    } else {
      this.hoveredPath = [];
    }
    if (!this.animFrame) this.startAnim();
  }

  // ── Eventos ────────────────────────────────────────────────────────────────
  private bindEvents(): void {
    this.canvas.addEventListener('click',      (e) => this.onCanvasClick(e));
    this.canvas.addEventListener('mousemove',  (e) => this.onCanvasHover(e));
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove',  (e) => this.onTouchMove(e),  { passive: false });
    this.canvas.addEventListener('touchend',   (e) => this.onTouchEnd(e),   { passive: false });
    this.canvas.addEventListener('mouseleave', () => {
      this.showCursor  = false;
      this.hoveredPath = [];
      this.draw();
    });
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    document.addEventListener('keydown', this.boundKeyDown);

    this.container.querySelector('#btn-wait')?.addEventListener('click', () => {
      if (!this.selectedUnit) { this.msg('Selecciona una unidad primero.'); return; }
      AudioManager.playSfx('cancel');
      this.selectedUnit.hasMoved = true;
      this.selectedUnit.hasActed = true;
      this.msg(`${this.selectedUnit.name} espera.`);
      this.selectedUnit  = null;
      this.reachableTiles = [];
      this.draw();
      this.checkAllMoved();
    });

    this.container.querySelector('#btn-endturn')?.addEventListener('click', async () => {
      if (this.gameState.currentPhase !== 'PLAYER') return;
      this.selectedUnit   = null;
      this.reachableTiles = [];
      this.hideCombatPreview();

      if (this.useProceduralMap) {
        // Modo IA (procedural): sin sesión en backend → IA local
        await this.localEnemyTurn();
      } else {
        // Modo campaña: el backend ejecuta la IA y devuelve las acciones
        try {
          const result = await GameService.endTurn();
          await this.animateEnemyPhase(result);
        } catch {
          // Fallback local si el backend no responde
          await this.localEnemyTurn();
        }
      }
      this.checkWin();
    });

    this.container.querySelector('#btn-confirm-atk')?.addEventListener('click', async () => {
      if (!this.selectedUnit || !this.pendingAttack) return;
      await this.executeAttack(this.selectedUnit, this.pendingAttack);
    });

    this.container.querySelector('#btn-cancel-atk')?.addEventListener('click', () => {
      AudioManager.playSfx('cancel');
      this.hideCombatPreview();
      this.msg('Ataque cancelado.');
      this.draw();
    });

    this.container.querySelector('#btn-menu')?.addEventListener('click', () => {
      AudioManager.stop();
      if (this.boundKeyDown) document.removeEventListener('keydown', this.boundKeyDown);
      import('./MenuPage').then(({ MenuPage }) => new MenuPage().render(this.container));
    });
  }

  // ── Soporte táctil (scroll de cámara + tap para seleccionar) ─────────────
  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    this.touchStartX    = t.clientX;
    this.touchStartY    = t.clientY;
    this.touchStartCamX = this.camera.x;
    this.touchStartCamY = this.camera.y;
    this.touchMoved     = false;
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t  = e.touches[0];
    const dx = this.touchStartX - t.clientX;
    const dy = this.touchStartY - t.clientY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) this.touchMoved = true;
    if (!this.touchMoved) return;

    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const maxCamX = COLS * TILE - VIEWPORT_W;
    const maxCamY = ROWS * TILE - VIEWPORT_H;

    this.camera.x    = Math.max(0, Math.min(maxCamX, this.touchStartCamX + dx * scaleX));
    this.camera.y    = Math.max(0, Math.min(maxCamY, this.touchStartCamY + dy * scaleY));
    this.cameraTgt.x = this.camera.x;
    this.cameraTgt.y = this.camera.y;
    this.draw();
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (this.touchMoved) return;
    if (this.isAnimating || this.gameState?.currentPhase !== 'PLAYER') return;
    const t    = e.changedTouches[0];
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mx = Math.floor(((t.clientX - rect.left) * scaleX + this.camera.x) / TILE);
    const my = Math.floor(((t.clientY - rect.top)  * scaleY + this.camera.y) / TILE);
    if (mx < 0 || mx >= COLS || my < 0 || my >= ROWS) return;
    this.handleTileClick(mx, my);
  }

  private onCanvasClick(e: MouseEvent): void {
    if (this.isAnimating || this.gameState.currentPhase !== 'PLAYER') return;
    const rect   = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mx = Math.floor(((e.clientX - rect.left) * scaleX + this.camera.x) / TILE);
    const my = Math.floor(((e.clientY - rect.top)  * scaleY + this.camera.y) / TILE);
    if (mx < 0 || mx >= COLS || my < 0 || my >= ROWS) return;
    this.handleTileClick(mx, my);
  }

  private handleTileClick(mx: number, my: number): void {
    const clicked = this.getUnitAt(mx, my);

    if (!this.selectedUnit) {
      if (clicked?.team === 'player' && !clicked.hasActed) {
        AudioManager.playSfx('confirm');
        this.selectUnit(clicked);
      } else if (clicked?.hasActed) {
        this.msg(`${clicked.name} ya actuó este turno.`);
      }
      return;
    }

    // ── Con unidad seleccionada ──────────────────────────────────────────────
    const isReach    = this.reachableTiles.some(p => p.x === mx && p.y === my);
    const isEnemy    = clicked?.team === 'enemy';
    const inAtkRange = isEnemy && this.getAttackableEnemies(this.selectedUnit).some(e => e.id === clicked!.id);

    if (inAtkRange) {
      this.showCombatPreview(this.selectedUnit, clicked!);
      return;
    }

    if (isReach && !clicked) {
      void this.moveSelectedTo(mx, my);
      return;
    }

    if (clicked?.id === this.selectedUnit.id) {
      this.selectedUnit   = null;
      this.reachableTiles = [];
      this.hoveredPath    = [];
      this.hideCombatPreview();
      this.msg('Selección cancelada.');
      this.draw();
      return;
    }

    if (clicked?.team === 'player' && !clicked.hasActed) {
      this.hideCombatPreview();
      this.selectUnit(clicked);
      return;
    }

    this.msg('No puedes moverte ahí. Elige casillas azules o enemigos en rojo.');
  }

  // ── IA local de combate (sin backend) ────────────────────────────────────
  private async executeLocalCombatRounds(
    attacker: Unit, defender: Unit
  ): Promise<{ defDefeated: boolean; atkDefeated: boolean }> {
    const p = calcPreview(attacker, defender, this.layout);

    const doRound = async (
      side: 'attacker' | 'defender',
      dmg: number, hit: number, crit: number, magical: boolean
    ): Promise<void> => {
      const defSide: 'attacker' | 'defender' = side === 'attacker' ? 'defender' : 'attacker';
      await this.battleLunge(side);
      const isHit  = Math.random() * 100 < hit;
      const isCrit = isHit && Math.random() * 100 < crit;
      const realDmg = isCrit ? dmg * 3 : dmg;
      if (isHit && realDmg > 0) {
        if (defSide === 'defender') defender.currentHp = Math.max(0, defender.currentHp - realDmg);
        else                        attacker.currentHp = Math.max(0, attacker.currentHp - realDmg);
        await this.battleHit(defSide, realDmg, isCrit, magical);
      } else {
        this.battleMiss(defSide);
        await this.delay(220);
      }
      await this.delay(55);
    };

    const aMag = !!attacker.equippedWeapon?.magical;
    const dMag = !!defender.equippedWeapon?.magical;

    await doRound('attacker', p.attackerDamage, p.attackerHitRate, p.attackerCritRate, aMag);

    if (p.defenderCanCounter && defender.currentHp > 0)
      await doRound('defender', p.defenderDamage, p.defenderHitRate, p.defenderCritRate, dMag);

    if (p.attackerDoubleAttacks && defender.currentHp > 0)
      await doRound('attacker', p.attackerDamage, p.attackerHitRate, p.attackerCritRate, aMag);

    if (p.defenderDoubleAttacks && p.defenderCanCounter && attacker.currentHp > 0)
      await doRound('defender', p.defenderDamage, p.defenderHitRate, p.defenderCritRate, dMag);

    return { defDefeated: defender.currentHp <= 0, atkDefeated: attacker.currentHp <= 0 };
  }

  private async localAttack(attacker: Unit, defender: Unit): Promise<void> {
    await this.openBattleScreen(attacker, defender);
    const { defDefeated, atkDefeated } = await this.executeLocalCombatRounds(attacker, defender);
    if (defDefeated || atkDefeated) { AudioManager.playSfx('death'); await this.delay(350); }
    await this.closeBattleScreen();
    if (defDefeated) { await this.deathAnimation(defender); defender.alive = false; }
    if (atkDefeated) { await this.deathAnimation(attacker); attacker.alive = false; }
    if (defDefeated)      this.msg(`¡${defender.name} derrotado!`);
    else if (atkDefeated) this.msg(`¡${attacker.name} fue derrotado!`);
    else                  this.msg(`${attacker.name} atacó a ${defender.name}.`);
  }

  private findBestMoveFor(unit: Unit, target: Unit): Position | null {
    const reachable = this.calcMovement(unit);
    if (reachable.length === 0) return null;
    const wMin = unit.equippedWeapon?.minRange ?? 1;
    const wMax = unit.equippedWeapon?.maxRange ?? 1;
    const inRange = reachable.filter(p => {
      const d = dist(p, target.position);
      return d >= wMin && d <= wMax;
    });
    if (inRange.length > 0) return inRange[0];
    return reachable.reduce((best, p) =>
      dist(p, target.position) < dist(best, target.position) ? p : best
    );
  }

  private async localEnemyTurn(): Promise<void> {
    this.gameState.currentPhase = 'ENEMY';
    this.draw();
    this.msg('Fase enemiga — ¡Los enemigos atacan!');
    await this.delay(600);

    // Ordenar: agresivos primero, defensivos al final
    const enemies = [...this.gameState.units]
      .filter(u => u.alive && u.team === 'enemy')
      .sort((a, b) => {
        const order: Record<string, number> = { AGGRESSIVE: 0, PATROL: 1, DEFENSIVE: 2 };
        return (order[a.aiBehavior ?? 'AGGRESSIVE'] ?? 0) - (order[b.aiBehavior ?? 'AGGRESSIVE'] ?? 0);
      });

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const players = this.gameState.units.filter(u => u.alive && u.team === 'player');
      if (players.length === 0) break;

      this.highlightUnit = enemy;
      this.centerCameraOn(enemy.position);
      if (!this.animFrame) this.startAnim();
      await this.delay(300);

      // Elegir objetivo según comportamiento
      const target = this.chooseTarget(enemy, players);
      const wMin = enemy.equippedWeapon?.minRange ?? 1;
      const wMax = enemy.equippedWeapon?.maxRange ?? 1;
      const dBefore = dist(enemy.position, target.position);
      const behavior = enemy.aiBehavior ?? 'AGGRESSIVE';

      // DEFENSIVE: solo actúa si el jugador está cerca (rango mov + arma)
      const activationRange = enemy.mov + wMax + 1;
      if (behavior === 'DEFENSIVE' && dBefore > activationRange) {
        this.highlightUnit = null;
        continue;
      }

      // PATROL: solo actúa si el jugador está muy cerca
      if (behavior === 'PATROL' && dBefore > wMax + 2) {
        this.highlightUnit = null;
        continue;
      }

      // Mover si no está en rango de ataque
      if (dBefore < wMin || dBefore > wMax) {
        const from = { ...enemy.position };
        const best = this.findBestMoveFor(enemy, target);
        if (best && (best.x !== from.x || best.y !== from.y)) {
          this.centerCameraOn(best);
          await this.animateMovement(enemy, from, best);
          await this.delay(120);
        }
      }

      // Atacar si está en rango
      const dAfter = dist(enemy.position, target.position);
      if (dAfter >= wMin && dAfter <= wMax && target.alive) {
        this.msg(`${enemy.name} ataca a ${target.name}!`);
        await this.localAttack(enemy, target);
      }

      this.highlightUnit = null;
      this.draw();
      await this.delay(180);
    }

    this.gameState.currentPhase = 'PLAYER';
    this.gameState.turnNumber++;
    this.gameState.units.forEach(u => {
      if (u.team === 'player') { u.hasMoved = false; u.hasActed = false; }
    });
    this.selectedUnit   = null;
    this.reachableTiles = [];
    this.draw();
    this.msg(`Turno ${this.gameState.turnNumber} — ¡Tu turno! Selecciona una unidad.`);
    this.checkWin();
  }

  private chooseTarget(enemy: Unit, players: Unit[]): Unit {
    const wMax = enemy.equippedWeapon?.maxRange ?? 1;
    // Priorizar: primero unidades ya en rango de ataque, luego las más débiles
    const inRange = players.filter(p => dist(p.position, enemy.position) <= wMax + enemy.mov);
    const pool = inRange.length > 0 ? inRange : players;
    // Elegir el más debilitado (menor HP%) entre los más cercanos
    return pool.reduce((best, p) => {
      const bHpPct = best.currentHp / best.maxHp;
      const pHpPct = p.currentHp / p.maxHp;
      const bDist  = dist(best.position, enemy.position);
      const pDist  = dist(p.position, enemy.position);
      // Combinación: preferir cerca + bajo HP
      return (pDist + pHpPct * 5) < (bDist + bHpPct * 5) ? p : best;
    });
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────
  private checkAllMoved(): void {
    const vivas = this.gameState.units.filter(u => u.alive && u.team === 'player');
    if (vivas.length > 0 && vivas.every(u => u.hasActed))
      this.msg('✅ Todas las unidades actuaron. Presiona "FIN DE TURNO".');
  }

  private checkWin(): void {
    const playerAlive = this.gameState.units.some(u => u.alive && u.team === 'player');
    const enemyAlive  = this.gameState.units.some(u => u.alive && u.team === 'enemy');
    if (!enemyAlive)  this.msg('🏆 ¡VICTORIA! Todos los enemigos derrotados.');
    if (!playerAlive) this.msg('💀 DERROTA. Todas tus unidades han caído.');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Estado de emergencia ───────────────────────────────────────────────────
  private fallbackState(): GameState {
    const mkWeapon = (name: string, type: string, might: number, hit: number): Weapon =>
      ({ name, type, might, hit, crit: 0, minRange: 1, maxRange: 1, uses: 30, magical: false });

    const mkUnit = (
      id: string, name: string, team: string, cls: string,
      maxHp: number, str: number, mag: number, skl: number, spd: number,
      lck: number, def: number, res: number, mov: number, lv: number,
      weapon: Weapon, x: number, y: number
    ): Unit => ({
      id, name, team, unitClass: cls, aiBehavior: 'AGGRESSIVE',
      maxHp, currentHp: maxHp, str, mag, skl, spd, lck, def, res, mov,
      level: lv, exp: 0, equippedWeapon: weapon,
      position: { x, y }, hasMoved: false, hasActed: false, alive: true,
    });

    return {
      units: [
        mkUnit('marth',   'Marth',    'player', 'Lord',    20, 5, 1, 7, 8, 6, 4, 2, 5, 3, mkWeapon('Espada Hierro','SWORD',5,90), 1, 12),
        mkUnit('jagen',   'Jagen',    'player', 'Paladin', 24, 9, 2,11, 9, 5, 9, 7, 7, 7, mkWeapon('Lanza Plata','LANCE',12,75), 0, 13),
        mkUnit('linde',   'Linde',    'player', 'Mage',    16, 1, 9, 8, 7, 5, 2, 6, 5, 3, mkWeapon('Trueno','ANIMA',6,80),       2, 13),
        mkUnit('bandit1', 'J.Bandido','enemy',  'Warrior', 22, 8, 0, 6, 5, 3, 7, 1, 5, 5, mkWeapon('Hacha Acero','AXE',11,60),  17, 1),
        mkUnit('knight1', 'S.Oscuro', 'enemy',  'Knight',  20, 7, 0, 5, 4, 2, 8, 2, 4, 4, mkWeapon('Lanza Acero','LANCE',9,70), 16, 4),
        mkUnit('myrmid1', 'Mercenario','enemy', 'Myrmidon',18, 6, 0, 9,10, 4, 4, 2, 5, 3, mkWeapon('Espada Hierro','SWORD',5,90),14, 5),
        mkUnit('mage1',   'M.Oscuro', 'enemy',  'Mage',    16, 1, 8, 7, 6, 3, 2, 5, 5, 3,
          { name:'Flujo', type:'DARK', might:7, hit:80, crit:5, minRange:1, maxRange:2, uses:45, magical:true }, 18, 9),
      ],
      turnNumber: 1, currentPhase: 'PLAYER', status: 'ACTIVE',
    };
  }
}
