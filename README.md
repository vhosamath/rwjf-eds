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
| `packages/rwjf-eds-presidents-message-2015-1.0.1.zip` | `/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015`, `/content/dam/rwjf-eds/annual-messages/2015` | **Current.** "Download annual message" moved from the hero into the intro section (section style `intro`, needs the `layout-fixes` code) |
| `packages/rwjf-eds-presidents-message-2015-1.0.0.zip` | same | Superseded by 1.0.1 |

Install: Package Manager → Upload Package → Install. All filter roots install in replace mode.
For the page package, run Reprocess Assets on `/content/dam/rwjf-eds/annual-messages/2015`
afterwards. For the footer and nav, preview `/content/rwjf-eds/footer` or `/content/rwjf-eds/nav` from AEM so every page picks it up, then publish with the Sidekick on the `.page` URL.
