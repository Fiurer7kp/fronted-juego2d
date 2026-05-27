import type { GameMode, Difficulty } from './AILevelGenerator';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface AILevelContent {
  levelName:      string;
  description:    string;
  objective:      string;
  bossDialogue:   string;
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
  ): Promise<AILevelContent | null> {
    if (!API_KEY || API_KEY === 'tu_api_key_aqui') return null;

    const bossClass = enemyClasses[0] ?? 'Guerrero';
    const prompt = `Eres el narrador de un juego de rol táctico medieval oscuro llamado "Ashen Crown".
Genera contenido dramático y épico para un nivel con estos parámetros:
- Tipo de batalla: ${MODE_NAMES[mode]}
- Dificultad: ${DIFF_LABELS[difficulty]} (${difficulty}/5)
- Clases enemigas presentes: ${enemyClasses.join(', ')}
- Clase del jefe enemigo: ${bossClass}

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones, exactamente con este formato:
{
  "levelName": "nombre épico del nivel en español (máximo 5 palabras)",
  "description": "descripción dramática en 1-2 oraciones (máximo 25 palabras)",
  "objective": "objetivo del nivel comenzando con un verbo imperativo (máximo 8 palabras)",
  "bossDialogue": "frase amenazante del jefe enemigo al comenzar el nivel (máximo 15 palabras)",
  "victoryMessage": "mensaje épico de victoria en 1 oración (máximo 12 palabras)",
  "defeatMessage": "mensaje dramático de derrota en 1 oración (máximo 12 palabras)"
}`;

    try {
      const res = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 300 },
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(clean) as AILevelContent;
    } catch {
      return null;
    }
  },
};
