import { t, setIdioma } from '../i18n/i18n';
import { AuthService } from '../services/AuthService';

export class LoginPage {

  render(container: HTMLElement, mensajeExito?: string): void {
    container.innerHTML = this.getHTML(mensajeExito);
    this.agregarEventos(container);
  }

  private getHTML(mensajeExito?: string): string {
    return `
      <main class="auth-main">
        <div class="auth-panel">
          <div class="auth-emblema">✦</div>
          <h2 class="auth-titulo">${t('login.titulo')}</h2>
          <div class="ornamento">◆</div>
          ${mensajeExito ? `<div class="auth-exito">${mensajeExito}</div>` : ''}
          <form class="auth-form" id="form-login" novalidate>
            <div class="campo-grupo">
              <label class="campo-label">${t('login.usuario')}</label>
              <input class="input-campo" type="text" id="input-usuario" placeholder="Tu nombre de comandante" autocomplete="username"/>
            </div>
            <div class="campo-grupo">
              <label class="campo-label">${t('login.password')}</label>
              <input class="input-campo" type="password" id="input-password" placeholder="••••••••" autocomplete="current-password"/>
            </div>
            <div class="auth-error" id="auth-error"></div>
            <button class="btn btn-primario btn-grande" type="submit" id="btn-submit">${t('login.boton')}</button>
          </form>
          <p class="auth-link-texto">
            ${t('login.sin_cuenta')}
            <button class="auth-link" id="btn-ir-registro">${t('login.ir_registro')}</button>
          </p>
        </div>
        <div class="auth-deco">
          <div class="auth-deco-linea"></div>
          <span class="auth-deco-texto">ASHEN CROWN</span>
          <div class="auth-deco-linea"></div>
        </div>
      </main>
    `;
  }

  private agregarEventos(container: HTMLElement): void {
    const form        = container.querySelector('#form-login')      as HTMLFormElement;
    const btnRegistro = container.querySelector('#btn-ir-registro') as HTMLButtonElement;
    const errorBox    = container.querySelector('#auth-error')      as HTMLDivElement;
    const btnSubmit   = container.querySelector('#btn-submit')      as HTMLButtonElement;

    btnRegistro.addEventListener('click', () => {
      import('./RegisterPage').then(({ RegisterPage }) => {
        new RegisterPage().render(document.getElementById('app')!);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';

      const usuario  = (container.querySelector('#input-usuario')  as HTMLInputElement).value.trim();
      const password = (container.querySelector('#input-password') as HTMLInputElement).value;

      if (!usuario || !password) { errorBox.textContent = t('error.campos'); return; }

      btnSubmit.textContent = t('login.cargando');
      btnSubmit.disabled    = true;

      const respuesta = await AuthService.login(usuario, password);

      btnSubmit.textContent = t('login.boton');
      btnSubmit.disabled    = false;

      if (respuesta.success) {
        AuthService.guardarSesion(respuesta);
        if (respuesta.language) setIdioma(respuesta.language);
        import('./MenuPage').then(({ MenuPage }) => {
          new MenuPage().render(document.getElementById('app')!);
        });
      } else {
        errorBox.textContent = respuesta.message;
      }
    });
  }
}
