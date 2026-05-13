export class AssetManager {
  private static imageCache: Map<string, HTMLImageElement> = new Map();
  private static soundCache: Map<string, HTMLAudioElement> = new Map();

  static async loadImage(path: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(path)) {
      return this.imageCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(path, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      img.src = path;
    });
  }

  static async loadSound(path: string): Promise<HTMLAudioElement> {
    if (this.soundCache.has(path)) {
      return this.soundCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        this.soundCache.set(path, audio);
        resolve(audio);
      };
      audio.onerror = () => reject(new Error(`Failed to load sound: ${path}`));
      audio.src = path;
      audio.load();
    });
  }

  static getCharacterSprite(characterClass: string): string {
    const classMap: Record<string, number> = {
      Lord: 2, Paladin: 3, Knight: 3, Mage: 5, Healer: 5,
      Warrior: 4, Archer: 6, Thief: 6, Myrmidon: 2, Cavalier: 3, Bandit: 4,
    };
    const num = classMap[characterClass] || 1;
    return `/src/assets/characters/character-${num}.png`;
  }

  static getMapBackgroundPath(mapName: string): string {
    return `/src/assets/maps/${mapName}.jpg`;
  }

  static getMusicPath(trackId: string): string {
    return `/src/assets/Music/${trackId}.mp3`;
  }

  static getSFXPath(effectId: string): string {
    return `/src/assets/Sound Effects/${effectId}.mp3`;
  }

  static clearCache(): void {
    this.imageCache.clear();
    this.soundCache.clear();
  }
}
