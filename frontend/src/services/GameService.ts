const API_BASE   = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const BASE_URL   = `${API_BASE}/api/game`;
const LEVEL_URL  = `${API_BASE}/api/levels`;

// ── Modelos ────────────────────────────────────────────────────────────────────
export interface Position { x: number; y: number; }

export interface Weapon {
  name: string;
  type: string;        // SWORD | AXE | LANCE | BOW | ANIMA | LIGHT | DARK | STAFF
  might: number;
  hit: number;
  crit: number;
  minRange: number;
  maxRange: number;
  uses: number;
  magical: boolean;
}

export interface Unit {
  id: string;
  name: string;
  team: string;
  unitClass: string;
  aiBehavior: string;
  maxHp: number;
  currentHp: number;
  str: number;
  mag: number;
  skl: number;
  spd: number;
  lck: number;
  def: number;
  res: number;
  mov: number;
  level: number;
  exp: number;
  equippedWeapon: Weapon | null;
  position: Position;
  hasMoved: boolean;
  hasActed: boolean;
  alive: boolean;
}

export interface GameState {
  units: Unit[];
  turnNumber: number;
  currentPhase: string;
  status: string;
  enemySubTurn?: number;
  mapLayout?: number[][];
}

export interface MoveResult {
  unitId: string;
  newX: number;
  newY: number;
  success: boolean;
  message: string;
}

export interface CombatRound {
  attackerId: string;
  damage: number;
  crit: boolean;
  missed: boolean;
}

export interface CombatResult {
  attackerId: string;
  defenderId: string;
  attackerFinalHp: number;
  defenderFinalHp: number;
  attackerDefeated: boolean;
  defenderDefeated: boolean;
  attackerExpGained: number;
  defenderExpGained: number;
  attackerLevelUpGains: string[];
  defenderLevelUpGains: string[];
  rounds: CombatRound[];
  log: string[];
}

export interface CombatPreview {
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  attackerHp: number;
  defenderHp: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerHitRate: number;
  defenderHitRate: number;
  attackerCritRate: number;
  defenderCritRate: number;
  attackerDoubleAttacks: boolean;
  defenderDoubleAttacks: boolean;
  defenderCanCounter: boolean;
  weaponAdvantage: string;
  attackerWeaponName: string;
  defenderWeaponName: string;
}

export interface EnemyAction {
  unitId: string;
  unitName: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  attacked: boolean;
  targetId: string | null;
  combatResult: CombatResult | null;
}

export interface EnemyTurnResult {
  actions: EnemyAction[];
  finalState: GameState;
}

export interface UnitDefinitionDto {
  name: string;
  unitClass: string;
  level: number;
  startX: number;
  startY: number;
  team: string;
  aiBehavior: string | null;
  equippedWeaponType: string;
}

export interface LevelDto {
  id: string;
  name: string;
  description: string;
  campaignId: string;
  difficulty: number;
  mapLayout: number[][];
  playerUnits: UnitDefinitionDto[];
  enemyUnits: UnitDefinitionDto[];
  objective: string;
  turnLimit: number;
}

export interface CampaignDto {
  id: string;
  title: string;
  description: string;
  levels: LevelDto[];
}

// ── Servicio ───────────────────────────────────────────────────────────────────
export const GameService = {

  async getState(): Promise<GameState> {
    const res = await fetch(`${BASE_URL}/state`);
    if (!res.ok) throw new Error(`getState: ${res.status}`);
    return res.json();
  },

  async newGame(levelId?: string): Promise<GameState> {
    const url = levelId ? `${BASE_URL}/new?levelId=${encodeURIComponent(levelId)}` : `${BASE_URL}/new`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) throw new Error(`newGame: ${res.status}`);
    const state: GameState = await res.json();
    if (!Array.isArray(state.units)) throw new Error('newGame: respuesta inválida del servidor');
    return state;
  },

  async getAllCampaigns(): Promise<CampaignDto[]> {
    const res = await fetch(`${LEVEL_URL}/campaigns`);
    if (!res.ok) throw new Error(`getAllCampaigns: ${res.status}`);
    return res.json();
  },

  async getReachableTiles(unitId: string): Promise<Position[]> {
    const res = await fetch(`${BASE_URL}/reachable/${unitId}`);
    if (!res.ok) throw new Error(`reachable: ${res.status}`);
    return res.json();
  },

  async getCombatPreview(attackerId: string, defenderId: string): Promise<CombatPreview> {
    const res = await fetch(`${BASE_URL}/preview?attackerId=${attackerId}&defenderId=${defenderId}`);
    if (!res.ok) throw new Error(`preview: ${res.status}`);
    return res.json();
  },

  async moveUnit(unitId: string, destX: number, destY: number): Promise<MoveResult> {
    const res = await fetch(`${BASE_URL}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, destX, destY }),
    });
    if (!res.ok) throw new Error(`move: ${res.status}`);
    return res.json();
  },

  async attackUnit(attackerId: string, defenderId: string): Promise<CombatResult> {
    const res = await fetch(`${BASE_URL}/attack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attackerId, defenderId }),
    });
    if (!res.ok) throw new Error(`attack: ${res.status}`);
    return res.json();
  },

  async waitUnit(unitId: string): Promise<void> {
    await fetch(`${BASE_URL}/wait/${unitId}`, { method: 'POST' });
  },

  async endTurn(): Promise<EnemyTurnResult> {
    const res = await fetch(`${BASE_URL}/end-turn`, { method: 'POST' });
    if (!res.ok) throw new Error(`endTurn: ${res.status}`);
    return res.json();
  },
};
