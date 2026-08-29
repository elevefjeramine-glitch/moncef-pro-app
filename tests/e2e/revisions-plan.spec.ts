import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const motDePasse = process.env.E2E_MOT_DE_PASSE;

test.describe("plan de révision", () => {
  test.skip(!email || !motDePasse, "E2E_EMAIL / E2E_MOT_DE_PASSE non fournis");

  test("le plan est calculé SANS débit de crédit, et sans appel de modèle", async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', motDePasse!);
    await page.click('[data-testid="auth-submit"]');
    await page.waitForURL(/\/app/, { timeout: 20_000 });

    await page.goto("/app/thunder");
    await page.getByRole("button", { name: /Cartes|Cards|بطاقات/ }).first().click();
    // On attend LA réponse à la requête dont le corps porte `mode: "plan"` : le panneau
    // de révision joue d'autres appels (`etat`) au montage, et un test qui se contente
    // du premier /api/revisions venu vérifierait le mauvais mode.
    const attendue = page.waitForResponse(async (r) => {
      if (!r.url().endsWith("/api/revisions") || r.request().method() !== "POST") return false;
      if (String(r.request().postData() ?? "").includes('"mode":"plan"')) return true;
      return false;
    });
    await page.getByRole("button", { name: /Calculer le plan|Compute the plan/ }).click();
    const rep = await (await attendue).json();
    expect(rep.cout).toBe(0); // la promesse comptable : un plan ne débite rien
    expect(rep.budget_minutes).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(rep.plan.journees)).toBe(true);
  });
});
