// Builds the Windows installer in the app's own look: compiles tools/portable/Setup.cs twice with the C# compiler that ships
// with Windows (.NET Framework 4.x): the uninstaller first, then the setup that carries it and the zipped app
// (dist/win-unpacked, made by `electron-builder --win dir`). Output: dist/Groundwork-Habits-<version>-Windows-setup.exe
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist'), src = process.env.APP_DIR || path.join(dist, 'win-unpacked') /* APP_DIR: the Tauri Lite build (build_lite_win.js) */, dir = path.join(__dirname, 'portable');
const pkg = require(path.join(root, 'package.json')), version = pkg.version, product = pkg.build.productName, lite = /Lite$/.test(product), file = product.replace(/ /g, '-');
const net = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319'), wpf = path.join(net, 'WPF');
const csc = path.join(net, 'csc.exe');
if (!fs.existsSync(path.join(src, product + '.exe'))) throw new Error('Build the app first: dist/win-unpacked is missing');
if (!fs.existsSync(csc)) throw new Error('C# compiler not found at ' + csc);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-setup-'));
const zip = path.join(work, 'app.zip'), ver = path.join(work, 'version.txt'), uninst = path.join(work, 'uninstaller.exe');
fs.writeFileSync(ver, version);
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${src}', '${zip}', [IO.Compression.CompressionLevel]::Optimal, $false)`], { stdio: 'inherit' });

const refs = ['PresentationFramework.dll', 'PresentationCore.dll', 'WindowsBase.dll'].map(f => '/reference:' + path.join(wpf, f))
  .concat(['System.Xaml.dll', 'System.IO.Compression.dll', 'System.IO.Compression.FileSystem.dll', 'System.Windows.Forms.dll'].map(f => '/reference:' + path.join(net, f)));
const common = ['/nologo', '/target:winexe', '/optimize+', '/platform:x64', `/win32icon:${path.join(root, 'assets', 'icon.ico')}`, ...refs,
  `/resource:${path.join(root, 'www', 'icons', 'icon-512.png')},logo.png`, `/resource:${ver},version.txt`,
  `/resource:${path.join(dir, 'SpaceGrotesk-Regular.ttf')},SpaceGrotesk-Regular.ttf`, `/resource:${path.join(dir, 'SpaceGrotesk-Bold.ttf')},SpaceGrotesk-Bold.ttf`];
const cs = path.join(dir, 'Setup.cs');
execFileSync(csc, [...common, ...(lite ? ['/define:LITE'] : []), '/define:UNINST', `/out:${uninst}`, cs], { stdio: 'inherit' });
const out = path.join(dist, `${file}-${version}-Windows-setup.exe`);
execFileSync(csc, [...common, ...(lite ? ['/define:LITE'] : []), `/out:${out}`, `/resource:${zip},app.zip`, `/resource:${uninst},uninstaller.exe`, cs], { stdio: 'inherit' });
fs.rmSync(work, { recursive: true, force: true });
console.log('Installer: ' + out + ' (' + (fs.statSync(out).size / 1e6).toFixed(1) + ' MB)');
