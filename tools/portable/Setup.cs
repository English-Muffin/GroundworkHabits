// Groundwork Habits installer and uninstaller, in the app's own look (compiled by tools/build_setup.js with the C# compiler
// that ships with Windows; C# 5 on purpose). One source, two programs:
//   SETUP (default): carries the app (app.zip), the uninstaller, the logo and fonts. Pages: welcome, folder, progress, done.
//   UNINSTALLER (/define:UNINST): keep or erase data, progress, done. Copies itself to %TEMP% first, so it can delete its folder.
// Silent use: setup /S [/D=folder] (installs, no window)   setup /update (progress only, then opens the app)
//             uninstaller /S [/ERASE]
// Safety: a folder is only ever deleted when it is a Groundwork Habits install (holds "Groundwork Habits.exe" or
// resources\app.asar), and "Erase everything" deletes only the app's own data folder (%APPDATA%\Groundwork Habits).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using Microsoft.Win32;

[assembly: AssemblyTitle("Groundwork Habits setup")]
[assembly: AssemblyProduct("Groundwork Habits")]

static class Setup
{
    const string Name = "Groundwork Habits", Exe = "Groundwork Habits.exe", UninstExe = "Uninstall Groundwork Habits.exe";
    const string RegKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\GroundworkHabits", AppId = "com.groundwork.habits";
    static readonly Assembly Asm = Assembly.GetExecutingAssembly();
    static string Version = "0";
    static string FontDir;
    static FontFamily Font, FontBold;
    static Application App;
    static string ShotDir; // developer option /SHOTS=folder: renders each page to a PNG (no screen needed) and installs nothing
    static void Snap(Window w, string name)
    {
        w.UpdateLayout();
        var el = (FrameworkElement)w.Content;
        var r = new RenderTargetBitmap((int)(el.ActualWidth * 2), (int)(el.ActualHeight * 2), 192, 192, PixelFormats.Pbgra32);
        r.Render(el);
        var enc = new PngBitmapEncoder(); enc.Frames.Add(BitmapFrame.Create(r));
        using (var f = File.Create(Path.Combine(ShotDir, name + ".png"))) enc.Save(f);
    }
    static string LogPath = Path.Combine(Path.GetTempPath(), "GroundworkHabits-setup.log");

    // ---- colours (the app's dark theme, default accent) ----
    static readonly Brush Bg = Hex("#080808"), Card = Hex("#0f0f0f"), Line = Hex("#2a2a2a"), Text = Hex("#f2f2f2"),
        Muted = Hex("#8a8a8a"), Accent = Hex("#9cc96b"), OnAccent = Hex("#14200a"), Red = Hex("#f43f5e"), Track = Hex("#1b1b1b");
    static SolidColorBrush Hex(string h) { var b = new SolidColorBrush((Color)ColorConverter.ConvertFromString(h)); b.Freeze(); return b; }

    static void Log(string s) { try { File.AppendAllText(LogPath, DateTime.Now.ToString("s") + " " + s + Environment.NewLine); } catch (Exception) { } }

    [STAThread]
    static int Main(string[] args)
    {
        try { using (var r = new StreamReader(Asm.GetManifestResourceStream("version.txt"))) Version = r.ReadToEnd().Trim(); } catch (Exception) { }
        bool silent = args.Any(a => a.Equals("/S", StringComparison.OrdinalIgnoreCase));
        bool created; var one = new Mutex(true, "GroundworkHabits-setup", out created); // one setup or uninstaller at a time
        if (!created && !args.Any(x => x.StartsWith("/FROM=", StringComparison.OrdinalIgnoreCase)))
        { if (!silent) MessageBox.Show("Groundwork Habits setup is already running.", "Groundwork Habits"); return 1; }
        GC.KeepAlive(one);
        ShotDir = Arg(args, "/SHOTS=");
#if UNINST
        bool erase = args.Any(a => a.Equals("/ERASE", StringComparison.OrdinalIgnoreCase));
        string from = Arg(args, "/FROM=");
        if (ShotDir != null) return RunUi(() => UninstallWindow(@"C:\Example"));
        if (from == null)
        {
            // running from the install folder: continue from a copy in %TEMP%, which can delete that folder
            string me = Asm.Location, dir = Path.GetDirectoryName(me);
            string tmp = Path.Combine(Path.GetTempPath(), "GroundworkHabits-uninstall-" + Guid.NewGuid().ToString("N").Substring(0, 8) + ".exe");
            File.Copy(me, tmp, true);
            // this copy exits straight away: while it runs, its own file keeps the folder from being deleted
            Process.Start(new ProcessStartInfo(tmp, "\"/FROM=" + dir + "\" /PARENT=" + Process.GetCurrentProcess().Id + (silent ? " /S" : "") + (erase ? " /ERASE" : "")) { UseShellExecute = false });
            return 0;
        }
        int parent;
        if (int.TryParse(Arg(args, "/PARENT=") ?? "", out parent))
            try { Process.GetProcessById(parent).WaitForExit(15000); } catch (Exception) { } // already gone
        if (silent) { int rc = Uninstall(from, erase, null); SelfDelete(); return rc; }
        int code = RunUi(() => UninstallWindow(from));
        SelfDelete();
        return code;
#else
        string d = Arg(args, "/D=");
        bool update = args.Any(a => a.Equals("/update", StringComparison.OrdinalIgnoreCase));
        if (ShotDir != null) return RunUi(() => SetupWindow(null, false));
        if (silent) return Install(d != null ? d : DefaultDir(), true, true, null) ? 0 : 1;
        return RunUi(() => SetupWindow(d, update));
#endif
    }

    static string Arg(string[] args, string p)
    {
        var a = args.FirstOrDefault(x => x.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        return a == null ? null : a.Substring(p.Length).Trim('"');
    }

    static int RunUi(Func<Window> make)
    {
        App = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        // an unexpected error is logged and shown, never a silent crash
        App.DispatcherUnhandledException += (o, e) =>
        {
            Log("ui error: " + e.Exception); e.Handled = true;
            MessageBox.Show("Something went wrong: " + e.Exception.Message + Environment.NewLine + "Details are in " + LogPath, Name, MessageBoxButton.OK, MessageBoxImage.Warning);
        };
        LoadFonts();
        var w = make();
        App.Run(w);
        return 0;
    }

    static void LoadFonts()
    {
        FontDir = Path.Combine(Path.GetTempPath(), "GroundworkHabits-fonts");
        try
        {
            Directory.CreateDirectory(FontDir);
            foreach (var n in new[] { "SpaceGrotesk-Regular.ttf", "SpaceGrotesk-Bold.ttf" })
                using (var s = Asm.GetManifestResourceStream(n)) using (var f = File.Create(Path.Combine(FontDir, n))) s.CopyTo(f);
            Font = new FontFamily(new Uri(FontDir + "\\"), "./#Space Grotesk");
        }
        catch (Exception) { Font = new FontFamily("Segoe UI"); }
        FontBold = Font;
    }

    // ---------------------------------------------------------------- shared work
    static bool IsOurs(string dir)
    {
        return !string.IsNullOrEmpty(dir) && Directory.Exists(dir) &&
            (File.Exists(Path.Combine(dir, Exe)) || File.Exists(Path.Combine(dir, "resources", "app.asar")) || File.Exists(Path.Combine(dir, UninstExe)));
    }

    // remove a folder even with paths over 260 characters (1.7.0 shipped some); only ever called on our own folders
    static void RemoveDir(string dir)
    {
        if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
        try
        {
            var p = Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "cmd.exe"), "/c rd /s /q \"\\\\?\\" + dir.TrimEnd('\\') + "\"")
                { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
            p.WaitForExit(60000);
        }
        catch (Exception e) { Log("rd failed: " + e.Message); }
        for (int i = 0; i < 5 && Directory.Exists(dir); i++) { try { Directory.Delete(dir, true); } catch (Exception) { Thread.Sleep(400); } }
    }

    // close a running Groundwork Habits (any copy of this user, e.g. the portable one): ask first so it saves, then force
    static void CloseApp()
    {
        int session = Process.GetCurrentProcess().SessionId;
        var procs = Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Exe)).Where(p => p.SessionId == session).ToList();
        if (procs.Count == 0) return;
        Log("closing " + procs.Count + " processes");
        foreach (var p in procs) try { p.CloseMainWindow(); } catch (Exception) { }
        for (int i = 0; i < 30 && procs.Any(p => { try { return !p.HasExited; } catch (Exception) { return false; } }); i++) Thread.Sleep(100);
        foreach (var p in procs) try { if (!p.HasExited) { p.Kill(); p.WaitForExit(3000); } } catch (Exception) { }
        Thread.Sleep(400);
    }

    static string ShortcutPath(bool desktop)
    {
        return Path.Combine(Environment.GetFolderPath(desktop ? Environment.SpecialFolder.DesktopDirectory : Environment.SpecialFolder.Programs), Name + ".lnk");
    }

    static string InstalledDir()
    {
        using (var k = Registry.CurrentUser.OpenSubKey(RegKey)) { var v = k == null ? null : k.GetValue("InstallLocation") as string; if (IsOurs(v)) return v; }
        // installs made by the earlier (NSIS) installer
        foreach (var o in OldInstalls()) if (IsOurs(o.Item2)) return o.Item2;
        return null;
    }

    // earlier installer's entries: (registry key name, folder)
    static List<Tuple<string, string>> OldInstalls()
    {
        var r = new List<Tuple<string, string>>();
        using (var u = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall"))
        {
            if (u == null) return r;
            foreach (var n in u.GetSubKeyNames())
            {
                if (n == "GroundworkHabits") continue;
                using (var k = u.OpenSubKey(n))
                {
                    var dn = k == null ? null : k.GetValue("DisplayName") as string;
                    if (dn == null || !dn.StartsWith(Name)) continue;
                    var us = (k.GetValue("UninstallString") as string ?? "").Trim();
                    string exe = us.StartsWith("\"") ? us.Substring(1, Math.Max(0, us.IndexOf('"', 1) - 1)) : us.Split(' ')[0];
                    r.Add(Tuple.Create(n, exe.Length > 0 ? Path.GetDirectoryName(exe) : null));
                }
            }
        }
        return r;
    }

    // ---------------------------------------------------------------- install
#if !UNINST
    static string DefaultDir()
    {
        var d = InstalledDir();
        return d ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", Name);
    }

    // a chosen folder gets a "Groundwork Habits" folder inside it, so installing never mixes with (or later deletes) other files
    static string Target(string chosen)
    {
        chosen = Path.GetFullPath(chosen.Trim().Trim('"')).TrimEnd('\\');
        return string.Equals(Path.GetFileName(chosen), Name, StringComparison.OrdinalIgnoreCase) || IsOurs(chosen) ? chosen : Path.Combine(chosen, Name);
    }

    // why a folder can't be used, or null
    static string BadPath(string t)
    {
        if (t.Length == 0) return "Type or choose a folder.";
        string full;
        try { full = Path.GetFullPath(t); if (!Path.IsPathRooted(t) || t.StartsWith("\\\\")) return "Use a full path on a drive, like C:\\Apps."; }
        catch (Exception) { return "That isn’t a valid folder path."; }
        string win = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        if (full.StartsWith(win, StringComparison.OrdinalIgnoreCase)) return "Windows’ own folder can’t be used.";
        try { var d = new DriveInfo(Path.GetPathRoot(full)); if (!d.IsReady) return "That drive isn’t available."; if (d.AvailableFreeSpace < Needed()) return "Not enough space on " + d.Name + " (needs " + Mb(Needed()) + ")."; }
        catch (Exception) { return "That drive isn’t available."; }
        return null;
    }
    static long needed;
    static long Needed()
    {
        if (needed == 0) using (var z = new ZipArchive(Asm.GetManifestResourceStream("app.zip"), ZipArchiveMode.Read)) needed = z.Entries.Sum(e => e.Length) + (20L << 20);
        return needed;
    }
    static string Mb(long b) { return b >= (1L << 30) ? (b / (double)(1L << 30)).ToString("0.#") + " GB" : (b >> 20) + " MB"; }
    static string SpaceLine(string dir)
    {
        try { var d = new DriveInfo(Path.GetPathRoot(Path.GetFullPath(dir))); return "Needs " + Mb(Needed()) + " · " + Mb(d.AvailableFreeSpace) + " free on " + d.Name.TrimEnd('\\'); }
        catch (Exception) { return "Needs " + Mb(Needed()); }
    }

    // report(percent, line) — null in silent mode
    static bool Install(string chosen, bool desktop, bool startMenu, Action<double, string> report)
    {
        Action<double, string> say = (p, s) => { Log(s); if (report != null) report(p, s); };
        string dir = null, old = null;
        try
        {
            dir = Target(chosen);
            Log("install " + Version + " to " + dir);
            if (Directory.Exists(dir) && !IsOurs(dir) && Directory.EnumerateFileSystemEntries(dir).Any())
                throw new Exception("“" + dir + "” already has other files in it. Choose another folder.");
            bool fresh = !Directory.Exists(dir);
            Directory.CreateDirectory(dir);
            // a quick write test gives a clear message for folders that need administrator rights, before anything is touched
            var probe = Path.Combine(dir, ".write-test");
            try { File.WriteAllText(probe, ""); File.Delete(probe); }
            catch (Exception) { if (fresh) try { Directory.Delete(dir); } catch (Exception) { } throw new Exception("Can’t write to “" + dir + "”. Choose a folder in your user profile, or run setup as administrator."); }
            say(2, "Closing Groundwork Habits");
            CloseApp();
            say(8, "Removing the old version");
            var later = new List<string>(); // other folders go only once the new version is in place
            foreach (var o in OldInstalls())
            {
                if (IsOurs(o.Item2) && !string.Equals(o.Item2.TrimEnd('\\'), dir, StringComparison.OrdinalIgnoreCase)) later.Add(o.Item2);
                try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + o.Item1, false); } catch (Exception) { }
                try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\" + o.Item1, false); } catch (Exception) { }
            }
            var prev = InstalledDir();
            if (prev != null && !string.Equals(prev.TrimEnd('\\'), dir, StringComparison.OrdinalIgnoreCase)) later.Add(prev);
            if (IsOurs(dir))
            {
                old = dir + ".old"; RemoveDir(old);
                try { Directory.Move(dir, old); } catch (Exception) { old = null; RemoveDir(dir); } // locked: no rollback copy, remove instead
            }
            Directory.CreateDirectory(dir);

            say(12, "Copying files");
            using (var z = new ZipArchive(Asm.GetManifestResourceStream("app.zip"), ZipArchiveMode.Read))
            {
                var files = z.Entries.Where(e => e.Name.Length > 0).ToList();
                long total = Math.Max(1, files.Sum(e => e.Length)), done = 0;
                double last = 0;
                foreach (var e in files)
                {
                    var dest = Path.GetFullPath(Path.Combine(dir, e.FullName));
                    if (!dest.StartsWith(dir + "\\", StringComparison.OrdinalIgnoreCase)) continue; // never outside the folder
                    Directory.CreateDirectory(Path.GetDirectoryName(dest));
                    e.ExtractToFile(dest, true);
                    done += e.Length;
                    double pct = 12 + 78.0 * done / total;
                    if (pct - last >= 1) { last = pct; if (report != null) report(pct, "Copying files… " + (int)(100.0 * done / total) + "%"); }
                }
            }
            using (var s = Asm.GetManifestResourceStream("uninstaller.exe")) using (var f = File.Create(Path.Combine(dir, UninstExe))) s.CopyTo(f);

            say(92, "Creating shortcuts");
            string exe = Path.Combine(dir, Exe);
            try { File.Delete(ShortcutPath(true)); } catch (Exception) { }
            if (desktop) Shortcut(ShortcutPath(true), exe, dir, false);
            Shortcut(ShortcutPath(false), exe, dir, true); // the Start menu one carries the app ID notifications need
            if (!startMenu) { } // shortcut: the Start menu shortcut is always made (Windows needs it for notifications), the checkbox is only shown for the desktop

            say(97, "Registering with Windows");
            long kb = new DirectoryInfo(dir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length) / 1024;
            using (var k = Registry.CurrentUser.CreateSubKey(RegKey))
            {
                k.SetValue("DisplayName", Name);
                k.SetValue("DisplayVersion", Version);
                k.SetValue("Publisher", "English-Muffin");
                k.SetValue("DisplayIcon", exe);
                k.SetValue("InstallLocation", dir);
                k.SetValue("UninstallString", "\"" + Path.Combine(dir, UninstExe) + "\"");
                k.SetValue("QuietUninstallString", "\"" + Path.Combine(dir, UninstExe) + "\" /S");
                k.SetValue("URLInfoAbout", "https://github.com/English-Muffin/GroundworkHabits");
                k.SetValue("EstimatedSize", (int)Math.Min(int.MaxValue, kb), RegistryValueKind.DWord);
                k.SetValue("NoModify", 1, RegistryValueKind.DWord);
                k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
            if (old != null) RemoveDir(old);
            foreach (var x in later) RemoveDir(x);
            say(100, "Done");
            return true;
        }
        catch (Exception e)
        {
            Log("install failed: " + e);
            // rollback: put the previous version back so a failed update never leaves the user without the app
            if (old != null && Directory.Exists(old)) { RemoveDir(dir); try { Directory.Move(old, dir); Log("rolled back"); } catch (Exception x) { Log("rollback failed: " + x.Message); } }
            if (report != null) report(-1, e.Message);
            return false;
        }
    }

    static void Shortcut(string lnk, string target, string dir, bool appId)
    {
        try
        {
            var link = (IShellLinkW)new CShellLink();
            link.SetPath(target); link.SetWorkingDirectory(dir); link.SetIconLocation(target, 0); link.SetDescription("Habits, tasks and goals in one calm place");
            if (appId)
            {
                var store = (IPropertyStore)link;
                var key = new PropertyKey { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 }; // System.AppUserModel.ID
                var v = new PropVariant { vt = 31, p = Marshal.StringToCoTaskMemUni(AppId) };
                store.SetValue(ref key, ref v); store.Commit();
                Marshal.FreeCoTaskMem(v.p);
            }
            Directory.CreateDirectory(Path.GetDirectoryName(lnk));
            ((IPersistFile)link).Save(lnk, true);
        }
        catch (Exception e) { Log("shortcut failed: " + e.Message); }
    }

    [ComImport, Guid("00021401-0000-0000-C000-000000000046")] class CShellLink { }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
    interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder f, int c, IntPtr fd, int fl);
        void GetIDList(out IntPtr p); void SetIDList(IntPtr p);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder n, int c);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string n);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder d, int c);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string d);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder a, int c);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string a);
        void GetHotkey(out short h); void SetHotkey(short h); void GetShowCmd(out int s); void SetShowCmd(int s);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder p, int c, out int i);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string p, int i);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string p, int r);
        void Resolve(IntPtr h, int f); void SetPath([MarshalAs(UnmanagedType.LPWStr)] string p);
    }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
    interface IPersistFile
    {
        void GetClassID(out Guid g); [PreserveSig] int IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string f, int m);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string f, bool r);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string f); void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string f);
    }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    interface IPropertyStore
    {
        void GetCount(out uint c); void GetAt(uint i, out PropertyKey k); void GetValue(ref PropertyKey k, out PropVariant v);
        void SetValue(ref PropertyKey k, ref PropVariant v); void Commit();
    }
    [StructLayout(LayoutKind.Sequential, Pack = 4)] struct PropertyKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Explicit)] struct PropVariant { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr p; }
#endif

    // ---------------------------------------------------------------- uninstall
#if UNINST
    static int Uninstall(string dir, bool erase, Action<double, string> report)
    {
        Action<double, string> say = (p, s) => { Log(s); if (report != null) report(p, s); };
        try
        {
            say(5, "Closing Groundwork Habits");
            CloseApp();
            say(25, "Removing shortcuts");
            try { File.Delete(ShortcutPath(true)); } catch (Exception) { }
            try { File.Delete(ShortcutPath(false)); } catch (Exception) { }
            say(40, "Removing files");
            if (IsOurs(dir)) RemoveDir(dir);
            if (erase)
            {
                say(80, "Erasing your data");
                RemoveDir(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Groundwork Habits"));
                RemoveDir(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Daybook")); // the data folder's name before the rename
                try { foreach (var x in Directory.GetDirectories(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), Name + "-before-rename-*")) RemoveDir(x); } catch (Exception) { }
            }
            try { Registry.CurrentUser.DeleteSubKeyTree(RegKey, false); } catch (Exception) { }
            say(100, "Done");
            return 0;
        }
        catch (Exception e) { Log("uninstall failed: " + e); if (report != null) report(-1, e.Message); return 1; }
    }

    // the temp copy removes itself a moment after it exits
    static void SelfDelete()
    {
        try
        {
            Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "cmd.exe"),
                "/c ping 127.0.0.1 -n 3 > nul & del /q \"" + Asm.Location + "\"") { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
        }
        catch (Exception) { }
    }
#endif

    // ---------------------------------------------------------------- UI pieces
    static TextBlock T(string s, double size, Brush color, bool bold = false)
    {
        return new TextBlock { Text = s, FontFamily = bold ? FontBold : Font, FontSize = size, Foreground = color, FontWeight = bold ? FontWeights.Bold : FontWeights.Normal, TextWrapping = TextWrapping.Wrap };
    }

    static Image Logo(double size)
    {
        var bmp = new BitmapImage();
        bmp.BeginInit(); bmp.StreamSource = Asm.GetManifestResourceStream("logo.png"); bmp.CacheOption = BitmapCacheOption.OnLoad; bmp.EndInit();
        var img = new Image { Source = bmp, Width = size, Height = size };
        RenderOptions.SetBitmapScalingMode(img, BitmapScalingMode.HighQuality);
        return img;
    }

    // a pill button; primary = accent filled
    static Border Btn(string text, bool primary, Action click)
    {
        var tb = T(text, 13.5, primary ? OnAccent : Text, true);
        tb.TextWrapping = TextWrapping.NoWrap; tb.VerticalAlignment = VerticalAlignment.Center;
        var b = new Border
        {
            Child = tb, Height = 38, Padding = new Thickness(22, 0, 22, 0), CornerRadius = new CornerRadius(19), Cursor = Cursors.Hand, // straight sides, round ends (a larger radius draws an oval)
            Background = primary ? Accent : Brushes.Transparent, BorderBrush = primary ? Accent : Line, BorderThickness = new Thickness(1),
            Margin = new Thickness(10, 0, 0, 0), Focusable = true
        };
        b.Tag = click; System.Windows.Automation.AutomationProperties.SetName(b, text); b.FocusVisualStyle = null;
        b.GotKeyboardFocus += (s, e) => { if (InputManager.Current.MostRecentInputDevice is KeyboardDevice) b.BorderBrush = Text; };
        b.LostKeyboardFocus += (s, e) => b.BorderBrush = primary ? Accent : Line;
        b.MouseEnter += (s, e) => { if (b.IsEnabled) b.Opacity = 0.88; };
        b.MouseLeave += (s, e) => b.Opacity = b.IsEnabled ? 1 : 0.4;
        b.MouseLeftButtonUp += (s, e) => { if (b.IsEnabled) Invoke(b); };
        b.KeyDown += (s, e) => { if (b.IsEnabled && (e.Key == Key.Enter || e.Key == Key.Space)) { Invoke(b); e.Handled = true; } };
        b.IsEnabledChanged += (s, e) => b.Opacity = b.IsEnabled ? 1 : 0.4;
        return b;
    }

    // a card-like option row: a checkbox (round = false) or a radio (round = true)
    class Opt
    {
        public Border Root; public bool On; Border box; TextBlock tick; bool round; Action changed;
        public Opt(string title, string sub, bool on, bool round, Brush titleColor, Action changed)
        {
            this.round = round; this.changed = changed;
            box = new Border { Width = 20, Height = 20, CornerRadius = new CornerRadius(round ? 10 : 6), BorderThickness = new Thickness(2), Margin = new Thickness(0, 1, 12, 0), VerticalAlignment = VerticalAlignment.Top };
            tick = T(round ? "" : "✓", 12, OnAccent, true); tick.HorizontalAlignment = HorizontalAlignment.Center; tick.VerticalAlignment = VerticalAlignment.Center; tick.Margin = new Thickness(0, -2, 0, 0);
            box.Child = tick;
            var text = new StackPanel();
            text.Children.Add(T(title, 14, titleColor ?? Text, true));
            if (sub != null) { var st = T(sub, 12, Muted); st.Margin = new Thickness(0, 2, 0, 0); text.Children.Add(st); }
            var row = new DockPanel(); DockPanel.SetDock(box, Dock.Left); row.Children.Add(box); row.Children.Add(text);
            Root = new Border { Child = row, Padding = new Thickness(14, 12, 14, 12), CornerRadius = new CornerRadius(14), BorderThickness = new Thickness(1), Margin = new Thickness(0, 0, 0, 8), Cursor = Cursors.Hand };
            Root.MouseLeftButtonUp += (s, e) => Toggle();
            Root.Focusable = true; Root.FocusVisualStyle = null; System.Windows.Automation.AutomationProperties.SetName(Root, title);
            Root.KeyDown += (s, e) => { if (e.Key == Key.Space) { Toggle(); e.Handled = true; } };
            Root.GotKeyboardFocus += (s, e) => { if (InputManager.Current.MostRecentInputDevice is KeyboardDevice) Root.BorderBrush = Text; };
            Root.LostKeyboardFocus += (s, e) => Root.BorderBrush = On ? Accent : Line;
            Set(on);
        }
        void Toggle() { if (round && On) return; Set(!On); if (changed != null) changed(); }
        public void Set(bool on)
        {
            On = on;
            Root.BorderBrush = on ? Accent : Line;
            Root.Background = on ? new SolidColorBrush(Color.FromArgb(20, 0x9c, 0xc9, 0x6b)) : Card;
            if (round) { box.BorderBrush = on ? Accent : Hex("#555555"); box.BorderThickness = new Thickness(on ? 6 : 2); box.Background = Brushes.Transparent; }
            else { box.BorderBrush = on ? Accent : Hex("#555555"); box.Background = on ? Accent : Brushes.Transparent; tick.Visibility = on ? Visibility.Visible : Visibility.Hidden; }
        }
    }

    // progress bar: track + glowing accent fill
    class Bar
    {
        public Grid Root; Border fill;
        public Bar()
        {
            Root = new Grid { Height = 10, Margin = new Thickness(0, 18, 0, 12) };
            Root.Children.Add(new Border { Background = Track, CornerRadius = new CornerRadius(5) });
            fill = new Border
            {
                CornerRadius = new CornerRadius(5), HorizontalAlignment = HorizontalAlignment.Left, Width = 0,
                Background = new LinearGradientBrush(Color.FromArgb(0x80, 0x9c, 0xc9, 0x6b), Color.FromRgb(0x9c, 0xc9, 0x6b), 0),
                Effect = new System.Windows.Media.Effects.DropShadowEffect { Color = Color.FromRgb(0x9c, 0xc9, 0x6b), BlurRadius = 14, ShadowDepth = 0, Opacity = 0.5 }
            };
            Root.Children.Add(fill);
        }
        public void Now(double pct) { Root.UpdateLayout(); fill.Width = Math.Max(0, Math.Min(1, pct / 100)) * Root.ActualWidth; }
        public void Set(double pct)
        {
            double w = Math.Max(0, Math.Min(1, pct / 100)) * Math.Max(1, Root.ActualWidth);
            fill.BeginAnimation(FrameworkElement.WidthProperty, new DoubleAnimation(w, TimeSpan.FromMilliseconds(250)) { EasingFunction = new QuadraticEase() });
        }
    }

    // the window: borderless, rounded, the app's dark card, a title bar you can drag, minimise and close
    static Window Shell(string title, out ContentControl body, out StackPanel foot, out Border close)
    {
        var w = new Window
        {
            Title = title, Width = 580, Height = 420, WindowStyle = WindowStyle.None, AllowsTransparency = true, Background = Brushes.Transparent,
            ResizeMode = ResizeMode.NoResize, WindowStartupLocation = WindowStartupLocation.CenterScreen, FontFamily = Font, UseLayoutRounding = true
        };
        try { w.Icon = BitmapFrame.Create(Asm.GetManifestResourceStream("logo.png")); } catch (Exception) { }
        var root = new Border { Background = Bg, BorderBrush = Line, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(14), Margin = new Thickness(10),
            Effect = new System.Windows.Media.Effects.DropShadowEffect { BlurRadius = 18, ShadowDepth = 4, Opacity = 0.5 } };
        var g = new Grid();
        g.RowDefinitions.Add(new RowDefinition { Height = new GridLength(42) });
        g.RowDefinitions.Add(new RowDefinition());
        g.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var bar = new DockPanel { Margin = new Thickness(16, 0, 8, 0), Background = Brushes.Transparent };
        var lg = Logo(18); lg.Margin = new Thickness(0, 0, 10, 0); DockPanel.SetDock(lg, Dock.Left); bar.Children.Add(lg);
        Func<string, Border> tbtn = s => { var t = T(s, 13, Muted); t.HorizontalAlignment = HorizontalAlignment.Center; t.VerticalAlignment = VerticalAlignment.Center;
            var b = new Border { Width = 34, Height = 28, CornerRadius = new CornerRadius(7), Child = t, Cursor = Cursors.Hand, Background = Brushes.Transparent };
            b.MouseEnter += (o, e) => b.Background = Hex("#1a1a1a"); b.MouseLeave += (o, e) => b.Background = Brushes.Transparent;
            b.MouseLeftButtonDown += (o, e) => e.Handled = true; // otherwise the title bar's drag swallows the click
            System.Windows.Automation.AutomationProperties.SetName(b, s == "✕" ? "Close" : "Minimise"); return b; };
        close = tbtn("✕"); var min = tbtn("—");
        close.MouseEnter += (o, e) => ((Border)o).Background = Hex("#3a1219");
        DockPanel.SetDock(close, Dock.Right); DockPanel.SetDock(min, Dock.Right);
        bar.Children.Add(close); bar.Children.Add(min);
        min.MouseLeftButtonUp += (o, e) => w.WindowState = WindowState.Minimized;
        var tt = T(title, 12.5, Muted); tt.VerticalAlignment = VerticalAlignment.Center; bar.Children.Add(tt);
        bar.MouseLeftButtonDown += (o, e) => { if (e.ButtonState == MouseButtonState.Pressed) w.DragMove(); };
        g.Children.Add(bar);
        body = new ContentControl { Margin = new Thickness(36, 6, 36, 0) }; Grid.SetRow(body, 1); g.Children.Add(body);
        var footBorder = new Border { BorderBrush = Hex("#1c1c1c"), BorderThickness = new Thickness(0, 1, 0, 0), Padding = new Thickness(24, 14, 24, 14) };
        foot = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        footBorder.Child = foot; Grid.SetRow(footBorder, 2); g.Children.Add(footBorder);
        root.Child = g; w.Content = root;
        var footRef = foot;
        // Enter = the main button, Esc = back / cancel (or closes the confirm box); typing in a field keeps its own Enter
        w.PreviewKeyDown += (o, e) =>
        {
            var box = g.Children.OfType<Grid>().FirstOrDefault(x => x.Tag is StackPanel);
            StackPanel btns = box != null ? (StackPanel)box.Tag : footRef;
            if (e.Key == Key.Escape) { if (box != null) { g.Children.Remove(box); e.Handled = true; return; } var first = btns.Children.OfType<Border>().FirstOrDefault(); if (first != null && first.IsEnabled && btns.Children.Count > 1) { Invoke(first); e.Handled = true; } }
            if (e.Key == Key.Enter && !(Keyboard.FocusedElement is TextBox) && !(Keyboard.FocusedElement is Border && ((Border)Keyboard.FocusedElement).Tag is Action))
            { var last = btns.Children.OfType<Border>().LastOrDefault(); if (last != null && last.IsEnabled) { Invoke(last); e.Handled = true; } }
        };
        w.Closing += (o, e) => { if (Busy) e.Cancel = true; }; // never mid-install, Alt+F4 included
        return w;
    }
    static bool Busy;
    static void Invoke(Border b) { var a = b.Tag as Action; if (a != null) a(); }

    // a themed confirm box over the window
    static void Confirm(Window w, string title, string text, string yes, bool danger, Action onYes)
    {
        var g = (Grid)((Border)w.Content).Child;
        var over = new Grid { Background = new SolidColorBrush(Color.FromArgb(0xb0, 0, 0, 0)) };
        Grid.SetRowSpan(over, 3);
        var card = new StackPanel { Margin = new Thickness(22) };
        card.Children.Add(T(title, 18, Text, true));
        var d = T(text, 13, Muted); d.Margin = new Thickness(0, 6, 0, 16); card.Children.Add(d);
        var btns = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        btns.Children.Add(Btn("Stay", false, () => g.Children.Remove(over)));
        var y = Btn(yes, true, () => { g.Children.Remove(over); onYes(); });
        if (danger) { y.Background = Red; y.BorderBrush = Red; ((TextBlock)y.Child).Foreground = Brushes.White; }
        btns.Children.Add(y); card.Children.Add(btns);
        over.Tag = btns;
        over.Children.Add(new Border { Child = card, Background = Hex("#111111"), BorderBrush = Line, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(16), Width = 380, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center });
        g.Children.Add(over);
        ((Border)btns.Children[0]).Focus();
    }

    static StackPanel Page(string h, string p)
    {
        var s = new StackPanel();
        var t = T(h, 26, Text, true); t.Margin = new Thickness(0, 4, 0, 6); s.Children.Add(t);
        if (p != null) { var d = T(p, 13.5, Muted); d.Margin = new Thickness(0, 0, 0, 14); s.Children.Add(d); }
        return s;
    }

    static StackPanel Hero(UIElement icon, string h, string p)
    {
        var s = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 0, 10) };
        var fe = icon as FrameworkElement; if (fe != null) { fe.HorizontalAlignment = HorizontalAlignment.Center; fe.Margin = new Thickness(0, 6, 0, 14); }
        s.Children.Add(icon);
        var t = T(h, 26, Text, true); t.HorizontalAlignment = HorizontalAlignment.Center; t.TextAlignment = TextAlignment.Center; s.Children.Add(t);
        var d = T(p, 13.5, Muted); d.TextAlignment = TextAlignment.Center; d.HorizontalAlignment = HorizontalAlignment.Center; d.Margin = new Thickness(0, 6, 0, 12); s.Children.Add(d);
        return s;
    }

    static Border Check()
    {
        var t = T("✓", 26, OnAccent, true); t.HorizontalAlignment = HorizontalAlignment.Center; t.VerticalAlignment = VerticalAlignment.Center;
        return new Border { Width = 56, Height = 56, CornerRadius = new CornerRadius(28), Background = Accent, Child = t };
    }

    static void Foot(StackPanel foot, params Border[] btns) { foot.Children.Clear(); foreach (var b in btns) foot.Children.Add(b); var last = btns.LastOrDefault(); if (last != null) last.Focus(); }

#if !UNINST
    static Window SetupWindow(string dArg, bool update)
    {
        ContentControl body; StackPanel foot; Border close;
        var w = Shell("Groundwork Habits setup", out body, out foot, out close);
        Busy = false;
        bool finished = false;
        Action quit = () => { if (Busy) return; if (finished || update) { w.Close(); return; } Confirm(w, "Cancel setup?", Name + " won’t be installed. You can run setup again any time.", "Cancel setup", false, () => w.Close()); };
        close.MouseLeftButtonUp += (o, e) => quit();
        string folder = dArg ?? DefaultDir();
        Opt desk = null, open = null;
        Action welcome = null, choose = null, run = null;
        Action<string> pick = null;
        Action<string> finish = null;

        welcome = () =>
        {
            body.Content = Hero(Logo(92), Name, "Habits, tasks and goals in one calm place.\nVersion " + Version + (InstalledDir() != null ? " · updates your installed copy" : ""));
            Foot(foot, Btn("Cancel", false, quit), Btn("Next", true, () => choose()));
        };
        choose = () =>
        {
            var s = Page("Where should it go?", "Your habits and settings are stored separately, so moving the app never loses them.");
            var row = new DockPanel { Margin = new Thickness(0, 0, 0, 12) };
            var box = new TextBox { Text = folder, FontFamily = Font, FontSize = 13, Foreground = Text, Background = Brushes.Transparent, BorderThickness = new Thickness(0), Padding = new Thickness(10, 0, 10, 0), CaretBrush = Accent, VerticalContentAlignment = VerticalAlignment.Center };
            var boxWrap = new Border { Child = box, Background = Card, BorderBrush = Line, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(12), Height = 38 };
            var space = T(SpaceLine(folder), 12, Muted); space.Margin = new Thickness(2, -4, 0, 10);
            box.TextChanged += (o, e) => { folder = box.Text; space.Text = SpaceLine(folder); space.Foreground = Muted; };
            var browse = Btn("Browse…", false, () => pick(folder));
            DockPanel.SetDock(browse, Dock.Right); row.Children.Add(browse); row.Children.Add(boxWrap);
            s.Children.Add(row); s.Children.Add(space);
            desk = new Opt("Desktop shortcut", null, desk == null || desk.On, false, null, null); s.Children.Add(desk.Root);
            var note = T("A Start menu shortcut is always added: Windows needs it to show the app’s notifications.", 12, Muted); s.Children.Add(note);
            body.Content = s;
            Foot(foot, Btn("Back", false, () => welcome()), Btn("Install", true, () => { var bad = BadPath(Environment.ExpandEnvironmentVariables(folder.Trim().Trim('"'))); if (bad != null) { space.Text = bad; space.Foreground = Red; return; } run(); }));
        };
        // the folder picker, inside this window and in the app's style: places on the left, the folder's subfolders on the right
        pick = start =>
        {
            string cur = start;
            while (!string.IsNullOrEmpty(cur) && !Directory.Exists(cur)) cur = Path.GetDirectoryName(cur);
            if (string.IsNullOrEmpty(cur)) cur = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            Action<string> show = null;
            show = dir =>
            {
                cur = dir;
                var s = new StackPanel();
                var h = T("Choose a folder", 22, Text, true); h.Margin = new Thickness(0, 0, 0, 10); s.Children.Add(h);
                var top = new DockPanel { Margin = new Thickness(0, 0, 0, 10) };
                string up0 = Path.GetDirectoryName(cur.TrimEnd('\\'));
                var up = Btn("↑", false, () => { if (!string.IsNullOrEmpty(up0)) show(up0); });
                up.Padding = new Thickness(0); up.Width = 38; up.Margin = new Thickness(0, 0, 8, 0); ((TextBlock)up.Child).HorizontalAlignment = HorizontalAlignment.Center;
                up.IsEnabled = !string.IsNullOrEmpty(up0);
                DockPanel.SetDock(up, Dock.Left); top.Children.Add(up);
                StackPanel list = null;
                // the path can be typed: Enter opens it if it exists; "Install here" takes a typed folder even if it doesn't exist yet
                var where = new TextBox { Text = cur, FontFamily = Font, FontSize = 12.5, Foreground = Text, Background = Brushes.Transparent, BorderThickness = new Thickness(0), Padding = new Thickness(10, 0, 10, 0), CaretBrush = Accent, VerticalContentAlignment = VerticalAlignment.Center };
                System.Windows.Automation.AutomationProperties.SetName(where, "Folder path");
                var err = T("", 12, Red); err.Margin = new Thickness(0, -4, 0, 6); err.Visibility = Visibility.Collapsed;
                where.KeyDown += (o, e) =>
                {
                    if (e.Key != Key.Enter) return; e.Handled = true;
                    string t = Environment.ExpandEnvironmentVariables(where.Text.Trim().Trim('"'));
                    try { if (Directory.Exists(t)) { show(Path.GetFullPath(t)); return; } } catch (Exception) { }
                    err.Text = "That folder doesn’t exist yet. Install here creates it."; err.Visibility = Visibility.Visible;
                };
                var newf = Btn("New folder", false, null);
                newf.Margin = new Thickness(8, 0, 0, 0);
                Action makeNew = () =>
                {
                    var nb = new TextBox { Text = "New folder", FontFamily = Font, FontSize = 13, Foreground = Text, Background = Hex("#141414"), BorderBrush = Accent, BorderThickness = new Thickness(1), Padding = new Thickness(8, 5, 8, 5), CaretBrush = Accent, Margin = new Thickness(0, 0, 0, 4) };
                    System.Windows.Automation.AutomationProperties.SetName(nb, "New folder name");
                    list.Children.Insert(0, nb); nb.Focus(); nb.SelectAll();
                    nb.KeyDown += (o, e) =>
                    {
                        if (e.Key == Key.Escape) { list.Children.Remove(nb); e.Handled = true; return; }
                        if (e.Key != Key.Enter) return; e.Handled = true;
                        string n = nb.Text.Trim();
                        if (n.Length == 0 || n.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || n.Trim('.').Length == 0) { err.Text = "A folder name can’t be empty or contain \\ / : * ? \" < > |"; err.Visibility = Visibility.Visible; return; }
                        string full = Path.Combine(cur, n);
                        try { Directory.CreateDirectory(full); show(full); }
                        catch (Exception ex) { err.Text = "Couldn’t create it: " + ex.Message; err.Visibility = Visibility.Visible; }
                    };
                };
                newf.Tag = makeNew;
                DockPanel.SetDock(newf, Dock.Right); top.Children.Add(newf);
                top.Children.Add(new Border { Child = where, Background = Card, BorderBrush = Line, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(12), Height = 38 });
                s.Children.Add(top); s.Children.Add(err);
                var grid = new Grid { Height = 180 };
                grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(150) });
                grid.ColumnDefinitions.Add(new ColumnDefinition());
                var places = new StackPanel { Margin = new Thickness(0, 0, 10, 0) };
                Action<string, string> place = (label, path) =>
                {
                    if (string.IsNullOrEmpty(path) || !Directory.Exists(path)) return;
                    bool on = string.Equals(cur.TrimEnd('\\'), path.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
                    var t = T(label, 12.5, on ? Text : Muted, on); t.TextWrapping = TextWrapping.NoWrap; t.TextTrimming = TextTrimming.CharacterEllipsis;
                    var b = new Border { Child = t, Padding = new Thickness(10, 7, 10, 7), CornerRadius = new CornerRadius(9), Cursor = Cursors.Hand, Background = on ? Hex("#1a1a1a") : Brushes.Transparent, Margin = new Thickness(0, 0, 0, 2) };
                    b.MouseEnter += (o, e) => { if (!on) b.Background = Hex("#141414"); };
                    b.MouseLeave += (o, e) => { if (!on) b.Background = Brushes.Transparent; };
                    b.MouseLeftButtonUp += (o, e) => show(path);
                    places.Children.Add(b);
                };
                place("Programs (default)", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs"));
                place("Desktop", Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
                place("Documents", Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
                foreach (var dv in DriveInfo.GetDrives().Where(x => { try { return x.IsReady && (x.DriveType == DriveType.Fixed || x.DriveType == DriveType.Removable); } catch (Exception) { return false; } }))
                    place(dv.Name.TrimEnd('\\') + "  " + (string.IsNullOrEmpty(dv.VolumeLabel) ? "Drive" : dv.VolumeLabel), dv.RootDirectory.FullName);
                grid.Children.Add(new ScrollViewer { Content = places, VerticalScrollBarVisibility = ScrollBarVisibility.Hidden, PanningMode = PanningMode.VerticalOnly }); // many drives still fit
                list = new StackPanel();
                string[] subs = new string[0];
                try { subs = new DirectoryInfo(cur).GetDirectories().Where(x => (x.Attributes & (FileAttributes.Hidden | FileAttributes.System)) == 0).Select(x => x.FullName).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToArray(); }
                catch (Exception) { }
                foreach (var sub in subs)
                {
                    var icon = new System.Windows.Shapes.Path { Data = Geometry.Parse("M0,2 C0,1.4 0.4,1 1,1 L5,1 L6.5,2.5 L13,2.5 C13.6,2.5 14,2.9 14,3.5 L14,10 C14,10.6 13.6,11 13,11 L1,11 C0.4,11 0,10.6 0,10 Z"), Fill = Hex("#5f7a3e"), Width = 16, Height = 12, Stretch = Stretch.Uniform, Margin = new Thickness(0, 0, 10, 0), VerticalAlignment = VerticalAlignment.Center };
                    var t = T(Path.GetFileName(sub), 13, Text); t.TextWrapping = TextWrapping.NoWrap; t.TextTrimming = TextTrimming.CharacterEllipsis; t.VerticalAlignment = VerticalAlignment.Center;
                    var row2 = new DockPanel(); DockPanel.SetDock(icon, Dock.Left); row2.Children.Add(icon); row2.Children.Add(t);
                    var b = new Border { Child = row2, Padding = new Thickness(10, 7, 10, 7), CornerRadius = new CornerRadius(9), Cursor = Cursors.Hand, Background = Brushes.Transparent, Margin = new Thickness(0, 0, 0, 1) };
                    string target = sub;
                    b.MouseEnter += (o, e) => b.Background = Hex("#141414");
                    b.MouseLeave += (o, e) => b.Background = Brushes.Transparent;
                    b.MouseLeftButtonUp += (o, e) => show(target);
                    list.Children.Add(b);
                }
                if (subs.Length == 0) { var none = T("No folders in here. Install here, or go up.", 12.5, Muted); none.Margin = new Thickness(10, 8, 0, 0); list.Children.Add(none); }
                var scroll = new ScrollViewer { Content = list, VerticalScrollBarVisibility = ScrollBarVisibility.Hidden, PanningMode = PanningMode.VerticalOnly };
                var listCard = new Border { Child = scroll, Background = Card, BorderBrush = Line, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(14), Padding = new Thickness(6) };
                Grid.SetColumn(listCard, 1); grid.Children.Add(listCard);
                s.Children.Add(grid);
                body.Content = s;
                Foot(foot, Btn("Cancel", false, () => choose()), Btn("Install here", true, () =>
                {
                    string t = Environment.ExpandEnvironmentVariables(where.Text.Trim().Trim('"'));
                    string bad = BadPath(t); if (bad != null) { err.Text = bad; err.Visibility = Visibility.Visible; return; }
                    folder = Target(Path.GetFullPath(t)); choose();
                }));
            };
            show(cur);
        };
        run = () =>
        {
            Busy = true;
            var s = Page("Installing…", "Closing the running app (it saves first), then copying files.");
            var bar = new Bar(); s.Children.Add(bar.Root);
            var line = T("", 12.5, Muted); s.Children.Add(line);
            body.Content = s;
            var cancel = Btn("Cancel", false, () => { }); cancel.IsEnabled = false; Foot(foot, cancel);
            string target = folder; bool d = desk == null || desk.On;
            Task.Factory.StartNew(() =>
            {
                bool ok = Install(target, d, true, (p, msg) => w.Dispatcher.Invoke(new Action(() => { if (p >= 0) bar.Set(p); line.Text = msg; })));
                w.Dispatcher.Invoke(new Action(() => { Busy = false; if (ok) finish(Target(target)); else { line.Foreground = Red; Foot(foot, Btn("Back", false, () => choose()), Btn("Close", true, () => w.Close())); } }));
            });
        };
        finish = dir =>
        {
            finished = true;
            if (update) { Launch(dir); w.Close(); return; }
            var s = Hero(Check(), "All set", Name + " is installed.");
            open = new Opt("Open Groundwork Habits now", null, true, false, null, null); open.Root.Width = 420; s.Children.Add(open.Root);
            body.Content = s;
            Foot(foot, Btn("Finish", true, () => { if (open.On) Launch(dir); w.Close(); }));
        };
        w.Loaded += (o, e) =>
        {
            if (ShotDir == null) { if (update) run(); else welcome(); return; }
            welcome(); Snap(w, "setup-1-welcome"); quit(); Snap(w, "setup-1b-cancel"); ((Grid)((Border)w.Content).Child).Children.RemoveAt(((Grid)((Border)w.Content).Child).Children.Count - 1); choose(); Snap(w, "setup-2-folder"); pick(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs")); Snap(w, "setup-2b-browse"); choose();
            var s = Page("Installing…", "Closing the running app (it saves first), then copying files.");
            var bar = new Bar(); s.Children.Add(bar.Root); s.Children.Add(T("Copying files… 64%", 12.5, Muted)); body.Content = s;
            var c = Btn("Cancel", false, () => { }); c.IsEnabled = false; Foot(foot, c); bar.Now(64); Snap(w, "setup-3-progress");
            update = false; finish(folder); Snap(w, "setup-4-done"); w.Close();
        };
        return w;
    }

    static void Launch(string dir)
    {
        try { Process.Start(new ProcessStartInfo(Path.Combine(dir, Exe)) { WorkingDirectory = dir, UseShellExecute = true }); } catch (Exception e) { Log("launch failed: " + e.Message); }
    }
#else
    static Window UninstallWindow(string dir)
    {
        ContentControl body; StackPanel foot; Border close;
        var w = Shell("Uninstall Groundwork Habits", out body, out foot, out close);
        Busy = false;
        close.MouseLeftButtonUp += (o, e) => { if (!Busy) w.Close(); };
        Opt keep = null, erase = null;
        Action ask = () =>
        {
            var s = Page("Remove Groundwork Habits", "What should happen to your data?");
            keep = new Opt("Keep my data", "Habits, tasks, goals and settings stay on this PC, ready if you install again.", true, true, null, () => erase.Set(false));
            erase = new Opt("Erase everything", "Also deletes habits, tasks, goals, settings and automatic backups. This can’t be undone.", false, true, Red, () => keep.Set(false));
            s.Children.Add(keep.Root); s.Children.Add(erase.Root);
            s.Children.Add(T("A data folder you chose yourself (for example in Google Drive) is never touched.", 12, Muted));
            body.Content = s;
            Foot(foot, Btn("Cancel", false, () => w.Close()), Btn("Uninstall", true, () =>
            {
                Busy = true; bool wipe = erase.On;
                var p = Page("Removing…", wipe ? "Closing the app, then removing it and erasing your data." : "Closing the app, then removing its files and shortcuts.");
                var bar = new Bar(); p.Children.Add(bar.Root);
                var line = T("", 12.5, Muted); p.Children.Add(line);
                body.Content = p;
                var c = Btn("Cancel", false, () => { }); c.IsEnabled = false; Foot(foot, c);
                Task.Factory.StartNew(() =>
                {
                    int rc = Uninstall(dir, wipe, (pc, msg) => w.Dispatcher.Invoke(new Action(() => { if (pc >= 0) bar.Set(pc); line.Text = msg; })));
                    w.Dispatcher.Invoke(new Action(() =>
                    {
                        Busy = false;
                        if (rc != 0) { line.Foreground = Red; Foot(foot, Btn("Close", true, () => w.Close())); return; }
                        body.Content = Hero(Check(), "Removed", wipe ? Name + " and your data are gone." : Name + " is removed. Your data is kept for next time.");
                        Foot(foot, Btn("Close", true, () => w.Close()));
                    }));
                });
            }));
        };
        w.Loaded += (o, e) =>
        {
            ask(); if (ShotDir == null) return;
            Snap(w, "uninstall-1-choice"); erase.Set(true); keep.Set(false); Snap(w, "uninstall-2-erase");
            var p = Page("Removing…", "Closing the app, then removing its files and shortcuts.");
            var bar = new Bar(); p.Children.Add(bar.Root); p.Children.Add(T("Removing files… 82%", 12.5, Muted)); body.Content = p;
            var c = Btn("Cancel", false, () => { }); c.IsEnabled = false; Foot(foot, c); bar.Now(82); Snap(w, "uninstall-3-progress");
            body.Content = Hero(Check(), "Removed", Name + " is removed. Your data is kept for next time."); Foot(foot, Btn("Close", true, () => w.Close())); Snap(w, "uninstall-4-done");
            w.Close();
        };
        return w;
    }
#endif
}
