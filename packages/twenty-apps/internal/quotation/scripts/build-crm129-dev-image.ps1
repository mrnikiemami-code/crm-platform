# Build only. Never changes the running Compose project or a database.
[CmdletBinding()]
param(
  [string]$Commit = 'HEAD',
  [Parameter(Mandatory = $true)][string]$PlatformVersion
)
$ErrorActionPreference = 'Stop'
function Check-Exit([string]$Operation) {
  if ($LASTEXITCODE -ne 0) { throw "$Operation failed (exit $LASTEXITCODE)" }
}
$root = (git rev-parse --show-toplevel).Trim()
Check-Exit 'git root'
$sha = (git -C $root rev-parse --verify "$Commit^{commit}").Trim()
Check-Exit 'git commit'
if ($sha -notmatch '^[0-9a-f]{40}$') { throw 'Invalid commit' }
$image = "twenty-dev/crm129:$sha"
$checkout = Join-Path ([System.IO.Path]::GetTempPath()) ("crm129-build-" + [guid]::NewGuid().ToString('N'))
$created = $false
try {
  git -C $root worktree add --detach $checkout $sha
  Check-Exit 'clean worktree'
  $created = $true
  # Some Dev hosts sinkhole package CDNs to 127.x inside the Docker DNS path; pin public edges.
  docker build --target twenty -f (Join-Path $checkout 'packages/twenty-docker/twenty/Dockerfile') --build-arg "APP_VERSION=$PlatformVersion" --label "org.opencontainers.image.revision=$sha" --add-host 'dl-cdn.alpinelinux.org:151.101.66.132' --add-host 'registry.npmjs.org:104.16.4.34' --add-host 'registry.yarnpkg.com:104.16.7.34' -t $image $checkout
  Check-Exit 'Docker image build'
  # PowerShell mangles nested quotes in Go templates; read labels via JSON instead.
  $inspected = docker image inspect $image | ConvertFrom-Json
  Check-Exit 'image inspect'
  $revision = [string]$inspected[0].Config.Labels.'org.opencontainers.image.revision'
  if ($revision -ne $sha) { throw "Image revision mismatch: $revision" }
  $imageId = [string]$inspected[0].Id
  if ([string]::IsNullOrWhiteSpace($imageId)) { throw 'Missing image ID' }
  Write-Output "image=$imageId"
  Write-Output "CRM129_DEV_IMAGE=$image"
} finally {
  if ($created) {
    git -C $root worktree remove $checkout
    Check-Exit 'remove temporary worktree'
  }
}
