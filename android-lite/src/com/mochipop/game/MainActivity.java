package com.mochipop.game;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Full-screen WebView host for the game.
 *
 * Over-the-air updates: on launch the app checks OTA_BASE/version.json. When it lists a newer
 * game version that this wrapper supports (minApp <= WRAPPER_LEVEL), the new index.html is
 * downloaded into app storage and used from then on. The bundled copy is the offline fallback.
 */
public class MainActivity extends Activity {
    static final String OTA_BASE = "https://raw.githubusercontent.com/trilh-dev/mochi-pop/main/www/";
    /** Bump when the native bridge gains features that newer game builds depend on. */
    static final int WRAPPER_LEVEL = 1;
    // Same base URL whichever copy is loaded, so saved progress (localStorage) is shared.
    static final String BASE_URL = "file:///android_asset/";

    private WebView web;
    private SharedPreferences prefs;
    private int loadedVersion;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().getDecorView().setBackgroundColor(0xFFFFE0EF);
        prefs = getSharedPreferences("ota", MODE_PRIVATE);

        web = new WebView(this);
        web.setBackgroundColor(0xFFFFE0EF);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        hideSystemUi();
        loadGame();
        checkForUpdate();
    }

    private File otaFile() { return new File(getFilesDir(), "ota-index.html"); }

    private int bundledVersion() {
        try {
            return jsonInt(new String(readAll(getAssets().open("version.json")), "UTF-8"), "version", 0);
        } catch (Exception e) { return 0; }
    }

    private void loadGame() {
        String html = null;
        int bundled = bundledVersion(), ota = prefs.getInt("version", 0);
        if (ota > bundled && otaFile().exists()) {
            try { html = new String(readAll(new FileInputStream(otaFile())), "UTF-8"); loadedVersion = ota; }
            catch (Exception e) { html = null; }
        }
        if (html == null) {
            try { html = new String(readAll(getAssets().open("index.html")), "UTF-8"); loadedVersion = bundled; }
            catch (Exception e) { html = "<h1>Could not load the game</h1>"; }
        }
        web.loadDataWithBaseURL(BASE_URL, html, "text/html", "UTF-8", null);
    }

    private void checkForUpdate() {
        new Thread(new Runnable() {
            public void run() {
                try {
                    String v = new String(fetch(OTA_BASE + "version.json"), "UTF-8");
                    final int latest = jsonInt(v, "version", 0);
                    int have = Math.max(bundledVersion(), prefs.getInt("version", 0));
                    if (latest <= have || jsonInt(v, "minApp", 1) > WRAPPER_LEVEL) return;
                    byte[] html = fetch(OTA_BASE + "index.html");
                    String text = new String(html, "UTF-8");
                    // Sanity check so a bad download can never replace a working game.
                    if (html.length < 20000 || !text.contains("Mochi Pop") || !text.contains("</script>")) return;
                    File tmp = new File(getFilesDir(), "ota-index.tmp");
                    FileOutputStream out = new FileOutputStream(tmp);
                    out.write(html);
                    out.close();
                    if (!tmp.renameTo(otaFile())) return;
                    prefs.edit().putInt("version", latest).commit();
                    runOnUiThread(new Runnable() {
                        public void run() { web.loadUrl("javascript:window.__otaReady&&window.__otaReady(" + latest + ")"); }
                    });
                } catch (Exception ignored) {
                    // Offline or server trouble: keep playing the current version.
                }
            }
        }).start();
    }

    /** Reads an integer field from the tiny version.json, e.g. {"version":3,"minApp":1}. */
    static int jsonInt(String json, String key, int fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : fallback;
    }

    private static byte[] fetch(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "?t=" + System.currentTimeMillis()).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            return readAll(c.getInputStream());
        } finally { c.disconnect(); }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        try {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        } finally { in.close(); }
    }

    private void hideSystemUi() {
        // IMMERSIVE_STICKY | LAYOUT_STABLE | LAYOUT_HIDE_NAVIGATION | LAYOUT_FULLSCREEN | HIDE_NAVIGATION | FULLSCREEN
        web.setSystemUiVisibility(0x1000 | 0x100 | 0x200 | 0x400 | 0x2 | 0x4);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public void onBackPressed() {
        web.loadUrl("javascript:window.__back&&window.__back()");
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    class Bridge {
        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(ms);
        }

        @JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                public void run() { finish(); }
            });
        }

        /** Reloads the game, picking up a downloaded update. Progress is in localStorage, so nothing is lost. */
        @JavascriptInterface
        public void reload() {
            runOnUiThread(new Runnable() {
                public void run() { loadGame(); }
            });
        }

        @JavascriptInterface
        public int gameVersion() { return loadedVersion; }
    }
}
