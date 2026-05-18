import { expect, test } from "@playwright/test";
import { mockOauthProfile } from "./oauth-fixtures";

test.describe("OAuth opt-in", () => {
  test("happy-path opt-in shows the opted-in state", async ({ page }) => {
    await mockOauthProfile(page, "not-opted-in");
    await page.goto("/ada");

    await expect(page.getByText("Counting only repos owned by you")).toBeVisible();
    await page.getByRole("link", { name: "grant full visibility" }).click();
    await expect(page.getByRole("heading", { name: "full visibility on" })).toBeVisible();
    await expect(page.getByText("default branches")).toBeVisible();
  });
});
