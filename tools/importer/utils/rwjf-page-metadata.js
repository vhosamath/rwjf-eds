/* eslint-disable */
/* global WebImporter */

/**
 * RWJF page Metadata block helper for the import scripts.
 *
 * Call it in the import script INSTEAD of `WebImporter.rules.createMetadata(main, document)`:
 *
 *   import { createPageMetadata } from './utils/rwjf-page-metadata.js';
 *   ...
 *   main.appendChild(document.createElement('hr'));
 *   createPageMetadata(main, document, { template: 'article' });
 *
 * Hero-derived values (byline, author, content type, publication date, read time) are captured
 * before parsing by tools/importer/transformers/rwjf-metadata.js (stored in `data-rwjf-page-meta`
 * on the transformed root); the helper falls back to reading the hero DOM if it is still present.
 */

const ATTR = 'data-rwjf-page-meta';

function metaContent(document, ...names) {
  for (let i = 0; i < names.length; i += 1) {
    const n = names[i];
    const el = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
    const v = el && (el.getAttribute('content') || '').trim();
    if (v) return v;
  }
  return '';
}

/** Scene7 social image -> base asset URL (no ":Facebook" preset, no query). */
function cleanSocialImage(url) {
  if (!url) return '';
  let u = url.trim();
  if (u.startsWith('//')) u = `https:${u}`;
  u = u.split('?')[0];
  if (/\/is\/image\//.test(u)) u = u.replace(/:[A-Za-z0-9_-]+$/, '');
  return u;
}

function readCaptured(main, document) {
  const holders = [main, document.body].filter(Boolean);
  for (let i = 0; i < holders.length; i += 1) {
    const raw = holders[i].getAttribute(ATTR);
    if (raw) {
      holders.forEach((h) => h.removeAttribute(ATTR));
      try { return JSON.parse(raw); } catch (e) { return {}; }
    }
  }
  return null;
}

function readHeroFallback(document) {
  const t = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const byline = t('.cmp-hero__content-headings-subhead');
  const date = t('.cmp-hero__content-headings-articleinfo-date');
  const dm = date.match(/^([A-Za-z]{3})[A-Za-z]*[\s.-]+(\d{1,2}),?[\s.-]+(\d{4})$/);
  const rt = t('.cmp-hero__content-headings-articleinfo-readtime').match(/(\d+)/);
  return {
    byline,
    author: byline.replace(/^\s*a\s+message\s+from\s+/i, '').split(',')[0].trim(),
    contentType: t('.cmp-hero__content-headings-articleinfo-contenttype'),
    publicationDate: dm && months[dm[1].toLowerCase()] ? `${dm[3]}-${months[dm[1].toLowerCase()]}-${dm[2].padStart(2, '0')}` : '',
    readTime: rt ? rt[1] : '',
  };
}

export function buildPageMetadata(main, document, options = {}) {
  const captured = readCaptured(main, document) || readHeroFallback(document);
  const docTitle = (document.title || '').replace(/\s*\|\s*RWJF\s*$/i, '').trim();

  // keys other than Title/Description must match the page-metadata model field names exactly:
  // the xwalk converter (md2jcr) matches them case-sensitively
  const meta = {};
  const title = metaContent(document, 'og:title', 'twitter:title') || docTitle;
  if (title) meta.Title = title;
  const description = metaContent(document, 'description', 'og:description', 'twitter:description');
  if (description) meta.Description = description;
  const keywords = metaContent(document, 'keywords');
  if (keywords) meta.keywords = keywords;
  meta.template = options.template || 'article';

  const image = cleanSocialImage(metaContent(document, 'og:image', 'twitter:image'));
  if (image) {
    const img = document.createElement('img');
    img.setAttribute('src', image);
    meta.image = img;
  }

  if (captured.byline) meta.byline = captured.byline;
  if (captured.author) meta.author = captured.author;
  if (captured.contentType) meta['content-type'] = captured.contentType;
  if (captured.publicationDate) meta['publication-date'] = captured.publicationDate;
  if (captured.readTime) meta['read-time'] = captured.readTime;

  return meta;
}

export function createPageMetadata(main, document, options = {}) {
  const meta = buildPageMetadata(main, document, options);
  const block = WebImporter.Blocks.getMetadataBlock(document, meta);
  main.append(block);
  return meta;
}

export default createPageMetadata;
