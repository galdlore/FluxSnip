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
  border-radius: 12px;
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

/* =========================================
   LIGHT THEME (Default & .light)
   ========================================= */
.picker-card,
.picker-card.light {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 16px 48px -6px rgba(0, 0, 0, 0.22), 0 2px 10px rgba(0, 0, 0, 0.08);
  color: #1f2937;
}

.picker-card .picker-search-wrapper,
.picker-card.light .picker-search-wrapper {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(248, 249, 250, 0.95);
}

.picker-card .picker-search-icon,
.picker-card.light .picker-search-icon {
  font-size: 14px;
  line-height: 1;
}

.picker-card .picker-search-input,
.picker-card.light .picker-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #111827;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
}

.picker-card .picker-search-input::placeholder,
.picker-card.light .picker-search-input::placeholder {
  color: #9ca3af;
}

.picker-card .picker-list,
.picker-card.light .picker-list {
  flex: 1;
  overflow-y: auto;
  max-height: 320px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #ffffff;
}

.picker-card .picker-list::-webkit-scrollbar,
.picker-card.light .picker-list::-webkit-scrollbar {
  width: 6px;
}
.picker-card .picker-list::-webkit-scrollbar-thumb,
.picker-card.light .picker-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.picker-card .picker-item,
.picker-card.light .picker-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-left: 4px solid transparent;
  transition: background 100ms ease, border-color 100ms ease;
}

.picker-card .picker-item:hover,
.picker-card.light .picker-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.picker-card .picker-item.selected,
.picker-card.light .picker-item.selected {
  background: linear-gradient(90deg, rgba(79, 70, 229, 0.12) 0%, rgba(79, 70, 229, 0.03) 100%);
  border: 1px solid rgba(79, 70, 229, 0.35);
  border-left: 4px solid #4f46e5;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
}

.picker-card .picker-item-top,
.picker-card.light .picker-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.picker-card .picker-item-title-group,
.picker-card.light .picker-item-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.picker-card .picker-item-name,
.picker-card.light .picker-item-name {
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-card .picker-item.selected .picker-item-name,
.picker-card.light .picker-item.selected .picker-item-name {
  color: #312e81;
}

.picker-card .picker-keyword-badge,
.picker-card.light .picker-keyword-badge {
  font-family: Consolas, "Cascadia Code", monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.25);
  color: #4338ca;
}

.picker-card .picker-tag-badge,
.picker-card.light .picker-tag-badge {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: #4b5563;
}

.picker-card .picker-item-preview,
.picker-card.light .picker-item-preview {
  font-size: 11.5px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-card .picker-item.selected .picker-item-preview,
.picker-card.light .picker-item.selected .picker-item-preview {
  color: #374151;
}

.picker-card .picker-item-select-hint,
.picker-card.light .picker-item-select-hint {
  display: none;
  font-size: 10px;
  font-weight: 600;
  color: #4338ca;
  background: #e0e7ff;
  border: 1px solid #c7d2fe;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.picker-card .picker-item.selected .picker-item-select-hint,
.picker-card.light .picker-item.selected .picker-item-select-hint {
  display: inline-flex;
  align-items: center;
  margin-left: auto;
}

.picker-card .picker-empty-state,
.picker-card.light .picker-empty-state {
  padding: 24px 16px;
  text-align: center;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.picker-card .picker-options-link,
.picker-card.light .picker-options-link {
  color: #4f46e5;
  text-decoration: underline;
  cursor: pointer;
  background: none;
  border: none;
  font-size: 12px;
  padding: 0;
  font-family: inherit;
}

.picker-card .picker-footer,
.picker-card.light .picker-footer {
  padding: 7px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #6b7280;
}

.picker-card .picker-footer-hints,
.picker-card.light .picker-footer-hints {
  display: flex;
  gap: 12px;
}

.picker-card .picker-kbd,
.picker-card.light .picker-kbd {
  background: #ffffff;
  border: 1px solid #d1d5db;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 10.5px;
  color: #374151;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  margin-right: 3px;
}

/* =========================================
   DARK THEME (.dark)
   ========================================= */
.picker-card.dark {
  background: rgba(18, 19, 31, 0.98);
  border: 1.5px solid rgba(139, 92, 246, 0.6);
  box-shadow: 0 20px 60px -8px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.12);
  color: hsl(240, 20%, 95%);
}

.picker-card.dark .picker-search-wrapper {
  background: rgba(28, 29, 45, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.picker-card.dark .picker-search-input {
  color: hsl(240, 20%, 96%);
}

.picker-card.dark .picker-search-input::placeholder {
  color: hsl(240, 10%, 55%);
}

.picker-card.dark .picker-list {
  background: transparent;
}

.picker-card.dark .picker-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.picker-card.dark .picker-item:hover {
  background: rgba(139, 92, 246, 0.15);
}

.picker-card.dark .picker-item.selected {
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0.10) 100%);
  border: 1px solid rgba(139, 92, 246, 0.65);
  border-left: 4px solid #a78bfa;
  box-shadow: 0 4px 16px -2px rgba(139, 92, 246, 0.35);
}

.picker-card.dark .picker-item-name {
  color: hsl(240, 20%, 96%);
}

.picker-card.dark .picker-item.selected .picker-item-name {
  color: #ffffff;
}

.picker-card.dark .picker-keyword-badge {
  background: rgba(139, 92, 246, 0.25);
  border: 1px solid rgba(139, 92, 246, 0.45);
  color: #67e8f9;
}

.picker-card.dark .picker-tag-badge {
  background: #2d2e42;
  border: none;
  color: #d1d5db;
}

.picker-card.dark .picker-item-preview {
  color: hsl(240, 10%, 65%);
}

.picker-card.dark .picker-item.selected .picker-item-preview {
  color: hsl(240, 20%, 88%);
}

.picker-card.dark .picker-item-select-hint {
  background: rgba(139, 92, 246, 0.4);
  color: #c4b5fd;
  border: 1px solid rgba(139, 92, 246, 0.5);
}

.picker-card.dark .picker-footer {
  background: rgba(13, 14, 24, 0.85);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  color: hsl(240, 10%, 55%);
}

.picker-card.dark .picker-kbd {
  background: #2d2e42;
  border: 1px solid #4b5563;
  color: #e5e7eb;
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
