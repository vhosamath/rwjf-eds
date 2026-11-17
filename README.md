# Content packages

AEM FileVault content packages produced by the Edge Delivery migration, for installation
through CRX Package Manager on the AEM 6.5 author. This branch holds no site code and the
packages are excluded from Edge Delivery code sync (`.hlxignore`).

| Package | Filter roots | Notes |
|---|---|---|
| `packages/rwjf-eds-presidents-message-2015-1.0.1.zip` | `/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015`, `/content/dam/rwjf-eds/annual-messages/2015` | **Current.** "Download annual message" moved from the hero into the intro section (section style `intro`, needs the `layout-fixes` code) |
| `packages/rwjf-eds-presidents-message-2015-1.0.0.zip` | same | Superseded by 1.0.1 |

Install: Package Manager → Upload Package → Install, then run Reprocess Assets on
`/content/dam/rwjf-eds/annual-messages/2015`. Both roots install in replace mode.
