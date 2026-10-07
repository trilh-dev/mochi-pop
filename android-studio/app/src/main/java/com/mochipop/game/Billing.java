package com.mochipop.game;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing for one-time products. Purchases are handed to the game
 * (window.__purchase(product, token)), which grants and saves the reward, then calls
 * Android.finishPurchase(token). Only then are coins consumed (or remove_ads acknowledged), so a
 * crash in between never loses what was paid for: the purchase is simply delivered again.
 * All state is touched on the UI thread.
 */
class Billing implements PurchasesUpdatedListener {
    static final String NO_ADS = "remove_ads";
    static final String[] PRODUCTS = { NO_ADS, "coins_500", "coins_1500", "coins_5000" };

    private final MainActivity a;
    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    /** Purchased but not yet finished, by token. */
    private final Map<String, Purchase> open = new LinkedHashMap<>();
    private final List<String> delivered = new ArrayList<>();
    private boolean pageReady;
    volatile boolean noAds;
    volatile String productsJson = "[]";

    Billing(MainActivity a) { this.a = a; }

    void start() {
        client = BillingClient.newBuilder(a)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                queryProducts();
                refresh();
            }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (String id : PRODUCTS) list.add(QueryProductDetailsParams.Product.newBuilder()
            .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) ->
            a.runOnUiThread(() -> {
                for (ProductDetails d : result.getProductDetailsList()) details.put(d.getProductId(), d);
                JSONArray arr = new JSONArray();
                for (String id : PRODUCTS) {
                    ProductDetails d = details.get(id);
                    if (d == null || d.getOneTimePurchaseOfferDetails() == null) continue;
                    try { arr.put(new JSONObject().put("id", id).put("price", d.getOneTimePurchaseOfferDetails().getFormattedPrice())); }
                    catch (Exception ignored) { }
                }
                productsJson = arr.toString();
                a.js("window.__products&&window.__products(" + productsJson + ")");
            }));
    }

    /** Picks up purchases made while the app was closed, restores remove_ads, retries unfinished ones. */
    void refresh() {
        if (client == null || !client.isReady()) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (r, list) -> { if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) a.runOnUiThread(() -> handle(list)); });
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> list) {
        int code = r.getResponseCode();
        a.runOnUiThread(() -> {
            if (code == BillingClient.BillingResponseCode.OK && list != null) handle(list);
            else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) refresh();
            else if (code != BillingClient.BillingResponseCode.USER_CANCELED)
                a.js("window.__purchaseFailed&&window.__purchaseFailed(" + code + ")");
        });
    }

    private void handle(List<Purchase> list) {
        for (Purchase p : list) {
            // PENDING (e.g. cash payments) is granted later, when Play reports it PURCHASED.
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (p.getProducts().contains(NO_ADS)) noAds = true;
            open.put(p.getPurchaseToken(), p);
        }
        flush();
    }

    /** Called by the page once its purchase handler is installed (again after every reload). */
    void pageReady() { pageReady = true; delivered.clear(); flush(); }

    void pageReloading() { pageReady = false; }

    private void flush() {
        if (!pageReady) return;
        for (Purchase p : open.values()) {
            String token = p.getPurchaseToken();
            if (delivered.contains(token)) continue;
            delivered.add(token);
            for (String id : p.getProducts())
                a.js("window.__purchase&&window.__purchase(" + JSONObject.quote(id) + "," + JSONObject.quote(token) + ")");
        }
    }

    void buy(String id) {
        ProductDetails d = details.get(id);
        if (d == null || !client.isReady()) { a.js("window.__purchaseFailed&&window.__purchaseFailed(-1)"); return; }
        BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(
            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build())).build();
        client.launchBillingFlow(a, params);
    }

    /** The game has granted and saved this purchase: consume coins, acknowledge remove_ads. */
    void finish(String token) {
        Purchase p = open.get(token);
        if (p == null) return;
        if (p.getProducts().contains(NO_ADS)) {
            if (p.isAcknowledged()) { open.remove(token); return; }
            client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), r -> {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) a.runOnUiThread(() -> open.remove(token));
            });
        } else {
            client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (r, t) -> {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) a.runOnUiThread(() -> open.remove(token));
            });
        }
    }

    void end() { if (client != null) client.endConnection(); }
}
