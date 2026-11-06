package app.daybook.nativebridge;

import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;

// Same rules as the desktop app: public https only, max 5 redirects, 5 MB, 20 s, must be an iCal file.
final class CalFetch {
    static final int MAX = 5 * 1024 * 1024;

    static JSObject err(String m) { JSObject r = new JSObject(); r.put("ok", false); r.put("error", m); return r; }

    // shortcut: the address is checked before connecting, so a DNS answer that changes in between is not caught; fine for a personal calendar link
    static boolean isPublic(String host) throws Exception {
        if (host == null || host.isEmpty() || host.matches("(?i)^(localhost|.*\\.(localhost|local|internal))\\.?$")) return false;
        for (InetAddress a : InetAddress.getAllByName(host)) {
            if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress() || a.isMulticastAddress()) return false;
            byte[] b = a.getAddress();
            if (a instanceof Inet4Address && ((b[0] & 0xff) == 0 || ((b[0] & 0xff) == 100 && (b[1] & 0xc0) == 64))) return false;
            if (a instanceof Inet6Address && ((b[0] & 0xfe) == 0xfc)) return false;
        }
        return true;
    }

    static JSObject fetch(String url) {
        try {
            URL u = new URL(url.replaceFirst("(?i)^webcal:", "https:"));
            for (int hop = 0; ; hop++) {
                if (!"https".equalsIgnoreCase(u.getProtocol()) || !isPublic(u.getHost())) return err("The address must be a public https:// link");
                HttpsURLConnection c = (HttpsURLConnection) u.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(20000);
                c.setReadTimeout(20000);
                int st = c.getResponseCode();
                if (st >= 300 && st < 400 && c.getHeaderField("Location") != null) {
                    if (hop >= 5) return err("Too many redirects");
                    u = new URL(u, c.getHeaderField("Location"));
                    c.disconnect();
                    continue;
                }
                if (st != 200) return err(st == 404 ? "Calendar address not found. Copy the secret iCal address again" : "Calendar returned an error (" + st + ")");
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) {
                    byte[] buf = new byte[16384];
                    for (int n; (n = in.read(buf)) > 0; ) {
                        out.write(buf, 0, n);
                        if (out.size() > MAX) return err("That calendar is too large");
                    }
                }
                String text = out.toString(StandardCharsets.UTF_8.name());
                if (!text.contains("BEGIN:VCALENDAR")) return err("That address is not an iCal calendar");
                JSObject r = new JSObject();
                r.put("ok", true);
                r.put("text", text);
                return r;
            }
        } catch (java.net.SocketTimeoutException e) {
            return err("Your calendar took too long to respond");
        } catch (Exception e) {
            return err("Could not reach your calendar");
        }
    }
}
