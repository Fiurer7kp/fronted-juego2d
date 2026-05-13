// Mapa de nivel → video de intro (StoryOP del FEH)
export const LEVEL_MOVIES: Record<string, string> = {
  'level-1':  '/src/assets/Movies/StoryOP2.mp4',
  'level-2':  '/src/assets/Movies/StoryOP3 - ENG.mp4',
  'level-3':  '/src/assets/Movies/StoryOP4.mp4',
  'level-4':  '/src/assets/Movies/StoryOP5.mp4',
  'level-5':  '/src/assets/Movies/StoryOP6.mp4',
  'level-6':  '/src/assets/Movies/StoryOP7.mp4',
  'level-7':  '/src/assets/Movies/StoryOP8.mp4',
  'level-8':  '/src/assets/Movies/StoryOP3 - JP.mp4',
  'level-9':  '/src/assets/Movies/StoryOP4_2.mp4',
  'level-10': '/src/assets/Movies/StoryOP5_2.mp4',
  'level-11': '/src/assets/Movies/StoryOP6_2.mp4',
  'level-12': '/src/assets/Movies/StoryOP7_2.mp4',
  'level-13': '/src/assets/Movies/StoryOP8.mp4',
  'level-14': '/src/assets/Movies/StoryOP2.mp4',
};

export class CutscenePage {

  play(container: HTMLElement, levelId: string, onComplete: () => void): void {
    const src = LEVEL_MOVIES[levelId];
    if (!src) { onComplete(); return; }

    container.insertAdjacentHTML('beforeend', `
      <div id="cutscene-overlay" style="
        position:fixed; inset:0; z-index:9999;
        background:#000; display:flex;
        flex-direction:column; align-items:center; justify-content:center;">
        <video id="cutscene-vid" autoplay playsinline preload="auto"
               style="max-width:100%; max-height:100vh; object-fit:contain;">
          <source src="${src}" type="video/mp4">
        </video>
        <button id="cutscene-skip" style="
          position:absolute; bottom:28px; right:32px;
          background:rgba(0,0,0,0.6); border:1px solid rgba(200,146,42,0.6);
          color:#f0c040; font-family:var(--font-ui,monospace);
          font-size:0.7rem; letter-spacing:0.15em; text-transform:uppercase;
          padding:8px 20px; cursor:pointer; transition:all 0.2s;">
          Saltar ▶
        </button>
      </div>`);

    const overlay = container.querySelector('#cutscene-overlay') as HTMLElement;
    const video   = overlay.querySelector('#cutscene-vid')   as HTMLVideoElement;
    const skip    = overlay.querySelector('#cutscene-skip')  as HTMLButtonElement;

    const done = () => {
      video.pause();
      overlay.remove();
      onComplete();
    };

    video.addEventListener('ended', done, { once: true });
    skip.addEventListener('click', done, { once: true });

    // Si el video no carga en absoluto (error de red/archivo), saltar
    video.addEventListener('error', done, { once: true });
  }
}
