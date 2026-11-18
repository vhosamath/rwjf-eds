/* eslint-disable */
/* global WebImporter */

/**
 * Import script for the global footer fragment page (/footer).
 * Reads footer.cmp-footer from any rwjf.org page and writes default content in four sections:
 *   0 newsletter   "Newsletter" block (key-value: heading, intro, endpoint, siteKey, successHeading),
 *                  shown above the navy footer
 *   1 footer-top     logo, contact, manage your grants + social icon links
 *   2 footer-sitemap column titles (H2 links) + link lists ("... Overview" duplicates dropped)
 *   3 footer-legal   copyright + legal links
 * Relative/rwjf.org links become absolute https://www.rwjf.org/... (pages not migrated yet).
 * Icons use the :icon-name: convention (span.icon-*) backed by /icons/*.svg.
 */

const SITE = 'https://www.rwjf.org';
const SOCIAL_ICONS = ['facebook', 'linkedin', 'youtube', 'instagram'];

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function absolute(href) {
  if (!href) return href;
  if (/^(tel|mailto):/i.test(href)) return href;
  try {
    const url = new URL(href, SITE);
    if (/(^|\.)rwjf\.org$/i.test(url.hostname) && !/^my\./i.test(url.hostname)) {
      return `${SITE}${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch (e) {
    return href;
  }
}

function link(document, href, text) {
  const a = document.createElement('a');
  a.setAttribute('href', absolute(href));
  if (text) a.textContent = text;
  return a;
}

/** icons are authored with the :icon-name: notation, which Edge Delivery turns into span.icon */
function icon(document, name) {
  return document.createTextNode(`:${name}:`);
}

function el(document, tag, ...children) {
  const node = document.createElement(tag);
  children.filter(Boolean).forEach((c) => node.append(c));
  return node;
}

/** "label<br>value" paragraphs keep their line breaks */
function linesOf(node) {
  const parts = [];
  let current = '';
  node.childNodes.forEach((n) => {
    if (n.nodeName === 'BR') { parts.push(clean(current)); current = ''; } else current += ` ${n.textContent}`;
  });
  parts.push(clean(current));
  return parts.filter(Boolean);
}

function buildTop(document, src) {
  const out = [];
  const logo = src.querySelector('.cmp-footer-links_col-logo a');
  if (logo) {
    const a = link(document, logo.getAttribute('href') || SITE, '');
    a.append(icon(document, 'rwjf-logo'), ' Robert Wood Johnson Foundation');
    out.push(el(document, 'p', a));
  }

  const contact = src.querySelector('.cmp-footer-links_col-contact');
  if (contact) {
    const heading = contact.querySelector('.cmp-footer-links_col-sectionheading');
    out.push(el(document, 'h2', clean(heading?.textContent) ? titleCase(clean(heading.textContent)) : 'Contact RWJF'));
    contact.querySelectorAll(':scope > p:not(.cmp-footer-links_col-sectionheading)').forEach((p) => {
      if (!clean(p.textContent)) return;
      const a = p.querySelector('a[href]');
      const para = document.createElement('p');
      if (a && !a.getAttribute('href').startsWith('tel:')) {
        // address: the whole paragraph is the map link, keep the line break
        const lines = linesOf(a);
        // Google Maps directions URLs are full of commas, and AEM inserts "%20" after each comma
        // when it delivers links; a comma-free search URL for the address avoids that
        const href = /google\.[a-z.]+\/maps/i.test(a.getAttribute('href'))
          ? `https://www.google.com/maps/search/?api=1&query=${lines.join(' ').replace(/,/g, '').trim().split(/\s+/).map(encodeURIComponent).join('+')}`
          : a.getAttribute('href');
        const mapLink = link(document, href, '');
        lines.forEach((line, i) => { if (i) mapLink.append(document.createElement('br')); mapLink.append(line); });
        para.append(mapLink);
      } else if (a) {
        // "US Toll Free:<br><a tel>" style
        const label = clean([...p.childNodes].filter((n) => n !== a && n.nodeName !== 'BR').map((n) => n.textContent).join(' '));
        if (label) para.append(label, document.createElement('br'));
        para.append(link(document, a.getAttribute('href'), clean(a.textContent)));
      } else {
        para.textContent = clean(p.textContent);
      }
      out.push(para);
    });
  }

  const grants = src.querySelector('.cmp-footer-links_text');
  if (grants) {
    const heading = grants.querySelector('.cmp-footer-links_col-sectionheading');
    out.push(el(document, 'h2', titleCase(clean(heading?.textContent) || 'Manage Your Grants')));
    grants.querySelectorAll('a[href]').forEach((a) => out.push(el(document, 'p', link(document, a.getAttribute('href'), clean(a.textContent)))));
  }

  const socials = [...src.querySelectorAll('.cmp-footer-links_socials-wrap a[href]')];
  if (socials.length) {
    const ul = document.createElement('ul');
    socials.forEach((a) => {
      const name = SOCIAL_ICONS.find((n) => a.querySelector(`.icon-${n}`)) || clean(a.textContent).toLowerCase();
      const label = clean(a.querySelector('.visually-hidden')?.textContent || a.textContent) || name;
      const item = link(document, a.getAttribute('href'), '');
      item.append(icon(document, name), ` ${label}`);
      ul.append(el(document, 'li', item));
    });
    out.push(ul);
  }
  return out;
}

function titleCase(text) {
  // source labels are uppercased by CSS; store them in title case ("Contact RWJF")
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bRwjf\b/g, 'RWJF');
}

function buildSitemap(document, src) {
  const out = [];
  src.querySelectorAll('.cmp-footer-section2 .cmp-footer-links > li').forEach((col) => {
    const title = col.querySelector('.link-col-heading');
    if (title) out.push(el(document, 'h2', link(document, title.getAttribute('href'), clean(title.textContent))));
    const ul = document.createElement('ul');
    col.querySelectorAll('.cmp-footer-links_col-linkwrap > li a[href]').forEach((a) => {
      // the first "... Overview" link duplicates the column title and is hidden on the source
      if (title && /overview$/i.test(clean(a.textContent)) && absolute(a.getAttribute('href')) === absolute(title.getAttribute('href'))) return;
      ul.append(el(document, 'li', link(document, a.getAttribute('href'), clean(a.textContent))));
    });
    if (ul.children.length) out.push(ul);
  });
  return out;
}

function buildLegal(document, src) {
  const out = [];
  const copy = clean([...src.querySelectorAll('.cmp-footer-section3 .date-number p')].map((p) => clean(p.textContent)).join(' '))
    .replace(/(©\s*\d{4}\s*-)\s*(\d{4})/, '$1$2');
  if (copy) out.push(el(document, 'p', copy));
  const ul = document.createElement('ul');
  src.querySelectorAll('.cmp-footer-links_terms a[href]').forEach((a) => ul.append(el(document, 'li', link(document, a.getAttribute('href'), clean(a.textContent)))));
  if (ul.children.length) out.push(ul);
  return out;
}

// "Stay informed" signup: texts from the source band; endpoint = RWJF dev publish servlet
const NEWSLETTER = {
  heading: 'Stay informed',
  intro: 'Sign up for the latest funding alerts, news, research, and perspectives from RWJF.',
  endpoint: 'https://dev-sp3.rwjf.cloud/action/servlets/subscription',
  siteKey: '6Ld7dqorAAAAAIAefIumXAPxDqaVBd4luMMHmi1w',
  successHeading: 'Subscribed!',
};

function buildNewsletter(document) {
  const src = document.querySelector('.cmp-experiencefragment--email-subscription');
  const heading = clean(src?.querySelector('h2')?.textContent) || NEWSLETTER.heading;
  const intro = clean(src?.querySelector('.cmp-emailsub__form--default_description')?.textContent) || NEWSLETTER.intro;
  const success = clean(src?.querySelector('[data-cmp-item="confirmation"] h3')?.textContent) || NEWSLETTER.successHeading;
  return WebImporter.Blocks.createBlock(document, {
    name: 'Newsletter',
    cells: [
      ['heading', heading],
      ['intro', el(document, 'p', intro)],
      ['endpoint', NEWSLETTER.endpoint],
      ['siteKey', NEWSLETTER.siteKey],
      ['successHeading', success],
    ],
  });
}

export default {
  transform: ({ document }) => {
    const src = document.querySelector('footer.cmp-footer');
    const main = document.createElement('div');
    if (!src) return [{ element: main, path: '/footer', report: { error: 'footer.cmp-footer not found' } }];

    const sections = [
      [buildNewsletter(document)],
      buildTop(document, src),
      buildSitemap(document, src),
      buildLegal(document, src),
    ];
    sections.forEach((nodes, i) => {
      if (i) main.append(document.createElement('hr'));
      main.append(...nodes);
    });

    return [{ element: main, path: '/footer', report: { sections: sections.length } }];
  },
};
