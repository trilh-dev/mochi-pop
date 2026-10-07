#!/usr/bin/env bash
# Builds a signed Mochi Pop APK with only a JDK, Python 3 and Node (no Android SDK needed).
# Output: ../dist/MochiPop.apk
set -euo pipefail
cd "$(dirname "$0")"
T=.tools; B=.build; mkdir -p $T $B ../dist
MC=https://repo1.maven.org/maven2
get() { [ -s "$T/$2" ] || curl -fsSL -o "$T/$2" "$MC/$1"; }
get com/google/android/android/4.1.1.4/android-4.1.1.4.jar android.jar                       # API stubs (compile only)
get com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar           # .class -> .dex
get com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar                          # v2 signing (minSdk 24)

node ../build.mjs
rm -rf $B/classes $B/stubs && mkdir -p $B/classes $B/stubs $B/assets
javac -nowarn --release 8 -cp $T/android.jar -d $B/stubs stubs/android/webkit/JavascriptInterface.java
javac -nowarn --release 8 -cp $T/android.jar:$B/stubs -d $B/classes $(find src -name '*.java')
java -cp $T/dx.jar com.android.dx.command.Main --dex --min-sdk-version=24 --output=$B/classes.dex $B/classes
cp ../www/index.html ../www/version.json $B/assets/
python3 mkapk.py $B/classes.dex icon.png $B/assets $B/unsigned.apk "${VERSION_CODE:-2}" "${VERSION_NAME:-1.1}"

KS=${KEYSTORE:-mochipop-dev.p12}; PASS=${KEYSTORE_PASS:-mochipop}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass "$PASS" -alias mochipop \
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mochi Pop Dev" >/dev/null 2>&1
javac -nowarn -cp $T/apksig.jar -d $B tools-src/Sign.java
java --add-exports=java.base/sun.security.x509=ALL-UNNAMED --add-exports=java.base/sun.security.pkcs=ALL-UNNAMED --add-exports=java.base/sun.security.util=ALL-UNNAMED -cp $T/apksig.jar:$B Sign "$KS" "$PASS" mochipop $B/unsigned.apk ../dist/MochiPop.apk
ls -la ../dist/MochiPop.apk
