import { expect, test as base } from '@playwright/test';
import { expectRegisteredElements } from '../support/registration.js';

const isWebComponents = (projectName) =>
  projectName.startsWith('web-components');

/** Fails the test on uncaught errors, console errors, and failed requests. */
function watchForErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !message.text().startsWith('Failed to load resource')
    ) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    // Font URLs are left unresolved by some bundlers; see the README.
    if (response.status() >= 400 && !/\.woff2?$/.test(url)) {
      errors.push(`${response.status()}: ${url}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (['script', 'stylesheet'].includes(request.resourceType())) {
      errors.push(
        `requestfailed: ${request.url()}: ${request.failure()?.errorText}`
      );
    }
  });
  return errors;
}

const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors = watchForErrors(page);
    await page.goto('/');
    await use(page);
    if (isWebComponents(testInfo.project.name)) {
      await expectRegisteredElements(page);
    }
    expect(errors, 'page reported errors').toEqual([]);
  },
});

test('renders without errors', async ({ page }) => {
  await expect(page.getByTestId('primary-button')).toBeVisible();
  await expect(page.getByTestId('tag')).toBeVisible();
  await expect(page.getByTestId('toggle')).toBeVisible();
});

test('applies v12 tag radius by default', async ({ page }) => {
  const tag = page.getByTestId('tag');
  await expect(tag).toHaveCSS('border-top-left-radius', '4px');
});

test('opens and closes an overlay, returning focus to its trigger', async ({
  page,
}, testInfo) => {
  const trigger = page.getByRole('button', {
    name:
      testInfo.project.name === 'web-components-webpack'
        ? 'Open modal'
        : 'Open side panel',
    exact: true,
  });
  await trigger.click();
  const overlay =
    {
      'web-components-webpack': page.getByRole('dialog', {
        name: 'Modal',
        exact: true,
      }),
      // Slotted text sits under a zero-height host; check the panel itself.
      'web-components-vite': page.locator('cds-side-panel .cds--side-panel'),
    }[testInfo.project.name] ?? page.getByText('Side panel content');
  await expect(overlay).toBeVisible();
  if (isWebComponents(testInfo.project.name)) {
    await expectRegisteredElements(page);
  }
  if (testInfo.project.name === 'web-components-webpack') {
    await expect(
      page
        .locator('cds-modal')
        .getByRole('button', { name: 'Close', exact: true })
    ).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('selects an action from the v12 menu-based overflow menu', async ({
  page,
}, testInfo) => {
  test.skip(
    !['react-vite', 'web-components-vite'].includes(testInfo.project.name)
  );
  const trigger = page.getByRole('button', { name: 'Actions', exact: true });
  await trigger.click();
  const item = page.getByRole('menuitem', { name: 'Delete', exact: true });
  await expect(item).toBeVisible();
  if (isWebComponents(testInfo.project.name)) {
    await expectRegisteredElements(page);
  }
  await item.click();
  await expect(
    page.getByRole('status', { name: 'Last menu action' })
  ).toHaveText('Delete');
  await expect(item).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('submits and resets a Web Component through a native form', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'web-components-vite');
  const form = page.locator('#consumer-form');
  const input = form.getByRole('textbox', { name: 'Name', exact: true });
  const result = page.getByRole('status', { name: 'Submitted form values' });

  await input.fill('Ada');
  await form.getByRole('button', { name: 'Save account' }).click();
  await expect(result).toHaveText(JSON.stringify([['name', 'Ada']]));

  await form.getByRole('button', { name: 'Reset account' }).click();
  await expect(input).toHaveValue('Carbon User');
  await form.getByRole('button', { name: 'Save account' }).click();
  await expect(result).toHaveText(JSON.stringify([['name', 'Carbon User']]));
});

test('excludes a Web Component inside a disabled fieldset from submission', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'web-components-vite');
  const form = page.locator('#consumer-form');
  await form.locator('fieldset').evaluate((fieldset) => {
    fieldset.disabled = true;
  });
  await expect(
    form.getByRole('textbox', { name: 'Name', exact: true })
  ).toBeDisabled();
  await form.getByRole('button', { name: 'Save account' }).click();
  await expect(
    page.getByRole('status', { name: 'Submitted form values' })
  ).toHaveText('[]');
});

test('server-renders with v12 enabled', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'react-nextjs');
  const html = await (await request.get('/')).text();
  expect(html).toContain('rendered-at:<!-- -->server<!-- --> v12:<!-- -->true');
});
