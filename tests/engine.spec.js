// tests/engine.spec.js
//
// End-to-end tests for the Abbot geotech report engine, driven against a
// real headless browser. This file is never referenced by index.html or
// sw.js, so it is never downloaded by anyone using the live app — it only
// runs when you explicitly invoke the Playwright test runner (see README).
//
// Run with:
//   cd tests && npm install && npx playwright install chromium && npm test
//
const { test, expect } = require('@playwright/test');

async function gotoTab(page, label) {
  await page.click(`#tabrail button:text-is("${label}")`);
}

async function newReport(page, type) {
  await page.goto('/index.html');
  await page.click(`button[data-newtype="${type}"]`);
  await page.waitForSelector('#view-editor:not([hidden])');
}

async function fillCommon(page) {
  await gotoTab(page, 'Setup');
  await page.fill('#f_jobNo', 'AD-TEST-001');
  await page.fill('#f_author', 'Ryan Chalmers');
  await page.fill('#f_reviewer', 'Test Reviewer');

  await gotoTab(page, 'Client & site ID');
  await page.fill('#f_client', 'Test Client');
  await page.fill('#f_street', '1 Test St');
  await page.fill('#f_suburb', 'Testville');
  await page.fill('#f_postcode', '2323');
  await page.fill('#f_lotDp', 'Lot 1 DP 123456');
  await page.fill('#f_projectDesc', 'New single-storey dwelling');

  await gotoTab(page, 'Site description');
  await page.fill('#f_slopeDeg', '2');
  await page.fill('#f_geologyUnit', 'Mulbring Siltstone');
}

async function readinessGapLabels(page) {
  await gotoTab(page, 'Review & issue');
  return page.$$eval('#reviewgaps ul li', els => els.map(e => e.textContent.trim()));
}

async function previewHtml(page) {
  await gotoTab(page, 'Review & issue');
  await page.click('#nextbtn'); // "Preview report →" on the last tab
  await page.waitForSelector('#view-preview:not([hidden])');
  return page.$eval('#rpt', el => el.innerHTML);
}

test.describe('Desktop Assessment — no footing advice, no over-claimed standards', () => {
  test('Foundations fieldset is hidden and not required', async ({ page }) => {
    await newReport(page, 'desktop');
    await fillCommon(page);

    await gotoTab(page, 'Recommendations');
    await expect(page.locator('fieldset:has(legend:text-is("Foundations"))')).toHaveCount(0);
    await expect(
      page.locator('fieldset:has(legend:text-is("Geotechnical recommendations")) p.hint')
    ).toContainText('desk-study');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const gaps = await readinessGapLabels(page);
    expect(gaps.some(g => g.includes('Footing recommendation'))).toBe(false);
  });

  test('report body and references cite only what was actually done', async ({ page }) => {
    await newReport(page, 'desktop');
    await fillCommon(page);
    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await previewHtml(page);

    expect(html).toContain('AS 1726'); // desk study is in scope even for a desktop assessment
    expect(html).not.toContain('AS 2870');
    expect(html).not.toContain('AS 4055');
    expect(html).not.toContain('AS 3798');
    expect(html).not.toContain('BTF-18');
    expect(html).not.toContain('GeoGuide');
    expect(html).not.toContain('Suitable footing systems');
    expect(html).not.toContain('Founding requirements');
  });
});

test.describe('Site Classification + Wind — Foundations present, groundwater depth, Class label', () => {
  test('borehole fields, hints, placeholders and report output', async ({ page }) => {
    await newReport(page, 'classification');
    await fillCommon(page);

    await gotoTab(page, 'Fieldwork');
    await page.fill('#f_fieldDate', '2026-08-01');
    await page.click('#addbh');
    await page.selectOption('select[data-bh="0"][data-f="method"]', 'Push tube (rig)');
    await page.fill('input[data-bh="0"][data-f="depth"]', '1.5');
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'E — encountered');
    await page.fill('input[data-bh="0"][data-f="waterDepth"]', '2.4');
    await page.click('[data-addlayer="0"]');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="from"]', '0');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="to"]', '1.5');
    await page.fill('input[data-bh="0"][data-layer="0"][data-f="uscs"]', 'CI');
    await page.fill(
      'input[data-bh="0"][data-layer="0"][data-f="desc"]',
      'Sandy CLAY, red-brown, moist, stiff; residual'
    );

    await expect(page.locator('label:text-is("Class")')).toHaveCount(1);
    await expect(page.locator('label:text-is("USCS")')).toHaveCount(0);
    await expect(
      page.locator('fieldset:has(legend:text-is("Boreholes / test pits")) p.hint')
    ).toContainText('AS 1726 layer order');

    await gotoTab(page, 'Classification');
    await page.selectOption('#f_siteClass', 'M');
    await page.fill('#f_classJust', 'Test classification basis.');
    await gotoTab(page, 'Wind');
    await page.selectOption('#f_windClass', 'N2');

    await gotoTab(page, 'Recommendations');
    await expect(page.locator('fieldset:has(legend:text-is("Foundations"))')).toHaveCount(1);
    await page.fill('#f_founding', 'Test founding advice.');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await previewHtml(page);

    expect(html).toContain('AS 1726');
    expect(html).toContain('AS 2870');
    expect(html).toContain('AS 4055');
    expect(html).not.toContain('AS 3798'); // no Fills recommendation given
    expect(html).toContain('BTF-18'); // non-desktop
    expect(html).not.toContain('GeoGuide'); // no hazards commentary
    expect(html).toContain('E — encountered @ 2.4 m');
    expect(html).toContain('>Class<');
    expect(html).not.toContain('>USCS<');
  });
});

test.describe('Comprehensive with Fills recommendation + hazards commentary', () => {
  test('AS 3798 / GeoGuide LR8 / AGS 2007 appear only when actually relevant', async ({ page }) => {
    await newReport(page, 'comprehensive');
    await fillCommon(page);

    await gotoTab(page, 'Fieldwork');
    await page.fill('#f_fieldDate', '2026-08-01');
    await page.click('#addbh');
    await page.selectOption('select[data-bh="0"][data-f="method"]', 'Push tube (rig)');
    await page.fill('input[data-bh="0"][data-f="depth"]', '3');
    await page.selectOption('select[data-bh="0"][data-f="water"]', 'NE — not encountered');

    await gotoTab(page, 'Classification');
    await page.selectOption('#f_siteClass', 'H1');
    await page.fill('#f_classJust', 'Test classification basis.');
    await gotoTab(page, 'Wind');
    await page.selectOption('#f_windClass', 'N3');

    await gotoTab(page, 'Recommendations');
    await page.fill('#f_founding', 'Test founding advice.');
    await page.click('#addrec');
    await page.selectOption('select[data-rec="0"][data-f="area"]', 'Fills');
    await page.fill('textarea[data-rec="0"][data-f="desc"]', 'Fill to be placed in accordance with AS 3798.');
    await page.fill('#f_hazards', 'Sloping site — landslide risk considered low but noted.');

    await gotoTab(page, 'Review & issue');
    await page.fill('#f_limitations', 'Test limitations statement.');
    const html = await previewHtml(page);

    expect(html).toContain('AS 3798');
    expect(html).toContain('GeoGuide');
    expect(html).toContain('Landslide Risk Management');
    expect(html).toContain('hillside sites');
  });
});

test.describe('Backward compatibility', () => {
  test('old report saved before waterDepth existed imports and renders cleanly', async ({ page }) => {
    await page.goto('/index.html');
    const oldReport = await page.evaluate(() => {
      const now = new Date();
      return {
        id: 'ROLDTEST', type: 'classification', created: now.toISOString(), updated: now.toISOString(),
        issued: null, status: 'draft', submitted: null,
        d: {
          jobNo: 'OLD-001', revision: '1', dateIssued: now.toISOString().slice(0, 10),
          author: 'A', authorQual: '', authorReg: '', reviewer: 'R', reviewerQual: '', reviewerReg: '',
          client: 'Old Client', careOf: '', clientPhone: '', clientEmail: '',
          projectDesc: 'Old project', street: '1 Old St', suburb: 'Oldtown', state: 'NSW', postcode: '2000',
          lotDp: 'Lot 1 DP 1', council: '', drawingsBy: '', drawingNos: '', drawingsDate: '',
          access: '', existing: '', vegetation: '', slopeDeg: '3', aspect: '', drainage: '',
          geologyMap: '', geologyUnit: 'Old geology', history: '', neighbours: '',
          fieldDate: '2020-01-01', operator: '', weather: '', equipment: '', groundwater: 'Not encountered',
          labName: '', labDate: '', siteClass: 'M', classJust: 'Old basis', bearing: '', ys: '',
          windRegion: 'A', terrain: '', topo: '', shielding: '', windClass: 'N2', windNote: false,
          footings: [], founding: 'Old founding advice', excavation: '', retaining: '', fills: '',
          drainageRec: '', hazards: '', extraRecs: '',
          holds: [], limitations: 'Old limitations', authorSig: '', reviewerSig: '',
          incLegend: true, incClassDefs: true, incGeneral: true, appGeneral: 'General notes',
          distribution: '', dist: [], recRows: [], awaitingResults: false,
        },
        boreholes: [{ method: 'Hand auger', depth: '1.2', water: 'E — encountered',
          layers: [{ from: '0', to: '1.2', uscs: 'CL', desc: 'CLAY, brown' }] }], // no waterDepth key
        dcps: [], samples: [], photos: [], plans: [], attachments: [], siteFigure: null, siteFigureCap: '',
        source: null,
      };
    });
    await page.evaluate((rep) => {
      const blob = new Blob([JSON.stringify(rep)], { type: 'application/json' });
      const file = new File([blob], 'old-report.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.getElementById('importfile').files = dt.files;
      document.getElementById('importfile').dispatchEvent(new Event('change', { bubbles: true }));
    }, oldReport);
    await page.waitForTimeout(300);
    await page.click('button[data-open]');
    await page.waitForSelector('#view-editor:not([hidden])');

    await gotoTab(page, 'Fieldwork');
    await expect(page.locator('input[data-bh="0"][data-f="waterDepth"]')).toHaveValue('');

    const html = await previewHtml(page);
    expect(html).toContain('E — encountered');
    expect(html).not.toContain('E — encountered @');
  });
});

test.describe('Regression sanity', () => {
  test('add/remove borehole and layer without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await newReport(page, 'comprehensive');
    await gotoTab(page, 'Fieldwork');
    await page.click('#addbh');
    await page.click('[data-addlayer="0"]');
    await page.click('[data-dellayer="0:0"]');
    await page.click('[data-delbh="0"]');

    expect(errors).toEqual([]);
  });
});
