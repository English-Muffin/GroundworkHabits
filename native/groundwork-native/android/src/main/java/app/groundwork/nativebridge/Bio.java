package app.groundwork.nativebridge;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

// Fingerprint / face unlock: the PIN is encrypted with an Android Keystore key that only a successful biometric check can use.
// A new fingerprint added to the phone invalidates the key (the user then types the PIN once and turns it on again).
final class Bio {
    static final String ALIAS = "groundwork_bio";
    interface Done { void ok(String pin); void fail(String why); }

    static boolean available(Context c) {
        return BiometricManager.from(c).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    static SecretKey key(boolean create) throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (!create && ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true);
        g.init(b.build());
        return g.generateKey();
    }

    static void clear(Context c) {
        try { KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null); ks.deleteEntry(ALIAS); } catch (Exception e) {}
        Reminders.prefs(c).edit().remove("bio").commit();
    }

    static void prompt(FragmentActivity a, Cipher cipher, String title, Done done, java.util.function.Function<Cipher, String> use) {
        a.runOnUiThread(() -> {
            BiometricPrompt p = new BiometricPrompt(a, ContextCompat.getMainExecutor(a), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) {
                    try { done.ok(use.apply(r.getCryptoObject().getCipher())); } catch (Exception e) { done.fail("failed"); }
                }
                @Override public void onAuthenticationError(int code, CharSequence msg) { done.fail(code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON ? "cancelled" : String.valueOf(msg)); }
            });
            p.authenticate(new BiometricPrompt.PromptInfo.Builder().setTitle(title).setNegativeButtonText("Use PIN")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).build(), new BiometricPrompt.CryptoObject(cipher));
        });
    }

    // turn on: encrypt the PIN after a fingerprint check
    static void enable(FragmentActivity a, String pin, String title, Done done) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key(true));
            prompt(a, c, title, done, ci -> {
                try {
                    byte[] ct = ci.doFinal(pin.getBytes(StandardCharsets.UTF_8));
                    Reminders.prefs(a).edit().putString("bio", Base64.encodeToString(ci.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP)).commit();
                    return "";
                } catch (Exception e) { throw new RuntimeException(e); }
            });
        } catch (Exception e) { done.fail("unavailable"); }
    }

    // unlock: decrypt the PIN after a fingerprint check
    static void unlock(FragmentActivity a, String title, Done done) {
        String s = Reminders.prefs(a).getString("bio", null);
        if (s == null) { done.fail("off"); return; }
        try {
            String[] p = s.split(":");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
            prompt(a, c, title, done, ci -> {
                try { return new String(ci.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), StandardCharsets.UTF_8); } catch (Exception e) { throw new RuntimeException(e); }
            });
        } catch (android.security.keystore.KeyPermanentlyInvalidatedException e) { clear(a); done.fail("changed");
        } catch (Exception e) { done.fail("unavailable"); }
    }
}
