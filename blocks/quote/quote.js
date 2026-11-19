import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Optional photo with caption (row 3: the media_image and media_caption fields), used by the
 * "image" style. An empty row (e.g. on quotes authored before these fields existed) is ignored.
 * @param {Element} mediaRow
 * @returns {HTMLElement|null}
 */
function buildMedia(mediaRow) {
  const picture = mediaRow?.querySelector('picture');
  if (!picture) return null;
  const cell = mediaRow.firstElementChild || mediaRow;
  const pictureBlock = [...cell.children].find((el) => el.contains(picture));
  const media = document.createElement('figure');
  media.className = 'quote-media';
  media.append(picture);
  pictureBlock?.remove();
  if (cell.textContent.trim()) {
    const caption = document.createElement('figcaption');
    caption.className = 'quote-caption';
    caption.append(...cell.childNodes);
    media.append(caption);
  }
  return media;
}

/**
 * loads and decorates the quote block
 * rows: quotation, attribution (optional), media: image + caption (optional)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [quotationRow, attributionRow, mediaRow] = [...block.children];
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

  const media = buildMedia(mediaRow);
  if (media) block.replaceChildren(media, figure);
  else block.replaceChildren(figure);
}
