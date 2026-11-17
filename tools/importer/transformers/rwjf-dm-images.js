/* eslint-disable */
/* global WebImporter */

/**
 * RWJF Dynamic Media (Scene7) image transformer — afterTransform only.
 *
 * Project decision: RWJF content images are migrated as DAM assets
 * (/content/dam/rwjf-eds/annual-messages/<year>/...), so Scene7 <img> elements are KEPT as <img>
 * (not converted to DM anchors). The src is normalised to a downloadable full-size rendition of the
 * original Scene7 URL: volatile query params (ts, dpr, ...) are dropped and `wid=2000&fmt=jpg`
 * requested. Scene7 preset suffixes (":Standard") and literal `$` params are preserved. DAM path
 * mapping is done later when packaging.
 */

const RENDITION = 'wid=2000&fmt=jpg';
const DROP_PARAMS = /^(ts|dpr|wid|hei|fmt|qlt|fit|resMode|op_sharpen|scl)$/i;

function isScene7(src) {
  if (!/^(https?:)?\/\//i.test(src)) return false;
  try {
    const u = new URL(src.startsWith('//') ? `https:${src}` : src);
    return u.pathname.startsWith('/is/image/');
  } catch (e) {
    return false;
  }
}

function normalizeScene7Url(src) {
  const normalized = src.startsWith('//') ? `https:${src}` : src;
  const qIdx = normalized.indexOf('?');
  const base = qIdx >= 0 ? normalized.slice(0, qIdx) : normalized;
  const query = qIdx >= 0 ? normalized.slice(qIdx + 1) : '';
  // keep only params that change the picture itself (e.g. $template params, crop)
  const kept = query.split('&').filter((p) => p && !DROP_PARAMS.test(p.split('=')[0]));
  kept.push(RENDITION);
  return `${base}?${kept.join('&')}`;
}

export default function transform(hookName, element, payload) {
  if (hookName !== 'afterTransform') return;

  element.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (isScene7(src)) {
      img.setAttribute('src', normalizeScene7Url(src));
    }
    img.removeAttribute('srcset');
    img.removeAttribute('loading');
    img.removeAttribute('class');
  });

  // <source srcset> inside <picture> would compete with the normalised <img src>
  element.querySelectorAll('picture source').forEach((source) => {
    const srcset = source.getAttribute('srcset') || '';
    if (isScene7(srcset.split(/\s+/)[0] || '')) source.remove();
  });
}
