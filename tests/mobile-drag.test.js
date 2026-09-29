import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// Mobile drag affordance (audit 4.6 follow-up).
//
// Two independent defects made the window band undraggable on a phone:
//
//   1. `touch-action: none` was declared only on the <g class="window-band">.
//      touch-action is NOT an inherited CSS property, so the browser evaluated
//      it on the real hit element — the `.band-hit` rect — saw the default
//      `auto`, claimed the gesture for scrolling, and fired `pointercancel`.
//      The drag died on contact. The existing drag test could never catch this
//      because it dispatches synthetic MouseEvents, which bypass the browser's
//      touch-action decision entirely.
//
//   2. The band is drawn in viewBox units, and the chart renders ~326px wide on
//      a 375px phone (scale 0.407). The old fixed +12-unit pad came out to a
//      14.5px touch target — well under the 44px (Apple) / 48dp (Material)
//      minimum. Unusable regardless of the gesture bug above.
//
// These tests pin both the CSS contract and the hit-area geometry.

describe('touch-action reaches the band hit target', () => {
  it('styles.css grants touch-action:none to .window-band descendants, not just the group', () => {
    const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    // A descendant selector is required: the pointer lands on a child rect, and
    // touch-action does not inherit down to it.
    expect(css).toMatch(/\.window-band[^{]*\*[^{]*\{[^}]*touch-action:\s*none/);
  });
});

describe('hitWidthUnits converts a px touch target into viewBox units', () => {
  it('returns a width that renders at >= 44px on a 375px phone', async () => {
    const { hitWidthUnits, MIN_TOUCH_TARGET_PX } = await import('../js/timeline.js');
    expect(MIN_TOUCH_TARGET_PX).toBe(44);
    // Phone: 800-unit viewBox rendered into ~326px => scale 0.4075.
    const units = hitWidthUnits(326, 800);
    expect(units * (326 / 800)).toBeGreaterThanOrEqual(44);
  });

  it('shrinks on a wide desktop render so it does not swallow the chart', async () => {
    const { hitWidthUnits } = await import('../js/timeline.js');
    const units = hitWidthUnits(1200, 800);
    // 1200/800 = 1.5 scale, so the target needs far fewer user units.
    expect(units * 1.5).toBeGreaterThanOrEqual(44);
    expect(units).toBeLessThan(60); // stays a small slice of the 800-unit chart
  });

  it('falls back to the base pad when the rendered width is unknown (jsdom/SSR)', async () => {
    const { hitWidthUnits } = await import('../js/timeline.js');
    expect(hitWidthUnits(0, 800)).toBe(12);
    expect(hitWidthUnits(NaN, 800)).toBe(12);
    expect(hitWidthUnits(326, 0)).toBe(12);
  });

  it('never returns less than the base pad even on a very wide screen', async () => {
    const { hitWidthUnits } = await import('../js/timeline.js');
    expect(hitWidthUnits(4000, 800)).toBe(12);
  });
});

describe('rendered band hit area meets the touch-target minimum', () => {
  const fixtures = (n = 1440) => {
    const minute = {
      time: Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: n }, (_, i) => 15 + 10 * Math.sin(i / 100)),
      relative_humidity_2m: new Array(n).fill(60),
      wind_speed_10m: new Array(n).fill(2),
      cloud_cover: new Array(n).fill(20),
      shortwave_radiation: new Array(n).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    const comfort = Array.from({ length: n }, (_, i) => (i < 700 ? 90 : 20));
    return { minute, wbgtPerMin: wbgt, comfortPerMin: comfort };
  };

  it('sizes .band-hit to >= 44px at a 375px phone render width', async () => {
    const { JSDOM: Ctor } = await import('jsdom');
    const dom = new Ctor('<!DOCTYPE html><body><div id="c"></div></body>');
    global.window = dom.window;
    dom.window.SVGElement.prototype.setPointerCapture = function () {};
    dom.window.SVGElement.prototype.releasePointerCapture = function () {};
    // jsdom reports 0 for layout; stub the phone's real rendered width.
    dom.window.SVGSVGElement.prototype.getBoundingClientRect = function () {
      return { width: 326, height: 130, top: 0, left: 0, right: 326, bottom: 130 };
    };

    const { renderTimeline } = await import('../js/timeline.js');
    const el = dom.window.document.getElementById('c');
    const f = fixtures();
    renderTimeline(el, { ...f, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'T' });

    const hit = el.querySelector('.band-hit');
    expect(hit).not.toBeNull();
    const units = parseFloat(hit.getAttribute('width'));
    expect(units * (326 / 800)).toBeGreaterThanOrEqual(44);
  });

  it('keeps the hit area centred on the band after a drag', async () => {
    const { JSDOM: Ctor } = await import('jsdom');
    const dom = new Ctor('<!DOCTYPE html><body><div id="c"></div></body>');
    global.window = dom.window;
    dom.window.SVGElement.prototype.setPointerCapture = function () {};
    dom.window.SVGElement.prototype.releasePointerCapture = function () {};
    Object.defineProperty(dom.window.SVGSVGElement.prototype, 'createSVGPoint', {
      configurable: true,
      value: function () {
        return { x: 0, y: 0, matrixTransform: function () { return { x: this.x, y: this.y }; } };
      }
    });
    dom.window.SVGSVGElement.prototype.getScreenCTM = function () {
      return { inverse: function () { return {}; } };
    };
    dom.window.SVGSVGElement.prototype.getBoundingClientRect = function () {
      return { width: 326, height: 130, top: 0, left: 0, right: 326, bottom: 130 };
    };
    const mod = await import('../js/timeline.js');

    const el = dom.window.document.getElementById('c');
    const f = fixtures();
    mod.renderTimeline(el, { ...f, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'T' });

    const band = el.querySelector('#window-band');
    const hit = el.querySelector('.band-hit');
    const rect = el.querySelector('#band-rect');

    // Drag the band later in the day.
    band.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100, pointerId: 1 }));
    band.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 600, clientY: 100, pointerId: 1 }));
    band.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 600, clientY: 100, pointerId: 1 }));

    // Still >= 44px after the move...
    const units = parseFloat(hit.getAttribute('width'));
    expect(units * (326 / 800)).toBeGreaterThanOrEqual(44);

    // ...and still centred on the visible band rect.
    const hitCentre = parseFloat(hit.getAttribute('x')) + units / 2;
    const rectCentre = parseFloat(rect.getAttribute('x')) + parseFloat(rect.getAttribute('width')) / 2;
    expect(Math.abs(hitCentre - rectCentre)).toBeLessThan(0.51);
  });
});

describe('hidden -> visible transition re-sizes the hit area', () => {
  // Regression: main.js calls renderTimeline while #chart is still `hidden`, so
  // getBoundingClientRect() reports 0 and a one-shot measurement silently leaves
  // the target at the desktop-sized pad. No `resize` event fires for the
  // hidden -> visible transition, so only a ResizeObserver corrects it.
  it('a ResizeObserver callback restores the 44px target after the chart is shown', async () => {
    const { JSDOM: Ctor } = await import('jsdom');
    const dom = new Ctor('<!DOCTYPE html><body><div id="c" hidden></div></body>');
    global.window = dom.window;
    dom.window.SVGElement.prototype.setPointerCapture = function () {};
    dom.window.SVGElement.prototype.releasePointerCapture = function () {};

    let rendered = 0; // 0 while the chart is hidden, like display:none
    dom.window.SVGSVGElement.prototype.getBoundingClientRect = function () {
      return { width: rendered, height: 130, top: 0, left: 0, right: rendered, bottom: 130 };
    };

    // Capture the observer callback so the test can fire it, the way the
    // browser would when the element gains a box. The module reads
    // globalThis.ResizeObserver, so install it there.
    let notify = null;
    const StubRO = class {
      constructor(cb) { notify = cb; }
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(globalThis, 'ResizeObserver', { value: StubRO, configurable: true, writable: true });

    const { renderTimeline } = await import('../js/timeline.js');
    const el = dom.window.document.getElementById('c');
    const n = 1440;
    const minute = {
      time: Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: n }, (_, i) => 15 + 10 * Math.sin(i / 100)),
      relative_humidity_2m: new Array(n).fill(60),
      wind_speed_10m: new Array(n).fill(2),
      cloud_cover: new Array(n).fill(20),
      shortwave_radiation: new Array(n).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    const comfort = Array.from({ length: n }, (_, i) => (i < 700 ? 90 : 20));

    renderTimeline(el, { minute, wbgtPerMin: wbgt, comfortPerMin: comfort, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'T' });

    const hit = el.querySelector('.band-hit');
    // Hidden: no usable measurement, so it falls back to the base pad.
    expect(parseFloat(hit.getAttribute('width')) * (326 / 800)).toBeLessThan(44);
    expect(notify).toBeTypeOf('function');

    // The chart becomes visible; the observer fires with a real width.
    rendered = 326;
    notify();

    const units = parseFloat(hit.getAttribute('width'));
    expect(units * (326 / 800)).toBeGreaterThanOrEqual(44);
  });

  it('re-sizing after a drag keeps the band where the user put it', async () => {
    const { JSDOM: Ctor } = await import('jsdom');
    const dom = new Ctor('<!DOCTYPE html><body><div id="c"></div></body>');
    global.window = dom.window;
    dom.window.SVGElement.prototype.setPointerCapture = function () {};
    dom.window.SVGElement.prototype.releasePointerCapture = function () {};
    Object.defineProperty(dom.window.SVGSVGElement.prototype, 'createSVGPoint', {
      configurable: true,
      value: function () { return { x: 0, y: 0, matrixTransform: function () { return { x: this.x, y: this.y }; } }; }
    });
    dom.window.SVGSVGElement.prototype.getScreenCTM = function () { return { inverse: function () { return {}; } }; };
    let rendered = 326;
    dom.window.SVGSVGElement.prototype.getBoundingClientRect = function () {
      return { width: rendered, height: 130, top: 0, left: 0, right: rendered, bottom: 130 };
    };
    let notify = null;
    const StubRO2 = class {
      constructor(cb) { notify = cb; }
      observe() {}
      disconnect() {}
    };
    Object.defineProperty(globalThis, 'ResizeObserver', { value: StubRO2, configurable: true, writable: true });

    const { renderTimeline } = await import('../js/timeline.js');
    const el = dom.window.document.getElementById('c');
    const n = 1440;
    const minute = {
      time: Array.from({ length: 24 }, (_, h) => `2026-08-31T${String(h).padStart(2, '0')}:00`),
      temperature_2m: Array.from({ length: n }, (_, i) => 15 + 10 * Math.sin(i / 100)),
      relative_humidity_2m: new Array(n).fill(60),
      wind_speed_10m: new Array(n).fill(2),
      cloud_cover: new Array(n).fill(20),
      shortwave_radiation: new Array(n).fill(0)
    };
    const wbgt = minute.temperature_2m.map((t) => t * 0.9);
    const comfort = Array.from({ length: n }, (_, i) => (i < 700 ? 90 : 20));

    renderTimeline(el, { minute, wbgtPerMin: wbgt, comfortPerMin: comfort, window: { startMin: 300, endMin: 345 }, shaded: false, placeName: 'T' });

    const band = el.querySelector('#window-band');
    const rect = el.querySelector('#band-rect');
    const hit = el.querySelector('.band-hit');

    band.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 100, pointerId: 1 }));
    band.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 600, clientY: 100, pointerId: 1 }));
    band.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 600, clientY: 100, pointerId: 1 }));

    const movedX = parseFloat(rect.getAttribute('x'));
    expect(movedX).not.toBe(245.6); // the band really moved

    // A later resize must NOT snap it back to the original best window.
    rendered = 380;
    notify();

    expect(parseFloat(rect.getAttribute('x'))).toBe(movedX);
    const units = parseFloat(hit.getAttribute('width'));
    expect(units * (380 / 800)).toBeGreaterThanOrEqual(44);
  });
});

describe('mobile axis legibility', () => {
  it('styles.css bumps the chart tick font-size on narrow viewports', () => {
    const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    // The tick label is font-size="11" in viewBox units, which renders at
    // ~4.5px once the chart is scaled to a phone. A media query has to
    // override it in user units.
    expect(css).toMatch(/@media[^{]*max-width[^{]*\{[^@]*?svg\s+text\s*\{[^}]*font-size/);
  });
});
