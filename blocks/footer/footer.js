import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/* hosts that count as "this site" for links (no new tab) */
const SITE_HOSTS = ['www.rwjf.org', 'rwjf.org'];
const SECTION_ROLES = ['footer-top', 'footer-sitemap', 'footer-legal'];

function visuallyHidden(text) {
  const span = document.createElement('span');
  span.className = 'visually-hidden';
  span.textContent = text;
  return span;
}

/**
 * Turns :icon-name: notation left as plain text into icon spans (Edge Delivery does this for
 * documents; rich text from other sources may still carry the raw notation).
 * @param {Element} root
 */
function textIconsToSpans(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (/:[a-z0-9-]+:/.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    const parts = node.textContent.split(/:([a-z0-9-]+):/);
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2) {
        const span = document.createElement('span');
        span.className = `icon icon-${part}`;
        frag.append(span);
      } else if (part) frag.append(part);
    });
    node.replaceWith(frag);
  });
}

/**
 * Groups the default content of a section into columns: a new column starts at each H2,
 * content before the first H2 forms its own column.
 * @param {Element} wrapper default content wrapper
 */
function buildColumns(wrapper) {
  const columns = [];
  let column = null;
  [...wrapper.children].forEach((el) => {
    if (!column || el.tagName === 'H2') {
      column = document.createElement('div');
      column.className = 'footer-col';
      columns.push(column);
    }
    column.append(el);
  });
  wrapper.replaceChildren(...columns);
  return columns;
}

/** keeps the text of icon links for screen readers only */
function hideIconLinkText(link) {
  [...link.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.replaceWith(visuallyHidden(node.textContent.trim()));
    }
  });
}

function decorateTop(section) {
  const wrapper = section.querySelector('.default-content-wrapper');
  if (!wrapper) return;
  buildColumns(wrapper).forEach((col) => {
    const logo = col.querySelector('a .icon-rwjf-logo');
    if (logo && !col.querySelector('h2')) {
      col.classList.add('footer-logo');
      hideIconLinkText(logo.closest('a'));
    }
  });
  wrapper.querySelectorAll('ul').forEach((ul) => {
    const links = [...ul.querySelectorAll(':scope > li > a')];
    if (links.length && links.every((a) => a.querySelector('.icon'))) {
      ul.classList.add('footer-social');
      links.forEach(hideIconLinkText);
    }
  });
}

function decorateLegal(section) {
  const currentYear = String(new Date().getFullYear());
  section.querySelectorAll('p').forEach((p) => {
    const text = p.firstChild;
    if (!text || text.nodeType !== Node.TEXT_NODE) return;
    const match = /^\s*(©\s*\d{4}\s*[-–]\s*)(\d{4})\s*/.exec(text.textContent);
    if (!match) return;
    const years = document.createElement('span');
    years.className = 'footer-copyright-years';
    years.textContent = `${match[1]}${currentYear}`;
    text.textContent = text.textContent.slice(match[0].length);
    p.prepend(years, ' ');
    p.classList.add('footer-copyright');
  });
}

/** external links open in a new tab and say so to screen readers */
function decorateLinks(footer) {
  footer.querySelectorAll('a[href]').forEach((a) => {
    let url;
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return;
    }
    if (!/^https?:$/.test(url.protocol)) return;
    if (url.host === window.location.host || SITE_HOSTS.includes(url.hostname)) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.append(visuallyHidden(' (opens in a new window)'));
  });
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment?.firstElementChild) footer.append(fragment.firstElementChild);

  textIconsToSpans(footer);
  decorateIcons(footer);

  let role = 0;
  footer.querySelectorAll(':scope > .section').forEach((section) => {
    if (section.classList.contains('newsletter-placeholder')) {
      section.classList.add('footer-newsletter');
      return;
    }
    const name = SECTION_ROLES[role] || 'footer-extra';
    role += 1;
    section.classList.add(name);
    if (name === 'footer-top') decorateTop(section);
    if (name === 'footer-sitemap') {
      const wrapper = section.querySelector('.default-content-wrapper');
      if (wrapper) buildColumns(wrapper);
    }
    if (name === 'footer-legal') decorateLegal(section);
  });

  decorateLinks(footer);
  block.append(footer);
}
