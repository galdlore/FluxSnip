# Changelog

## 0.2.0

- Support Japanese keywords (Kanji, Hiragana, Katakana, and Japanese symbols).
- Allow full-width semicolon (；) to match templates registered with half-width semicolon (;).
- Fix issue where keyword text remained in Gmail body after Tab expansion.
- Improve Range recovery across multiple Text nodes.

## 0.1.0

First release of FluxSnip.

- Insert templates in Gmail, Microsoft Teams, and Google Chat with a keyword plus Tab, or with the search picker (default Alt+J).
- Gmail templates can set To, Cc, Bcc, subject, a From alias, and an optional Gemini prompt.
- Google Chat templates are converted to the formatting Chat can keep. Tables become plain text.
- Templates and settings stay in the browser. Export and import them as JSON, including a manual copy through a Google Drive folder.
- The options page, in-page messages, and Help are available in English and Japanese.
