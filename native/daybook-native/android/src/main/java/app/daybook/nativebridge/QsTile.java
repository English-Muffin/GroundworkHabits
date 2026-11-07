package app.daybook.nativebridge;

import android.annotation.TargetApi;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import org.json.JSONArray;
import org.json.JSONObject;

// Quick settings tile "Next habit": shows the first of today's habits that is still open; a tap ticks it without opening
// the app (same Yes answer as the widget), then the tile moves on to the next one. Reads the habit widget's data.
@TargetApi(Build.VERSION_CODES.N)
public class QsTile extends TileService {
    static void refresh(Context c) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
            try { TileService.requestListeningState(c, new ComponentName(c, QsTile.class)); } catch (Exception e) {}
    }

    int next(JSONObject d) {
        JSONArray a = d.optJSONArray("items");
        if (a == null || d.optBoolean("locked")) return -1;
        for (int i = 0; i < a.length(); i++) if (!a.optJSONObject(i).optBoolean("done")) return i;
        return -1;
    }

    void draw() {
        Tile t = getQsTile();
        if (t == null) return;
        JSONObject d = WidgetProvider.data(this, "widget");
        JSONArray a = d.optJSONArray("items");
        int n = a == null ? 0 : a.length(), i = next(d), done = 0;
        for (int j = 0; j < n; j++) if (a.optJSONObject(j).optBoolean("done")) done++;
        if (d.optBoolean("locked")) { t.setLabel(d.optString("lockedText", "Locked")); t.setState(Tile.STATE_UNAVAILABLE); }
        else if (i < 0) { t.setLabel(n == 0 ? d.optString("emptyText", "No habits today") : d.optString("allDone", "All done today")); t.setState(Tile.STATE_ACTIVE); }
        else { t.setLabel(a.optJSONObject(i).optString("name")); t.setState(Tile.STATE_INACTIVE); }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && n > 0) t.setSubtitle(done + "/" + n);
        t.updateTile();
    }

    @Override public void onStartListening() { draw(); }

    @Override
    public void onClick() {
        int i = next(WidgetProvider.data(this, "widget"));
        if (i >= 0 && WidgetProvider.tickItem(this, "widget", i)) WidgetProvider.updateAll(this);
        draw();
    }
}
