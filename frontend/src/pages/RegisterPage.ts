import { t } from '../i18n/i18n';
import { AuthService } from '../services/AuthService';

export class RegisterPage {

  render(container: HTMLElement): void {
    container.innerHTML = this.getHTML();
    this.agregarEventos(container);
  }

  private getHTML(): string {
    return `
      <main class="auth-main">
        <div class="auth-panel">
          <div class="auth-emblema">✦</div>
          <h2 class="auth-titulo">${t('register.titulo')}</h2>
          <div class="ornamento">◆</div>
          <form class="auth-form" id="form-registro" novalidate>
            <div class="campo-grupo">
              <label class="campo-label">${t('register.correo')}</label>
              <input class="input-campo" type="email" id="input-email" placeholder="nombre@correo.com" autocomplete="email"/>
            </div>
            <div class="campo-grupo">
              <label class="campo-label">${t('register.usuario')}</label>
              <input class="input-campo" type="text" id="input-usuario" placeholder="Comandante..." autocomplete="username" maxlength="50"/>
            </div>
            <div class="campo-grupo">
              <label class="campo-label">${t('register.password')}</label>
              <input class="input-campo" type="password" id="input-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"/>
            </div>
            <div class="auth-error" id="auth-error"></div>
            <button class="btn btn-primario btn-grande" type="submit" id="btn-submit">${t('register.boton')}</button>
          </form>
          <p class="auth-link-texto">
            ${t('register.ya_cuenta')}
            <button class="auth-link" id="btn-ir-login">${t('register.ir_login')}</button>
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
    const form      = container.querySelector('#form-registro') as HTMLFormElement;
    const btnLogin  = container.querySelector('#btn-ir-login')  as HTMLButtonElement;
    const errorBox  = container.querySelector('#auth-error')    as HTMLDivElement;
    const btnSubmit = container.querySelector('#btn-submit')    as HTMLButtonElement;

    btnLogin.addEventListener('click', () => {
      import('./LoginPage').then(({ LoginPage }) => {
        new LoginPage().render(document.getElementById('app')!);
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';

      const email    = (container.querySelector('#input-email')    as HTMLInputElement).value.trim();
      const usuario  = (container.querySelector('#input-usuario')  as HTMLInputElement).value.trim();
      const password = (container.querySelector('#input-password') as HTMLInputElement).value;

      if (!email || !usuario || !password) { errorBox.textContent = t('error.campos'); return; }

      btnSubmit.textContent = t('register.cargando');
      btnSubmit.disabled    = true;

      const respuesta = await AuthService.register(usuario, email, password);

      btnSubmit.textContent = t('register.boton');
      btnSubmit.disabled    = false;

      if (respuesta.success) {
        import('./LoginPage').then(({ LoginPage }) => {
          new LoginPage().render(document.getElementById('app')!, '¡Cuenta creada! Ya puedes iniciar sesión.');
        });
      } else {
        errorBox.textContent = respuesta.message;
      }
    });
  }
}
