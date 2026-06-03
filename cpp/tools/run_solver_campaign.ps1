param(
    [string]$SolverPath = ".\cpp\build\bugma_solver",
    [switch]$SkipBuild,
    [string]$SavePath = ".\cpp\banmen_save_import.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-LogDir {
    $ts = Get-Date -Format "yyyyMMdd_HHmmss"
    $dir = Join-Path ".\cpp\logs" "campaign_$ts"
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    return $dir
}

function Build-Solver {
    Write-Host "[build] g++ -std=c++17 -O2 -o cpp/build/bugma_solver cpp/src/main.cpp"
    & g++ -std=c++17 -O2 -o cpp/build/bugma_solver cpp/src/main.cpp
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed."
    }
}

function Get-OfficialSaveKeys {
    $keys = New-Object System.Collections.Generic.List[string]
    for ($i = 1; $i -le 52; $i++) {
        $keys.Add("$i")
    }
    $keys.Add("53")

    $baseIds = @(61, 62, 63, 64, 65, 66, 67)
    $colors = @(1, 2, 3, 4, 6)
    foreach ($c in $colors) {
        foreach ($bid in $baseIds) {
            $keys.Add("${bid}_c${c}")
        }
    }

    for ($i = 81; $i -le 93; $i++) {
        $keys.Add("$i")
    }
    return $keys
}

function Get-CustomIds {
    $path = ".\js\custom_levels.js"
    if (-not (Test-Path $path)) {
        return @()
    }
    $text = Get-Content -Raw -Path $path
    $matches = [regex]::Matches($text, '"(\d+-\d+)"\s*:')
    $ids = New-Object System.Collections.Generic.HashSet[string]
    foreach ($m in $matches) {
        $ids.Add($m.Groups[1].Value) | Out-Null
    }
    return @($ids) | Sort-Object
}

function Read-SaveRecords {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        return @{}
    }
    $json = Get-Content -Raw -Path $Path | ConvertFrom-Json
    $records = @{}
    if ($null -ne $json.content -and $null -ne $json.content.levels) {
        foreach ($p in $json.content.levels.PSObject.Properties) {
            $records[$p.Name] = $p.Value
        }
    }
    return $records
}

function Get-UnsolvedSummary {
    param([string]$Path)

    $records = Read-SaveRecords -Path $Path
    $officialKeys = Get-OfficialSaveKeys
    $customIds = Get-CustomIds

    $officialUnsolved = New-Object System.Collections.Generic.List[string]
    foreach ($k in $officialKeys) {
        if (-not $records.ContainsKey($k) -or [string]::IsNullOrEmpty($records[$k].replay)) {
            $officialUnsolved.Add($k)
        }
    }

    $customUnsolved = New-Object System.Collections.Generic.List[string]
    foreach ($cid in $customIds) {
        $k = "custom_$cid"
        if (-not $records.ContainsKey($k) -or [string]::IsNullOrEmpty($records[$k].replay)) {
            $customUnsolved.Add($cid)
        }
    }

    [pscustomobject]@{
        OfficialTotal = $officialKeys.Count
        OfficialUnsolved = @($officialUnsolved)
        CustomTotal = $customIds.Count
        CustomUnsolved = @($customUnsolved)
    }
}

function New-StepInputLines {
    param([hashtable]$Step)
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add([string]$Step.Mode)
    $lines.Add([string]$Step.MaxNodes)
    $lines.Add([string]$Step.Algo)

    switch ($Step.Algo.ToLowerInvariant()) {
        "astar" {
            $lines.Add([string]$Step.AstarWeight)
        }
        "beam" {
            $lines.Add([string]$Step.BeamWidth)
        }
        "mha" {
            $lines.Add([string]$Step.MhaAuxWeight)
        }
        "ara" {
            $lines.Add([string]$Step.AraStartWeight)
            $lines.Add([string]$Step.AraEndWeight)
            $lines.Add([string]$Step.AraStep)
        }
        "rrastar" {
            $lines.Add([string]$Step.AstarWeight)
            $lines.Add([string]$Step.RandomRestarts)
            $lines.Add([string]$Step.RandomPrefix)
            $lines.Add([string]$Step.RandomJitter)
            $lines.Add([string]$Step.RandomSeed)
        }
    }

    $useHp = if ($Step.UseHpHeuristic) { "1" } else { "0" }
    $safePurple = if ($Step.SafePurpleMode) { "1" } else { "0" }
    $lines.Add($useHp)
    if ($Step.UseHpHeuristic) {
        $lines.Add([string]$Step.HpWeight)
    }
    $lines.Add($safePurple)
    if ($Step.SafePurpleMode) {
        $lines.Add([string]$Step.PurpleRiskWeight)
    }

    $lines.Add([string]$Step.Selector)
    return $lines
}

function Invoke-InteractiveBatch {
    param(
        [string]$Name,
        [hashtable[]]$Steps,
        [string]$LogDir,
        [string]$SolverPath
    )

    $inputLines = New-Object System.Collections.Generic.List[string]
    foreach ($s in $Steps) {
        $stepLines = New-StepInputLines -Step $s
        foreach ($l in $stepLines) { $inputLines.Add($l) }
    }
    $inputLines.Add("0")
    $inputText = ($inputLines -join "`n") + "`n"

    $logPath = Join-Path $LogDir "$Name.log"
    Write-Host "[run] $Name"
    Write-Host "      log: $logPath"

    $output = $inputText | & $SolverPath --interactive 2>&1
    $output | Tee-Object -FilePath $logPath | Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw "Interactive batch failed: $Name"
    }
}

if (-not $SkipBuild) {
    Build-Solver
}

$solverCandidate = $SolverPath
if (-not (Test-Path $solverCandidate)) {
    if (-not $solverCandidate.ToLowerInvariant().EndsWith(".exe")) {
        $solverExe = "$solverCandidate.exe"
        if (Test-Path $solverExe) {
            $solverCandidate = $solverExe
        }
    }
}
if (-not (Test-Path $solverCandidate)) {
    throw "Solver binary not found: $SolverPath (or $SolverPath.exe)"
}
$SolverPath = $solverCandidate

$logDir = New-LogDir
Write-Host "[info] campaign log dir: $logDir"

# Phase 1
# A* 500k: official ALL + custom ALL
Invoke-InteractiveBatch -Name "phase1_astar_500k" -SolverPath $SolverPath -LogDir $logDir -Steps @(
    @{
        Mode = 1; MaxNodes = 500000; Algo = "astar"; AstarWeight = 1.0;
        UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0;
        Selector = "ALL"
    },
    @{
        Mode = 3; MaxNodes = 500000; Algo = "astar"; AstarWeight = 1.0;
        UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0;
        Selector = "ALL"
    }
)

# Phase 2
# Weighted A* 1000k: official ALL + custom UNSOLVED
Invoke-InteractiveBatch -Name "phase2_weighted_astar_1000k" -SolverPath $SolverPath -LogDir $logDir -Steps @(
    @{
        Mode = 1; MaxNodes = 1000000; Algo = "astar"; AstarWeight = 1.4;
        UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0;
        Selector = "ALL"
    },
    @{
        Mode = 3; MaxNodes = 1000000; Algo = "astar"; AstarWeight = 1.4;
        UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0;
        Selector = "UNSOLVED"
    }
)

# Phase 3
# Rotate algorithms on remaining UNSOLVED (official + custom)
$phase3Runs = @(
    @{
        Name = "phase3_rrastar_1500k"
        Step = @{
            MaxNodes = 1500000; Algo = "rrastar"; AstarWeight = 1.0;
            RandomRestarts = 48; RandomPrefix = 10; RandomJitter = 1.2; RandomSeed = 0;
            UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0
        }
    },
    @{
        Name = "phase3_mha_1500k"
        Step = @{
            MaxNodes = 1500000; Algo = "mha"; MhaAuxWeight = 1.8;
            UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0
        }
    },
    @{
        Name = "phase3_ara_1500k"
        Step = @{
            MaxNodes = 1500000; Algo = "ara"; AraStartWeight = 3.0; AraEndWeight = 1.0; AraStep = 0.4;
            UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0
        }
    },
    @{
        Name = "phase3_beam_1200k"
        Step = @{
            MaxNodes = 1200000; Algo = "beam"; BeamWidth = 512;
            UseHpHeuristic = $true; HpWeight = 1.0; SafePurpleMode = $true; PurpleRiskWeight = 6.0
        }
    }
)

foreach ($run in $phase3Runs) {
    $base = $run.Step
    Invoke-InteractiveBatch -Name $run.Name -SolverPath $SolverPath -LogDir $logDir -Steps @(
        (@{
            Mode = 1; Selector = "UNSOLVED"
        } + $base),
        (@{
            Mode = 3; Selector = "UNSOLVED"
        } + $base)
    )
}

$summary = Get-UnsolvedSummary -Path $SavePath
$summaryPath = Join-Path $logDir "summary.txt"
$summaryJsonPath = Join-Path $logDir "summary.json"

$lines = @()
$lines += "Campaign finished at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$lines += "Save file: $SavePath"
$lines += ""
$lines += "Official unresolved: $($summary.OfficialUnsolved.Count)/$($summary.OfficialTotal)"
$lines += "Custom unresolved  : $($summary.CustomUnsolved.Count)/$($summary.CustomTotal)"
$lines += ""
$lines += "Official unsolved keys:"
$lines += ($summary.OfficialUnsolved -join ", ")
$lines += ""
$lines += "Custom unsolved ids:"
$lines += ($summary.CustomUnsolved -join ", ")

$lines | Set-Content -Path $summaryPath
$summary | ConvertTo-Json -Depth 5 | Set-Content -Path $summaryJsonPath

Write-Host ""
Write-Host "[done] campaign complete"
Write-Host "       logs   : $logDir"
Write-Host "       summary: $summaryPath"
Write-Host "       json   : $summaryJsonPath"
