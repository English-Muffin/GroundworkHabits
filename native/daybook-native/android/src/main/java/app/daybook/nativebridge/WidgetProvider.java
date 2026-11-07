package app.daybook.nativebridge;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

// Home-screen widget: today's habits (up to 6). Tapping an open habit ticks it without opening Daybook (stored as an answer,
// applied when the app runs, like the notification's Yes). The app sends what to show after every change (prefs "widget").
public class WidgetProvider extends AppWidgetProvider {
    static final String TICK = "app.daybook.WIDGET_TICK";
    static final int[] ROWS = { R.id.w_r0, R.id.w_r1, R.id.w_r2, R.id.w_r3, R.id.w_r4, R.id.w_r5 };
    static final int[] CHECKS = { R.id.w_c0, R.id.w_c1, R.id.w_c2, R.id.w_c3, R.id.w_c4, R.id.w_c5 };
    static final int[] NAMES = { R.id.w_n0, R.id.w_n1, R.id.w_n2, R.id.w_n3, R.id.w_n4, R.id.w_n5 };

    static JSONObject data(Context c) {
        try { return new JSONObject(Reminders.prefs(c).getString("widget", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetProvider.class));
        if (ids.length > 0) for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.dbk_widget);
        JSONObject d = data(c);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) v.setOnClickPendingIntent(R.id.w_title, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        JSONArray items = d.optJSONArray("items");
        int n = items == null ? 0 : Math.min(items.length(), ROWS.length), done = 0;
        for (int i = 0; i < n; i++) if (items.optJSONObject(i).optBoolean("done")) done++;
        v.setTextViewText(R.id.w_title, d.optString("title", "Groundwork Habits") + (n > 0 ? "   " + done + "/" + n : ""));
        String empty = d.optBoolean("locked") ? d.optString("lockedText", "Groundwork Habits is locked") : n == 0 ? d.optString("emptyText", "Open Groundwork Habits to add habits") : null;
        v.setViewVisibility(R.id.w_empty, empty == null ? View.GONE : View.VISIBLE);
        if (empty != null) v.setTextViewText(R.id.w_empty, empty);
        for (int i = 0; i < ROWS.length; i++) {
            if (i >= n || d.optBoolean("locked")) { v.setViewVisibility(ROWS[i], View.GONE); continue; }
            JSONObject it = items.optJSONObject(i);
            boolean on = it.optBoolean("done");
            v.setViewVisibility(ROWS[i], View.VISIBLE);
            v.setTextViewText(NAMES[i], it.optString("name"));
            v.setTextViewText(CHECKS[i], on ? "✓" : "");
            v.setInt(CHECKS[i], "setBackgroundResource", on ? R.drawable.dbk_check_on : R.drawable.dbk_check_off);
            Intent t = new Intent(c, WidgetProvider.class).setAction(TICK).putExtra("i", i);
            v.setOnClickPendingIntent(ROWS[i], PendingIntent.getBroadcast(c, 300 + i, t, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        return v;
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) m.updateAppWidget(id, views(c)); }

    @Override
    public void onReceive(Context c, Intent i) {
        super.onReceive(c, i);
        if (!TICK.equals(i.getAction())) return;
        try {
            JSONObject d = data(c);
            JSONObject it = d.getJSONArray("items").getJSONObject(i.getIntExtra("i", -1));
            if (!it.optBoolean("done")) {
                it.put("done", true);
                Reminders.prefs(c).edit().putString("widget", d.toString()).commit();
                Reminders.addAnswer(c, it.getString("h"), it.getString("k"), "yes");
                DaybookNativePlugin.answered();
            }
        } catch (Exception e) {}
        updateAll(c);
    }
}
