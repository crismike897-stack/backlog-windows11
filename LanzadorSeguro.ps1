param([switch]$manual)

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, "Global\BacklogScreensaverMutex", [ref]$createdNew)
if (-not $createdNew) { exit }

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class InputMonitor {
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("user32.dll")] public static extern int ShowCursor(bool bShow);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    public static uint GetLastInputTick() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
        GetLastInputInfo(ref lii);
        return lii.dwTime;
    }
}
"@

    if (-not $manual) {
        $req = powercfg /requests | Out-String
        if ($req -match "(?s)DISPLAY:\s*(.*?)\s*SYSTEM:") {
            $dispVal = $Matches.Item(1).Trim()
            if ($dispVal -ne "" -and $dispVal -notmatch "^(None|Ninguno|Ninguna)\.?$") { return }
        }
    }

    $baseDir = $PSScriptRoot
    if (-not (Test-Path "$baseDir\index.html")) { return }

    # Mantenimiento silencioso diario (1 vez cada 24 horas en prioridad baja)
    $stampFile = Join-Path $env:LOCALAPPDATA "BacklogScreensaver_LastMaint.txt"
    $runMaint = $true
    if (Test-Path $stampFile) {
        try {
            $lastDate = [DateTime]::Parse((Get-Content $stampFile -Raw).Trim())
            if (((Get-Date) - $lastDate).TotalHours -lt 24) { $runMaint = $false }
        } catch {}
    }

    if ($runMaint) {
        Start-Job -ScriptBlock {
            param($dir, $stFile)
            [System.Threading.Thread]::CurrentThread.Priority = "BelowNormal"
            Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue
            try {
                $libPath = "$dir\library\library.js"
                $vdfFile = Get-ChildItem -Path "C:\Program Files (x86)\Steam\userdata" -Filter "localconfig.vdf" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
                if ((Test-Path $libPath) -and $vdfFile) {
                    $raw = Get-Content $libPath -Raw -Encoding UTF8
                    $jsonStr = ($raw -replace '^[\s\S]*?window\.BACKLOG_LIBRARY\s*=\s*', '') -replace ';\s*$', ''
                    $libObj = $jsonStr | ConvertFrom-Json
                    $vdfText = Get-Content $vdfFile.FullName -Raw -Encoding UTF8
                    $changed = $false
                    foreach ($g in $libObj.games) {
                        $id = [string]$g.appid
                        if ($vdfText -match ('"' + $id + '"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}')) {
                            $blk = $Matches.Item(1)
                            if ($blk -match '"Playtime"\s*"(\d+)"') { $pt = [int]$Matches.Item(1); if ($pt -gt 0 -and $pt -ne $g.playtime) { $g.playtime = $pt; $changed = $true } }
                            if ($blk -match '"LastPlayed"\s*"(\d+)"') { $lp = [long]$Matches.Item(1); if ($lp -gt 0 -and $lp -ne $g.lastPlayed) { $g.lastPlayed = $lp; $changed = $true } }
                        }
                    }
                    if ($changed) { Set-Content -Path $libPath -Value ("/* Auto-synced */`r`nwindow.BACKLOG_LIBRARY = " + ($libObj | ConvertTo-Json -Depth 10 -Compress) + ";") -Encoding UTF8 }
                }
                $cutoff = (Get-Date).AddDays(-7)
                Get-ChildItem -Path $env:TEMP -Force -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
                Set-Content -Path $stFile -Value (Get-Date).ToString("o") -Encoding ASCII
            } catch {}
        } -ArgumentList $baseDir, $stampFile | Out-Null
    }
    $listener = New-Object System.Net.HttpListener
    $port = Get-Random -Minimum 49152 -Maximum 65000
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()

    $job = {
        param($l, $dir)
        while ($l.IsListening) {
            try {
                $ctx = $l.GetContext()
                $rel = $ctx.Request.Url.AbsolutePath.TrimStart('/')
                if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
                $fp = Join-Path $dir ($rel -replace '/', '\')
                if (Test-Path $fp) {
                    $bytes = [System.IO.File]::ReadAllBytes($fp)
                    $ext = [System.IO.Path]::GetExtension($fp).ToLower()
                    $ctx.Response.ContentType = switch ($ext) { ".html" { "text/html; charset=utf-8" } ".js" { "application/javascript; charset=utf-8" } ".css" { "text/css; charset=utf-8" } ".png" { "image/png" } ".svg" { "image/svg+xml" } default { "image/jpeg" } }
                    $ctx.Response.AddHeader("Cache-Control", "public, max-age=86400")
                    $ctx.Response.ContentLength64 = $bytes.Length
                    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
                } else { $ctx.Response.StatusCode = 404 }
                $ctx.Response.OutputStream.Close()
            } catch {}
        }
    }
    $ps = [powershell]::Create().AddScript($job).AddArgument($listener).AddArgument($baseDir)
    $handle = $ps.BeginInvoke()

    $allScreens = @([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Width -gt 0 -and $_.Bounds.Height -gt 0 })
    $mainMonitor = $null; $laptopScreen = $null
    if ($allScreens.Count -gt 1) {
        $ext = $allScreens | Where-Object { $_.DeviceName -notlike "*DISPLAY1" } | Select-Object -First 1
        if (-not $ext) { $ext = $allScreens | Where-Object { -not $_.Primary } | Select-Object -First 1 }
        if (-not $ext) { $ext = $allScreens.GetValue(0) }
        $mainMonitor = $ext
        $laptopScreen = $allScreens | Where-Object { $_.DeviceName -ne $mainMonitor.DeviceName } | Select-Object -First 1
    } else { $mainMonitor = $allScreens.GetValue(0) }

    $blackForm = $null
    if ($allScreens.Count -gt 1 -and $laptopScreen) {
        $blackForm = New-Object System.Windows.Forms.Form
        $blackForm.FormBorderStyle = 'None'; $blackForm.BackColor = [System.Drawing.Color]::Black; $blackForm.StartPosition = 'Manual'
        $blackForm.Location = New-Object System.Drawing.Point($laptopScreen.Bounds.X, $laptopScreen.Bounds.Y)
        $blackForm.Size = New-Object System.Drawing.Size($laptopScreen.Bounds.Width, $laptopScreen.Bounds.Height)
        $blackForm.TopMost = $true; $blackForm.ShowInTaskbar = $false
    }

    $profMain = Join-Path $env:LOCALAPPDATA "BacklogScreensaverEdge"
    $commonFlags = "--new-window --start-fullscreen --disable-extensions --no-first-run --disable-sync --no-service-autorun --no-default-browser-check --disable-infobars --disable-translate --hide-crash-restore-bubble --enable-gpu-rasterization --ignore-gpu-blocklist --disable-background-networking --disable-component-update"
    $argsMain = "--app=http://127.0.0.1:$port/index.html --user-data-dir=`"$profMain`" $commonFlags --window-position=$($mainMonitor.Bounds.X),$($mainMonitor.Bounds.Y) --window-size=$($mainMonitor.Bounds.Width),$($mainMonitor.Bounds.Height)"
    Start-Process "msedge.exe" -ArgumentList $argsMain

    $hwndMain = [IntPtr]::Zero
    for ($w = 0; $w -lt 40; $w++) {
        $hwndMain = [InputMonitor]::FindWindow("Chrome_WidgetWin_1", "Backlog")
        if ($hwndMain -eq [IntPtr]::Zero) { $hwndMain = [InputMonitor]::FindWindow($null, "Backlog") }
        if ($hwndMain -ne [IntPtr]::Zero -and [InputMonitor]::IsWindowVisible($hwndMain)) { break }
        Start-Sleep -Milliseconds 50
    }

    if ($blackForm) { $blackForm.Show(); [System.Windows.Forms.Application]::DoEvents() }
    [InputMonitor]::ShowCursor($false) | Out-Null
    Start-Sleep -Milliseconds 700

    $initialTick = [InputMonitor]::GetLastInputTick()
    while ($true) {
        if ($blackForm) {
            $activeNow = @([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.Bounds.Width -gt 0 -and $_.Bounds.Height -gt 0 })
            if ($activeNow.Count -le 1) { $blackForm.Hide(); $blackForm.Close(); $blackForm.Dispose(); $blackForm = $null }
            else { [System.Windows.Forms.Application]::DoEvents() }
        }
        if ($hwndMain -ne [IntPtr]::Zero -and -not [InputMonitor]::IsWindow($hwndMain)) { break }
        if ([InputMonitor]::GetLastInputTick() -ne $initialTick) { break }
        Start-Sleep -Milliseconds 30
    }

    [InputMonitor]::ShowCursor($true) | Out-Null
    if ($blackForm) { $blackForm.Hide(); $blackForm.Close(); $blackForm.Dispose() }
    if ($hwndMain -ne [IntPtr]::Zero) { [InputMonitor]::ShowWindow($hwndMain, 0) | Out-Null; [InputMonitor]::SendMessage($hwndMain, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null }

    Get-CimInstance Win32_Process -Filter "Name='msedge.exe' AND CommandLine LIKE '%BacklogScreensaverEdge%'" -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $listener.Stop(); $ps.Dispose()
} finally {
    $mutex.ReleaseMutex(); $mutex.Dispose()
}

