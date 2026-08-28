$ErrorActionPreference = "Stop"

Set-Location (
    Resolve-Path (
        Join-Path $PSScriptRoot "..\.."
    )
)

Write-Host ""
Write-Host "Meridian V1 Provider Baseline" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# ------------------------------------------------------------
# Dataset
# ------------------------------------------------------------

$manifest =
    Get-Content `
        ".\performance\data\benchmark-manifest.json" `
        -Raw |
    ConvertFrom-Json

$TripId =
    $manifest.primaryTrip.id

# ------------------------------------------------------------
# Authentication
# ------------------------------------------------------------

$loginBody = @{
    email =
        "benchmark-owner@meridian.local"

    password =
        "MeridianBenchmark123!"
} |
ConvertTo-Json

$login =
    Invoke-RestMethod `
        -Uri "http://localhost:3001/api/v1/auth/login" `
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

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

function Invoke-ProviderMeasurement {

    param(
        [Parameter(Mandatory)]
        [string]$Name,

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

        if ($payload.data) {
            $body =
                $payload.data
        }
        else {
            $body =
                $payload
        }

        $detail = $null

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
# Geocoding
# ------------------------------------------------------------

$query =
    [uri]::EscapeDataString(
        "Duomo di Milano"
    )

$geocodingUri =
    "http://localhost:3001/api/v1/geocoding/search?q=$query"

$results = @()

Write-Host ""
Write-Host "Geocoding baseline..." -ForegroundColor Yellow

1..3 |
ForEach-Object {

    $measurement =
        Invoke-ProviderMeasurement `
            -Name "geocoding" `
            -Uri $geocodingUri `
            -Run $_

    $results +=
        $measurement

    Write-Host (
        "Run {0}: {1} ms | HTTP {2}" -f `
            $_,
            $measurement.elapsedMs,
            $measurement.status
    )

    Start-Sleep -Seconds 2
}

# ------------------------------------------------------------
# Weather
# ------------------------------------------------------------

$weatherUri =
    "http://localhost:3001/api/v1/trips/$TripId/weather"

Write-Host ""
Write-Host "Weather baseline..." -ForegroundColor Yellow

1..3 |
ForEach-Object {

    $measurement =
        Invoke-ProviderMeasurement `
            -Name "weather" `
            -Uri $weatherUri `
            -Run $_

    $results +=
        $measurement

    Write-Host (
        "Run {0}: {1} ms | HTTP {2}" -f `
            $_,
            $measurement.elapsedMs,
            $measurement.status
    )

    Start-Sleep -Seconds 2
}

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

$geoTimes =
    @(
        $results |
        Where-Object {
            $_.providerTest -eq "geocoding"
        } |
        ForEach-Object {
            [double]$_.elapsedMs
        } |
        Sort-Object
    )

$weatherTimes =
    @(
        $results |
        Where-Object {
            $_.providerTest -eq "weather"
        } |
        ForEach-Object {
            [double]$_.elapsedMs
        } |
        Sort-Object
    )

$gitCommit =
    (
        git rev-parse HEAD
    ).Trim()

$summary = [ordered]@{
    benchmarkVersion = 1

    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    gitCommit =
        $gitCommit

    datasetCommit =
        $manifest.gitCommit

    methodology =
        "3 sequential requests per external-provider endpoint"

    geocoding = [ordered]@{
        query =
            "Duomo di Milano"

        medianMs =
            $geoTimes[1]

        runsMs =
            $geoTimes
    }

    weather = [ordered]@{
        tripId =
            $TripId

        medianMs =
            $weatherTimes[1]

        runsMs =
            $weatherTimes
    }

    runs =
        $results
}

$output =
    ".\performance\results\v1-provider-baseline.json"

$summary |
ConvertTo-Json -Depth 10 |
Out-File `
    -FilePath $output `
    -Encoding utf8 `
    -Force

Write-Host ""
Write-Host "RESULTS" -ForegroundColor Cyan

$results |
Format-Table `
    providerTest,
    run,
    status,
    elapsedMs,
    provider,
    detail `
    -AutoSize

Write-Host ""
Write-Host (
    "Geocoding median: {0} ms" -f
    $geoTimes[1]
)

Write-Host (
    "Weather median:    {0} ms" -f
    $weatherTimes[1]
)

Write-Host ""
Write-Host "Saved:" $output