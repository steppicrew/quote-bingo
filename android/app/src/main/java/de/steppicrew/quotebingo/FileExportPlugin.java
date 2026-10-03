package de.steppicrew.quotebingo;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves an export (one person's list, or the full backup) through Android's
 * own "Save as" dialog.
 *
 * The web build downloads a blob through an <a download> click, but the
 * Capacitor WebView has no download handler: the click went nowhere, no file
 * was written, and the page still showed its "exported" toast. The system
 * document picker needs no storage permission and lets the user put the file
 * wherever they want it — Download, a cloud drive — which is the point of a
 * backup.
 */
@CapacitorPlugin(name = "FileExport")
public class FileExportPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        final String filename = call.getString("filename");
        final String content = call.getString("content");
        if (filename == null || content == null) {
            call.reject("filename and content are required");
            return;
        }
        final Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(call.getString("mimeType", "application/json"))
            .putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onSaveTarget");
    }

    @ActivityCallback
    private void onSaveTarget(PluginCall call, ActivityResult result) {
        if (call == null) return;
        final JSObject ret = new JSObject();
        final Intent data = result.getData();
        final Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            // Cancelled: not an error, but nothing was saved — the page must
            // not claim otherwise.
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        final String content = call.getString("content", "");
        // "wt" truncates: picking an existing file must replace it, not leave
        // the tail of a longer old backup behind the new JSON.
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new java.io.IOException("no output stream for " + uri);
            out.write(content.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            call.reject("could not write the file", e);
            return;
        }
        ret.put("saved", true);
        call.resolve(ret);
    }
}
