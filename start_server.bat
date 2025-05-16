@echo off
echo Зміна директорії на C:\projects\sokrat-pos-backend...
cd /D C:\projects\sokrat-pos-backend

echo Запуск сервера за допомогою npx nodemon server.js...
npx nodemon server.js

echo.
echo Якщо сервер не запустився, перевірте, чи встановлено Node.js та чи є nodemon (або використовуйте node server.js).
pause