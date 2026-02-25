const he = {
  "tabs": {
    "home": "בית",
    "map": "מפה",
    "jobs": "משרות",
    "explore": "גילוי",
    "calendar": "יומן",
    "profile": "פרופיל"
  },
  "calendarTab": {
    "title": "יומן",
    "subtitle": "מרכז התזמון שלך הוא הפיצ'ר הבא.",
    "comingSoonTitle": "סנכרון יומן יגיע בקרוב",
    "comingSoonBody": "הטאב הזה יכלול יומן שיעורים, זמינות וסנכרון מפגשים.",
    "today": "היום",
    "hoursLabel": "שעות",
    "loading": "טוען יומן...",
    "previewShift": "תצוגה מקדימה {{delta}} ימים",
    "mode": {
      "day": "יום",
      "week": "שבוע",
      "month": "חודש"
    },
    "month": {
      "emptyTitle": "אין שיעורים בחודש הזה",
      "emptyBody": "שיעורים מאושרים לחודש הזה יופיעו כאן אוטומטית."
    },
    "empty": {
      "nonInstructorTitle": "יומן למדריכים בלבד",
      "nonInstructorBody": "כאן יוצגו שיעורים מאושרים עבור חשבונות מדריך/ה.",
      "noSessionsTitle": "עדיין אין שיעורים מאושרים",
      "noSessionsBody": "אשרו משרה בטאב המשרות והיא תופיע כאן אוטומטית."
    },
    "sync": {
      "disabled": "סנכרון כבוי",
      "syncing": "מסנכרן...",
      "synced": "סונכרן",
      "syncedAt": "סונכרן {{time}}",
      "permissionDenied": "נדרשת הרשאת יומן",
      "failed": "הסנכרון נכשל"
    },
    "footerHint": "האינטראקציות ביומן פעילות. שיעורים יוצגו לחשבונות מדריך/ה."
  },
  "tabsLayout": {
    "loading": {
      "checkingSession": "בודק סשן...",
      "negotiatingSession": "מנהל סשן Convex...",
      "loadingAccount": "טוען חשבון..."
    },
    "actions": {
      "reload": "טעינה מחדש",
      "retry": "ניסיון חוזר",
      "retrySync": "ניסיון סנכרון חוזר",
      "signOut": "התנתקות"
    },
    "errors": {
      "authInitTimeoutTitle": "תם הזמן לטעינת אימות",
      "authInitTimeoutBody": "Convex Auth לא סיים להיטען. בדקו רשת ומפתח publishable.",
      "convexAuthTimeoutTitle": "תם הזמן לאימות Convex",
      "convexAuthTimeoutBody": "Convex לא קיבל טוקן סשן תקין מ-Convex Auth. ודאו תבנית JWT בשם `convex` ואת `Convex Auth_JWT_ISSUER_DOMAIN` ב-Convex.",
      "accountQueryTimeoutTitle": "תם הזמן לשאילתת חשבון",
      "accountQueryTimeoutBody": "שאילתת המשתמש ב-Convex לא הושלמה. ודאו URL של Convex ותצורת אימות.",
      "accountSetupFailedTitle": "הקמת חשבון נכשלה",
      "accountSetupFailedBody": "לא הצלחנו לאתחל את החשבון שלכם ב-Convex.",
      "syncFailedFallback": "סנכרון חשבון המשתמש נכשל."
    }
  },
  "modal": {
    "headerTitle": "מודאל",
    "title": "זהו מסך מודאל",
    "goHome": "חזרה למסך הבית"
  },
  "language": {
    "label": "שפה",
    "english": "אנגלית",
    "hebrew": "עברית",
    "restartRequiredTitle": "נדרש אתחול",
    "restartRequiredMessage": "האפליקציה תיטען מחדש כדי להחיל פריסת RTL."
  },
  "profile": {
    "title": "פרופיל",
    "subtitle": "נהלו את העדפות החשבון וההגדרות שלכם.",
    "account": {
      "title": "סיכום חשבון",
      "nameLabel": "שם",
      "emailLabel": "אימייל",
      "roleLabel": "תפקיד",
      "memberSince": "חבר/ה מאז",
      "fallbackName": "לא הוגדר",
      "fallbackEmail": "לא הוגדר"
    },
    "roles": {
      "pending": "ממתין",
      "instructor": "מדריך/ה",
      "studio": "סטודיו",
      "admin": "מנהל/ת",
      "unknown": "לא ידוע"
    },
    "language": {
      "title": "שפה",
      "description": "בחרו את שפת האפליקציה המועדפת."
    },
    "appearance": {
      "title": "תצוגה",
      "darkMode": {
        "title": "מצב כהה",
        "description": "מעבר בין ערכת נושא בהירה לכהה.",
        "disableSystemFirst": "Disable System theme first to set a manual mode."
      },
      "themeStyle": {
        "title": "Theme style",
        "nativeDescription": "Use iOS/Android semantic dynamic colors.",
        "customDescription": "Use Queue custom brand colors across the app."
      },
      "systemTheme": {
        "title": "System theme",
        "description": "Follow iOS/Android appearance automatically."
      }
    },
    "settings": {
      "title": "הגדרות מדריך/ה",
      "loading": "...טוען את ההגדרות",
      "unavailable": "הגדרות מדריך/ה אינן זמינות עבור החשבון הזה.",
      "studioTitle": "הגדרות סטודיו",
      "studioDescription": "נהלו את פרטי הסטודיו ושיוך האזור שלכם.",
      "notifications": {
        "title": "התראות Push",
        "description": "קבלו התראות כשמתפרסמות משרות שמתאימות לכם.",
        "pushMissing": "התראות Push עדיין לא מוגדרות במכשיר הזה. אפשר להפעיל מחדש דרך האונבורדינג."
      },
      "hourly": {
        "title": "ציפיית שכר לשעה",
        "description": "ציפיית שכר אופציונלית בש\"ח.",
        "placeholder": "לדוגמה 250"
      },
      "sports": {
        "title": "תחומי ההדרכה שלכם",
        "description": "בחרו את התחומים הפעילים שאתם מלמדים.",
        "none": "No sports selected",
        "selected": "{{count}} selected"
      },
      "location": {
        "title": "מיקום ואזור",
        "instructorDescription": "הגדירו כתובת או השתמשו ב-GPS, ואז בחרו אם להוסיף את האזור שזוהה לאזורי השירות שלכם.",
        "studioDescription": "הגדירו את פרטי הסטודיו ואז חשבו את אזור השירות הרשמי לפי כתובת או GPS.",
        "addressPlaceholder": "כתובת",
        "findByAddress": "איתור לפי כתובת",
        "useGps": "שימוש ב-GPS",
        "resolvingAddress": "מאתר כתובת...",
        "resolvingGps": "מאתר GPS...",
        "detectedZone": "אזור שזוהה: {{zone}}",
        "zoneNotDetected": "האזור עדיין לא זוהה.",
        "includeDetectedZone": "הוספת האזור שזוהה",
        "includeDetectedZoneDescription": "בעת השמירה, האזור שזוהה יתווסף לאזורי השירות של המדריך/ה."
      },
      "calendar": {
        "title": "סנכרון יומן",
        "description": "בחרו איך שיעורים מאושרים יסתנכרנו ליומן במכשיר.",
        "provider": {
          "none": "ללא סנכרון",
          "google": "Google Calendar",
          "apple": "Apple Calendar"
        },
        "autoSync": "הוספה אוטומטית של שיעורים מאושרים",
        "futureNote": "Queue מסנכרנת ליומן ייעודי במכשיר. סנכרון ענן ל-Google או Apple תלוי בהגדרות החשבון במכשיר.",
        "lastConnected": "חובר בתאריך {{date}}"
      },
      "actions": {
        "save": "שמירת הגדרות",
        "saving": "...שומר"
      },
      "unsavedTitle": "יש שינויים שלא נשמרו",
      "unsavedBody": "ביצעתם עדכונים שעדיין לא נשמרו.",
      "saved": "ההגדרות נשמרו.",
      "errors": {
        "sportRequired": "בחרו לפחות תחום אחד.",
        "hourlyRatePositive": "ציפיית השכר חייבת להיות גדולה מ-0.",
        "addressRequired": "כתובת היא שדה חובה.",
        "locationResolveFailed": "איתור האזור מהמיקום נכשל.",
        "locationNativeMissing": "מודול המיקום לא זמין בבילד הזה. בנו מחדש והתקינו שוב את dev client.",
        "locationPermissionDenied": "הרשאת מיקום נדחתה.",
        "locationPermissionBlocked": "הרשאת מיקום חסומה. אפשרו מיקום בהגדרות המערכת.",
        "locationServicesDisabled": "שירותי המיקום כבויים במכשיר. הפעילו GPS ונסו שוב.",
        "locationTimeout": "בקשת המיקום נכשלה עקב Timeout. נסו שוב.",
        "locationAddressNotFound": "לא נמצאה כתובת.",
        "locationOutsideSupportedZone": "המיקום מחוץ לאזורי השירות הנתמכים.",
        "studioNameRequired": "שם סטודיו הוא שדה חובה.",
        "saveFailed": "שמירת ההגדרות נכשלה."
      },
      "autoExpire": {
        "title": "Auto-expire unfilled jobs",
        "description": "If no instructor accepts before this many minutes before lesson start, the job is auto-cancelled.",
        "value": "{{minutes}} min"
      }
    },
    "signOut": {
      "title": "סשן",
      "description": "התנתקו מהמכשיר הזה."
    }
  },
  "auth": {
    "signInTitle": "התחברות",
    "signInSubtitle": "התחברו כדי לגשת לזרימות של סטודיו ומדריך.",
    "signUpTitle": "יצירת חשבון",
    "signUpSubtitle": "צרו חשבון ואמתו כתובת אימייל.",
    "emailLabel": "אימייל",
    "emailPlaceholder": "name@example.com",
    "passwordLabel": "סיסמה",
    "passwordPlaceholder": "לפחות 8 תווים",
    "signInButton": "התחברות",
    "signingIn": "...מתחבר",
    "createAccountButton": "יצירת חשבון",
    "creatingAccount": "...יוצר חשבון",
    "codeLabel": "קוד אימות",
    "codePlaceholder": "123456",
    "verifyCodeButton": "אימות קוד",
    "phoneCodeLabel": "קוד אימות לטלפון",
    "verifyPhoneCodeButton": "אימות קוד טלפון",
    "verifyingCode": "...מאמת",
    "phoneNumberLabel": "מספר טלפון",
    "phoneNumberPlaceholder": "+972501234567",
    "sendPhoneCodeButton": "שליחת קוד לטלפון",
    "sendingPhoneCode": "...שולח קוד",
    "phoneNumberRequiredForSignUp": "לחשבון הזה נדרש מספר טלפון. הוסיפו מספר כדי להמשיך.",
    "goToSignUp": "אין לכם חשבון? הירשמו",
    "goToSignIn": "יש לכם חשבון? התחברו",
    "additionalStepRequired": "נדרש שלב אימות נוסף.",
    "additionalStepRequiredWithStatus": "נדרש שלב אימות נוסף (סטטוס: {{status}}).",
    "sessionTaskPending": "לסשן נדרש שלב נוסף ב-Convex Auth (משימה: {{task}}).",
    "secondFactorUnavailable": "נדרש אימות דו-שלבי, אבל לא נמצאה שיטה נתמכת.",
    "unexpectedError": "אירעה שגיאה. נסו שוב.",
    "accountSectionTitle": "חשבון",
    "signOutButton": "התנתקות",
    "signInWithGoogle": "Continue with Google",
    "signUpWithGoogle": "Sign up with Google",
    "signInWithApple": "Continue with Apple",
    "or": "or",
    "methodPassword": "Password",
    "methodEmailCode": "Email OTP",
    "methodPhoneCode": "Phone OTP",
    "identifierLabel": "Email",
    "identifierPlaceholder": "name@example.com",
    "sendCodeButton": "Send code",
    "magicLinkUnavailableNative": "Email magic links are not supported in Expo native apps, so this flow uses one-time codes.",
    "backToSignInMethods": "Back to sign-in methods",
    "backToSignUpDetails": "Back to account details",
    "oauthCancelled": "Google sign-in was cancelled.",
    "oauthFailed": "Google sign-in failed. Please try again.",
    "sessionActivationFailed": "Could not activate your session. Please sign in after verification."
  },
  "onboarding": {
    "loading": "...טוען הגדרת פרופיל",
    "title": "בניית פרופיל",
    "subtitle": "בחרו תפקיד והשלימו את הפרופיל בכמה צעדים קצרים.",
    "rolePrompt": "אני מצטרף/ת כ:",
    "roleInstructorTitle": "מדריך/ה",
    "roleInstructorDescription": "מציאת שיעורים פתוחים לפי תחומים ואזורי הגעה.",
    "roleStudioTitle": "סטודיו",
    "roleStudioDescription": "פרסום שיעורים וגיוס מדריכים פרילנס במהירות.",
    "roleSelectHint": "בחרו תפקיד כדי להמשיך.",
    "studioDetailsTitle": "פרטי סטודיו",
    "instructorDetailsTitle": "פרטי מדריך/ה",
    "instructorStep": "שלב {{current}} מתוך {{total}}",
    "displayName": "שם להצגה",
    "bioOptional": "ביוגרפיה קצרה (אופציונלי)",
    "hourlyRateOptional": "ציפיית שכר לשעה בש״ח (אופציונלי)",
    "studioName": "שם הסטודיו",
    "studioAddress": "כתובת הסטודיו",
    "phoneOptional": "טלפון (E.164, אופציונלי)",
    "sportsTitle": "תחומי הדרכה",
    "map": {
      "instructorTitle": "מפת אזורי הדרכה",
      "instructorHint": "השתמשו ב-GPS או לחצו על אזורים כדי לבנות אזור שירות.",
      "studioTitle": "מפת מיקום הסטודיו",
      "studioHint": "השתמשו ב-GPS או לחצו על המפה כדי למקם את הסטודיו."
    },
    "location": {
      "instructorAddressOptional": "הכתובת שלכם (אופציונלי)",
      "findByAddress": "איתור לפי כתובת",
      "useGps": "שימוש ב-GPS",
      "resolvingAddress": "מאתר כתובת...",
      "resolvingGps": "מאתר GPS...",
      "detectedZone": "אזור שזוהה: {{zone}}",
      "addDetectedZone": "הוספת האזור שזוהה",
      "zonePending": "האזור ייקבע אוטומטית לפי כתובת או GPS.",
      "zoneOptionalHint": "אופציונלי: אפשר לזהות את האזור הנוכחי ולהוסיף אותו לאזורי השירות."
    },
    "zoneSearchPlaceholder": "חיפוש אזורים",
    "back": "חזרה",
    "previous": "הקודם",
    "next": "הבא",
    "save": "...שומר",
    "complete": "השלמת הגדרת פרופיל",
    "push": {
      "description": "הפעילו התראות Push כדי לקבל התראות על משרות חדשות ברגע שהן מתפרסמות.",
      "requesting": "מבקש הרשאה...",
      "enabled": "התראות מופעלות",
      "requestPermission": "הפעלת התראות Push",
      "tokenSaved": "אסימון ההתראות נשמר.",
      "permissionNotGranted": "הרשאת התראות לא אושרה. אפשר להמשיך ולהפעיל מאוחר יותר.",
      "requestFailed": "בקשת הרשאת התראות נכשלה."
    },
    "errors": {
      "roleRequired": "בחרו תפקיד כדי להמשיך.",
      "displayNameRequired": "שם להצגה הוא שדה חובה.",
      "selectAtLeastOneSport": "בחרו לפחות תחום אחד.",
      "selectAtLeastOneZone": "בחרו לפחות אזור אחד.",
      "studioNameRequired": "שם סטודיו הוא שדה חובה.",
      "studioAddressRequired": "כתובת סטודיו היא שדה חובה.",
      "selectOneServiceZone": "בחרו אזור שירות אחד.",
      "instructorAddressRequired": "יש להזין כתובת קודם.",
      "failedToResolveAddress": "איתור האזור לפי כתובת נכשל.",
      "failedToResolveGps": "איתור האזור לפי GPS נכשל.",
      "locationNativeMissing": "מודול המיקום חסר בגרסה הזו. בנו והתקינו מחדש Dev Client.",
      "locationPermissionDenied": "הרשאת מיקום נדחתה.",
      "locationPermissionBlocked": "הרשאת מיקום חסומה. אפשרו אותה בהגדרות המכשיר.",
      "locationServicesDisabled": "שירותי המיקום כבויים במכשיר. הפעילו GPS ונסו שוב.",
      "locationTimeout": "בקשת המיקום נכשלה עקב Timeout. נסו שוב.",
      "locationAddressNotFound": "לא נמצאה כתובת.",
      "locationOutsideSupportedZone": "המיקום מחוץ לאזורי השירות הנתמכים.",
      "tooManyZones": "נבחרו יותר מדי אזורים.",
      "failedToComplete": "השלמת ההגדרה נכשלה."
    }
  },
  "mapTab": {
    "loading": "...טוען את המפה",
    "title": "מפת אזורים",
    "subtitle": "עדכנו את האזורים הפעילים שלכם ישירות על המפה.",
    "searchPlaceholder": "חיפוש אזור לפי עיר, שם או מזהה",
    "show": "הצגה",
    "hide": "הסתרה",
    "save": "שמירת אזורים",
    "saving": "...שומר",
    "zoneModeOn": "מצב אזורים",
    "zoneModeOff": "בחירת אזורים",
    "zoneModeHint": "הקישו על אזור כדי להפעיל/לכבות. לחיצה 100ms מאפשרת גרירת מפה.",
    "devBuildRequiredTitle": "המפה דורשת Build לפיתוח",
    "devBuildRequiredBody": "הרכיב משתמש במודולים נייטיב שאינם זמינים ב-Expo Go. הריצו `bun run android` או Dev Client.",
    "selectedZones": "אזורים שנבחרו: {{count}}",
    "noMatchingZones": "לא נמצאו אזורים תואמים.",
    "typeToSearchHint": "התחילו להקליד לחיפוש, או גררו למטה להצגת הרשימה.",
    "noZoneSelected": "טרם נבחר אזור.",
    "webTitle": "עריכת מפה אינטראקטיבית זמינה במובייל נייטיב.",
    "webSubtitle": "ב-Web השתמשו ברשימת הבחירה כדי לעדכן אזורים.",
    "webStats": "בתצוגה: {{preview}} | נבחרו: {{selected}}",
    "errors": {
      "selectAtLeastOneZone": "בחרו לפחות אזור אחד.",
      "invalidZone": "בחירת האזור אינה תקינה.",
      "tooManyZones": "נבחרו יותר מדי אזורים.",
      "failedToSave": "שמירת בחירת האזורים נכשלה."
    }
  },
  "jobsTab": {
    "loading": "טוען משרות...",
    "title": "משרות",
    "alertsTitle": "התראות",
    "notificationsTitle": "עדכונים",
    "studioTitle": "פרסום משרת חירום",
    "studioCreateTitle": "יצירת משרה במהירות",
    "studioSubtitle": "צרו משרה והודיעו מיד למדריכים מתאימים.",
    "studioPushTitle": "הפעלת התראות Push לסטודיו",
    "studioPushDescription": "קבלו התראה מיידית כשמדריכים מגישים מועמדות לשיעורים שלכם.",
    "studioFeedTitle": "המשרות האחרונות שלכם",
    "studioApplicationsTitle": "פניות",
    "instructorSubtitle": "משרות חיות לפי אזורי השירות שלכם. אין צורך בריענון ידני.",
    "timezoneHint": "השעות מוצגות לפי אזור הזמן המקומי שלכם ({{timeZone}}).",
    "instructorSessionsTitle": "ציר השיעורים שלי",
    "currentLessonTitle": "השיעור הנוכחי",
    "liveNowTitle": "משודר עכשיו",
    "liveBadge": "באוויר",
    "upcomingBadge": "קרוב",
    "needsDoneTitle": "מחכה לסיום ({{count}})",
    "archiveTitle": "ארכיון",
    "availableJobsTitle": "משרות זמינות",
    "myApplicationsTitle": "הפניות שלי",
    "emptyInstructor": "כרגע אין משרות זמינות.",
    "emptyStudio": "עדיין לא פרסמתם משרות.",
    "emptyStudioApplications": "עדיין אין פניות למשרה הזו.",
    "emptyApplications": "עדיין לא הגשתם פניות.",
    "applicationSummary": "יש {{count}} עדכוני מועמדות שמחכים לבדיקה.",
    "emptyAlerts": "עדיין אין התראות.",
    "emptySessions": "עדיין אין שיעורים מאושרים.",
    "emptyUpcoming": "אין שיעורים קרובים.",
    "emptyArchive": "עדיין אין שיעורים שהושלמו.",
    "noNotes": "לא נוספו הערות.",
    "form": {
      "sport": "תחום",
      "startTime": "שעת התחלה",
      "endTime": "שעת סיום",
      "duration": "בחירת משך",
      "pay": "תשלום (ש\"ח)",
      "customPayPlaceholder": "סכום תשלום מותאם",
      "maxParticipants": "מספר משתתפים מקסימלי",
      "maxParticipantsHint": "לחצו +/- לעדכון מהיר.",
      "cancellationDeadlineHours": "דדליין ביטול (שעות)",
      "applicationLead": "דדליין הגשה לפני התחלה",
      "minutes": "{{value}} דק'",
      "hours": "{{value}} ש'",
      "notesPlaceholder": "פרטים אופציונליים למדריך/ה"
    },
    "card": {
      "pay": "תשלום: ₪{{value}}"
    },
    "applicationsCount": "{{total}} פניות בסך הכל • {{pending}} בהמתנה",
    "status": {
      "job": {
        "open": "פתוחה",
        "filled": "אוישה",
        "cancelled": "בוטלה",
        "completed": "הושלמה"
      },
      "application": {
        "pending": "בהמתנה",
        "accepted": "התקבלה",
        "rejected": "נדחתה",
        "withdrawn": "בוטלה"
      }
    },
    "actions": {
      "post": "פרסום משרה",
      "posting": "מפרסם...",
      "apply": "הגשת פנייה",
      "applying": "שולח...",
      "changeTime": "שינוי שעה",
      "done": "סיום",
      "accept": "אישור",
      "reject": "דחייה",
      "accepting": "מאשר...",
      "rejecting": "דוחה...",
      "markAllRead": "סימון הכל כנקרא",
      "enablePush": "הפעלת Push",
      "enablingPush": "מפעיל...",
      "setReminder": "תזכורת 30 דק׳ לפני",
      "clearReminder": "תזכורת נקבעה - ניקוי",
      "updatingReminder": "מעדכן...",
      "markLessonDone": "סימון כהושלם",
      "markingLessonDone": "מסמן..."
    },
    "success": {
      "posted": "המשרה פורסמה בהצלחה.",
      "applied": "הפנייה נשלחה.",
      "accepted": "המדריך/ה אושר/ה.",
      "rejected": "הפנייה נדחתה.",
      "pushEnabled": "התראות Push הופעלו.",
      "lessonCompleted": "השיעור סומן כהושלם.",
      "checkoutOpened": "Checkout opened. You can track updates in Payments."
    },
    "errors": {
      "sportRequired": "בחרו תחום.",
      "payRequired": "הזינו סכום תשלום תקין.",
      "startMustBeFuture": "שעת ההתחלה חייבת להיות בעתיד.",
      "endMustBeAfterStart": "שעת הסיום חייבת להיות אחרי שעת ההתחלה.",
      "applicationDeadlineMustBeFuture": "דדליין ההגשה חייב להיות עדיין בעתיד.",
      "datetimePickerUnavailable": "בורר תאריך/שעה נייטיב לא זמין בגרסה הזו. צריך לבנות מחדש Dev Client לאנדרואיד/אייפון.",
      "failedToPost": "פרסום המשרה נכשל.",
      "failedToApply": "הגשת הפנייה נכשלה.",
      "failedToReview": "בדיקת הפנייה נכשלה.",
      "failedToMarkAlertsRead": "סימון ההתראות כנקראו נכשל.",
      "pushPermissionRequired": "נדרשת הרשאת התראות כדי להפעיל Push עבור הסטודיו.",
      "failedToEnablePush": "הפעלת התראות Push לסטודיו נכשלה.",
      "failedToSetReminder": "עדכון תזכורת השיעור נכשל.",
      "failedToMarkLessonDone": "סימון השיעור כהושלם נכשל.",
      "failedToStartCheckout": "Failed to start checkout."
    },
    "searchPlaceholder": "Search jobs",
    "noJobsFound": "No jobs found",
    "tryDifferentSearchOrTimeFilter": "Try a different search or time filter.",
    "filters": {
      "anyTime": "Any time",
      "next24h": "Next 24h",
      "next72h": "Next 72h"
    }
  },
  "home": {
    "loading": "...טוענים את לוח הבית",
    "actions": {
      "jobsTitle": "משרות",
      "jobsSubtitle": "{{count}} התאמות פתוחות",
      "jobsSubtitleOverflow": "{{count}}+ התאמות פתוחות",
      "studioJobsSubtitle": "{{count}} משרות פתוחות",
      "calendarTitle": "יומן",
      "calendarSubtitle": "{{count}} שיעורים במעקב"
    },
    "shared": {
      "unknownName": "מאמן/ת",
      "memberSince": "חבר/ה מאז {{date}}"
    },
    "instructor": {
      "title": "בית",
      "subtitle": "תמונת מצב רגועה של יום ההדרכה שלך.",
      "greeting": "היי {{name}}, הלוח שלך נראה מעולה.",
      "stats": {
        "jobsTakenLabel": "עבודות שנלקחו",
        "jobsTakenHint": "שיעורים שהתקבלו",
        "earnedLabel": "הכנסה",
        "earnedHint": "משיעורים שהושלמו",
        "pendingLabel": "בקשות ממתינות",
        "pendingHint": "ממתין לאישור סטודיו",
        "matchesLabel": "התאמות פתוחות",
        "acceptanceHint": "{{rate}}% אחוז קבלה"
      },
      "nextTitle": "שיעורים קרובים",
      "nextSubtitle": "השיעורים המאושרים הבאים שלך.",
      "noUpcoming": "אין עדיין שיעורים קרובים. שווה לבדוק התאמות פתוחות."
    },
    "studio": {
      "title": "בית",
      "subtitle": "מבט מהיר על לוח הגיוס של הסטודיו.",
      "greeting": "{{name}}, לוח הבקרה של הסטודיו מוכן.",
      "stats": {
        "postedLabel": "משרות שפורסמו",
        "postedHint": "סך כל המשרות שנוצרו",
        "openLabel": "פתוחות עכשיו",
        "openHint": "עדיין מקבלות מועמדים",
        "pendingLabel": "מועמדים ממתינים",
        "pendingHint": "מחכה לבדיקה שלך",
        "budgetLabel": "תקציב פתוח",
        "budgetHint": "תשלום פוטנציאלי למשרות פתוחות"
      },
      "recentTitle": "משרות אחרונות",
      "noRecent": "עדיין לא פורסמו משרות."
    }
  },
  "explore": {
    "title": "גילוי",
    "intro": "האפליקציה כוללת קוד דוגמה כדי להתחיל מהר.",
    "sectionRoutingTitle": "ניתוב מבוסס קבצים",
    "sectionRoutingLine1": "לאפליקציה יש שני מסכים:",
    "and": "ו-",
    "sectionRoutingLine2": "קובץ הפריסה בתוך",
    "sectionRoutingLine2End": "מגדיר את לשוניות הניווט.",
    "sectionPlatformsTitle": "תמיכה ב-Android, iOS ו-Web",
    "sectionPlatformsBody": "אפשר להריץ את הפרויקט על Android, iOS וה-Web. ב-Web לחצו w בטרמינל.",
    "sectionImagesTitle": "תמונות",
    "sectionImagesBody": "לתמונות סטטיות ניתן להשתמש בסיומות @2x ו-@3x למסכים בצפיפויות שונות.",
    "sectionThemeTitle": "מצב בהיר וכהה",
    "sectionThemeBody": "התבנית תומכת במצב בהיר וכהה. useColorScheme() מחזיר את ערכת הנושא הנוכחית.",
    "sectionAnimationsTitle": "אנימציות",
    "sectionAnimationsBody": "התבנית כוללת רכיב מונפש באמצעות react-native-reanimated.",
    "sectionAnimationsIos": "ParallaxScrollView מספק את אפקט הפרלקסה בכותרת.",
    "learnMore": "למידע נוסף"
  },
  "common": {
    "cancel": "Cancel"
  }
};

export default he;
