$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Force TLS 1.2 (PowerShell 5.1 defaults can vary)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Add-Type -AssemblyName System.Net.Http

$uri = [Uri]'https://formsubmit.co/cekaj.riart%40outlook.com'

$pairs = @(
  @('name', 'RBC Test'),
  @('email', 'test@example.com'),
  @('phone', '+491234567'),
  @('subject', 'PS Test'),
  @('category', 'general'),
  @('message', 'Test von PowerShell am 2026-01-30 (bitte ignorieren)'),
  @('privacy', 'on'),
  @('_subject', 'RBC Kontakt Test'),
  @('_captcha', 'false'),
  @('_template', 'table'),
  @('_next', 'https://rbc-excellence.com/danke.html'),
  @('_honey', '')
)

$kvps = New-Object 'System.Collections.Generic.List[System.Collections.Generic.KeyValuePair[string,string]]'
foreach ($p in $pairs) {
  $kvps.Add([System.Collections.Generic.KeyValuePair[string,string]]::new([string]$p[0], [string]$p[1]))
}

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AllowAutoRedirect = $false

$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
$client.DefaultRequestHeaders.Accept.Clear()
$client.DefaultRequestHeaders.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new('text/html'))
$client.DefaultRequestHeaders.AcceptLanguage.Clear()
$client.DefaultRequestHeaders.AcceptLanguage.Add([System.Net.Http.Headers.StringWithQualityHeaderValue]::new('de-DE'))
$client.DefaultRequestHeaders.AcceptLanguage.Add([System.Net.Http.Headers.StringWithQualityHeaderValue]::new('de'))
$client.DefaultRequestHeaders.AcceptLanguage.Add([System.Net.Http.Headers.StringWithQualityHeaderValue]::new('en-US'))
$client.DefaultRequestHeaders.Referrer = [Uri]'https://rbc-excellence.com/kontakt.html'
$null = $client.DefaultRequestHeaders.TryAddWithoutValidation('Origin', 'https://rbc-excellence.com')

try {
  $content = [System.Net.Http.FormUrlEncodedContent]::new($kvps)
  $resp = $client.PostAsync($uri, $content).GetAwaiter().GetResult()

  'OK'
  'Status: ' + [int]$resp.StatusCode
  $location = $resp.Headers.Location
  $locationText = ''
  if ($location) { $locationText = $location.ToString() }
  'Location: ' + $locationText

  $text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if ($text) {
    $outFile = Join-Path $PSScriptRoot 'formsubmit-last-response.html'
    [System.IO.File]::WriteAllText($outFile, $text, [System.Text.Encoding]::UTF8)
    'Saved body to: ' + $outFile

    $lc = $text.ToLowerInvariant()
    'Looks like homepage: ' + ($lc -match 'formsubmit is a form backend|formsubmit\.co')
    'Looks like activation/verification: ' + ($lc -match 'activate|activation|confirm|verification|check your inbox')
    'Looks like cloudflare challenge: ' + ($lc -match 'cloudflare|attention required|cf-ray|just a moment')

    'Body (first 400 chars):'
    $text.Substring(0, [Math]::Min(400, $text.Length))
  }
}
finally {
  if ($client) { $client.Dispose() }
  if ($handler) { $handler.Dispose() }
}
