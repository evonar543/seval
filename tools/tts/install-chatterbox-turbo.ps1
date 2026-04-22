$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$venv = Join-Path $root ".seval\tts\chatterbox-turbo"

if (-not (Test-Path $venv)) {
  python -m venv $venv
}

$python = Join-Path $venv "Scripts\python.exe"
& $python -m pip install --upgrade pip
& $python -m pip install chatterbox-tts

Write-Host "Chatterbox-Turbo Python environment installed at $venv"
Write-Host "This engine can be heavy. Use a local OpenAI-compatible TTS server or extend tools\tts\chatterbox_turbo.py for direct rendering."
