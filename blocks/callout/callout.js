import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Extracts a YouTube video id from a watch, short, embed or nocookie URL.
 * @param {string} url
 * @returns {string|null}
 */
export function getYouTubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname.endsWith('youtu.be')) return u.pathname.split('/')[1] || null;
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const match = /\/(?:embed|shorts|v)\/([\w-]{6,})/.exec(u.pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isExternal(href) {
  try {
    return new URL(href, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function buildVideoDialog(block, { videoId, title, textNodes }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'callout-dialog';
  const titleId = `callout-dialog-title-${videoId}`;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `
    <div class="callout-dialog-header">
      <h2 class="callout-dialog-title" id="${titleId}"></h2>
      <button type="button" class="callout-dialog-close" aria-label="Close dialog"></button>
    </div>
    <div class="callout-dialog-video"></div>
    <div class="callout-dialog-text"></div>`;
  dialog.querySelector('.callout-dialog-title').textContent = title || 'Video';
  dialog.querySelector('.callout-dialog-text').append(...textNodes);

  const videoWrapper = dialog.querySelector('.callout-dialog-video');
  const loadVideo = () => {
    if (videoWrapper.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    iframe.title = title ? `Video: ${title}` : 'Video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    videoWrapper.append(iframe);
  };
  const unloadVideo = () => videoWrapper.replaceChildren();

  let opener = null;
  dialog.querySelector('.callout-dialog-close').addEventListener('click', () => dialog.close());
  // close when the backdrop is clicked
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    unloadVideo();
    document.body.classList.remove('callout-dialog-open');
    opener?.focus();
  });

  block.append(dialog);
  return {
    open(trigger) {
      opener = trigger;
      loadVideo();
      document.body.classList.add('callout-dialog-open');
      dialog.showModal();
      dialog.querySelector('.callout-dialog-close').focus();
    },
  };
}

/**
 * loads and decorates the callout block
 * rows: media (image), content (title + text), cta (link + optional video dialog text)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [mediaRow, contentRow, ctaRow] = [...block.children];
  const isFigure = block.classList.contains('figure');

  // media
  if (mediaRow) {
    mediaRow.className = 'callout-media';
    mediaRow.querySelectorAll('picture > img').forEach((img) => {
      // only same-origin (AEM-delivered) images support the optimization query parameters
      if (new URL(img.src, window.location.href).origin !== window.location.origin) return;
      const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
      moveInstrumentation(img, optimized.querySelector('img'));
      img.closest('picture').replaceWith(optimized);
    });
    if (!mediaRow.querySelector('picture, img')) mediaRow.remove();
  }

  // content
  if (contentRow) {
    contentRow.className = 'callout-content';
    if (!contentRow.textContent.trim()) contentRow.remove();
  }
  const heading = contentRow?.querySelector('h1, h2, h3, h4, h5, h6');
  heading?.classList.add('callout-title');

  // cta: first link of the cell; anything after it is the (optional) video dialog text
  let figureVideo = null;
  if (ctaRow) {
    ctaRow.className = 'callout-cta';
    const cell = ctaRow.firstElementChild || ctaRow;
    const link = cell.querySelector('a[href]');
    const linkBlock = link ? [...cell.children].find((el) => el.contains(link)) || link : null;
    const extra = [...cell.childNodes].filter((node) => node !== linkBlock
      && (node.nodeType === Node.ELEMENT_NODE || node.textContent.trim()));
    const videoId = link ? getYouTubeId(link.href) : null;

    if (link && videoId && !isFigure) {
      const dialog = buildVideoDialog(block, {
        videoId, title: heading?.textContent.trim(), textNodes: extra,
      });
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button primary callout-video-trigger';
      button.setAttribute('aria-haspopup', 'dialog');
      button.textContent = link.textContent.trim() || 'Watch the video';
      moveInstrumentation(link, button);
      button.addEventListener('click', (e) => {
        e.preventDefault();
        dialog.open(button);
      });
      const p = document.createElement('p');
      p.className = 'button-wrapper';
      p.append(button);
      cell.replaceChildren(p);
    } else if (link && videoId && isFigure) {
      // figure + YouTube link: the image becomes a play button that opens the video dialog
      const title = heading?.textContent.trim() || contentRow?.textContent.trim();
      figureVideo = {
        link,
        title,
        dialog: buildVideoDialog(block, { videoId, title, textNodes: extra }),
      };
      ctaRow.remove();
    } else if (link) {
      extra.forEach((node) => node.remove());
      link.classList.add('button', 'primary');
      if (linkBlock?.tagName === 'P') linkBlock.classList.add('button-wrapper');
      if (isExternal(link.href)) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `${link.textContent.trim()} (opens in a new window)`);
      }
    } else {
      ctaRow.remove();
    }
  }

  // figure variant: image with caption semantics
  if (isFigure) {
    const figure = document.createElement('figure');
    figure.className = 'callout-figure';
    const media = block.querySelector('.callout-media');
    const caption = block.querySelector('.callout-content');
    if (media) figure.append(media);
    const picture = media?.querySelector('picture');
    if (figureVideo && picture) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'callout-video-play';
      play.setAttribute('aria-haspopup', 'dialog');
      play.setAttribute('aria-label', figureVideo.title ? `Play video: ${figureVideo.title}` : 'Play video');
      moveInstrumentation(figureVideo.link, play);
      picture.replaceWith(play);
      play.append(picture);
      play.addEventListener('click', () => figureVideo.dialog.open(play));
    }
    if (caption) {
      const figcaption = document.createElement('figcaption');
      figcaption.className = 'callout-caption';
      figcaption.append(caption);
      figure.append(figcaption);
    }
    block.prepend(figure);
  }
}
