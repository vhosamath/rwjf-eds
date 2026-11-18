/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the global nav fragment page (/nav).
 * Reads the desktop navigation in .cmp-experiencefragment--header on any rwjf.org page and writes
 * default content in three sections (the header block labels them in this order):
 *   1 nav-brand    logo link (:rwjf-logo-mark: icon + accessible text)
 *   2 nav-sections nested list: top items (links) with their sub-link lists, "... Overview" included
 *   3 nav-tools    "Find A Grant" (bold link) + "Search" link (target of the search form)
 * Links to rwjf.org pages become absolute https://www.rwjf.org/... (not migrated yet), except
 * pages that are already migrated (MIGRATED_PATHS), which stay relative.
 */

const SITE = 'https://www.rwjf.org';
const MIGRATED_PATHS = ['/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015'];
const SEARCH_RESULTS = '/en/search-results.html';

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function href(value) {
  if (!value || value === '#') return value;
  try {
    const url = new URL(value, SITE);
    if (!/(^|\.)rwjf\.org$/i.test(url.hostname) || /^my\./i.test(url.hostname)) return url.href;
    const path = url.pathname.replace(/\.html$/, '');
    if (MIGRATED_PATHS.includes(path)) return `${path}${url.search}${url.hash}`;
    return `${SITE}${url.pathname}${url.search}${url.hash}`;
  } catch (e) {
    return value;
  }
}

function link(document, url, text) {
  const a = document.createElement('a');
  a.setAttribute('href', href(url));
  a.textContent = text;
  return a;
}

function el(document, tag, ...children) {
  const node = document.createElement(tag);
  children.filter(Boolean).forEach((c) => node.append(c));
  return node;
}

export default {
  transform: ({ document }) => {
    const header = document.querySelector('.cmp-experiencefragment--header');
    const main = document.createElement('div');
    if (!header) return [{ element: main, path: '/nav', report: { error: 'header not found' } }];

    // the desktop navigation (not the mobile dialog copy, whose top links are "#")
    const nav = header.querySelector('nav.cmp-navigation');
    const content = nav.querySelector('.cmp-navigation__content') || nav;

    // 1 brand
    const logo = nav.querySelector('.cmp-navigation__header a');
    const brand = link(document, logo?.getAttribute('href') || `${SITE}/`, '');
    brand.append(':rwjf-logo-mark: Robert Wood Johnson Foundation');
    main.append(el(document, 'p', brand));

    // 2 sections
    main.append(document.createElement('hr'));
    const list = document.createElement('ul');
    content.querySelectorAll('.cmp-navigation__item').forEach((item) => {
      const top = item.querySelector(':scope > .cmp-navigation__item__header .cmp-navigation__item__link, :scope > .cmp-navigation__item__link');
      if (!top) return;
      const li = el(document, 'li', link(document, top.getAttribute('href'), clean(top.textContent)));
      const sub = document.createElement('ul');
      item.querySelectorAll('.cmp-navigation__item__link__sublink').forEach((a) => {
        const text = clean(a.textContent) || clean(a.getAttribute('aria-label')) || clean(a.getAttribute('title'));
        if (text) sub.append(el(document, 'li', link(document, a.getAttribute('href'), text)));
      });
      if (sub.children.length) li.append(sub);
      list.append(li);
    });
    main.append(list);

    // 3 tools
    main.append(document.createElement('hr'));
    const cta = content.querySelector('.cmp-navigation__item__link--highlighted');
    if (cta) main.append(el(document, 'p', el(document, 'strong', link(document, cta.getAttribute('href'), clean(cta.textContent)))));
    main.append(el(document, 'p', link(document, SEARCH_RESULTS, 'Search')));

    return [{ element: main, path: '/nav', report: { items: list.children.length } }];
  },
};
