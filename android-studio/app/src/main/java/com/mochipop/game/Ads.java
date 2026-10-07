package com.mochipop.game;

import android.os.Handler;
import android.os.Looper;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * AdMob rewarded + interstitial ads. Consent (UMP) is gathered first; ads are only requested once
 * canRequestAds() is true. Every method here runs on the UI thread. Results go back to the game
 * through window.__adDone(tag, earned).
 */
class Ads {
    private final MainActivity a;
    private final Handler h = new Handler(Looper.getMainLooper());
    private ConsentInformation consent;
    private boolean started;
    private RewardedAd rewarded;
    private InterstitialAd interstitial;
    private boolean loadingRewarded, loadingInterstitial;
    private int rewardedFails, interstitialFails;
    volatile boolean rewardedReady;
    /** A full-screen ad is on screen (MainActivity must not pause WebView timers then). */
    boolean showing;

    Ads(MainActivity a) { this.a = a; }

    void start() {
        consent = UserMessagingPlatform.getConsentInformation(a);
        consent.requestConsentInfoUpdate(a, new ConsentRequestParameters.Builder().build(),
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, err -> initSdk()),
            err -> { android.util.Log.w("MochiAds", "consent: " + err.getMessage()); initSdk(); });
        // Consent from a previous session is already known, so start loading straight away.
        initSdk();
    }

    boolean privacyOptionsRequired() {
        return consent != null && consent.getPrivacyOptionsRequirementStatus()
            == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    void showPrivacyOptions() {
        UserMessagingPlatform.showPrivacyOptionsForm(a, err -> initSdk());
    }

    private void initSdk() {
        if (started || consent == null || !consent.canRequestAds()) return;
        started = true;
        new Thread(() -> MobileAds.initialize(a, status -> a.runOnUiThread(() -> { loadRewarded(); loadInterstitial(); }))).start();
    }

    private void loadRewarded() {
        if (!started || rewarded != null || loadingRewarded) return;
        loadingRewarded = true;
        RewardedAd.load(a, BuildConfig.AD_REWARDED, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd ad) {
                loadingRewarded = false; rewardedFails = 0; rewarded = ad; rewardedReady = true;
            }
            @Override public void onAdFailedToLoad(LoadAdError e) {
                loadingRewarded = false; rewarded = null; rewardedReady = false;
                h.postDelayed(Ads.this::loadRewarded, backoff(++rewardedFails));
            }
        });
    }

    private void loadInterstitial() {
        if (!started || interstitial != null || loadingInterstitial) return;
        loadingInterstitial = true;
        InterstitialAd.load(a, BuildConfig.AD_INTERSTITIAL, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd ad) {
                loadingInterstitial = false; interstitialFails = 0; interstitial = ad;
            }
            @Override public void onAdFailedToLoad(LoadAdError e) {
                loadingInterstitial = false; interstitial = null;
                h.postDelayed(Ads.this::loadInterstitial, backoff(++interstitialFails));
            }
        });
    }

    private static long backoff(int fails) { return Math.min(300_000L, 15_000L * (1L << Math.min(fails - 1, 5))); }

    void showRewarded(String tag) {
        RewardedAd ad = rewarded;
        if (ad == null) { done(tag, false); loadRewarded(); return; }
        rewarded = null; rewardedReady = false; showing = true;
        final boolean[] earned = { false };
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { done(tag, earned[0]); loadRewarded(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError e) { done(tag, false); loadRewarded(); }
        });
        ad.show(a, item -> earned[0] = true);
    }

    void showInterstitial() {
        InterstitialAd ad = interstitial;
        if (ad == null || a.billing.noAds) { done("interstitial", false); loadInterstitial(); return; }
        interstitial = null; showing = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { done("interstitial", true); loadInterstitial(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError e) { done("interstitial", false); loadInterstitial(); }
        });
        ad.show(a);
    }

    private void done(String tag, boolean earned) {
        showing = false;
        a.js("window.__adDone&&window.__adDone(" + org.json.JSONObject.quote(tag) + "," + earned + ")");
    }
}
