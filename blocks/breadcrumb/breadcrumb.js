import { getMetadata } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const toTitle = (segment) => decodeURIComponent(segment)
  .replace(/\.html$/, '')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

async function fetchTitles() {
  try {
    const resp = await fetch(`${window.hlx?.codeBasePath || ''}/query-index.json`);
    if (!resp.ok) return {};
    const { data = [] } = await resp.json();
    return Object.fromEntries(data.map(({ path, title }) => [path, title]));
  } catch {
    return {};
  }
}

async function buildFromPath() {
  const segments = window.location.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const titles = await fetchTitles();
  const items = segments.map((segment, i) => {
    const path = `/${segments.slice(0, i + 1).join('/')}`;
    const isCurrent = i === segments.length - 1;
    const title = isCurrent
      ? (getMetadata('og:title') || document.title)
      : (titles[path] || toTitle(segment));
    return { title, href: isCurrent ? null : path };
  });
  // the language root (e.g. /en) is not shown in the trail
  if (items.length > 1 && /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0])) items.shift();
  return items;
}

/**
 * loads and decorates the breadcrumb block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const cell = block.querySelector(':scope > div > div') || block;
  const authored = [...cell.querySelectorAll('li')].map((li) => {
    const a = li.querySelector('a[href]');
    return { title: li.textContent.trim(), href: a ? a.getAttribute('href') : null };
  }).filter(({ title }) => title);

  const items = authored.length ? authored : await buildFromPath();

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  moveInstrumentation(cell, nav);
  const ol = document.createElement('ol');
  items.forEach(({ title, href }, i) => {
    const li = document.createElement('li');
    const isLast = i === items.length - 1;
    if (href && !isLast) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = title;
      li.append(a);
    } else {
      const span = document.createElement('span');
      span.textContent = title;
      if (isLast) span.setAttribute('aria-current', 'page');
      li.append(span);
    }
    ol.append(li);
  });
  nav.append(ol);
  block.replaceChildren(nav);
}
