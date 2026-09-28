<#
    Prepares the store catalogue imagery from the source photos in web/src/assets/oxidised.

    What it does (and deliberately does NOT do):
      * decodes JPEG, PNG and WebP (WIC handles all three; several .png files in the
        oxidised set are actually WebP bytes and decode fine)
      * crops to the aspect ratios the storefront actually renders (4:5 cards, 16:9
        collection tiles, 16:6 banners) and resizes down for the web
      * re-encodes as progressive-free JPEG at quality 86
      * does NOT change any colour - the photographs are used as supplied

    Output goes to server/uploads/catalog, which the API already serves at /uploads.
    A manifest.json is written alongside so the seed script knows what is available.

    Usage:
      powershell -File tools/prepare-catalog-images.ps1
      powershell -File tools/prepare-catalog-images.ps1 -OnlySafe
#>
[CmdletBinding()]
param(
  [string]$SourceDir,
  [string]$OutDir,
  [int]$Quality = 86
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is not populated while param() defaults are evaluated on PS 5.1,
# so the paths are resolved here instead.
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $SourceDir) { $SourceDir = Join-Path $scriptRoot '..\web\src\assets\oxidised' }
if (-not $OutDir)    { $OutDir    = Join-Path $scriptRoot '..\server\uploads\catalog' }

$csharp = @'
using System;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;

public static class OxImagePrep
{
    public static string Render(string src, string dst, double zoom, double fx, double fy,
                                double aspect, int outW, int outH, int quality)
    {
        BitmapFrame frame;
        using (var fs = File.OpenRead(src))
        {
            var dec = BitmapDecoder.Create(fs, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
            frame = dec.Frames[0];
        }

        int W = frame.PixelWidth, H = frame.PixelHeight;

        // Largest rect of the target aspect that fits the source, then zoom in.
        double cw, ch;
        if ((double)W / H > aspect) { ch = H; cw = H * aspect; }
        else { cw = W; ch = W / aspect; }
        cw /= zoom; ch /= zoom;
        if (cw > W) { cw = W; ch = cw / aspect; }
        if (ch > H) { ch = H; cw = ch * aspect; }

        double x = fx * W - cw / 2.0;
        double y = fy * H - ch / 2.0;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x + cw > W) x = W - cw;
        if (y + ch > H) y = H - ch;

        var rect = new System.Windows.Int32Rect(
            (int)Math.Round(x), (int)Math.Round(y),
            (int)Math.Round(cw), (int)Math.Round(ch));
        var cropped = new CroppedBitmap(frame, rect);

        double scaleX = (double)outW / cropped.PixelWidth;
        double scaleY = (double)outH / cropped.PixelHeight;
        var scaled = new TransformedBitmap(cropped, new ScaleTransform(scaleX, scaleY));

        var encoder = new JpegBitmapEncoder();
        encoder.QualityLevel = quality;
        encoder.Frames.Add(BitmapFrame.Create(scaled));

        string dir = Path.GetDirectoryName(dst);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) Directory.CreateDirectory(dir);

        using (var outStream = File.Create(dst)) encoder.Save(outStream);

        return W + "x" + H + " -> " + outW + "x" + outH;
    }
}
'@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies 'PresentationCore','WindowsBase','System.Xaml'

if (-not (Test-Path $SourceDir)) { throw "Source directory not found: $SourceDir" }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# Source photos, keyed by the letter used in output filenames.
# Path is resolved by wildcard so the messy original names do not have to be typed exactly.
$sources = [ordered]@{
  a = '2_1856a5ec*.png'                                   # oxidised necklace + earring set on magenta
  b = '86C58131*.png'                                     # oxidised bib necklace + jhumkas on black
  c = '8c4c8dcf*.png'                                     # flat lay: sun pendant, earrings, cuff
  d = 'be09164VM1447_1.png'                               # model, small round oxidised pendant
  e = 'd079cf961061f10eb3cba6477e0ce259.jpg'              # choker + jhumkas + ring on wood
  f = 'D1CCD6E0*.png'                                     # oxidised bib necklace on mannequin
  g = 'earings.png'                                       # pearl jhumka earrings on cloth
  h = 'how-to-style-oxidised-jewellery-indian-outfits-TheJewelbox-7.png'  # model, long pendant
  i = 'images.jpg'                                        # oxidised kada worn on the wrist
  j = 'IMG-20250822_204602_329.jpg'                       # flat lay: peacock pendant, earrings, ring
  k = 'ishhaara-diamond-shaped-kundan-studded-oxidised-long-necklace*.png'  # pendant + earrings
  l = 'MBNS00952_1.jpg'                                   # medallion necklace + earrings on shell
  m = 'new-23.png'                                        # oxidised jhumkas with red stone
  n = 'rubans-silver-plated-beaded-studded-oxidized-jewellery-set-necklace-set*.png'  # model, choker
}

$resolved = @{}
foreach ($key in $sources.Keys) {
  $pattern = $sources[$key]
  $match = Get-ChildItem -Path $SourceDir -Filter $pattern -File -ErrorAction SilentlyContinue |
           Select-Object -First 1
  if (-not $match) {
    Write-Warning "source '$key' ($pattern) not found - skipping"
    continue
  }
  $resolved[$key] = $match.FullName
}

Write-Host "Sources resolved: $($resolved.Count) of $($sources.Count)" -ForegroundColor Cyan

# Three framings per source so product galleries show one item from several angles
# instead of three unrelated photographs.
$zooms = @(
  @{ suffix = '1'; zoom = 1.00; fx = 0.50; fy = 0.50 },
  @{ suffix = '2'; zoom = 1.55; fx = 0.50; fy = 0.42 },
  @{ suffix = '3'; zoom = 2.20; fx = 0.52; fy = 0.55 }
)

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  version     = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
  recoloured  = $false
  note        = 'Photographs used as supplied. Only cropped, resized and re-encoded.'
  sources     = @{}
  product     = @{}
  category    = @()
  collection  = @()
  banner      = @()
}

foreach ($key in $resolved.Keys) {
  $manifest.sources[$key] = Split-Path $resolved[$key] -Leaf
}

# --- product pool: key<1|2|3>.jpg at 4:5 -----------------------------------
foreach ($key in $resolved.Keys) {
  foreach ($z in $zooms) {
    $name = "$key$($z.suffix).jpg"
    $info = [OxImagePrep]::Render($resolved[$key], (Join-Path $OutDir $name),
                                  $z.zoom, $z.fx, $z.fy, 0.8, 1200, 1500, $Quality)
    $manifest.product[$name] = $info
    Write-Host ("  product  {0,-8} {1}" -f $name, $info)
  }
}

# --- category tiles: cat-<key>.jpg at 4:5 ----------------------------------
foreach ($key in $resolved.Keys) {
  $name = "cat-$key.jpg"
  $info = [OxImagePrep]::Render($resolved[$key], (Join-Path $OutDir $name),
                                1.0, 0.5, 0.45, 0.8, 600, 750, $Quality)
  $manifest.category += $name
  Write-Host ("  category {0,-8} {1}" -f $name, $info)
}

# --- collection tiles at 16:9 ---------------------------------------------
$collectionPlan = @(
  @{ key = 'h'; zoom = 1.12; fy = 0.42 },   # model, long oxidised pendant
  @{ key = 'c'; zoom = 1.10; fy = 0.50 },   # flat lay, sun pendant + cuff
  @{ key = 'b'; zoom = 1.18; fy = 0.45 },   # oxidised bib necklace on black
  @{ key = 'l'; zoom = 1.10; fy = 0.50 }    # medallion necklace on shell
)
$index = 0
foreach ($plan in $collectionPlan) {
  if (-not $resolved.ContainsKey($plan.key)) { continue }
  $index++
  $name = "col-$index.jpg"
  $info = [OxImagePrep]::Render($resolved[$plan.key], (Join-Path $OutDir $name),
                                $plan.zoom, 0.5, $plan.fy, 1.7778, 1600, 900, $Quality)
  $manifest.collection += $name
  Write-Host ("  collectn {0,-8} {1}" -f $name, $info)
}

# --- banner pool at 16:6 --------------------------------------------------
$bannerPlan = @(
  @{ key = 'c'; zoom = 1.25; fy = 0.45 },   # flat lay, pendant + earrings
  @{ key = 'h'; zoom = 1.25; fy = 0.40 },   # model in saree, long pendant
  @{ key = 'l'; zoom = 1.20; fy = 0.50 }    # medallion necklace + marigolds
)
$index = 0
foreach ($plan in $bannerPlan) {
  if (-not $resolved.ContainsKey($plan.key)) { continue }
  $index++
  $name = "hero-$index.jpg"
  $info = [OxImagePrep]::Render($resolved[$plan.key], (Join-Path $OutDir $name),
                                $plan.zoom, 0.5, $plan.fy, 2.6667, 1920, 720, $Quality)
  $manifest.banner += $name
  Write-Host ("  banner   {0,-8} {1}" -f $name, $info)
}

$manifestPath = Join-Path $OutDir 'manifest.json'
# Write UTF-8 *without* a BOM: Node's JSON.parse throws on a leading BOM.
$json = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$sizes = Get-ChildItem $OutDir -File | Measure-Object Length -Sum
Write-Host ""
Write-Host ("Done. {0} files, {1} MB total -> {2}" -f `
  $sizes.Count, [math]::Round($sizes.Sum/1MB,2), $OutDir) -ForegroundColor Green
Write-Host ("Manifest: {0}" -f $manifestPath)
