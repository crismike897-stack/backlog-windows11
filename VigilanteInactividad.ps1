$wCreated = $false
$wMutex = New-Object System.Threading.Mutex($true, "Global\BacklogWatcherMutex", [ref]$wCreated)
if (-not $wCreated) { exit }

try {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class IdleCheck {
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    public static uint GetLastTick() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
        GetLastInputInfo(ref lii);
        return lii.dwTime;
    }
}
"@

    $launcher = Join-Path $PSScriptRoot "LanzadorSeguro.ps1"
    $lastInputTick = [IdleCheck]::GetLastTick()
    $idleStartTime = Get-Date
    $alreadyTriggered = $false

    while ($true) {
        $currentTick = [IdleCheck]::GetLastTick()

        # Verificar si hay un video reproduciéndose en este momento
        $req = powercfg /requests | Out-String
        $videoActivo = $false
        if ($req -match "(?s)DISPLAY:\s*(.*?)\s*SYSTEM:") {
            $d = $Matches.Item(1).Trim()
            if ($d -ne "" -and $d -notmatch "^(None|Ninguno|Ninguna)\.?$") { $videoActivo = $true }
        }

        # Si moviste el mouse/teclado O si hay un video activo, el contador de 5 minutos se reinicia a 0
        if ($currentTick -ne $lastInputTick -or $videoActivo) {
            $lastInputTick = $currentTick
            $idleStartTime = Get-Date
            $alreadyTriggered = $false
        } else {
            $segundosSinActividad = ((Get-Date) - $idleStartTime).TotalSeconds
            if ($segundosSinActividad -ge 300 -and -not $alreadyTriggered) {
                $alreadyTriggered = $true
                & powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $launcher
                # Al cerrarse el salvapantallas, reiniciar reloj para el próximo ciclo
                $lastInputTick = [IdleCheck]::GetLastTick()
                $idleStartTime = Get-Date
                $alreadyTriggered = $false
            }
        }

        Start-Sleep -Seconds 5
    }
} finally {
    $wMutex.ReleaseMutex()
    $wMutex.Dispose()
}



