import { expect, test } from "@playwright/test";
import { mockOauthProfile } from "./oauth-fixtures";

test.describe("OAuth mid-cron token refresh", () => {
  test("manual refresh succeeds after mocked token refresh", async ({ page }) => {
    await page.route("https://github.com/login/oauth/access_token", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ access_token: "fresh-oauth-token" }),
      });
    });
    await mockOauthProfile(page, "opted-in");

    await page.goto("/ada");
    await page.getByRole("button", { name: "refresh now" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-refreshed", "true");
  });
});
