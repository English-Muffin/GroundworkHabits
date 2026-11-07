package app.daybook.nativebridge;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

// items: [{id, at (ms), title, body, h, k, alarm}] kept in prefs so they survive restarts and reboots.
// answers: [{h, k, a: "yes"|"no"}] waiting for the web app to apply them.
final class Reminders {
    static final String ALARM = "dbk-alarm", ASK = "dbk-ask";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("daybook_native", Context.MODE_PRIVATE); }

    static JSONArray items(Context c) {
        try { return new JSONArray(prefs(c).getString("items", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel a = new NotificationChannel(ALARM, "Habit alarms", NotificationManager.IMPORTANCE_HIGH);
        a.setDescription("Loud habit reminders with Yes and No");
        a.enableVibration(true);
        a.setVibrationPattern(new long[] { 0, 600, 400, 600, 400, 600 });
        a.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        nm.createNotificationChannel(a);
        NotificationChannel q = new NotificationChannel(ASK, "Habit check-ins", NotificationManager.IMPORTANCE_LOW);
        q.setDescription("Quiet habit reminders that stay until you answer Yes or No");
        nm.createNotificationChannel(q);
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms();
    }

    private static PendingIntent fireIntent(Context c, int id, int flags) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ReminderReceiver.FIRE).putExtra("id", id);
        return PendingIntent.getBroadcast(c, id, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancelAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        JSONArray a = items(c);
        for (int n = 0; n < a.length(); n++) {
            PendingIntent pi = fireIntent(c, a.optJSONObject(n).optInt("id"), PendingIntent.FLAG_NO_CREATE);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
    }

    static void armAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        JSONArray a = items(c);
        long now = System.currentTimeMillis();
        boolean exact = canExact(c);
        for (int n = 0; n < a.length(); n++) {
            JSONObject it = a.optJSONObject(n);
            long at = it.optLong("at");
            if (at <= now) continue;
            PendingIntent pi = fireIntent(c, it.optInt("id"), PendingIntent.FLAG_UPDATE_CURRENT);
            if (Build.VERSION.SDK_INT < 23) am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            else if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    // habit reminders carry "rep" (daily/weekly/monthly). When a series runs out (Daybook not opened for a while),
    // add the next day's reminder so they keep coming. Old entries are pruned so the list stays small.
    static synchronized void extend(Context c) {
        JSONArray a = items(c), keep = new JSONArray();
        long now = System.currentTimeMillis();
        java.util.Map<String, JSONObject> last = new java.util.HashMap<>();
        int maxId = 5000;
        for (int n = 0; n < a.length(); n++) {
            JSONObject it = a.optJSONObject(n);
            maxId = Math.max(maxId, it.optInt("id"));
            if (it.optLong("at") > now - 2 * 86400000L) keep.put(it);
            if (it.has("rep")) { JSONObject l = last.get(it.optString("h")); if (l == null || l.optLong("at") < it.optLong("at")) last.put(it.optString("h"), it); }
        }
        boolean added = false;
        for (JSONObject l : last.values()) {
            if (l.optLong("at") > now) continue;
            Calendar cal = Calendar.getInstance();
            cal.setTimeInMillis(l.optLong("at"));
            while (cal.getTimeInMillis() <= now) cal.add(Calendar.DAY_OF_MONTH, 1);
            try {
                JSONObject nx = new JSONObject(l.toString());
                nx.put("id", maxId >= 9000 ? 5001 : ++maxId);
                nx.put("at", cal.getTimeInMillis());
                nx.put("k", periodKey(cal, l.optString("rep")));
                keep.put(nx);
                added = true;
            } catch (Exception e) {}
        }
        if (added || keep.length() != a.length()) prefs(c).edit().putString("items", keep.toString()).commit();
    }

    static String periodKey(Calendar c, String rep) {
        int y = c.get(Calendar.YEAR), m = c.get(Calendar.MONTH) + 1, d = c.get(Calendar.DAY_OF_MONTH);
        if ("weekly".equals(rep)) return String.format(Locale.ROOT, "%04d-%02d-W%d", y, m, (d + 6) / 7);
        if ("monthly".equals(rep)) return String.format(Locale.ROOT, "%04d-%02d", y, m);
        return String.format(Locale.ROOT, "%04d-%02d-%02d", y, m, d);
    }

    static JSONObject find(Context c, int id) {
        JSONArray a = items(c);
        for (int n = 0; n < a.length(); n++) if (a.optJSONObject(n).optInt("id") == id) return a.optJSONObject(n);
        return null;
    }

    static synchronized boolean answeredYes(Context c, String h, String k) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("answers", "[]"));
            for (int n = 0; n < a.length(); n++) {
                JSONObject x = a.getJSONObject(n);
                if (h.equals(x.optString("h")) && k.equals(x.optString("k")) && "yes".equals(x.optString("a"))) return true;
            }
        } catch (Exception e) {}
        return false;
    }

    static synchronized void addAnswer(Context c, String h, String k, String ans) {
        try {
            JSONArray a = new JSONArray(prefs(c).getString("answers", "[]"));
            a.put(new JSONObject().put("h", h).put("k", k).put("a", ans));
            prefs(c).edit().putString("answers", a.toString()).commit();
        } catch (Exception e) {}
    }

    static synchronized String takeAnswers(Context c) {
        String s = prefs(c).getString("answers", "[]");
        prefs(c).edit().putString("answers", "[]").commit();
        return s;
    }

    static void post(Context c, JSONObject it) {
        int id = it.optInt("id");
        boolean alarm = it.optBoolean("alarm");
        String h = it.optString("h"), k = it.optString("k");
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent tap = open == null ? null : PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, alarm ? ALARM : ASK)
            .setSmallIcon(R.drawable.dbk_stat)
            .setContentTitle(it.optString("title"))
            .setContentText(it.optString("body"))
            .setOngoing(!alarm && !it.optBoolean("info"))
            .setAutoCancel(true)
            .setCategory(alarm ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setPriority(alarm ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW)
;
        // info reminders (goal deadlines) have no Yes/No; action labels come from the app so they follow its language
        if (!it.optBoolean("info")) b.addAction(0, it.optString("yes", "Yes, done"), answerIntent(c, id, h, k, "yes")).addAction(0, it.optString("no", "No"), answerIntent(c, id, h, k, "no"));
        if (tap != null) b.setContentIntent(tap);
        b.setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(new NotificationCompat.Builder(c, alarm ? ALARM : ASK)
            .setSmallIcon(R.drawable.dbk_stat).setContentTitle("Groundwork Habits").setContentText("A reminder is waiting for your answer").build());
        Notification n = b.build();
        if (alarm) n.flags |= Notification.FLAG_INSISTENT; // keeps ringing until answered or swiped away
        try { NotificationManagerCompat.from(c).notify(id, n); } catch (SecurityException e) {}
    }

    private static PendingIntent answerIntent(Context c, int id, String h, String k, String ans) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ReminderReceiver.ANSWER)
            .putExtra("id", id).putExtra("h", h).putExtra("k", k).putExtra("a", ans);
        return PendingIntent.getBroadcast(c, id + ("yes".equals(ans) ? 100000 : 200000), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
