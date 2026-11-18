import { decorateIcons, getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// the source switches to the desktop header at 1000px (the full menu needs ~1000px)
const isDesktop = window.matchMedia('(min-width: 1000px)');
const CLOSE_DELAY = 150;
let uid = 0;

function nextId(prefix) {
  uid += 1;
  return `${prefix}-${uid}`;
}

function visuallyHidden(text) {
  const span = document.createElement('span');
  span.className = 'visually-hidden';
  span.textContent = text;
  return span;
}

function iconSpan(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** turns :icon-name: notation left as plain text into icon spans */
function textIconsToSpans(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    if (/:[a-z0-9-]+:/.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
  }
  nodes.forEach((node) => {
    const parts = node.textContent.split(/:([a-z0-9-]+):/);
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2) frag.append(iconSpan(part));
      else if (part) frag.append(part);
    });
    node.replaceWith(frag);
  });
}

function sameTarget(a, b) {
  try {
    const u1 = new URL(a.href, window.location.href);
    const u2 = new URL(b.href, window.location.href);
    return u1.origin === u2.origin && u1.pathname === u2.pathname;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- brand */
function decorateBrand(section) {
  const link = section.querySelector('a');
  if (!link) return;
  link.className = 'nav-logo';
  link.closest('p')?.classList.remove('button-wrapper');
  [...link.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      node.replaceWith(visuallyHidden(node.textContent.trim()));
    }
  });
}

/* ---------------------------------------------------------------- menus */
function closeItem(item, { focusToggle = false } = {}) {
  if (!item) return;
  const toggle = item.querySelector(':scope > .nav-toggle');
  clearTimeout(item.closeTimer);
  item.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  if (focusToggle) toggle?.focus();
}

function closeAllItems(list, except) {
  list.querySelectorAll(':scope > li.is-open').forEach((item) => {
    if (item !== except) closeItem(item);
  });
}

function openItem(list, item) {
  closeAllItems(list, item);
  clearTimeout(item.closeTimer);
  item.classList.add('is-open');
  item.querySelector(':scope > .nav-toggle')?.setAttribute('aria-expanded', 'true');
}

function visibleLinks(submenu) {
  return [...submenu.querySelectorAll('a')].filter((a) => a.offsetParent !== null);
}

function topFocusables(list) {
  return [...list.querySelectorAll(':scope > li')].map((li) => {
    const toggle = li.querySelector(':scope > .nav-toggle');
    return isDesktop.matches ? li.querySelector(':scope > .nav-link') || toggle : toggle;
  }).filter(Boolean);
}

function decorateSections(section) {
  const list = section.querySelector('ul');
  if (!list) return null;
  list.classList.add('nav-list');

  [...list.children].forEach((item) => {
    item.classList.add('nav-item');
    const link = item.querySelector(':scope > a') || item.querySelector(':scope > p > a');
    const submenu = item.querySelector(':scope > ul');
    if (link) {
      link.classList.add('nav-link');
      if (link.parentElement !== item) link.parentElement.replaceWith(link);
    }
    if (!submenu) return;

    item.classList.add('nav-drop');
    submenu.classList.add('nav-submenu');
    submenu.id = nextId('nav-submenu');
    const label = (link?.textContent || item.firstChild?.textContent || '').trim();

    // the first "... Overview" link duplicates the item link: hidden on desktop, shown on mobile
    const first = submenu.querySelector(':scope > li > a');
    if (first && link && sameTarget(first, link)) first.closest('li').classList.add('nav-overview');

    // toggle: invisible until keyboard focus on desktop, the whole row on mobile
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', submenu.id);
    toggle.dataset.label = label;
    const text = document.createElement('span');
    text.className = 'nav-toggle-label';
    text.textContent = label;
    toggle.append(text, visuallyHidden(' submenu'), iconSpan('plus'));
    if (link) link.after(toggle);
    else item.prepend(toggle);

    toggle.addEventListener('click', () => {
      if (item.classList.contains('is-open')) closeItem(item);
      else openItem(list, item);
    });

    // desktop hover (pointer only)
    item.addEventListener('pointerenter', (e) => {
      if (isDesktop.matches && e.pointerType === 'mouse') openItem(list, item);
    });
    item.addEventListener('pointerleave', (e) => {
      if (!isDesktop.matches || e.pointerType !== 'mouse') return;
      item.closeTimer = setTimeout(() => closeItem(item), CLOSE_DELAY);
    });

    // touch on desktop-sized screens: first tap opens, second tap follows the link
    link?.addEventListener('click', (e) => {
      if (!isDesktop.matches) return;
      if (item.dataset.lastPointer === 'touch' && !item.classList.contains('is-open')) {
        e.preventDefault();
        openItem(list, item);
      }
    });
    link?.addEventListener('pointerdown', (e) => { item.dataset.lastPointer = e.pointerType; });

    // keyboard
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && isDesktop.matches) {
        e.preventDefault();
        openItem(list, item);
        visibleLinks(submenu)[0]?.focus();
      }
    });
    submenu.addEventListener('keydown', (e) => {
      const links = visibleLinks(submenu);
      const i = links.indexOf(document.activeElement);
      if (i < 0) return;
      let target;
      if (e.key === 'ArrowDown') target = links[(i + 1) % links.length];
      else if (e.key === 'ArrowUp') target = links[(i - 1 + links.length) % links.length];
      else if (e.key === 'Home') [target] = links;
      else if (e.key === 'End') target = links[links.length - 1];
      if (target) {
        e.preventDefault();
        target.focus();
      }
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && item.classList.contains('is-open')) {
        e.stopPropagation();
        closeItem(item, { focusToggle: true });
      }
    });
    item.addEventListener('focusout', (e) => {
      if (isDesktop.matches && !item.contains(e.relatedTarget)) closeItem(item);
    });
  });

  // arrow left/right between top-level items (desktop)
  list.addEventListener('keydown', (e) => {
    if (!isDesktop.matches || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tops = topFocusables(list);
    const current = tops.findIndex((el) => el.closest('.nav-item') === document.activeElement.closest('.nav-item'));
    if (current < 0 || document.activeElement.closest('.nav-submenu')) return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    closeAllItems(list);
    tops[(current + step + tops.length) % tops.length].focus();
  });

  document.addEventListener('click', (e) => {
    if (!list.contains(e.target)) closeAllItems(list);
  });
  return list;
}

/* ---------------------------------------------------------------- search */
function buildSearch(searchLink) {
  const action = searchLink ? new URL(searchLink.href, window.location.href).href : 'https://www.rwjf.org/en/search-results.html';
  const formId = nextId('nav-search');
  const inputId = nextId('nav-search-input');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-search-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', formId);
  toggle.append((searchLink?.textContent || 'Search').trim(), iconSpan('search'));

  const form = document.createElement('form');
  form.className = 'nav-search';
  form.id = formId;
  form.setAttribute('role', 'search');
  form.action = action;
  form.method = 'get';
  form.innerHTML = `
    <label for="${inputId}">Search by Keyword</label>
    <div class="nav-search-field">
      <input id="${inputId}" name="k" type="text" placeholder="SEARCH RWJF" autocomplete="off">
      <button type="button" class="nav-search-clear" aria-label="Clear search" hidden></button>
    </div>
    <button type="submit" class="nav-search-submit">Search</button>
    <button type="button" class="nav-search-close">Close<span class="visually-hidden"> search</span></button>`;
  form.querySelector('.nav-search-clear').append(iconSpan('close'));
  form.querySelector('.nav-search-close').append(iconSpan('close'));

  const input = form.querySelector('input');
  const clear = form.querySelector('.nav-search-clear');
  input.addEventListener('input', () => { clear.hidden = !input.value; });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    input.focus();
  });
  form.addEventListener('submit', (e) => {
    if (!input.value.trim()) {
      e.preventDefault();
      input.focus();
    }
  });
  return { toggle, form, input };
}

/* ---------------------------------------------------------------- mobile menu */
function focusablesIn(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hidden && el.offsetParent !== null);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');
  while (fragment?.firstElementChild) nav.append(fragment.firstElementChild);
  textIconsToSpans(nav);
  decorateIcons(nav);

  const [brand, sections, tools] = [...nav.children];
  brand?.classList.add('nav-brand');
  sections?.classList.add('nav-sections');
  tools?.classList.add('nav-tools');
  if (brand) decorateBrand(brand);
  const list = sections ? decorateSections(sections) : null;

  // tools: "Find A Grant" + the search link (turned into the search control)
  let search = null;
  if (tools) {
    const links = [...tools.querySelectorAll('a')];
    const searchLink = links.find((a) => /search/i.test(a.getAttribute('href')) || /^search$/i.test(a.textContent.trim()));
    links.filter((a) => a !== searchLink).forEach((a) => {
      a.classList.add('nav-cta');
      a.classList.remove('button', 'primary', 'secondary', 'accent');
    });
    search = buildSearch(searchLink);
    (searchLink?.closest('p') || searchLink)?.remove();
    const wrapper = tools.querySelector('.default-content-wrapper') || tools;
    wrapper.append(search.toggle, search.form);
  }

  // menu panel: everything except the brand (inline on desktop, dialog on mobile)
  const menu = document.createElement('div');
  menu.className = 'nav-menu';
  menu.id = nextId('nav-menu');
  const menuBar = document.createElement('div');
  menuBar.className = 'nav-menu-bar';
  const brandClone = brand?.querySelector('.nav-logo')?.cloneNode(true);
  if (brandClone) menuBar.append(brandClone);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'nav-menu-close';
  closeBtn.append('Close', visuallyHidden(' menu'), iconSpan('close'));
  menuBar.append(closeBtn);
  menu.append(menuBar);
  if (sections) menu.append(sections);
  if (tools) menu.append(tools);

  const menuToggle = document.createElement('button');
  menuToggle.type = 'button';
  menuToggle.className = 'nav-menu-toggle';
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-controls', menu.id);
  menuToggle.append(visuallyHidden('Open '), 'Menu');
  nav.append(menuToggle, menu);
  decorateIcons(nav);

  /* mobile dialog */
  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const items = focusablesIn(menu);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const setMenuOpen = (open, { returnFocus = true } = {}) => {
    menu.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-menu-open', open);
    if (open) {
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-modal', 'true');
      menu.setAttribute('aria-label', 'Site navigation');
      menu.addEventListener('keydown', trapFocus);
      closeBtn.focus();
    } else {
      menu.removeAttribute('role');
      menu.removeAttribute('aria-modal');
      menu.removeAttribute('aria-label');
      menu.removeEventListener('keydown', trapFocus);
      if (list) closeAllItems(list);
      if (returnFocus) menuToggle.focus();
    }
  };
  menuToggle.addEventListener('click', () => setMenuOpen(true));
  closeBtn.addEventListener('click', () => setMenuOpen(false));

  /* desktop inline search */
  const setSearchOpen = (open, { returnFocus = true } = {}) => {
    if (!search) return;
    nav.classList.toggle('search-open', open);
    search.toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      if (list) closeAllItems(list);
      search.input.focus();
    } else if (returnFocus) search.toggle.focus();
  };
  search?.toggle.addEventListener('click', () => setSearchOpen(true));
  search?.form.querySelector('.nav-search-close').addEventListener('click', () => setSearchOpen(false));

  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (nav.classList.contains('search-open') && isDesktop.matches) setSearchOpen(false);
    else if (menu.classList.contains('is-open') && !isDesktop.matches) setMenuOpen(false);
    else if (list) {
      const open = list.querySelector(':scope > li.is-open');
      if (open) closeItem(open, { focusToggle: true });
    }
  });

  // reset open states when switching between mobile and desktop
  isDesktop.addEventListener('change', () => {
    setMenuOpen(false, { returnFocus: false });
    setSearchOpen(false, { returnFocus: false });
    if (list) closeAllItems(list);
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
