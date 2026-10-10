/**
 * Common styles and design tokens for Shadow DOM UI components (Picker and Toast).
 * Follows the dark theme, glassmorphism, and accent gradients specified in ARCHITECTURE.md §10.
 */

export const UI_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: hsl(240, 20%, 95%);
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ----------------- Picker Styles ----------------- */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  background: transparent;
}

.picker-card {
  position: fixed;
  z-index: 2147483647;
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: hsl(240, 22%, 11% / 0.97);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid hsl(262, 85%, 66% / 0.65);
  border-radius: 12px;
  box-shadow: 0 20px 60px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12);
  overflow: hidden;
  animation: picker-in 120ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes picker-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.picker-search-wrapper {
  padding: 10px 12px;
  border-bottom: 1px solid hsl(240, 20%, 30% / 0.35);
  display: flex;
  align-items: center;
  gap: 8px;
  background: hsl(240, 18%, 12% / 0.4);
}

.picker-search-icon {
  color: hsl(240, 10%, 65%);
  font-size: 14px;
  line-height: 1;
}

.picker-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: hsl(240, 20%, 96%);
  font-size: 13.5px;
  font-family: inherit;
}

.picker-search-input::placeholder {
  color: hsl(240, 10%, 55%);
}

.picker-list {
  flex: 1;
  overflow-y: auto;
  max-height: 320px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-list::-webkit-scrollbar {
  width: 6px;
}
.picker-list::-webkit-scrollbar-thumb {
  background: hsl(240, 20%, 30% / 0.6);
  border-radius: 3px;
}

.picker-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  transition: background 100ms ease, border-color 100ms ease;
}

.picker-item:hover,
.picker-item.selected {
  background: hsl(262, 50%, 25% / 0.45);
  border-color: hsl(262, 85%, 66% / 0.4);
}

.picker-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.picker-item-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.picker-item-name {
  font-weight: 600;
  color: hsl(240, 20%, 96%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-keyword-badge {
  font-family: Consolas, "Cascadia Code", monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: linear-gradient(135deg, hsl(262, 85%, 66% / 0.25), hsl(190, 90%, 55% / 0.25));
  border: 1px solid hsl(262, 85%, 66% / 0.4);
  color: hsl(190, 95%, 75%);
}

.picker-tag-badge {
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: hsl(240, 16%, 20%);
  color: hsl(240, 10%, 75%);
}

.picker-item-preview {
  font-size: 11.5px;
  color: hsl(240, 10%, 65%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-empty-state {
  padding: 24px 16px;
  text-align: center;
  color: hsl(240, 10%, 60%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.picker-options-link {
  color: hsl(190, 90%, 55%);
  text-decoration: underline;
  cursor: pointer;
  background: none;
  border: none;
  font-size: 12px;
  padding: 0;
  font-family: inherit;
}

.picker-footer {
  padding: 6px 12px;
  border-top: 1px solid hsl(240, 20%, 30% / 0.3);
  background: hsl(240, 20%, 8% / 0.6);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: hsl(240, 10%, 55%);
}

.picker-footer-hints {
  display: flex;
  gap: 12px;
}

.picker-kbd {
  background: hsl(240, 16%, 20%);
  border: 1px solid hsl(240, 20%, 35%);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: inherit;
  font-size: 10px;
  color: hsl(240, 15%, 85%);
  margin-right: 3px;
}

/* ----------------- Toast Styles ----------------- */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  min-width: 260px;
  max-width: 380px;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #181924 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 0, 0, 0.2) !important;
  color: #f3f4f6 !important;
  animation: toast-in 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  transition: opacity 150ms ease, transform 150ms ease;
}

.toast-item.toast-out {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.toast-icon {
  font-size: 15px;
  line-height: 1;
  margin-top: 1px;
}

.toast-info .toast-icon { color: hsl(190, 90%, 55%); }
.toast-success .toast-icon { color: hsl(150, 60%, 50%); }
.toast-warn .toast-icon { color: #f59e0b !important; }
.toast-error .toast-icon { color: #ef4444 !important; }

.toast-info { border-left: 3px solid hsl(190, 90%, 55%) !important; }
.toast-success { border-left: 3px solid hsl(150, 60%, 50%) !important; }
.toast-warn { border-left: 3px solid #f59e0b !important; }
.toast-error { border-left: 3px solid #ef4444 !important; }

.toast-content {
  flex: 1;
  font-size: 12.5px;
  word-break: break-word;
  color: #f3f4f6 !important;
  line-height: 1.4;
}

.toast-close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6) !important;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
  border-radius: 4px;
  transition: color 100ms ease;
}

.toast-close:hover {
  color: #ffffff !important;
}
`;
