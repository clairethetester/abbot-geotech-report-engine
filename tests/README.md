# Report engine tests

End-to-end tests for `index.html`, driven by a real headless browser
(Playwright). They check the things that are easy to silently break:
report-type gating (e.g. Desktop Assessments shouldn't get footing
advice or cite standards they never applied), the borehole/groundwater
fields, and the generated report HTML — not just that the page loads.

## Does this affect the live app?

No. Nothing in `index.html` or `sw.js` references this folder. A
visitor's browser only downloads files that are linked or fetched from
those two files, so this folder is invisible to page load speed — it's
inert until you deliberately run it from the command line.

## Running the tests

Needs Node.js. First time only:

```
cd tests
npm install
npx playwright install chromium
```

Then, any time:

```
npm test
```

This starts a local static server over the repo root and runs the
suite against it — no manual server setup needed.

## When to run it

Before pushing any change to `index.html` or `sw.js`. It's cheap (well
under a minute) and it's specifically built to catch the class of bug
that's easy to miss by eye: a fix that works for one report type but
leaves a stale assumption in another (this is exactly how the AS
2870/AS 4055 over-citation bug on Desktop Assessments slipped through
originally).

## Extending it

Each `test.describe` block covers one report-type scenario end to end
— fill the form, preview the report, assert on the generated HTML.
Add a new `test()` inside the relevant block, or a new `describe` for
a new scenario. Keep assertions on the rendered `#rpt` HTML (the
actual report output) wherever possible, not just on form state —
that's what catches drift between what the form captures and what the
report actually prints.

## Housekeeping

`node_modules/` and Playwright's `test-results/`/`playwright-report/`
output should not be committed — add them to `.gitignore` if not
already covered.
