# Starts the Python API (port 8000) and the React dev server (port 5173).
$root = $PSScriptRoot
$env:PATH = "C:\Program Files\swipl\bin;$env:PATH"

Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "main:app", "--port", "8000" `
    -WorkingDirectory "$root\backend"

Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "$root\frontend"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
