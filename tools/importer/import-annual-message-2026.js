/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the 2026 RWJF annual message:
 *   https://www.rwjf.org/en/about-rwjf/our-guiding-principles/annual-messages/answering-the-call-for-a-healthy-inclusive-democracy.html
 *
 * The page uses newer rwjf.org markup than the 2015 message (hero style C with an image, blockquote
 * with photo, YouTube component, Instagram embeds, custom cards, card column control), so it has its
 * own script. Shared transformers do the cleanup (chrome, links -> https://www.rwjf.org/..., styling
 * spans) and the Scene7 image normalisation.
 *
 * Output 1 — the article, in sections:
 *    hero (article, byline-large) | share | text | aside: text + callout (figure) | text | quote (wide, image)
 *    | text | three-up: embed x3 (Instagram, with placeholder images) | text
 *    | aside-wide: text + callout (figure, YouTube) | text | aside-wide: text + cards (teaser, 1)
 *    | text + signature | H2 Related Content + cards (teaser, 2) | fragment (/fragments/about-rwjf)
 *    | metadata
 * Output 2 — /fragments/about-rwjf: the "About the Robert Wood Johnson Foundation" boilerplate.
 */

import cleanupTransformer from './transformers/rwjf-cleanup.js';
import dmImagesTransformer from './transformers/rwjf-dm-images.js';
import { buildPageMetadata } from './utils/rwjf-page-metadata.js';

const FRAGMENT_PATH = '/fragments/about-rwjf';
const ANNUAL_MESSAGE = 'RWJF Annual Message';

// text that starts a right-rail section (the rail block that follows closes it)
const ASIDE_STARTS = [
  ['America was born', 'aside'],
  ['RWJF grantees have always', 'aside-wide'],
  ['Our past lives', 'aside-wide'],
];
// headings that start a new plain section
const SECTION_STARTS = ['Related Content'];

// Instagram placeholders: the posts' first image (the embed only loads when the visitor clicks)
const INSTAGRAM = {
  DS7wkO2ErUG: { alt: 'Instagram post shared by @nilc: 2025 our resistance, in numbers', src: 'https://scontent-iad3-2.cdninstagram.com/v/t51.82787-15/608654994_18344180122228870_2553262164746751185_n.jpg?stp=dst-jpg_e35_p480x480_sh2.08_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ig_cache_key=Mzc5OTg0NDE2MjY0MTIwMjA2MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=qqOKZnGkQvwQ7kNvwHDhtaU&_nc_oc=AdofDR3cIhCKsdpREUWMqPRKcwxpFNdRiuTWPIr7yevBoGGAvRIpjwSpoD_jFwLsETA&_nc_zt=23&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_gid=QTWCkK4y8btp5J2dz-w3CA&_nc_ss=79689&_nc_ct=RQosPBUIFQIlBAAAAA&oh=00_AQR2d2_jL-2HPwzWXe1ZxKw7qJbRaJQ_0Ol7OuFbmP0THQ&oe=6B051283' },
  DTiYPWzjbSD: { alt: 'Instagram post shared by @womensfndnmn', src: 'https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/616785161_18397371730197725_338786602695340369_n.jpg?stp=dst-jpg_e35_p480x480_sh2.08_tt6&_nc_cat=102&_nc_map=urlgen_bucketless&ig_cache_key=MzgxMDcxNDg0MzEwNDUyMzM5NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=seIXcGfcRRwQ7kNvwEDGN0e&_nc_oc=AdpLnMvLr7vh1GACAWkDn3FTpwOQ2oXfdSqxUXxMyIzHfD72x1HciRbZePRI9TdAO4I&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_gid=34q5rk-MKauTAR-nFsFzhw&_nc_ss=79689&_nc_ct=RQosPBUIFQIlBAAAAA&oh=00_AQREp7ioTJN-wh4jpz66K_a_Hy9kRV6uyooQMjDUb6yNtQ&oe=6B050916' },
  DJHn69tTFiB: { alt: 'Instagram post shared by @chicagowomenintrades', src: 'https://scontent-iad3-1.cdninstagram.com/v/t51.75761-15/494895965_18304170655209222_3374000742020993411_n.jpg?stp=dst-jpg_e35_s480x480_sh2.08_tt6&_nc_cat=105&_nc_map=urlgen_bucketless&ig_cache_key=MzYyMzA0MDAwMTA0NDY2NjQ5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=OmTpDMuNoloQ7kNvwGCbsoj&_nc_oc=AdokmFBEWsA0vJgYooFLvizMUeoEbyonulCFGnY6ZwiwAkAJ0A7fmir7qKwP8K-fpjo&_nc_zt=23&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_gid=AtddnaGzqzZ5bpz97KOfKw&_nc_ss=79689&_nc_ct=RQosPBUIFQIlBAAAAA&oh=00_AQS8QJfPk36XgAWOmVuy457rBaSr4951v3CTIoDta6uVyA&oe=6B052A4E' },
};

const clean = (s) => (s || '').replace(/[\s ]+/g, ' ').trim();

function el(document, tag, ...children) {
  const node = document.createElement(tag);
  children.filter((c) => c !== null && c !== undefined && c !== '').forEach((c) => node.append(c));
  return node;
}

function hint(document, name) {
  return document.createComment(` field:${name} `);
}

function image(document, src, alt) {
  const img = document.createElement('img');
  img.setAttribute('src', src);
  img.setAttribute('alt', clean(alt));
  return img;
}

function frag(document, ...nodes) {
  const f = document.createDocumentFragment();
  nodes.filter(Boolean).forEach((n) => f.append(n));
  return f.childNodes.length ? f : '';
}

/** rich text copy of a source paragraph: <b>/<i> -> <strong>/<em>, empty anchors dropped */
function copyInline(document, src) {
  const out = src.cloneNode(true);
  out.querySelectorAll('a:not([href])').forEach((a) => a.replaceWith(...a.childNodes));
  out.querySelectorAll('b').forEach((b) => { const s = document.createElement('strong'); s.append(...b.childNodes); b.replaceWith(s); });
  out.querySelectorAll('i').forEach((i) => { const e = document.createElement('em'); e.append(...i.childNodes); i.replaceWith(e); });
  out.querySelectorAll('br').forEach((br) => { if (!br.nextSibling || !clean(br.nextSibling.textContent)) br.remove(); });
  out.removeAttribute('class');
  return out;
}

/** a source .cmp-text child -> default content node (or null) */
function textNode(document, child, state) {
  const text = clean(child.textContent);
  if (!text) return null;
  const styled = child.querySelector('.heading3-style, .heading4-style');
  if (child.tagName === 'P' && styled && clean(styled.textContent) === text) {
    return el(document, styled.classList.contains('heading3-style') ? 'h2' : 'h3', text);
  }
  if (/^H[1-6]$/.test(child.tagName)) {
    // the H4 lead line under the hero becomes an H3 (styled like the source H4)
    const level = child.tagName === 'H4' && !state.leadDone ? 'h3' : child.tagName.toLowerCase();
    state.leadDone = true;
    return el(document, level, text);
  }
  return copyInline(document, child);
}

/* ------------------------------------------------------------------ blocks */

// The source page has no breadcrumb; the migrated page gets the same trail as the 2015 message
// (parent pages link to www.rwjf.org until they are migrated; the last item is this page)
const BREADCRUMB = [
  ['About RWJF', 'https://www.rwjf.org/en/about-rwjf.html'],
  ['Our Guiding Principles', 'https://www.rwjf.org/en/about-rwjf/our-guiding-principles.html'],
  ['Annual Messages', 'https://www.rwjf.org/en/about-rwjf/our-guiding-principles/annual-messages.html'],
];

function breadcrumbBlock(document, title) {
  const items = BREADCRUMB.map(([text, href]) => {
    const a = el(document, 'a', text);
    a.setAttribute('href', href);
    return el(document, 'li', a);
  });
  const ol = el(document, 'ol', ...items, el(document, 'li', title));
  return WebImporter.Blocks.createBlock(document, { name: 'Breadcrumb', cells: [[frag(document, hint(document, 'items'), ol)]] });
}

function heroBlock(document, hero) {
  const h1 = clean(hero.querySelector('h1')?.textContent);
  const img = hero.querySelector('.cmp-hero__image--primary img');
  const caption = hero.querySelector('.cmp-hero__caption .cmp-image__title p, .cmp-hero__image--primary .cmp-image__title p');
  // byline field (its own cell, after the caption; edited in place): the second line of the
  // source title block, keeping its line break
  const bylineSrc = [...hero.querySelectorAll('.cmp-hero__content-headings-heading p')].find((p) => clean(p.textContent));
  const bylineLines = bylineSrc ? bylineSrc.innerHTML.split(/<br\s*\/?>/i).map((l) => clean(l.replace(/<[^>]+>/g, ''))).filter(Boolean) : [];
  const byline = bylineLines.length ? el(document, 'p') : null;
  bylineLines.forEach((line, i) => {
    if (i) byline.append(document.createElement('br'));
    byline.append(line);
  });
  const cells = [
    [img ? frag(document, hint(document, 'image'), image(document, img.getAttribute('src'), img.getAttribute('alt'))) : ''],
    [frag(document, hint(document, 'text'), el(document, 'h1', h1))],
    [caption ? frag(document, hint(document, 'caption'), copyInline(document, caption)) : ''],
    [byline ? frag(document, hint(document, 'byline'), byline) : ''],
  ];
  return WebImporter.Blocks.createBlock(document, { name: 'Hero (article, byline-large)', cells });
}

function shareBlock(document) {
  const text = document.querySelector('meta[name="socialText"]')?.getAttribute('content') || '';
  return WebImporter.Blocks.createBlock(document, {
    name: 'Share',
    cells: [[text ? frag(document, hint(document, 'text'), document.createTextNode(clean(text))) : ''], ['']],
  });
}

function figureBlock(document, cmpImage) {
  const img = cmpImage.querySelector('img');
  const caption = cmpImage.querySelector('.cmp-image__title p');
  return WebImporter.Blocks.createBlock(document, {
    name: 'Callout (figure)',
    cells: [
      [frag(document, hint(document, 'media_image'), image(document, img.getAttribute('src'), img.getAttribute('alt')))],
      [caption ? frag(document, hint(document, 'content_text'), copyInline(document, caption)) : ''],
      [''],
    ],
  });
}

function videoBlock(document, video) {
  const id = video.querySelector('[data-youtube-id]')?.getAttribute('data-youtube-id')
    || video.querySelector('[data-video-id]')?.getAttribute('data-video-id');
  const caption = clean(video.querySelector('.yt-video-component__caption')?.textContent);
  const title = caption || clean(video.querySelector('iframe')?.getAttribute('title'));
  const link = el(document, 'a', 'Watch the video');
  link.setAttribute('href', `https://www.youtube.com/watch?v=${id}`);
  return WebImporter.Blocks.createBlock(document, {
    name: 'Callout (figure)',
    cells: [
      [frag(document, hint(document, 'media_image'), image(document, `https://i.ytimg.com/vi/${id}/maxres1.jpg`, `Video: ${title}`))],
      [caption ? frag(document, hint(document, 'content_text'), el(document, 'p', caption)) : ''],
      [frag(document, hint(document, 'cta_link'), el(document, 'p', link))],
    ],
  });
}

function quoteBlock(document, quote) {
  const quotation = [...quote.querySelectorAll('.cmp-blockquote__quote p')].filter((p) => clean(p.textContent)).map((p) => copyInline(document, p));
  // one attribution line per person ("—A, title, and B, title" -> "—A, title" / "B, title")
  const attr = clean(quote.querySelector('.cmp-blockquote__attribution')?.textContent);
  const lines = attr ? attr.split(/,\s+and\s+(?=[A-Z])/).map((l) => el(document, 'p', l.trim())) : [];
  const img = quote.querySelector('.cmp-blockquote__img img');
  const caption = quote.querySelector('.cmp-blockquote__img .cmp-image__title p');
  return WebImporter.Blocks.createBlock(document, {
    name: 'Quote (wide, image)',
    cells: [
      [frag(document, hint(document, 'quotation'), ...quotation)],
      [lines.length ? frag(document, hint(document, 'attribution'), ...lines) : ''],
      [img ? frag(document, hint(document, 'media_image'), image(document, img.getAttribute('src'), img.getAttribute('alt')),
        caption ? hint(document, 'media_caption') : null, caption ? copyInline(document, caption) : null) : ''],
    ],
  });
}

function embedBlock(document, embed) {
  // the post URL: the blockquote permalink, or (once Instagram's script ran) the iframe / a post link
  const permalink = embed.querySelector('.instagram-media')?.getAttribute('data-instgrm-permalink')
    || embed.querySelector('iframe[src*="instagram.com"]')?.getAttribute('src')
    || embed.querySelector('a[href*="instagram.com/p/"]')?.getAttribute('href') || '';
  // fallback: the posts in page order (the import browser may strip the embed markup)
  const index = [...document.querySelectorAll('.embedinteractive')].indexOf(embed);
  const id = /\/p\/([\w-]+)/.exec(permalink)?.[1] || Object.keys(INSTAGRAM)[index];
  const url = `https://www.instagram.com/p/${id}/`;
  const ph = INSTAGRAM[id] || {};
  const link = el(document, 'a', url);
  link.setAttribute('href', url);
  return WebImporter.Blocks.createBlock(document, {
    name: 'Embed',
    cells: [[frag(document,
      ph.src ? hint(document, 'embed_placeholder') : null,
      ph.src ? image(document, ph.src, ph.alt) : null,
      hint(document, 'embed_uri'),
      el(document, 'p', link))]],
  });
}

function cardRow(document, card) {
  const img = card.querySelector('.cmp-customcard__image img');
  const href = card.getAttribute('data-link') || card.querySelector('a[href]')?.getAttribute('href');
  const eyebrow = clean(card.querySelector('.cmp-customcard__eyebrow')?.textContent);
  const title = clean(card.querySelector('.card-heading-title')?.textContent);
  const desc = clean(card.querySelector('.cmp-customcard__text--description')?.textContent);
  const titleLink = el(document, 'a', title);
  titleLink.setAttribute('href', href);
  const tags = [...card.querySelectorAll('.cmp-tags a[href]')].map((a) => {
    const t = el(document, 'a', clean(a.textContent));
    t.setAttribute('href', a.getAttribute('href'));
    return el(document, 'li', t);
  });
  return [
    img ? frag(document, hint(document, 'image'), image(document, img.getAttribute('src'), img.getAttribute('alt'))) : '',
    frag(document, hint(document, 'text'), eyebrow ? el(document, 'p', eyebrow) : null, el(document, 'h3', titleLink), desc ? el(document, 'p', desc) : null),
    tags.length ? frag(document, hint(document, 'tags'), el(document, 'ul', ...tags)) : '',
  ];
}

function cardsBlock(document, cards) {
  return WebImporter.Blocks.createBlock(document, { name: 'Cards (teaser)', cells: cards.map((c) => cardRow(document, c)) });
}

// the path is written as text: the import framework makes relative links absolute (rwjf.org),
// the fragment block reads a link or a text path, and the package maps it to /content/rwjf-eds/...
function fragmentBlock(document) {
  return WebImporter.Blocks.createBlock(document, {
    name: 'Fragment',
    cells: [[frag(document, hint(document, 'reference'), el(document, 'p', FRAGMENT_PATH))]],
  });
}

/* ------------------------------------------------------------------ page */

/** source items in document order: text nodes and components */
function collectItems(document, content) {
  const items = [];
  const state = { leadDone: false };
  let about = null;
  const SEL = '.cmp-text, .image > .cmp-image, .cmp-blockquote, .embedinteractive, .video, .card-column-control, .card .cmp-customcard';
  content.querySelectorAll(SEL).forEach((node) => {
    if (node.closest('.cmp-hero, .social-sharing, .cmp-experiencefragment')) return;
    // skip components nested in an already collected one
    const parent = node.parentElement.closest(SEL);
    if (parent) return;
    if (node.matches('.cmp-text')) {
      if (node.closest('.yt-video-component, .embedinteractive')) return;
      if (node.querySelector('.heading4-style') && /About the Robert Wood Johnson Foundation/i.test(node.textContent)) {
        about = node;
        items.push({ kind: 'fragment', node: fragmentBlock(document) });
        return;
      }
      [...node.children].forEach((child) => {
        const n = textNode(document, child, state);
        if (n) items.push({ kind: 'text', node: n, text: clean(n.textContent) });
      });
    } else if (node.matches('.cmp-image')) items.push({ kind: 'rail', node: figureBlock(document, node) });
    else if (node.matches('.cmp-blockquote')) items.push({ kind: 'quote', node: quoteBlock(document, node) });
    else if (node.matches('.embedinteractive')) items.push({ kind: 'embed', node: embedBlock(document, node) });
    else if (node.matches('.video')) items.push({ kind: 'rail', node: videoBlock(document, node) });
    else if (node.matches('.card-column-control')) items.push({ kind: 'cards', node: cardsBlock(document, [...node.querySelectorAll('.cmp-customcard')]) });
    else if (node.matches('.cmp-customcard')) items.push({ kind: 'rail', node: cardsBlock(document, [node]) });
  });
  return { items, about };
}

function buildSections(items) {
  const sections = [{ style: null, nodes: [] }];
  const current = () => sections[sections.length - 1];
  const start = (style = null) => {
    if (current().nodes.length) sections.push({ style, nodes: [] });
    else current().style = style;
  };
  items.forEach((item) => {
    if (current().style === 'three-up' && item.kind !== 'embed') start();
    if (item.kind === 'text') {
      const aside = ASIDE_STARTS.find(([prefix]) => item.text.startsWith(prefix));
      if (aside) start(aside[1]);
      else if (SECTION_STARTS.includes(item.text)) start();
      current().nodes.push(item.node);
    } else if (item.kind === 'quote' || item.kind === 'fragment') {
      start();
      current().nodes.push(item.node);
      start();
    } else if (item.kind === 'embed') {
      if (current().style !== 'three-up') start('three-up');
      current().nodes.push(item.node);
    } else if (item.kind === 'rail' || item.kind === 'cards') {
      current().nodes.push(item.node);
      start();
    }
  });
  return sections.filter((s) => s.nodes.length);
}

function captureMeta(document, hero) {
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  // the byline is the second line of the title block; its line break is written as " | "
  const bylineP = [...hero.querySelectorAll('.cmp-hero__content-headings-heading p')].find((p) => clean(p.textContent));
  const byline = bylineP ? bylineP.innerHTML.split(/<br\s*\/?>/i).map((l) => clean(l.replace(/<[^>]+>/g, ''))).filter(Boolean).join(' | ') : '';
  const t = (sel) => clean(hero.querySelector(sel)?.textContent);
  const dm = t('.cmp-hero__content-headings-articleinfo-date').match(/^([A-Za-z]{3})[A-Za-z]*[\s.-]+(\d{1,2}),?[\s.-]+(\d{4})$/);
  const authorLink = hero.querySelector('.cmp-hero__info-item a');
  return {
    byline,
    author: clean(authorLink?.textContent) || byline.replace(/^a message from\s+/i, '').split(',')[0],
    contentType: t('.cmp-hero__content-headings-articleinfo-contenttype'),
    publicationDate: dm ? `${dm[3]}-${months[dm[1].toLowerCase()]}-${dm[2].padStart(2, '0')}` : '',
    readTime: (t('.cmp-hero__content-headings-articleinfo-readtime').match(/\d+/) || [''])[0],
  };
}

function finalize(element, payload) {
  cleanupTransformer('afterTransform', element, payload);
  dmImagesTransformer('afterTransform', element, payload);
}

export default {
  transform: (payload) => {
    const { document, params } = payload;
    const content = document.querySelector('#main-content') || document.body;
    const hero = content.querySelector('.cmp-hero');
    const meta = captureMeta(document, hero);
    const { items, about } = collectItems(document, content);

    const main = document.createElement('div');
    const title = clean(hero.querySelector('h1')?.textContent);
    const sections = [{ style: null, nodes: [breadcrumbBlock(document, title), heroBlock(document, hero)] }, { style: null, nodes: [shareBlock(document)] }, ...buildSections(items)];
    sections.forEach((section, i) => {
      if (i) main.append(document.createElement('hr'));
      main.append(...section.nodes);
      if (section.style) main.append(WebImporter.Blocks.createBlock(document, { name: 'Section Metadata', cells: { style: section.style } }));
    });

    main.setAttribute('data-rwjf-page-meta', JSON.stringify(meta));
    const pageMeta = buildPageMetadata(main, document, { template: 'article' });
    // the source keywords hold topic names with commas inside ("Truth, Repair and Transformation"),
    // which a comma-separated keywords value cannot carry: use the content type, as on the 2015 page
    pageMeta.keywords = ANNUAL_MESSAGE;
    main.append(document.createElement('hr'), WebImporter.Blocks.getMetadataBlock(document, pageMeta));
    finalize(main, payload);

    // fragment page: the boilerplate text
    const fragment = document.createElement('div');
    if (about) {
      const state = { leadDone: true };
      [...about.children].forEach((child) => {
        const n = textNode(document, child, state);
        if (n) fragment.append(n);
      });
      finalize(fragment, payload);
    }

    const path = WebImporter.FileUtils.sanitizePath(new URL(params.originalURL).pathname.replace(/\.html?$/, ''));
    return [
      { element: main, path, report: { sections: sections.length, items: items.length } },
      { element: fragment, path: FRAGMENT_PATH, report: { fragment: true } },
    ];
  },
};
