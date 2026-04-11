"use client";
import { createContext, useContext } from 'react';

export const LanguageContext = createContext('fr');
export const useLanguage = () => useContext(LanguageContext);

export const translations = {
  fr: {
    home: "Accueil", calendar: "Calendrier", messages: "Messagerie", settings: "Paramètres du Compte",
    dashboard: "Tableau de Bord", ai: "Intelligence Artificielle", my_schedule: "Mon Emploi du Temps", internal_msg: "Messagerie Interne",
    hello: "Bonjour", ready: "Prêt à exceller aujourd'hui ? Voici un résumé de votre activité.",
    productivity: "Productivité", remaining_hw: "Devoirs Restants", hw_list: "Liste de Devoirs",
    subject_ph: "Matière (ex: Mathématiques)", task_ph: "Travail à faire", btn_add: "Ajouter",
    loading_hw: "Chargement de votre liste...", empty_hw: "Aucun devoir enregistré. 🚀 Super ! ",
    profile: "Mon Profil", interface: "Interface", logout: "Déconnexion"
  },
  en: {
    home: "Home", calendar: "Schedule", messages: "Messages", settings: "Account Settings",
    dashboard: "Dashboard", ai: "Artificial Intelligence", my_schedule: "My Schedule", internal_msg: "Internal Messaging",
    hello: "Hello", ready: "Ready to excel today? Here is a summary of your activity.",
    productivity: "Productivity", remaining_hw: "Pending Homework", hw_list: "Homework List",
    subject_ph: "Subject (e.g. Math)", task_ph: "Task description", btn_add: "Add",
    loading_hw: "Loading your list...", empty_hw: "No pending homework. 🚀 Awesome!",
    profile: "My Profile", interface: "Interface", logout: "Log Out"
  },
  es: {
    home: "Inicio", calendar: "Calendario", messages: "Mensajes", settings: "Configuración de la cuenta",
    dashboard: "Panel de control", ai: "Inteligencia Artificial", my_schedule: "Mi Horario", internal_msg: "Mensajería Interna",
    hello: "Hola", ready: "¿Listo para brillar hoy? Aquí tienes un resumen de tu actividad.",
    productivity: "Productividad", remaining_hw: "Tareas Restantes", hw_list: "Lista de Tareas",
    subject_ph: "Materia (ej: Matemáticas)", task_ph: "Tarea a realizar", btn_add: "Añadir",
    loading_hw: "Cargando tu lista...", empty_hw: "Ninguna tarea registrada. 🚀 ¡Genial!",
    profile: "Mi Perfil", interface: "Interfaz", logout: "Cerrar sesión"
  },
  ar: {
    home: "الرئيسية", calendar: "التقويم", messages: "الرسائل", settings: "إعدادات الحساب",
    dashboard: "لوحة القيادة", ai: "الذكاء الاصطناعي", my_schedule: "جدولي الزمني", internal_msg: "المراسلة الداخلية",
    hello: "مرحباً", ready: "مستعد للتفوق اليوم؟ إليك ملخص لنشاطك.",
    productivity: "الإنتاجية", remaining_hw: "الواجبات المتبقية", hw_list: "قائمة الواجبات",
    subject_ph: "المادة (مثال: رياضيات)", task_ph: "العمل المطلوب", btn_add: "إضافة",
    loading_hw: "جاري تحميل القائمة...", empty_hw: "لا توجد واجبات مسجلة. 🚀 رائع!",
    profile: "ملفي الشخصي", interface: "الواجهة", logout: "تسجيل الخروج"
  }
};

export const t = (lang, key) => translations[lang]?.[key] || translations['fr'][key] || key;
