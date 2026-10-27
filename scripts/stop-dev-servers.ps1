$ErrorActionPreference = 'SilentlyContinue'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$listeners = Get-NetTCPConnection -State Listen -LocalPort 4200, 8000
$stopped = [System.Collections.Generic.HashSet[int]]::new()

foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if (-not $process) { continue }

    $command = [string]$process.CommandLine
    $executable = [string]$process.ExecutablePath
    $isFrontend = $listener.LocalPort -eq 4200 -and (
        $executable.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
        $command -match 'angular[\\/]cli|ng\.js serve|ng serve'
    )
    $isBackend = $listener.LocalPort -eq 8000 -and $command -match 'backend[\\/]manage\.py runserver'

    if ($isFrontend -or $isBackend) {
        Stop-Process -Id $process.ProcessId -Force
        [void]$stopped.Add([int]$process.ProcessId)

        if ($isBackend) {
            Get-CimInstance Win32_Process | Where-Object {
                $_.Name -match '^python(w)?\.exe$' -and [string]$_.CommandLine -match 'backend[\\/]manage\.py runserver'
            } | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force
                [void]$stopped.Add([int]$_.ProcessId)
            }
        }
    }
}

if ($stopped.Count -gt 0) {
    Write-Host "Stopped previous development server process(es): $($stopped -join ', ')"
}

