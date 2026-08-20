import { animate, createTimeline, stagger, utils } from 'animejs';

/* Text choreography. The name is split per character and lifted out of the
 * floor plane (rotateX) so the type reveal shares the room's sense of depth
 * instead of fighting it. Everything starts hidden via `html.js` rules in
 * global.css, so if this module never runs the page is still a working
 * contact card. */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const name = document.querySelector<HTMLElement>('.name');
const lines = utils.$('.lines a') as HTMLElement[];
const save = document.querySelector<HTMLElement>('.save');
const cue = document.querySelector<HTMLElement>('.scroll-cue');

/* ---------- split the name into characters ---------- */
const chars: HTMLElement[] = [];
if (name) {
  const text = (name.textContent ?? '').trim();
  name.setAttribute('aria-label', text);   // spans below are hidden from AT
  name.textContent = '';

  /* Characters are grouped inside per-word wrappers. Without this the
     inline-block chars become individual break opportunities and a long
     name splits mid-word ("Tamana / m"). */
  const words = text.split(/\s+/);
  words.forEach((word, wi) => {
    const wordEl = document.createElement("span");
    wordEl.className = "word";
    wordEl.setAttribute("aria-hidden", "true");

    for (const ch of Array.from(word)) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch;
      wordEl.appendChild(span);
      chars.push(span);
    }
    name.appendChild(wordEl);

    if (wi < words.length - 1) {
      const gap = document.createElement("span");
      gap.className = "space";
      gap.setAttribute("aria-hidden", "true");
      name.appendChild(gap);
    }
  });
}

if (reduce) {
  // No motion: just make everything visible and stop.
  utils.set([name, ...chars, ...lines, save, cue].filter(Boolean) as HTMLElement[], { opacity: 1 });
  utils.set(utils.$('.reveal') as HTMLElement[], { opacity: 1 });
} else {
  /* Hide the characters individually, THEN unhide their container, so the
     full name never flashes in before it has been split. */
  utils.set(chars, { opacity: 0, y: '0.45em', rotateX: -92 });
  if (name) name.style.opacity = '1';

  const tl = createTimeline({ defaults: { ease: 'out(3)' } });

  tl.add(chars, {
    opacity: [0, 1],
    y: ['0.45em', '0em'],
    rotateX: [-92, 0],
    duration: 1150,
    delay: stagger(38),
  }, 120);

  if (lines.length) {
    tl.add(lines, {
      opacity: [0, 1],
      y: ['1.1em', '0em'],
      duration: 820,
      delay: stagger(95),
    }, 640);
  }

  if (save) {
    tl.add(save, { opacity: [0, 1], y: [16, 0], scale: [0.965, 1], duration: 720 }, 1120);
  }

  if (cue) {
    tl.add(cue, { opacity: [0, 1], duration: 900 }, 1380);

    const bar = cue.querySelector('i');
    if (bar) {
      animate(bar, {
        scaleY: [0.35, 1],
        opacity: [0.3, 1],
        duration: 1800,
        loop: true,
        alternate: true,
        ease: 'inOut(2)',
      });
    }
  }

  /* ---------- the company section reveals as it comes into view ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      if (!shown.length) return;
      shown.forEach((el) => io.unobserve(el));
      animate(shown, {
        opacity: [0, 1],
        y: [26, 0],
        duration: 860,
        delay: stagger(70),
        ease: 'out(3)',
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
  );

  (utils.$('.reveal') as HTMLElement[]).forEach((el) => io.observe(el));
}
