param([string]$BindAddress = '127.0.0.1', [int]$Port = 8000)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath "$PSScriptRoot\.venv\Scripts\python.exe") {
    Push-Location $PSScriptRoot
    try { & "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --host $BindAddress --port $Port }
    finally { Pop-Location }
} elseif (Test-Path -LiteralPath "$PSScriptRoot\.venv\bin\python") {
    wsl --cd $PSScriptRoot -e .venv/bin/python -m uvicorn app.main:app --host $BindAddress --port $Port
} else {
    throw 'server/README.md에 따라 Python 가상환경과 의존성을 먼저 설치하세요.'
}
