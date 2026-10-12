# FluxSnip

[English](README.md) | [日本語](README.ja.md)

Keyword-triggered templates for Gmail, Microsoft Teams（web or PWA）, and Google Chat（web or PWA）. Type a short keyword and press Tab, or open a search picker, and FluxSnip inserts the template at the caret.

Templates are stored in this browser only. The extension does not upload them.

## Install

FluxSnip is loaded as an unpacked extension during development.

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Click the FluxSnip icon to open the options page.

After a rebuild, click **Reload** on that same card.

## Usage

Create templates on the matching tab. A Gmail template is not offered in Teams or Chat.

### Keyword + Tab

Type the keyword in the message box and press Tab. Tab is taken over only when the keyword matches. While an IME is converting text, Tab does nothing special.

Keywords are case-sensitive, 1–32 characters, using letters, digits, and `_ - ; : . ! / @ #`. A leading `;`, as in `;thx`, avoids ordinary words.

### Picker

The default shortcut is Alt+J. Search, move with the arrow keys, and press Enter to insert. Escape closes the picker. Change the shortcut on the Settings tab. Avoid combinations your IME already uses, such as Ctrl+Space.

### Gmail fields

On a Gmail template you can also set:

| Field | Behavior |
| --- | --- |
| From | Selects a sender alias that is already in Gmail’s “Send mail as” settings |
| To, Cc, Bcc | **Replace** clears that field first. **Append** adds addresses. Leave the field blank to leave it unchanged |
| Subject | **Replace** overwrites it. **If empty** writes it only when the subject is blank |
| Gemini prompt | Text placed in Gmail’s Gemini box. `{{cursor}}` marks the caret. Optional automatic submit sends that prompt to Google |

Header fields are recognized when Gmail’s own language is Japanese or English. Body insertion still works in other Gmail languages, and a toast warns you if a header field could not be set.

### Injecting Prompts into Gmail's "Help me write" (Alt+H)

Template expansion via keyword + Tab and the popup picker (Alt+J) works directly inside Gmail's "Help me write" (Alt+H) AI prompt box.

You can save entire prompt instructions, tone requirements, or persona skills as snippet templates. Instead of retyping lengthy prompts repeatedly, you can inject them straight into the AI input field with a single keyword.

Furthermore, if you set text in the "Gemini prompt" setting of a Gmail template and turn on automatic submission, FluxSnip will populate and send the prompt to Gemini automatically upon template expansion.

### Variables

Variables are filled in when you insert. An unknown name is left as written.

| Variable | Result |
| --- | --- |
| `{{date}}` | Today as YYYY/MM/DD |
| `{{date:YYYY年M月D日}}` | Your own pattern. Tokens: `YYYY` `MM` `DD` `M` `D` `HH` `mm` `ddd` `dddd` |
| `{{time}}` | Current time as HH:mm |
| `{{weekday}}` | Short weekday |
| `{{to.name}}` `{{to.firstName}}` `{{to.lastName}}` `{{to.email}}` | First To recipient (Gmail) |
| `{{from.name}}` `{{from.email}}` | Selected From (Gmail) |
| `{{cursor}}` | Caret after expansion, in the Gmail body and the Gemini prompt |

### Teams and Google Chat

Teams keeps bold, lists, links, and tables in the company tenants `teams.microsoft.com` and `teams.cloud.microsoft`, including a chat, a new channel post, and a reply.

Google Chat, including a Chat panel inside Gmail, keeps a smaller set: bold, italic, strikethrough, code, lists, and links. A table becomes plain text, one row per line, with tabs between cells. Check the Preview tab before you save a Chat template.

### Backup and Google Drive

Export All writes `fluxsnip-backup-YYYYMMDD-HHmm.json`, including settings. A single-service export puts that service’s name in the file and omits settings.

Import **Merge** keeps the newer copy when ids match and adds the rest. Import **Replace** overwrites the services in the file after downloading a backup of what you have now. Uncheck **Also import settings** to keep the shortcut and language already on this browser.

To copy templates to another computer, save the JSON file in the desktop Google Drive folder, wait for it to sync, and import it there. There is no automatic sync.

## Privacy

- Templates and settings stay in `chrome.storage.local`.
- An image whose address starts with `https:` is loaded from that address when the message is shown.
- With **Automatically submit when expanding in Gemini prompt** enabled, that prompt is sent to Gemini in Gmail without another click.

## Limitations

- Gmail, Teams, and Chat change their pages without notice. When they do, insertion can stop until FluxSnip is updated.
- Google Chat does not keep tables. They are inserted as tab-separated text.
- `{{cursor}}` places the caret in the Gmail body and the Gemini prompt. Teams and Chat ignore it.
- Gmail header fields (To, Cc, Bcc, From, subject) are detected only when Gmail’s display language is Japanese or English.
- In Gmail, Ctrl+Z just after an expansion restores the keyword, and Ctrl+Y redoes it. If Gmail rejects `insertHTML` and the direct-DOM fallback runs, only the immediate Ctrl+Z is handled. Undo in Teams and Chat follows those editors.

## Help

Each options tab has a Help button. The pages are in Japanese and English and follow the system’s light or dark appearance. The language saved on the Settings tab chooses which copy opens.

## Development

```bash
npm install
npm run compile
npm test
npm run build
npm run dev
npm run zip
```

E2E against real Gmail uses a dedicated test account. Sign in once with `npm run e2e:login`, then run `npm run e2e`. Tests use `@example.com` addresses and discard the draft. They never send mail. `.e2e-profile/` holds that session and is gitignored.

## License

[MIT License](./LICENSE)
