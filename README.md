# Block Rush

A portrait block puzzle game built with HTML, CSS and JavaScript. It has a welcome screen, a notification permission prompt, a tutorial hand for level 1, short levels with line burst effects, sound effects and a level complete popup.

## Files
- index.html: screens and popups
- style.css: colors, animations and layout
- game.js: all game logic and sounds
- assets/icon.png: app icon
- assets/welcome.png: welcome screen image

## Play in a browser or on Android phone (GitHub Pages)
1. Create a new repository on GitHub and upload all files and the assets folder, keeping the folder structure.
2. Go to Settings, then Pages. Set Source to "Deploy from a branch", branch "main", folder "/ (root)", and save.
3. Open the link GitHub gives you (for example https://yourname.github.io/repo-name/) in Chrome on Android.
4. Chrome menu, then "Add to Home screen".

## Make an APK (Android app file)
The APK is built with Capacitor and Android Studio on a computer.
1. Put index.html, style.css, game.js and the assets folder inside a folder named "www".
2. In a terminal inside the project folder, run: npm init -y, then npm install @capacitor/core @capacitor/cli @capacitor/android, then npx cap init "Block Rush" com.blockrush.game --web-dir=www, then npx cap add android, then npx cap copy.
3. Run npx cap open android. Android Studio opens. Choose Build, then Build Bundle(s) / APK(s), then Build APK(s).
4. The APK is created in android/app/build/outputs/apk/debug/. Install it on your phone.
