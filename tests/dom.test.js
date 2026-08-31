import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

describe('session-type help popover (real DOM)', () => {
  beforeAll(async () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    global.document = dom.window.document;
    global.window = dom.window;
    // main.js wires listeners on import; fetch only runs on submit, so safe here.
    await import('../js/main.js');
  });

  it('date defaults to a YYYY-MM-DD value on load', () => {
    const v = document.getElementById('date').value;
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('help popover starts hidden and toggles open on click', () => {
    const btn = document.getElementById('session-help');
    const pop = document.getElementById('session-help-pop');
    expect(pop.classList.contains('hidden')).toBe(true);
    btn.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(pop.classList.contains('hidden')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    btn.dispatchEvent(new global.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(pop.classList.contains('hidden')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('popover explains all four session types', () => {
    const txt = document.getElementById('session-help-pop').textContent;
    for (const t of ['Easy / recovery', 'Tempo', 'Intervals / VO2', 'Long run']) {
      expect(txt).toContain(t);
    }
  });
});
