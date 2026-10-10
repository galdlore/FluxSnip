import { expandText } from '@/core/engine';
import type { SubjectMode, TemplateVars } from '@/core/types';
import { q, SEL } from './selectors';

/**
 * Reads the current subject value from the compose root.
 * Returns null if the subject input does not exist or is hidden (e.g. inline reply).
 */
export function readSubject(root: HTMLElement): string | null {
  const subjectInput = q<HTMLInputElement>(root, SEL.subjectBox);
  if (!subjectInput || subjectInput.type === 'hidden') {
    return null;
  }
  return subjectInput.value;
}

/**
 * Applies the template subject configuration to Gmail compose window.
 */
export async function applySubject(
  root: HTMLElement,
  subjectConfig: { mode: SubjectMode; value: string },
  vars: TemplateVars
): Promise<boolean> {
  const subjectInput = q<HTMLInputElement>(root, SEL.subjectBox);

  // If subject input does not exist or is hidden (e.g. in inline reply), do not treat as failure
  if (!subjectInput || subjectInput.type === 'hidden') {
    return true;
  }

  const currentValue = subjectInput.value.trim();

  // If mode is 'ifEmpty' and subject already has content, leave it unchanged
  if (subjectConfig.mode === 'ifEmpty' && currentValue.length > 0) {
    return true;
  }

  // Expand variables in subject text
  const expandedValue = expandText(subjectConfig.value, vars);

  // Set value using native property descriptor to trigger framework listeners
  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(subjectInput, expandedValue);
    } else {
      subjectInput.value = expandedValue;
    }
  } catch {
    subjectInput.value = expandedValue;
  }

  // Dispatch events to notify Gmail
  subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
  subjectInput.dispatchEvent(new Event('change', { bubbles: true }));

  return true;
}
