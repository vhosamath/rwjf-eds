/* eslint-disable */
/* global WebImporter */

import breadcrumbParser from './parsers/breadcrumb.js';
import heroArticleParser from './parsers/hero-article.js';
import quoteWideParser from './parsers/quote-wide.js';
import calloutCardParser from './parsers/callout-card.js';
import calloutFigureParser from './parsers/callout-figure.js';
import cleanupTransformer from './transformers/rwjf-cleanup.js';
import metadataTransformer from './transformers/rwjf-metadata.js';
import dmImagesTransformer from './transformers/rwjf-dm-images.js';
import sectionsTransformer from './transformers/rwjf-sections.js';
import { createPageMetadata } from './utils/rwjf-page-metadata.js';

const PAGE_TEMPLATE = {
  "name": "annual-messages",
  "urls": [
    "https://beta.rwjf.org/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015.html"
  ],
  "representativeUrl": "https://beta.rwjf.org/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015.html",
  "description": "RWJF annual message article: breadcrumb, article header, long-form body with right-rail callouts and figures",
  "blocks": [
    {
      "name": "breadcrumb",
      "instances": [
        ".breadcrumb .cmp-breadcrumb",
        ".cmp-breadcrumb"
      ]
    },
    {
      "name": "hero-article",
      "instances": [
        "div.hero .cmp-hero"
      ]
    },
    {
      "name": "quote-wide",
      "instances": [
        ".blockquote .cmp-blockquote",
        ".cmp-blockquote"
      ]
    },
    {
      "name": "callout-card",
      "instances": [
        "div.news-floating-cta"
      ]
    },
    {
      "name": "callout-figure",
      "instances": [
        "div.image.aem-GridColumn > .cmp-image"
      ]
    }
  ],
  "urlPattern": "/en/about-rwjf/our-guiding-principles/annual-messages/*",
  "sections": [
    {
      "id": "section-1",
      "name": "Breadcrumb and article hero",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(1)",
        "#main-content > div.hero",
        "#main-content > div.column-control.responsivegrid:nth-of-type(3) .column-control__grid > .column-control__col:nth-of-type(1)"
      ],
      "style": null,
      "blocks": [
        "breadcrumb",
        "hero-article"
      ],
      "defaultContent": []
    },
    {
      "id": "section-2",
      "name": "Introduction: Weaving the Threads of Health / Innovation / Taking Action / Areas of Focus",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(3) .column-control__grid > .column-control__col:nth-of-type(2)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(4)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(5)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(6)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(7)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(8)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(9)"
      ],
      "style": null,
      "blocks": [
        "quote-wide"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-3",
      "name": "Bridging Health and Health Care (aside)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(10)"
      ],
      "style": "aside",
      "blocks": [
        "callout-card"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-4",
      "name": "Bridging Health (cont.) and Building Demand for Healthy Places and Practices",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(11)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(12)",
        "#main-content > div.column-control.responsivegrid:nth-of-type(13)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-5",
      "name": "Eliminating Health Disparities (aside)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(14)"
      ],
      "style": "aside",
      "blocks": [
        "callout-figure"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-6",
      "name": "Engaging Business for Health",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(15)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-7",
      "name": "Strengthening Vulnerable Children and Families (aside)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(16)"
      ],
      "style": "aside",
      "blocks": [
        "callout-card"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-8",
      "name": "Leadership (ul 3 items)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(17)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-9",
      "name": "Childhood Obesity (aside)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(18)"
      ],
      "style": "aside",
      "blocks": [
        "callout-card"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-10",
      "name": "Coverage",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(19)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-11",
      "name": "Value (aside)",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(20)"
      ],
      "style": "aside",
      "blocks": [
        "callout-figure"
      ],
      "defaultContent": [
        ".cmp-text"
      ]
    },
    {
      "id": "section-12",
      "name": "Remembering What is Important and sign-off",
      "selector": [
        "#main-content > div.column-control.responsivegrid:nth-of-type(21)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".cmp-text"
      ]
    }
  ]
};

const parsers = {
  breadcrumb: breadcrumbParser,
  'hero-article': heroArticleParser,
  'quote-wide': quoteWideParser,
  'callout-card': calloutCardParser,
  'callout-figure': calloutFigureParser,
};
// Late transformers change the DOM (section <hr> markers, shared fragments), so their beforeTransform
// runs after block discovery.
const sectionTransformers = [sectionsTransformer];
const fragmentTransformers = [];
const lateTransformers = [...sectionTransformers, ...fragmentTransformers];
const transformers = [cleanupTransformer, metadataTransformer, dmImagesTransformer, ...lateTransformers];
const earlyTransformers = transformers.filter((fn) => !lateTransformers.includes(fn));
// Catalog selectors (pageInstances, pageCleanup) count the <script> and <hr> elements the importer
// removes before transform, so a catalog template finds its targets in preprocess.
const CATALOG = Boolean(PAGE_TEMPLATE.pageCleanup || PAGE_TEMPLATE.blocks.some((b) => b.pageInstances));

function executeTransformers(hookName, element, payload, list = transformers) {
  const enhancedPayload = { ...payload, template: payload.params?.targets?.template || PAGE_TEMPLATE };
  list.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template, url) {
  const pageBlocks = [];
  const pageKey = (u) => {
    try { const { origin, pathname } = new URL(u); return `${origin}${pathname.replace(/\/$/, '')}`; }
    catch { return u; }
  };
  const key = pageKey(url);
  const claim = (blockDef, selector) => {
    let matches = [];
    try { matches = document.querySelectorAll(selector); } catch { return; }
    matches.forEach((element) => {
      if (pageBlocks.some((b) => b.element === element || b.element.contains(element) || element.contains(b.element))) return;
      pageBlocks.push({ name: blockDef.name, selector, element });
    });
  };
  template.blocks.forEach((blockDef) => {
    const entry = Object.entries(blockDef.pageInstances || {}).find(([u]) => pageKey(u) === key);
    (entry ? entry[1] : []).forEach((selector) => claim(blockDef, selector));
  });
  template.blocks.forEach((blockDef) => (blockDef.instances || []).forEach((selector) => claim(blockDef, selector)));
  return pageBlocks;
}

// Runs the early transformers, then marks each block and section target with an attribute: the
// importer re-creates the body before transform, so only attributes survive, not element references.
function markPageTargets(payload) {
  const { document, params } = payload;
  executeTransformers('beforeTransform', document.body, payload, earlyTransformers);
  const blocks = findBlocksOnPage(document, PAGE_TEMPLATE, params.originalURL).map(({ name, selector, element }, i) => {
    element.setAttribute('data-excat-block', String(i));
    return { name, selector };
  });
  const sections = (PAGE_TEMPLATE.sections || []).map((section, i) => {
    const target = (section.selector || []).map((s) => { try { return document.querySelector(s); } catch { return null; } }).find(Boolean);
    if (!target) return section;
    target.setAttribute('data-excat-section', String(i));
    return { ...section, selector: [`[data-excat-section="${i}"]`] };
  });
  params.targets = { blocks, template: { ...PAGE_TEMPLATE, sections } };
}

export default {
  preprocess: (payload) => {
    if (CATALOG) markPageTargets(payload);
  },
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;
    params.fragments = [];

    if (!params.targets) markPageTargets(payload);
    const pageBlocks = params.targets.blocks
      .map((block, i) => ({ ...block, element: document.querySelector(`[data-excat-block="${i}"]`) }))
      .filter((block) => block.element);
    executeTransformers('beforeTransform', main, { ...payload, pageBlocks }, lateTransformers);

    pageBlocks.forEach((block) => {
      if (!main.contains(block.element)) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    createPageMetadata(main, document, { template: 'article' });
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // A fragment's nodes left `main` before afterTransform: finalize it the same way, without the
    // page-only section breaks and metadata.
    params.fragments.forEach(({ element }) => {
      executeTransformers('afterTransform', element, payload, earlyTransformers);
      WebImporter.rules.transformBackgroundImages(element, document);
      WebImporter.rules.adjustImageUrls(element, url, params.originalURL);
    });

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    // Return a detached container: third-party scripts on the source page (e.g. the Osano consent
    // window) re-render into <body> asynchronously after cleanup and would otherwise leak into the page.
    const output = document.createElement('div');
    output.append(...main.childNodes);

    return [{
      element: output,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }, ...params.fragments];
  },
};
