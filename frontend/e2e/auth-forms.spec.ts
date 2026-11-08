import { expect, test, type Page } from '@playwright/test';

/**
 * Regression coverage for the credential-in-URL incident.
 *
 * The auth forms are client components. If React never hydrates (blocked dev
 * origin, failed chunk request, cached HTML), `onSubmit` does not exist and the
 * browser performs a native form submission. Any input with a `name` would then
 * be serialised into the URL, which is what leaked emails and passwords.
 */

const CREDENTIAL_FIELDS = ['email', 'username', 'password', 'confirmPassword'];

const FORM_FIELDS: Record<string, string> = {
  email: 'player@example.com',
  username: 'player',
  password: 'ExamplePass1!',
  confirmPassword: 'ExamplePass1!',
};

function expectNoCredentialsInUrl(url: string) {
  const parsed = new URL(url);
  for (const field of CREDENTIAL_FIELDS) {
    expect(parsed.searchParams.has(field), `URL leaked the ${field} field`).toBe(false);
  }
  expect(parsed.search).not.toContain('password');
}

async function fillForm(page: Page, fields: string[]) {
  for (const id of fields) {
    await page.locator(`#${id}`).fill(FORM_FIELDS[id]);
  }
}

/** Remove the hydration guard so the native fallback path can be exercised. */
async function forceNativeSubmit(page: Page) {
  const submit = page.locator('button[type=submit]');
  await submit.evaluate((node) => node.removeAttribute('disabled'));
  await submit.click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('auth forms without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('register form exposes no named credential inputs and a disabled submit', async ({ page }) => {
    await page.goto('/register');

    for (const id of CREDENTIAL_FIELDS) {
      await expect(page.locator(`#${id}`)).not.toHaveAttribute('name', /.+/);
    }
    await expect(page.locator('button[type=submit]')).toBeDisabled();
  });

  test('login form exposes no named credential inputs and a disabled submit', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#email')).not.toHaveAttribute('name', /.+/);
    await expect(page.locator('#password')).not.toHaveAttribute('name', /.+/);
    await expect(page.locator('button[type=submit]')).toBeDisabled();
  });
});

test.describe('auth forms with JavaScript enabled', () => {
  test('register submit becomes enabled after hydration', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('button[type=submit]')).toBeEnabled();
  });

  test('register form cannot leak credentials when the client bundle fails', async ({ page }) => {
    // Simulate the LAN-origin failure: every client chunk is blocked, so React
    // never attaches `onSubmit`.
    await page.route('**/_next/static/**', (route) => route.abort());
    await page.goto('/register');

    await fillForm(page, CREDENTIAL_FIELDS);
    await forceNativeSubmit(page);

    expectNoCredentialsInUrl(page.url());
  });

  test('login form cannot leak credentials when the client bundle fails', async ({ page }) => {
    await page.route('**/_next/static/**', (route) => route.abort());
    await page.goto('/login');

    await fillForm(page, ['email', 'password']);
    await forceNativeSubmit(page);

    expectNoCredentialsInUrl(page.url());
  });
});
