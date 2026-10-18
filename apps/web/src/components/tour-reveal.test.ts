import { freshRevealMemory, revealStep, restoreTourUi } from './tour-reveal';
import type { TourStep } from '@/lib/tours';

function step(partial: Partial<TourStep> & Pick<TourStep, 'id' | 'reveal'>): TourStep {
  return {
    route: '/app/queue',
    title: partial.id,
    body: '',
    narrationId: partial.id,
    ...partial,
  };
}

describe('tour reveal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Element.prototype.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 80,
      height: 32,
      bottom: 32,
      right: 80,
      toJSON() {
        return {};
      },
    });
  });

  it('opens More once and does not press Offer prepaid', () => {
    const clicks: string[] = [];
    document.body.innerHTML = '<button id="more" data-tour-open="more" aria-expanded="false">More</button>';
    const more = document.getElementById('more') as HTMLButtonElement;
    more.addEventListener('click', () => {
      clicks.push('more');
      more.setAttribute('aria-expanded', more.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      if (more.getAttribute('aria-expanded') === 'true' && !document.getElementById('prepaid')) {
        const item = document.createElement('button');
        item.id = 'prepaid';
        item.setAttribute('data-tour', 'menu-prepaid');
        item.textContent = 'Offer prepaid';
        item.addEventListener('click', () => clicks.push('prepaid'));
        document.body.appendChild(item);
      }
    });
    const memory = freshRevealMemory();
    const current = step({ id: 'menu-prepaid', reveal: ['more'] });
    revealStep(current, false, memory);
    revealStep(current, false, memory);
    expect(clicks).toEqual(['more']);
    expect(document.getElementById('prepaid')).toBeTruthy();
  });

  it('presses the visible demo call and does not open More', () => {
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button id="more" data-tour-open="more" aria-expanded="false">More</button>
      <button id="call" data-tour="demo-call">Demo: in the real product, RTO Shield calls the buyer automatically.</button>
    `;
    document.getElementById('call')!.addEventListener('click', () => {
      clicks.push('call');
      const panel = document.createElement('section');
      panel.id = 'panel';
      panel.setAttribute('data-tour', 'call-panel');
      document.body.appendChild(panel);
    });
    document.getElementById('more')!.addEventListener('click', () => clicks.push('more'));
    const memory = freshRevealMemory();
    const current = step({ id: 'demo-call', reveal: ['call'] });
    revealStep(current, false, memory);
    revealStep(current, false, memory);
    expect(clicks).toEqual(['call']);
    expect(document.getElementById('panel')).toBeTruthy();
  });

  it('does not press Try one more call', () => {
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button id="more" data-tour-open="more" aria-expanded="false">More</button>
      <button id="extra" data-tour="try-one-more-call">Try one more call</button>
    `;
    document.getElementById('extra')!.addEventListener('click', () => clicks.push('extra'));
    document.getElementById('more')!.addEventListener('click', () => clicks.push('more'));
    revealStep(step({ id: 'try-one-more-call', reveal: [] }), false, freshRevealMemory());
    expect(clicks).toEqual([]);
  });

  it('opens the call panel from More and does not reopen the menu', () => {
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button id="more" data-tour-open="more" aria-expanded="true">More</button>
      <button id="call" data-tour="menu-call">Call the buyer</button>
    `;
    document.getElementById('call')!.addEventListener('click', () => {
      clicks.push('call');
      document.getElementById('call')!.remove();
      document.getElementById('more')!.setAttribute('aria-expanded', 'false');
      const panel = document.createElement('section');
      panel.id = 'panel';
      panel.setAttribute('data-tour', 'call-panel');
      document.body.appendChild(panel);
    });
    document.getElementById('more')!.addEventListener('click', () => clicks.push('more'));
    const memory = freshRevealMemory();
    const current = step({ id: 'call-panel', reveal: ['call'] });
    revealStep(current, false, memory);
    revealStep(current, false, memory);
    expect(clicks).toEqual(['call']);
    expect(document.getElementById('panel')).toBeTruthy();
    expect(document.getElementById('more')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes a menu, a call, and All open on restore', () => {
    const clicks: string[] = [];
    document.body.innerHTML = `
      <button id="language" data-tour-open="language" aria-expanded="true">Language</button>
      <button id="more" data-tour-open="more" aria-expanded="true">More</button>
      <button id="close-call" data-tour-close="call">Close</button>
      <button id="needs" data-tour-open="needs-action" aria-selected="false">Needs action</button>
    `;
    for (const id of ['language', 'more', 'close-call', 'needs']) {
      document.getElementById(id)!.addEventListener('click', () => clicks.push(id));
    }
    const memory = freshRevealMemory();
    memory.openedAll = true;
    restoreTourUi(memory);
    expect(clicks).toEqual(['language', 'close-call', 'more', 'needs']);
    expect(memory.openedAll).toBe(false);
  });
});
