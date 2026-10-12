import { expect, test } from './fixtures';

// Addresses on example.com (RFC 2606) can never reach a real mailbox, even if a draft were sent.
const OLD = 'fluxsnip-old@example.com';
const NEW_A = 'fluxsnip-a@example.com';
const NEW_B = 'fluxsnip-b@example.com';
const CC = 'fluxsnip-cc@example.com';

test('Tab expands the keyword into the body and removes the keyword', async ({ compose }) => {
  await compose.setTemplates([{ keyword: ';e2ebody', text: 'FluxSnip E2E body text' }]);

  await compose.expand(';e2ebody');

  await expect(compose.body).toContainText('FluxSnip E2E body text');
  await expect(compose.body).not.toContainText(';e2ebody');
});

test('Ctrl+Z after expansion brings the keyword back', async ({ compose }) => {
  await compose.setTemplates([{ keyword: ';e2eundo', text: 'Undoable expansion' }]);

  await compose.expand(';e2eundo');
  await expect(compose.body).toContainText('Undoable expansion');
  await compose.page.keyboard.press('Control+z');

  await expect(compose.body).not.toContainText('Undoable expansion');
  await expect(compose.body).toContainText(';e2eundo');

  await compose.page.keyboard.press('Control+y');
  await expect(compose.body).toContainText('Undoable expansion');
  await expect(compose.body).not.toContainText(';e2eundo');
});

test('{{cursor}} leaves the caret at the marked position', async ({ compose }) => {
  await compose.setTemplates([{ keyword: ';e2ecur', text: 'Before{{cursor}}After' }]);

  await compose.expand(';e2ecur');
  await expect(compose.body).toContainText('BeforeAfter');
  await compose.page.keyboard.type('X');

  await expect(compose.body).toContainText('BeforeXAfter');
});

test('replace mode swaps existing To recipients for the template ones', async ({ compose }) => {
  await compose.setTemplates([
    { keyword: ';e2eto', text: 'To replaced', to: { mode: 'replace', emails: [NEW_A, NEW_B] } },
  ]);
  await compose.addToRecipient(OLD);

  await compose.expand(';e2eto');

  await expect(compose.body).toContainText('To replaced');
  await expect.poll(() => compose.chipEmails()).toEqual(expect.arrayContaining([NEW_A, NEW_B]));
  expect(await compose.chipEmails()).not.toContain(OLD);

  // Gmail's own recipient state, not just the chips we see: OLD would make this 3
  await expect.poll(() => compose.toSelectedCount()).toBe(2);
});

test('append mode adds Cc without touching To', async ({ compose }) => {
  await compose.setTemplates([
    { keyword: ';e2ecc', text: 'Cc appended', cc: { mode: 'append', emails: [CC] } },
  ]);
  await compose.addToRecipient(OLD);

  await compose.expand(';e2ecc');

  await expect(compose.body).toContainText('Cc appended');
  await expect.poll(() => compose.chipEmails()).toEqual(expect.arrayContaining([OLD, CC]));
});

test('subject is set in replace mode', async ({ compose }) => {
  await compose.setTemplates([
    { keyword: ';e2esub', text: 'Subject set', subject: { mode: 'replace', value: 'FluxSnip E2E subject' } },
  ]);

  await compose.expand(';e2esub');

  await expect(compose.body).toContainText('Subject set');
  await expect(compose.subject).toHaveValue('FluxSnip E2E subject');
});
