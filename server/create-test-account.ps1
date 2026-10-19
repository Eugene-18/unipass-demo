# 创建 Gmail 测试账号脚本
# 执行方式：在 server 目录下运行 .\create-test-account.ps1

Write-Host "🔄 正在创建测试账号..." -ForegroundColor Yellow

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/seed-test-user" -Method POST -ContentType "application/json"

if ($response.success) {
    Write-Host "✅ $($response.message)" -ForegroundColor Green
    Write-Host "📧 测试账号：$($response.user.email)" -ForegroundColor Cyan
    Write-Host "👤 用户名称：$($response.user.name)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 现在可以用此 Gmail 测试忘记密码功能了！" -ForegroundColor Green
} else {
    Write-Host "❌ 创建失败：$($response.message)" -ForegroundColor Red
}
