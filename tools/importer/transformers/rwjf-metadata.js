/* eslint-disable */
/* global WebImporter */

/**
 * RWJF page-metadata capture transformer.
 *
 * The article hero (.cmp-hero) carries page metadata (byline, content type, date, read time) that is
 * NOT hero block content. The hero-article parser replaces the hero, so these values are captured in
 * beforeTransform (before parsers run) and stored as JSON on the transformed root element in
 * `data-rwjf-page-meta`. The import script then builds the Metadata block with
 * `createPageMetadata(main, document)` from tools/importer/utils/rwjf-page-metadata.js, which reads
 * (and removes) this attribute.
 *
 * Captured keys: byline, author, contentType, publicationDate (ISO yyyy-mm-dd), readTime (minutes).
 */

const ATTR = 'data-rwjf-page-meta';
const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
};

function text(root, selector) {
  const el = root.querySelector(selector);
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function toIsoDate(value) {
  if (!value) return '';
  // "Dec-13-2016" / "Dec 13, 2016"
  let m = value.match(/^([A-Za-z]{3,})[\s.-]+(\d{1,2}),?[\s.-]+(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[2].padStart(2, '0')}`;
  }
  // "13-Dec-2016"
  m = value.match(/^(\d{1,2})[\s.-]+([A-Za-z]{3,})[\s.-]+(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mm) return `${m[3]}-${mm}-${m[1].padStart(2, '0')}`;
  }
  // already ISO
  m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function toReadTime(value) {
  const m = (value || '').match(/(\d+)/);
  return m ? m[1] : '';
}

function toAuthor(byline) {
  if (!byline) return '';
  return byline
    .replace(/^\s*a\s+message\s+from\s+/i, '')
    .replace(/^\s*by\s+/i, '')
    .split(',')[0]
    .trim();
}

export default function transform(hookName, element, payload) {
  if (hookName !== 'beforeTransform') return;
  if (element.hasAttribute(ATTR)) return;
  const hero = element.querySelector('.cmp-hero') || element;

  const byline = text(hero, '.cmp-hero__content-headings-subhead');
  const meta = {
    byline,
    author: toAuthor(byline),
    contentType: text(hero, '.cmp-hero__content-headings-articleinfo-contenttype'),
    publicationDate: toIsoDate(text(hero, '.cmp-hero__content-headings-articleinfo-date')),
    readTime: toReadTime(text(hero, '.cmp-hero__content-headings-articleinfo-readtime')),
  };
  if (Object.values(meta).some(Boolean)) {
    element.setAttribute(ATTR, JSON.stringify(meta));
  }
}
