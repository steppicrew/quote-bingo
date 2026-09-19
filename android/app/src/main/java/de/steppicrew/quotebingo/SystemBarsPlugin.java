package de.steppicrew.quotebingo;

import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Controls the appearance of BOTH system bars.
 *
 * @capacitor/status-bar can style the status bar but exposes nothing for the
 * navigation bar, and from Android 15 edge-to-edge is mandatory: the system
 * ignores android:navigationBarColor and draws the bar transparent over the
 * page. The icons then take their contrast from whatever the app paints
 * underneath, so in the light theme the dark-on-light buttons all but
 * disappeared. Only the light/dark *appearance* flag fixes that, and it has to
 * follow the in-app theme, which no resource qualifier can see.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

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

            // Below Android 15 the bars are still opaque and take a colour, so
            // match them to the page rather than leaving the stock black.
            if (Build.VERSION.SDK_INT < 35) {
                final int colour = dark ? 0xFF0F0E1A : 0xFFF4F2FB;
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.setStatusBarColor(colour);
                window.setNavigationBarColor(colour);
            }

            call.resolve();
        });
    }
}
