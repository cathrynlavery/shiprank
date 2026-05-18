import { expect, test } from "@playwright/test";
import { mockOauthProfile } from "./oauth-fixtures";

test.describe("OAuth revoke detection", () => {
  test("mocked 401 revoke state appears on the profile", async ({ page }) => {
    await page.route("https://api.github.com/search/commits**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bad credentials" }),
      });
    });
    await mockOauthProfile(page, "revoked");

    await page.goto("/ada");
    await expect(
      page.getByRole("heading", { name: "full visibility disconnected" }),
    ).toBeVisible();
    await expect(page.getByText("Reconnect?")).toBeVisible();
  });
});
