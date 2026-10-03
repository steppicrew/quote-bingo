package de.steppicrew.quotebingo;

import android.os.Build;
import android.webkit.WebSettings;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registered before super.onCreate so the bridge picks them up.
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(ShortcutsPlugin.class);
        super.onCreate(savedInstanceState);
        // The WebView renders nothing below 8px by default, but the cell auto-fit
        // goes down to 6px when a long quote needs it. Clamped, the text came
        // out larger than the size that was proved to fit and lost its last
        // line ("...Truemanshow" on a 5x5). Tiny text is the lesser evil: the
        // long-press magnifier exists for exactly those cells.
        WebSettings web = getBridge().getWebView().getSettings();
        web.setMinimumFontSize(1);
        web.setMinimumLogicalFontSize(1);
        // Edge-to-edge on every version, not just the Android 15+ where the
        // system forces it: one layout everywhere, and no deprecated bar-colour
        // calls. The page pads itself by the insets (see SystemBarsPlugin).
        // AFTER super.onCreate: it builds the window decor, and BridgeActivity
        // only swaps the splash theme for NoActionBar in there — called first,
        // the decor came from the splash theme and grew an action bar.
        EdgeToEdge.enable(this);
        // enable() also turns on the 3-button-navigation contrast scrim, which
        // laid a white band over the page. Contrast is already handled by the
        // icon appearance SystemBarsPlugin sets from the in-app theme.
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
