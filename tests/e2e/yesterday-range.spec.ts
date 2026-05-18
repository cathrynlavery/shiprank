import { expect, test } from "@playwright/test";

test.describe("leaderboard range toggle", () => {
  test("renders today by default", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("region").getByRole("link", { name: "today" }),
    ).toHaveCount(0); // The active item has class "active", not a region role
    const todayLink = page.locator(".tabs-list").first().getByText("today", {
      exact: true,
    });
    await expect(todayLink).toHaveClass(/active/);
  });

  test("?range=yesterday marks yesterday active", async ({ page }) => {
    await page.goto("/?range=yesterday");
    const yesterdayLink = page
      .locator(".tabs-list")
      .first()
      .getByText("yesterday", { exact: true });
    await expect(yesterdayLink).toHaveClass(/active/);
  });

  test("?range=week marks last 7 days active", async ({ page }) => {
    await page.goto("/?range=week");
    const weekLink = page
      .locator(".tabs-list")
      .first()
      .getByText("last 7 days", {
        exact: true,
      });
    await expect(weekLink).toHaveClass(/active/);
  });

  test("range + sort=prs both encoded in URL", async ({ page }) => {
    await page.goto("/?range=yesterday&by=prs");
    const yesterdayLink = page
      .locator(".tabs-list")
      .first()
      .getByText("yesterday", { exact: true });
    const prsLink = page.locator(".toggle").first().getByText("by prs", {
      exact: true,
    });
    await expect(yesterdayLink).toHaveClass(/active/);
    await expect(prsLink).toHaveClass(/active/);
  });

  test("unknown range falls back to today", async ({ page }) => {
    await page.goto("/?range=foobar");
    const todayLink = page.locator(".tabs-list").first().getByText("today", {
      exact: true,
    });
    await expect(todayLink).toHaveClass(/active/);
  });
});
