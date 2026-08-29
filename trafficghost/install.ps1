# TrafficGhost — Install & Build Script
# Run this from the trafficghost/ directory via Node.js terminal

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "👻 TrafficGhost Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Core engine
Write-Host "`n📦 Installing core engine dependencies..." -ForegroundColor Yellow
Set-Location "$root\core"
npm install
npm run build
Write-Host "✅ Core engine built" -ForegroundColor Green

# Extension
Write-Host "`n📦 Installing VS Code extension dependencies..." -ForegroundColor Yellow
Set-Location "$root\extension"
npm install
npm run compile
Write-Host "✅ Extension compiled" -ForegroundColor Green

# Demo frontend
Write-Host "`n📦 Installing demo frontend dependencies..." -ForegroundColor Yellow
Set-Location "$root\demo\frontend"
npm install
Write-Host "✅ Demo frontend ready" -ForegroundColor Green

Write-Host "`n✅ TrafficGhost setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Open trafficghost/ in VS Code"
Write-Host "  2. Press F5 to launch the Extension Development Host"
Write-Host "  3. In the new window: open the 👻 TrafficGhost sidebar"
Write-Host "  4. In a terminal: cd demo/frontend && npm run dev"
Write-Host "  5. Click 📡 CAPTURE TRAFFIC → select demo/demo.har"
Write-Host "  6. Click 🚀 START MOCK"
Write-Host ""
