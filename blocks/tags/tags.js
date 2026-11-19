import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Turns the links in a container into a list of tag pills.
 * Used by the tags block and by other blocks that show tags (e.g. the cards teaser style).
 * @param {Element} container element holding the authored links (usually a list)
 * @param {string} [label] accessible name for the list
 * @returns {HTMLUListElement|null} the tag list, or null when there are no links
 */
export function decorateTags(container, label = 'Topics') {
  const links = [...container.querySelectorAll('a[href]')];
  if (!links.length) return null;
  const ul = document.createElement('ul');
  ul.className = 'tags-list';
  ul.setAttribute('aria-label', label);
  links.forEach((a) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = a.href;
    link.className = 'tags-link';
    link.textContent = a.textContent.trim();
    moveInstrumentation(a, link);
    li.append(link);
    ul.append(li);
  });
  moveInstrumentation(container, ul);
  container.replaceChildren(ul);
  return ul;
}

/**
 * loads and decorates the tags block
 * rows: tags (a list of links)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div') || block;
  const list = decorateTags(cell);
  if (list) block.replaceChildren(list);
  else block.closest('.tags-wrapper')?.remove();
}
