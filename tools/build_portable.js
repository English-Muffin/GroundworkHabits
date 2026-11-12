// Builds the Windows portable exe: zips dist/win-unpacked (made by `electron-builder --win nsis`) and compiles
// tools/portable/Launcher.cs around it with the C# compiler that ships with Windows (.NET Framework 4.x).
// Output: dist/Groundwork-Habits-<version>-Windows-portable.exe
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist'), src = path.join(dist, 'win-unpacked');
const pkg = require(path.join(root, 'package.json')), version = pkg.version, product = pkg.build.productName, lite = /Lite$/.test(product), file = product.replace(/ /g, '-');
const net = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const csc = path.join(net, 'csc.exe');
if (!fs.existsSync(path.join(src, product + '.exe'))) throw new Error('Build the app first: dist/win-unpacked is missing');
if (!fs.existsSync(csc)) throw new Error('C# compiler not found at ' + csc);

const work = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gh-portable-'));
const zip = path.join(work, 'app.zip'), ver = path.join(work, 'version.txt'), logo = path.join(work, 'logo.png');
fs.copyFileSync(path.join(root, 'www', 'icons', 'icon-512.png'), logo);
// fastest compression level: the zip is unpacked once per version, and fast keeps the first start short
execFileSync('powershell', ['-NoProfile', '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${src}', '${zip}', [IO.Compression.CompressionLevel]::Fastest, $false)`], { stdio: 'inherit' });
// the launcher unpacks into %TEMP%\<name>-<this>: the app's hash makes every build unpack fresh, even at the same version
// (a test build used to start the copy left by an earlier build of that version)
fs.writeFileSync(ver, version + '-' + require('crypto').createHash('sha256').update(fs.readFileSync(path.join(src, 'resources', 'app.asar'))).digest('hex').slice(0, 8));

const out = path.join(dist, `${file}-${version}-Windows-portable.exe`);
const wpf = path.join(net, 'WPF');
execFileSync(csc, [...(lite ? ['/define:LITE'] : []), '/nologo', '/target:winexe', '/optimize+', '/platform:x64', `/out:${out}`,
  `/win32icon:${path.join(root, 'assets', 'icon.ico')}`,
  `/reference:${path.join(wpf, 'PresentationFramework.dll')}`, `/reference:${path.join(wpf, 'PresentationCore.dll')}`,
  `/reference:${path.join(wpf, 'WindowsBase.dll')}`, `/reference:${path.join(net, 'System.Xaml.dll')}`,
  `/reference:${path.join(net, 'System.IO.Compression.dll')}`, `/reference:${path.join(net, 'System.IO.Compression.FileSystem.dll')}`,
  `/resource:${zip},app.zip`, `/resource:${ver},version.txt`, `/resource:${logo},logo.png`,
  path.join(__dirname, 'portable', 'Launcher.cs')], { stdio: 'inherit' });
fs.rmSync(work, { recursive: true, force: true });
console.log('Portable exe: ' + out + ' (' + (fs.statSync(out).size / 1e6).toFixed(1) + ' MB)');
