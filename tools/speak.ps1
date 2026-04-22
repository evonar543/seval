param(
  [Parameter(Mandatory = $true)]
  [string]$TextPath,

  [Parameter(Mandatory = $true)]
  [string]$OutPath,

  [int]$Rate = 0,

  [string]$Voice = ""
)

Add-Type -AssemblyName System.Speech

$text = Get-Content -LiteralPath $TextPath -Raw -Encoding UTF8
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))

if ($Voice.Trim().Length -gt 0) {
  $installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
  if ($installed -contains $Voice) {
    $synth.SelectVoice($Voice)
  }
}

$directory = Split-Path -Parent $OutPath
if ($directory -and -not (Test-Path -LiteralPath $directory)) {
  New-Item -ItemType Directory -Path $directory | Out-Null
}

$synth.SetOutputToWaveFile($OutPath)
$synth.Speak($text)
$synth.Dispose()
