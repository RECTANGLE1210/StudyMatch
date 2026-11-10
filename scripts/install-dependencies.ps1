# Fallback for Google Drive mounts where npm tar extraction fails.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$installRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('studymatch-deps-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $installRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'package.json') -Destination $installRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'package-lock.json') -Destination $installRoot
Push-Location -LiteralPath $installRoot
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed in the local installation directory.' }
} finally { Pop-Location }
$dependencyTarget = Join-Path $projectRoot 'node_modules'
robocopy (Join-Path $installRoot 'node_modules') $dependencyTarget /E /MT:32 /NP /NFL /NDL /NJH /NJS /R:0 /W:0
if ($LASTEXITCODE -ge 8) { throw 'Copying dependencies into the workspace failed.' }
Write-Output "Dependencies installed at $dependencyTarget"
# Only delete the unique temporary directory created by this invocation.
$resolvedInstall = (Resolve-Path -LiteralPath $installRoot).Path
$resolvedTemp = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path.TrimEnd('\')
if ((Split-Path -Parent $resolvedInstall) -ne $resolvedTemp -or (Split-Path -Leaf $resolvedInstall) -notlike 'studymatch-deps-*') { throw 'Unexpected temporary path; cleanup aborted.' }
Remove-Item -LiteralPath $resolvedInstall -Recurse -Force
exit 0
