# Privacy Policy for FluxSnip

**Last Updated:** October 12, 2026

FluxSnip is an open-source browser extension licensed under the MIT License. This Privacy Policy explains how FluxSnip handles your data when you use the extension.

## 1. Summary

FluxSnip is built with a privacy-first architecture. It does not collect, transmit, sell, or monetize any user data. All operations take place locally on your computer.

## 2. Information Handled and Storage

- **Templates and Settings:** Your snippet templates, shortcuts, UI language preferences, and custom settings are stored exclusively on your device using Chrome's local storage API (`chrome.storage.local`).
- **No External Servers:** FluxSnip does not operate any backend servers. No data is ever transmitted over the network.
- **No Tracking or Analytics:** The extension contains zero tracking scripts, telemetry, advertisements, analytics services, or third-party error-monitoring tools.

## 3. Web Page Content and Message Data

FluxSnip interacts with supported web applications (Gmail, Microsoft Teams, and Google Chat) solely to provide snippet expansion and template insertion:

- **Local Execution:** Page DOM elements are inspected locally and in real time only to detect trigger keywords, position the template picker dialog, and insert snippet content into active message editors.
- **No Retention of Drafts or Communications:** Message bodies, draft text, email contents, chat histories, recipient addresses, and contact details are never logged, recorded, or sent anywhere.
- **Exception (Local Sender Caching in Gmail):** When composing messages in Gmail, sender (From) alias addresses found in your active account dropdown or profile badge are saved locally in your browser's `chrome.storage.local` to populate the From field dropdown in the FluxSnip settings. This data never leaves your device.

## 4. Permissions and Their Purpose

FluxSnip requests only the minimum permissions necessary for its core functionality:

- **`storage`**: Used to save templates, shortcuts, and configuration options locally on your machine.
- **`unlimitedStorage`**: Allows storing rich templates containing embedded inline images (Base64 data) without being restricted by the default 10 MB local storage cap.
- **Host Permissions (`https://mail.google.com/*`, `https://chat.google.com/*`, `https://teams.microsoft.com/*`, `https://teams.cloud.microsoft/*`)**: Required to run content scripts on supported webmail and chat platforms to detect typed keywords and insert template content into compose windows.

## 5. Remote Code and Security

In strict adherence to Chrome Web Store policies and Manifest V3 security standards:
- FluxSnip does not load, execute, or reference any remote scripts, styles, or fonts.
- All code and resources are packaged and distributed directly within the extension package.

## 6. Source Code and Contact

FluxSnip is open source. You can inspect the source code, report issues, or ask questions on GitHub:

- **Repository & Issues:** [https://github.com/galdlore/FluxSnip/issues](https://github.com/galdlore/FluxSnip/issues)
