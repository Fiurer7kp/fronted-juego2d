import './styles/global.css';
import './styles/LandingPage.css';
import './styles/auth.css';
import './styles/game.css';
import './styles/campaign.css';
import { AuthService } from './services/AuthService';
import { setIdioma } from './i18n/i18n';

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) return;

  // Si ya tiene sesión activa → ir directo al menú
  const sesion = AuthService.getSesion();
  if (sesion) {
    if (sesion.language) setIdioma(sesion.language);
    const { MenuPage } = await import('./pages/MenuPage');
    new MenuPage().render(app);
  } else {
    const { LandingPage } = await import('./pages/LandingPage');
    new LandingPage().render(app);
  }
});
