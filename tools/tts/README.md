# Seval TTS Engines

Seval always supports Windows SAPI voices through PowerShell.

For higher-quality local AI voices, Seval supports any OpenAI-compatible local TTS server that accepts:

```http
POST /v1/audio/speech
```

with JSON fields:

```json
{
  "model": "kokoro",
  "input": "Text to speak",
  "voice": "af_heart",
  "response_format": "wav"
}
```

## Optional installers

```powershell
powershell -ExecutionPolicy Bypass -File tools\tts\install-kokoro.ps1
powershell -ExecutionPolicy Bypass -File tools\tts\install-chatterbox-turbo.ps1
```

Kokoro is usually the lighter option. Chatterbox-Turbo can sound better but is heavier and may need more local dependencies.
