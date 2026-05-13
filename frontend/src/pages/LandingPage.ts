import { t } from '../i18n/i18n';

export class LandingPage {

  render(container: HTMLElement): void {
    container.innerHTML = this.getHTML();
    this.crearAscuas();
    this.animarEntrada();
    this.agregarEventos(container);
  }

  private getHTML(): string {
    return `
      <canvas id="ascuas-canvas"></canvas>
      <main class="landing-main">
        <section class="landing-izquierda">
          <div class="landing-emblema">✦</div>
          <div class="landing-titulo-wrapper">
            <span class="landing-subtitulo">${t('landing.subtitulo')}</span>
            <h1 class="landing-titulo">Ashen<br/>Crown</h1>
            <div class="ornamento">✦</div>
            <p class="landing-descripcion">${t('landing.descripcion').replace(/\n/g, '<br/>')}</p>
          </div>
        </section>
        <section class="landing-derecha">
          <div class="landing-panel" id="panel-acceso">
            <p class="landing-bienvenida">${t('landing.pregunta')}</p>
            <div class="landing-botones">
              <button class="btn btn-primario btn-grande" id="btn-registro">${t('landing.crear')}</button>
              <div class="ornamento">◆</div>
              <button class="btn btn-secundario btn-grande" id="btn-login">${t('landing.iniciar')}</button>
            </div>
            <p class="landing-nota">${t('landing.nota')}</p>
          </div>
        </section>
      </main>
      <footer class="landing-footer">
        <span>Ashen Crown &nbsp;·&nbsp; Estructura de Datos &nbsp;·&nbsp; UCC 2026</span>
      </footer>
    `;
  }

  private agregarEventos(container: HTMLElement): void {
    container.querySelector('#btn-registro')?.addEventListener('click', () => {
      import('./RegisterPage').then(({ RegisterPage }) => {
        new RegisterPage().render(document.getElementById('app')!);
      });
    });

    container.querySelector('#btn-login')?.addEventListener('click', () => {
      import('./LoginPage').then(({ LoginPage }) => {
        new LoginPage().render(document.getElementById('app')!);
      });
    });
  }

  private animarEntrada(): void {
    const selectores = [
      '.landing-emblema', '.landing-subtitulo', '.landing-titulo',
      '.ornamento', '.landing-descripcion', '.landing-panel',
    ];
    selectores.forEach((sel, i) => {
      const el = document.querySelector(sel) as HTMLElement;
      if (el) {
        el.style.opacity = '0';
        el.style.animation = `fadeUp 0.7s ease forwards`;
        el.style.animationDelay = `${i * 0.15}s`;
      }
    });
  }

  private crearAscuas(): void {
    const canvas = document.getElementById('ascuas-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particula { x: number; y: number; radio: number; vY: number; vX: number; opacidad: number; color: string; }
    const colores = ['#c8922a', '#e8b84b', '#8b2020', '#ff6b35', '#fff3e0'];
    const particulas: Particula[] = Array.from({ length: 35 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radio: Math.random() * 2 + 0.5,
      vY: -(Math.random() * 0.8 + 0.3),
      vX: (Math.random() - 0.5) * 0.4,
      opacidad: Math.random(),
      color: colores[Math.floor(Math.random() * colores.length)],
    }));

    const animar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particulas.forEach(p => {
        p.y += p.vY; p.x += p.vX; p.opacidad -= 0.002;
        if (p.y < -10 || p.opacidad <= 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 10;
          p.opacidad = Math.random() * 0.8 + 0.2;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacidad;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(animar);
    };
    animar();
    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }
}