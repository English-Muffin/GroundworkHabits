package app.groundwork.nativebridge;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

// The sign-in answer page's "Back to the app" button opens groundworkhabits://back: this invisible activity just brings
// the app forward (closing the Custom Tab above it) and goes away. Carries no data; the answer itself went to OAuth's listener
public class ReturnActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Intent home = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (home != null) {
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(home);
        }
        finish();
    }
}
