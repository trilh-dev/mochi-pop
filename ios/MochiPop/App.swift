import SwiftUI
import UIKit
import WebKit
import AVFoundation

@main
struct MochiPopApp: App {
    var body: some Scene {
        WindowGroup { GameView().ignoresSafeArea().background(Color(red: 1, green: 0.878, blue: 0.937)) }
    }
}

/// Hosts the bundled HTML game. The game saves to localStorage and feature-detects the Android
/// bridge, so on iOS there is no shop or ads. Vibration is bridged through `window.Android.vibrate`.
final class Bridge: NSObject, WKScriptMessageHandler {
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        guard m.name == "haptic" else { return }
        let ms = (m.body as? Double) ?? 20
        let g = UIImpactFeedbackGenerator(style: ms > 40 ? .heavy : ms > 15 ? .medium : .light)
        g.impactOccurred()
    }
}

struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        // Playback category (not ambient) so music is not muted by the silent switch.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.allowsInlineMediaPlayback = true
        let bridge = Bridge()
        context.coordinator.bridge = bridge
        cfg.userContentController.add(bridge, name: "haptic")
        cfg.userContentController.addUserScript(WKUserScript(source: "window.Android={vibrate:function(m){window.webkit.messageHandlers.haptic.postMessage(+m||20)}};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: cfg)
        let bg = UIColor(red: 1, green: 0.878, blue: 0.937, alpha: 1)
        web.backgroundColor = bg; web.isOpaque = true
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.isScrollEnabled = false; web.scrollView.bounces = false
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        // Pause/resume the page's audio when the app leaves the foreground (the page also handles visibilitychange).
        return web
    }
    func updateUIView(_ v: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var bridge: Bridge? }
}
