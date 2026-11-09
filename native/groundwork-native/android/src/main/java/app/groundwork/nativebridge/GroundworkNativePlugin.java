package app.groundwork.nativebridge;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.OnBackPressedCallback;
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
@CapacitorPlugin(name = "GroundworkNative")
public class GroundworkNativePlugin extends Plugin {
    static GroundworkNativePlugin live;

    @Override
    public void load() {
        live = this;
        Reminders.channels(getContext());
        // the system back button/gesture goes to the app: it closes dialogs, leaves Settings, steps back through screens,
        // and only leaves the app after a second back on the home screen (see onBack in app.js)
        getActivity().runOnUiThread(() -> getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { notifyListeners("back", new JSObject()); }
        }));
    }

    @PluginMethod
    public void exitApp(PluginCall call) { call.resolve(); getActivity().runOnUiThread(() -> getActivity().finish()); }

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
            .putExtra(Intent.EXTRA_TITLE, call.getString("name", "groundwork.txt"));
        startActivityForResult(call, i, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { r.put("saved", false); call.resolve(r); return; }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            String b64 = call.getString("base64"); // images (the year review) come as base64, everything else as text
            out.write(b64 != null ? android.util.Base64.decode(b64, android.util.Base64.DEFAULT) : call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            r.put("saved", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not save the file");
        }
    }

    // data folder: the user picks a folder once (kept across restarts); groundwork.json is read and written there
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, i, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { r.put("picked", false); call.resolve(r); return; }
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            Reminders.prefs(getContext()).edit().putString("tree", uri.toString()).commit();
            r.put("picked", true); r.put("name", Folder.name(getContext(), uri));
            call.resolve(r);
        } catch (Exception e) { call.reject("That folder can't be used. Pick a folder on this phone or SD card"); }
    }

    @PluginMethod
    public void folder(PluginCall call) {
        JSObject r = new JSObject();
        Uri t = Folder.tree(getContext());
        if (t != null) r.put("name", Folder.name(getContext(), t));
        call.resolve(r);
    }

    @PluginMethod
    public void clearFolder(PluginCall call) {
        Uri t = Folder.tree(getContext());
        if (t != null) { try { getContext().getContentResolver().releasePersistableUriPermission(t, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) {} }
        Reminders.prefs(getContext()).edit().remove("tree").commit();
        call.resolve();
    }

    @PluginMethod
    public void readFolder(PluginCall call) {
        new Thread(() -> { try { JSObject r = new JSObject(); String t = Folder.read(getContext()); if (t != null) r.put("text", t); call.resolve(r); } catch (Exception e) { call.reject("Could not read the data folder"); } }).start();
    }

    @PluginMethod
    public void writeFolder(PluginCall call) {
        String text = call.getString("text", null);
        if (text == null) { call.reject("No text"); return; }
        new Thread(() -> { try { Folder.writeData(getContext(), text); call.resolve(); } catch (Exception e) { call.reject("Could not save to the data folder"); } }).start();
    }

    @PluginMethod
    public void backup(PluginCall call) {
        String name = call.getString("name", ""), text = call.getString("text", null);
        if (text == null || !name.matches("groundwork-backup-[0-9A-Za-z-]{1,40}[.]json")) { call.reject("Bad backup"); return; }
        new Thread(() -> { try { JSObject r = new JSObject(); r.put("where", Folder.backup(getContext(), name, text)); call.resolve(r); } catch (Exception e) { call.reject("Backup failed"); } }).start();
    }

    // home-screen widget: what to show ({title, items:[{h,k,name,done}], locked, lockedText, emptyText})
    @PluginMethod
    public void widget(PluginCall call) {
        JSObject d = call.getObject("data", new JSObject());
        JSObject t = call.getObject("tasks");
        android.content.SharedPreferences.Editor e = Reminders.prefs(getContext()).edit().putString("widget", d.toString());
        if (t != null) e.putString("widgetTasks", t.toString());
        e.commit();
        WidgetProvider.updateAll(getContext());
        call.resolve();
    }

    // fingerprint / face unlock
    @PluginMethod
    public void bioAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", Bio.available(getContext()));
        r.put("on", Reminders.prefs(getContext()).getString("bio", null) != null);
        call.resolve(r);
    }

    private Bio.Done reply(PluginCall call) {
        return new Bio.Done() {
            public void ok(String pin) { JSObject r = new JSObject(); r.put("ok", true); r.put("pin", pin); call.resolve(r); }
            public void fail(String why) { JSObject r = new JSObject(); r.put("ok", false); r.put("why", why); call.resolve(r); }
        };
    }

    @PluginMethod
    public void bioEnable(PluginCall call) { Bio.enable(getActivity(), call.getString("pin", ""), call.getString("title", "Confirm your fingerprint"), reply(call)); }

    @PluginMethod
    public void bioUnlock(PluginCall call) { Bio.unlock(getActivity(), call.getString("title", "Unlock Groundwork Habits"), reply(call)); }

    @PluginMethod
    public void bioDisable(PluginCall call) { Bio.clear(getContext()); call.resolve(); }

    static void answered() {
        GroundworkNativePlugin p = live;
        if (p != null) p.notifyListeners("answer", new JSObject());
    }
}
