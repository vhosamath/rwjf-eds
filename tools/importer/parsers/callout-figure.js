/* eslint-disable */
/* global WebImporter */

/**
 * Parser: callout-figure -> "Callout (figure)" block (model `callout`, element-grouped fields).
 *   row 1 (media):   media_image (.cmp-image__image + alt -> media_imageAlt)
 *   row 2 (content): content_title <h3> from the caption heading (an <h4>, or a
 *                    <p><span class="heading4-style">…</span></p>) + content_text (remaining caption <p>s)
 *   row 3 (cta):     empty (figures have no link)
 * Stray span.p2 wrappers are unwrapped later by rwjf-cleanup.js (afterTransform).
 */
function clean(s) {
  return (s || '').replace(/[\s ]+/g, ' ').trim();
}

function isHeadingParagraph(p) {
  const kids = Array.from(p.children);
  return kids.length === 1
    && /(^|\s)heading\d-style(\s|$)/.test(kids[0].getAttribute('class') || '')
    && clean(kids[0].textContent) === clean(p.textContent);
}

export default function parse(element, { document }) {
  const figure = element.matches('.cmp-image') ? element : (element.querySelector('.cmp-image') || element);

  // row 1: media
  const media = document.createDocumentFragment();
  const srcImg = figure.querySelector('img.cmp-image__image, img');
  if (srcImg && srcImg.getAttribute('src')) {
    const img = document.createElement('img');
    img.setAttribute('src', srcImg.getAttribute('src'));
    img.setAttribute('alt', clean(srcImg.getAttribute('alt')));
    media.append(document.createComment(' field:media_image '), img);
  }

  // row 2: content (caption)
  const caption = figure.querySelector('.cmp-image__title');
  let title = '';
  const paras = [];
  if (caption) {
    const heading = caption.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) title = clean(heading.textContent);
    caption.querySelectorAll('p').forEach((p) => {
      if (!clean(p.textContent)) return;
      if (!title && isHeadingParagraph(p)) {
        title = clean(p.textContent);
        return;
      }
      const copy = document.createElement('p');
      copy.innerHTML = p.innerHTML.trim();
      paras.push(copy);
    });
  }

  const content = document.createDocumentFragment();
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    content.append(document.createComment(' field:content_title '), h3);
  }
  if (paras.length) content.append(document.createComment(' field:content_text '), ...paras);

  const cells = [
    [media.childNodes.length ? media : ''],
    [content.childNodes.length ? content : ''],
    [''],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Callout (figure)', cells });
  element.replaceWith(block);
}
