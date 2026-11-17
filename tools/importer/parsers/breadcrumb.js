/* eslint-disable */
/* global WebImporter */

/**
 * Parser: breadcrumb -> "Breadcrumb" block (model `breadcrumb`, 1 row: field `items` richtext).
 * Source: nav.cmp-breadcrumb > ol.cmp-breadcrumb__list > li.cmp-breadcrumb__item
 * Output: <ol> with one <li><a> per parent page; the active (current) item is plain text.
 * Relative hrefs are absolutized to https://www.rwjf.org by rwjf-cleanup.js (afterTransform).
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const nav = element.matches('.cmp-breadcrumb') ? element : (element.querySelector('.cmp-breadcrumb') || element);

  const ol = document.createElement('ol');
  nav.querySelectorAll('li.cmp-breadcrumb__item').forEach((item) => {
    const label = clean(item.textContent);
    if (!label) return;
    const li = document.createElement('li');
    const link = item.querySelector('a[href]');
    if (link && !item.classList.contains('cmp-breadcrumb__item--active')) {
      const a = document.createElement('a');
      a.setAttribute('href', link.getAttribute('href'));
      a.textContent = label;
      li.append(a);
    } else {
      li.textContent = label;
    }
    ol.append(li);
  });

  const cells = [];
  if (ol.children.length) {
    const cell = document.createDocumentFragment();
    cell.append(document.createComment(' field:items '), ol);
    cells.push([cell]);
  } else {
    cells.push(['']);
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'Breadcrumb', cells });
  element.replaceWith(block);
}
