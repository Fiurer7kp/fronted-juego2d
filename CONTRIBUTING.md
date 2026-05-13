# Distribución de trabajo — Ashen Crown

## Equipo y dominio de cada dev

| Dev | Dominio | Backend | Frontend | Total |
|-----|---------|---------|----------|-------|
| **[T] Tasco** `@JoseTasco` | Motor de juego | 18 archivos | 6 archivos | 24 |
| **[S] Sebastian** `@DevSebastian` | Campaña + Visual | 13 archivos | 7 archivos | 20 |
| **[F] Felipe** `@DevFelipe` | Auth + DevOps | 10 archivos | 6 archivos | 16 + configs |

Los 3 trabajan en **backend Y frontend**. Nadie está solo en un lado.

---

## BACKEND — `backend/src/main/java/com/ashencrown/`

```
com/ashencrown/
│
├── AshenCrownApplication.java                     [F] Felipe
│
├── config/
│   └── SecurityConfig.java                        [F] Felipe
│
├── controller/
│   ├── AuthController.java                        [F] Felipe
│   ├── LevelController.java                       [S] Sebastian
│   └── GameController.java                        [T] Tasco
│
├── service/
│   ├── AuthService.java                           [F] Felipe
│   ├── LevelService.java                          [S] Sebastian
│   ├── GameService.java                           [T] Tasco
│   ├── CombatService.java                         [T] Tasco
│   ├── AIService.java                             [T] Tasco
│   ├── MovementService.java                       [T] Tasco
│   ├── PathfindingService.java                    [T] Tasco
│   └── ExperienceService.java                     [T] Tasco
│
├── model/
│   ├── User.java                                  [F] Felipe
│   ├── Campaign.java                              [S] Sebastian
│   ├── Level.java                                 [S] Sebastian
│   ├── UnitDefinition.java                        [S] Sebastian
│   ├── TerrainType.java                           [S] Sebastian
│   ├── Tile.java                                  [S] Sebastian
│   ├── Position.java                              [S] Sebastian
│   ├── WeaponType.java                            [S] Sebastian
│   ├── AIBehavior.java                            [S] Sebastian
│   ├── GameState.java                             [T] Tasco
│   ├── GameMap.java                               [T] Tasco
│   ├── Unit.java                                  [T] Tasco
│   └── Weapon.java                                [T] Tasco
│
├── repository/
│   └── UserRepository.java                        [F] Felipe
│
└── dto/
    ├── AuthResponseDto.java                       [F] Felipe
    ├── LoginRequestDto.java                       [F] Felipe
    ├── RegisterRequestDto.java                    [F] Felipe
    ├── LanguageRequestDto.java                    [F] Felipe
    ├── CampaignDto.java                           [S] Sebastian
    ├── LevelDto.java                              [S] Sebastian
    ├── UnitDefinitionDto.java                     [S] Sebastian
    ├── AttackRequestDto.java                      [T] Tasco
    ├── MoveRequestDto.java                        [T] Tasco
    ├── MoveResultDto.java                         [T] Tasco
    ├── CombatPreviewDto.java                      [T] Tasco
    ├── CombatResultDto.java                       [T] Tasco
    ├── EnemyActionDto.java                        [T] Tasco
    └── EnemyTurnResultDto.java                    [T] Tasco
```

**Backend — recursos** → todos son de `[F] Felipe`
```
backend/src/main/resources/
├── application.properties            (local dev, gitignored)
├── application.properties.example
└── application-prod.properties       (producción Render)
backend/src/test/resources/
└── application.properties            (H2 para CI)
```

---

## FRONTEND — `frontend/src/`

```
frontend/src/
│
├── main.ts                           [F] Felipe
├── vite-env.d.ts                     [F] Felipe
│
├── pages/
│   ├── LoginPage.ts                  [F] Felipe
│   ├── RegisterPage.ts               [F] Felipe
│   ├── LandingPage.ts                [S] Sebastian
│   ├── MenuPage.ts                   [S] Sebastian
│   ├── CutscenePage.ts               [S] Sebastian
│   ├── CampaignPage.ts               [T] Tasco
│   └── GamePage.ts                   [T] Tasco
│
├── services/
│   ├── AuthService.ts                [F] Felipe
│   ├── AssetManager.ts               [S] Sebastian
│   ├── AudioManager.ts               [T] Tasco
│   └── GameService.ts                [T] Tasco
│
├── styles/
│   ├── auth.css                      [F] Felipe
│   ├── global.css                    [S] Sebastian
│   ├── LandingPage.css               [S] Sebastian
│   ├── campaign.css                  [T] Tasco
│   └── game.css                      [T] Tasco
│
└── i18n/
    └── i18n.ts                       [S] Sebastian
```

**Frontend — configs** → todos son de `[F] Felipe`
```
frontend/
├── vercel.json
├── .env.example
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## RAÍZ del proyecto → `[F] Felipe`
```
/
├── render.yaml
├── .github/workflows/ci.yml
├── .github/workflows/deploy.yml
└── .github/CODEOWNERS
```

---

## Resumen detallado por dev

### [T] Tasco — Motor de juego
**Backend (18):** `GameController` · `GameService` · `CombatService` · `AIService` · `MovementService` · `PathfindingService` · `ExperienceService` · `GameState` · `GameMap` · `Unit` · `Weapon` · `AttackRequestDto` · `MoveRequestDto` · `MoveResultDto` · `CombatPreviewDto` · `CombatResultDto` · `EnemyActionDto` · `EnemyTurnResultDto`

**Frontend (6):** `CampaignPage.ts` · `GamePage.ts` · `AudioManager.ts` · `GameService.ts` · `campaign.css` · `game.css`

---

### [S] Sebastian — Campaña + Visual
**Backend (13):** `LevelController` · `LevelService` · `Campaign` · `Level` · `UnitDefinition` · `TerrainType` · `Tile` · `Position` · `WeaponType` · `AIBehavior` · `CampaignDto` · `LevelDto` · `UnitDefinitionDto`

**Frontend (7):** `LandingPage.ts` · `MenuPage.ts` · `CutscenePage.ts` · `AssetManager.ts` · `global.css` · `LandingPage.css` · `i18n.ts`

---

### [F] Felipe — Auth + DevOps
**Backend (10):** `AshenCrownApplication` · `SecurityConfig` · `AuthController` · `AuthService` · `User` · `UserRepository` · `AuthResponseDto` · `LoginRequestDto` · `RegisterRequestDto` · `LanguageRequestDto`

**Frontend (6):** `main.ts` · `vite-env.d.ts` · `AuthService.ts` · `LoginPage.ts` · `RegisterPage.ts` · `auth.css`

**DevOps (configs):** `render.yaml` · `ci.yml` · `deploy.yml` · `application-prod.properties` · `application.properties.example`

---

## Flujo de ramas

```bash
# Antes de empezar: actualizar develop
git checkout develop
git pull origin develop

# Crear tu rama (una por tarea)
git checkout -b feature/tasco/<tarea>
git checkout -b feature/sebastian/<tarea>
git checkout -b feature/felipe/<tarea>

# Commit y push
git add <tus-archivos>
git commit -m "feat: descripción corta"
git push origin feature/<dev>/<tarea>

# Abrir PR en GitHub → develop
# CI verde + 1 aprobación → merge
# Release: PR develop → main (lo abre Felipe)
```

## Convención de commits
```
feat:     nueva funcionalidad
fix:      corrección de bug
refactor: refactorización sin cambio funcional
style:    solo CSS o formato
docs:     solo documentación
```

---

## Secrets en GitHub — los configura Felipe
*(Settings → Secrets and variables → Actions)*

| Secret | De dónde sacarlo |
|--------|-----------------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` tras `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` tras `vercel link` |
| `RENDER_DEPLOY_HOOK_URL` | Render → Service → Settings → Deploy Hook |
