// src/i18n/email.ts
/* =========================================================================
   Email i18n renderer
   - Gère les emails "verify" (activation) et "reset" (mot de passe oublié)
   - La langue est transmise par le contrôleur via resolveLang(req)
   - Fallback sûr sur l’anglais (DEFAULT_EN)
   - Gère le RTL pour ar / fa (tu peux étendre si besoin)
   ========================================================================= */

export type SupportedLang =
  | "fi" | "sv" | "pl" | "da" | "fr" | "en" | "es" | "it" | "nl" | "de" | "pt"
  | "ar" | "tr" | "zh" | "ru" | "fa" | "uk" | "ro" | "ca" | "eu" | "gl" | "sq"
  | "ku" | "et" | "so" | "be" | "ja" | "ko" | "id" | "ms" | "th" | "vi" | "tl"
  | "hi" | "bn";

export type EmailKind = "verify" | "reset";

type Dict = {
  subject: string;
  heading: string;
  hello: string;
  bodyLine1_verify: string;
  bodyLine1_reset: string;
  button_verify: string;
  button_reset: string;
  notYou: string;
  expiresIn1h: string;
  thanks: string;
  help: string;   // "Need help?"
  rights: string; // "All rights reserved."
};

const RTL_LANGS = new Set<SupportedLang>(["ar", "fa"]);

// ===== Socle anglais COMPLET (garantit des strings partout) =====
const DEFAULT_EN: Dict = {
  subject: "Activate your account - izyGlam",
  heading: "Confirm your email address",
  hello: "Hello,",
  bodyLine1_verify:
    "Welcome to izyGlam 🎀! Click the button below to activate your account.",
  bodyLine1_reset:
    "You requested to reset your password for your izyGlam account. Click the button below to continue.",
  button_verify: "Activate my account",
  button_reset: "Reset my password",
  notYou: "If you didn’t request this, you can safely ignore this email.",
  expiresIn1h: "This link is valid for 1 hour.",
  thanks: "Thanks,<br>The izyGlam team",
  help: "Need help?",
  rights: "All rights reserved.",
};

// ===== Traductions partielles (fallback auto sur DEFAULT_EN) =====
const T: Record<SupportedLang, Partial<Dict>> = {
  fr: {
    subject: "Activez votre compte - izyGlam",
    heading: "Confirmez votre adresse email",
    hello: "Bonjour,",
    bodyLine1_verify:
      "Bienvenue sur izyGlam 🎀 ! Cliquez sur le bouton ci-dessous pour activer votre compte.",
    bodyLine1_reset:
      "Vous avez demandé à réinitialiser le mot de passe de votre compte izyGlam. Cliquez sur le bouton ci-dessous pour continuer.",
    button_verify: "Activer mon compte",
    button_reset: "Réinitialiser mon mot de passe",
    notYou:
      "Si vous n’êtes pas à l’origine de cette action, vous pouvez ignorer cet email.",
    expiresIn1h: "Ce lien est valable pendant 1 heure.",
    thanks: "Merci,<br>L’équipe izyGlam",
    help: "Besoin d’aide ?",
    rights: "Tous droits réservés.",
  },
  en: {
    subject: "Activate your account - izyGlam",
    heading: "Confirm your email address",
    hello: "Hello,",
    bodyLine1_verify:
      "Welcome to izyGlam 🎀! Click the button below to activate your account.",
    bodyLine1_reset:
      "You requested to reset your password for your izyGlam account. Click the button below to continue.",
    button_verify: "Activate my account",
    button_reset: "Reset my password",
    notYou:
      "If you didn’t request this, you can safely ignore this email.",
    expiresIn1h: "This link is valid for 1 hour.",
    thanks: "Thanks,<br>The izyGlam team",
    help: "Need help?",
    rights: "All rights reserved.",
  },
  es: {
    subject: "Activa tu cuenta - izyGlam",
    heading: "Confirma tu correo electrónico",
    hello: "Hola,",
    bodyLine1_verify:
      "¡Bienvenido/a a izyGlam 🎀! Haz clic en el botón de abajo para activar tu cuenta.",
    bodyLine1_reset:
      "Has solicitado restablecer tu contraseña de izyGlam. Haz clic en el botón de abajo para continuar.",
    button_verify: "Activar mi cuenta",
    button_reset: "Restablecer mi contraseña",
    notYou:
      "Si no has solicitado esta acción, puedes ignorar este correo.",
    expiresIn1h: "Este enlace es válido durante 1 hora.",
    thanks: "Gracias,<br>El equipo de izyGlam",
    help: "¿Necesitas ayuda?",
    rights: "Todos los derechos reservados.",
  },
  it: {
    subject: "Attiva il tuo account - izyGlam",
    heading: "Conferma il tuo indirizzo email",
    hello: "Ciao,",
    bodyLine1_verify:
      "Benvenuto/a su izyGlam 🎀! Clicca sul pulsante qui sotto per attivare il tuo account.",
    bodyLine1_reset:
      "Hai richiesto di reimpostare la password del tuo account izyGlam. Clicca sul pulsante qui sotto per continuare.",
    button_verify: "Attiva il mio account",
    button_reset: "Reimposta la mia password",
    notYou:
      "Se non hai richiesto questa azione, ignora questa email.",
    expiresIn1h: "Questo link è valido per 1 ora.",
    thanks: "Grazie,<br>Il team di izyGlam",
    help: "Serve aiuto?",
    rights: "Tutti i diritti riservati.",
  },
  nl: {
    subject: "Activeer je account - izyGlam",
    heading: "Bevestig je e-mailadres",
    hello: "Hallo,",
    bodyLine1_verify:
      "Welkom bij izyGlam 🎀! Klik op de knop hieronder om je account te activeren.",
    bodyLine1_reset:
      "Je hebt verzocht je wachtwoord voor je izyGlam-account te resetten. Klik op de knop hieronder om door te gaan.",
    button_verify: "Mijn account activeren",
    button_reset: "Mijn wachtwoord resetten",
    notYou:
      "Als jij dit niet hebt aangevraagd, kun je deze e-mail negeren.",
    expiresIn1h: "Deze link is 1 uur geldig.",
    thanks: "Bedankt,<br>Het izyGlam-team",
    help: "Hulp nodig?",
    rights: "Alle rechten voorbehouden.",
  },
  de: {
    subject: "Aktiviere dein Konto - izyGlam",
    heading: "Bestätige deine E-Mail-Adresse",
    hello: "Hallo,",
    bodyLine1_verify:
      "Willkommen bei izyGlam 🎀! Klicke unten, um dein Konto zu aktivieren.",
    bodyLine1_reset:
      "Du hast das Zurücksetzen deines izyGlam-Passworts angefordert. Klicke unten, um fortzufahren.",
    button_verify: "Mein Konto aktivieren",
    button_reset: "Mein Passwort zurücksetzen",
    notYou:
      "Wenn du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    expiresIn1h: "Dieser Link ist 1 Stunde gültig.",
    thanks: "Vielen Dank,<br>Dein izyGlam-Team",
    help: "Brauchst du Hilfe?",
    rights: "Alle Rechte vorbehalten.",
  },
  pt: {
    subject: "Ative sua conta - izyGlam",
    heading: "Confirme seu e-mail",
    hello: "Olá,",
    bodyLine1_verify:
      "Bem-vindo(a) ao izyGlam 🎀! Clique no botão abaixo para ativar sua conta.",
    bodyLine1_reset:
      "Você solicitou redefinir a senha da sua conta izyGlam. Clique no botão abaixo para continuar.",
    button_verify: "Ativar minha conta",
    button_reset: "Redefinir minha senha",
    notYou:
      "Se você não fez esta solicitação, ignore este e-mail.",
    expiresIn1h: "Este link é válido por 1 hora.",
    thanks: "Obrigado(a),<br>Equipe izyGlam",
    help: "Precisa de ajuda?",
    rights: "Todos os direitos reservados.",
  },
  sv: {
    subject: "Aktivera ditt konto - izyGlam",
    heading: "Bekräfta din e-postadress",
    hello: "Hej,",
    bodyLine1_verify:
      "Välkommen till izyGlam 🎀! Klicka på knappen nedan för att aktivera ditt konto.",
    bodyLine1_reset:
      "Du begärde att återställa lösenordet för ditt izyGlam-konto. Klicka nedan för att fortsätta.",
    button_verify: "Aktivera mitt konto",
    button_reset: "Återställ mitt lösenord",
    notYou:
      "Om du inte begärt detta kan du ignorera e-postmeddelandet.",
    expiresIn1h: "Länken är giltig i 1 timme.",
    thanks: "Tack,<br>izyGlam-teamet",
    help: "Behöver du hjälp?",
    rights: "Alla rättigheter förbehållna.",
  },
  da: {
    subject: "Aktivér din konto - izyGlam",
    heading: "Bekræft din e-mailadresse",
    hello: "Hej,",
    bodyLine1_verify:
      "Velkommen til izyGlam 🎀! Klik på knappen nedenfor for at aktivere din konto.",
    bodyLine1_reset:
      "Du har anmodet om at nulstille din adgangskode til izyGlam. Klik nedenfor for at fortsætte.",
    button_verify: "Aktivér min konto",
    button_reset: "Nulstil min adgangskode",
    notYou:
      "Hvis du ikke har anmodet om dette, kan du ignorere e-mailen.",
    expiresIn1h: "Dette link er gyldigt i 1 time.",
    thanks: "Tak,<br>izyGlam-teamet",
    help: "Brug for hjælp?",
    rights: "Alle rettigheder forbeholdes.",
  },
  fi: {
    subject: "Aktivoi tilisi - izyGlam",
    heading: "Vahvista sähköpostiosoitteesi",
    hello: "Hei,",
    bodyLine1_verify:
      "Tervetuloa izyGlamiin 🎀! Aktivoi tilisi painamalla alla olevaa painiketta.",
    bodyLine1_reset:
      "Pyysit izyGlam-salasanasi palauttamista. Jatka painamalla alla olevaa painiketta.",
    button_verify: "Aktivoi tilini",
    button_reset: "Palauta salasanani",
    notYou:
      "Ellet tehnyt tätä pyyntöä, voit jättää tämän viestin huomiotta.",
    expiresIn1h: "Tämä linkki on voimassa 1 tunnin.",
    thanks: "Kiitos,<br>izyGlam-tiimi",
    help: "Tarvitsetko apua?",
    rights: "Kaikki oikeudet pidätetään.",
  },
  pl: {
    subject: "Aktywuj swoje konto - izyGlam",
    heading: "Potwierdź swój adres e-mail",
    hello: "Cześć,",
    bodyLine1_verify:
      "Witamy w izyGlam 🎀! Kliknij przycisk poniżej, aby aktywować konto.",
    bodyLine1_reset:
      "Poprosiłeś(-aś) o reset hasła do konta izyGlam. Kliknij poniżej, aby kontynuować.",
    button_verify: "Aktywuj moje konto",
    button_reset: "Zresetuj moje hasło",
    notYou:
      "Jeśli to nie Ty, zignoruj tę wiadomość.",
    expiresIn1h: "Ten link jest ważny przez 1 godzinę.",
    thanks: "Dziękujemy,<br>Zespół izyGlam",
    help: "Potrzebujesz pomocy?",
    rights: "Wszelkie prawa zastrzeżone.",
  },
  ru: {
    subject: "Активируйте вашу учётную запись — izyGlam",
    heading: "Подтвердите адрес электронной почты",
    hello: "Здравствуйте,",
    bodyLine1_verify:
      "Добро пожаловать в izyGlam 🎀! Нажмите кнопку ниже, чтобы активировать учётную запись.",
    bodyLine1_reset:
      "Вы запросили сброс пароля для своей учётной записи izyGlam. Нажмите ниже, чтобы продолжить.",
    button_verify: "Активировать аккаунт",
    button_reset: "Сбросить пароль",
    notYou:
      "Если это были не вы, просто игнорируйте это письмо.",
    expiresIn1h: "Ссылка действительна в течение 1 часа.",
    thanks: "Спасибо,<br>Команда izyGlam",
    help: "Нужна помощь?",
    rights: "Все права защищены.",
  },
  ar: {
    subject: "تفعيل حسابك - izyGlam",
    heading: "أكد عنوان بريدك الإلكتروني",
    hello: "مرحبًا،",
    bodyLine1_verify:
      "مرحبًا بك في 🎀 izyGlam! اضغط الزر أدناه لتفعيل حسابك.",
    bodyLine1_reset:
      "لقد طلبت إعادة تعيين كلمة المرور لحسابك على izyGlam. اضغط الزر أدناه للمتابعة.",
    button_verify: "تفعيل حسابي",
    button_reset: "إعادة تعيين كلمة المرور",
    notYou:
      "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.",
    expiresIn1h: "هذا الرابط صالح لمدة ساعة واحدة.",
    thanks: "شكرًا لك،<br>فريق izyGlam",
    help: "هل تحتاج إلى مساعدة؟",
    rights: "جميع الحقوق محفوظة.",
  },
  tr: {
    subject: "Hesabını etkinleştir - izyGlam",
    heading: "E-posta adresini doğrula",
    hello: "Merhaba,",
    bodyLine1_verify:
      "izyGlam 🎀’a hoş geldin! Hesabını etkinleştirmek için aşağıdaki düğmeye tıkla.",
    bodyLine1_reset:
      "izyGlam hesabının şifresini sıfırlamak istedin. Devam etmek için aşağıya tıkla.",
    button_verify: "Hesabımı etkinleştir",
    button_reset: "Şifremi sıfırla",
    notYou:
      "Bunu sen istemediysen bu e-postayı yok sayabilirsin.",
    expiresIn1h: "Bu bağlantı 1 saat geçerlidir.",
    thanks: "Teşekkürler,<br>izyGlam ekibi",
    help: "Yardıma mı ihtiyacın var?",
    rights: "Tüm hakları saklıdır.",
  },
  zh: {
    subject: "激活您的账户 - izyGlam",
    heading: "确认您的邮箱",
    hello: "您好，",
    bodyLine1_verify:
      "欢迎使用 izyGlam 🎀！点击下方按钮激活您的账户。",
    bodyLine1_reset:
      "您申请重置 izyGlam 账户的密码。请点击下方按钮继续。",
    button_verify: "激活我的账户",
    button_reset: "重置我的密码",
    notYou:
      "如果并非您本人操作，请忽略本邮件。",
    expiresIn1h: "该链接在 1 小时内有效。",
    thanks: "谢谢，<br>izyGlam 团队",
    help: "需要帮助？",
    rights: "版权所有。",
  },
  fa: {
    subject: "فعالسازی حساب کاربری - izyGlam",
    heading: "ایمیل خود را تأیید کنید",
    hello: "سلام،",
    bodyLine1_verify:
      "به 🎀 izyGlam خوش آمدید! برای فعال‌سازی حساب خود روی دکمه زیر کلیک کنید.",
    bodyLine1_reset:
      "درخواست بازنشانی رمز عبور حساب izyGlam خود را ارسال کرده‌اید. برای ادامه روی دکمه زیر کلیک کنید.",
    button_verify: "فعالسازی حساب",
    button_reset: "بازنشانی رمز عبور",
    notYou:
      "اگر این درخواست از طرف شما نبوده است، این ایمیل را نادیده بگیرید.",
    expiresIn1h: "این لینک به مدت ۱ ساعت معتبر است.",
    thanks: "با سپاس،<br>تیم izyGlam",
    help: "کمک لازم دارید؟",
    rights: "کلیه حقوق محفوظ است.",
  },
  uk: {
    subject: "Активуйте обліковий запис — izyGlam",
    heading: "Підтвердьте адресу електронної пошти",
    hello: "Вітаємо,",
    bodyLine1_verify:
      "Ласкаво просимо до izyGlam 🎀! Натисніть кнопку нижче, щоб активувати обліковий запис.",
    bodyLine1_reset:
      "Ви запросили скидання пароля для облікового запису izyGlam. Натисніть нижче, щоб продовжити.",
    button_verify: "Активувати мій обліковий запис",
    button_reset: "Скинути мій пароль",
    notYou:
      "Якщо це зробили не ви, просто ігноруйте цей лист.",
    expiresIn1h: "Посилання дійсне протягом 1 години.",
    thanks: "Дякуємо,<br>Команда izyGlam",
    help: "Потрібна допомога?",
    rights: "Усі права захищено.",
  },
  ro: {
    subject: "Activează-ți contul - izyGlam",
    heading: "Confirmă adresa de email",
    hello: "Bună,",
    bodyLine1_verify:
      "Bine ai venit la izyGlam 🎀! Dă clic mai jos pentru a-ți activa contul.",
    bodyLine1_reset:
      "Ai solicitat resetarea parolei contului tău izyGlam. Click mai jos pentru a continua.",
    button_verify: "Activează-mi contul",
    button_reset: "Resetează-mi parola",
    notYou:
      "Dacă nu tu ai făcut această solicitare, ignoră acest email.",
    expiresIn1h: "Acest link este valabil 1 oră.",
    thanks: "Mulțumim,<br>Echipa izyGlam",
    help: "Ai nevoie de ajutor?",
    rights: "Toate drepturile rezervate.",
  },
  ca: {
    subject: "Activa el teu compte - izyGlam",
    heading: "Confirma la teva adreça de correu",
    hello: "Hola,",
    bodyLine1_verify:
      "Benvingut/da a izyGlam 🎀! Fes clic al botó de sota per activar el teu compte.",
    bodyLine1_reset:
      "Has sol·licitat restablir la contrasenya del teu compte izyGlam. Fes clic a sota per continuar.",
    button_verify: "Activar el meu compte",
    button_reset: "Restablir la meva contrasenya",
    notYou:
      "Si no has fet aquesta sol·licitud, ignora aquest correu.",
    expiresIn1h: "Aquest enllaç és vàlid durant 1 hora.",
    thanks: "Gràcies,<br>L’equip d’izyGlam",
    help: "Necessites ajuda?",
    rights: "Tots els drets reservats.",
  },
  gl: {
    subject: "Activa a túa conta - izyGlam",
    heading: "Confirma o teu correo electrónico",
    hello: "Ola,",
    bodyLine1_verify:
      "Benvido/a a izyGlam 🎀! Preme no botón de abaixo para activar a túa conta.",
    bodyLine1_reset:
      "Solicitaches restablecer o contrasinal da túa conta de izyGlam. Preme abaixo para continuar.",
    button_verify: "Activar a miña conta",
    button_reset: "Restablecer o meu contrasinal",
    notYou:
      "Se non fixeches ti esta solicitude, ignora este correo.",
    expiresIn1h: "Esta ligazón é válida durante 1 hora.",
    thanks: "Grazas,<br>O equipo de izyGlam",
    help: "Precisas axuda?",
    rights: "Tódolos dereitos reservados.",
  },
  eu: {
    subject: "Aktibatu zure kontua - izyGlam",
    heading: "Baieztatu zure posta elektronikoa",
    hello: "Kaixo,",
    bodyLine1_verify:
      "Ongi etorri izyGlam-era 🎀! Egin klik beheko botoian zure kontua aktibatzeko.",
    bodyLine1_reset:
      "Zure izyGlam kontuaren pasahitza berrezartzea eskatu duzu. Jarraitzeko sakatu behean.",
    button_verify: "Nire kontua aktibatu",
    button_reset: "Nire pasahitza berrezarri",
    notYou:
      "Zuk ez bazenuen eskatu, ez ikusi egin mezu honi.",
    expiresIn1h: "Esteka hau ordubetez da baliozkoa.",
    thanks: "Eskerrik asko,<br>izyGlam taldea",
    help: "Laguntza behar?",
    rights: "Eskubide guztiak erreserbatuta.",
  },
  sq: {
    subject: "Aktivizo llogarinë tënde - izyGlam",
    heading: "Konfirmo adresën tënde të emailit",
    hello: "Përshëndetje,",
    bodyLine1_verify:
      "Mirë se erdhe në izyGlam 🎀! Kliko poshtë për të aktivizuar llogarinë.",
    bodyLine1_reset:
      "Kërkove rivendosjen e fjalëkalimit për llogarinë tënde izyGlam. Kliko poshtë për të vazhduar.",
    button_verify: "Aktivizo llogarinë time",
    button_reset: "Rivendos fjalëkalimin",
    notYou:
      "Nëse nuk e ke kërkuar ti, injoroje këtë email.",
    expiresIn1h: "Kjo lidhje është e vlefshme për 1 orë.",
    thanks: "Faleminderit,<br>ekipi i izyGlam",
    help: "Ke nevojë për ndihmë?",
    rights: "Të gjitha të drejtat të rezervuara.",
  },
  // Kurde Kurmanji (LTR)
  ku: {
    subject: "Hesabê xwe çalak bike - izyGlam",
    heading: "Navnîşana e-peyamê xwe piştrast bike",
    hello: "Silav,",
    bodyLine1_verify:
      "Bi xêr hatî izyGlam 🎀! Ji bo çalakirikandina hesabê xwe li jêr bikirtînin.",
    bodyLine1_reset:
      "Tu daxwaza nûkirina şîfreyê hesabê xwe ya izyGlam kirî. Ji bo domandinê li jêr bikirtînin.",
    button_verify: "Hesabê min çalak bike",
    button_reset: "Şîfreyê min nû bike",
    notYou:
      "Heke ev tu ne bû, dikarî vê e-peyamê neyarî.",
    expiresIn1h: "Ev girêdan 1 saet derbasdar e.",
    thanks: "Spas,<br>komelay ê izyGlam",
    help: "Pîvanek hewce heye?",
    rights: "Hemû maf parastî ye.",
  },
  et: {
    subject: "Aktiveeri oma konto - izyGlam",
    heading: "Kinnita oma e-posti aadress",
    hello: "Tere,",
    bodyLine1_verify:
      "Tere tulemast izyGlam’i 🎀! Klõpsa alloleval nupul, et konto aktiveerida.",
    bodyLine1_reset:
      "Taotlesid izyGlam’i konto parooli taastamist. Jätkamiseks klõpsa all.",
    button_verify: "Aktiveeri minu konto",
    button_reset: "Taasta minu parool",
    notYou:
      "Kui see polnud sina, võid selle kirja tähelepanuta jätta.",
    expiresIn1h: "Link kehtib 1 tund.",
    thanks: "Aitäh,<br>izyGlam’i meeskond",
    help: "Vajad abi?",
    rights: "Kõik õigused kaitstud.",
  },
  so: {
    subject: "Fur akoonkaaga - izyGlam",
    heading: "Xaqiiji cinwaanka iimaylka",
    hello: "Salaan,",
    bodyLine1_verify:
      "Ku soo dhawoow izyGlam 🎀! Riix badhanka hoose si aad u hawlgeliso akoonkaaga.",
    bodyLine1_reset:
      "Waxaad codsatay in dib loo dejiyo erayga sirta ah ee akoonkaaga izyGlam. Riix hoose si aad u sii waddo.",
    button_verify: "Hawl geli akoonkayga",
    button_reset: "Dib u deji erayga sirta ah",
    notYou:
      "Haddii aadan adigu codsan, iska iloow iimaylkan.",
    expiresIn1h: "Isku xirkaan wuxuu shaqaynayaa 1 saac.",
    thanks: "Mahadsanid,<br>Kooxda izyGlam",
    help: "Caawin ma u baahan tahay?",
    rights: "Dhammaan xuquuqda way xafidan yihiin.",
  },
  be: {
    subject: "Актывуйце свой уліковы запіс — izyGlam",
    heading: "Пацвердзіце адрас электроннай пошты",
    hello: "Вітаем,",
    bodyLine1_verify:
      "Сардэчна запрашаем у izyGlam 🎀! Націсніце кнопку ніжэй, каб актываваць уліковы запіс.",
    bodyLine1_reset:
      "Вы запыталі скід пароля для ўліковага запісу izyGlam. Націсніце ніжэй, каб працягнуць.",
    button_verify: "Актываваць мой уліковы запіс",
    button_reset: "Скінуць мой пароль",
    notYou:
      "Калі гэта не вы, проста ігнаруйце гэта пісьмо.",
    expiresIn1h: "Спасылка дзейнічае 1 гадзіну.",
    thanks: "Дзякуй,<br>Каманда izyGlam",
    help: "Патрэбна дапамога?",
    rights: "Усе правы абаронены.",
  },
  ja: {
    subject: "アカウントを有効化 - izyGlam",
    heading: "メールアドレスを確認してください",
    hello: "こんにちは、",
    bodyLine1_verify:
      "izyGlam 🎀 へようこそ！下のボタンをクリックしてアカウントを有効化してください。",
    bodyLine1_reset:
      "izyGlam アカウントのパスワード再設定をリクエストしました。続行するには下のボタンをクリックしてください。",
    button_verify: "アカウントを有効化",
    button_reset: "パスワードを再設定",
    notYou:
      "心当たりがない場合は、このメールは破棄してください。",
    expiresIn1h: "このリンクは1時間有効です。",
    thanks: "よろしくお願いします。<br>izyGlam チーム",
    help: "お困りですか？",
    rights: "無断転載を禁じます。",
  },
  ko: {
    subject: "계정 활성화 - izyGlam",
    heading: "이메일 주소를 확인하세요",
    hello: "안녕하세요,",
    bodyLine1_verify:
      "izyGlam 🎀에 오신 것을 환영합니다! 아래 버튼을 눌러 계정을 활성화하세요.",
    bodyLine1_reset:
      "izyGlam 계정의 비밀번호 재설정을 요청하셨습니다. 계속하려면 아래 버튼을 누르세요.",
    button_verify: "내 계정 활성화",
    button_reset: "비밀번호 재설정",
    notYou:
      "본인이 요청하지 않았다면 이 이메일은 무시하셔도 됩니다.",
    expiresIn1h: "이 링크는 1시간 동안 유효합니다.",
    thanks: "감사합니다.<br>izyGlam 팀",
    help: "도움이 필요하신가요?",
    rights: "판권 소유.",
  },
  id: {
    subject: "Aktifkan akun Anda - izyGlam",
    heading: "Konfirmasi alamat email Anda",
    hello: "Halo,",
    bodyLine1_verify:
      "Selamat datang di izyGlam 🎀! Klik tombol di bawah untuk mengaktifkan akun Anda.",
    bodyLine1_reset:
      "Anda meminta pengaturan ulang kata sandi akun izyGlam Anda. Klik tombol di bawah untuk melanjutkan.",
    button_verify: "Aktifkan akun saya",
    button_reset: "Atur ulang kata sandi saya",
    notYou:
      "Jika ini bukan permintaan Anda, abaikan email ini.",
    expiresIn1h: "Tautan ini berlaku selama 1 jam.",
    thanks: "Terima kasih,<br>Tim izyGlam",
    help: "Butuh bantuan?",
    rights: "Seluruh hak cipta dilindungi.",
  },
  ms: {
    subject: "Aktifkan akaun anda - izyGlam",
    heading: "Sahkan alamat e-mel anda",
    hello: "Hai,",
    bodyLine1_verify:
      "Selamat datang ke izyGlam 🎀! Klik butang di bawah untuk mengaktifkan akaun anda.",
    bodyLine1_reset:
      "Anda meminta untuk menetapkan semula kata laluan akaun izyGlam anda. Klik di bawah untuk meneruskan.",
    button_verify: "Aktifkan akaun saya",
    button_reset: "Tetapkan semula kata laluan saya",
    notYou:
      "Jika ini bukan permintaan anda, abaikan e-mel ini.",
    expiresIn1h: "Pautan ini sah selama 1 jam.",
    thanks: "Terima kasih,<br>Pasukan izyGlam",
    help: "Perlukan bantuan?",
    rights: "Hak cipta terpelihara.",
  },
  th: {
    subject: "เปิดใช้งานบัญชีของคุณ - izyGlam",
    heading: "ยืนยันอีเมลของคุณ",
    hello: "สวัสดี,",
    bodyLine1_verify:
      "ยินดีต้อนรับสู่ izyGlam 🎀! คลิกปุ่มด้านล่างเพื่อเปิดใช้งานบัญชีของคุณ",
    bodyLine1_reset:
      "คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี izyGlam ของคุณ คลิกปุ่มด้านล่างเพื่อดำเนินการต่อ",
    button_verify: "เปิดใช้งานบัญชีของฉัน",
    button_reset: "รีเซ็ตรหัสผ่านของฉัน",
    notYou:
      "หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลฉบับนี้ได้",
    expiresIn1h: "ลิงก์นี้มีผลเป็นเวลา 1 ชั่วโมง",
    thanks: "ขอบคุณ,<br>ทีมงาน izyGlam",
    help: "ต้องการความช่วยเหลือ?",
    rights: "สงวนลิขสิทธิ์.",
  },
  vi: {
    subject: "Kích hoạt tài khoản - izyGlam",
    heading: "Xác nhận địa chỉ email của bạn",
    hello: "Xin chào,",
    bodyLine1_verify:
      "Chào mừng đến với izyGlam 🎀! Nhấn nút bên dưới để kích hoạt tài khoản.",
    bodyLine1_reset:
      "Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản izyGlam. Nhấn nút bên dưới để tiếp tục.",
    button_verify: "Kích hoạt tài khoản của tôi",
    button_reset: "Đặt lại mật khẩu của tôi",
    notYou:
      "Nếu không phải bạn yêu cầu, vui lòng bỏ qua email này.",
    expiresIn1h: "Liên kết có hiệu lực trong 1 giờ.",
    thanks: "Cảm ơn,<br>Đội ngũ izyGlam",
    help: "Cần trợ giúp?",
    rights: "Bảo lưu mọi quyền.",
  },
  tl: {
    subject: "I-activate ang iyong account - izyGlam",
    heading: "Kumpirmahin ang iyong email address",
    hello: "Kumusta,",
    bodyLine1_verify:
      "Maligayang pagdating sa izyGlam 🎀! I-click ang button sa ibaba upang i-activate ang iyong account.",
    bodyLine1_reset:
      "Humiling ka ng pag-reset ng password para sa iyong izyGlam account. I-click ang ibaba upang magpatuloy.",
    button_verify: "I-activate ang aking account",
    button_reset: "I-reset ang aking password",
    notYou:
      "Kung hindi ikaw ang humiling, maaari mong balewalain ang email na ito.",
    expiresIn1h: "Balido ang link sa loob ng 1 oras.",
    thanks: "Salamat,<br>izyGlam team",
    help: "Kailangan ng tulong?",
    rights: "Lahat ng karapatan ay nakalaan.",
  },
  hi: {
    subject: "अपना खाता सक्रिय करें - izyGlam",
    heading: "अपना ईमेल पता सत्यापित करें",
    hello: "नमस्ते,",
    bodyLine1_verify:
      "izyGlam 🎀 में आपका स्वागत है! अपना खाता सक्रिय करने के लिए नीचे दिए बटन पर क्लिक करें।",
    bodyLine1_reset:
      "आपने अपने izyGlam खाते का पासवर्ड रीसेट करने का अनुरोध किया है। जारी रखने के लिए नीचे क्लिक करें।",
    button_verify: "मेरा खाता सक्रिय करें",
    button_reset: "मेरा पासवर्ड रीसेट करें",
    notYou:
      "यदि यह अनुरोध आपने नहीं किया है, तो इस ईमेल को अनदेखा करें।",
    expiresIn1h: "यह लिंक 1 घंटे तक मान्य है।",
    thanks: "धन्यवाद,<br>izyGlam टीम",
    help: "मदद चाहिए?",
    rights: "सर्वाधिकार सुरक्षित.",
  },
  bn: {
    subject: "আপনার অ্যাকাউন্ট সক্রিয় করুন - izyGlam",
    heading: "আপনার ইমেইল যাচাই করুন",
    hello: "হ্যালো,",
    bodyLine1_verify:
      "izyGlam 🎀-এ স্বাগতম! আপনার অ্যাকাউন্ট সক্রিয় করতে নিচের বোতামে ক্লিক করুন।",
    bodyLine1_reset:
      "আপনি আপনার izyGlam অ্যাকাউন্টের পাসওয়ার্ড রিসেট করতে অনুরোধ করেছেন। চালিয়ে যেতে নিচে ক্লিক করুন।",
    button_verify: "আমার অ্যাকাউন্ট সক্রিয় করুন",
    button_reset: "আমার পাসওয়ার্ড রিসেট করুন",
    notYou:
      "যদি এটি আপনি না করে থাকেন, তবে এই ইমেইলটি উপেক্ষা করুন।",
    expiresIn1h: "এই লিংক ১ ঘণ্টা পর্যন্ত বৈধ।",
    thanks: "ধন্যবাদ,<br>izyGlam টিম",
    help: "সাহায্য দরকার?",
    rights: "সমস্ত অধিকার সংরক্ষিত।",
  },
};

/** Merge avec fallback EN (toujours des strings, jamais undefined) */
function pickDict(lang: SupportedLang): Dict {
  const base = DEFAULT_EN;
  const loc: Partial<Dict> = T[lang] || {};
  return {
    subject:          loc.subject          ?? base.subject,
    heading:          loc.heading          ?? base.heading,
    hello:            loc.hello            ?? base.hello,
    bodyLine1_verify: loc.bodyLine1_verify ?? base.bodyLine1_verify,
    bodyLine1_reset:  loc.bodyLine1_reset  ?? base.bodyLine1_reset,
    button_verify:    loc.button_verify    ?? base.button_verify,
    button_reset:     loc.button_reset     ?? base.button_reset,
    notYou:           loc.notYou           ?? base.notYou,
    expiresIn1h:      loc.expiresIn1h      ?? base.expiresIn1h,
    thanks:           loc.thanks           ?? base.thanks,
    help:             loc.help             ?? base.help,
    rights:           loc.rights           ?? base.rights,
  };
}

/**
 * Rend l'HTML de l'email + retourne le subject.
 * kind: "verify" | "reset"
 * lang: code langue SupportedLang
 * actionLink: URL du bouton
 * currentYear: année de copyright (ex: new Date().getFullYear())
 * logoCid: CID à utiliser pour <img src="cid:...">
 */
export function renderEmailHTML(
  kind: EmailKind,
  lang: SupportedLang,
  actionLink: string,
  currentYear: number,
  logoCid: string = "logo"
) {
  const L = pickDict(lang);
  const isRTL = RTL_LANGS.has(lang);
  const dir = isRTL ? "rtl" : "ltr";
  const btnText = kind === "verify" ? L.button_verify : L.button_reset;
  const bodyLine = kind === "verify" ? L.bodyLine1_verify : L.bodyLine1_reset;

  const html = `
  <!DOCTYPE html>
  <html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${L.subject}</title>
    <style>
      body { font-family: Arial, sans-serif; background:#f9f9f9; margin:0; padding:0; }
      .email-container { max-width:600px; margin:20px auto; background:#fff; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,.1); overflow:hidden; }
      .header { background:linear-gradient(90deg,#ff95c1ff,#ffdcecff); padding:20px; text-align:center; }
      .header img { max-width:150px; }
      .content { padding:20px; color:#333; text-align:${isRTL ? "right" : "left"}; }
      .content h1 { color:#ff8fbeff; font-size:24px; margin-bottom:10px; }
      .content p { font-size:16px; line-height:1.6; margin-bottom:20px; }
      .button-container { text-align:center; margin:20px 0; }
      .button { display:inline-block; padding:15px 20px; font-size:16px; color:#fff !important; background:linear-gradient(90deg,#ffdcecff,#ff95c1ff); text-decoration:none; border-radius:5px; font-weight:bold; }
      .button:hover { opacity:.9; }
      .footer { text-align:center; background:#f4f4f4; padding:10px; color:#888; font-size:14px; }
      .footer a { color:#ff8fbeff; text-decoration:none; }
      .footer a:hover { text-decoration:underline; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <img src="cid:${logoCid}" alt="izyGlam Logo"/>
      </div>
      <div class="content">
        <h1>${L.heading}</h1>
        <p>${L.hello}</p>
        <p>${bodyLine}</p>
        <div class="button-container">
          <a class="button" href="${actionLink}" target="_blank" rel="noreferrer noopener">${btnText}</a>
        </div>
        <p>${L.expiresIn1h} ${L.notYou}</p>
        <p>${L.thanks}</p>
      </div>
      <div class="footer">
        <p>${L.help} <a href="mailto:support@izyglam.com">support@izyglam.com</a></p>
        <p>&copy; ${currentYear} izyGlam. ${L.rights}</p>
      </div>
    </div>
  </body>
  </html>
  `;
  return { subject: L.subject, html };
}
