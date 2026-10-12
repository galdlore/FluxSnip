import { beforeEach, describe, expect, it } from 'vitest';
import { chatAdapter } from './adapter';

const fixtureHtml = `
<div class="test-chat-container">
  <form role="search" aria-label="チャットを検索">
    <input id="chat-search" name="q" type="text" role="combobox" aria-label="チャットを検索" value="" />
  </form>

  <div jsname="AAsgyb" class="KCm9Q GdHcWc uhTKS" data-group-id="dm/mock123">
    <div class="tAVIoc I9OJHe">
      <div jsname="V67aGc" class="GB6BTc snByac" aria-hidden="true">履歴がオンになっています</div>
      <div
        id="chat-editor"
        jsname="yrriRe"
        class="hj99tb KRoqRc editable wLWUAc-qyVyld"
        role="textbox"
        aria-label="履歴がオンになっています"
        aria-multiline="true"
        spellcheck="true"
        g_editable="true"
        contenteditable="true"
      >
        <div id="chat-caret-node"><br /></div>
      </div>
    </div>
    <button aria-label="メッセージを送信" jsname="GBTyxb" disabled="">送信</button>
  </div>

  <!-- Gmail compose window simulator to verify disambiguation -->
  <div id="gmail-compose" class="M9" role="dialog">
    <div
      id="gmail-editor"
      class="Am aiL Al editable LW-avf"
      role="textbox"
      g_editable="true"
      contenteditable="true"
    >
      <p>Gmail text</p>
    </div>
  </div>
</div>
`;

describe('Google Chat Adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = fixtureHtml;
  });

  it('has platform chat and expected insertOrder', () => {
    expect(chatAdapter.platform).toBe('chat');
    expect(chatAdapter.insertOrder).toEqual(['paste', 'insertText', 'clipboard']);
  });

  it('detects Chat message input from direct element', () => {
    const editor = document.getElementById('chat-editor') as HTMLElement;
    const found = chatAdapter.findEditor(editor);
    expect(found).toBe(editor);
  });

  it('detects Chat message input from child caret node', () => {
    const caretNode = document.getElementById('chat-caret-node') as HTMLElement;
    const expected = document.getElementById('chat-editor') as HTMLElement;
    const found = chatAdapter.findEditor(caretNode);
    expect(found).toBe(expected);
  });

  it('ignores search input and returns null', () => {
    const searchInput = document.getElementById('chat-search') as HTMLElement;
    const found = chatAdapter.findEditor(searchInput);
    expect(found).toBeNull();
  });

  it('does not claim Gmail compose body editor (disambiguation)', () => {
    const gmailEditor = document.getElementById('gmail-editor') as HTMLElement;
    const found = chatAdapter.findEditor(gmailEditor);
    expect(found).toBeNull();
  });

  it('resolves the editor when focus is on another control inside the message box', () => {
    const sendBtn = document.querySelector('button[jsname="GBTyxb"]') as HTMLElement;
    const expected = document.getElementById('chat-editor') as HTMLElement;
    expect(chatAdapter.findEditor(sendBtn)).toBe(expected);
  });

  it('does not claim an unrelated editor when focus is outside any message box', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    expect(chatAdapter.findEditor(outside)).toBeNull();
    expect(chatAdapter.findEditor(document.body)).toBeNull();
    expect(chatAdapter.findEditor(document.querySelector('.test-chat-container'))).toBeNull();
  });

  it('returns empty vars from collectVars', async () => {
    const editor = document.getElementById('chat-editor') as HTMLElement;
    const vars = await chatAdapter.collectVars(editor);
    expect(vars).toEqual({});
  });
});
