import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the quote block
 * rows: quotation, attribution (optional)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [quotationRow, attributionRow] = [...block.children];
  const figure = document.createElement('figure');
  figure.className = 'quote-figure';

  const quotationCell = quotationRow?.firstElementChild || quotationRow;
  if (quotationCell) {
    const blockquote = document.createElement('blockquote');
    blockquote.className = 'quote-quotation';
    moveInstrumentation(quotationCell, blockquote);
    blockquote.append(...quotationCell.childNodes);
    figure.append(blockquote);
  }

  const attributionCell = attributionRow?.firstElementChild || attributionRow;
  if (attributionCell && attributionCell.textContent.trim()) {
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'quote-attribution';
    moveInstrumentation(attributionCell, figcaption);
    figcaption.append(...attributionCell.childNodes);
    figure.append(figcaption);
  }

  block.replaceChildren(figure);
}
