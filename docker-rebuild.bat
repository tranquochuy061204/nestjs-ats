@echo off
echo ========================================================
echo       NestJS ATS - Docker Fast Rebuild Script
echo ========================================================
echo.
echo Dừng các container hiện tại...
docker-compose down

echo.
echo Xây dựng lại Image (không cache) và khởi tạo lại Container...
docker-compose build --no-cache api
docker-compose up -d --force-recreate

echo.
echo ========================================================
echo Hoàn tất! Backend đang chạy nền. Bạn có thể kiểm tra
echo logs bằng lệnh: docker-compose logs -f api
echo ========================================================
pause
