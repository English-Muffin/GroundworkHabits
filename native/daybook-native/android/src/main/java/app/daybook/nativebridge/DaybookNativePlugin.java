package app.daybook.nativebridge;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    static void answered() {
        DaybookNativePlugin p = live;
        if (p != null) p.notifyListeners("answer", new JSObject());
    }
}
