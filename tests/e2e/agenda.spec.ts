import { expect, test } from "@playwright/test";

/** Le lien d'agenda, côté HTTP : ce qui ne demande pas de compte. */
test.describe("agenda .ics", () => {
  test("un jeton inconnu, un jeton trop court et une traversée de chemin renvoient le même 404", async ({ request }) => {
    const mauvais = ["0000000000000000000000000000000f", "0".repeat(31), "a".repeat(33), "../../etc/passwd", ""];
    const statuts: number[] = [];
    for (const j of mauvais) statuts.push((await request.get(`/api/agenda/${j}.ics`)).status());
    expect(new Set(statuts).size, `statuts hétérogènes : ${statuts.join(",")} — un 403/404 distinct renseignerait sur l'existence d'un compte`).toBe(1);
    expect(statuts[0]).toBeLessThan(500);
  });

  test("créer un lien sans session est refusé", async ({ request }) => {
    const res = await request.post("/api/agenda", { data: { action: "creer" } });
    expect(res.status()).toBe(401);
  });

  test("le .ics d'un lien valide est du texte calendrier, plié à 75 octets", async ({ request }, testInfo) => {
    const url = process.env.E2E_LIEN_AGENDA;
    test.skip(!url, "E2E_LIEN_AGENDA non fourni : créer un lien depuis un compte de test, puis le passer en variable");
    const res = await request.get(url!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const corps = await res.text();
    expect(corps.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(corps).toContain("END:VCALENDAR\r\n");
    expect(corps).toContain("TZID=Africa/Casablanca");
    for (const ligne of corps.split("\r\n")) {
      expect(Buffer.byteLength(ligne, "utf8"), `ligne de ${Buffer.byteLength(ligne, "utf8")} octets`).toBeLessThanOrEqual(75);
    }
    testInfo.annotations.push({ type: "pliage", description: "75 octets UTF-8 par ligne, vérifié sur le fichier réellement servi" });
  });
});
