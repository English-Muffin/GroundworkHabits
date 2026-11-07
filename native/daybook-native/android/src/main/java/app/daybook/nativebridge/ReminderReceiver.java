package app.daybook.nativebridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

// FIRE: show a habit reminder (unless it was already answered Yes). ANSWER: record Yes/No without opening the app.
public class ReminderReceiver extends BroadcastReceiver {
    static final String FIRE = "app.daybook.REMINDER_FIRE", ANSWER = "app.daybook.REMINDER_ANSWER";

    @Override
    public void onReceive(Context c, Intent i) {
        int id = i.getIntExtra("id", 0);
        if (FIRE.equals(i.getAction())) {
            JSONObject it = Reminders.find(c, id);
            if (it != null && !Reminders.answeredYes(c, it.optString("h"), it.optString("k"))) Reminders.post(c, it);
            Reminders.extend(c);
            Reminders.armAll(c);
        } else if (ANSWER.equals(i.getAction())) {
            String h = i.getStringExtra("h"), k = i.getStringExtra("k"), a = i.getStringExtra("a");
            if (h != null && k != null && a != null) Reminders.addAnswer(c, h, k, a);
            NotificationManagerCompat.from(c).cancel(id);
            DaybookNativePlugin.answered();
        }
    }
}
