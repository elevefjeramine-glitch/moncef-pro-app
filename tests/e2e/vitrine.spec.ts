import { expect, test } from "@playwright/test";

/** La vitrine, sans compte : ce que n'importe quel visiteur voit. Ces assertions sont
 *  rejouables sur la production telle quelle — elles ne rien écrivent. */
test.describe("vitrine", () => {
  test("le manifeste et le worker hors-ligne sont servis avec le bon type", async ({ request }) => {
    const manifeste = await request.get("/manifest.webmanifest");
    expect(manifeste.ok()).toBe(true);
    expect(manifeste.headers()["content-type"]).toContain("application/manifest+json");
    const json = await manifeste.json();
    expect(json.start_url).toBe("/app");
    expect(Array.isArray(json.icons) && json.icons.length).toBeGreaterThanOrEqual(2);

    const worker = await request.get("/sw-offline.js");
    expect(worker.ok()).toBe(true);
    expect(worker.headers()["content-type"]).toContain("javascript");
    expect(worker.headers()["cache-control"]).toContain("must-revalidate");
  });

  test("une seule balise theme-color, et elle est la même que dans le manifeste", async ({ page, request }) => {
    await page.goto("/");
    const couleurs = page.locator('meta[name="theme-color"]');
    await expect(couleurs).toHaveCount(1); // deux balises = deux couleurs qui se disputent la barre du téléphone
    const couleur = (await couleurs.first().getAttribute("content"))?.toLowerCase();
    const json = await (await request.get("/manifest.webmanifest")).json();
    expect(couleur).toBe(String(json.theme_color).toLowerCase());
    expect(couleur).toBe("#0b1f13");
  });

  test("aucun débordement horizontal sur un téléphone de 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 });
    await page.goto("/");
    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(debord, `débord horizontal de ${debord} px`).toBeLessThanOrEqual(1);
  });

  test("les en-têtes de sécurité sont là, et le micro n'est pas accordé d'office", async ({ request }) => {
    const res = await request.get("/app/thunder");
    expect(res.status()).toBeLessThan(500);
    const politique = res.headers()["permissions-policy"] ?? "";
    expect(politique).toContain("camera=()");
    expect(politique).toContain("microphone=(self)");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
