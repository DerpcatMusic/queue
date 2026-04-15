# App Store Compliance Guide: Sports Marketplace App
## Apple App Store & Google Play Store Publishing Requirements

> **Why this document matters:**  
> This is the single source of truth for everything required to publish your sports marketplace app (Expo + Convex + Stripe payments + KYC for instructors) on both the Apple App Store and Google Play Store. Missing any of these items will result in rejection or removal. This document covers legal requirements, payment compliance, identity verification, accessibility, and platform-specific rules.

---

## Document Purpose & Scope

This guide documents all requirements for publishing a **sports marketplace app** on both major app stores. This app:
- Connects users with sports instructors (marketplace model, Uber-style)
- Uses **Stripe** for payments (paying instructors via Stripe Connect)
- Performs **KYC** identity verification on instructors
- Has **no subscriptions** (one-time bookings for physical services)

This is a living document. Review before each major release.

---

## PART 1: DEVELOPER ACCOUNTS

### Apple App Store

| Item | Cost | Notes |
|------|------|-------|
| Apple Developer Program | **$99 USD/year** | Individual (no DUNS) or Organization (DUNS required) |
| D-U-N-S Number | Free (takes ~5 business days) | Required only for Organization account type |

**Enrollment URL:** https://developer.apple.com/programs/enroll

- No DUNS required for individual accounts
- Two-factor authentication required on all accounts
- Fee waivers available for nonprofits, educational institutions, government entities

### Google Play Store

| Item | Cost | Notes |
|------|------|-------|
| Google Play Developer Account | **$25 one-time** | Individual or Company |
| Identity Verification | Included | Government ID verification required |
| D-U-N-S Number | Required for companies | Same free lookup as Apple |

**Enrollment URL:** https://play.google.com/console

---

## PART 2: MANDATORY LEGAL DOCUMENTS

You **cannot publish** without these three documents. Both stores require accessible URLs and in-app availability.

### 2.1 Privacy Policy

**Required on:** Both Apple App Store and Google Play Store

**Must include:**
- **Data collected:** Personal info, KYC documents, payment info, device identifiers, location
- **Third-party sharing:** Stripe, KYC provider, analytics SDKs
- **User rights:** How to access, correct, delete personal data
- **Data retention:** How long data is kept, deletion timelines
- **Cookie/tracking practices:** What cookies are used, consent mechanism
- **GDPR-specific (EU users):** Cookie consent, lawful basis for processing, DPO contact, international transfer safeguards, right to withdraw consent, right to lodge complaint
- **CCPA-specific (California users):** Right to know, right to delete, right to opt-out of sale/sharing, right to non-discrimination
- **Contact info:** Email or form for data privacy questions

**Placement requirements:**
- Apple: Privacy policy URL in App Store Connect → App Privacy section + accessible within app
- Google: Privacy policy URL in Play Console → Store listing section + accessible within app
- URL must be a valid HTTPS URL that works

### 2.2 Terms of Service

**Required on:** Both stores (strongly recommended, implicitly required for marketplace)

**Must include:**
- **Legal entity name:** Full business name (e.g., "Acme Sports Marketplace, Inc."), no aliases
- **Registered address:** Physical address for legal service
- **Contact email:** For user inquiries
- **Instructor classification:** Clear statement that instructors are independent contractors, not employees
- **Liability limitations:** Platform's role as intermediary, not guarantor of instructor content
- **Indemnification:** User indemnification for content they post, instructor indemnification for their services
- **Dispute resolution:** Recommended: arbitration clause with class action waiver, choice of governing law (Delaware is common), opt-out period 30 days
- **1099/tax responsibilities:** Instructors are responsible for their own tax obligations, platform will issue required tax forms
- **Prohibited uses:** What users/instructors cannot do

### 2.3 DMCA Agent Registration

**Recommended for:** Platforms with user-generated content

- Register DMCA agent with US Copyright Office
- Required for Section 230 safe harbor protection
- Establish repeat infringer termination policy
- Provides protection from liability for user-posted content

---

## PART 3: APPLE APP STORE REQUIREMENTS

### 3.1 App Store Review Guidelines — Critical Rules

#### Payments (Guideline 3.1.1 and 3.1.3)

**The golden rule:** Digital goods/services purchased in-app MUST use In-App Purchase. Physical goods/services MAY use external payment processors.

| Category | Payment Method Required |
|----------|------------------------|
| Digital goods (video courses, downloadable content) | **In-App Purchase only** |
| Digital subscriptions (premium features) | **In-App Purchase only** |
| Physical goods (equipment, merchandise) | **Apple Pay or Stripe** |
| Physical services (sports instruction, gym) | **Apple Pay or Stripe** |
| Services delivered in-person | **Apple Pay or Stripe** |

**Your app is classified as:** Physical services (sports instruction) — Stripe is permitted.

**Prohibited:** Buttons/links to external websites for purchasing physical services. Use Apple Pay or Stripe credit card entry in-app.

**If operating in EU:** Alternative payment links may be available via StoreKit External Purchase Link Entitlement (DMA compliance).

#### Sign-In with Apple (Guideline 4.8)

**Required if:** You use any third-party OAuth login (Google, Facebook, etc.)

**Not required if:** You use only your own proprietary email/password account system

If third-party social login is offered, you MUST offer Sign in with Apple as an equivalent alternative. The alternative must allow users to hide their email.

### 3.2 App Tracking Transparency (ATT)

**Required if:** Your app accesses Identifier for Advertisers (IDFA) for tracking across apps/websites

**If NOT using IDFA for tracking:** Add to Info.plist:
```xml
<key>NSUserTrackingUsageDescription</key>
<string>We do not track you across apps or websites.</string>
```

Declare accurately in Privacy Nutrition Labels. If you don't use IDFA, you can skip the ATT prompt but must declare non-tracking in privacy labels.

### 3.3 Privacy Nutrition Labels (Mandatory)

Required in App Store Connect for all new submissions and updates. Must accurately declare ALL data types collected:

| Data Type | Declaration | Your App? |
|-----------|-------------|-----------|
| Financial info (payment info, transaction history) | Data linked to you | Yes — Stripe payments |
| Contact info (name, email, phone) | Data linked to you | Yes |
| Identifiers (device ID, user ID) | Data linked to you | Yes |
| Camera (document capture for KYC) | Data linked to you | Yes |
| Location (precise/approximate) | Data linked to you | If using |
| Health & Fitness | Depends | Likely No |
| Usage data | Depends | If analytics |

### 3.4 Required Metadata

| Field | Limit | Notes |
|-------|-------|-------|
| App Name | 30 characters | No trademarked terms, no competitor names |
| Subtitle | 30 characters | Additional context, not duplicate title keywords |
| Description | 4,000 characters | First 3 lines visible before "more" — front-load value |
| Keywords | 100 characters | Comma-separated, no spaces after commas |
| Privacy Policy URL | Required | Must be functional HTTPS |
| Support URL | Required | Must be functional |
| Age Rating | Required | Complete questionnaire honestly |

**Screenshots required:**
- iPhone 6.5" (1284×2778) — minimum 1 portrait
- iPhone 5.5" (1242×2208) — minimum 1 portrait
- iPad Pro 12.9" (2048×2732) — minimum 1 portrait if iPad supported

**App Preview Video:** Optional, 15-30 seconds, must show actual app in use.

### 3.5 Security Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| HTTPS for all network connections | **Mandatory** | ATS cannot be disabled in production |
| IPv6-only network support | **Mandatory** | Required for all apps |
| Keychain for sensitive data | **Mandatory** | Auth tokens, KYC tokens, payment tokens |
| No logging of sensitive data | **Mandatory** | Never log card numbers, CVV, tokens |
| Data Protection API for files | **Recommended** | NSFileProtectionComplete for sensitive files |

### 3.6 Content Standards

- No offensive, defamatory, or discriminatory content
- User-generated content must be moderated
- Age restriction mechanism required for content exceeding app's age rating
- No pornographic, violent, or hate speech content

---

## PART 4: GOOGLE PLAY STORE REQUIREMENTS

### 4.1 Target API Level — CRITICAL UPDATE

**Deadline: August 31, 2025**

| Requirement | Deadline |
|-------------|----------|
| New apps must target API level 35 (Android 15) | August 31, 2025 |
| App updates must target API level 35 | August 31, 2025 |
| Exception available | Up to November 1, 2025 with justification |

Update your `build.gradle`:
```groovy
android {
    compileSdk 35  // Must be 35+
    defaultConfig {
        minSdk 26  // Recommended minimum 26
    }
}
```

### 4.2 Data Safety Form (Mandatory)

Must be completed in Play Console before publishing. Must accurately reflect actual data practices:

**Required declarations:**
- All data collected (personal info, KYC documents, payment info)
- Whether data is linked to user
- Third-party sharing (Stripe, KYC provider)
- Security practices (encryption in transit, encryption at rest)
- Data deletion capability (how users can request deletion)

**Permissions Declaration Form:** Required during review if requesting Camera permission (KYC document capture). Must explain why camera access is needed.

### 4.3 Required Metadata

| Field | Limit | Notes |
|-------|-------|-------|
| App Name | 50 characters | Include primary keyword |
| Short Description | 80 characters | Front-load most important info |
| Full Description | 4,000 characters | Indexed for search, include keywords naturally |
| Privacy Policy URL | Required | Must be functional HTTPS |
| Screenshots | Minimum 2 | 1080×1920 recommended (8 max) |
| Feature Graphic | 1024×500 | Branded, compelling imagery |
| App Icon | 512×512 | PNG, ≤1MB |

### 4.4 Content Rating

Complete PEGI questionnaire (Pan European Game Information). For a sports marketplace likely PEGI 3 (suitable for all ages) or PEGI 7 (contains situations unsuitable for young children).

Also complete IARC questionnaire for US rating (Everyone, Teen, Mature).

### 4.5 Security Requirements

```xml
<!-- AndroidManifest.xml -->
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="false"
    ...>
```

All network traffic must be HTTPS. No HTTP endpoints allowed in production.

### 4.6 Play Protect Compliance

- No malware, spyware, or deceptive behavior
- No overlay attacks (use FLAG_SECURE on sensitive screens)
- No dark patterns in ads or UX

---

## PART 5: STRIPE/PAYMENTS COMPLIANCE

### 5.1 What Stripe Handles For You

Under your current architecture (Stripe mobile SDK with client-side tokenization):
- **PCI DSS SAQ-A compliance** — You're Scope 2 (payment facilitator)
- **Cardholder data tokenization** — Raw card data never touches your servers
- **Card brand tokenization** — Visa, Mastercard, etc.
- **3D Secure authentication flow**
- **Fraud detection** (Stripe Radar)

### 5.2 What YOU Must Handle

1. **Stripe Connect for Instructor Payouts**
   - Use Express accounts for instructors (recommended)
   - Platform collects fee via `application_fee_amount`
   - Instructors receive payouts via connected account

2. **Payment Flow:**
   ```
   Customer → Platform charge → Your platform fee → Transfer to instructor's Connect account
   ```

3. **Webhook Security:** Verify `stripe-signature` header on all Stripe webhooks in your Convex backend

4. **PCI DSS Annual Requirements:**
   - Complete SAQ A self-assessment annually
   - Never log card numbers, CVV, expiration dates
   - Verify Stripe webhooks are authentic
   - Use TLS 1.2+ on all endpoints

5. **1099 Filing Requirements:**
   - **Form 1099-K:** Triggered at $5,000 AND 200 transactions (2025 threshold)
   - **Form 1099-MISC:** $600+ for services to independent contractors
   - Issue by January 31, file with IRS by February 28 (paper) or March 31 (electronic)

### 5.3 Restricted Business Categories

Sports instruction is **generally allowed** but verify with Stripe before launch for your specific activities. High-risk activities (professional fighting, extreme sports) may require additional review.

**Prohibited:** Illegal activities, adult content, gambling, counterfeit goods.

---

## PART 6: KYC (KNOW YOUR CUSTOMER) COMPLIANCE

### 6.1 Apple App Store Requirements

**Privacy labels must declare:**
- Camera access for document capture → "Photos/Media/Library" + "Camera" categories
- Face ID/Touch ID usage for identity verification → "Biometric Info" category
- Government ID documents → "Identity Documents" under Personal Info

**Info.plist requirements:**
```xml
<key>NSCameraUsageDescription</key>
<string>We need camera access to verify your identity by capturing your government ID and a selfie for KYC verification required to become an instructor on our platform.</string>
<key>NSFaceIDUsageDescription</key>
<string>We use Face ID to securely verify your identity for KYC verification.</string>
```

### 6.2 Google Play Store Requirements

**Data Safety Form must declare:**
- Identity documents (government IDs)
- Biometric data (selfies for liveness verification)
- Third-party sharing (your KYC provider, Stripe)

**Permission Declaration Form:** Required during review for Camera permission. Explain it's for KYC document capture.

**Video demo:** May be required to demonstrate KYC flow for financial/high-risk category review.

### 6.3 In-App KYC Requirements

**Consent screen must explain:**
1. What data is collected (government ID, selfie, personal info)
2. Why it's required (identity verification for instructor payouts)
3. Who it's shared with (Stripe, KYC provider)
4. How long it's retained (minimum 7 years per financial compliance)
5. How to request deletion
6. Alternative verification path for users who cannot complete digital KYC

**Data retention:** Minimum 7 years (financial compliance standard). Document in privacy policy.

**Alternative verification path required for:**
- Users with disabilities preventing digital KYC completion
- Provide phone/chat support for manual verification

---

## PART 7: SPORTS/FITNESS INDUSTRY REQUIREMENTS

### 7.1 Instructor Requirements

| Requirement | Minimum |
|-------------|---------|
| Minimum age | 18 years old (21+ for high-risk activities like martial arts) |
| Background checks | Strongly recommended (especially for youth instruction) |
| Certifications | Nationally recognized (ACE, NASM, ACSM, NSCA for fitness; activity-specific orgs) |
| Insurance | $1M+ general liability required |
| CPR/AED | Typically required |
| Independent contractor agreement | Required (ABC test compliance for California AB5) |

### 7.2 Student/User Requirements

| Requirement | Notes |
|-------------|-------|
| Age verification | At account creation |
| Parental consent | For minors (under 18) |
| Health questionnaire | PAR-Q or equivalent recommended |
| Liability waiver | Activity-specific risk disclosure, digital signature |
| Emergency contact | Required at booking |

### 7.3 Platform Insurance (Recommended)

| Coverage | Minimum |
|----------|---------|
| General Liability | $1M/occurrence |
| Professional Liability (E&O) | $1M |
| Cyber Liability | $500K |
| Umbrella | $2M |

### 7.4 Age Restrictions Summary

| Role | Minimum Age |
|------|-------------|
| Instructors | 18 (21+ for contact sports, martial arts, high-intensity) |
| Students booking without parent | 16 |
| Minors with supervision | Any age with parent/guardian consent and waiver |

---

## PART 8: SECURITY REQUIREMENTS

### 8.1 iOS Security

```swift
// Keychain storage for sensitive tokens
let query: [String: Any] = [
    kSecClass: kSecClassGenericPassword,
    kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    kSecAttrAccount: "refresh_token",
    kSecValueString: token
]
```

- Use Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for auth tokens
- Never store sensitive data in UserDefaults, NSUserDefaults, or files
- Use Data Protection API (`NSFileProtectionComplete`) for files containing sensitive data

### 8.2 Android Security

```kotlin
// EncryptedSharedPreferences for token storage
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val securePrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

- Use EncryptedSharedPreferences (Jetpack Security Crypto 1.0+) for tokens
- Never store sensitive data in plain SharedPreferences
- Use Android Keystore for cryptographic keys

### 8.3 Network Security

**iOS (ATS in Info.plist):**
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

**Android (network_security_config.xml):**
```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

### 8.4 Certificate Pinning (Recommended)

For production apps handling payments and KYC:
- Pin Stripe's API domains
- Pin your Convex deployment domain
- Use OWASP TrustKit or manual pinning
- Plan for certificate rotation

### 8.5 GDPR Breach Notification

**72-hour rule:** Under GDPR Article 33, you must notify your supervisory authority within 72 hours of becoming aware of a personal data breach.

Required procedures:
- Breach detection and monitoring (Convex audit logs, CloudWatch/GCP logging)
- Incident response plan with defined roles
- Breach assessment procedure
- Notification templates for supervisory authority and affected users

---

## PART 9: ACCESSIBILITY REQUIREMENTS

### 9.1 Not Formally Enforced During Review But...

**Apple:**
- VoiceOver support strongly recommended
- Dynamic Type support strongly recommended
- 44×44pt minimum touch targets (Apple HIG recommendation)
- Color contrast 4.5:1 for text, 3:1 for UI components

**Google:**
- TalkBack support required
- 48dp minimum touch targets (Android requirement)
- `contentDescription` required for all meaningful elements
- Color contrast 4.5:1 for text, 3:1 for UI components

### 9.2 Legal Requirements That DO Apply

**European Accessibility Act (EAA) — Effective June 28, 2025:**
- Applies to e-commerce services including booking systems
- Must publish accessibility statement
- Must meet WCAG 2.1 Level AA (EN 301 549 standard)
- **Alternative access method for camera-based KYC required**

**ADA (US):** Courts increasingly rule that apps are "places of public accommodation." While no explicit DOJ rule for apps, compliance with WCAG 2.1 AA is the recommended standard to avoid lawsuits.

### 9.3 WCAG 2.1 Level AA Minimum Requirements

| Criterion | Requirement |
|-----------|-------------|
| Contrast | 4.5:1 for text <18pt, 3:1 for large text/UI |
| Resize text | Support 200% zoom without loss |
| Keyboard accessible | All functions via keyboard/switch |
| Focus visible | Visible focus indicator |
| Error identification | Errors clearly described |
| Labels/instructions | Labels provided for all inputs |

### 9.4 KYC Flow Accessibility

Camera-based identity verification is a known accessibility challenge. Required accommodation:

- Audio guidance for document positioning
- Haptic feedback for successful capture
- Alternative verification path: "Call support for manual verification"
- Screen reader announces each step: "Step 1 of 3: Take photo of ID"
- All instructions available in text AND audio

---

## PART 10: MONEY TRANSMITTER & LICENSING

### 10.1 US Federal Requirements (FinCEN)

- Register as **Money Services Business (MSB)** with FinCEN if holding funds between buyers and instructors
- Maintain written **AML (Anti-Money Laundering) program**
- File **SARs (Suspicious Activity Reports)** for suspicious transactions
- Implement **KYC procedures** for all users

### 10.2 State Licenses

Many states require separate money transmitter licenses:
- **California:** DFPI license required
- **New York:** BitLicense or traditional MT license via DFS
- **Texas, Illinois, Florida, Washington:** Separate licenses required

"Marketplace facilitator" licenses may apply in addition to or instead of traditional money transmitter licenses.

### 10.3 Stripe's Role

If using Stripe Connect for instructor payouts, Stripe acts as the licensed money transmitter in most jurisdictions. However:
- Consult a money transmitter attorney for your specific payment flow
- Some states may still require platform-level licensing
- Implement OFAC sanctions screening for all users

### 10.4 Travel Rule

For transfers over $3,000: Must include sender and recipient information. Information must travel with the transfer. Applies to both international and domestic transfers.

---

## COMPLETE CHECKLIST

### 🔴 MUST HAVE (Rejection/Removal if missing)

**Legal:**
- [ ] Privacy policy URL in App Store Connect and Play Console
- [ ] Privacy policy accessible within app
- [ ] Privacy policy GDPR/CCPA compliant
- [ ] Terms of Service in-app with legal entity name, address, contact
- [ ] Independent contractor classification for instructors in ToS

**Apple App Store:**
- [ ] Apple Developer Program membership ($99/year)
- [ ] Privacy nutrition labels completed accurately
- [ ] ATT prompt or non-tracking declaration in Info.plist
- [ ] HTTPS enforced on all network connections (ATS)
- [ ] IPv6-only network support
- [ ] Crash-free binary (no obvious bugs)
- [ ] All screenshots show real app (no placeholders, no lorem ipsum)
- [ ] Functional support URL and privacy policy URL
- [ ] Sign in with Apple offered (if using any OAuth)
- [ ] Physical services using Stripe (permitted) vs IAP for digital goods

**Google Play Store:**
- [ ] Google Play Developer account ($25)
- [ ] Data Safety form completed accurately
- [ ] Target API 35 (Android 15) — Deadline August 31, 2025
- [ ] HTTPS enforced, cleartextTrafficPermitted="false"
- [ ] Permissions justification for Camera (KYC)
- [ ] Screenshots (minimum 2, 1080×1920)
- [ ] Feature graphic (1024×500)
- [ ] Content rating questionnaire completed

**Payments:**
- [ ] Stripe Connect for instructor payouts configured
- [ ] Webhook signature verification in Convex backend
- [ ] PCI SAQ A completed (annual)
- [ ] 1099 workflow implemented for instructors
- [ ] No logging of sensitive payment data

**KYC:**
- [ ] Consent screen before document collection
- [ ] Camera permission explanation in app (Info.plist)
- [ ] Face ID usage explanation (if applicable)
- [ ] Data retention/deletion policy documented
- [ ] Alternative verification path for accessibility

### 🟡 HIGHLY RECOMMENDED (Common rejection reasons)

- [ ] DMCA agent registration (safe harbor protection)
- [ ] Accessibility statement (required for EU June 2025)
- [ ] Instructor background check system
- [ ] Certificate pinning for payments/KYC
- [ ] Platform insurance portfolio ($1M+ general liability)
- [ ] Money transmitter legal review with attorney
- [ ] GDPR breach 72-hour notification procedure documented

### 🟢 STRONGLY RECOMMENDED FOR OPERATIONS

- [ ] Annual penetration testing
- [ ] Third-party accessibility audit
- [ ] WCAG 2.1 AA compliance verification
- [ ] Instructor certification verification system
- [ ] Incident response plan documented
- [ ] Regular compliance monitoring

---

## KEY REFERENCE URLs

| Resource | URL |
|----------|-----|
| Apple Developer Program | https://developer.apple.com/programs/enroll |
| Apple App Store Review Guidelines | https://developer.apple.com/app-store/review/guidelines |
| App Store Connect Help | https://developer.apple.com/help/app-store-connect |
| Google Play Developer Console | https://play.google.com/console |
| Google Play Developer Policies | https://support.google.com/googleplay/android-developer |
| Stripe Connect | https://stripe.com/connect |
| FinCEN MSB Registration | https://www.fincen.gov/msb-registrant-search |
| D-U-N-S Number Lookup | https://developer.apple.com/support/D-U-N-S |
| European Accessibility Act | https://ec.europa.eu/social/main.jsp?catId=1202 |

---

## DOCUMENT VERSION

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-12 | Research Agent | Initial comprehensive compilation from multi-agent research |

---

> **Disclaimer:** This document is for informational purposes only and does not constitute legal advice. Consult qualified attorneys and tax professionals for jurisdiction-specific guidance, particularly for regulated activities (financial services, money transmitter licensing) and multi-state/international operations. Requirements change — verify all information against official sources before publishing.