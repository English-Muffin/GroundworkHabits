// Portable launcher for the Windows build (compiled by tools/build_portable.js with the C# compiler that ships with Windows).
// It carries the app as an embedded zip. The first start unpacks it to %TEMP%\GroundworkHabits-<version> while only the logo
// shows, pulsing, with no window around it; later starts reuse that folder and open in under a second. Older versions' folders
// are removed. C# 5 on purpose: that is what the built-in compiler understands.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;

[assembly: AssemblyTitle("Groundwork Habits")]
[assembly: AssemblyProduct("Groundwork Habits")]

static class Launcher
{
    const string Exe = "Groundwork Habits.exe";

    [STAThread]
    static int Main(string[] args)
    {
        var asm = Assembly.GetExecutingAssembly();
        string version = asm.GetManifestResourceNames().Contains("version.txt") ? Read(asm, "version.txt").Trim() : "0";
        string root = Path.GetTempPath();
        string dir = Path.Combine(root, "GroundworkHabits-" + version);
        string done = Path.Combine(dir, ".complete");
        string cmd = string.Join(" ", args.Select(a => "\"" + a.Replace("\"", "\\\"") + "\""));

        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        Window splash = Splash(asm);
        splash.Show();
        Task.Factory.StartNew(() =>
        {
            try
            {
                if (!File.Exists(done))
                {
                    if (Directory.Exists(dir)) Directory.Delete(dir, true);
                    using (var z = new ZipArchive(asm.GetManifestResourceStream("app.zip"), ZipArchiveMode.Read))
                        z.ExtractToDirectory(dir);
                    File.WriteAllText(done, version);
                }
                foreach (var old in Directory.GetDirectories(root, "GroundworkHabits-*").Where(d => !string.Equals(d, dir, StringComparison.OrdinalIgnoreCase)))
                    try { Directory.Delete(old, true); } catch (Exception) { }
                var p = Process.Start(new ProcessStartInfo(Path.Combine(dir, Exe), cmd) { UseShellExecute = false, WorkingDirectory = dir });
                // keep the logo until the app's window is up (or 20 s), so there is never a moment with nothing on screen
                for (int i = 0; i < 200 && !p.HasExited; i++) { p.Refresh(); if (p.MainWindowHandle != IntPtr.Zero || AnyWindow(p.Id)) break; Thread.Sleep(100); }
            }
            catch (Exception e)
            {
                try { File.WriteAllText(Path.Combine(root, "GroundworkHabits-launcher.log"), DateTime.Now + " " + e); } catch (Exception) { }
                app.Dispatcher.Invoke(new Action(() => MessageBox.Show("Groundwork Habits could not start:\n" + e.Message, "Groundwork Habits", MessageBoxButton.OK, MessageBoxImage.Error)));
            }
            app.Dispatcher.Invoke(new Action(() => app.Shutdown()));
        });
        app.DispatcherUnhandledException += (o, e) => { try { File.WriteAllText(Path.Combine(root, "GroundworkHabits-launcher.log"), DateTime.Now + " " + e.Exception); } catch (Exception) { } };
        app.Run();
        return 0;
    }

    // Electron's window belongs to a child process of the one we started, so look at children too
    static bool AnyWindow(int parent)
    {
        try
        {
            foreach (var q in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Exe)))
                if (q.MainWindowHandle != IntPtr.Zero) return true;
        }
        catch (Exception) { }
        return false;
    }

    static string Read(Assembly asm, string name)
    {
        using (var r = new StreamReader(asm.GetManifestResourceStream(name))) return r.ReadToEnd();
    }

    static Window Splash(Assembly asm)
    {
        var bmp = new BitmapImage();
        bmp.BeginInit(); bmp.StreamSource = asm.GetManifestResourceStream("logo.png"); bmp.CacheOption = BitmapCacheOption.OnLoad; bmp.EndInit();
        var scale = new ScaleTransform(1, 1, 80, 80);
        var img = new Image { Source = bmp, Width = 160, Height = 160, RenderTransform = scale };
        RenderOptions.SetBitmapScalingMode(img, BitmapScalingMode.HighQuality);
        var w = new Window
        {
            WindowStyle = WindowStyle.None, AllowsTransparency = true, Background = Brushes.Transparent, Topmost = true,
            ShowInTaskbar = true, Title = "Groundwork Habits", Width = 200, Height = 200, ResizeMode = ResizeMode.NoResize,
            WindowStartupLocation = WindowStartupLocation.CenterScreen, Content = new Grid { Children = { img } }
        };
        // a slow, smooth pulse: fade and breathe together, eased both ways
        var ease = new SineEase { EasingMode = EasingMode.EaseInOut };
        var t = TimeSpan.FromSeconds(1.4);
        img.BeginAnimation(UIElement.OpacityProperty, new DoubleAnimation(1, 0.45, t) { AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever, EasingFunction = ease });
        var grow = new DoubleAnimation(1, 0.92, t) { AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever, EasingFunction = ease };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, grow);
        scale.BeginAnimation(ScaleTransform.ScaleYProperty, grow);
        return w;
    }
}
