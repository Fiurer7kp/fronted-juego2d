import { t, setIdioma, getIdioma } from '../i18n/i18n';
import { AuthService } from '../services/AuthService';
import { AudioManager, TRACKS } from '../services/AudioManager';

export class MenuPage {

  render(container: HTMLElement): void {
    const sesion = AuthService.getSesion();
    if (!sesion) {
      import('./LoginPage').then(({ LoginPage }) => new LoginPage().render(container));
      return;
    }
    AudioManager.playMusic(TRACKS.menu);
    container.innerHTML = this.getHTML(sesion.username, sesion.hasSavedGame);
    this.agregarEventos(container, sesion);
  }

  private getHTML(username: string, hasSavedGame: boolean): string {
    return `
      <main class="menu-main" style="position:relative;overflow:hidden;">
        <video autoplay muted loop playsinline
               style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.18;pointer-events:none;z-index:0;">
          <source src="/src/assets/Movies/Brave_OP.mp4" type="video/mp4">
        </video>
        <div class="menu-bg-lineas"></div>
        <div class="menu-contenido" style="position:relative;z-index:1;">
          <div class="menu-header">
            <div class="menu-emblema">✦</div>
            <h1 class="menu-titulo">Ashen Crown</h1>
            <p class="menu-bienvenida">${t('menu.bienvenida')}, <span class="menu-usuario">${username}</span></p>
            <div class="ornamento">◆</div>
          </div>
          <nav class="menu-opciones">
            <button class="menu-btn" id="btn-empezar">
              <span class="menu-btn-icono">⚔</span>
              <span class="menu-btn-texto">${t('menu.empezar')}</span>
              <span class="menu-btn-flecha">›</span>
            </button>
            <button class="menu-btn ${!hasSavedGame ? 'menu-btn-bloqueado' : ''}" id="btn-continuar" ${!hasSavedGame ? 'disabled' : ''}>
              <span class="menu-btn-icono">${hasSavedGame ? '📜' : '🔒'}</span>
              <span class="menu-btn-texto">
                ${t('menu.continuar')}
                ${!hasSavedGame ? `<small class="menu-btn-nota">${t('menu.continuar.bloq')}</small>` : ''}
              </span>
              <span class="menu-btn-flecha">${hasSavedGame ? '›' : ''}</span>
            </button>
            <button class="menu-btn menu-btn-ia" id="btn-modos-ia">
              <span class="menu-btn-icono">🤖</span>
              <span class="menu-btn-texto">
                Modos IA
                <small class="menu-btn-nota" style="color:#a0f0d0;">Niveles generados por IA</small>
              </span>
              <span class="menu-btn-flecha">›</span>
            </button>
            <button class="menu-btn" id="btn-idioma">
              <span class="menu-btn-icono">🌐</span>
              <span class="menu-btn-texto">${t('menu.idioma')}</span>
              <span class="menu-btn-flecha">›</span>
            </button>
            <button class="menu-btn menu-btn-salir" id="btn-salir">
              <span class="menu-btn-icono">↩</span>
              <span class="menu-btn-texto">${t('menu.cerrar')}</span>
              <span class="menu-btn-flecha"></span>
            </button>
          </nav>
        </div>
        <div class="idioma-overlay" id="idioma-overlay" style="display:none;">
          <div class="idioma-panel">
            <h3 class="idioma-titulo">${t('idioma.titulo')}</h3>
            <div class="idioma-opciones">
              <button class="idioma-btn ${getIdioma() === 'es' ? 'idioma-btn-activo' : ''}" data-lang="es">🇨🇴 &nbsp; ${t('idioma.es')}</button>
              <button class="idioma-btn ${getIdioma() === 'en' ? 'idioma-btn-activo' : ''}" data-lang="en">🇺🇸 &nbsp; ${t('idioma.en')}</button>
            </div>
            <div class="idioma-acciones">
              <button class="btn btn-primario" id="btn-guardar-idioma">${t('idioma.guardar')}</button>
              <button class="btn btn-secundario" id="btn-cerrar-idioma">✕</button>
            </div>
            <div class="auth-error" id="idioma-error"></div>
          </div>
        </div>
      </main>
    `;
  }

  private agregarEventos(container: HTMLElement, sesion: ReturnType<typeof AuthService.getSesion>): void {
    if (!sesion) return;

    container.querySelector('#btn-empezar')?.addEventListener('click', () => {
      import('./CampaignPage').then(({ CampaignPage }) => {
        new CampaignPage().render(document.getElementById('app')!);
      });
    });

    container.querySelector('#btn-modos-ia')?.addEventListener('click', () => {
      import('./AIModesPage').then(({ AIModesPage }) => {
        new AIModesPage().render(document.getElementById('app') ?? container);
      });
    });

    const overlay = container.querySelector('#idioma-overlay') as HTMLDivElement;
    let idiomaSeleccionado = getIdioma();

    container.querySelector('#btn-idioma')?.addEventListener('click', () => {
      overlay.style.display = 'flex';
    });

    container.querySelector('#btn-cerrar-idioma')?.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    container.querySelectorAll('.idioma-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.idioma-btn').forEach(b => b.classList.remove('idioma-btn-activo'));
        btn.classList.add('idioma-btn-activo');
        idiomaSeleccionado = (btn as HTMLElement).dataset.lang || 'es';
      });
    });

    const btnGuardar  = container.querySelector('#btn-guardar-idioma') as HTMLButtonElement;
    const idiomaError = container.querySelector('#idioma-error')       as HTMLDivElement;

    btnGuardar?.addEventListener('click', async () => {
      btnGuardar.textContent = t('idioma.guardando');
      btnGuardar.disabled    = true;
      const res = await AuthService.updateLanguage(sesion.userId, idiomaSeleccionado);
      btnGuardar.disabled = false;
      if (res.success) {
        setIdioma(idiomaSeleccionado);
        overlay.style.display = 'none';
        new MenuPage().render(container);
      } else {
        idiomaError.textContent  = res.message;
        btnGuardar.textContent   = t('idioma.guardar');
      }
    });

    container.querySelector('#btn-salir')?.addEventListener('click', () => {
      AuthService.cerrarSesion();
      location.reload();
    });
  }
}
