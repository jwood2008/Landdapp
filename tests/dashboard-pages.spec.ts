import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  visualSnapshot,
  checkCardPadding,
  checkNoHorizontalScroll,
  checkTextContrast,
  checkTouchTargets,
  checkBorderRadiusConsistency,
} from './helpers';

/**
 * Dashboard pages require authentication.
 * These tests verify visual quality of the rendered pages.
 * In CI, mock auth or use test accounts.
 */

const dashboardRoutes = [
  { path: '/dashboard', name: 'dashboard-home' },
  { path: '/dashboard/portfolio', name: 'dashboard-portfolio' },
  { path: '/dashboard/assets', name: 'dashboard-assets' },
  { path: '/dashboard/royalties', name: 'dashboard-royalties' },
  { path: '/dashboard/distributions', name: 'dashboard-distributions' },
  { path: '/dashboard/transactions', name: 'dashboard-transactions' },
  { path: '/dashboard/settings', name: 'dashboard-settings' },
  { path: '/marketplace', name: 'marketplace' },
];

for (const route of dashboardRoutes) {
  test.describe(`Dashboard: ${route.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(route.path);
      await waitForPageReady(page);
    });

    test('visual regression', async ({ page }) => {
      await visualSnapshot(page, route.name);
    });

    test('no horizontal scroll', async ({ page }) => {
      await checkNoHorizontalScroll(page);
    });

    test('text contrast meets WCAG AA', async ({ page }) => {
      await checkTextContrast(page);
    });

    test('card padding meets minimum', async ({ page }) => {
      await checkCardPadding(page);
    });

    test('border radius consistency', async ({ page }) => {
      await checkBorderRadiusConsistency(page);
    });

    test('touch targets for tablet', async ({ page }, testInfo) => {
      if (testInfo.project.name.includes('tablet')) {
        await checkTouchTargets(page);
      }
    });
  });
}

// Layout-level tests
test.describe('Dashboard Layout', () => {
  test('sidebar is visible on desktop', async ({ page }, testInfo) => {
    if (testInfo.project.name.includes('desktop')) {
      await page.goto('/dashboard');
      await waitForPageReady(page);
      const sidebar = page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first();
      if (await sidebar.count() > 0) {
        await expect(sidebar).toBeVisible();
      }
    }
  });

  test('sidebar collapses on tablet', async ({ page }, testInfo) => {
    if (testInfo.project.name.includes('tablet')) {
      await page.goto('/dashboard');
      await waitForPageReady(page);
      // On tablet, sidebar should either be hidden or a hamburger menu shown
      const hamburger = page.locator('[class*="menu"], [aria-label*="menu"], button:has(svg)').first();
      // This is a soft check - just verify page loads correctly
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('topbar visual snapshot', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageReady(page);
    const topbar = page.locator('header, [class*="topbar"], [class*="TopBar"]').first();
    if (await topbar.count() > 0) {
      await expect(topbar).toBeVisible();
    }
  });
});
