import { expect, test } from "@playwright/test";

test.describe("hamburger menu (mobile)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("toggle button is hidden on desktop and visible on mobile", async ({
    page,
    isMobile,
  }) => {
    const toggle = page.getByRole("button", { name: /menu/i });
    if (isMobile) {
      await expect(toggle).toBeVisible();
    } else {
      await expect(toggle).toBeHidden();
    }
  });

  test("opens on click and closes on Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only behavior");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("closes when clicking outside the panel", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only behavior");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeVisible();
    // Click on a known outside element (the wordmark).
    await page.locator(".wordmark-bold").click();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("aria-expanded reflects open state", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only behavior");
    const toggle = page.getByRole("button", { name: /menu/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("theme toggle inside the panel keeps the menu open", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "mobile-only behavior");
    await page.getByRole("button", { name: "Open menu" }).click();
    const themeButton = page
      .locator(".menu-panel")
      .getByRole("button")
      .filter({ hasNotText: /menu/i })
      .first();
    await themeButton.click();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeVisible();
  });
});
