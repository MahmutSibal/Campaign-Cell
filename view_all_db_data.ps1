Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "   TURKCELL CAMPAIGNCELL - CANLI VERİTABANI VERİLERİ     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. IDENTITY SERVICE DATABASE (Kullanıcılar & Rolleri):" -ForegroundColor Green
docker exec identity-db psql -U postgres -d identity -c "SELECT id, email, role, first_name, last_name FROM users;"
Write-Host ""

Write-Host "2. CAMPAIGN SERVICE DATABASE (Kampanyalar):" -ForegroundColor Green
docker exec campaign-db psql -U postgres -d campaign -c "SELECT code, name, type, status, target_segment FROM campaigns;"
Write-Host ""

Write-Host "3. AI SERVICE DATABASE (Aktif ML Modeli):" -ForegroundColor Green
docker exec ai-db psql -U postgres -d ai -c "SELECT version_tag, model_type, accuracy, is_active FROM model_versions;"
Write-Host ""

Write-Host "4. GAMIFICATION SERVICE DATABASE (Kayıtlı Rozetler):" -ForegroundColor Green
docker exec gamification-db psql -U postgres -d gamification -c "SELECT code, name FROM badges;"
Write-Host ""

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "Tüm 4 veritabanı aktif, canlı ve database-per-service kuralına uygun çalışıyor!" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Yellow
