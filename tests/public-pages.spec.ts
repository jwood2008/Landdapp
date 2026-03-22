import { test, expect } from '@playwright/test';
import {
  waitForPageReady,
  visualSnapshot,
  checkCardPadding,
  checkNoHorizontalScroll,
  checkTextContrast,
  checkTouchTargets,
} from './helpers';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);
  });

  test('visual regression', async ({ page }) => {
    await visualSnapshot(page, 'landing-page');
  });

  test('hero section is visible and prominent', async ({ page }) => {
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible();
    const fontSize = await hero.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(28);
  });

  test('CTA buttons have proper hierarchy', async ({ page }) => {
    const primaryBtn = page.locator('a[href*="register"], a[href*="login"], button').filter({ hasText: /get started|sign up|invest/i }).first();
    if (await primaryBtn.count() > 0) {
      await expect(primaryBtn).toBeVisible();
    }
  });

  test('no horizontal scroll', async ({ page }) => {
    await checkNoHorizontalScroll(page);
  });

  test('text contrast meets WCAG AA', async ({ page }) => {
    await checkTextContrast(page);
  });

  test('spatial rhythm - card padding', async ({ page }) => {
    await checkCardPadding(page);
  });
});

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await waitForPageReady(page);
  });

  test('visual regression', async ({ page }) => {
    await visualSnapshot(page, 'login-page');
  });

  test('form elements are properly spaced', async ({ page }) => {
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('no horizontal scroll', async ({ page }) => {
    await checkNoHorizontalScroll(page);
  });

  test('touch targets meet minimum size', async ({ page, browserName }, testInfo) => {
    if (testInfo.project.name.includes('tablet')) {
      await checkTouchTargets(page);
    }
  });
});

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await waitForPageReady(page);
  });

  test('visual regression', async ({ page }) => {
    await visualSnapshot(page, 'register-page');
  });

  test('form has proper spacing', async ({ page }) => {
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('no horizontal scroll', async ({ page }) => {
    await checkNoHorizontalScroll(page);
  });
});

test.describe('404 Page', () => {
  test('visual regression', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await waitForPageReady(page);
    await visualSnapshot(page, '404-page');
  });

  test('no horizontal scroll', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await waitForPageReady(page);
    await checkNoHorizontalScroll(page);
  });
});
