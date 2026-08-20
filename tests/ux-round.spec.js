// tests/ux-round.spec.js
//
// Regression tests for the final UI/UX round (August 2026). These lock in the
// specific defects that round fixed, so a later edit can't quietly reinstate
// them. Same rules as engine.spec.js: dev-only, never referenced by index.html
// or sw.js, so it is never downloaded by anyone using the live app.
//
// Run with:
//   cd tests && npm install && npx playwright install chromium && npm test
//
const { test, expect } = require('@playwright/test');

async function newReport(page, type) {
  await page.goto('/index.html');
  await page.click(`button[data-newtype="${type}"]`);
  await page.waitForSelector('#view-editor:not([hidden])');
}
async function gotoTab(page, label) {
  await page.click(`#tabrail button:text-is("${label}")`);
}

/* ------------------------------------------------------------------ *
 * B0 — the offline shell actually installs                            *
 * ------------------------------------------------------------------ */
test.describe('B0 — service worker shell', () => {
  test('every file the service worker caches exists', async ({ page, request }) => {
    const sw = await (await request.get('/sw.js')).text();
    const shell = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    expect(shell.length).toBeGreaterThan(3);
    for (const url of shell) {
      const res = await request.get(url.replace(/^\.\//, '/'));
      expect(res.status(), `${url} must not 404 — cache.addAll() rejects the whole install`).toBe(200);
    }
  });

  test('every icon the manifest declares exists', async ({ request }) => {
    const mf = await (await request.get('/manifest.webmanifest')).json();
    for (const icon of mf.icons) {
      const res = await request.get('/' + icon.src.replace(/^\.\//, ''));
      expect(res.status(), `${icon.src} must not 404 or Chrome won't offer install`).toBe(200);
    }
  });

  test('cache version was bumped past v9', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text();
    const v = Number(sw.match(/abbot-engine-v(\d+)/)[1]);
    expect(v).toBeGreaterThan(9);
  });
});

/* ------------------------------------------------------------------ *
 * B1 — screen-reader-only text is actually hidden                     *
 * ------------------------------------------------------------------ */
test.describe('B1 — .sr-only', () => {
  test('sr-only text is present for assistive tech but not visible', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Fieldwork');
    await page.click('#addbh');
    await page.click('[data-addlayer="0"]');

    const srSpan = page.locator('[data-dellayer="0:0"] .sr-only');
    await expect(srSpan).toHaveCount(1);
    const box = await srSpan.boundingBox();
    expect(box.width, 'sr-only text must be clipped, not laid out').toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
    // the button must read as just the glyph at normal size
    const btnBox = await page.locator('[data-dellayer="0:0"]').boundingBox();
    expect(btnBox.width).toBeLessThan(120);
  });

  test('photo caption labels do not render as visible text', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Photos');
    // inject a photo directly — no camera in headless
    await page.evaluate(() => {
      report().photos.push({ caption: '', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
      saveDb(); renderEditor();
    });
    const lbl = page.locator('#photogrid label.sr-only');
    await expect(lbl).toHaveCount(1);
    const box = await lbl.boundingBox();
    expect(box.width, 'the caption label must not be laid out as visible text').toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ *
 * B2 — no autofill on third-party data                                *
 * ------------------------------------------------------------------ */
test.describe('B2 — autocomplete', () => {
  test('client and site fields carry no autocomplete hint', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Client & site ID');
    for (const id of ['f_client', 'f_clientPhone', 'f_clientEmail', 'f_street', 'f_postcode']) {
      await expect(page.locator('#' + id)).not.toHaveAttribute('autocomplete', /.+/);
    }
    await expect(page.locator('#form')).toHaveAttribute('autocomplete', 'off');
  });

  test('the author field — which is about the user — keeps its autocomplete', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await expect(page.locator('#f_author')).toHaveAttribute('autocomplete', 'name');
  });
});

/* ------------------------------------------------------------------ *
 * P4 — the completeness indicator tells the truth                     *
 * ------------------------------------------------------------------ */
test.describe('P4 — completeness', () => {
  test('a brand-new report claims nothing is complete', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#stratalabel')).toHaveText('0 of 10 sections complete');
    await expect(page.locator('#tabrail button.done')).toHaveCount(0);
    await expect(page.locator('#tabrail button.started')).toHaveCount(0);
  });

  test('a started-but-incomplete section is distinguishable from an untouched one', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await page.fill('#f_jobNo', 'AD-TEST-002');
    await page.locator('#f_jobNo').blur();
    await expect(page.locator('#tabrail button:text-is("Setup")')).toHaveClass(/started/);
    await expect(page.locator('#tabrail button:text-is("Setup")')).not.toHaveClass(/done/);
    await expect(page.locator('#stratalabel')).toHaveText('0 of 10 sections complete');

    await page.fill('#f_author', 'Ryan Chalmers');
    await page.fill('#f_reviewer', 'Test Reviewer');
    await page.locator('#f_reviewer').blur();
    await expect(page.locator('#tabrail button:text-is("Setup")')).toHaveClass(/done/);
    await expect(page.locator('#stratalabel')).toHaveText('1 of 10 sections complete');
  });

  test('Photos does not claim completion with no photos', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#tabrail button:text-is("Photos")')).not.toHaveClass(/done/);
    await gotoTab(page, 'Photos');
    await page.evaluate(() => {
      report().photos.push({ caption: '', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
      saveDb(); renderEditor();
    });
    await expect(page.locator('#tabrail button:text-is("Photos")')).toHaveClass(/done/);
  });

  test('the issue gate itself is unchanged — no new hard requirements', async ({ page }) => {
    await newReport(page, 'comprehensive');
    const labels = await page.evaluate(() => requirements(report()).map(g => g.label));
    expect(labels).not.toContain('At least one site photo');
    expect(labels).not.toContain('Laboratory or field test results');
  });
});

/* ------------------------------------------------------------------ *
 * P1/P2/P3 — the progress indicator                                   *
 * ------------------------------------------------------------------ */
test.describe('P2 — progress indicator', () => {
  test('the segmented strata bar is gone', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#strata')).toHaveCount(0);
  });

  test('no element is ever drawn partly filled', async ({ page }) => {
    await newReport(page, 'comprehensive');
    const html = await page.content();
    expect(html).not.toContain('scaleX(');
  });

  test('the orphan blue is gone from the editor chrome', async ({ page, request }) => {
    const src = await (await request.get('/index.html')).text();
    expect(src.toLowerCase()).not.toContain('2f6db5');
  });

  test('the count line is a live region and drops the "Core log:" decoration', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#stratalabel')).toHaveAttribute('role', 'status');
    await expect(page.locator('#stratalabel')).not.toContainText('Core log');
  });
});

/* ------------------------------------------------------------------ *
 * B6 — data binding survives "change"-only edits                      *
 * ------------------------------------------------------------------ */
test.describe('B6 — input and change binding', () => {
  test('a change-only edit (autofill, some selects and date pickers) is persisted', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Client & site ID');
    // Simulate the autofill path: set the value and fire change WITHOUT input.
    await page.evaluate(() => {
      const el = document.getElementById('f_street');
      el.value = '42 Autofilled Rd';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const stored = await page.evaluate(() => report().d.street);
    expect(stored, 'a change-only edit must not be silently dropped').toBe('42 Autofilled Rd');
  });

  test('a select committed via change alone is persisted', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Client & site ID');
    await page.evaluate(() => {
      const el = document.getElementById('f_state');
      el.value = 'QLD';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(await page.evaluate(() => report().d.state)).toBe('QLD');
  });
});

/* ------------------------------------------------------------------ *
 * P5 — the indicator keeps up with typing                             *
 * ------------------------------------------------------------------ */
test.describe('P5 — live progress refresh', () => {
  test('the count line updates without navigating away', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await expect(page.locator('#stratalabel')).toHaveText('0 of 10 sections complete');
    await page.fill('#f_jobNo', 'AD-TEST-003');
    await page.fill('#f_author', 'Ryan Chalmers');
    await page.fill('#f_reviewer', 'Test Reviewer');
    // no tab click, no Next — the rail must catch up on its own
    await expect(page.locator('#stratalabel')).toHaveText('1 of 10 sections complete');
    await expect(page.locator('#tabrail button:text-is("Setup")')).toHaveClass(/done/);
  });

  test('a live refresh does not scroll the rail out from under the user', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Recommendations');
    // let the navigation's own smooth scrollIntoView settle first
    await page.waitForTimeout(700);
    const before = await page.locator('#tabrail').evaluate(el => el.scrollLeft);
    expect(before, 'the rail should have scrolled to show the active tab').toBeGreaterThan(0);
    await page.fill('#f_founding', 'Founding advice typed slowly.');
    await page.waitForTimeout(500);
    const after = await page.locator('#tabrail').evaluate(el => el.scrollLeft);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ *
 * A — copy and hint reduction                                         *
 * ------------------------------------------------------------------ */
test.describe('A — copy', () => {
  const SECTIONS = ['Setup', 'Client & site ID', 'Site description', 'Fieldwork',
                    'Results', 'Classification', 'Wind', 'Recommendations',
                    'Photos', 'Review & issue'];

  test('no hint anywhere still explains why a field exists', async ({ page }) => {
    await newReport(page, 'comprehensive');
    const banned = [
      'Certifiers reject reports',        // rationale
      'A second set of eyes',             // rationale
      'they affect AS 2870 classification',
      'this drives the borehole plan',
      'Scope before you drill',           // positioning copy
      'Used everywhere the visit is referenced',
      'The engineer classifies — the app never does',
      'mandatory for class 2/3/9c work',
      'Who receives this report, in what format, and when',
    ];
    for (const label of SECTIONS) {
      await gotoTab(page, label);
      const text = await page.locator('#form').innerText();
      for (const b of banned) {
        expect(text, `"${b}" should be gone (section: ${label})`).not.toContain(b);
      }
    }
  });

  test('no hint runs longer than one sentence', async ({ page }) => {
    await newReport(page, 'comprehensive');
    for (const label of SECTIONS) {
      await gotoTab(page, label);
      const hints = await page.locator('#form p.hint').allInnerTexts();
      for (const h of hints) {
        const sentences = h.trim().split(/[.!?](\s|$)/).filter(x => x.trim().length > 3);
        expect(sentences.length, `more than one sentence in ${label}: "${h}"`).toBeLessThanOrEqual(1);
        const words = h.trim().split(/\s+/).length;
        expect(words, `hint over the 14-word budget in ${label}: "${h}"`).toBeLessThanOrEqual(14);
      }
    }
  });

  test('format examples are placeholders, not hint lines', async ({ page }) => {
    await newReport(page, 'comprehensive');
    for (const label of SECTIONS) {
      await gotoTab(page, label);
      const text = await page.locator('#form').innerText();
      expect(text, `"e.g." still showing as standing text in ${label}`).not.toContain('e.g.');
    }
    await gotoTab(page, 'Client & site ID');
    await expect(page.locator('#f_lotDp')).toHaveAttribute('placeholder', 'Lot 12 DP 1234567');
  });

  test('only required fields are marked, and "(optional)" is gone everywhere', async ({ page }) => {
    await newReport(page, 'comprehensive');
    for (const label of SECTIONS) {
      await gotoTab(page, label);
      expect(await page.locator('#form').innerText()).not.toContain('(optional)');
    }
    await gotoTab(page, 'Setup');
    const marked = await page.locator('#form .reqmark').count();
    expect(marked).toBe(3); // jobNo, author, reviewer
  });

  test('the required markers match the issue gate exactly', async ({ page }) => {
    await newReport(page, 'comprehensive');
    // every marked field on a section must correspond to a gap when left blank
    await gotoTab(page, 'Setup');
    const markedIds = await page.$$eval('#form .reqmark',
      els => els.map(e => e.closest('div').querySelector('[data-k]').dataset.k));
    const gapSecs = await page.evaluate(() =>
      requirements(report()).filter(g => g.sec === 'setup').length);
    expect(markedIds.sort()).toEqual(['author', 'jobNo', 'reviewer']);
    expect(gapSecs).toBe(3);
  });
});

/* ------------------------------------------------------------------ *
 * F — flow and chrome                                                 *
 * ------------------------------------------------------------------ */
test.describe('F — flow', () => {
  test('F1: the header context is a working back control, not a dead toast', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Client & site ID');
    await page.fill('#f_street', '12 Water St');
    await expect(page.locator('#ctx')).toContainText('← 12 Water St');
    await expect(page.locator('#ctx')).not.toHaveAttribute('aria-live', /.+/);
    await page.click('#ctx');
    await expect(page.locator('#view-home')).toBeVisible();
  });

  test('F2: the footer carries three controls and no duplicate way home', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await expect(page.locator('#homebtn')).toHaveCount(0);
    const visible = await page.locator('#stepnav button:visible').count();
    expect(visible).toBeLessThanOrEqual(3);
  });

  test('F3: the header stays on screen and the tabs sit under it', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 600 });
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Site description');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(150);
    const head = await page.locator('header.app').boundingBox();
    const tabs = await page.locator('nav.tabs').boundingBox();
    expect(head.y, 'header must stay pinned at the top').toBeLessThanOrEqual(1);
    expect(tabs.y, 'tabs must sit below the header, not under it').toBeGreaterThanOrEqual(head.height - 2);
  });

  test('F9: adding a photo does not fling focus back to the top of the form', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Photos');
    await page.evaluate(() => {
      report().photos.push({ caption: '', dataUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' });
      saveDb(); renderEditor({ focus: false });
    });
    const focused = await page.evaluate(() => document.activeElement.id || document.activeElement.tagName);
    expect(focused).not.toBe('takephoto');
  });

  test('F10: the preview toolbar stays reachable on a long report', async ({ page }) => {
    await newReport(page, 'comprehensive');
    // #preview must not be a scroll container, or position:sticky silently dies
    const overflow = await page.evaluate(() => {
      const el = document.getElementById('preview');
      return getComputedStyle(el).overflow;
    });
    expect(overflow).toBe('visible');
    const pos = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.previewbar')).position);
    expect(pos).toBe('sticky');
  });

  test('F11: the save chip has two states, not three', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#savestate')).toHaveText('Autosave on');
  });
});

/* ------------------------------------------------------------------ *
 * F5 — incomplete is amber, never red                                 *
 * ------------------------------------------------------------------ */
test.describe('F5 — required-but-empty state', () => {
  test('a visited, empty, required field goes amber — and only after it is visited', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    // nothing visited yet
    await expect(page.locator('#f_reviewer')).not.toHaveAttribute('data-need', /.*/);
    await page.locator('#f_reviewer').focus();
    await page.locator('#f_reviewer').blur();
    await expect(page.locator('#f_reviewer')).toHaveAttribute('data-need', '');
  });

  test('typing clears the amber state immediately', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await page.locator('#f_jobNo').focus();
    await page.locator('#f_jobNo').blur();
    await expect(page.locator('#f_jobNo')).toHaveAttribute('data-need', '');
    await page.fill('#f_jobNo', 'AD-2026-014');
    await page.locator('#f_jobNo').blur();
    await expect(page.locator('#f_jobNo')).not.toHaveAttribute('data-need', /.*/);
  });

  test('optional fields are never flagged', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await page.locator('#f_authorQual').focus();
    await page.locator('#f_authorQual').blur();
    await expect(page.locator('#f_authorQual')).not.toHaveAttribute('data-need', /.*/);
  });

  test('an incomplete draft field is amber, not red', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Setup');
    await page.locator('#f_reviewer').focus();
    await page.locator('#f_reviewer').blur();
    const border = await page.locator('#f_reviewer').evaluate(el => getComputedStyle(el).borderTopColor);
    expect(border, 'required-but-empty must not read as an error').not.toBe('rgb(204, 34, 34)');
    expect(border).toBe('rgb(201, 162, 39)');
  });
});

/* ------------------------------------------------------------------ *
 * F6 — destructive row actions are recoverable                        *
 * ------------------------------------------------------------------ */
test.describe('F6 — undo', () => {
  test('a deleted borehole comes back at the same index with its layers', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Fieldwork');
    await page.click('#addbh');
    await page.click('#addbh');
    await page.selectOption('select[data-bh="0"][data-f="method"]', 'Hand auger');
    await page.fill('input[data-bh="0"][data-f="depth"]', '1.2');
    await page.click('[data-addlayer="0"]');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="desc"]', 'Sandy CLAY, brown, stiff');
    await page.selectOption('select[data-bh="1"][data-f="method"]', 'Test pit');

    await page.click('[data-delbh="0"]');
    expect(await page.evaluate(() => report().boreholes.length)).toBe(1);

    await page.click('.toast button.undo');
    const bhs = await page.evaluate(() => report().boreholes);
    expect(bhs.length).toBe(2);
    expect(bhs[0].method, 'must be restored at its original index').toBe('Hand auger');
    expect(bhs[0].layers[0].desc).toBe('Sandy CLAY, brown, stiff');
    expect(bhs[1].method).toBe('Test pit');
  });

  test('a deleted soil layer comes back in position', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Fieldwork');
    await page.click('#addbh');
    await page.click('[data-addlayer="0"]');
    await page.click('[data-addlayer="0"]');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="desc"]', 'Layer one');
    await page.fill('input[data-bh="0"][data-layer="1"][data-f="desc"]', 'Layer two');
    await page.click('[data-dellayer="0:0"]');
    await page.click('.toast button.undo');
    const layers = await page.evaluate(() => report().boreholes[0].layers.map(l => l.desc));
    expect(layers).toEqual(['Layer one', 'Layer two']);
  });

  test('the undo offer expires and the delete sticks', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Fieldwork');
    await page.click('#addbh');
    await page.click('[data-delbh="0"]');
    await expect(page.locator('.toast button.undo')).toBeVisible();
    await page.waitForTimeout(7500);
    await expect(page.locator('.toast')).toHaveCount(0);
    expect(await page.evaluate(() => report().boreholes.length)).toBe(0);
  });

  test('deleting a whole report still asks first — that one is worth a hard stop', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await page.click('#ctx');
    await page.click('button[data-del]');
    await expect(page.locator('#dlg')).toBeVisible();
    await page.click('#dlgno');
    await expect(page.locator('ul.reports li')).toHaveCount(1);
  });
});
