import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';

beforeAll(() => {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="r"></div></body>');
  global.document = dom.window.document;
  global.window = dom.window;
});

describe('window stats recompute on drag', () => {
  it('summarizeWindow returns correct mean comfort, WBGT, and clamped end for a dragged start', async () => {
    const { summarizeWindow } = await import('../js/ui.js');
    const comfort = Array.from({ length: 1440 }, (_, i) => (i >= 300 && i < 345 ? 90 : 10));
    const wbgtC = Array.from({ length: 1440 }, (_, i) => (i >= 300 && i < 345 ? 12 : 25));
    const win = summarizeWindow(comfort, wbgtC, 300, 45);
    expect(win.startMin).toBe(300);
    expect(win.endMin).toBe(345);
    expect(win.score).toBe(90); // all 90 inside window
    expect(win.meanWBGT).toBeCloseTo(12, 5);

    // Dragging to a worse window changes score/WBGT
    const moved = summarizeWindow(comfort, wbgtC, 600, 45);
    expect(moved.score).toBe(10);
    expect(moved.meanWBGT).toBeCloseTo(25, 5);
  });

  it('summarizeWindow clamps end to the array length (no window past midnight)', async () => {
    const { summarizeWindow } = await import('../js/ui.js');
    const comfort = new Array(1440).fill(50);
    const wbgtC = new Array(1440).fill(15);
    const win = summarizeWindow(comfort, wbgtC, 1430, 45); // start+len > 1440
    expect(win.endMin).toBe(1440);
    expect(win.score).toBe(50);
  });

  it('updateWindowStats patches only dynamic stat nodes in place (real-time, no full re-render)', async () => {
    const { renderResults, updateWindowStats } = await import('../js/ui.js');
    const el = document.getElementById('r');
    const comfort = Array.from({ length: 1440 }, (_, i) => (i >= 300 && i < 345 ? 88 : 12));
    const wbgtC = Array.from({ length: 1440 }, (_, i) => (i >= 300 && i < 345 ? 11 : 24));
    const window = { startMin: 300, endMin: 345 };
    renderResults(el, {
      window, comfortPerMin: comfort, wbgtPerMin: wbgtC, runLengthMin: 45,
      shaded: false, sessionType: 'easy', sessionLabel: 'Easy', aqiAvailable: false
    });
    expect(el.querySelector('#res-time').textContent).toContain('05:00'); // 300 min
    expect(el.querySelector('#res-comfort').textContent).toContain('88/100');
    expect(el.querySelector('#res-wbgt').textContent).toContain('51.8'); // 11C

    // Drag the window to 600 (worse). Capture the headline node to prove it is
    // NOT replaced (textContent changes on the same node = in-place update).
    const timeNode = el.querySelector('#res-time');
    const dragged = { startMin: 600, endMin: 645 };
    updateWindowStats(el, {
      window: dragged,
      wbgtPerMin: wbgtC, comfortPerMin: comfort, lengthMin: 45
    });
    expect(timeNode).toBe(el.querySelector('#res-time')); // same node, no re-render
    expect(el.querySelector('#res-time').textContent).toContain('10:00'); // 600 min
    expect(el.querySelector('#res-comfort').textContent).toContain('12/100');
    expect(el.querySelector('#res-wbgt').textContent).toContain('75.2'); // 24C
    // window object mutated by the update
    expect(dragged.startMin).toBe(600);
    expect(dragged.score).toBe(12);
  });
});
