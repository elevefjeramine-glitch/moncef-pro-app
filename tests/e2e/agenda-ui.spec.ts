import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const motDePasse = process.env.E2E_MOT_DE_PASSE;

async function seConnecter(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', email!);
  await page.fill('input[type="password"]', motDePasse!);
  await page.click('[data-testid="auth-submit"]');
  await page.waitForURL(/\/app/, { timeout: 20_000 });
}

/** Les trois flux qui écrivent en base ne jouent que sur un compte de test. */
test.describe("agenda, depuis l'interface", () => {
  test.skip(!email || !motDePasse, "E2E_EMAIL / E2E_MOT_DE_PASSE non fournis — ces specs écrivent en base");
  test.use({ storageState: undefined });

  test("créer, copier, puis retirer le lien", async ({ page, request }) => {
    await seConnecter(page);
    await page.goto("/app/schedule");
    const bloc = page.locator(".agenda-lien");
    await expect(bloc).toBeVisible();

    const reponse = page.waitForResponse((r) => r.url().endsWith("/api/agenda") && r.request().method() === "POST");
    await bloc.getByRole("button", { name: /Créer le lien|Create the link/ }).click();
    const json = await (await reponse).json();
    expect(json.actif).toBe(true);
    expect(String(json.lien)).toMatch(/^\/api\/agenda\/[0-9a-f]{32}\.ics$/);

    const champ = bloc.locator("input[readonly]");
    await expect(champ).toBeVisible();
    const url = new URL(await champ.inputValue());
    const ics = await request.get(url.pathname);
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VCALENDAR");

    await bloc.getByRole("button", { name: /Retirer|Remove/ }).click();
    await page.waitForResponse((r) => r.url().endsWith("/api/agenda") && r.request().method() === "POST");
    expect((await request.get(url.pathname)).status()).toBe(404); // le lien retiré est mort
  });

  test("un lien volé puis régénéré ne marche plus", async ({ page, request }) => {
    await seConnecter(page);
    await page.goto("/app/schedule");
    const bloc = page.locator(".agenda-lien");
    const premier = await (await page.waitForResponse((r) => r.url().endsWith("/api/agenda") && r.request().method() === "POST")).json().catch(() => null);
    if (!premier?.lien) {
      const p = page.waitForResponse((r) => r.url().endsWith("/api/agenda") && r.request().method() === "POST");
      await bloc.getByRole("button", { name: /Créer le lien|Create the link/ }).click();
      await p;
    }
    const avant = new URL(await bloc.locator("input[readonly]").inputValue()).pathname;
    const p2 = page.waitForResponse((r) => r.url().endsWith("/api/agenda") && r.request().method() === "POST");
    await bloc.getByRole("button", { name: /Régénérer|Regenerate/ }).click();
    await p2;
    const apres = new URL(await bloc.locator("input[readonly]").inputValue()).pathname;
    expect(apres).not.toBe(avant);
    expect((await request.get(avant)).status()).toBe(404);
    expect((await request.get(apres)).status()).toBe(200);
  });
});
