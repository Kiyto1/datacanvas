import { expect, test, type Page } from '@playwright/test';

async function scrollStoryTo(page: Page, progress: number) {
  await page.evaluate((p) => {
    const outer = document.querySelector('[data-testid=story]')!.children[1] as HTMLElement;
    const top = outer.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (outer.offsetHeight - window.innerHeight) * p);
  }, progress);
}

const progressOf = async (page: Page) => Number(await page.getByTestId('story-stage').getAttribute('data-progress'));

test.describe('scroll story (desktop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is scrubbed by scroll: chapters advance and the sheet becomes the dashboard', async ({ page }) => {
    await page.goto('/');
    await scrollStoryTo(page, 0.08);
    await expect(page.getByTestId('story-chapter-0')).toHaveAttribute('aria-current', 'step');

    await scrollStoryTo(page, 0.38);
    await expect(page.getByTestId('story-chapter-1')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByTestId('story-note')).toContainText('اقتراح'); // the suggestion the engine produced

    await scrollStoryTo(page, 0.62);
    await expect(page.getByTestId('story-chapter-2')).toHaveAttribute('aria-current', 'step');

    await scrollStoryTo(page, 0.97);
    await expect(page.getByTestId('story-chapter-3')).toHaveAttribute('aria-current', 'step');
    // Numbers come from the real engine: 12 records, 28,100 total, 10 spellings merged into 5 cities.
    await expect(page.getByTestId('story-kpi')).toHaveText(['12', '28,100', '5']);
  });

  test('clicking a chapter jumps the scroll to it', async ({ page }) => {
    await page.goto('/');
    await scrollStoryTo(page, 0.02);
    const before = await progressOf(page);
    await page.getByTestId('story-chapter-2').click();
    await expect.poll(() => progressOf(page), { timeout: 5000 }).toBeGreaterThan(before + 0.3);
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
    expect(await progressOf(page)).toBeGreaterThan(0.9);
    await page.getByTestId('story-chapter-0').click();
    await expect(page.getByTestId('story-chapter-0')).toHaveAttribute('aria-current', 'step');
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('shows everything without scroll animation: no pinned story, no hidden reveals', async ({ page }) => {
    await page.goto('/');
    const pinned = await page.evaluate(() => (document.querySelector('[data-testid=story]')!.children[1] as HTMLElement).style.height);
    expect(pinned).toBe(''); // not a tall scroll-scrubbed stage
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
