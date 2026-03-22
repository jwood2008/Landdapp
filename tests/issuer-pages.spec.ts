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
 * Issuer pages require issuer-role authentication.
 * These tests verify visual quality of the rendered pages.
 */

const issuerRoutes = [
  { path: '/issuer', name: 'issuer-home' },
  { path: '/issuer/portfolio', name: 'issuer-portfolio' },
  { path: '/issuer/updates', name: 'issuer-updates' },
  { path: '/issuer/distributions', name: 'issuer-distributions' },
  { path: '/issuer/investors', name: 'issuer-investors' },
  { path: '/issuer/analytics', name: 'issuer-analytics' },
  { path: '/issuer/marketplace', name: 'issuer-marketplace' },
];

for (const route of issuerRoutes) {
  test.describe(`Issuer: ${route.name}`, () => {
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
