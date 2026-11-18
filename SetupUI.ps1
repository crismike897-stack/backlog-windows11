Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Backlog Screensaver — Instalador Windows 11"
$form.Size = New-Object System.Drawing.Size(540, 410)
$form.StartPosition = "CenterScreen"; $form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(14, 16, 20); $form.ForeColor = [System.Drawing.Color]::FromArgb(240, 242, 246)

$header = New-Object System.Windows.Forms.Panel
$header.Size = New-Object System.Drawing.Size(540, 72); $header.Location = New-Object System.Drawing.Point(0, 0)
$header.BackColor = [System.Drawing.Color]::FromArgb(22, 26, 33); $form.Controls.Add($header)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "BACKLOG SCREENSAVER"; $lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$lblTitle.Location = New-Object System.Drawing.Point(24, 14); $lblTitle.Size = New-Object System.Drawing.Size(480, 28); $header.Controls.Add($lblTitle)

$lblSub = New-Object System.Windows.Forms.Label
$lblSub.Text = "Windows 11 Desktop Edition • Multimonitor • Detección inteligente de video"
$lblSub.Font = New-Object System.Drawing.Font("Segoe UI", 8.5); $lblSub.ForeColor = [System.Drawing.Color]::FromArgb(140, 175, 230)
$lblSub.Location = New-Object System.Drawing.Point(26, 44); $lblSub.Size = New-Object System.Drawing.Size(480, 18); $header.Controls.Add($lblSub)

$lblClock = New-Object System.Windows.Forms.Label
$lblClock.Text = "Estilo de reloj en pantalla:"; $lblClock.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$lblClock.Location = New-Object System.Drawing.Point(26, 88); $lblClock.Size = New-Object System.Drawing.Size(200, 22); $form.Controls.Add($lblClock)

$cmbClock = New-Object System.Windows.Forms.ComboBox
$cmbClock.DropDownStyle = "DropDownList"; $cmbClock.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$cmbClock.BackColor = [System.Drawing.Color]::FromArgb(28, 32, 40); $cmbClock.ForeColor = [System.Drawing.Color]::White
$cmbClock.Location = New-Object System.Drawing.Point(230, 85); $cmbClock.Size = New-Object System.Drawing.Size(270, 26)
[void]$cmbClock.Items.AddRange(@("label (Museo Minimalista)", "segment (Digital 7-Segmentos)", "thin (Números Grandes Delgados)", "caption (Tarjeta Editorial)"))
$cmbClock.SelectedIndex = 0; $form.Controls.Add($cmbClock)

$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true; $txtLog.ReadOnly = $true; $txtLog.ScrollBars = "Vertical"
$txtLog.BackColor = [System.Drawing.Color]::FromArgb(10, 12, 15); $txtLog.ForeColor = [System.Drawing.Color]::FromArgb(165, 215, 175)
$txtLog.BorderStyle = "FixedSingle"; $txtLog.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$txtLog.Location = New-Object System.Drawing.Point(26, 125); $txtLog.Size = New-Object System.Drawing.Size(474, 155)
$txtLog.Text = "Listo para escanear toda tu biblioteca de Steam (instalados y no instalados).`r`nPulsa 'Instalar Ahora' para comenzar..."; $form.Controls.Add($txtLog)

$bar = New-Object System.Windows.Forms.ProgressBar
$bar.Location = New-Object System.Drawing.Point(26, 292); $bar.Size = New-Object System.Drawing.Size(474, 14); $form.Controls.Add($bar)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Instalar Ahora"; $btnInstall.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(37, 117, 252); $btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = "Flat"; $btnInstall.Location = New-Object System.Drawing.Point(330, 318); $btnInstall.Size = New-Object System.Drawing.Size(170, 38)
$form.Controls.Add($btnInstall)

function Log($msg) { $txtLog.AppendText("`r`n" + $msg); [System.Windows.Forms.Application]::DoEvents() }
$btnInstall.Add_Click({
    $btnInstall.Enabled = $false
    $srcDir = $PSScriptRoot; $destDir = Join-Path $env:LOCALAPPDATA "BacklogScreensaver"
    $bar.Value = 15; Log "-> Preparando carpeta en AppData\Local\BacklogScreensaver..."
    New-Item -ItemType Directory -Path "$destDir\library\img" -Force | Out-Null
    Copy-Item "$srcDir\*" $destDir -Recurse -Force -Exclude "INSTALAR.cmd","SetupUI.ps1"

    $clkStyle = $cmbClock.SelectedItem.ToString().Split(' ').GetValue(0)
    $cfgFile = "$destDir\config.js"
    (Get-Content $cfgFile -Raw) -replace "style:\s*'label'", "style: '$clkStyle'" | Set-Content $cfgFile -Encoding UTF8

    $bar.Value = 35
    $steamPath = (Get-ItemProperty "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue).SteamPath
    if (-not $steamPath) { $steamPath = "C:\Program Files (x86)\Steam" }
    Log "-> Escaneando biblioteca completa en: $steamPath"

    $gamesMap = @{}
    Get-ChildItem "$steamPath\steamapps\appmanifest_*.acf" -ErrorAction SilentlyContinue | ForEach-Object {
        $t = Get-Content $_.FullName -Raw -Encoding UTF8
        if ($t -match '"appid"\s*"(\d+)"') {
            $id = $Matches.Item(1)
            if ($t -match '"name"\s*"([^"]+)"') { $gamesMap[$id] = @{ name = $Matches.Item(1); playtime = 60; lastPlayed = [int][double]::Parse((Get-Date -UFormat %s)) } }
        }
    }

    $vdf = Get-ChildItem "$steamPath\userdata" -Filter "localconfig.vdf" -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($vdf) {
        $vTxt = Get-Content $vdf.FullName -Raw -Encoding UTF8
        $matchesIds = [regex]::Matches($vTxt, '"(\d{3,8})"\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}')
        foreach ($m in $matchesIds) {
            $id = $m.Groups.Item(1).Value; $blk = $m.Groups.Item(2).Value
            if ($blk -match '"Playtime"\s*"(\d+)"') {
                $pt = [int]$Matches.Item(1)
                $lp = if ($blk -match '"LastPlayed"\s*"(\d+)"') { [long]$Matches.Item(1) } else { 0 }
                if (-not $gamesMap.ContainsKey($id)) { $gamesMap[$id] = @{ name = "App $id"; playtime = $pt; lastPlayed = $lp } }
                else { $gamesMap[$id].playtime = $pt; if ($lp -gt 0) { $gamesMap[$id].lastPlayed = $lp } }
            }
        }
    }

    Get-ChildItem "$steamPath\appcache\librarycache" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^\d+$' } | ForEach-Object {
        $id = $_.Name
        if (-not $gamesMap.ContainsKey($id)) { $gamesMap[$id] = @{ name = "Game $id"; playtime = 0; lastPlayed = 0 } }
    }

    $bar.Value = 65; Log "-> Vinculando portadas y cabeceras ($($gamesMap.Count) títulos detectados)..."
    $finalGames = @()
    foreach ($id in $gamesMap.Keys) {
        $info = $gamesMap[$id]
        if ($info.name -match "Steamworks|Proton|Redistributable") { continue }
        $cov = Get-ChildItem "$steamPath\appcache\librarycache\$id" -Filter "*library_600x900*.jpg" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $cov) { $cov = Get-ChildItem "$steamPath\appcache\librarycache\$id" -Filter "*header*.jpg" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 }
        $relCov = $null
        if ($cov) { Copy-Item $cov.FullName "$destDir\library\img\$id.jpg" -Force; $relCov = "library/img/$id.jpg" }
        if ($relCov -or $info.playtime -gt 0) {
            $finalGames += [PSCustomObject]@{ appid = [int]$id; name = $info.name; playtime = $info.playtime; lastPlayed = $info.lastPlayed; cover = $relCov }
        }
    }

    if ($finalGames.Count -gt 0) {
        $libObj = [PSCustomObject]@{ generated = [int][double]::Parse((Get-Date -UFormat %s)); games = $finalGames; screenshots = @() }
        Set-Content -Path "$destDir\library\library.js" -Value ("window.BACKLOG_LIBRARY = " + ($libObj | ConvertTo-Json -Depth 6 -Compress) + ";") -Encoding UTF8
    }

    $bar.Value = 90; Log "-> Activando vigilante de 5 min y accesos directos..."
    $vbsAuto = "$destDir\LanzadorInvisible.vbs"; $vbsMan = "$destDir\LanzadorManual.vbs"
    Set-Content -Path $vbsAuto -Value "CreateObject(`"WScript.Shell`").Run `"powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$destDir\VigilanteInactividad.ps1`"`"`", 0, False" -Encoding ASCII
    Set-Content -Path $vbsMan -Value "CreateObject(`"WScript.Shell`").Run `"powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$destDir\LanzadorSeguro.ps1`"`" -manual`", 0, False" -Encoding ASCII

    Copy-Item $vbsAuto (Join-Path ([Environment]::GetFolderPath("Startup")) "BacklogVigilante.vbs") -Force
    Start-Process "wscript.exe" -ArgumentList "`"$vbsAuto`""

    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Backlog Screensaver.lnk"))
    $sc.TargetPath = "wscript.exe"; $sc.Arguments = "`"$vbsMan`""; $sc.WorkingDirectory = $destDir; $sc.Save()

    $bar.Value = 100; Log "¡COMPLETADO! Se importaron $($finalGames.Count) juegos de toda tu biblioteca."
    [System.Windows.Forms.MessageBox]::Show("¡Instalación Exitosa!`n`nSe importaron $($finalGames.Count) juegos (instalados y en biblioteca).`n• Se abrirá solo tras 5 minutos de inactividad.`n• Usa el ícono 'Backlog Screensaver' en tu Escritorio para probarlo ahora.", "Backlog Screensaver", "OK", "Information")
    $form.Close()
})

[void]$form.ShowDialog()
