#!/usr/bin/env node
/* eslint-disable */
/**
 * Builds an AEM FileVault content package (zip) for imported xwalk pages and their DAM assets,
 * for installation through CRX Package Manager on a self-hosted AEM author.
 *
 *   node tools/importer/build-content-package.mjs \
 *     --page content/en/about-rwjf/.../presidents-message-2015.plain.html \
 *     --site-root /content/rwjf-eds \
 *     --dam-root /content/dam/rwjf-eds/annual-messages/2015 \
 *     --asset 2015_RWJF_PresidentsMessage.pdf=https://www.rwjf.org/content/dam/files/.../2015_RWJF_PresidentsMessage.pdf \
 *     --name rwjf-eds-presidents-message-2015 --out migration-work/package
 *
 * Several pages (e.g. an article and a fragment page it references) can go in one package:
 * repeat --page; each page gets its own filter root. Other options:
 *   --dam-map <Scene7 name>=<dam root>   put that Scene7 image under another DAM folder (own filter root)
 *   --image <file>=<src substring>       a non-Scene7 <img> (e.g. a YouTube poster) whose src contains
 *                                        the substring becomes <dam-root>/<file>, downloaded from its src
 *   --image-source <file>=<url|path>     download that --image file from another URL, or read it from disk
 * Fragment references written as site paths (/fragments/x) are mapped to <site-root>/fragments/x.
 *
 * What it does:
 *  1. Rewrites every Scene7 image in the pages (body + metadata) to a DAM path under --dam-root (or
 *     its --dam-map folder) and downloads a 2000px JPEG rendition of it as the asset original;
 *     --image files likewise.
 *  2. Downloads the extra --asset files (e.g. the PDF the page links to under --dam-root).
 *  3. Converts each page to JCR with the same converters the xwalk content check uses
 *     (helix-html2md + helix-md2jcr against this project's component models), then fixes property
 *     types (publication-date -> Date, read-time -> Long) and block-in-paragraph wrapping.
 *  4. Writes jcr_root + META-INF/vault (filter.xml with each page and each DAM folder used;
 *     --dam-root is optional for pages without DAM assets, e.g. the /footer fragment)
 *     and zips it. Ancestor pages/folders are included as stubs; being outside the filter they are
 *     only created when missing and never overwritten.
 */
import {
  existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const optAll = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const pairs = (name) => optAll(name).map((a) => a.split(/=(.+)/).slice(0, 2));

const CONVERTERS = opt('converters', '/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts/node_modules/@adobe');
const pageFiles = optAll('page');
const siteRoot = opt('site-root', '/content/rwjf-eds');
const damRoot = opt('dam-root');
const pkgName = opt('name', 'content-package');
const pkgGroup = opt('group', 'rwjf-eds');
const pkgVersion = opt('version', '1.0.0');
const outDir = opt('out', 'migration-work/package');
const extraAssets = pairs('asset').map(([file, url]) => ({ file, url }));
const damMap = new Map(pairs('dam-map'));
const imageMap = pairs('image').map(([file, match]) => ({ file, match }));
const imageSources = new Map(pairs('image-source'));
if (!pageFiles.length) {
  console.error('usage: --page <content/**.plain.html> [--page …] [--dam-root /content/dam/...] [--dam-map name=root] [--image file=match] [--image-source file=url|path] [--asset file=url] [--name n]');
  process.exit(1);
}

const { html2md } = await import(`${CONVERTERS}/helix-html2md/src/index.js`);
const { md2jcr } = await import(`${CONVERTERS}/helix-md2jcr/src/index.js`);
const SILENT = {
  info() {}, debug() {}, trace() {}, warn() {}, error() {},
};

const NS = 'xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:nt="http://www.jcp.org/jcr/nt/1.0" xmlns:cq="http://www.day.com/jcr/cq/1.0" xmlns:sling="http://sling.apache.org/jcr/sling/1.0" xmlns:dam="http://www.day.com/dam/1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"';
const xmlAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = (v) => v.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

// ---------------------------------------------------------------- 1. page html + image mapping
const assets = new Map(); // DAM path -> { url, alt }
const damRoots = new Set(damRoot ? [damRoot] : []);
// Scene7 names may carry encoded spaces ("…_0362%201"): DAM node names use dashes instead
const assetName = (name) => `${decodeURIComponent(name).replace(/\s+/g, '-')}.jpg`;
const altOf = (pre, post) => decode(/alt="([^"]*)"/.exec(`${pre} ${post}`)?.[1] || '');

function mapImages(source) {
  let html = source;
  if (!damRoot && (/rwjf\.scene7\.com/.test(html) || extraAssets.length || imageMap.length)) {
    console.error('this page has Scene7 images, --image or --asset files: --dam-root is required');
    process.exit(1);
  }
  html = html.replace(/<img([^>]*?)src="(https:\/\/rwjf\.scene7\.com\/is\/image\/rwjf\/([^"?:]+)[^"]*)"([^>]*)>/g, (m, pre, src, name, post) => {
    const folder = damMap.get(decodeURIComponent(name)) || damMap.get(name) || damRoot;
    damRoots.add(folder);
    const path = `${folder}/${assetName(name)}`;
    const alt = altOf(pre, post);
    if (!assets.has(path)) {
      assets.set(path, { url: `https://rwjf.scene7.com/is/image/rwjf/${name}?wid=2000&fmt=jpg&qlt=85`, alt });
    } else if (alt && !assets.get(path).alt) assets.get(path).alt = alt;
    return `<img${pre}src="${path}"${post}>`;
  });
  // other images (e.g. YouTube posters, embed placeholders), matched by a substring of their src
  html = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (m, pre, src, post) => {
    const hit = imageMap.find(({ match }) => decode(src).includes(match));
    if (!hit) return m;
    const path = `${damRoot}/${hit.file}`;
    assets.set(path, { url: imageSources.get(hit.file) || decode(src), alt: altOf(pre, post) });
    return `<img${pre}src="${path}"${post}>`;
  });
  return html;
}

// ---------------------------------------------------------------- 2. convert to JCR
const models = JSON.parse(readFileSync('component-models.json', 'utf8'));
const definition = JSON.parse(readFileSync('component-definition.json', 'utf8'));
const filters = JSON.parse(readFileSync('component-filters.json', 'utf8'));

async function convert(html) {
  const md = await html2md(`<body><main>${html}</main></body>`, { log: SILENT });
  let pageXml = await md2jcr(md, {
    models, definition, filters, log: SILENT,
  });

  // richtext values: md2jcr wraps leading block elements in <p> (<p><h1>…</h1></p>): unwrap them
  pageXml = pageXml.replace(/&lt;p&gt;(&lt;(h[1-6]|ol|ul)&gt;[\s\S]*?&lt;\/\2&gt;)&lt;\/p&gt;/g, '$1');
  // typed page properties
  pageXml = pageXml.replace(/ publication-date="(\d{4}-\d{2}-\d{2})"/, ' publication-date="{Date}$1T12:00:00.000Z"');
  pageXml = pageXml.replace(/ read-time="(\d+)"/, ' read-time="{Long}$1"');
  // the page-metadata "image" field is a property; md2jcr writes the social image as an image node:
  // keep the node (featured image) and mirror it into the property so the UE field shows it
  const socialImage = /<image [^>]*fileReference="([^"]+)"/.exec(pageXml)?.[1];
  if (socialImage) pageXml = pageXml.replace(/(<jcr:content [^>]*?)( modelFields=)/, `$1 image="${socialImage}"$2`);
  // fragment references authored as site paths (/fragments/x) -> AEM paths
  pageXml = pageXml.replace(/ reference="(\/(?!content\/)[^"]*)"/g, (m, path) => ` reference="${siteRoot}${path}"`);
  // block styles: md2jcr writes the variant list as one string and turns "byline-large" into
  // "byline large"; restore the model's option values, and write multiselect styles as multi-value
  pageXml = pageXml.replace(/<(\w+) ([^>]*?)classes="([^"]*)"([^>]*?)model="([^"]+)"/g, (m, tag, pre, value, mid, model) => {
    const field = models.find((x) => x.id === model)?.fields.find((f) => f.name === 'classes');
    if (!field) return m;
    const options = (field.options || []).map((o) => o.value);
    const values = value.split(/\s*,\s*/).filter(Boolean)
      .map((v) => (options.includes(v) ? v : (options.find((o) => o === v.replace(/\s+/g, '-')) || v)));
    const out = field.component === 'multiselect' && values.length > 1 ? `[${values.join(',')}]` : values.join(',');
    return `<${tag} ${pre}classes="${out}"${mid}model="${model}"`;
  });
  // pages without a metadata block (e.g. fragments): title from the first heading
  if (!/<jcr:content [^>]*jcr:title=/.test(pageXml)) {
    const heading = /&lt;h[1-6]&gt;(.*?)&lt;\/h[1-6]&gt;|<title [^>]*title="([^"]+)"/.exec(pageXml);
    const title = heading && (heading[1] || heading[2]);
    if (title) pageXml = pageXml.replace(/<jcr:content /, `<jcr:content jcr:title="${title.replace(/&lt;[^&]*&gt;/g, '')}" `);
  }

  // --single-text-sections: keep each section as ONE rich-text component holding the imported HTML,
  // instead of md2jcr's title/button/text split (Title stores plain text, so links inside headings
  // would break, and link-only paragraphs would become styled buttons). Used for the /footer and /nav
  // fragments. Sections that contain a block are left as md2jcr built them.
  if (args.includes('--single-text-sections')) {
    const sectionHtml = html.split(/\n(?=<div>)/).map((chunk) => chunk.trim()).filter(Boolean)
      .map((chunk) => chunk.replace(/^<div>|<\/div>$/g, '')
        .replace(/<div class="section-metadata">[\s\S]*?<\/div><\/div><\/div>/g, '')
        .replace(/\s*\n\s*/g, '')
        .trim());
    let index = 0;
    pageXml = pageXml.replace(/<(section(?:_\d+)?) ([^>]*?)(\/?)>(?:([\s\S]*?)<\/\1>)?/g, (m, tag, attrs) => {
      const content = sectionHtml[index] || '';
      index += 1;
      // sections holding a block (e.g. the newsletter) keep md2jcr's block node
      if (/<div class="(?!section-metadata)[a-z]/.test(content)) return m;
      if (!content) return `<${tag} ${attrs}/>`;
      return `<${tag} ${attrs}>\n        <text sling:resourceType="core/franklin/components/text/v1/text" jcr:primaryType="nt:unstructured" text="${xmlAttr(content)}"/>\n      </${tag}>`;
    });
    if (index !== sectionHtml.length) console.warn(`WARN: ${index} sections in XML, ${sectionHtml.length} in HTML`);
  }

  const leftovers = pageXml.match(/https:\/\/rwjf\.scene7\.com[^"&]*/g);
  if (leftovers) console.warn('WARN: Scene7 URLs left in page XML:', [...new Set(leftovers)]);
  return pageXml;
}

// ---------------------------------------------------------------- 3. write the package tree
rmSync(outDir, { recursive: true, force: true });
const root = join(outDir, 'build');
const jcrRoot = join(root, 'jcr_root');
const write = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
};
const nodeDir = (path) => join(jcrRoot, ...path.split('/').filter(Boolean).map((s) => s.replace(/^jcr:/, '_jcr_')));
const pageStub = (title) => `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="cq:Page">
  <jcr:content cq:template="/libs/core/franklin/templates/page" sling:resourceType="core/franklin/components/page/v1/page" jcr:primaryType="cq:PageContent" jcr:title="${xmlAttr(title)}">
    <root jcr:primaryType="nt:unstructured" sling:resourceType="core/franklin/components/root/v1/root"/>
  </jcr:content>
</jcr:root>
`;

const pages = [];
for (const file of pageFiles) {
  const contentRel = relative('content', file).replace(/\.plain\.html$/, '');
  const pagePath = `${siteRoot}/${contentRel}`;
  const html = mapImages(readFileSync(file, 'utf8'));
  // eslint-disable-next-line no-await-in-loop
  const pageXml = await convert(html);
  write(join(nodeDir(pagePath), '.content.xml'), pageXml);
  pages.push({ pagePath, pageXml });

  // ancestor page stubs below the site root: language pages (/en/...) start below <site-root>/<lang>
  // (titles from the breadcrumb), other folders such as /fragments get a stub of their own
  const crumbTitles = [...html.matchAll(/<li>\s*(?:<a [^>]*>)?([^<]+?)(?:<\/a>)?\s*<\/li>/g)].map((m) => decode(m[1].trim()));
  const hasCrumbs = /class="breadcrumb/.test(html);
  const segments = contentRel.split('/');
  const first = /^[a-z]{2}$/.test(segments[0]) ? 1 : 0;
  for (let i = first; i < segments.length - 1; i += 1) {
    const path = `${siteRoot}/${segments.slice(0, i + 1).join('/')}`;
    const title = (hasCrumbs && first && crumbTitles[i - 1]) || segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    write(join(nodeDir(path), '.content.xml'), pageStub(title));
  }
}
extraAssets.forEach(({ file, url }) => assets.set(`${damRoot}/${file}`, { url, alt: '' }));

// DAM folders: ancestors under /content/dam as stubs, each filter root as an ordered folder
for (const damFolder of damRoots) {
  const damSegments = damFolder.split('/').filter(Boolean);
  for (let i = 2; i < damSegments.length; i += 1) {
    const path = `/${damSegments.slice(0, i + 1).join('/')}`;
    const isRoot = i === damSegments.length - 1;
    write(join(nodeDir(path), '.content.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="${isRoot ? 'sling:OrderedFolder' : 'sling:Folder'}">
  <jcr:content jcr:primaryType="nt:unstructured" jcr:title="${xmlAttr(damSegments[i])}"/>
</jcr:root>
`);
  }
}

// assets
const downloaded = [];
for (const [assetPath, { url, alt }] of assets) {
  const file = assetPath.split('/').pop();
  let data;
  let type = '';
  if (/^https?:/.test(url)) {
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`download failed ${resp.status}: ${url}`);
    // eslint-disable-next-line no-await-in-loop
    data = Buffer.from(await resp.arrayBuffer());
    type = resp.headers.get('content-type') || '';
  } else {
    data = readFileSync(url);
  }
  const ext = file.split('.').pop().toLowerCase();
  const mime = MIME[ext] || type || 'application/octet-stream';
  const assetDir = nodeDir(assetPath);
  write(join(assetDir, '.content.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="dam:Asset">
  <jcr:content jcr:primaryType="dam:AssetContent">
    <metadata jcr:primaryType="nt:unstructured" dc:format="${mime}" dc:title="${xmlAttr(file.replace(/\.[^.]+$/, ''))}"${alt ? ` dc:description="${xmlAttr(alt)}"` : ''}/>
    <related jcr:primaryType="nt:unstructured"/>
  </jcr:content>
</jcr:root>
`);
  write(join(assetDir, '_jcr_content', 'renditions', 'original'), data);
  write(join(assetDir, '_jcr_content', 'renditions', 'original.dir', '.content.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="nt:file">
  <jcr:content jcr:primaryType="nt:resource" jcr:mimeType="${mime}"/>
</jcr:root>
`);
  downloaded.push({ path: assetPath, bytes: data.length, mime });
}

// vault metadata
const filterRoots = [...pages.map((p) => p.pagePath), ...damRoots];
write(join(root, 'META-INF', 'vault', 'filter.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
${filterRoots.map((r) => `    <filter root="${r}"/>\n`).join('')}</workspaceFilter>
`);
write(join(root, 'META-INF', 'vault', 'properties.xml'), `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
<comment>FileVault Package Properties</comment>
<entry key="name">${pkgName}</entry>
<entry key="group">${pkgGroup}</entry>
<entry key="version">${pkgVersion}</entry>
<entry key="description">Migrated ${pages.length > 1 ? 'pages' : 'page'} ${pages.map((p) => p.pagePath).join(', ')}${damRoots.size ? ` and ${pages.length > 1 ? 'their' : 'its'} assets under ${[...damRoots].join(', ')}` : ''}</entry>
<entry key="packageType">content</entry>
<entry key="requiresRoot">false</entry>
<entry key="allowIndexDefinitions">false</entry>
<entry key="createdBy">rwjf-eds migration</entry>
</properties>
`);

// ---------------------------------------------------------------- 4. zip (no external tools)
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}
function zip(files, base) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  // META-INF first, as FileVault expects
  files.sort((a, b) => (a.includes('META-INF') === b.includes('META-INF') ? a.localeCompare(b) : (a.includes('META-INF') ? -1 : 1)));
  files.forEach((file) => {
    const name = Buffer.from(relative(base, file).split('\\').join('/'));
    const data = readFileSync(file);
    const deflated = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(deflated.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, deflated);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + deflated.length;
  });
  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
const zipFile = join(outDir, `${pkgName}-${pkgVersion}.zip`);
writeFileSync(zipFile, zip(listFiles(root), root));
pages.forEach((p, i) => writeFileSync(join(outDir, i ? `page-${i}.xml` : 'page.xml'), p.pageXml));

console.log(JSON.stringify({
  zip: zipFile, pages: pages.map((p) => p.pagePath), filters: filterRoots, assets: downloaded,
}, null, 2));
if (!existsSync(zipFile)) process.exit(1);
