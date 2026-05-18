import type { Page } from "@playwright/test";

type OauthState = "not-opted-in" | "opted-in" | "revoked";

export async function mockOauthProfile(page: Page, initial: OauthState) {
  await page.route("**/api/auth/signin/github-full**", async (route) => {
    await route.fulfill({
      status: 302,
      headers: { location: "/ada?state=opted-in" },
      body: "",
    });
  });

  await page.route("**/api/refresh/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, generated: "2026-05-18T12:00:00.000Z" }),
    });
  });

  await page.route("**/ada**", async (route) => {
    const url = new URL(route.request().url());
    const state = (url.searchParams.get("state") as OauthState | null) ?? initial;
    const banner =
      state === "opted-in"
        ? `<section aria-label="oauth state">
            <h2>full visibility on</h2>
            <p>Counts commits on default branches across repos you can read. GitHub search doesn't index feature-branch commits.</p>
            <a href="https://github.com/settings/connections/applications/full-client">revoke in github</a>
          </section>`
        : state === "revoked"
          ? `<section aria-label="oauth state">
              <h2>full visibility disconnected</h2>
              <p>Full visibility was disconnected on May 18, 2026. Reconnect?</p>
              <a href="/ada?state=opted-in">reconnect</a>
            </section>`
          : `<section aria-label="oauth state">
              <h2>counting owned and org repos</h2>
              <p>Counting only repos owned by you and your orgs. GitHub will ask permission for repo access.</p>
              <a href="/ada?state=opted-in">grant full visibility</a>
            </section>`;

    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <html>
          <body>
            <main>
              <h1>@ada</h1>
              <button id="refresh">refresh now</button>
              ${banner}
            </main>
            <script>
              document.getElementById("refresh").addEventListener("click", async () => {
                await fetch("/api/refresh/me", { method: "POST" });
                document.body.dataset.refreshed = "true";
              });
            </script>
          </body>
        </html>`,
    });
  });
}
