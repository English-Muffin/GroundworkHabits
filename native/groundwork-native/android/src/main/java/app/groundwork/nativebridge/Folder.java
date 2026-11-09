package app.groundwork.nativebridge;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// The folder the user picked (Storage Access Framework tree): groundwork.json lives there, backups in its "backups" subfolder.
// Without a folder, backups go to the app's own storage.
final class Folder {
    static Uri tree(Context c) {
        String s = Reminders.prefs(c).getString("tree", null);
        return s == null ? null : Uri.parse(s);
    }

    static String name(Context c, Uri tree) {
        String id = DocumentsContract.getTreeDocumentId(tree);
        int i = id.lastIndexOf(':');
        return i >= 0 && i < id.length() - 1 ? id.substring(i + 1) : id;
    }

    // [docId, name, mime] of each child of a folder
    static List<String[]> children(ContentResolver r, Uri tree, String parent) {
        List<String[]> out = new ArrayList<>();
        Uri q = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent);
        try (Cursor cur = r.query(q, new String[] { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE }, null, null, null)) {
            while (cur != null && cur.moveToNext()) out.add(new String[] { cur.getString(0), cur.getString(1), cur.getString(2) });
        }
        return out;
    }

    static String find(ContentResolver r, Uri tree, String parent, String name) {
        for (String[] ch : children(r, tree, parent)) if (name.equals(ch[1])) return ch[0];
        return null;
    }

    static String read(Context c) throws Exception {
        Uri tree = tree(c);
        if (tree == null) return null;
        ContentResolver r = c.getContentResolver();
        String id = find(r, tree, DocumentsContract.getTreeDocumentId(tree), "groundwork.json");
        if (id == null) id = find(r, tree, DocumentsContract.getTreeDocumentId(tree), "daybook.json"); // the save's name before the rename
        if (id == null) return null;
        try (InputStream in = r.openInputStream(DocumentsContract.buildDocumentUriUsingTree(tree, id))) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
            return b.toString(StandardCharsets.UTF_8.name());
        }
    }

    static void write(Context c, Uri tree, String parent, String name, String mime, String text) throws Exception {
        ContentResolver r = c.getContentResolver();
        String id = find(r, tree, parent, name);
        Uri doc = id != null ? DocumentsContract.buildDocumentUriUsingTree(tree, id)
            : DocumentsContract.createDocument(r, DocumentsContract.buildDocumentUriUsingTree(tree, parent), mime, name);
        try (OutputStream out = r.openOutputStream(doc, "wt")) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
    }

    static void writeData(Context c, String text) throws Exception {
        Uri tree = tree(c);
        if (tree == null) throw new IllegalStateException("No folder");
        String root = DocumentsContract.getTreeDocumentId(tree);
        write(c, tree, root, "groundwork.json", "application/json", text);
        // the save under its name before the rename: gone once the new one is written, so no stale (unencrypted) copy stays
        ContentResolver r = c.getContentResolver();
        String old = find(r, tree, root, "daybook.json");
        if (old != null) try { DocumentsContract.deleteDocument(r, DocumentsContract.buildDocumentUriUsingTree(tree, old)); } catch (Exception e) { }
    }

    // keeps the newest 8 backups
    static String backup(Context c, String name, String text) throws Exception {
        Uri tree = tree(c);
        if (tree != null) {
            ContentResolver r = c.getContentResolver();
            String root = DocumentsContract.getTreeDocumentId(tree), dir = find(r, tree, root, "backups");
            if (dir == null) dir = DocumentsContract.getDocumentId(DocumentsContract.createDocument(r, DocumentsContract.buildDocumentUriUsingTree(tree, root), DocumentsContract.Document.MIME_TYPE_DIR, "backups"));
            write(c, tree, dir, name, "application/json", text);
            List<String[]> all = new ArrayList<>();
            for (String[] ch : children(r, tree, dir)) if (ch[1] != null && ch[1].startsWith("groundwork-backup-")) all.add(ch);
            all.sort((a, b) -> b[1].compareTo(a[1]));
            for (int i = 8; i < all.size(); i++) DocumentsContract.deleteDocument(r, DocumentsContract.buildDocumentUriUsingTree(tree, all.get(i)[0]));
            return name(c, tree) + "/backups";
        }
        File dir = new File(c.getFilesDir(), "backups");
        dir.mkdirs();
        try (OutputStream out = new FileOutputStream(new File(dir, name))) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
        File[] fs = dir.listFiles((d, n) -> n.startsWith("groundwork-backup-"));
        if (fs != null && fs.length > 8) {
            List<File> l = new ArrayList<>(); Collections.addAll(l, fs);
            l.sort((a, b) -> b.getName().compareTo(a.getName()));
            for (int i = 8; i < l.size(); i++) l.get(i).delete();
        }
        return "app storage";
    }
}
