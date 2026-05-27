import type { GameMode, Difficulty } from './AILevelGenerator';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface AILevelContent {
  levelName:      string;
  description:    string;
  objective:      string;
  bossDialogue:   string;
  bossDeathLine:  string;
  attackTaunts:   string[];   // 3 frases cortas para turnos enemigos
  victoryMessage: string;
  defeatMessage:  string;
}

const MODE_NAMES: Record<GameMode, string> = {
  SKIRMISH:  'batalla táctica en campo abierto',
  SURVIVAL:  'supervivencia contra fuerzas superiores',
  CONQUEST:  'conquista de fuertes estratégicos',
  AMBUSH:    'emboscada en el bosque',
  ARENA:     'duelo de campeones en el coliseo',
};

const DIFF_LABELS = ['', 'fácil', 'normal', 'difícil', 'muy difícil', 'extremo'];

export const GeminiService = {

  async generateLevelContent(
    mode: GameMode,
    difficulty: Difficulty,
    enemyClasses: string[],
    playerClasses: string[],
  ): Promise<AILevelContent | null> {
    if (!API_KEY || API_KEY === 'tu_api_key_aqui') return null;

    const bossClass = enemyClasses[0] ?? 'Guerrero';
    const prompt = `Eres el narrador de un juego de rol táctico medieval oscuro llamado "Ashen Crown".
Genera contenido dramático y épico para un nivel con estos parámetros:
- Tipo de batalla: ${MODE_NAMES[mode]}
- Dificultad: ${DIFF_LABELS[difficulty]} (${difficulty}/5)
- Clases enemigas: ${enemyClasses.join(', ')}
- Clase del jefe enemigo: ${bossClass}
- Clases del jugador: ${playerClasses.join(', ')}

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones extra:
{
  "levelName": "nombre épico del nivel en español (máximo 5 palabras)",
  "description": "descripción narrativa dramática, 1-2 oraciones (máximo 30 palabras)",
  "objective": "objetivo comenzando con verbo imperativo (máximo 8 palabras)",
  "bossDialogue": "frase amenazante del jefe al inicio de la batalla (máximo 15 palabras)",
  "bossDeathLine": "última frase dramática del jefe al ser derrotado (máximo 12 palabras)",
  "attackTaunts": [
    "frase corta de burla al atacar #1 (máximo 8 palabras)",
    "frase corta de burla al atacar #2 (máximo 8 palabras)",
    "frase corta de burla al atacar #3 (máximo 8 palabras)"
  ],
  "victoryMessage": "mensaje épico de victoria (máximo 12 palabras)",
  "defeatMessage": "mensaje dramático de derrota (máximo 12 palabras)"
}`;

    try {
      const res = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(clean) as AILevelContent;
      if (!Array.isArray(parsed.attackTaunts)) parsed.attackTaunts = [];
      return parsed;
    } catch {
      return null;
    }
  },
};
