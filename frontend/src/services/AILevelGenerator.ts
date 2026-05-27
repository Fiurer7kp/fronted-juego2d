import type { GameState, Unit, Weapon, Position } from './GameService';
import type { AILevelContent } from './GeminiService';

// ── Dimensiones del mapa (deben coincidir con GamePage) ───────────────────────
const COLS = 20, ROWS = 15;

// ── Tipos públicos ─────────────────────────────────────────────────────────────
export type GameMode = 'SKIRMISH' | 'SURVIVAL' | 'CONQUEST' | 'AMBUSH' | 'ARENA';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface AILevelConfig {
  mode: GameMode;
  difficulty: Difficulty;
  seed: number;
  name: string;
  description: string;
  objective: string;
  state: GameState;
  mapImagePath: string;
  aiContent?: AILevelContent;
}

// ── Imágenes de mapa por modo (solo los archivos subidos al repositorio) ──────
const ARENA_MAPS   = Array.from({ length: 10 }, (_, i) =>
  `/src/assets/maps/Arena/Z${String(i + 1).padStart(4, '0')}.png`);
const TEMPEST_MAPS = Array.from({ length: 10 }, (_, i) =>
  `/src/assets/maps/Tempest Trial/W${String(i + 1).padStart(4, '0')}.png`);
const TRAINING_MAPS = [
  '/src/assets/maps/Training Maps + Warriors Maps/V0211.png',
  '/src/assets/maps/Training Maps + Warriors Maps/V0212.png',
  '/src/assets/maps/Training Maps + Warriors Maps/V0213.png',
  '/src/assets/maps/Training Maps + Warriors Maps/V0221.png',
  '/src/assets/maps/Training Maps + Warriors Maps/V0222.png',
  '/src/assets/maps/Training Maps + Warriors Maps/V0223.png',
];

function pickMapImage(mode: GameMode, seed: number): string {
  const pool = mode === 'ARENA'
    ? ARENA_MAPS
    : mode === 'CONQUEST'
    ? TRAINING_MAPS
    : TEMPEST_MAPS;
  return pool[seed % pool.length];
}

// ── RNG Seeded (LCG — reproducible con misma semilla) ─────────────────────────
class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed % 2147483647) || 1; }

  next(): number {
    this.s = Math.imul(this.s, 1664525) + 1013904223 | 0;
    return (this.s >>> 0) / 0xffffffff;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  bool(prob = 0.5): boolean {
    return this.next() < prob;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// ── Generador principal ────────────────────────────────────────────────────────
export class AILevelGenerator {

  static generate(mode: GameMode, difficulty: Difficulty, seed?: number): AILevelConfig {
    const s   = seed ?? (Math.floor(Math.random() * 899999) + 100000);
    const rng = new Rng(s);

    const mapLayout = this.genTerrain(mode, rng);
    const units     = this.genUnits(mode, difficulty, rng, mapLayout);
    const label     = this.genLabel(mode, rng, difficulty);

    const state: GameState = {
      units,
      turnNumber: 1,
      currentPhase: 'PLAYER',
      status: 'ACTIVE',
      mapLayout,
    };

    return { mode, difficulty, seed: s, ...label, state, mapImagePath: pickMapImage(mode, s) };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GENERACIÓN DE TERRENO
  // ════════════════════════════════════════════════════════════════════════════

  private static genTerrain(mode: GameMode, rng: Rng): number[][] {
    let m: number[][];
    switch (mode) {
      case 'ARENA':    m = this.terrainArena(rng);   break;
      case 'AMBUSH':   m = this.terrainForest(rng);  break;
      case 'CONQUEST': m = this.terrainForts(rng);   break;
      case 'SURVIVAL': m = this.terrainOpen(rng);    break;
      default:         m = this.terrainMixed(rng);   break;
    }
    // Garantizar conectividad: borrar obstáculos del corredor central + zonas de spawn
    if (mode !== 'ARENA') m = this.ensureConnectivity(m);
    return m;
  }

  // ── Autómata celular: elimina fragmentos aislados del mismo tipo ─────────
  private static smooth(map: number[][], passes: number): number[][] {
    let m = map.map(r => [...r]);
    for (let p = 0; p < passes; p++) {
      const n = m.map(r => [...r]);
      for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
          const t = m[y][x];
          if (t === 0) continue; // las praderas no se tocan
          const same = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
            .filter(([dy, dx]) => m[y + dy][x + dx] === t).length;
          if (same < 2) n[y][x] = 0; // umbral 2: más permisivo → terreno más variado
        }
      }
      m = n;
    }
    return m;
  }

  // ── Garantiza que el corredor central (fila 7) y spawn zones son transitables
  private static ensureConnectivity(map: number[][]): number[][] {
    const m = map.map(r => [...r]);

    // Corredor horizontal central: agua y montañas se convierten en pradera
    for (let x = 0; x < COLS; x++) {
      if (m[7][x] === 2 || m[7][x] === 3) m[7][x] = 0;
    }
    // Zona de spawn jugador (col 0-3): sin impassables
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 0; x <= 3; x++) {
        if (m[y][x] === 2 || m[y][x] === 3) m[y][x] = 0;
      }
    }
    // Zona de spawn enemigo (col 16-19): sin impassables
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 16; x < COLS; x++) {
        if (m[y][x] === 2 || m[y][x] === 3) m[y][x] = 0;
      }
    }
    return m;
  }

  // ── Terreno mixto (Escaramuza) ────────────────────────────────────────────
  private static terrainMixed(rng: Rng): number[][] {
    const raw = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => {
        const r = rng.next();
        if (r < 0.50) return 0; // pradera
        if (r < 0.65) return 1; // bosque
        if (r < 0.73) return 2; // montaña
        if (r < 0.79) return 3; // agua
        if (r < 0.87) return 5; // camino
        return 0;
      })
    );
    const m = this.smooth(raw, 2);

    // Camino que cruza el mapa (variante aleatoria: diagonal o en Z)
    const roadStyle = rng.bool() ? 'diagonal' : 'zigzag';
    if (roadStyle === 'diagonal') {
      for (let i = 0; i < ROWS; i++) {
        const x = Math.round(i * (COLS - 1) / (ROWS - 1));
        if (m[i][x] !== 3) m[i][x] = 5;
      }
    } else {
      // Zigzag: horizontal arriba → diagonal → horizontal abajo
      for (let x = 0; x < 7; x++)  if (m[3][x] !== 3) m[3][x] = 5;
      for (let i = 0; i < 8; i++)  if (m[3 + i][7 + i] !== 3) m[3 + i][Math.min(7 + i, COLS-1)] = 5;
      for (let x = 14; x < COLS; x++) if (m[11][x] !== 3) m[11][x] = 5;
    }

    // Fuertes en posiciones variadas
    m[rng.int(2, ROWS - 3)][rng.int(5, COLS - 6)] = 4;
    m[rng.int(2, ROWS - 3)][rng.int(5, COLS - 6)] = 4;

    return m;
  }

  // ── Terreno de bosque (Emboscada) ─────────────────────────────────────────
  private static terrainForest(rng: Rng): number[][] {
    const raw = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => {
        const r = rng.next();
        if (r < 0.48) return 1; // bosque denso
        if (r < 0.60) return 0;
        if (r < 0.67) return 2;
        if (r < 0.72) return 3;
        return 0;
      })
    );
    const m = this.smooth(raw, 2); // 2 pasadas: menos agresivo que antes (era 3)

    // Claro central donde spawnea el jugador (se borra con ensureConnectivity también)
    for (let y = 5; y <= 9; y++)
      for (let x = 7; x <= 12; x++)
        m[y][x] = 0;

    // Veredas estrechas entre los árboles
    for (let x = 0; x < COLS; x++) if (m[4][x] === 1) m[4][x] = 5;
    for (let x = 0; x < COLS; x++) if (m[10][x] === 1) m[10][x] = 5;

    return m;
  }

  // ── Terreno de arena cerrada (Arena) ──────────────────────────────────────
  private static terrainArena(rng: Rng): number[][] {
    const m: number[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

    // Muros perimetrales de montaña
    for (let x = 0; x < COLS; x++) { m[0][x] = 2; m[ROWS - 1][x] = 2; }
    for (let y = 0; y < ROWS; y++) { m[y][0] = 2; m[y][COLS - 1] = 2; }

    // Obstáculos simétricos para que ambos lados estén equilibrados
    const obstacles: Array<[number, number, number]> = [
      // [y, x, tipo]: añadir simétrico en x=(COLS-1-x)
      [3, 5, 1], [3, 5, 1], [5, 8, 2], [7, 5, 1],
      [9, 8, 2], [11, 5, 1], [5, 3, 1], [9, 3, 1],
    ];
    for (const [y, x, t] of obstacles) {
      const mx = rng.int(x - 1, x + 1);
      const my = rng.int(y - 1, y + 1);
      if (my > 0 && my < ROWS - 1 && mx > 1 && mx < COLS - 2) {
        m[my][mx] = t;
        // Simétrico horizontal
        const sx = COLS - 1 - mx;
        if (sx > 1 && sx < COLS - 2) m[my][sx] = t;
      }
    }

    // Fuertes en los cuatro cuadrantes interiores
    m[2][3] = 4; m[ROWS-3][3] = 4;
    m[2][COLS-4] = 4; m[ROWS-3][COLS-4] = 4;

    return m;
  }

  // ── Terreno con fuertes (Conquista) ───────────────────────────────────────
  private static terrainForts(rng: Rng): number[][] {
    const raw = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => {
        const r = rng.next();
        if (r < 0.60) return 0;
        if (r < 0.74) return 1;
        if (r < 0.82) return 5;
        if (r < 0.88) return 2;
        return 0;
      })
    );
    const m = this.smooth(raw, 1);

    // 6 fuertes estratégicos en una cuadrícula 2×3 con variación
    const cols3 = [rng.int(4,7), rng.int(9,11), rng.int(13,16)];
    const rows2 = [rng.int(1,4), rng.int(9,12)];
    for (const fy of rows2)
      for (const fx of cols3)
        if (fy < ROWS && fx < COLS) m[fy][fx] = 4;

    // Fuerte central como objetivo principal
    m[7][10] = 4;

    // Caminos que conectan los fuertes
    for (let x = 0; x < COLS; x++) if (m[7][x] !== 3 && m[7][x] !== 4) m[7][x] = 5;

    return m;
  }

  // ── Terreno abierto (Supervivencia) ──────────────────────────────────────
  private static terrainOpen(rng: Rng): number[][] {
    const raw = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => {
        const r = rng.next();
        if (r < 0.65) return 0; // mayormente praderas
        if (r < 0.76) return 1; // algo de bosque
        if (r < 0.83) return 5; // caminos
        if (r < 0.88) return 2; // pocas montañas
        return 0;
      })
    );
    const m = this.smooth(raw, 1);

    // Fuerte de defensa para el jugador (en el lado izquierdo)
    m[rng.int(5, 9)][rng.int(1, 3)] = 4;

    // Río corto cerca del centro como obstáculo táctico
    const riverRow = rng.int(4, 10);
    const riverStart = rng.int(7, 11);
    for (let x = riverStart; x < riverStart + rng.int(3, 6) && x < COLS - 2; x++) {
      m[riverRow][x] = 3;
    }

    return m;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GENERACIÓN DE UNIDADES
  // ════════════════════════════════════════════════════════════════════════════

  private static genUnits(
    mode: GameMode, diff: Difficulty, rng: Rng, map: number[][]
  ): Unit[] {
    const isArena    = mode === 'ARENA';
    const isAmbush   = mode === 'AMBUSH';
    const isSurvival = mode === 'SURVIVAL';

    // Cantidad de unidades por equipo
    const pCount = isArena ? 3 : Math.max(3, 5 - Math.floor(diff / 3));
    const eCount = isArena   ? 3
                 : isSurvival ? Math.min(3 + diff * 2, 9)
                 : Math.min(2 + diff * 2, 8);

    // Zonas de spawn por defecto
    let pZone: [number, number, number, number] = [0, 4, 1, ROWS - 2];
    let eZone: [number, number, number, number] = [15, 19, 1, ROWS - 2];

    let extraEnemyZones: Array<[number, number, number, number]> = [];

    if (isArena) {
      pZone = [1, 5, 2, ROWS - 3];
      eZone = [14, 18, 2, ROWS - 3];
    }
    if (isAmbush) {
      pZone = [7, 12, 5, 9]; // jugador atrapado en el centro
      extraEnemyZones = [
        [0,  2,  1, ROWS - 2], // flanco izquierdo
        [17, 19, 1, ROWS - 2], // flanco derecho
        [3,  16, 0, 2],        // borde superior
        [3,  16, 12, 14],      // borde inferior
      ];
    }

    const used = new Set<string>();
    const spawnPos = (
      [xMin, xMax, yMin, yMax]: [number, number, number, number],
      count: number
    ): Position[] => {
      const out: Position[] = [];
      let att = 0;
      while (out.length < count && att < 500) {
        att++;
        const x = rng.int(xMin, xMax);
        const y = rng.int(yMin, yMax);
        const t = map[y]?.[x] ?? 0;
        const k = `${x},${y}`;
        if (t !== 3 && t !== 2 && !used.has(k)) {
          used.add(k);
          out.push({ x, y });
        }
      }
      return out;
    };

    const pPositions = spawnPos(pZone, pCount);
    let ePositions: Position[];

    if (isAmbush && extraEnemyZones.length > 0) {
      // Distribuir enemigos en las 4 zonas de emboscada
      const perZone = Math.ceil(eCount / extraEnemyZones.length);
      ePositions = extraEnemyZones.flatMap(z => spawnPos(z, perZone)).slice(0, eCount);
    } else {
      ePositions = spawnPos(eZone, eCount);
    }

    const units: Unit[] = [];
    const usedNames = new Set<string>();

    // ── Clases del equipo jugador ──────────────────────────────────────────
    const playerPool: string[] = rng.shuffle(
      isArena
        ? ['Lord', 'Paladin', 'Myrmidon']
        : this.balancedPlayerTeam(pCount, rng)
    );
    for (let i = 0; i < pCount; i++) {
      const cls = playerPool[i % playerPool.length];
      const pos = pPositions[i];
      if (!pos) continue;
      units.push(this.mkUnit(`p${i}`, this.heroName(cls, rng, usedNames), 'player', cls, diff, pos, 'PLAYER'));
    }

    // ── Clases del equipo enemigo ─────────────────────────────────────────
    const enemyPool: string[] = isSurvival
      ? this.survivalEnemyPool(diff, rng)
      : rng.shuffle(this.enemyPool(mode, diff));

    for (let i = 0; i < eCount; i++) {
      const cls = enemyPool[i % enemyPool.length];
      const pos = ePositions[i];
      if (!pos) continue;
      const behavior = isAmbush
        ? 'AGGRESSIVE'
        : i === 0 ? 'AGGRESSIVE'
        : rng.pick(['AGGRESSIVE', 'DEFENSIVE', 'DEFENSIVE', 'PATROL'] as const);
      units.push(this.mkUnit(`e${i}`, this.villainName(cls, rng, usedNames), 'enemy', cls, diff, pos, behavior));
    }

    return units;
  }

  // ── Equipo jugador equilibrado según tamaño ────────────────────────────────
  private static balancedPlayerTeam(count: number, rng: Rng): string[] {
    // Siempre incluye: Lord + soporte + combatiente
    const core = ['Lord', rng.pick(['Healer', 'Paladin']), rng.pick(['Myrmidon', 'Archer'])];
    const extras = rng.shuffle(['Paladin', 'Myrmidon', 'Archer', 'Mage', 'Healer']);
    return rng.shuffle([...core, ...extras].slice(0, count));
  }

  // ── Pool de enemigos para Supervivencia (escala con dificultad) ────────────
  private static survivalEnemyPool(diff: Difficulty, rng: Rng): string[] {
    const base = ['Warrior', 'Bandit', 'Knight'];
    if (diff >= 2) base.push('Archer');
    if (diff >= 3) base.push('Myrmidon', 'Sorcerer');
    if (diff >= 4) base.push('General');
    if (diff >= 5) base.push('DarkGeneral');
    return rng.shuffle(base);
  }

  // ── Pool de enemigos por modo ──────────────────────────────────────────────
  private static enemyPool(mode: GameMode, diff: Difficulty): string[] {
    if (mode === 'ARENA') return ['Lord', 'Paladin', 'Myrmidon'];
    if (mode === 'AMBUSH') return ['Warrior', 'Bandit', 'Archer', 'Myrmidon', 'Sorcerer'];
    if (mode === 'CONQUEST') return ['Knight', 'Warrior', 'Archer', 'General', 'Sorcerer'];
    // SKIRMISH: pool variado escalado con dificultad
    const pool = ['Warrior', 'Knight', 'Myrmidon', 'Bandit'];
    if (diff >= 2) pool.push('Archer');
    if (diff >= 3) pool.push('Sorcerer');
    if (diff >= 4) pool.push('General');
    if (diff >= 5) pool.push('DarkGeneral');
    return pool;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONSTRUCCIÓN DE UNIDADES
  // ════════════════════════════════════════════════════════════════════════════

  private static mkUnit(
    id: string, name: string, team: string, cls: string,
    diff: Difficulty, pos: Position, behavior: string
  ): Unit {
    // stats base: [maxHp, str, mag, skl, spd, lck, def, res, mov]
    type S = [number,number,number,number,number,number,number,number,number];
    const BASE: Record<string, S> = {
      Lord:       [20, 5, 2, 7, 8, 6, 4, 3, 5],
      Paladin:    [24, 9, 2,11, 9, 5, 9, 6, 7],
      Myrmidon:   [16, 7, 0,12,12, 7, 3, 2, 5],
      Archer:     [18, 6, 0,10, 8, 5, 5, 3, 5],
      Mage:       [14, 0, 9, 8, 7, 5, 2, 7, 5],
      Healer:     [16, 2, 8, 7, 7, 5, 2, 8, 5],
      Warrior:    [22, 8, 0, 6, 5, 3, 7, 1, 5],
      Knight:     [22, 7, 0, 5, 4, 2, 9, 2, 4],
      Bandit:     [20, 8, 0, 6, 6, 3, 6, 1, 5],
      Sorcerer:   [14, 0, 9, 8, 6, 3, 2, 7, 5],
      General:    [26,10, 0, 7, 3, 3,11, 4, 4],
      DarkGeneral:[24, 8, 2, 7, 4, 3,10, 5, 4],
    };
    const s = BASE[cls] ?? BASE['Warrior'];
    const d = diff - 1; // 0–4

    const isMagic = cls === 'Mage' || cls === 'Healer' || cls === 'Sorcerer';
    const isTank  = cls === 'Knight' || cls === 'General' || cls === 'DarkGeneral';

    return {
      id, name, team, unitClass: cls, aiBehavior: behavior,
      maxHp:     s[0] + d * 2,
      currentHp: s[0] + d * 2,
      str:  s[1] + (isMagic ? 0 : d),
      mag:  s[2] + (isMagic ? d : 0),
      skl:  s[3] + d,
      spd:  s[4] + d,
      lck:  s[5] + Math.floor(d / 2), // luck escala más suave
      def:  s[6] + (isTank ? d : Math.floor(d / 2)),
      res:  s[7] + (isMagic ? d : 0),
      mov:  s[8],
      level: diff, exp: 0,
      equippedWeapon: this.pickWeapon(cls, diff),
      position: { ...pos },
      hasMoved: false, hasActed: false, alive: true,
    };
  }

  // ── Armas: 5 niveles por tipo de unidad ───────────────────────────────────
  private static pickWeapon(cls: string, diff: Difficulty): Weapon {
    const t = diff - 1; // tier 0-4

    const sw: Weapon[] = [
      { name:'Espada Hierro',    type:'SWORD', might:5,  hit:90, crit:0,  minRange:1, maxRange:1, uses:46, magical:false },
      { name:'Espada Acero',     type:'SWORD', might:8,  hit:75, crit:0,  minRange:1, maxRange:1, uses:30, magical:false },
      { name:'Espada Plata',     type:'SWORD', might:11, hit:80, crit:0,  minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Espada Legendaria',type:'SWORD', might:13, hit:85, crit:10, minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Espada Mítica',    type:'SWORD', might:16, hit:90, crit:15, minRange:1, maxRange:1, uses:15, magical:false },
    ];
    const ax: Weapon[] = [
      { name:'Hacha Hierro',  type:'AXE', might:7,  hit:70, crit:0,  minRange:1, maxRange:1, uses:45, magical:false },
      { name:'Hacha Acero',   type:'AXE', might:11, hit:60, crit:0,  minRange:1, maxRange:1, uses:30, magical:false },
      { name:'Hacha Plata',   type:'AXE', might:14, hit:70, crit:0,  minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Hacha Rúnica',  type:'AXE', might:17, hit:75, crit:5,  minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Hacha Divina',  type:'AXE', might:20, hit:80, crit:10, minRange:1, maxRange:1, uses:15, magical:false },
    ];
    const la: Weapon[] = [
      { name:'Lanza Hierro',  type:'LANCE', might:6,  hit:80, crit:0,  minRange:1, maxRange:1, uses:45, magical:false },
      { name:'Lanza Acero',   type:'LANCE', might:9,  hit:70, crit:0,  minRange:1, maxRange:1, uses:30, magical:false },
      { name:'Lanza Plata',   type:'LANCE', might:12, hit:75, crit:0,  minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Lanza Sagrada', type:'LANCE', might:15, hit:80, crit:5,  minRange:1, maxRange:1, uses:20, magical:false },
      { name:'Aurelia',       type:'LANCE', might:18, hit:85, crit:10, minRange:1, maxRange:1, uses:15, magical:false },
    ];
    const bo: Weapon[] = [
      { name:'Arco Hierro',    type:'BOW', might:5,  hit:85, crit:0,  minRange:2, maxRange:2, uses:45, magical:false },
      { name:'Arco Acero',     type:'BOW', might:8,  hit:75, crit:0,  minRange:2, maxRange:2, uses:30, magical:false },
      { name:'Arco Plata',     type:'BOW', might:11, hit:80, crit:0,  minRange:2, maxRange:2, uses:20, magical:false },
      { name:'Arco Arcano',    type:'BOW', might:14, hit:85, crit:10, minRange:2, maxRange:2, uses:20, magical:false },
      { name:'Arco del Trueno',type:'BOW', might:17, hit:90, crit:15, minRange:2, maxRange:2, uses:15, magical:false },
    ];
    const ma: Weapon[] = [
      { name:'Trueno',     type:'ANIMA', might:5,  hit:80, crit:5,  minRange:1, maxRange:2, uses:40, magical:true },
      { name:'Relámpago',  type:'ANIMA', might:8,  hit:75, crit:5,  minRange:1, maxRange:2, uses:25, magical:true },
      { name:'Excalibur',  type:'ANIMA', might:11, hit:85, crit:10, minRange:1, maxRange:2, uses:20, magical:true },
      { name:'Sílfide',    type:'ANIMA', might:14, hit:88, crit:15, minRange:1, maxRange:2, uses:20, magical:true },
      { name:'Fenix',      type:'LIGHT', might:18, hit:90, crit:20, minRange:1, maxRange:2, uses:15, magical:true },
    ];
    const dk: Weapon[] = [
      { name:'Flujo',       type:'DARK', might:7,  hit:75, crit:0,  minRange:1, maxRange:2, uses:40, magical:true },
      { name:'Jormungand',  type:'DARK', might:10, hit:65, crit:5,  minRange:1, maxRange:2, uses:25, magical:true },
      { name:'Eclipse',     type:'DARK', might:13, hit:70, crit:5,  minRange:1, maxRange:2, uses:20, magical:true },
      { name:'Apocalipsis', type:'DARK', might:16, hit:75, crit:10, minRange:1, maxRange:2, uses:20, magical:true },
      { name:'Loptyr',      type:'DARK', might:20, hit:80, crit:15, minRange:1, maxRange:2, uses:15, magical:true },
    ];
    const st: Weapon[] = [
      { name:'Bastón Sanador', type:'STAFF', might:0, hit:100, crit:0, minRange:1, maxRange:1, uses:30, magical:true },
      { name:'Bastón Fénico',  type:'STAFF', might:0, hit:100, crit:0, minRange:1, maxRange:1, uses:25, magical:true },
      { name:'Bastón Sagrado', type:'STAFF', might:0, hit:100, crit:0, minRange:1, maxRange:1, uses:20, magical:true },
      { name:'Aura Menor',     type:'LIGHT', might:8, hit:80,  crit:5,  minRange:1, maxRange:2, uses:20, magical:true },
      { name:'Aura',           type:'LIGHT', might:12,hit:85, crit:10, minRange:1, maxRange:2, uses:15, magical:true },
    ];

    switch (cls) {
      case 'Lord': case 'Myrmidon':             return sw[t];
      case 'Warrior': case 'Bandit':             return ax[t];
      case 'Paladin': case 'Knight':             return la[t];
      case 'General':                            return t >= 3 ? la[t] : ax[t];
      case 'DarkGeneral':                        return t >= 3 ? dk[t] : la[t];
      case 'Archer':                             return bo[t];
      case 'Mage':                               return ma[t];
      case 'Sorcerer':                           return dk[t];
      case 'Healer':                             return st[t];
      default:                                   return sw[t];
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NOMBRES
  // ════════════════════════════════════════════════════════════════════════════

  private static pickUniqueName(names: string[], rng: Rng, used: Set<string>): string {
    const available = names.filter(n => !used.has(n));
    const base = available.length > 0 ? rng.pick(available) : rng.pick(names);
    if (!used.has(base)) { used.add(base); return base; }
    // All names taken: add roman numeral suffix
    for (let i = 2; i <= 9; i++) {
      const n = `${base} ${['II','III','IV','V','VI','VII','VIII','IX'][i-2]}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return base;
  }

  private static heroName(cls: string, rng: Rng, used: Set<string>): string {
    const pool: Record<string, string[]> = {
      Lord:     ['Alric', 'Veyra', 'Calder', 'Seren', 'Aldric', 'Liora', 'Rein', 'Caius'],
      Paladin:  ['Gawain', 'Isolde', 'Brennan', 'Lyria', 'Rovan', 'Davan', 'Eryn'],
      Myrmidon: ['Zephyr', 'Kasai', 'Nira', 'Vel', 'Shai', 'Daiko', 'Yuki', 'Ryke'],
      Archer:   ['Flin', 'Lyss', 'Kova', 'Aryn', 'Brynn', 'Wren', 'Teal', 'Swift'],
      Mage:     ['Elara', 'Zoran', 'Myra', 'Dain', 'Cerys', 'Lumen', 'Sorel'],
      Healer:   ['Lia', 'Noel', 'Seraf', 'Mirel', 'Alys', 'Clair', 'Dove'],
      Cavalier: ['Rован', 'Stevan', 'Mira', 'Dane', 'Bran'],
    };
    return this.pickUniqueName(pool[cls] ?? ['Héroe', 'Campeón', 'Valiente'], rng, used);
  }

  private static villainName(cls: string, rng: Rng, used: Set<string>): string {
    const pool: Record<string, string[]> = {
      Warrior:    ['Grim', 'Rusk', 'Brak', 'Thorg', 'Crag', 'Mael', 'Vorn', 'Dusk'],
      Knight:     ['Crux', 'Vhar', 'Skor', 'Nex', 'Grond', 'Drek', 'Orm'],
      Bandit:     ['Slash', 'Raven', 'Claw', 'Vex', 'Hook', 'Scab', 'Gash'],
      Sorcerer:   ['Malakar', 'Shade', 'Nox', 'Mors', 'Void', 'Dread'],
      Archer:     ['Dart', 'Hawk', 'Sting', 'Quill', 'Fang', 'Barb', 'Bolt'],
      General:    ['Ironveil', 'Grasp', 'Skorne', 'Orm', 'Vex', 'Tyrant'],
      DarkGeneral:['Necrox', 'Gravus', 'Morden', 'Abyss', 'Thanor', 'Vile'],
      Myrmidon:   ['Kira', 'Sly', 'Vance', 'Thorn', 'Reaper'],
    };
    return this.pickUniqueName(pool[cls] ?? ['Enemigo', 'Agresor', 'Rival'], rng, used);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NOMBRE Y DESCRIPCIÓN DEL NIVEL
  // ════════════════════════════════════════════════════════════════════════════

  private static genLabel(
    mode: GameMode, rng: Rng, diff: Difficulty
  ): { name: string; description: string; objective: string } {

    const suffixes: Record<Difficulty, string> = {
      1: ' (Principiante)', 2: '', 3: ' (Experimentado)',
      4: ' (Veterano)', 5: ' (Legendario)',
    };

    type Entry = [string[], string[], string];
    const data: Record<GameMode, Entry> = {
      SKIRMISH: [
        ['Campo de Cenizas', 'Llanura Sangrienta', 'Tierras de Conflicto',
         'El Cruce de los Caídos', 'Valle de las Sombras', 'Fronteras del Abismo',
         'La Colina del Trueno', 'Campos de la Discordia'],
        ['Fuerzas enemigas se aproximan desde el este. Defiende el terreno o perece.',
         'El enemigo avanza sin piedad. Solo los más fuertes sobrevivirán.',
         'Un enfrentamiento decisivo en campo abierto. Cada movimiento cuenta.',
         'La batalla es inevitable. Aplasta al enemigo antes de que te aplaste a ti.'],
        'Derrota a todos los enemigos',
      ],
      SURVIVAL: [
        ['Asedio Interminable', 'La Última Línea', 'Fortaleza Desesperada',
         'Marea de Oscuridad', 'El Último Bastión', 'Sin Refuerzos'],
        ['Las fuerzas enemigas superan en número a las tuyas. Lucha con todo lo que tienes.',
         'Oleadas de enemigos acechan. Resiste con honor o muere en el intento.',
         'No hay refuerzos. No hay retirada. Solo queda resistir.'],
        'Elimina todas las fuerzas enemigas (eres minoría)',
      ],
      CONQUEST: [
        ['Territorio Disputado', 'La Campaña de los Fuertes', 'Dominio Total',
         'Tierra Conquistada', 'El Gran Avance', 'Posiciones Estratégicas'],
        ['Los fuertes son clave para dominar la región. Tómalos a toda costa.',
         'Quien controle los fuertes, controla el destino de esta batalla.',
         'Avanza y asegura cada posición antes de que el enemigo los refuerce.'],
        'Captura los fuertes clave y elimina al enemigo',
      ],
      AMBUSH: [
        ['Trampa en el Bosque', 'Emboscada al Amanecer', 'El Cerco',
         'Sendero de la Traición', 'Acorralados', 'Sin Salida'],
        ['¡Una trampa! El enemigo nos rodea. Rompe el cerco o muere aquí.',
         'Rodeados por los cuatro flancos. Solo la determinación puede salvarnos.',
         'No había señales de peligro... hasta ahora. Lucha por tu vida.'],
        'Elimina a todos los enemigos que te rodean',
      ],
      ARENA: [
        ['El Coliseo de Sangre', 'Arena del Honor', 'Torneo de Campeones',
         'El Gran Duelo', 'Combate a Muerte', 'Los Elegidos'],
        ['El coliseo grita pidiendo sangre. Tres contra tres. Solo sobrevive el mejor.',
         'El honor de los combatientes se mide en victorias. Que corra la batalla.',
         'El público exige espectáculo. Que gane el equipo más fuerte.'],
        'Derrota al equipo enemigo en combate 3 vs 3',
      ],
    };

    const [namePool, descPool, objective] = data[mode];
    const baseName = rng.pick(namePool);
    const suffix = diff >= 3 ? (suffixes[diff] ?? '') : '';

    return {
      name: baseName + suffix,
      description: rng.pick(descPool),
      objective,
    };
  }
}
