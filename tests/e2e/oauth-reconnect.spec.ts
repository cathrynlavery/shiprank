import { expect, test } from "@playwright/test";
import { mockOauthProfile } from "./oauth-fixtures";

test.describe("OAuth reconnect", () => {
  test("reconnect from revoked state returns to full visibility", async ({ page }) => {
    await mockOauthProfile(page, "revoked");
    await page.goto("/ada");

    await page.getByRole("link", { name: "reconnect" }).click();
    await expect(page.getByRole("heading", { name: "full visibility on" })).toBeVisible();
  });
});
