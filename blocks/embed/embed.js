/*
 * Embed Block
 * Show videos and social posts directly on your page
 * https://www.hlx.live/developer/block-collection/embed
 *
 * Adopted from adobe/aem-block-collection (Apache-2.0), blocks/embed at bab6ae1.
 * Local changes (marked "rwjf-eds"):
 * - Instagram provider: iframe of the post's /embed/ page,
 *   resized from Instagram's MEASURE messages
 * - the URL may also be plain text (Universal Editor text fields)
 * - Instagram placeholders show a "View Instagram post" button instead of a play icon
 */

const loadScript = (url, callback, type) => {
  const head = document.querySelector('head');
  const script = document.createElement('script');
  script.src = url;
  if (type) {
    script.setAttribute('type', type);
  }
  script.onload = callback;
  head.append(script);
  return script;
};

const getDefaultEmbed = (url) => `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
    <iframe src="${url.href}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" allowfullscreen=""
      scrolling="no" allow="encrypted-media" title="Content from ${url.hostname}" loading="lazy">
    </iframe>
  </div>`;

const embedYoutube = (url, autoplay) => {
  const usp = new URLSearchParams(url.search);
  const suffix = autoplay ? '&muted=1&autoplay=1' : '';
  let vid = usp.get('v') ? encodeURIComponent(usp.get('v')) : '';
  const embed = url.pathname;
  if (url.origin.includes('youtu.be')) {
    [, vid] = url.pathname.split('/');
  }
  const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://www.youtube.com${vid ? `/embed/${vid}?rel=0&v=${vid}${suffix}` : embed}" style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; picture-in-picture" allowfullscreen="" scrolling="no" title="Content from Youtube" loading="lazy"></iframe>
    </div>`;
  return embedHTML;
};

const embedVimeo = (url, autoplay) => {
  const [, video] = url.pathname.split('/');
  const suffix = autoplay ? '?muted=1&autoplay=1' : '';
  const embedHTML = `<div style="left: 0; width: 100%; height: 0; position: relative; padding-bottom: 56.25%;">
      <iframe src="https://player.vimeo.com/video/${video}${suffix}" 
      style="border: 0; top: 0; left: 0; width: 100%; height: 100%; position: absolute;" 
      frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen  
      title="Content from Vimeo" loading="lazy"></iframe>
    </div>`;
  return embedHTML;
};

const embedTwitter = (url) => {
  const embedHTML = `<blockquote class="twitter-tweet"><a href="${url.href}"></a></blockquote>`;
  loadScript('https://platform.twitter.com/widgets.js');
  return embedHTML;
};

// rwjf-eds: Instagram posts. The /embed/ page reports its height with postMessage ("MEASURE").
const getInstagramId = (url) => /\/(?:p|reel|tv)\/([\w-]+)/.exec(url.pathname)?.[1];

let instagramListener = false;
const listenToInstagram = () => {
  if (instagramListener) return;
  instagramListener = true;
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.instagram.com') return;
    let data;
    try {
      data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (data?.type !== 'MEASURE' || !data.details?.height) return;
    document.querySelectorAll('.embed-instagram iframe').forEach((iframe) => {
      if (iframe.contentWindow === e.source) iframe.style.height = `${Math.ceil(data.details.height)}px`;
    });
  });
};

const embedInstagram = (url) => {
  const id = getInstagramId(url);
  if (!id) return getDefaultEmbed(url);
  listenToInstagram();
  return `<iframe src="https://www.instagram.com/p/${encodeURIComponent(id)}/embed/" class="embed-instagram-frame"
      allowtransparency="true" allowfullscreen="" scrolling="no" title="Instagram post" loading="lazy"></iframe>`;
};

const loadEmbed = (block, link, autoplay) => {
  if (block.classList.contains('embed-is-loaded')) {
    return;
  }

  const EMBEDS_CONFIG = [
    {
      match: ['youtube', 'youtu.be'],
      embed: embedYoutube,
    },
    {
      match: ['vimeo'],
      embed: embedVimeo,
    },
    {
      match: ['twitter'],
      embed: embedTwitter,
    },
    {
      match: ['instagram'],
      embed: embedInstagram,
    },
  ];

  const config = EMBEDS_CONFIG.find((e) => e.match.some((match) => link.includes(match)));
  const url = new URL(link);
  if (config) {
    block.innerHTML = config.embed(url, autoplay);
    block.classList = `block embed embed-${config.match[0]}`;
  } else {
    block.innerHTML = getDefaultEmbed(url);
    block.classList = 'block embed';
  }
  block.classList.add('embed-is-loaded');
};

export default function decorate(block) {
  const placeholder = block.querySelector('picture');
  // rwjf-eds: the URL may be a link or plain text
  const link = block.querySelector('a')?.href
    || block.textContent.match(/https?:\/\/\S+/)?.[0];
  block.textContent = '';
  if (!link) return;
  const isInstagram = link.includes('instagram');

  if (placeholder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'embed-placeholder';
    // rwjf-eds: Instagram posts get a "View Instagram post" button instead of a play icon
    if (isInstagram) {
      block.classList.add('embed-instagram-placeholder');
      wrapper.innerHTML = '<div class="embed-placeholder-view"><button type="button">View Instagram post</button></div>';
    } else {
      wrapper.innerHTML = '<div class="embed-placeholder-play"><button type="button" title="Play"></button></div>';
    }
    wrapper.prepend(placeholder);
    wrapper.addEventListener('click', () => {
      loadEmbed(block, link, true);
      // rwjf-eds: keep keyboard focus on the embed that replaced the button
      if (isInstagram) block.querySelector('iframe')?.focus();
    });
    block.append(wrapper);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadEmbed(block, link);
      }
    });
    observer.observe(block);
  }
}
