/* eslint-disable */
/* global WebImporter */

/**
 * RWJF cleanup transformer (annual-messages and other AEM core-component pages on rwjf.org).
 *
 * beforeTransform (runs before block discovery, must not shift
 * `#main-content > div:nth-of-type(n)` positions of authorable rows):
 *  - removes site chrome: Osano cookie banner, skip link, header/footer experience fragments,
 *    mobile menu, reCAPTCHA badge, analytics cloudservice, scripts/styles/noscript/link/meta,
 *    empty iframes (iframes inside the floating-CTA modal are kept for the callout-card parser)
 *  - removes the "Stay informed" email subscription experience fragment inside #main-content
 *    (and its now-empty wrapping row, which is the last row of the page)
 *  - removes the hero's empty media / caption containers
 *  - default-content heading fixes in .cmp-text (H1 -> H2, H4 lead after H2 -> H3, no <br> in
 *    headings) and removal of empty <b>/<strong>/<i>/<em>/<p>
 *  The .cmp-news-floating-cta__modal (.cmp-modal) is intentionally KEPT until afterTransform.
 *
 * afterTransform (after parsers):
 *  - removes leftover modal markup and remaining chrome
 *  - unwraps stray styling spans (span.p1/p2..., span.*-style)
 *  - rewrites links: relative site links and beta.rwjf.org -> https://www.rwjf.org/...,
 *    annual message PDFs -> /content/dam/rwjf-eds/annual-messages/<year>/<file>.pdf
 *  - strips analytics-only attributes
 *  HTML comments are never removed (XWalk field hints).
 */

const PROD_ORIGIN = 'https://www.rwjf.org';
const LEGACY_HOSTS = /^(beta\.rwjf\.org|rwjf\.org|www\.rwjf\.org|localhost(:\d+)?)$/i;
const ANNUAL_MESSAGE_DAM = /^\/content\/dam\/files\/rwjf-web-files\/Annual_Message\/([^/?#]+\.pdf)$/i;
const ANALYTICS_ATTR = /^(data-cmp-data-layer|data-cmp-clickable|data-analytics.*|data-track.*|data-tracking.*|data-gtm.*|data-dtm.*|data-adobe.*|data-link-tracking.*|onclick|onmousedown)$/i;

function removeAll(root, selector) {
  root.querySelectorAll(selector).forEach((el) => el.remove());
}

function isInsideModal(el) {
  return !!el.closest('.cmp-modal, .cmp-news-floating-cta__modal');
}

function hasMedia(el) {
  return !!el.querySelector('img, picture, video, iframe, svg, source');
}

function isBlank(el) {
  return el.textContent.replace(/ /g, ' ').trim() === '' && !hasMedia(el);
}

/** Remove an XF and climb to its #main-content row if that row is now empty. */
function removeWithEmptyRow(el, main) {
  let row = el.parentElement;
  el.remove();
  while (row && row !== main && row.parentElement && row.parentElement !== main) {
    row = row.parentElement;
  }
  if (row && row !== main && row.parentElement === main && isBlank(row)) row.remove();
}

function fixDefaultContentHeadings(main) {
  main.querySelectorAll('.cmp-text').forEach((text) => {
    const doc = text.ownerDocument;
    // H1 in body copy (the hero owns the page H1) -> H2
    text.querySelectorAll('h1').forEach((h1) => {
      const h2 = doc.createElement('h2');
      while (h1.firstChild) h2.append(h1.firstChild);
      h1.replaceWith(h2);
    });
    // H4 lead line directly after an H2 -> H3
    text.querySelectorAll('h4').forEach((h4) => {
      const prev = h4.previousElementSibling;
      if (prev && prev.tagName === 'H2') {
        const h3 = doc.createElement('h3');
        while (h4.firstChild) h3.append(h4.firstChild);
        h4.replaceWith(h3);
      }
    });
  });
}

function stripHeadingBreaks(root) {
  root.querySelectorAll('h1 br, h2 br, h3 br, h4 br, h5 br, h6 br').forEach((br) => br.remove());
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    // trim trailing/leading nbsp-only whitespace
    const last = h.lastChild;
    if (last && last.nodeType === 3) last.textContent = last.textContent.replace(/[\s ]+$/, '');
    const first = h.firstChild;
    if (first && first.nodeType === 3) first.textContent = first.textContent.replace(/^[\s ]+/, '');
  });
}

function removeEmptyInlineAndParagraphs(root) {
  const doc = root.ownerDocument;
  root.querySelectorAll('b, strong, i, em').forEach((el) => {
    if (!isBlank(el)) return;
    const hadSpace = /[\s ]/.test(el.textContent);
    const inText = el.parentElement && el.parentElement.textContent.replace(el.textContent, '').trim() !== '';
    if (hadSpace && inText) el.replaceWith(doc.createTextNode(' '));
    else el.remove();
  });
  root.querySelectorAll('p').forEach((p) => {
    if (isBlank(p) && !p.querySelector('br + *')) p.remove();
  });
}

function unwrap(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
}

function annualMessageDamPath(path, fileName) {
  const year = (fileName.match(/^(\d{4})_/) || [])[1];
  return year ? `/content/dam/rwjf-eds/annual-messages/${year}/${fileName}` : path;
}

function rewriteHref(href) {
  if (!href) return href;
  const raw = href.trim();
  if (/^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) return raw;

  let path = null;
  let suffix = '';
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    path = raw;
  } else {
    let u;
    try { u = new URL(raw.startsWith('//') ? `https:${raw}` : raw); } catch (e) { return raw; }
    if (!/^https?:$/.test(u.protocol) || !LEGACY_HOSTS.test(u.host)) return raw; // external: keep
    path = u.pathname;
    suffix = `${u.search}${u.hash}`;
  }

  const pathOnly = path.split(/[?#]/)[0];
  const pdf = pathOnly.match(ANNUAL_MESSAGE_DAM);
  if (pdf) return annualMessageDamPath(pathOnly, decodeURIComponent(pdf[1]));

  // relative DAM links stay relative (migrated as assets); everything else -> production origin
  if (raw.startsWith('/') && pathOnly.startsWith('/content/dam/')) return raw;
  // strip AEM content root if present
  const cleanPath = path.replace(/^\/content\/rwjf-web\/us(?=\/)/, '');
  return `${PROD_ORIGIN}${cleanPath}${suffix}`;
}

export default function transform(hookName, element, payload) {
  const main = element;
  const doc = element.ownerDocument;

  if (hookName === 'beforeTransform') {
    // anything at body level that is neither the page root (holding #main-content) nor the video
    // modal is chrome injected at runtime (e.g. the Osano consent window, rendered by lit)
    if (main.querySelector('#main-content')) {
      [...main.children].forEach((child) => {
        if (child.querySelector('#main-content') || child.id === 'main-content') return;
        if (child.matches('.cmp-modal, .cmp-news-floating-cta__modal') || child.querySelector('.cmp-modal')) return;
        child.remove();
      });
    }
    // cookie banner / consent widgets
    removeAll(main, '.osano-cm-window, [class^="osano-cm-"], [class*=" osano-cm-"]');
    // skip links
    removeAll(main, '.cmp-page__skiptomaincontent, a[href="#main-content"]');
    // global header + nav + mobile menu, footer (experience fragments)
    main.querySelectorAll('.cmp-experiencefragment--header, .cmp-experiencefragment--footer').forEach((xf) => {
      (xf.closest('.experiencefragment') || xf).remove();
    });
    removeAll(main, '.navigation__dialog__menu--mobile, .cmp-navigation-outer');
    main.querySelectorAll('header, footer').forEach((el) => {
      if (!isInsideModal(el) && !el.closest('#main-content')) el.remove();
    });
    // "Stay informed" email subscription experience fragment inside main content
    main.querySelectorAll('.cmp-experiencefragment--email-subscription').forEach((xf) => {
      const target = xf.closest('.experiencefragment') || xf;
      const content = target.closest('#main-content');
      if (content) removeWithEmptyRow(target, content);
      else target.remove();
    });
    // widgets / tracking
    removeAll(main, '.grecaptcha-badge, .cloudservice, .sitecatalyst');
    removeAll(main, 'script, style, noscript, link, meta');
    main.querySelectorAll('iframe').forEach((f) => {
      if (isInsideModal(f)) return;
      if (!f.getAttribute('src')) f.remove();
    });
    main.querySelectorAll('div').forEach((d) => {
      // leftover empty wrapper of the reCAPTCHA badge (outside #main-content only)
      if (!d.closest('#main-content') && !isInsideModal(d) && !d.querySelector('.cmp-modal') && isBlank(d) && d.children.length === 0) d.remove();
    });
    // hero: drop empty media / caption containers
    main.querySelectorAll('.cmp-hero__secondary-media-container, .cmp-hero__media-container, .cmp-hero__caption-container').forEach((c) => {
      if (isBlank(c)) c.remove();
    });

    // default content fixes
    const content = main.querySelector('#main-content') || main;
    fixDefaultContentHeadings(content);
    content.querySelectorAll('.cmp-text').forEach((text) => {
      stripHeadingBreaks(text);
      removeEmptyInlineAndParagraphs(text);
    });
  }

  if (hookName === 'afterTransform') {
    // leftover modal markup (callout-card parser already consumed it)
    removeAll(main, '.cmp-modal, .cmp-news-floating-cta__modal');
    // any remaining chrome
    removeAll(main, '.cmp-experiencefragment--header, .cmp-experiencefragment--footer, .cmp-experiencefragment--email-subscription');
    removeAll(main, 'header, footer, nav.cmp-navigation, .cmp-page__skiptomaincontent');
    removeAll(main, 'script, style, noscript, link, meta, iframe');
    removeAll(main, '.osano-cm-window, .grecaptcha-badge, .cloudservice');

    // stray styling spans
    main.querySelectorAll('span[class]').forEach((span) => {
      const cls = span.getAttribute('class').trim().split(/\s+/);
      if (cls.some((c) => /^p\d+$/.test(c) || /^heading\d+-style$/.test(c))) unwrap(span);
    });

    // headings: no <br> anywhere in imported headings
    stripHeadingBreaks(main);

    // links
    main.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      const next = rewriteHref(href);
      if (next !== href) a.setAttribute('href', next);
    });

    // analytics-only attributes
    main.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (ANALYTICS_ATTR.test(attr.name)) el.removeAttribute(attr.name);
      });
    });
  }
}
