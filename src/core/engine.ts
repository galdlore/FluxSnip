import {
  CURSOR_MARK,
  type Person,
  type RenderedContent,
  type Template,
  type TemplateVars,
} from './types';
import { astToChatText, astToHtml, astToPlainText, joinSplitPlaceholders, mapAstText } from './html/ast';

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const CURSOR_REGEX = /\{\{\s*cursor\s*\}\}/g;

/**
 * Splits a full name into firstName and lastName considering CJK and Western naming conventions.
 */
export function splitName(displayName: string): { firstName: string; lastName: string } {
  if (!displayName || !displayName.trim()) {
    return { firstName: '', lastName: '' };
  }

  // Split by half-width, full-width, and non-breaking space
  const tokens = displayName.trim().split(/[\s\u3000\u00A0]+/);

  if (tokens.length === 1) {
    const single = tokens[0] ?? '';
    return { firstName: single, lastName: single };
  }

  const hasCjk = tokens.some((t) => CJK_REGEX.test(t));
  if (hasCjk) {
    // CJK: First token is surname (lastName), remaining tokens form given name (firstName)
    return {
      lastName: tokens[0] ?? '',
      firstName: tokens.slice(1).join(' '),
    };
  }

  // Western: First token is firstName, last token is lastName
  return {
    firstName: tokens.slice(0, -1).join(' '),
    lastName: tokens[tokens.length - 1] ?? '',
  };
}

function resolvePersonField(person: Person | undefined, field: 'name' | 'firstName' | 'lastName' | 'email'): string {
  if (!person) return '';

  if (field === 'name') {
    return person.name || (person.email ? (person.email.split('@')[0] ?? '') : '');
  }

  if (field === 'email') {
    return person.email || '';
  }

  // firstName or lastName
  const directVal = person[field];
  if (directVal) {
    return directVal;
  }

  if (person.name) {
    const split = splitName(person.name);
    return split[field] || '';
  }

  if (field === 'firstName' && person.email) {
    return person.email.split('@')[0] ?? '';
  }

  return '';
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateCustom(date: Date, format: string, locale: string): string {
  const YYYY = date.getFullYear().toString();
  const MM = pad(date.getMonth() + 1);
  const M = (date.getMonth() + 1).toString();
  const DD = pad(date.getDate());
  const D = date.getDate().toString();
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());

  let ddd = '';
  let dddd = '';
  try {
    ddd = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
    dddd = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  } catch {
    ddd = new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date);
    dddd = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date);
  }

  return format
    .replace(/YYYY/g, YYYY)
    .replace(/MM/g, MM)
    .replace(/\bM\b/g, M)
    .replace(/DD/g, DD)
    .replace(/\bD\b/g, D)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/dddd/g, dddd)
    .replace(/ddd/g, ddd);
}

const KNOWN_VARIABLES = new Set([
  'to.name',
  'to.firstName',
  'to.lastName',
  'to.email',
  'from.name',
  'from.email',
  'date',
  'time',
  'weekday',
  'cursor',
]);

/**
 * Expands placeholders within a single plain text string.
 */
export function expandText(s: string, vars: TemplateVars): string {
  if (!s || !s.includes('{{')) return s;

  const VAR_REGEX = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.]*)(?::([^}]*))?\s*\}\}/g;

  return s.replace(VAR_REGEX, (raw, name: string, arg?: string) => {
    if (name === 'date' && arg !== undefined) {
      return formatDateCustom(vars.now, arg, vars.locale);
    }

    if (name === 'date') {
      const y = vars.now.getFullYear();
      const m = pad(vars.now.getMonth() + 1);
      const d = pad(vars.now.getDate());
      return `${y}/${m}/${d}`;
    }

    if (name === 'time') {
      const h = pad(vars.now.getHours());
      const min = pad(vars.now.getMinutes());
      return `${h}:${min}`;
    }

    if (name === 'weekday') {
      try {
        return new Intl.DateTimeFormat(vars.locale, { weekday: 'short' }).format(vars.now);
      } catch {
        return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(vars.now);
      }
    }

    if (name === 'cursor') {
      return '';
    }

    if (name.startsWith('to.')) {
      const field = name.slice(3) as 'name' | 'firstName' | 'lastName' | 'email';
      if (['name', 'firstName', 'lastName', 'email'].includes(field)) {
        return resolvePersonField(vars.to, field);
      }
    }

    if (name.startsWith('from.')) {
      const field = name.slice(5) as 'name' | 'email';
      if (['name', 'email'].includes(field)) {
        return resolvePersonField(vars.from, field);
      }
    }

    // Unknown variable: leave as-is
    if (!KNOWN_VARIABLES.has(name)) {
      return raw;
    }

    return '';
  });
}

/**
 * Renders a full template with variable substitutions.
 */
export function renderTemplate(t: Template, vars: TemplateVars): RenderedContent {
  const substitutedAst = mapAstText(joinSplitPlaceholders(t.bodyAst), (text) =>
    expandText(text.replace(CURSOR_REGEX, CURSOR_MARK), vars)
  );
  const cleanAst = mapAstText(substitutedAst, (text) => text.split(CURSOR_MARK).join(''));
  return {
    ast: substitutedAst,
    html: astToHtml(cleanAst),
    text: astToPlainText(cleanAst),
    chatText: astToChatText(cleanAst),
  };
}
