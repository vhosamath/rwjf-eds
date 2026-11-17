#!/usr/bin/env node
/* eslint-disable */
/**
 * Builds an AEM FileVault content package (zip) for one imported xwalk page and its DAM assets,
 * for installation through CRX Package Manager on a self-hosted AEM author.
 *
 *   node tools/importer/build-content-package.mjs \
 *     --page content/en/about-rwjf/.../presidents-message-2015.plain.html \
 *     --site-root /content/rwjf-eds \
 *     --dam-root /content/dam/rwjf-eds/annual-messages/2015 \
 *     --asset 2015_RWJF_PresidentsMessage.pdf=https://www.rwjf.org/content/dam/files/.../2015_RWJF_PresidentsMessage.pdf \
 *     --name rwjf-eds-presidents-message-2015 --out migration-work/package
 *
 * What it does:
 *  1. Rewrites every Scene7 image in the page (body + metadata) to a DAM path under --dam-root and
 *     downloads a 2000px JPEG rendition of it as the asset original.
 *  2. Downloads the extra --asset files (e.g. the PDF the page links to under --dam-root).
 *  3. Converts the page to JCR with the same converters the xwalk content check uses
 *     (helix-html2md + helix-md2jcr against this project's component models), then fixes property
 *     types (publication-date -> Date, read-time -> Long) and block-in-paragraph wrapping.
 *  4. Writes jcr_root + META-INF/vault (filter.xml with exactly two roots: the page and --dam-root)
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

const CONVERTERS = opt('converters', '/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts/node_modules/@adobe');
const pageFile = opt('page');
const siteRoot = opt('site-root', '/content/rwjf-eds');
const damRoot = opt('dam-root');
const pkgName = opt('name', 'content-package');
const pkgGroup = opt('group', 'rwjf-eds');
const pkgVersion = opt('version', '1.0.0');
const outDir = opt('out', 'migration-work/package');
const extraAssets = optAll('asset').map((a) => {
  const [file, url] = a.split(/=(.+)/);
  return { file, url };
});
if (!pageFile || !damRoot) {
  console.error('usage: --page <content/**.plain.html> --dam-root /content/dam/... [--asset file=url] [--name n]');
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
const contentRel = relative('content', pageFile).replace(/\.plain\.html$/, '');
const pagePath = `${siteRoot}/${contentRel}`;
let html = readFileSync(pageFile, 'utf8');

const assets = new Map(); // file name -> { url, alt }
html = html.replace(/<img([^>]*?)src="(https:\/\/rwjf\.scene7\.com\/is\/image\/rwjf\/([^"?:]+)[^"]*)"([^>]*)>/g, (m, pre, src, name, post) => {
  const file = `${name}.jpg`;
  const alt = decode(/alt="([^"]*)"/.exec(`${pre} ${post}`)?.[1] || '');
  if (!assets.has(file)) {
    assets.set(file, { url: `https://rwjf.scene7.com/is/image/rwjf/${name}?wid=2000&fmt=jpg&qlt=85`, alt });
  } else if (alt && !assets.get(file).alt) assets.get(file).alt = alt;
  return `<img${pre}src="${damRoot}/${file}"${post}>`;
});
extraAssets.forEach(({ file, url }) => assets.set(file, { url, alt: '' }));

// ---------------------------------------------------------------- 2. convert to JCR
const models = JSON.parse(readFileSync('component-models.json', 'utf8'));
const definition = JSON.parse(readFileSync('component-definition.json', 'utf8'));
const filters = JSON.parse(readFileSync('component-filters.json', 'utf8'));
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

const leftovers = pageXml.match(/https:\/\/rwjf\.scene7\.com[^"&]*/g);
if (leftovers) console.warn('WARN: Scene7 URLs left in page XML:', [...new Set(leftovers)]);

// ---------------------------------------------------------------- 3. write the package tree
rmSync(outDir, { recursive: true, force: true });
const root = join(outDir, 'build');
const jcrRoot = join(root, 'jcr_root');
const write = (p, data) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, data);
};
const nodeDir = (path) => join(jcrRoot, ...path.split('/').filter(Boolean).map((s) => s.replace(/^jcr:/, '_jcr_')));

write(join(nodeDir(pagePath), '.content.xml'), pageXml);

// ancestor page stubs between <site-root>/<lang> and the page (titles from the breadcrumb)
const crumbTitles = [...html.matchAll(/<li>\s*(?:<a [^>]*>)?([^<]+?)(?:<\/a>)?\s*<\/li>/g)].map((m) => decode(m[1].trim()));
const segments = contentRel.split('/');
for (let i = 1; i < segments.length - 1; i += 1) {
  const path = `${siteRoot}/${segments.slice(0, i + 1).join('/')}`;
  const title = crumbTitles[i - 1] || segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  write(join(nodeDir(path), '.content.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="cq:Page">
  <jcr:content cq:template="/libs/core/franklin/templates/page" sling:resourceType="core/franklin/components/page/v1/page" jcr:primaryType="cq:PageContent" jcr:title="${xmlAttr(title)}">
    <root jcr:primaryType="nt:unstructured" sling:resourceType="core/franklin/components/root/v1/root"/>
  </jcr:content>
</jcr:root>
`);
}

// DAM folders: ancestors under /content/dam as stubs, the filter root as an ordered folder
const damSegments = damRoot.split('/').filter(Boolean);
for (let i = 2; i < damSegments.length; i += 1) {
  const path = `/${damSegments.slice(0, i + 1).join('/')}`;
  const isRoot = i === damSegments.length - 1;
  write(join(nodeDir(path), '.content.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root ${NS} jcr:primaryType="${isRoot ? 'sling:OrderedFolder' : 'sling:Folder'}">
  <jcr:content jcr:primaryType="nt:unstructured" jcr:title="${xmlAttr(damSegments[i])}"/>
</jcr:root>
`);
}

// assets
const downloaded = [];
for (const [file, { url, alt }] of assets) {
  // eslint-disable-next-line no-await-in-loop
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download failed ${resp.status}: ${url}`);
  // eslint-disable-next-line no-await-in-loop
  const data = Buffer.from(await resp.arrayBuffer());
  const ext = file.split('.').pop().toLowerCase();
  const mime = MIME[ext] || resp.headers.get('content-type') || 'application/octet-stream';
  const assetDir = nodeDir(`${damRoot}/${file}`);
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
  downloaded.push({ path: `${damRoot}/${file}`, bytes: data.length, mime });
}

// vault metadata
write(join(root, 'META-INF', 'vault', 'filter.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
    <filter root="${pagePath}"/>
    <filter root="${damRoot}"/>
</workspaceFilter>
`);
write(join(root, 'META-INF', 'vault', 'properties.xml'), `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
<comment>FileVault Package Properties</comment>
<entry key="name">${pkgName}</entry>
<entry key="group">${pkgGroup}</entry>
<entry key="version">${pkgVersion}</entry>
<entry key="description">Migrated page ${pagePath} and its assets under ${damRoot}</entry>
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
writeFileSync(join(outDir, 'page.xml'), pageXml);

console.log(JSON.stringify({
  zip: zipFile, page: pagePath, filters: [pagePath, damRoot], assets: downloaded,
}, null, 2));
if (!existsSync(zipFile)) process.exit(1);
