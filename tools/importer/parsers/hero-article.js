/* eslint-disable */
/* global WebImporter */

/**
 * Parser: hero-article -> "Hero (article)" block (model `hero`).
 *   row 1: field `image` (reference) — the article hero has no image, so the cell stays empty
 *   row 2: field `text` (richtext) — <h1>
 * Byline / content type / date / read time are page metadata (rwjf-metadata.js) and are NOT emitted.
 * The "Download annual message" button stays in default content: rwjf-cleanup.js turns it into an
 * em-wrapped link at the start of the "intro" section (link left, heading + lead line right).
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

  const textCell = document.createDocumentFragment();
  if (textNodes.length) textCell.append(document.createComment(' field:text '), ...textNodes);

  const cells = [
    [imageCell.childNodes.length ? imageCell : ''],
    [textCell.childNodes.length ? textCell : ''],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero (article)', cells });
  element.replaceWith(block);
}
