/* eslint-disable */
/* global WebImporter */

/**
 * RWJF sections transformer.
 *
 * beforeTransform: resolves every section of payload.template.sections (first matching selector),
 * then walks them in reverse and inserts an <hr> before each non-first section while the parser
 * targets still exist. Styled sections get their <hr> tagged with data-excat-section-id; a styled
 * first section gets a temporary tagged <hr> as well.
 *
 * afterTransform: walks the styled sections in reverse and inserts a "Section Metadata" block
 * (style) at the end of the section, i.e. right before the next section break (fallback: after the
 * marker / surviving section element). Marker attributes are removed and the first section's
 * temporary <hr> is dropped so no empty section is opened.
 */

const MARKER = 'data-excat-section-id';
const FIRST_MARKER = 'data-excat-section-first';

function resolveSection(root, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (let i = 0; i < selectors.length; i += 1) {
    const sel = selectors[i];
    if (!sel) continue;
    let el = null;
    try { el = root.querySelector(sel); } catch (e) { el = null; }
    if (el) return el;
  }
  return null;
}

function nextHrInDocument(doc, root, from) {
  const walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
  walker.currentNode = from;
  let node = walker.nextNode();
  while (node) {
    if (node.tagName === 'HR') return node;
    node = walker.nextNode();
  }
  return null;
}

function styleValue(style) {
  if (!style) return '';
  return Array.isArray(style) ? style.join(', ') : String(style);
}

export default function transform(hookName, element, payload) {
  const template = payload && payload.template;
  const sections = (template && template.sections) || [];
  if (sections.length < 2) return;
  const doc = element.ownerDocument;

  if (hookName === 'beforeTransform') {
    const resolved = sections.map((section) => ({ section, el: resolveSection(element, section) }));
    for (let i = resolved.length - 1; i >= 0; i -= 1) {
      const { section, el } = resolved[i];
      if (!el || !el.parentNode) continue;
      const styled = !!styleValue(section.style);
      if (i === 0) {
        if (styled) {
          const hr = doc.createElement('hr');
          hr.setAttribute(MARKER, section.id);
          hr.setAttribute(FIRST_MARKER, 'true');
          el.parentNode.insertBefore(hr, el);
        }
        continue;
      }
      const hr = doc.createElement('hr');
      if (styled) hr.setAttribute(MARKER, section.id);
      el.parentNode.insertBefore(hr, el);
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const style = styleValue(section.style);
      if (!style) continue;
      const marker = element.querySelector(`hr[${MARKER}="${section.id}"]`);
      const anchor = marker || resolveSection(element, section);
      if (!anchor || !anchor.parentNode) continue;

      const metadata = WebImporter.Blocks.createBlock(doc, {
        name: 'Section Metadata',
        cells: { style },
      });

      const nextHr = nextHrInDocument(doc, element, anchor);
      if (nextHr && nextHr.parentNode) {
        nextHr.parentNode.insertBefore(metadata, nextHr);
      } else if (marker) {
        // last section: append at the end of the content
        element.appendChild(metadata);
      } else {
        anchor.after(metadata);
      }

      if (marker) {
        marker.removeAttribute(MARKER);
        if (marker.hasAttribute(FIRST_MARKER)) marker.remove();
      }
    }
    element.querySelectorAll(`hr[${MARKER}], hr[${FIRST_MARKER}]`).forEach((hr) => {
      if (hr.hasAttribute(FIRST_MARKER)) hr.remove();
      else hr.removeAttribute(MARKER);
    });
  }
}
