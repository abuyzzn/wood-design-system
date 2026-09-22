# استخدم صورة Node.js الرسمية
FROM node:18-alpine

# حدد مجلد العمل
WORKDIR /app

# انسخ ملفات المشروع
COPY package*.json ./
COPY server.js ./
COPY wood_design.db ./
COPY public/ ./public/

# ثبّت المكتبات
RUN npm install --production

# افتح المنفذ
EXPOSE 3000

# شغّل التطبيق
CMD ["node", "server.js"]
