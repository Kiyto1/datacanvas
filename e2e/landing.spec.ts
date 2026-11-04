import { expect, test, type Page } from '@playwright/test';

const progressOf = async (page: Page) => Number(await page.getByTestId('story-stage').getAttribute('data-progress'));

test.describe('story (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('does not pin the page, and plays itself to the dashboard when it comes into view', async ({ page }) => {
    await page.goto('/');
    // Not a tall pinned scroll container: the section is only as tall as its content.
    const height = await page.evaluate(() => document.querySelector<HTMLElement>('[data-testid=story]')!.offsetHeight);
    expect(height).toBeLessThan(1400);
    await page.getByTestId('story-stage').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('story-chapter-3')).toHaveAttribute('aria-current', 'step', { timeout: 15000 });
    // Numbers come from the real engine: 12 records, 28,100 total, 10 spellings merged into 5 cities.
    await expect(page.getByTestId('story-kpi')).toHaveText(['12', '28,100', '5']);
  });

  test('chapters are clickable and take over from the autoplay', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('story-stage').scrollIntoViewIfNeeded();
    await page.getByTestId('story-chapter-1').click();
    await expect(page.getByTestId('story-chapter-1')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('story-note')).toContainText('اقتراح'); // the suggestion the engine produced
    await page.waitForTimeout(3500);
    await expect(page.getByTestId('story-chapter-1')).toHaveAttribute('aria-current', 'step'); // stays where the visitor put it
    await page.getByTestId('story-chapter-3').click();
    await expect.poll(() => progressOf(page), { timeout: 5000 }).toBeGreaterThan(0.9);
  });
});

test('the live preview responds to clicks and the merge switch', async ({ page }) => {
  await page.goto('/');
  await page.locator('#live').scrollIntoViewIfNeeded();
  const demo = page.getByTestId('live-demo');
  await expect(demo).toBeVisible({ timeout: 15000 });
  await expect(demo.locator('canvas').first()).toBeVisible();

  await expect(page.getByTestId('live-merge-status')).toContainText('لم يُوحَّد');
  await page.getByTestId('live-merge').click();
  await expect(page.getByTestId('live-merge-status')).toContainText('تم توحيد');

  await demo.locator('[data-testid^="table-toggle-bar:"]').first().click();
  await demo.locator('[data-testid^="filter-bar:"]').nth(1).click();
  await expect(demo.locator('[data-testid^="kpi-share-"]').first()).toContainText('من إجمالي');
  await expect(page.getByTestId('live-filters')).toContainText(':');
  await page.getByTestId('live-clear').click();
  await expect(demo.locator('[data-testid^="kpi-share-"]').first()).toHaveText('');
});

test('the privacy panel lists what the page really loaded and finds nothing external', async ({ page }) => {
  await page.goto('/');
  await page.locator('#privacy').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('proof-external')).toHaveText('0');
  await expect.poll(async () => Number(await page.getByTestId('proof-total').innerText())).toBeGreaterThan(3);
});

test('the closing call to action uploads a file', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByTestId('cta-file-input').setInputFiles({
    name: 'sales.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('المدينة,المبيعات\nالرياض,"5,000"\nجدة,"3,500"\n', 'utf8'),
  });
  await expect(page.getByTestId('dashboard')).toBeVisible();
});

test('the closing "sample data" button opens the workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cta-demo').click();
  await expect(page.getByTestId('dashboard')).toBeVisible();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('has no sideways scroll and the story becomes a tappable stepper', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('story').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await expect(page.getByTestId('story-stage')).toBeVisible();
    await page.getByTestId('story-chapter-3').click();
    await expect(page.getByTestId('story-chapter-3')).toHaveAttribute('aria-current', 'step');
    await expect.poll(() => progressOf(page), { timeout: 5000 }).toBeGreaterThan(0.9);
    await page.getByTestId('story-chapter-0').click();
    await expect(page.getByTestId('story-chapter-0')).toHaveAttribute('aria-current', 'step');
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('shows everything without scroll animation: no pinned story, no hidden reveals', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('story-stage').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('story-chapter-3')).toHaveAttribute('aria-current', 'step'); // no animation: it shows the finished state
    await page.locator('#how').scrollIntoViewIfNeeded();
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.reveal')].filter((el) => getComputedStyle(el).opacity !== '1').length);
    expect(hidden).toBe(0);
  });
});

test('there is no horizontal overflow at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
