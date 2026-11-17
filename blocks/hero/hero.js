import { getMetadata } from '../../scripts/aem.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO-like date (YYYY-MM-DD…) as MMM-DD-YYYY without timezone shifts.
 * Returns the raw value when it cannot be parsed.
 * @param {string} value
 * @returns {string}
 */
export function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName}-${day}-${year}` : value;
}

/**
 * Formats a read time value ("19" or "19-min read") as "19-min read".
 * @param {string} value
 * @returns {string}
 */
function formatReadTime(value) {
  if (!value) return '';
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${Math.round(Number(value))}-min read` : value;
}

function decorateArticle(block) {
  // the image row is optional for the article variant: drop it when empty
  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture, img')) row.classList.add('hero-empty');
  });

  const heading = block.querySelector('h1, h2');
  const byline = getMetadata('byline');
  const info = [
    ['content-type', getMetadata('content-type')],
    ['date', formatDate(getMetadata('publication-date'))],
    ['read-time', formatReadTime(getMetadata('read-time'))],
  ].filter(([, value]) => value);

  const fragment = document.createDocumentFragment();
  if (byline) {
    const p = document.createElement('p');
    p.className = 'hero-byline';
    p.textContent = byline;
    fragment.append(p);
  }
  if (info.length) {
    const p = document.createElement('p');
    p.className = 'hero-info';
    info.forEach(([type, value]) => {
      const span = document.createElement('span');
      span.className = `hero-info-${type}`;
      span.textContent = value;
      p.append(span);
    });
    fragment.append(p);
  }

  if (heading) heading.after(fragment);
  else block.lastElementChild?.prepend(fragment);

  block.querySelectorAll('a[href]').forEach((a) => {
    if (/\.pdf($|\?)/i.test(a.getAttribute('href'))) a.classList.add('hero-download');
  });
}

/**
 * loads and decorates the hero block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  if (block.classList.contains('article')) decorateArticle(block);
}
