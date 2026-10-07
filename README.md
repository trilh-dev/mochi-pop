# Mochi Pop

A cute block-puzzle game for Android. See [DESIGN.md](DESIGN.md) for how the game is designed.

```
src/            game source (game.js, index.html, font)
build.mjs       inlines everything into www/index.html (one self-contained file)
www/            the built game; open index.html in any browser to play
android-lite/   SDK-free APK build (Java WebView wrapper + hand-written manifest/resources packer)
android-studio/ standard Gradle project, for when you want an AAB for the Play Store
dist/           MochiPop.apk and a 512px store icon
```

## Play in a browser
Run `node build.mjs`, then open `www/index.html`.

## Build the APK (no Android SDK needed)
You need JDK 17 or newer, Python 3 and Node 18 or newer.
```
bash android-lite/build-apk.sh        # -> dist/MochiPop.apk
```
The script downloads three jars from Maven Central (API stubs, dx and apksig), compiles the wrapper, packs the APK and signs it with v2.
On the first run it creates a development key, `android-lite/mochipop-dev.p12` (password `mochipop`). That key isn't committed: Android only installs an update over an existing install when both are signed with the same key, so keep it safe. The project's copy lives in the shared project folder.
For a real release, pass your own key: `KEYSTORE=my.p12 KEYSTORE_PASS=... VERSION_CODE=2 VERSION_NAME=1.1 bash android-lite/build-apk.sh`.

Install it on a phone with `adb install dist/MochiPop.apk`, or copy the file over and open it (you'll need to allow installs from unknown sources).

## Over-the-air updates
The Android app plays the copy of `www/index.html` that is bundled into the APK. On every launch it also checks
`https://raw.githubusercontent.com/trilh-dev/mochi-pop/main/www/version.json`. If that file lists a higher `version`,
the app downloads the new `www/index.html` and switches to it. If the player is on the home screen it reloads straight
away; otherwise it reloads the next time they return there. Saved progress is kept.

To ship a game update:
1. Change `src/`, then bump the number in `VERSION`.
2. Run `node build.mjs`. This rewrites `www/index.html` and `www/version.json`.
3. Commit and push to `main`. Phones pick the update up on their next launch (GitHub's cache can delay it by about 5 minutes).

Only the game page updates this way. Changes to the Android wrapper (`android-lite/src`, permissions, the icon) need a new APK.
If a game build ever depends on a new wrapper feature, raise `WRAPPER_LEVEL` in `MainActivity.java` and `minApp` in
`build.mjs` together. Older apps will then skip that update instead of breaking.

## Build for the Play Store
Open `android-studio/` in Android Studio, then use Build › Generate Signed Bundle. The app's assets come from `../www`, so run `node build.mjs` first.
This project was written by hand and has not been built in this environment (it has no Android SDK).
