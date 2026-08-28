$ErrorActionPreference = "Stop"

Set-Location (
    Resolve-Path (
        Join-Path $PSScriptRoot "..\.."
    )
)

Write-Host ""
Write-Host "Meridian V2 Provider Cache Benchmark" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

$ApiBaseUrl =
    if (
        [string]::IsNullOrWhiteSpace(
            $env:BENCHMARK_API_URL
        )
    ) {
        "http://localhost:3001/api/v1"
    }
    else {
        $env:BENCHMARK_API_URL.TrimEnd("/")
    }

$BenchmarkEmail =
    if (
        [string]::IsNullOrWhiteSpace(
            $env:BENCHMARK_EMAIL
        )
    ) {
        "benchmark-owner@meridian.local"
    }
    else {
        $env:BENCHMARK_EMAIL
    }

if (
    [string]::IsNullOrWhiteSpace(
        $env:BENCHMARK_PASSWORD
    )
) {
    throw "BENCHMARK_PASSWORD is required."
}

$manifest =
    Get-Content `
        ".\performance\data\benchmark-manifest-v2.json" `
        -Raw |
    ConvertFrom-Json

$TripId =
    $manifest.primaryTrip.id

# ------------------------------------------------------------
# Authentication
# ------------------------------------------------------------

$loginBody = @{
    email =
        $BenchmarkEmail

    password =
        $env:BENCHMARK_PASSWORD
} |
ConvertTo-Json

$login =
    Invoke-RestMethod `
        -Uri "$ApiBaseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody

if (
    $login.data -and
    $login.data.accessToken
) {
    $Token =
        $login.data.accessToken
}
elseif (
    $login.accessToken
) {
    $Token =
        $login.accessToken
}
else {
    throw "No access token found."
}

$headers = @{
    Authorization =
        "Bearer $Token"
}

Write-Host "Authentication: OK" -ForegroundColor Green

# ------------------------------------------------------------
# Redis helpers
# ------------------------------------------------------------

function Remove-CacheKeys {

    param(
        [Parameter(Mandatory)]
        [string]$Pattern
    )

    $keys =
        @(
            docker exec `
                meridian-redis `
                redis-cli `
                --scan `
                --pattern `
                $Pattern
        )

    if (
        $LASTEXITCODE -ne 0
    ) {
        throw "Could not scan Redis cache."
    }

    foreach (
        $key in $keys
    ) {
        $trimmed =
            $key.Trim()

        if (
            -not [string]::IsNullOrWhiteSpace(
                $trimmed
            )
        ) {
            docker exec `
                meridian-redis `
                redis-cli `
                DEL `
                $trimmed |
            Out-Null

            if (
                $LASTEXITCODE -ne 0
            ) {
                throw "Could not delete Redis key: $trimmed"
            }
        }
    }
}

function Get-CacheKeys {

    param(
        [Parameter(Mandatory)]
        [string]$Pattern
    )

    return @(
        docker exec `
            meridian-redis `
            redis-cli `
            --scan `
            --pattern `
            $Pattern
    )
}

# ------------------------------------------------------------
# Statistics
# ------------------------------------------------------------

function Get-Median {

    param(
        [Parameter(Mandatory)]
        [double[]]$Values
    )

    $sorted =
        @(
            $Values |
            Sort-Object
        )

    if (
        $sorted.Count -eq 0
    ) {
        return $null
    }

    $middle =
        [math]::Floor(
            $sorted.Count / 2
        )

    if (
        $sorted.Count % 2 -eq 0
    ) {
        return [math]::Round(
            (
                $sorted[$middle - 1] +
                $sorted[$middle]
            ) / 2,
            3
        )
    }

    return [math]::Round(
        $sorted[$middle],
        3
    )
}

function Get-ImprovementPercent {

    param(
        [Parameter(Mandatory)]
        [double]$Baseline,

        [Parameter(Mandatory)]
        [double]$Current
    )

    if (
        $Baseline -eq 0
    ) {
        return 0
    }

    return [math]::Round(
        (
            (
                $Baseline -
                $Current
            ) /
            $Baseline
        ) * 100,
        2
    )
}

# ------------------------------------------------------------
# HTTP measurement
# ------------------------------------------------------------

function Invoke-ProviderMeasurement {

    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$Phase,

        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter(Mandatory)]
        [int]$Run
    )

    $watch =
        [System.Diagnostics.Stopwatch]::StartNew()

    try {

        $response =
            Invoke-WebRequest `
                -Uri $Uri `
                -Method Get `
                -Headers $headers `
                -UseBasicParsing

        $watch.Stop()

        $payload =
            $response.Content |
            ConvertFrom-Json

        if (
            $payload.data
        ) {
            $body =
                $payload.data
        }
        else {
            $body =
                $payload
        }

        $detail =
            $null

        if (
            $Name -eq "geocoding"
        ) {
            $detail =
                "results=$(@($body.results).Count)"
        }

        if (
            $Name -eq "weather"
        ) {
            $detail =
                "availability=$($body.availability)"
        }

        return [PSCustomObject]@{
            providerTest =
                $Name

            phase =
                $Phase

            run =
                $Run

            status =
                [int]$response.StatusCode

            elapsedMs =
                [math]::Round(
                    $watch.Elapsed.TotalMilliseconds,
                    3
                )

            provider =
                $body.provider

            detail =
                $detail
        }
    }
    catch {

        $watch.Stop()

        return [PSCustomObject]@{
            providerTest =
                $Name

            phase =
                $Phase

            run =
                $Run

            status =
                if (
                    $_.Exception.Response
                ) {
                    [int]$_.Exception.Response.StatusCode
                }
                else {
                    0
                }

            elapsedMs =
                [math]::Round(
                    $watch.Elapsed.TotalMilliseconds,
                    3
                )

            provider =
                $null

            detail =
                $_.Exception.Message
        }
    }
}

# ------------------------------------------------------------
# Benchmark helper
# ------------------------------------------------------------

function Invoke-CacheBenchmark {

    param(
        [Parameter(Mandatory)]
        [string]$Name,

        [Parameter(Mandatory)]
        [string]$Uri,

        [Parameter(Mandatory)]
        [string]$CachePattern
    )

    $measurements =
        @()

    Write-Host ""
    Write-Host "$Name COLD / cache MISS..." -ForegroundColor Yellow

    1..3 |
    ForEach-Object {

        Remove-CacheKeys `
            -Pattern $CachePattern

        Start-Sleep `
            -Milliseconds 500

        $measurement =
            Invoke-ProviderMeasurement `
                -Name $Name `
                -Phase "cold" `
                -Uri $Uri `
                -Run $_

        if (
            $measurement.status -ne 200
        ) {
            throw "$Name cold run $_ failed with HTTP $($measurement.status): $($measurement.detail)"
        }

        $measurements +=
            $measurement

        Write-Host (
            "COLD {0}: {1} ms | HTTP {2}" -f `
                $_,
                $measurement.elapsedMs,
                $measurement.status
        )

        Start-Sleep `
            -Seconds 2
    }

    $keysAfterCold =
        @(
            Get-CacheKeys `
                -Pattern $CachePattern
        )

    if (
        $keysAfterCold.Count -eq 0
    ) {
        throw "$Name did not create a Redis cache key after cold requests."
    }

    Write-Host (
        "Cache populated: {0} key(s)" -f `
            $keysAfterCold.Count
    ) -ForegroundColor Green

    Write-Host ""
    Write-Host "$Name WARM / cache HIT..." -ForegroundColor Yellow

    1..3 |
    ForEach-Object {

        $measurement =
            Invoke-ProviderMeasurement `
                -Name $Name `
                -Phase "warm" `
                -Uri $Uri `
                -Run $_

        if (
            $measurement.status -ne 200
        ) {
            throw "$Name warm run $_ failed with HTTP $($measurement.status): $($measurement.detail)"
        }

        $measurements +=
            $measurement

        Write-Host (
            "WARM {0}: {1} ms | HTTP {2}" -f `
                $_,
                $measurement.elapsedMs,
                $measurement.status
        )

        Start-Sleep `
            -Milliseconds 500
    }

    return $measurements
}

# ------------------------------------------------------------
# URLs
# ------------------------------------------------------------

$query =
    [uri]::EscapeDataString(
        "Duomo di Milano"
    )

$geocodingUri =
    "$ApiBaseUrl/geocoding/search?q=$query"

$weatherUri =
    "$ApiBaseUrl/trips/$TripId/weather"

# ------------------------------------------------------------
# Run benchmarks
# ------------------------------------------------------------

$results =
    @()

$results +=
    Invoke-CacheBenchmark `
        -Name "geocoding" `
        -Uri $geocodingUri `
        -CachePattern "meridian:v2:geocoding.search:*"

$results +=
    Invoke-CacheBenchmark `
        -Name "weather" `
        -Uri $weatherUri `
        -CachePattern "meridian:v2:weather.*"

# ------------------------------------------------------------
# Verify all measurements
# ------------------------------------------------------------

$failed =
    @(
        $results |
        Where-Object {
            $_.status -ne 200
        }
    )

if (
    $failed.Count -gt 0
) {
    throw "One or more provider measurements failed."
}

# ------------------------------------------------------------
# V1 baseline
# ------------------------------------------------------------

$v1 =
    Get-Content `
        ".\performance\results\v1-provider-baseline.json" `
        -Raw |
    ConvertFrom-Json

# ------------------------------------------------------------
# Summaries
# ------------------------------------------------------------

function Get-PhaseTimes {

    param(
        [Parameter(Mandatory)]
        [string]$Provider,

        [Parameter(Mandatory)]
        [string]$Phase
    )

    return @(
        $results |
        Where-Object {
            $_.providerTest -eq $Provider -and
            $_.phase -eq $Phase
        } |
        ForEach-Object {
            [double]$_.elapsedMs
        }
    )
}

$geoColdTimes =
    Get-PhaseTimes `
        -Provider "geocoding" `
        -Phase "cold"

$geoWarmTimes =
    Get-PhaseTimes `
        -Provider "geocoding" `
        -Phase "warm"

$weatherColdTimes =
    Get-PhaseTimes `
        -Provider "weather" `
        -Phase "cold"

$weatherWarmTimes =
    Get-PhaseTimes `
        -Provider "weather" `
        -Phase "warm"

$geoColdMedian =
    Get-Median `
        -Values $geoColdTimes

$geoWarmMedian =
    Get-Median `
        -Values $geoWarmTimes

$weatherColdMedian =
    Get-Median `
        -Values $weatherColdTimes

$weatherWarmMedian =
    Get-Median `
        -Values $weatherWarmTimes

$gitCommit =
    (
        git rev-parse HEAD
    ).Trim()

$summary = [ordered]@{
    benchmarkVersion = 2

    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    gitCommit =
        $gitCommit

    datasetCommit =
        $manifest.gitCommit

    methodology =
        "3 independent cache misses and 3 cache hits per provider-backed endpoint"

    baseline = [ordered]@{
        geocodingMedianMs =
            [double]$v1.geocoding.medianMs

        weatherMedianMs =
            [double]$v1.weather.medianMs
    }

    geocoding = [ordered]@{
        query =
            "Duomo di Milano"

        cold = [ordered]@{
            medianMs =
                $geoColdMedian

            runsMs =
                @(
                    $geoColdTimes |
                    Sort-Object
                )

            versusV1Pct =
                Get-ImprovementPercent `
                    -Baseline ([double]$v1.geocoding.medianMs) `
                    -Current $geoColdMedian
        }

        warm = [ordered]@{
            medianMs =
                $geoWarmMedian

            runsMs =
                @(
                    $geoWarmTimes |
                    Sort-Object
                )

            versusV1Pct =
                Get-ImprovementPercent `
                    -Baseline ([double]$v1.geocoding.medianMs) `
                    -Current $geoWarmMedian

            versusColdPct =
                Get-ImprovementPercent `
                    -Baseline $geoColdMedian `
                    -Current $geoWarmMedian
        }
    }

    weather = [ordered]@{
        tripId =
            $TripId

        cold = [ordered]@{
            medianMs =
                $weatherColdMedian

            runsMs =
                @(
                    $weatherColdTimes |
                    Sort-Object
                )

            versusV1Pct =
                Get-ImprovementPercent `
                    -Baseline ([double]$v1.weather.medianMs) `
                    -Current $weatherColdMedian
        }

        warm = [ordered]@{
            medianMs =
                $weatherWarmMedian

            runsMs =
                @(
                    $weatherWarmTimes |
                    Sort-Object
                )

            versusV1Pct =
                Get-ImprovementPercent `
                    -Baseline ([double]$v1.weather.medianMs) `
                    -Current $weatherWarmMedian

            versusColdPct =
                Get-ImprovementPercent `
                    -Baseline $weatherColdMedian `
                    -Current $weatherWarmMedian
        }
    }

    runs =
        $results
}

$output =
    ".\performance\results\v2-provider-cache.json"

$json =
    $summary |
    ConvertTo-Json -Depth 12

$outputPath =
    Join-Path `
        (Get-Location) `
        $output

[System.IO.File]::WriteAllText(
    $outputPath,
    $json + [Environment]::NewLine,
    (
        New-Object System.Text.UTF8Encoding(
            $false
        )
    )
)

# ------------------------------------------------------------
# Console result
# ------------------------------------------------------------

Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan
Write-Host " V2 PROVIDER CACHE RESULTS" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

Write-Host ""
$results |
Format-Table `
    providerTest,
    phase,
    run,
    status,
    elapsedMs,
    provider,
    detail `
    -AutoSize

Write-Host ""
Write-Host "Geocoding" -ForegroundColor Yellow
Write-Host (
    "V1 median:    {0} ms" -f `
        $v1.geocoding.medianMs
)
Write-Host (
    "V2 cold:      {0} ms" -f `
        $geoColdMedian
)
Write-Host (
    "V2 warm:      {0} ms" -f `
        $geoWarmMedian
)
Write-Host (
    "Warm vs V1:   {0}%" -f `
        $summary.geocoding.warm.versusV1Pct
)
Write-Host (
    "Warm vs cold: {0}%" -f `
        $summary.geocoding.warm.versusColdPct
)

Write-Host ""
Write-Host "Weather" -ForegroundColor Yellow
Write-Host (
    "V1 median:    {0} ms" -f `
        $v1.weather.medianMs
)
Write-Host (
    "V2 cold:      {0} ms" -f `
        $weatherColdMedian
)
Write-Host (
    "V2 warm:      {0} ms" -f `
        $weatherWarmMedian
)
Write-Host (
    "Warm vs V1:   {0}%" -f `
        $summary.weather.warm.versusV1Pct
)
Write-Host (
    "Warm vs cold: {0}%" -f `
        $summary.weather.warm.versusColdPct
)

Write-Host ""
Write-Host "Saved:" $output -ForegroundColor Green
