package de.steppicrew.quotebingo;

import android.view.View;
import android.view.Window;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

/**
 * Controls the appearance of BOTH system bars, and tells the page how much of
 * the screen they cover.
 *
 * @capacitor/status-bar can style the status bar but exposes nothing for the
 * navigation bar. The app runs edge-to-edge on every version (MainActivity), so
 * both bars are transparent over the page and their icons take contrast from
 * whatever the app paints underneath: in the light theme the dark-on-light
 * buttons all but disappeared. Only the light/dark *appearance* flag fixes
 * that, and it has to follow the in-app theme, which no resource qualifier can
 * see.
 *
 * Insets: a recent WebView reports the bars through env(safe-area-inset-*), but
 * the WebView on an older phone predates edge-to-edge and reports 0, which
 * would put the title under the clock. So the insets are also measured here and
 * written to --native-inset-* on the page; the stylesheet takes the larger.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

    /** Last measured bars + cutout, in physical pixels. */
    private Insets insets = Insets.NONE;

    @Override
    public void load() {
        final WebView webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            pushInsets();
            // Hand the insets on unchanged, so a WebView that does understand
            // them still feeds env() — the listener replaces that dispatch.
            return ViewCompat.onApplyWindowInsets(view, windowInsets);
        });
    }

    /**
     * @param call `dark` = the app is painting a DARK background, so both bars
     *             need LIGHT icons.
     */
    @PluginMethod
    public void setAppearance(PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));

        getActivity().runOnUiThread(() -> {
            final Window window = getActivity().getWindow();
            final View decor = window.getDecorView();

            WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(window, decor);
            // "appearanceLightBars = true" means light BARS, i.e. dark icons —
            // which is what a light app background needs.
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);

            // The first inset pass usually lands before the page has loaded and
            // is lost with it. The page calls this on start, so send them again.
            pushInsets();

            call.resolve();
        });
    }

    private void pushInsets() {
        final WebView webView = getBridge().getWebView();
        final float density = webView.getResources().getDisplayMetrics().density;
        final String js = String.format(Locale.ROOT,
            // documentElement is null while a page is only starting to load;
            // the insets are pushed again from setAppearance once it runs.
            "(function(e){if(!e)return;var s=e.style;"
                + "s.setProperty('--native-inset-top','%.1fpx');"
                + "s.setProperty('--native-inset-right','%.1fpx');"
                + "s.setProperty('--native-inset-bottom','%.1fpx');"
                + "s.setProperty('--native-inset-left','%.1fpx');})"
                + "(document.documentElement)",
            insets.top / density, insets.right / density,
            insets.bottom / density, insets.left / density);
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
