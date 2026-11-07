package app.daybook.nativebridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// alarms are cleared on reboot and app update; set them again from the stored list
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { Reminders.extend(c); Reminders.armAll(c); }
    }
}
