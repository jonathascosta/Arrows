# The App Store

What the repository holds for the App Store listing, and the steps that only the owner can take,
in order. The product rules behind them are in [PRODUCT.md](PRODUCT.md) (The iOS app,
Monetization, the decisions log); how the app is built and uploaded is in
[ARCHITECTURE.md](ARCHITECTURE.md) (iOS).

## In the repository

| What                       | Where                                                                                                                                                  |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing text, en and pt-BR | `apps/game/ios/App/fastlane/metadata/` (name, subtitle, description, keywords, promotional text, release notes, URLs, category, copyright)             |
| Screenshots, 1290 × 2796   | `apps/game/ios/App/fastlane/screenshots/{en-US,pt-BR}/`, made by `pnpm store:screenshots` from the web build                                           |
| Privacy policy             | `apps/game/privacy.html`, in both languages: in the app (Settings), and published by the Privacy policy workflow                                       |
| Privacy manifest           | `apps/game/ios/App/App/PrivacyInfo.xcprivacy`: the game's own code collects nothing and tracks no one; it reads its preferences (UserDefaults, CA92.1) |
| Tracking prompt text       | `NSUserTrackingUsageDescription` in `Info.plist`, translated in `en.lproj` and `pt.lproj/InfoPlist.strings`                                            |
| Credits                    | The game's Credits screen, with the licences of the bundled fonts (SIL Open Font License) and libraries (MIT), read from the packages at build time    |
| Upload of the listing      | The `App Store listing` workflow (`fastlane listing`), by hand                                                                                         |
| Upload of a build          | The `TestFlight` workflow (`fastlane beta`), by hand                                                                                                   |

The listing's name is **Arrows: Tap Puzzle** (Arrows was taken), subtitle "Clear the board of
arrows" ("Limpe o tabuleiro de flechas"), under Games, Puzzle and Board; on the home screen the
app is still Arrows (`CFBundleDisplayName` in `Info.plist`). The keywords leave out the words of
the name and the subtitle, which the App Store already searches. Support goes to the repository's
issues; the privacy policy is at `https://jonathascosta.github.io/Arrows/privacy.html` once
published.

## The owner's steps

1. **App Store Connect: create the app.** Done (3 October 2026): iOS, named "Arrows: Tap
   Puzzle", primary language English (U.S.), bundle id `net.jonathas.arrows`, SKU
   `net.jonathas.arrows`, full user access. The Portuguese (Brazil) localisation can be added by
   hand or left to the listing workflow (step 6), which creates it. If the listing is renamed
   again, the new name (at most 30 characters, and free on the App Store) goes in both
   `name.txt` files, and its words come out of the keywords.
2. **GitHub Pages: publish the privacy policy.** In the repository's Settings, Pages, set the
   source to GitHub Actions, then run the `Privacy policy` workflow from the Actions tab. Check
   that the address above opens the policy. Run it again whenever `privacy.html` changes.
3. **AdMob: the app, the units and the messages.**
   - Add the iOS app and its interstitial and rewarded units, and set the repository secrets
     `ADMOB_APP_ID`, `ADMOB_INTERSTITIAL_ID` and `ADMOB_REWARDED_ID` (ARCHITECTURE.md, iOS).
   - In Privacy & messaging, create and publish a European regulations (GDPR) message for the app,
     and, recommended, an IDFA explainer message: the app shows Apple's tracking prompt itself
     when the explainer does not. A US states message is optional. Without a GDPR message, the
     EEA, the UK and Switzerland get limited ads or none.
   - Once the app is live, link it to its App Store listing in AdMob.
   - Optional: `app-ads.txt` must sit at the root of the developer website's domain. With the
     github.io address, that means a `jonathascosta.github.io` repository with the file at its
     root, and that site as the listing's marketing URL.
4. **SKAdNetwork ids.** Copy Google's list of partner ids from
   <https://developers.google.com/admob/ios/3p-skadnetworks> into `SKAdNetworkItems` in
   `apps/game/ios/App/App/Info.plist`, keeping Google's own `cstr6suwn9.skadnetwork`. The session
   that prepared the app could not reach that page, and the ids must not be typed from memory.
5. **Upload a build.** Set the TestFlight workflow's secrets (ARCHITECTURE.md, iOS). The API key
   is the team's, the one Trilha uses. The certificate is new, made once for these workflows, and
   the games to come sign with it too; revoke neither it nor Trilha's. Without a Mac, make it
   with OpenSSL, in a folder outside the repository (the key it writes is not encrypted; the
   `MSYS_NO_PATHCONV=1` prefix stops Git Bash on Windows rewriting the subject, and does nothing
   elsewhere):

   ```sh
   mkdir -p ~/apple-signing && cd ~/apple-signing
   MSYS_NO_PATHCONV=1 openssl req -new -newkey rsa:2048 -nodes -keyout dist.key -out dist.csr -subj "/CN=Jonathas Costa/C=BR"
   # Certificates, Identifiers & Profiles: a new Apple Distribution certificate from dist.csr,
   # downloaded into this folder as distribution.cer.
   openssl x509 -inform DER -in distribution.cer -out dist.pem
   # The .p12's password, typed without echo and kept out of the shell's history.
   read -rsp "Password: " P12_PASSWORD && echo && export P12_PASSWORD
   # The older encryption, which the macOS keychain imports.
   openssl pkcs12 -export -inkey dist.key -in dist.pem -out dist.p12 \
     -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 -passout env:P12_PASSWORD
   unset P12_PASSWORD
   ```

   Keep `dist.key` and `dist.p12` safe: they sign every game. `IOS_DISTRIBUTION_CERTIFICATE_P12`
   takes `dist.p12` in base64 (`base64 -w0 dist.p12`), and
   `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` the password. Then run the `TestFlight` workflow,
   install the build from TestFlight and play it: the consent message (in the EEA), the tracking
   prompt, the ads, Settings, Credits and the privacy policy.

6. **Upload the listing.** Run the `App Store listing` workflow: it sends the text and the
   screenshots of both languages to the version being prepared, and submits nothing.
7. **App Privacy.** In App Store Connect, App Privacy, answer for Google's SDKs, which the app
   includes; the game itself collects nothing. Follow Google's current guide,
   <https://developers.google.com/admob/ios/privacy/data-disclosure>, which says, data type by
   data type, the purposes and whether it is linked to the player or used for tracking. In short,
   the Google Mobile Ads SDK collects a coarse location (from the IP address), the device's
   identifiers (the advertising identifier only when the player allows tracking), how the player
   interacts with ads and the app, and diagnostics, for advertising, analytics and fraud
   prevention. The answers must agree with the privacy policy.

8. **Age rating.** No objectionable content of any kind, no user-generated content, no chat, no
   gambling, no web browsing: those answers are None or No. Advertising is Yes, since the app
   shows ads. Check the rating App Store Connect gives (4+ is expected), and filter the ads to it
   in the AdMob console (Blocking controls, maximum ad content rating).
9. **Review and release.** Price free, the countries to sell in, the review contact, and a note
   for the reviewer: no account; the consent message shows only in the EEA, the UK and
   Switzerland; hints show a rewarded ad. To sell in the European Union, declare the trader
   status the Digital Services Act asks for (App Store Connect, Business); without it the app is
   not offered in the EU storefronts. Pick the TestFlight build for the version and submit it for
   review.

## Before each release

- Create the new version in App Store Connect first: the listing workflow writes to the version
  being prepared.
- Update `release_notes.txt` in both languages.
- If a screen changed, run `pnpm store:screenshots` and commit the screenshots.
- If no event runs when the version comes out (the Autumn event ends on 30 November 2026), drop
  the seasonal events line from the descriptions, and the event board from the screenshots
  (`apps/game/store/screenshots.spec.ts`), until the next event.
- If what the app does with data changed, update `privacy.html` (its date too), the privacy
  manifest and the App Privacy answers, and run the `Privacy policy` workflow.
- Run the `App Store listing` workflow, then the `TestFlight` one, then submit.
