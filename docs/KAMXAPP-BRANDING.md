# KamXApp Brand Identity

## Approved brand lock

- Display name: **KamXApp**
- Hindi tagline: **हर काम का एक समाधान**
- English descriptor: **India's Everyday Service Platform**
- Core palette: royal blue `#0B4FCB`, deep navy `#102A56`, saffron orange `#FF8A00`, white `#FFFFFF`
- Provisional mark: a code-drawn house-roof silhouette with a white service-wrench motif and saffron underline, based only on the written description. This is **not verified as the exact owner-approved artwork** and must not be treated as final.
- Typography direction: bold, rounded, highly legible sans-serif; preserve the approved poster's visual character.

## Application rules

1. Use the same brand name, mark, palette and tagline across Customer, Channel Partner and Admin experiences.
2. Do not redesign or substitute the approved identity without explicit owner approval.
3. Preserve all existing features, data models, authentication, Firebase project/package identifiers, booking flows, payments and service categories.
4. Treat this as a display-brand migration only. Keep the repository and Android application ID unchanged.
5. Do not publish or merge branding changes until the owner reviews the app screens and build checks pass.

## Current implementation scope

**Release hold:** the exact original approved logo artwork has not been recovered in the accessible project assets. The current SVG/Android vector are provisional approximations, not final approved artwork. Keep this PR in Draft until the original asset is verified.

- Web document title, description and PWA install metadata use KamXApp.
- Shared web dashboard header uses the KamXApp mark and Hindi tagline, so all three web roles inherit the same identity.
- Android launcher display label is KamXApp. Android package remains `com.quickfix.app`.
- Domain and trademark registration are intentionally not part of this code change.
