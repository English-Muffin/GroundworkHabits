package app.groundwork.nativebridge;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

// Cloud sync sign-in (Dropbox, Google Drive), the same as the desktop app: open the provider's sign-in page in the browser
// and wait for its redirect to http://127.0.0.1:53682/?code=…&state=… The page checks state and swaps the code for tokens
// itself (PKCE). Only those two sign-in pages may be opened, only 127.0.0.1 is listened on, and the wait ends after 5 minutes.
// The browser can't bring the app back on its own, so the answer page has a button that opens it
final class OAuth {
    static final int PORT = 53682;
    // a new sign-in replaces one still waiting (its browser tab may have been closed): the old wait is closed and lets go of the port
    private static final java.util.concurrent.atomic.AtomicInteger GEN = new java.util.concurrent.atomic.AtomicInteger();
    private static volatile ServerSocket current;
    static final String REPLACED = "replaced";

    static boolean urlOk(String url) {
        return url != null && (url.startsWith("https://www.dropbox.com/oauth2/authorize?") || url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"));
    }

    // the query string of the redirect, or null after 5 minutes
    static String run(android.app.Activity c, String url) throws Exception {
        int me = GEN.incrementAndGet();
        ServerSocket old = current;
        if (old != null) try { old.close(); } catch (Exception e) { }
        ServerSocket bound = null;
        for (int i = 0; i < 30 && bound == null; i++) {
            try { bound = new ServerSocket(PORT, 4, InetAddress.getByName("127.0.0.1")); } catch (java.net.BindException e) { Thread.sleep(100); }
        }
        if (bound == null) throw new java.net.BindException("busy");
        current = bound;
        try (ServerSocket server = bound) {
            // a Custom Tab in this app's task (no browser with Custom Tabs: Android opens the normal browser instead)
            c.runOnUiThread(() -> new androidx.browser.customtabs.CustomTabsIntent.Builder().build().launchUrl(c, Uri.parse(url)));
            long end = System.currentTimeMillis() + 300_000;
            while (System.currentTimeMillis() < end) {
                if (GEN.get() != me) return REPLACED;
                server.setSoTimeout((int) Math.max(1000, end - System.currentTimeMillis()));
                try (Socket s = server.accept()) {
                    s.setSoTimeout(5000);
                    byte[] buf = new byte[8192];
                    InputStream in = s.getInputStream();
                    int n = in.read(buf);
                    String req = n > 0 ? new String(buf, 0, n, StandardCharsets.UTF_8) : "";
                    String[] line = req.split("\r?\n", 2)[0].split(" ");
                    String path = line.length > 1 ? line[1] : "";
                    OutputStream out = s.getOutputStream();
                    if (path.startsWith("/?")) {
                        String back = "intent://back#Intent;scheme=groundworkhabits;package=" + c.getPackageName() + ";end"; // ReturnActivity
                        String html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Groundwork Habits</title>"
                            + "<body style='background:#080808;color:#eee;font:17px system-ui;display:grid;place-items:center;height:85vh;text-align:center;margin:0'><div>"
                            + "<h2>You\u2019re signed in</h2><p>Go back to Groundwork Habits to finish.</p>"
                            + "<p><a href='" + back + "' style='display:inline-block;background:#9cc96b;color:#0b0b0b;padding:14px 26px;border-radius:99px;text-decoration:none;font-weight:600'>Back to the app</a></p></div>";
                        byte[] b = html.getBytes(StandardCharsets.UTF_8);
                        out.write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                        out.write(b);
                        out.flush();
                        // back to the app: MainActivity is singleTask, so starting it closes the Custom Tab above it in the same task
                        Intent home = new Intent(c, c.getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        c.runOnUiThread(() -> { try { c.startActivity(home); } catch (Exception e) { } });
                        return path.substring(2);
                    }
                    out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.UTF_8));
                } catch (SocketTimeoutException e) {
                    // keep waiting until the end time
                } catch (java.net.SocketException e) {
                    if (GEN.get() != me) return REPLACED; // closed by a newer sign-in
                    throw e;
                }
            }
            return null;
        } finally {
            if (current == bound) current = null;
        }
    }
}
