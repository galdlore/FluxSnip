import { expect, test } from './fixtures';

test('expanding a template with aiPrompt opens Gemini prompt box and populates prompt without leaking to body', async ({
  compose,
}) => {
  const hasGemini = await compose.hasGemini();
  test.skip(!hasGemini, 'This Google account does not have Gemini (Help me write) enabled. Sign in with an eligible account via "npm run e2e:login".');

  const PROMPT_TEXT = 'Please proofread and make tone polite';
  const BODY_TEXT = 'FluxSnip E2E draft body';

  await compose.setTemplates([
    {
      keyword: ';e2eai',
      text: BODY_TEXT,
      aiPrompt: PROMPT_TEXT,
    },
  ]);

  await compose.expand(';e2eai');

  // Verify body contains template text and does NOT contain the AI prompt
  await expect(compose.body).toContainText(BODY_TEXT);
  await expect(compose.body).not.toContainText(PROMPT_TEXT);

  // Verify Gemini prompt box is opened and populated
  await expect(compose.aiPromptBox).toBeVisible({ timeout: 15_000 });
  await expect(compose.aiPromptBox).toContainText(PROMPT_TEXT);
});

test('expanding a template with aiPrompt when formatting toolbar is open dismisses formatting toolbar and opens Gemini prompt box', async ({
  compose,
}) => {
  const hasGemini = await compose.hasGemini();
  test.skip(!hasGemini, 'This Google account does not have Gemini (Help me write) enabled. Sign in with an eligible account via "npm run e2e:login".');

  const PROMPT_TEXT = 'Shorten this email concisely';
  const BODY_TEXT = 'Long email draft text that needs shortening';

  // Ensure formatting options toolbar is open before expanding
  const fontRow = compose.dialog.locator('[command="+fontName"]').first();
  const formatToggle = compose.dialog.locator('div.J-Z-I.J-Z-I-KO, [command="format"]').first();
  if (!(await fontRow.isVisible().catch(() => false))) {
    if (await formatToggle.isVisible().catch(() => false)) {
      await formatToggle.click();
      await fontRow.waitFor({ timeout: 3000 });
    }
  }

  await compose.setTemplates([
    {
      keyword: ';e2eaifmt',
      text: BODY_TEXT,
      aiPrompt: PROMPT_TEXT,
    },
  ]);

  await compose.expand(';e2eaifmt');

  // Verify body content
  await expect(compose.body).toContainText(BODY_TEXT);
  await expect(compose.body).not.toContainText(PROMPT_TEXT);

  // Verify Gemini prompt box opened and populated successfully
  await expect(compose.aiPromptBox).toBeVisible({ timeout: 15_000 });
  await expect(compose.aiPromptBox).toContainText(PROMPT_TEXT);
});

test('expanding a template with aiPrompt when Gemini prompt box is already open keeps Gemini box open and populates prompt', async ({
  compose,
}) => {
  const hasGemini = await compose.hasGemini();
  test.skip(!hasGemini, 'This Google account does not have Gemini (Help me write) enabled. Sign in with an eligible account via "npm run e2e:login".');

  const PROMPT_TEXT = 'Elaborate on next action items clearly';
  const BODY_TEXT = 'Initial body text for already open Gemini test';

  // 1. Open Gemini prompt box first
  if (!(await compose.aiPromptBox.isVisible().catch(() => false))) {
    await compose.aiHelpBtn.click();
    await expect(compose.aiPromptBox).toBeVisible({ timeout: 10_000 });
  }

  // 2. Register template
  await compose.setTemplates([
    {
      keyword: ';e2eaiopen',
      text: BODY_TEXT,
      aiPrompt: PROMPT_TEXT,
    },
  ]);

  // 3. Focus back to compose body and expand template
  await compose.expand(';e2eaiopen');

  // Verify body contains template text and does NOT contain the AI prompt
  await expect(compose.body).toContainText(BODY_TEXT);
  await expect(compose.body).not.toContainText(PROMPT_TEXT);

  // Verify Gemini prompt box is STILL open (not toggled closed) and contains the prompt
  await expect(compose.aiPromptBox).toBeVisible({ timeout: 15_000 });
  await expect(compose.aiPromptBox).toContainText(PROMPT_TEXT);
});

