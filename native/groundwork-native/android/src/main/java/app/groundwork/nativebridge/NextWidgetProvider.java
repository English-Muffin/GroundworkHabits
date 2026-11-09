package app.groundwork.nativebridge;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

// Small home-screen widget (2x1, resizable down to 1x1): the next open habit of today and how many are done.
// A tap ticks it without opening the app (same Yes answer as the big widget and the quick settings tile).
public class NextWidgetProvider extends WidgetProvider {
    @Override String tick() { return "app.groundwork.WIDGET_NEXT_TICK"; }
    @Override int codeBase() { return 500; }

    static int next(JSONObject d) {
        JSONArray a = d.optJSONArray("items");
        if (a == null || d.optBoolean("locked")) return -1;
        for (int i = 0; i < a.length(); i++) if (!a.optJSONObject(i).optBoolean("done")) return i;
        return -1;
    }

    @Override
    RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.dbk_next);
        JSONObject d = data(c, key());
        JSONArray a = d.optJSONArray("items");
        int n = a == null ? 0 : a.length(), i = next(d), done = 0;
        for (int j = 0; j < n; j++) if (a.optJSONObject(j).optBoolean("done")) done++;
        boolean locked = d.optBoolean("locked");
        String name = locked ? d.optString("lockedText", "Locked") : i >= 0 ? a.optJSONObject(i).optString("name")
            : n == 0 ? d.optString("emptyText", "No habits today") : d.optString("allDone", "All done today");
        v.setTextViewText(R.id.x_name, name);
        v.setTextViewText(R.id.x_count, n > 0 && !locked ? done + "/" + n : "");
        v.setTextViewText(R.id.x_check, i < 0 && n > 0 && !locked ? "✓" : "");
        v.setInt(R.id.x_check, "setBackgroundResource", i < 0 && n > 0 && !locked ? R.drawable.dbk_check_on : R.drawable.dbk_check_off);
        Intent t = i >= 0 ? new Intent(c, getClass()).setAction(tick()).putExtra("i", i) : c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (t != null) v.setOnClickPendingIntent(R.id.x_root, i >= 0
            ? PendingIntent.getBroadcast(c, codeBase(), t, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
            : PendingIntent.getActivity(c, codeBase() + 1, t, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }
}
