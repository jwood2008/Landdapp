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
 * Admin pages require admin-role authentication.
 * These tests verify visual quality of the rendered pages.
 */

const adminRoutes = [
  { path: '/admin', name: 'admin-home' },
  { path: '/admin/assets/new', name: 'admin-create-asset' },
  { path: '/admin/distributions', name: 'admin-distributions' },
  { path: '/admin/distributions/new', name: 'admin-create-distribution' },
  { path: '/admin/issue-tokens', name: 'admin-issue-tokens' },
  { path: '/admin/investors', name: 'admin-investors' },
  { path: '/admin/permissions', name: 'admin-permissions' },
  { path: '/admin/marketplace', name: 'admin-marketplace' },
  { path: '/admin/platform-settings', name: 'admin-platform-settings' },
  { path: '/admin/oracle', name: 'admin-oracle' },
];

for (const route of adminRoutes) {
  test.describe(`Admin: ${route.name}`, () => {
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

// Admin-specific visual tests
test.describe('Admin Forms', () => {
  test('create asset form has proper field spacing', async ({ page }) => {
    await page.goto('/admin/assets/new');
    await waitForPageReady(page);

    const formFields = page.locator('input, select, textarea');
    const count = await formFields.count();

    if (count >= 2) {
      // Check spacing between consecutive form fields
      for (let i = 0; i < Math.min(count - 1, 5); i++) {
        const box1 = await formFields.nth(i).boundingBox();
        const box2 = await formFields.nth(i + 1).boundingBox();
        if (box1 && box2) {
          const gap = box2.y - (box1.y + box1.height);
          // Gap should be at least 12px between form fields
          expect(gap).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });

  test('tables are scrollable on tablet', async ({ page }, testInfo) => {
    if (testInfo.project.name.includes('tablet')) {
      await page.goto('/admin');
      await waitForPageReady(page);
      await checkNoHorizontalScroll(page);
    }
  });
});
