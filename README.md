# صلوات‌شمار هوشمند | Cloudflare Edition

نسخه مستقل و بازسازی‌شده با معماری:
- **Cloudflare Pages** برای رابط وب و فایل‌های استاتیک
- **Cloudflare Workers** برای API
- **Cloudflare D1** برای حساب‌ها، همگام‌سازی و ختم‌های گروهی
- **Durable Objects** برای شمارنده جهانی دقیق و هماهنگ
- **Cloudflare R2** برای فایل‌های صوتی و رسانه‌ای
- **PWA** برای نصب و استفاده آفلاین
- **GitHub** برای نگهداری کد و انتشار خودکار

## ساختار پروژه

```text
public/                 رابط کاربری، PWA و فایل‌های استاتیک
worker/src/index.js     API و منطق Cloudflare Worker
worker/schema.sql       ساختار دیتابیس D1
worker/wrangler.toml    تنظیمات Worker و اتصال سرویس‌ها
```

## اجرای محلی رابط

پوشه `public` را با یک وب‌سرور استاتیک اجرا کنید. برای نمونه از افزونه Live Server استفاده کنید.
برای تست PWA و Service Worker، اجرای سایت روی `localhost` یا HTTPS لازم است.

## راه‌اندازی Cloudflare

### 1) ساخت D1

```bash
cd worker
npx wrangler d1 create salavat-smart-db
```

شناسه دیتابیس خروجی را در `wrangler.toml` جایگزین `REPLACE_WITH_D1_DATABASE_ID` کنید.

سپس:

```bash
npx wrangler d1 execute salavat-smart-db --file=schema.sql
```

### 2) ساخت R2

```bash
npx wrangler r2 bucket create salavat-audio
```

### 3) تنظیم Durable Objects

پیکربندی Durable Objects و migration در `wrangler.toml` قرار دارد. اولین انتشار Worker، کلاس `GlobalCounter` را ایجاد می‌کند.

### 4) انتشار Worker

```bash
npx wrangler deploy
```

آدرس Worker را در `public/config.js` در مقدار `API_BASE_URL` قرار دهید؛ برای مثال:

```js
window.SALAVAT_CONFIG = {
  API_BASE_URL: "https://salavat-api.YOUR-SUBDOMAIN.workers.dev"
};
```

اگر این مقدار خالی باشد، برنامه همچنان در حالت محلی کار می‌کند.

### 5) انتشار رابط با Cloudflare Pages

در داشبورد Cloudflare:
1. Workers & Pages → Create → Pages
2. اتصال مخزن GitHub
3. Build command را خالی بگذارید.
4. Build output directory را `public` قرار دهید.
5. Deploy کنید.

### 6) اتصال دامنه و CORS

در `worker/wrangler.toml` مقدار `ALLOWED_ORIGIN` را به دامنه Pages یا دامنه اختصاصی خود تغییر دهید. اگر چند دامنه دارید، منطق CORS در Worker را مطابق دامنه‌های مجاز توسعه دهید.

## اتصال GitHub

مخزن را در GitHub ایجاد و فایل‌ها را push کنید. با هر commit، Cloudflare Pages به‌صورت خودکار نسخه جدید رابط را منتشر می‌کند. Worker را می‌توان از Cloudflare یا GitHub Actions منتشر کرد؛ انتشار Worker در این بسته با Wrangler انجام می‌شود.

## حساب کاربری و امنیت

- ثبت‌نام با نام کاربری و گذرواژه انجام می‌شود.
- گذرواژه با PBKDF2 و salt تصادفی در Worker هش می‌شود.
- توکن نشست به‌صورت هش‌شده در D1 ذخیره می‌شود.
- برای انتشار عمومی، حتماً دامنه مجاز، سیاست نگهداری داده، محدودیت نرخ درخواست و مانیتورینگ را بازبینی کنید.
- این پروژه نمونه عملیاتی اولیه است؛ پیش از استفاده گسترده، آزمون امنیتی مستقل توصیه می‌شود.

## قابلیت‌ها و ملاحظات

- شمارش و تاریخچه محلی، بدون نیاز به حساب و حتی در حالت آفلاین کار می‌کند.
- همگام‌سازی ابری با ورود کاربر فعال می‌شود.
- ختم گروهی با کد دعوت انجام می‌شود.
- شمارنده جهانی با Durable Object به‌روزرسانی می‌شود.
- Worker مسیر دریافت فایل از R2 را دارد؛ فایل‌های صوتی را باید جداگانه در bucket بارگذاری کنید.
- R2 به‌صورت پیش‌فرض عمومی نیست؛ فایل‌ها از مسیر Worker ارائه می‌شوند.
- صوت ذکر از SpeechSynthesis مرورگر استفاده می‌کند؛ کیفیت و صدای عربی به سیستم‌عامل و مرورگر وابسته است.
- PWA و کش آفلاین پس از اولین بارگذاری روی HTTPS فعال می‌شوند.
- اعلان نصب فقط در مرورگرهای پشتیبان و در شرایط مجاز مرورگر نمایش داده می‌شود.
- اعلان به‌روزرسانی هنگام مشاهده نسخه جدید Service Worker نمایش داده می‌شود.

## محدودیت‌های رایگان

سهمیه‌ها و قیمت Cloudflare ممکن است تغییر کنند. قبل از انتشار عمومی، صفحه قیمت و محدودیت‌های فعلی Pages، Workers، D1، R2 و Durable Objects را در مستندات رسمی Cloudflare بررسی کنید. «رایگان نامحدود» تضمین نمی‌شود.

## مجوز

MIT — جزئیات در فایل `LICENSE`.
