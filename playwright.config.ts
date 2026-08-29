import { defineConfig, devices } from "@playwright/test";

/**
 * E1 · les bout-à-bout Playwright. Écrits et typés ici, ils ne sont PAS exécutés dans
 * cet atelier : le téléchargement des navigateurs (≈ 400 Mo) n'y est pas possible, et
 * prétendre avoir fait passer un test qu'aucun navigateur n'a exécuté serait exactement
 * le défaut que je corrige ailleurs dans ce projet.
 *
 * Comment les jouer :
 *   npx playwright install --with-deps chromium     # une seule fois
 *   npx playwright test                             # démarre `npm run dev` lui-même
 *   E2E_BASE_URL=https://proappmoncef.netlify.app E2E_SANS_SERVEUR=1 npx playwright test
 *   E2E_EMAIL=… E2E_MOT_DE_PASSE=… npx playwright test tests/e2e/agenda-ui   # flux connectés
 *
 * Deux familles de specs, et c'est voulu :
 *  · celles qui n'ont pas besoin de compte (vitrine, manifeste, hors-ligne, refuser
 *    un mauvais jeton) jouent PARTOUT, y compris sur la production ;
 *  · celles qui écrivent en base ne jouent que si `E2E_EMAIL` est fourni, et visent un
 *    compte de test : un vert obtenu en touchant le compte d'un élève n'est pas un vert.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const sansServeur = process.env.E2E_SANS_SERVEUR === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["iPhone 13"]}, testMatch: /vitrine|hors-ligne/ },
  ],
  // `exactOptionalPropertyTypes` est allumé dans ce dépôt : une propriété optionnelle
  // n'accepte pas `undefined`. D'où la propagation conditionnelle plutôt que le ternaire.
  ...(sansServeur
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: BASE,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});
