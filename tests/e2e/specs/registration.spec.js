import { expect, test } from '@playwright/test';
import { expectRegisteredElements } from '../support/registration.js';

test('detects an unregistered element inside a shadow root', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'web-components-vite',
    'The shared registration check only needs to be exercised in one project.'
  );
  await page.setContent('<test-parent></test-parent>');
  await page.evaluate(() => {
    customElements.define(
      'test-parent',
      class extends HTMLElement {
        connectedCallback() {
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<test-child>Content</test-child>';
        }
      }
    );
  });

  await expect(expectRegisteredElements(page)).rejects.toThrow('test-child');

  await page.evaluate(() => {
    customElements.define('test-child', class extends HTMLElement {});
  });
  await expectRegisteredElements(page);
});
