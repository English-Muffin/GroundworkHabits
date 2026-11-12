package app.groundwork.nativebridge;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/** In-app update, same rules as the desktop app: GitHub hosts only, the APK must match the release's .sha256,
 *  and Android's own installer refuses it unless it is signed with the same key as the installed app. */
final class Update {
    private static final String API = "https://api.github.com/repos/English-Muffin/GroundworkHabits/releases/latest";
    // the full app only: Lite is "Groundwork-Habits-Lite-…" and has no update check
    private static final Pattern APK = Pattern.compile("^Groundwork-Habits-\\d[\\w.]*-Android\\.apk$");
    private static final long MAX = 100L * 1024 * 1024;

    static File dir(Context c) { return new File(c.getCacheDir(), "update"); }

    /** Old downloads go once the new version runs (or on any start). */
    static void cleanup(Context c) { File[] fs = dir(c).listFiles(); if (fs != null) for (File f : fs) f.delete(); }

    private static boolean githubHost(String h) {
        h = h.toLowerCase();
        return h.equals("api.github.com") || h.equals("github.com") || h.endsWith(".githubusercontent.com");
    }

    /** Opens a GitHub https URL, following redirects by hand so every hop is checked. */
    private static HttpsURLConnection open(String url) throws Exception {
        for (int i = 0; i < 6; i++) {
            URL u = new URL(url);
            if (!"https".equalsIgnoreCase(u.getProtocol()) || !githubHost(u.getHost())) throw new Exception("Not a GitHub address");
            HttpsURLConnection c = (HttpsURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "GroundworkHabits"); c.setRequestProperty("Accept", url.equals(API) ? "application/vnd.github+json" : "*/*");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { url = new URL(u, c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (code != 200) throw new Exception("HTTP " + code);
            return c;
        }
        throw new Exception("Too many redirects");
    }

    private static String text(String url) throws Exception {
        HttpsURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            byte[] b = new byte[64 * 1024]; StringBuilder s = new StringBuilder(); int n; long total = 0;
            while ((n = in.read(b)) > 0) { total += n; if (total > 2_000_000) throw new Exception("Too big"); s.append(new String(b, 0, n, StandardCharsets.UTF_8)); }
            return s.toString();
        } finally { c.disconnect(); }
    }

    static boolean newer(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p > q;
        }
        return false;
    }
    private static int num(String s) { try { return Integer.parseInt(s.replaceAll("\\D.*", "")); } catch (Exception e) { return 0; } }

    private static JSONObject release, apk, sum;

    static JSObject check(Context ctx) {
        JSObject r = new JSObject();
        try {
            JSONObject rel = new JSONObject(text(API));
            String v = rel.optString("tag_name").replaceFirst("^v", ""), mine = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName;
            r.put("ok", true); r.put("page", "https://github.com/English-Muffin/GroundworkHabits/releases/latest");
            if (!v.matches("\\d+(\\.\\d+){1,3}") || !newer(v, mine)) { r.put("update", false); return r; }
            JSONArray as = rel.optJSONArray("assets"); JSONObject a = null, s = null;
            for (int i = 0; as != null && i < as.length(); i++) if (APK.matcher(as.getJSONObject(i).optString("name")).matches()) a = as.getJSONObject(i);
            for (int i = 0; a != null && i < as.length(); i++) if (as.getJSONObject(i).optString("name").equals(a.optString("name") + ".sha256")) s = as.getJSONObject(i);
            if (a == null || s == null) { r.put("update", false); return r; }
            release = rel; apk = a; sum = s;
            r.put("update", true); r.put("version", v); r.put("auto", true);
        } catch (Exception e) { r.put("ok", false); r.put("error", String.valueOf(e.getMessage())); }
        return r;
    }

    /** Downloads and checks the APK, then opens Android's installer. */
    static JSObject install(Context ctx) {
        JSObject r = new JSObject();
        try {
            if (apk == null || sum == null) { r.put("ok", false); r.put("error", "Check for updates first"); return r; }
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                // one-time OK: "Allow from this source"; the user taps Install again afterwards
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(s); r.put("ok", false); r.put("error", "permission"); return r;
            }
            String want = text(sum.getString("browser_download_url")).trim().split("\\s+")[0].toLowerCase();
            if (!want.matches("[0-9a-f]{64}")) throw new Exception("Bad checksum file");
            cleanup(ctx); File d = dir(ctx); d.mkdirs(); File f = new File(d, "update.apk");
            HttpsURLConnection c = open(apk.getString("browser_download_url"));
            MessageDigest md = MessageDigest.getInstance("SHA-256"); long total = 0;
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                byte[] b = new byte[64 * 1024]; int n;
                while ((n = in.read(b)) > 0) { total += n; if (total > MAX) throw new Exception("Too big"); md.update(b, 0, n); out.write(b, 0, n); }
            } finally { c.disconnect(); }
            StringBuilder h = new StringBuilder(); for (byte x : md.digest()) h.append(String.format("%02x", x));
            if (!h.toString().equals(want)) { f.delete(); throw new Exception("The download doesn’t match its checksum"); }
            Uri u = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".gwupdate", f);
            Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i); r.put("ok", true);
        } catch (Exception e) { r.put("ok", false); r.put("error", String.valueOf(e.getMessage())); }
        return r;
    }

    private Update() {}
}
