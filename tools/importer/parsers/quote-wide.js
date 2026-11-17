/* eslint-disable */
/* global WebImporter */

/**
 * Parser: quote-wide -> "Quote (wide)" block (model `quote`).
 *   row 1: field `quotation` (richtext) — paragraphs of blockquote.cmp-blockquote__quote
 *   row 2: field `attribution` (text) — .cmp-blockquote__attribution (+ title); empty cell when absent
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const quote = element.matches('.cmp-blockquote') ? element : (element.querySelector('.cmp-blockquote') || element);

  // quotation
  const quotation = document.createDocumentFragment();
  const bq = quote.querySelector('blockquote.cmp-blockquote__quote, blockquote');
  if (bq) {
    const paras = Array.from(bq.querySelectorAll(':scope > p')).filter((p) => clean(p.textContent));
    const nodes = paras.length ? paras : [];
    if (!nodes.length && clean(bq.textContent)) {
      const p = document.createElement('p');
      p.textContent = clean(bq.textContent);
      nodes.push(p);
    }
    if (nodes.length) quotation.append(document.createComment(' field:quotation '), ...nodes);
  }

  // attribution (plain text: name, optionally followed by title)
  const attrText = [
    clean(quote.querySelector('.cmp-blockquote__attribution')?.textContent),
    clean(quote.querySelector('.cmp-blockquote__title')?.textContent),
  ].filter(Boolean).join(', ');
  const attribution = document.createDocumentFragment();
  if (attrText) attribution.append(document.createComment(' field:attribution '), document.createTextNode(attrText));

  const cells = [
    [quotation.childNodes.length ? quotation : ''],
    [attribution.childNodes.length ? attribution : ''],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Quote (wide)', cells });
  element.replaceWith(block);
}
