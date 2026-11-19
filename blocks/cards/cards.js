import { createOptimizedPicture, loadCSS } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { decorateTags } from '../tags/tags.js';

/**
 * teaser style: eyebrow, linked title (the link covers the whole card), description, tag pills
 * @param {HTMLLIElement} li
 */
function decorateTeaser(li) {
  const body = li.querySelector('.cards-card-body');
  const heading = body?.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.classList.add('cards-card-title');
    let prev = heading.previousElementSibling;
    while (prev) {
      prev.classList.add('cards-card-eyebrow');
      prev = prev.previousElementSibling;
    }
    const link = heading.querySelector('a[href]');
    if (link) {
      link.classList.add('cards-card-link');
      li.classList.add('cards-card-linked');
    }
  }
  const tags = li.querySelector('.cards-card-tags');
  if (tags && !decorateTags(tags)) tags.remove();
}

export default async function decorate(block) {
  const isTeaser = block.classList.contains('teaser');
  if (isTeaser) loadCSS(`${window.hlx.codeBasePath}/blocks/tags/tags.css`);

  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div, i) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else if (i === 2) div.className = 'cards-card-tags';
      else div.className = 'cards-card-body';
      // optional fields left empty (e.g. no tags) leave an empty cell behind
      if (!div.textContent.trim() && !div.querySelector('picture, img')) div.remove();
    });
    if (isTeaser) decorateTeaser(li);
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.replaceChildren(ul);
}
