import { expect, test } from './fixtures';

test.describe('Teams (Playground Simulator)', () => {
  test('Tab expands keyword into rich HTML via paste handler', async ({ teamsPlayground }) => {
    const teamsHtml = '<p><strong>【業務進捗報告】</strong></p><ul><li>タスク1: 完了</li><li>タスク2: 進行中</li></ul>';
    await teamsPlayground.setTemplates([
      {
        keyword: ';tmsrep',
        text: '【業務進捗報告】\nタスク1: 完了\nタスク2: 進行中',
        html: teamsHtml,
      },
    ]);

    await teamsPlayground.expand(';tmsrep');

    // Rich elements should be inserted via paste handler
    await expect(teamsPlayground.editor).toContainText('【業務進捗報告】');
    await expect(teamsPlayground.editor).toContainText('タスク1: 完了');
    await expect(teamsPlayground.editor).not.toContainText(';tmsrep');
    await expect(teamsPlayground.editor.locator('strong')).toHaveText('【業務進捗報告】');
    await expect(teamsPlayground.editor.locator('ul li')).toHaveCount(2);
  });

  test('Variable expansion replaces date tokens in Teams template', async ({ teamsPlayground }) => {
    await teamsPlayground.setTemplates([
      {
        keyword: ';tmsdate',
        text: '報告日: {{date}}',
        html: '<p>報告日: {{date}}</p>',
      },
    ]);

    await teamsPlayground.expand(';tmsdate');

    const now = new Date();
    const year = now.getFullYear().toString();
    await expect(teamsPlayground.editor).toContainText(`報告日: ${year}`);
    await expect(teamsPlayground.editor).not.toContainText('{{date}}');
    await expect(teamsPlayground.editor).not.toContainText(';tmsdate');
  });

  test('Table element is preserved in Teams editor', async ({ teamsPlayground }) => {
    const tableHtml = '<table border="1"><tbody><tr><td>項目</td><td>内容</td></tr></tbody></table>';
    await teamsPlayground.setTemplates([
      {
        keyword: ';tmstbl',
        text: '項目\t内容',
        html: tableHtml,
      },
    ]);

    await teamsPlayground.expand(';tmstbl');

    await expect(teamsPlayground.editor.locator('table')).toBeVisible();
    await expect(teamsPlayground.editor.locator('td').first()).toHaveText('項目');
  });

  test('Non-matching keyword does not expand on Tab', async ({ teamsPlayground }) => {
    await teamsPlayground.setTemplates([
      {
        keyword: ';valid',
        text: 'Valid expansion',
      },
    ]);

    await teamsPlayground.expand(';unknown');

    await expect(teamsPlayground.editor).toContainText(';unknown');
    await expect(teamsPlayground.editor).not.toContainText('Valid expansion');
  });
});
