import { expect, test } from './fixtures';

test.describe('Google Chat (Web)', () => {
  test('Tab expands keyword into chat text and removes keyword', async ({ chatCompose }) => {
    await chatCompose.setTemplates([
      {
        keyword: ';chatping',
        text: 'お疲れ様です。確認をお願いします。',
      },
    ]);

    await chatCompose.expand(';chatping');

    await expect(chatCompose.editor).toContainText('お疲れ様です。確認をお願いします。');
    await expect(chatCompose.editor).not.toContainText(';chatping');
  });

  test('Variable expansion replaces date in Google Chat', async ({ chatCompose }) => {
    await chatCompose.setTemplates([
      {
        keyword: ';chatdate',
        text: '本日の連絡: {{date}}',
      },
    ]);

    await chatCompose.expand(';chatdate');

    const year = new Date().getFullYear().toString();
    await expect(chatCompose.editor).toContainText(`本日の連絡: ${year}`);
    await expect(chatCompose.editor).not.toContainText('{{date}}');
    await expect(chatCompose.editor).not.toContainText(';chatdate');
  });

  test('Rich HTML template is inserted into Chat editor', async ({ chatCompose }) => {
    await chatCompose.setTemplates([
      {
        keyword: ';chatrich',
        text: '重要連絡: 確認必須',
        html: '<p><strong>重要連絡</strong>: <em>確認必須</em></p>',
      },
    ]);

    await chatCompose.expand(';chatrich');

    await expect(chatCompose.editor).toContainText('重要連絡');
    await expect(chatCompose.editor).toContainText('確認必須');
    await expect(chatCompose.editor).not.toContainText(';chatrich');
  });

  test('Non-matching keyword does not expand on Tab in Google Chat', async ({ chatCompose }) => {
    await chatCompose.setTemplates([
      {
        keyword: ';validchat',
        text: '有効な展開',
      },
    ]);

    await chatCompose.expand(';nomatch');

    await expect(chatCompose.editor).toContainText(';nomatch');
    await expect(chatCompose.editor).not.toContainText('有効な展開');
  });
});
