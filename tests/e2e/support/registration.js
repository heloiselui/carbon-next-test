import { expect } from '@playwright/test';

export async function expectRegisteredElements(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const missing = new Set();
          function visit(root) {
            for (const element of root.querySelectorAll('*')) {
              if (
                element.localName.includes('-') &&
                !customElements.get(element.localName)
              ) {
                missing.add(element.localName);
              }
              if (element.shadowRoot) {
                visit(element.shadowRoot);
              }
            }
          }
          visit(document);
          return [...missing].sort();
        }),
      { message: 'Every rendered custom element must be registered' }
    )
    .toEqual([]);
}
