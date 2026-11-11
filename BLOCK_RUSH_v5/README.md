# Block Rush

Portrait block puzzle game with 200 progressively harder levels.

## Ads
- The Android APK uses the AdMob app, banner, and rewarded-ad IDs configured in `game.js`.
- The Android build bundles the AdMob Capacitor plugin bridge during GitHub Actions.
- The Try Again button on the Game Over screen requires a completed rewarded ad before restarting the current level.
- In a normal browser preview, rewarded ads are simulated; real AdMob ads require the Android APK.
- Do not tap your own ads. This can get your AdMob account suspended.

## Campaign
- Complete level 200 to see the end-of-game message.
- Select Go Back to return to the level list, then use Back to return to the game screen.
