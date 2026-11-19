import { getMetadata } from '../../scripts/aem.js';

/* RWJF share bar: X, Facebook, email, LinkedIn, print. Tracking codes as on rwjf.org. */
const NETWORKS = {
  x: {
    label: 'Share on X',
    cid: 'xsh_rwjf_tw',
    href: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  facebook: {
    label: 'Share on Facebook',
    cid: 'xsh_rwjf_fb',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  email: {
    label: 'Share by email',
    cid: 'xsh_rwjf_em',
    href: (url, text) => `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`,
  },
  linkedin: {
    label: 'Share on LinkedIn',
    cid: 'xsh_rwjf_li',
    href: (url, text) => `https://www.linkedin.com/feed/?shareActive=true&mini=true&text=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
  print: { label: 'Print this page' },
};

// above this width the bar sits in the page margin, right of the 1200px content
const DESKTOP = '(width >= 1340px)';

function pageUrl(cid) {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const url = new URL(canonical || `${window.location.origin}${window.location.pathname}`);
  if (cid) url.searchParams.set('cid', cid);
  return url.href;
}

function readConfig(block) {
  const [textRow, networksRow] = [...block.children];
  const text = textRow?.textContent.trim()
    || getMetadata('description') || document.title;
  const names = (networksRow?.textContent || '').split(',')
    .map((n) => n.trim().toLowerCase()).filter((n) => NETWORKS[n]);
  return { text, networks: names.length ? names : Object.keys(NETWORKS) };
}

function buildItem(name, text) {
  const network = NETWORKS[name];
  const li = document.createElement('li');
  let control;
  if (name === 'print') {
    control = document.createElement('button');
    control.type = 'button';
    control.addEventListener('click', () => window.print());
  } else {
    control = document.createElement('a');
    control.href = network.href(pageUrl(network.cid), text);
    if (name !== 'email') {
      control.target = '_blank';
      control.rel = 'noopener noreferrer';
    }
  }
  control.className = `share-link share-${name}`;
  control.setAttribute('aria-label', name === 'print' || name === 'email' ? network.label : `${network.label} (opens in a new window)`);
  control.title = network.label;
  const icon = document.createElement('span');
  icon.className = 'share-icon';
  icon.setAttribute('aria-hidden', 'true');
  control.append(icon);
  li.append(control);
  return li;
}

/**
 * Below the desktop width the bar moves to the end of the page content (as on the source),
 * on desktop it goes back to its authored place, where it sticks beside the article.
 * @param {Element} section
 */
function placeSection(section) {
  const main = section.closest('main');
  if (!main) return;
  const marker = document.createComment('share');
  section.before(marker);
  const mq = window.matchMedia(DESKTOP);
  // desktop: the section is the bar's sticky track, from its place to the end of the page content
  const sizeTrack = () => {
    if (!mq.matches) return;
    const track = main.getBoundingClientRect().bottom - section.getBoundingClientRect().top;
    section.style.setProperty('--share-track', `${Math.max(0, Math.round(track))}px`);
  };
  const place = () => {
    if (mq.matches) {
      marker.after(section);
      sizeTrack();
    } else {
      section.style.removeProperty('--share-track');
      main.append(section);
    }
  };
  mq.addEventListener('change', place);
  // the page grows as sections, images and fragments load
  new ResizeObserver(sizeTrack).observe(main);
  place();
}

/**
 * loads and decorates the share block
 * rows: text (share message, optional), networks (optional, comma separated)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const { text, networks } = readConfig(block);

  const listId = `share-list-${Math.random().toString(36).slice(2, 8)}`;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'share-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', listId);
  toggle.innerHTML = '<span>Share</span><span class="share-toggle-icon" aria-hidden="true"></span>';

  const list = document.createElement('ul');
  list.className = 'share-list';
  list.id = listId;
  networks.forEach((name) => list.append(buildItem(name, text)));

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
  });

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Share this page');
  nav.append(toggle, list);
  block.replaceChildren(nav);

  const section = block.closest('.section');
  if (section) placeSection(section);
}
