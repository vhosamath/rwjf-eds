# Content packages

AEM FileVault content packages produced by the Edge Delivery migration, for installation
through CRX Package Manager on the AEM 6.5 author. This branch holds no site code and the
packages are excluded from Edge Delivery code sync (`.hlxignore`).

| Package | Filter roots |
|---|---|
| `packages/rwjf-eds-presidents-message-2015-1.0.0.zip` | `/content/rwjf-eds/en/about-rwjf/our-guiding-principles/annual-messages/presidents-message-2015`, `/content/dam/rwjf-eds/annual-messages/2015` |

Install: Package Manager → Upload Package → Install, then run Reprocess Assets on
`/content/dam/rwjf-eds/annual-messages/2015`. Both roots install in replace mode.
