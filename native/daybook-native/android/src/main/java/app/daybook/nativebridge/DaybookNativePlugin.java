package app.daybook.nativebridge;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Bridge for the web app: schedule habit reminders, collect Yes/No answers given in notifications, fetch the iCal feed.
@CapacitorPlugin(name = "DaybookNative")
public class DaybookNativePlugin extends Plugin {
    static DaybookNativePlugin live;

    @Override
    public void load() {
        live = this;
        Reminders.channels(getContext());
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        Reminders.cancelAll(getContext());
        Reminders.prefs(getContext()).edit().putString("items", items.toString()).commit();
        Reminders.armAll(getContext());
        JSObject r = new JSObject();
        r.put("exact", Reminders.canExact(getContext()));
        call.resolve(r);
    }

    // Android 14+: exact timing needs the user's OK; this opens that settings page
    @PluginMethod
    public void openExactSettings(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            Intent i = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); } catch (Exception e) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void takeAnswers(PluginCall call) {
        JSObject r = new JSObject();
        try { r.put("answers", new JSArray(Reminders.takeAnswers(getContext()))); } catch (Exception e) { r.put("answers", new JSArray()); }
        call.resolve(r);
    }

    @PluginMethod
    public void fetchCal(PluginCall call) {
        String url = call.getString("url", "");
        new Thread(() -> call.resolve(CalFetch.fetch(url))).start();
    }

    // export: the system "Save to" screen lets the user pick the folder and name, then the text is written there
    @PluginMethod
    public void saveFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(call.getString("type", "application/octet-stream"))
            .putExtra(Intent.EXTRA_TITLE, call.getString("name", "daybook.txt"));
        startActivityForResult(call, i, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { r.put("saved", false); call.resolve(r); return; }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            r.put("saved", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not save the file");
        }
    }

    static void answered() {
        DaybookNativePlugin p = live;
        if (p != null) p.notifyListeners("answer", new JSObject());
    }
}
