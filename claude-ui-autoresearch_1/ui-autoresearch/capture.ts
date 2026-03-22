/**
 * UI Auto-Research: Playwright Screenshot Harness
 *
 * Location: ~/.claude/ui-autoresearch/capture.ts
 * Runs from any project (uses project's Playwright installation).
 *
 * Usage:
 *   npx tsx ~/.claude/ui-autoresearch/capture.ts \
 *     --url http://localhost:3000/path \
 *     --component "ComponentName" \
 *     --output-dir .ui-autoresearch/captures/ComponentName
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ───────────────────────────────────────────────

interface CaptureConfig {
  url: string;
  component: string;
  selector?: string;
  iteration: number;
  viewports: Viewport[];
  colorSchemes: ('light' | 'dark')[];
  waitForSelector?: string;
  waitMs?: number;
  outputDir: string;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: 'mobile',  width: 375,  height: 812  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900  },
];

const DEFAULT_COLOR_SCHEMES: ('light' | 'dark')[] = ['dark', 'light'];

// ─── CLI Argument Parsing ────────────────────────────────────────

function parseArgs(): CaptureConfig {
  const args = process.argv.slice(2);
  const config: Partial<CaptureConfig> = {
    viewports: DEFAULT_VIEWPORTS,
    colorSchemes: DEFAULT_COLOR_SCHEMES,
    iteration: 0,
    waitMs: 1000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':        config.url = args[++i]; break;
      case '--component':  config.component = args[++i]; break;
      case '--selector':   config.selector = args[++i]; break;
      case '--iteration':  config.iteration = parseInt(args[++i], 10); break;
      case '--wait-for':   config.waitForSelector = args[++i]; break;
      case '--wait-ms':    config.waitMs = parseInt(args[++i], 10); break;
      case '--dark-only':  config.colorSchemes = ['dark']; break;
      case '--light-only': config.colorSchemes = ['light']; break;
      case '--desktop-only': config.viewports = [DEFAULT_VIEWPORTS[2]]; break;
      case '--mobile-only':  config.viewports = [DEFAULT_VIEWPORTS[0]]; break;
      case '--output-dir': config.outputDir = args[++i]; break;
    }
  }

  if (!config.url || !config.component) {
    console.error('Usage: npx tsx capture.ts --url <url> --component <name> [options]');
    console.error('  --selector <css>     Target element (default: full page)');
    console.error('  --iteration <n>      Iteration number (default: 0)');
    console.error('  --wait-for <css>     Wait for selector before capture');
    console.error('  --wait-ms <ms>       Wait after load (default: 1000)');
    console.error('  --dark-only          Only capture dark mode');
    console.error('  --desktop-only       Only capture desktop viewport');
    console.error('  --output-dir <path>  Output directory for captures');
    process.exit(1);
  }

  config.outputDir = config.outputDir ||
    path.join('.ui-autoresearch', 'captures', config.component);

  return config as CaptureConfig;
}

// ─── Screenshot Capture ──────────────────────────────────────────

async function captureScreenshots(config: CaptureConfig): Promise<string[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const screenshots: string[] = [];

  const iterDir = path.join(config.outputDir, `iteration-${config.iteration}`);
  fs.mkdirSync(iterDir, { recursive: true });

  try {
    for (const scheme of config.colorSchemes) {
      for (const viewport of config.viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 2,
        });

        const page: Page = await context.newPage();

        await page.goto(config.url, { waitUntil: 'networkidle' });

        if (config.waitForSelector) {
          await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
        }

        if (config.waitMs) {
          await page.waitForTimeout(config.waitMs);
        }

        const filename = `${scheme}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
        const filepath = path.join(iterDir, filename);

        if (config.selector) {
          const element = await page.$(config.selector);
          if (element) {
            await element.screenshot({ path: filepath });
          } else {
            console.warn(`  ⚠ Selector "${config.selector}" not found, capturing full page`);
            await page.screenshot({ path: filepath, fullPage: true });
          }
        } else {
          await page.screenshot({ path: filepath, fullPage: true });
        }

        screenshots.push(filepath);
        console.log(`  ✓ Captured: ${filename}`);

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const metadata = {
    component: config.component,
    iteration: config.iteration,
    url: config.url,
    selector: config.selector || 'full-page',
    timestamp: new Date().toISOString(),
    screenshots: screenshots.map(s => path.basename(s)),
    viewports: config.viewports,
    colorSchemes: config.colorSchemes,
  };

  fs.writeFileSync(
    path.join(iterDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  return screenshots;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs();

  console.log(`\n📸 UI Auto-Research: Capturing "${config.component}"`);
  console.log(`   URL: ${config.url}`);
  console.log(`   Iteration: ${config.iteration}`);
  console.log(`   Viewports: ${config.viewports.map(v => v.name).join(', ')}`);
  console.log(`   Schemes: ${config.colorSchemes.join(', ')}`);
  console.log(`   Output: ${config.outputDir}\n`);

  const screenshots = await captureScreenshots(config);

  console.log(`\n✅ Captured ${screenshots.length} screenshots`);
  console.log(`   Output: ${config.outputDir}/iteration-${config.iteration}/\n`);
}

main().catch(console.error);
