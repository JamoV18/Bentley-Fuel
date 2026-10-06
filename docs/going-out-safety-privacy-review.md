# Going Out safety, privacy, and platform review

Reviewed October 6, 2026. This note records product and engineering decisions; it is not legal advice or a guarantee of app-store approval.

## Implemented boundaries

- Going Out is disabled by default and requires an explicit opt-in.
- General social-event and late-night planning is available without alcohol controls.
- Alcohol forecasts and recaps require a profile that declares age 21 or older. A declared age is not government-ID verification.
- Forecasts and actual consumption use different fields. Forecasts never create nutrition history entries.
- The recommendation engine receives only the event date and schedule kind. It does not receive the forecast quantity. Its positive-only adjustment is capped at three points and only rewards an already adequate, convenient meal.
- The feature never reduces calorie targets, recommends meal skipping, treats alcohol as needed nutrition, estimates blood alcohol, predicts fitness to drive, sells alcohol, or adds streaks, challenges, badges, leaderboards, or consumption goals.
- Actual alcohol calories are distinct `night-out` nutrition entries with zero protein, carbohydrate, and fat unless a future verified source explicitly supplies those nutrients. Approximate time and nutrition are labeled.
- Plans and recaps are stored in local browser storage, scoped to the current local profile ID, and included in export/deletion controls. The prototype does not claim account-synced storage or server authorization.
- Going Out data is excluded from institutional reporting and has no advertising, social-sharing, or ordinary analytics path.

## Source review

### Apple App Review Guidelines

Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

- Guideline 1.4.3 prohibits apps that encourage excessive alcohol and rejects encouragement directed at minors.
- Guideline 1.4.4 prohibits encouragement of drunk driving or reckless behavior.
- Guideline 1.6 requires appropriate security measures for user information.
- Guidelines 2.3.1 and 2.3.6 require disclosure of non-obvious features and an accurate age rating.
- Guideline 5.1.1 requires an accessible privacy policy that explains collection, use, sharing, retention/deletion, consent, and withdrawal.

Implementation response: neutral language, 21+ alcohol controls, no purchase/promotion, no BAC or driving advice, explicit opt-in and deletion, and specific disclosure text. A production submission should describe the opt-in feature in review notes and complete the age-rating questionnaire accurately.

### Google Play inappropriate content

Source: [Tobacco and Alcohol policy](https://support.google.com/googleplay/android-developer/answer/9878810)

Google Play prohibits encouraging illegal or inappropriate alcohol use, depiction or encouragement of alcohol use by minors, and favorable portrayal of excessive, binge, or competition drinking.

Implementation response: quantities are forecasts or retrospective approximations, never recommendations or goals. A 5+ forecast triggers restrained risk information. Visuals avoid party or alcohol-promotion imagery.

### Massachusetts General Laws Chapter 138, Section 34C

Source: [Massachusetts General Laws, Chapter 138, Section 34C](https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXX/Chapter138/Section34C)

The cited section addresses possession, transport, or carrying of alcohol by people under 21, with stated exceptions. Falcon Fuel's initial production scope therefore hides alcohol-specific planning and logging for profiles under 21 or with unknown age. The feature does not facilitate purchase, delivery, or possession.

### FTC Health Breach Notification Rule

Source: [FTC business guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)

FTC guidance says the rule can cover health apps and diet apps that draw identifiable health information from multiple sources. Unauthorized disclosure, not only a cybersecurity intrusion, may trigger duties. Coverage and notification obligations depend on the production architecture and facts.

Implementation response: no third-party analytics or sharing path for Going Out data, minimal fields, browser-local storage, export, and deletion. Before adding cloud sync, connected-device data, third-party processors, or analytics, perform a documented security/privacy assessment and breach-response review.

### Standard-drink basis

Source: [NIAAA: What Is a Standard Drink?](https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink)

NIAAA defines a U.S. standard drink as about 14 grams (0.6 fl oz) of pure alcohol and notes that customary serving sizes can differ. Detailed estimates use serving volume and ABV to estimate ethanol, then use 7 kcal per gram plus entered mixer calories. If the user supplies a known total calorie value, that value replaces formula calories to prevent double counting.

## Required manual review before production distribution

1. Counsel should review age gating, Massachusetts applicability, privacy disclosures, retention, and FTC Health Breach Notification Rule coverage for the final production architecture.
2. Apple and Google submission owners should confirm current policy text, age rating, store metadata, privacy labels/data safety forms, and review notes immediately before submission.
3. Security review is required before moving these records from local storage to a backend. Server authorization and record-level access controls must be tested with separate accounts.
4. Bentley Dining should verify campus beverage inventory and nutrition sources before any catalog item is labeled currently available or verified.
5. Product/clinical review should approve safety copy and calorie-estimation assumptions before broad release.
