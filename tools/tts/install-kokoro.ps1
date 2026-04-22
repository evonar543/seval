$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$venv = Join-Path $root ".seval\tts\kokoro"

if (-not (Test-Path $venv)) {
  python -m venv $venv
}

$python = Join-Path $venv "Scripts\python.exe"
& $python -m pip install --upgrade pip
& $python -m pip install kokoro-onnx soundfile onnxruntime

Write-Host "Kokoro Python environment installed at $venv"
Write-Host "Next: run or connect a Kokoro OpenAI-compatible TTS server, then use Seval's OpenAI-compatible local TTS engine."
