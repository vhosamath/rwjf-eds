/* eslint-disable */
/* global WebImporter */

/**
 * Parser: hero-article -> "Hero (article)" block (model `hero`).
 *   row 1: field `image` (reference) — the article hero has no image, so the cell stays empty
 *   row 2: field `text` (richtext) — <h1> + <p><a>Download annual message</a></p>
 * Byline / content type / date / read time are page metadata (rwjf-metadata.js) and are NOT emitted.
 * The download button lives in the first column of the 3rd #main-content row; it is moved into the
 * hero (removed from its original place). PDF path rewrite to /content/dam/rwjf-eds/... is done by
 * rwjf-cleanup.js (afterTransform).
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const hero = element.matches('.cmp-hero') ? element : (element.querySelector('.cmp-hero') || element);
  const root = element.ownerDocument || document;

  // image (row 1): only if the hero actually carries a primary image
  const img = hero.querySelector('.cmp-hero__image--primary img, .cmp-hero__media-container img');
  const imageCell = document.createDocumentFragment();
  if (img && img.getAttribute('src')) {
    const image = document.createElement('img');
    image.setAttribute('src', img.getAttribute('src'));
    image.setAttribute('alt', img.getAttribute('alt') || '');
    imageCell.append(document.createComment(' field:image '), image);
  }

  // text (row 2)
  const textNodes = [];
  const h1Src = hero.querySelector('.cmp-hero__content-headings-heading h1, h1');
  if (h1Src && clean(h1Src.textContent)) {
    const h1 = document.createElement('h1');
    h1.textContent = clean(h1Src.textContent);
    textNodes.push(h1);
  }

  // download link: dedicated column first, then any PDF button in the main content
  const pdfSelector = 'a.cmp-button__link[href$=".pdf"]';
  let pdfLink = null;
  const row = root.querySelector('#main-content > div.column-control.responsivegrid:nth-of-type(3)');
  if (row) {
    const firstCol = row.querySelector('.column-control__col');
    pdfLink = (firstCol && firstCol.querySelector(pdfSelector)) || null;
  }
  if (!pdfLink) pdfLink = root.querySelector(`#main-content ${pdfSelector}`);
  if (pdfLink && !hero.contains(pdfLink)) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.setAttribute('href', pdfLink.getAttribute('href'));
    a.textContent = clean(pdfLink.textContent) || 'Download annual message';
    p.append(a);
    textNodes.push(p);
    // remove the original button (its AEM component wrapper) so it is not duplicated
    (pdfLink.closest('.button.aem-GridColumn') || pdfLink).remove();
  }

  const textCell = document.createDocumentFragment();
  if (textNodes.length) textCell.append(document.createComment(' field:text '), ...textNodes);

  const cells = [
    [imageCell.childNodes.length ? imageCell : ''],
    [textCell.childNodes.length ? textCell : ''],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero (article)', cells });
  element.replaceWith(block);
}
