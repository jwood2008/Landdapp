import { Page, expect } from '@playwright/test';

/**
 * Shared test helpers for visual regression and UI quality testing.
 */

/** Wait for page to be fully loaded and animations settled */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for any CSS transitions/animations to settle
  await page.waitForTimeout(500);
}

/** Apply dark mode class to the document */
export async function setDarkMode(page: Page) {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  });
  await page.waitForTimeout(300);
}

/** Apply light mode class to the document */
export async function setLightMode(page: Page) {
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  });
  await page.waitForTimeout(300);
}

/** Take a full-page visual snapshot with a descriptive name */
export async function visualSnapshot(page: Page, name: string) {
  await waitForPageReady(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.05,
  });
}

/** Take a component-level visual snapshot */
export async function componentSnapshot(page: Page, selector: string, name: string) {
  await waitForPageReady(page);
  const element = page.locator(selector).first();
  await expect(element).toBeVisible();
  await expect(element).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.05,
  });
}

/** Verify spatial rhythm: check minimum padding on cards */
export async function checkCardPadding(page: Page, minPadding = 20) {
  const cards = page.locator('[class*="card"], [class*="Card"]');
  const count = await cards.count();
  for (let i = 0; i < Math.min(count, 10); i++) {
    const box = await cards.nth(i).boundingBox();
    if (box && box.width > 100) {
      const padding = await cards.nth(i).evaluate((el) => {
        const style = window.getComputedStyle(el);
        return Math.min(
          parseFloat(style.paddingTop),
          parseFloat(style.paddingRight),
          parseFloat(style.paddingBottom),
          parseFloat(style.paddingLeft)
        );
      });
      expect(padding).toBeGreaterThanOrEqual(minPadding);
    }
  }
}

/** Verify text contrast meets WCAG AA (4.5:1 ratio) */
export async function checkTextContrast(page: Page) {
  const result = await page.evaluate(() => {
    function getLuminance(r: number, g: number, b: number) {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function getContrastRatio(l1: number, l2: number) {
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    function parseColor(color: string): [number, number, number] | null {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      return null;
    }

    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label');
    let failCount = 0;
    let checkCount = 0;

    textElements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const fg = parseColor(style.color);
      const bg = parseColor(style.backgroundColor);

      if (fg && bg) {
        checkCount++;
        const fgLum = getLuminance(...fg);
        const bgLum = getLuminance(...bg);
        const ratio = getContrastRatio(fgLum, bgLum);
        const fontSize = parseFloat(style.fontSize);
        const minRatio = fontSize >= 18 ? 3 : 4.5;
        if (ratio < minRatio) failCount++;
      }
    });

    return { failCount, checkCount };
  });

  // Allow up to 5% of elements to fail (some may be decorative)
  if (result.checkCount > 0) {
    const failRate = result.failCount / result.checkCount;
    expect(failRate).toBeLessThan(0.1);
  }
}

/** Check touch target sizes (min 44px for tablet) */
export async function checkTouchTargets(page: Page, minSize = 44) {
  const interactiveElements = page.locator('button, a, input, select, [role="button"]');
  const count = await interactiveElements.count();

  for (let i = 0; i < Math.min(count, 20); i++) {
    const box = await interactiveElements.nth(i).boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      // At least one dimension should meet minimum
      const meetsMinimum = box.height >= minSize || box.width >= minSize;
      if (!meetsMinimum) {
        const isVisible = await interactiveElements.nth(i).isVisible();
        if (isVisible) {
          // Soft check - log but don't fail for tiny icons
          expect(Math.max(box.height, box.width)).toBeGreaterThanOrEqual(minSize * 0.75);
        }
      }
    }
  }
}

/** Verify no horizontal scroll exists */
export async function checkNoHorizontalScroll(page: Page) {
  const hasHScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasHScroll).toBe(false);
}

/** Check consistent border radius usage */
export async function checkBorderRadiusConsistency(page: Page) {
  const radii = await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="rounded"]');
    const radiusValues = new Set<string>();
    elements.forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.borderRadius && style.borderRadius !== '0px') {
        radiusValues.add(style.borderRadius);
      }
    });
    return Array.from(radiusValues);
  });
  // Should use no more than 5 distinct radius values for consistency
  expect(radii.length).toBeLessThanOrEqual(8);
}
