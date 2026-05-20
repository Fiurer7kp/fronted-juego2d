import { GameService } from '../services/GameService';
import type { CampaignDto, LevelDto } from '../services/GameService';

const DIFF_LABELS = ['', '★', '★★', '★★★', '★★★★'];
const DIFF_COLORS = ['', '#4caf50', '#f0c040', '#ff9800', '#e53935'];

export class CampaignPage {

  private campaigns: CampaignDto[] = [];
  private selectedCampaign: CampaignDto | null = null;
  private selectedLevel: LevelDto | null = null;
  private container!: HTMLElement;

  async render(container: HTMLElement): Promise<void> {
    this.container = container;
    container.innerHTML = this.buildLoadingHTML();

    try {
      this.campaigns = await GameService.getAllCampaigns();
      this.selectedCampaign = this.campaigns[0] ?? null;
      this.selectedLevel = this.selectedCampaign?.levels[0] ?? null;
    } catch {
      this.campaigns = [];
    }

    this.renderPage();
  }

  private renderPage(): void {
    this.container.innerHTML = this.buildHTML();
    this.bindEvents();
  }

  private buildLoadingHTML(): string {
    return `
      <main class="camp-main">
        <div class="camp-loading">
          <div class="camp-loading-icon">⚔</div>
          <p>Cargando campañas…</p>
        </div>
      </main>`;
  }

  private buildHTML(): string {
    const campaignTabs = this.campaigns.map(c => `
      <button class="camp-tab ${c.id === this.selectedCampaign?.id ? 'camp-tab-active' : ''}"
              data-campaign="${c.id}">
        ${c.title}
      </button>`).join('');

    const campaign = this.selectedCampaign;
    const levelCards = campaign?.levels.map(lv => `
      <button class="camp-level-card ${lv.id === this.selectedLevel?.id ? 'camp-level-active' : ''}"
              data-level="${lv.id}">
        <div class="camp-level-num">${lv.name}</div>
        <div class="camp-level-diff" style="color:${DIFF_COLORS[lv.difficulty] ?? '#fff'}">
          ${DIFF_LABELS[lv.difficulty] ?? '?'}
        </div>
      </button>`).join('') ?? '';

    const lv = this.selectedLevel;
    const detailHTML = lv ? `
      <div class="camp-detail-name">${lv.name}</div>
      <p class="camp-detail-desc">${lv.description}</p>
      <div class="camp-detail-stats">
        <div class="camp-stat">
          <span class="camp-stat-label">DIFICULTAD</span>
          <span class="camp-stat-val" style="color:${DIFF_COLORS[lv.difficulty] ?? '#fff'}">
            ${DIFF_LABELS[lv.difficulty] ?? '?'}
          </span>
        </div>
        <div class="camp-stat">
          <span class="camp-stat-label">OBJETIVO</span>
          <span class="camp-stat-val">${lv.objective}</span>
        </div>
        <div class="camp-stat">
          <span class="camp-stat-label">LÍMITE DE TURNOS</span>
          <span class="camp-stat-val">${lv.turnLimit}</span>
        </div>
        <div class="camp-stat">
          <span class="camp-stat-label">ALIADOS</span>
          <span class="camp-stat-val">${lv.playerUnits.length} unidades</span>
        </div>
        <div class="camp-stat">
          <span class="camp-stat-label">ENEMIGOS</span>
          <span class="camp-stat-val">${lv.enemyUnits.length} unidades</span>
        </div>
      </div>` : '<p style="color:var(--gris-claro)">Selecciona un nivel.</p>';

    return `
      <main class="camp-main">
        <div class="camp-bg-lineas"></div>
        <div class="camp-contenido">

          <div class="camp-header">
            <div class="camp-emblema">✦</div>
            <h1 class="camp-titulo">Selección de Campaña</h1>
            <div class="ornamento">◆</div>
          </div>

          <div class="camp-tabs">${campaignTabs}</div>

          ${campaign ? `
          <div class="camp-campaign-desc">${campaign.description}</div>

          <div class="camp-levels">${levelCards}</div>

          <div class="camp-detail">${detailHTML}</div>
          ` : '<p class="camp-empty">No hay campañas disponibles.</p>'}

          <div class="camp-actions">
            <button class="btn btn-primario" id="btn-iniciar" ${!lv ? 'disabled' : ''}>
              ⚔ &nbsp; INICIAR MISIÓN
            </button>
            <button class="btn btn-secundario" id="btn-volver">
              ↩ &nbsp; MENÚ
            </button>
          </div>

        </div>
      </main>`;
  }

  private bindEvents(): void {
    this.container.querySelectorAll('.camp-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.campaign!;
        this.selectedCampaign = this.campaigns.find(c => c.id === id) ?? null;
        this.selectedLevel = this.selectedCampaign?.levels[0] ?? null;
        this.renderPage();
      });
    });

    this.container.querySelectorAll('.camp-level-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = (card as HTMLElement).dataset.level!;
        this.selectedLevel = this.selectedCampaign?.levels.find(l => l.id === id) ?? null;
        this.renderPage();
      });
    });

    this.container.querySelector('#btn-iniciar')?.addEventListener('click', async () => {
      if (!this.selectedLevel) return;
      const btn = this.container.querySelector('#btn-iniciar') as HTMLButtonElement;
      btn.textContent = '⏳ Cargando…';
      btn.disabled = true;

      // Precarga el estado del juego mientras el usuario ve la cutscene
      let initialState: import('../services/GameService').GameState | undefined;
      try {
        initialState = await GameService.newGame(this.selectedLevel.id);
      } catch { /* backend offline — GamePage usa fallback */ }

      const levelId = this.selectedLevel.id;
      const app     = document.getElementById('app')!;

      const { CutscenePage } = await import('./CutscenePage');
      const { GamePage }     = await import('./GamePage');

      new CutscenePage().play(app, levelId, () => {
        new GamePage().render(app, initialState, levelId);
      });
    });

    this.container.querySelector('#btn-volver')?.addEventListener('click', () => {
      import('./MenuPage').then(({ MenuPage }) => new MenuPage().render(this.container));
    });
  }
}
