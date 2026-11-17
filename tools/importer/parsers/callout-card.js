/* eslint-disable */
/* global WebImporter */

/**
 * Parser: callout-card -> "Callout (card)" block (model `callout`, element-grouped fields).
 *   row 1 (media):   media_image (+ alt -> media_imageAlt)            — empty when the card has no image
 *   row 2 (content): content_title as <h3> (titleType h3) + content_text <p>
 *   row 3 (cta):     cta_link as <p><a>label</a></p> (linkText collapses) + cta_dialog richtext
 * A "Watch the video" <button> opens a .cmp-modal with a YouTube video + text: it becomes a YouTube
 * watch link (the block JS opens it in a dialog) and the modal text becomes cta_dialog.
 * The modal markup itself is removed later by rwjf-cleanup.js (afterTransform).
 */
const USED_ATTR = 'data-callout-card-used';

function clean(s) {
  return (s || '').replace(/[\s ]+/g, ' ').trim();
}

function findModal(card, root, title) {
  const trigger = card.querySelector('[data-micromodal-trigger], [data-modal-trigger], [aria-controls]');
  const id = trigger && (trigger.getAttribute('data-micromodal-trigger')
    || trigger.getAttribute('data-modal-trigger') || trigger.getAttribute('aria-controls'));
  if (id) {
    const byId = root.getElementById(id);
    if (byId) return byId.closest('.cmp-modal') || byId;
  }
  const inside = card.querySelector('.cmp-modal');
  if (inside) return inside;
  const modals = Array.from(root.querySelectorAll('.cmp-modal')).filter((m) => !m.hasAttribute(USED_ATTR));
  const byTitle = modals.find((m) => clean(m.querySelector('.cmp-modal__title')?.textContent).toLowerCase() === title.toLowerCase());
  if (byTitle) return byTitle;
  // next unused modal following the card in document order
  return modals.find((m) => card.compareDocumentPosition(m) & 4 /* FOLLOWING */) || null;
}

function youtubeId(modal) {
  const el = modal.querySelector('iframe[src*="youtube"], [data-video-id], [data-youtube-id]');
  if (!el) return '';
  const direct = el.getAttribute('data-video-id') || el.getAttribute('data-youtube-id');
  if (direct) return direct;
  const m = (el.getAttribute('src') || '').match(/\/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : '';
}

export default function parse(element, { document }) {
  const root = element.ownerDocument || document;
  const card = element.querySelector('.cmp-news-floating-cta') || element;

  // row 1: media
  const media = document.createDocumentFragment();
  const srcImg = card.querySelector('.cmp-news-floating-cta__image img');
  if (srcImg && srcImg.getAttribute('src')) {
    const img = document.createElement('img');
    img.setAttribute('src', srcImg.getAttribute('src'));
    img.setAttribute('alt', clean(srcImg.getAttribute('alt')));
    media.append(document.createComment(' field:media_image '), img);
  }

  // row 2: content
  const content = document.createDocumentFragment();
  const title = clean(card.querySelector('.cmp-news-floating-cta__title')?.textContent);
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    content.append(document.createComment(' field:content_title '), h3);
  }
  const subhead = clean(card.querySelector('.cmp-news-floating-cta__subhead')?.textContent);
  if (subhead) {
    const p = document.createElement('p');
    p.textContent = subhead;
    content.append(document.createComment(' field:content_text '), p);
  }

  // row 3: cta
  const cta = document.createDocumentFragment();
  const action = card.querySelector('.cmp-news-floating-cta__actions a[href], .cmp-news-floating-cta__actions button');
  if (action) {
    const label = clean(action.textContent);
    let href = action.tagName === 'A' ? action.getAttribute('href') : '';
    let dialogNodes = [];
    if (action.tagName === 'BUTTON') {
      const modal = findModal(card, root, title);
      if (modal) {
        modal.setAttribute(USED_ATTR, 'true');
        const id = youtubeId(modal);
        if (id) href = `https://www.youtube.com/watch?v=${id}`;
        dialogNodes = Array.from(modal.querySelectorAll('.cmp-modal__content .cmp-text p'))
          .filter((p) => clean(p.textContent))
          .map((p) => {
            const copy = p.cloneNode(true);
            copy.querySelectorAll('a').forEach((a) => { a.textContent = clean(a.textContent); });
            return copy;
          });
      }
    }
    if (href && label) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = label;
      p.append(a);
      cta.append(document.createComment(' field:cta_link '), p);
    }
    if (dialogNodes.length) cta.append(document.createComment(' field:cta_dialog '), ...dialogNodes);
  }

  const cells = [
    [media.childNodes.length ? media : ''],
    [content.childNodes.length ? content : ''],
    [cta.childNodes.length ? cta : ''],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'Callout (card)', cells });
  element.replaceWith(block);
}
