Add-Type -AssemblyName System.Speech

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voices = $synth.GetInstalledVoices() | ForEach-Object {
  [PSCustomObject]@{
    name = $_.VoiceInfo.Name
    culture = $_.VoiceInfo.Culture.Name
    gender = $_.VoiceInfo.Gender.ToString()
    age = $_.VoiceInfo.Age.ToString()
  }
}
$synth.Dispose()

$voices | ConvertTo-Json
