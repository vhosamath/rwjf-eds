# Content packages

AEM FileVault content packages produced by the Edge Delivery migration, for installation
through CRX Package Manager on the AEM 6.5 author. This branch holds no site code and the
packages are excluded from Edge Delivery code sync (`.hlxignore`).

| Package | Filter roots | Notes |
|---|---|---|
| `packages/rwjf-eds-nav-1.0.0.zip` | `/content/rwjf-eds/nav` | **Current header.** Global nav fragment page (needs the `nav` branch code): logo link, nested list of menu items and sub-links, "Find A Grant" and the Search link. No DAM assets: icons come from the code |
| `packages/rwjf-eds-footer-1.1.0.zip` | `/content/rwjf-eds/footer` | **Current footer.** Same as 1.0.1, but the hidden newsletter placeholder is replaced by the "Stay informed" Newsletter block (endpoint `https://dev-sp3.rwjf.cloud/action/servlets/subscription`, reCAPTCHA site key `6Ld7dq…Hmi1w`; set the endpoint to `mock` to test). Needs the `newsletter` branch code |
| `packages/rwjf-eds-footer-1.0.1.zip` | same | Superseded by 1.1.0. Footer with a hidden newsletter placeholder; the address links to a comma-free Google Maps search URL |
| `packages/rwjf-eds-footer-1.0.0.zip` | same | Superseded by 1.0.1 (AEM added `%20` after the commas in its Maps link) |
| `packages/rwjf-eds-am-2026-1.0.3.zip` | `/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/answering-the-call-for-a-healthy-inclusive-democracy`, `/content/rwjf-eds/fragments/about-rwjf`, `/content/dam/rwjf-eds/annual-messages/2026`, `/content/dam/rwjf-eds/shared` | **Current.** Fixes the missing title of 1.0.2: the hero byline is its own Byline field (`byline`) instead of `text_byline`, which AEM rendered in place of the title. **Needs the `hero-byline-fix` code: merge it to `main` first**, then install and Quick Publish the article; the fragment is unchanged |
| `packages/rwjf-eds-am-2026-1.0.2.zip` | same | **Do not use.** With the published code its title is missing (byline stored as `text_byline`) |
| `packages/rwjf-eds-am-2026-1.0.1.zip` | same | Superseded by 1.0.2 (byline only in page properties) |
| `packages/rwjf-eds-am-2026-1.0.0.zip` | same | Superseded by 1.0.1 (no breadcrumb). 2026 annual message "Answering the Call for a Healthy, Inclusive Democracy" plus the reusable "About the Robert Wood Johnson Foundation" fragment page it references. DAM: 7 page images in `2026` (hero, Sacramento, quote photo, video poster, 3 Instagram placeholders), 3 card images in `shared`. Needs the `migrate-am-2026` branch code (merge it to `main` before publishing) |
| `packages/rwjf-eds-presidents-message-2015-1.0.1.zip` | `/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015`, `/content/dam/rwjf-eds/annual-messages/2015` | **Current.** "Download annual message" moved from the hero into the intro section (section style `intro`, needs the `layout-fixes` code) |
| `packages/rwjf-eds-presidents-message-2015-1.0.0.zip` | same | Superseded by 1.0.1 |

Install: Package Manager → Upload Package → Install. All filter roots install in replace mode.
For the page package, run Reprocess Assets on `/content/dam/rwjf-eds/annual-messages/2015`
afterwards. For the footer and nav, preview `/content/rwjf-eds/footer` or `/content/rwjf-eds/nav` from AEM so every page picks it up, then publish with the Sidekick on the `.page` URL.
For the 2026 annual message, Quick Publish (edge-delivery-preview agent) both
`/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/answering-the-call-for-a-healthy-inclusive-democracy`
and `/content/rwjf-eds/fragments/about-rwjf`, including referenced assets; without the fragment the About section stays empty.
