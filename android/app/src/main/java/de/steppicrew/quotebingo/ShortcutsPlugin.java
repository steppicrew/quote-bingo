package de.steppicrew.quotebingo;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.ColorUtils;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Launcher shortcuts: long-press the app icon for the most recently viewed
 * people, each icon their initial on their accent colour, and a tap opens that
 * person's board. The page sends the list (src/lib/shortcuts.ts) in recency
 * order; this side renders it and reports taps back as an "open" event.
 */
@CapacitorPlugin(name = "Shortcuts")
public class ShortcutsPlugin extends Plugin {

    private static final String EXTRA_PERSON = "de.steppicrew.quotebingo.PERSON_ID";

    /**
     * Launchers show four or five; more only makes the menu a list to read,
     * which is what the shortcut is meant to save.
     */
    private static final int MAX_SHORTCUTS = 4;

    @Override
    public void load() {
        // The tap that cold-started the app arrives as the launch intent.
        deliver(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        // The activity is singleTask, so a tap while the app runs lands here.
        deliver(intent);
    }

    private void deliver(Intent intent) {
        if (intent == null) return;
        final String personId = intent.getStringExtra(EXTRA_PERSON);
        if (personId == null) return;
        // Consumed: a configuration change re-delivers the same intent, and
        // must not jump back to this person after the user has moved on.
        intent.removeExtra(EXTRA_PERSON);
        JSObject data = new JSObject();
        data.put("personId", personId);
        // Retained until a listener attaches — on a cold start the page is
        // still loading and hydrating when this fires.
        notifyListeners("open", data, true);
    }

    @PluginMethod
    public void set(PluginCall call) {
        final JSArray people = call.getArray("people");
        if (people == null) {
            call.reject("people missing");
            return;
        }
        final Context context = getContext();
        final List<ShortcutInfoCompat> all = new ArrayList<>();
        final Set<String> ids = new HashSet<>();
        try {
            for (int i = 0; i < people.length(); i++) {
                JSONObject p = people.getJSONObject(i);
                String id = p.getString("id");
                String label = p.getString("label");
                ids.add(id);
                all.add(
                    new ShortcutInfoCompat.Builder(context, id)
                        .setShortLabel(label.isEmpty() ? "?" : label)
                        .setIcon(icon(context, label, parseColor(p.optString("color"))))
                        .setIntent(
                            new Intent(context, MainActivity.class)
                                .setAction(Intent.ACTION_VIEW)
                                .putExtra(EXTRA_PERSON, id))
                        .setRank(i)
                        .build());
            }
        } catch (JSONException e) {
            call.reject("bad people list", e);
            return;
        }

        final int max = Math.min(MAX_SHORTCUTS,
            ShortcutManagerCompat.getMaxShortcutCountPerActivity(context));
        try {
            ShortcutManagerCompat.setDynamicShortcuts(context,
                new ArrayList<>(all.subList(0, Math.min(max, all.size()))));
            // Shortcuts pinned to the home screen outlive the menu: keep their
            // name and colour current, and disable those whose person is gone,
            // so a pinned "Jens" never opens a board that no longer exists.
            ShortcutManagerCompat.updateShortcuts(context, all);
            final List<String> orphans = new ArrayList<>();
            for (ShortcutInfoCompat pinned :
                    ShortcutManagerCompat.getShortcuts(context, ShortcutManagerCompat.FLAG_MATCH_PINNED)) {
                if (!ids.contains(pinned.getId())) orphans.add(pinned.getId());
            }
            if (!orphans.isEmpty()) ShortcutManagerCompat.disableShortcuts(context, orphans, null);
        } catch (RuntimeException e) {
            // Rate limiting or a launcher quirk: the shortcuts are a
            // convenience, never worth failing the page over.
            call.reject("shortcut update failed", e);
            return;
        }
        call.resolve();
    }

    private static int parseColor(String hex) {
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return Color.parseColor("#7c6cff");
        }
    }

    /**
     * The person's initial on their accent colour, as an adaptive icon: the
     * launcher masks the 108dp canvas to its own shape, and only the middle
     * 72dp is guaranteed visible, so the letter stays well inside that.
     */
    private static IconCompat icon(Context context, String label, int color) {
        final float density = context.getResources().getDisplayMetrics().density;
        final int size = Math.round(108 * density);
        final Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        final Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(color);

        final String initial = label.isEmpty()
            ? "?"
            : new String(Character.toChars(label.codePointAt(0))).toUpperCase(Locale.ROOT);
        final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        paint.setTextSize(40 * density);
        paint.setTextAlign(Paint.Align.CENTER);
        // Light accents (amber) need dark ink; the rest read best in white.
        paint.setColor(ColorUtils.calculateLuminance(color) > 0.5 ? 0xFF1E1B4B : Color.WHITE);
        final Paint.FontMetrics m = paint.getFontMetrics();
        final float baseline = size / 2f - (m.ascent + m.descent) / 2f;
        canvas.drawText(initial, size / 2f, baseline, paint);

        return IconCompat.createWithAdaptiveBitmap(bitmap);
    }
}
