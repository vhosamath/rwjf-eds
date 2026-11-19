import { getMetadata } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

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

/**
 * Article image + caption: rows are image, text, caption (caption is optional).
 * The picture and caption move into a figure under the title; their rows are left empty.
 * @param {Element} block
 * @returns {HTMLElement|null} the figure, or null when the block has no image
 */
function buildArticleFigure(block) {
  const [imageRow, , captionRow] = [...block.children];
  const picture = imageRow?.querySelector('picture');
  if (!picture) return null;

  const figure = document.createElement('figure');
  figure.className = 'hero-figure';
  figure.append(picture);
  const captionCell = captionRow?.firstElementChild;
  if (captionCell && captionCell.textContent.trim()) {
    const figcaption = document.createElement('figcaption');
    figcaption.className = 'hero-caption';
    moveInstrumentation(captionCell, figcaption);
    figcaption.append(...captionCell.childNodes);
    figure.append(figcaption);
  }
  return figure;
}

/**
 * The byline typed in the hero (field `text_byline`, in the same cell as the title).
 * On the author its paragraphs carry the field's editor attributes (grouped in a wrapper by
 * editor-support-rte.js, or not yet); on the published page they are the elements after the title.
 * The paragraphs are kept in place (so they stay editable) and get a `hero-byline` wrapper.
 * @param {Element} textCell
 * @param {Element|null} heading
 * @returns {Element|null}
 */
function decorateBylineField(textCell, heading) {
  if (!textCell) return null;
  const group = textCell.querySelector(':scope > [data-aue-prop="text_byline"]');
  if (group) {
    group.classList.add('hero-byline');
    return group;
  }
  let nodes = [...textCell.querySelectorAll(':scope > [data-richtext-prop="text_byline"]')];
  if (!nodes.length && heading && !textCell.querySelector('[data-aue-prop], [data-richtext-prop]')) {
    nodes = [];
    let next = heading.nextElementSibling;
    while (next) {
      if (next.textContent.trim() && !next.querySelector('a.hero-download, a[href$=".pdf"]')) nodes.push(next);
      next = next.nextElementSibling;
    }
  }
  if (!nodes.length) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-byline';
  nodes[0].before(wrapper);
  wrapper.append(...nodes);
  return wrapper;
}

/** byline from the page properties (" | " is a line break) */
function buildBylineFromPage(byline) {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-byline';
  const p = document.createElement('p');
  byline.split(/\s+\|\s+/).forEach((line, i) => {
    if (i) p.append(document.createElement('br'));
    p.append(line);
  });
  wrapper.append(p);
  return wrapper;
}

/**
 * On the author, values that come from the page properties open the page properties when clicked
 * (Universal Editor selects the page's jcr:content with the page-metadata model).
 * @param {Element} block
 * @param {Element} element
 */
function instrumentAsPage(block, element) {
  const resource = block.dataset.aueResource || block.closest('[data-aue-resource]')?.dataset.aueResource;
  const page = resource && /^(urn:aemconnection:.+?\/jcr:content)(\/|$)/.exec(resource)?.[1];
  if (!page) return;
  element.dataset.aueResource = page;
  element.dataset.aueType = 'component';
  element.dataset.aueModel = 'page-metadata';
  element.dataset.aueLabel = 'Page properties';
}

function row(className, ...children) {
  const div = document.createElement('div');
  div.className = className;
  div.append(...children);
  return div;
}

/**
 * Article header. The title cell keeps only what the author typed (title + byline field), so both
 * can be edited in place; the page-property byline, the info line and the image + caption are
 * rows of their own after it.
 * @param {Element} block
 */
function decorateArticle(block) {
  const [, textRow] = [...block.children];
  const textCell = textRow?.firstElementChild;
  const figure = buildArticleFigure(block);
  const heading = block.querySelector('h1, h2');
  const bylineField = decorateBylineField(textCell, heading);

  // the image, caption and other empty rows are optional for the article variant: hide them
  [...block.children].forEach((r) => {
    if (!r.textContent.trim() && !r.querySelector('picture, img')) r.classList.add('hero-empty');
  });

  const pageByline = !bylineField && getMetadata('byline');
  const info = [
    ['content-type', getMetadata('content-type')],
    ['date', formatDate(getMetadata('publication-date'))],
    ['read-time', formatReadTime(getMetadata('read-time'))],
  ].filter(([, value]) => value);

  const rows = [];
  if (pageByline || info.length) {
    const meta = row('hero-meta');
    if (pageByline) meta.append(buildBylineFromPage(pageByline));
    if (info.length) {
      const p = document.createElement('p');
      p.className = 'hero-info';
      info.forEach(([type, value]) => {
        const span = document.createElement('span');
        span.className = `hero-info-${type}`;
        span.textContent = value;
        p.append(span);
      });
      meta.append(p);
    }
    instrumentAsPage(block, meta);
    rows.push(meta);
  }
  if (figure) rows.push(row('hero-media', figure));

  const anchor = textRow && !textRow.classList.contains('hero-empty') ? textRow : null;
  if (anchor) anchor.after(...rows);
  else block.append(...rows);

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
