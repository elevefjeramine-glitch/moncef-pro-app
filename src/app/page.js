"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Bot, CalendarDays, ClipboardList, MessageSquare, ShieldCheck, Star } from "lucide-react";
import TiltCard from "@/components/TiltCard";

export default function Home() {
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } } };

  return (
    <div className="landing-wrap active" style={{ overflowX: 'hidden' }}>
      <div className="mesh" />
      
      <motion.header initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20 }} className="landing-header" style={{ background: 'rgba(6,11,26,0.5)', backdropFilter: 'var(--glass)' }}>
        <div className="landing-container">
          <div className="landing-logo">🎓 Moncef <span style={{ color: 'var(--a)' }}>IA</span></div>
          <nav className="landing-nav" style={{ display: 'flex', gap: 30 }}>
            <motion.a whileHover={{ scale: 1.05, color: 'var(--a)' }} href="#features">Fonctionnalités</motion.a>
            <motion.a whileHover={{ scale: 1.05, color: 'var(--a)' }} href="#contact">Contact</motion.a>
          </nav>
          <Link href="/auth">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn">Accéder à la plateforme</motion.button>
          </Link>
        </div>
      </motion.header>

      <motion.section variants={container} initial="hidden" animate="show" className="landing-hero" id="hero" style={{ padding: '120px 20px', minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        
        {/* Glowing Orb Background */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], rotate: [0, 90, 0] }} 
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: 'absolute', top: '20%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(0,210,182,0.15) 0%, rgba(46,91,255,0.15) 50%, transparent 70%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}
        />

        <motion.div variants={item} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 30, fontSize: 13, fontWeight: 700, marginBottom: 30, display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(10px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Star size={16} color="var(--a)" /> Une nouvelle ère pour l'Éducation
        </motion.div>
        
        <motion.h2 variants={item} style={{ fontSize: 'clamp(50px, 8vw, 85px)', lineHeight: 1.05, marginBottom: 30, maxWidth: 1000, textShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1 }}>
          L'intelligence artificielle <br/>au service de votre <span style={{ background: 'linear-gradient(135deg, var(--p), var(--a), #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', paddingBottom: '10px' }}>Réussite Absolue</span>
        </motion.h2>

        <motion.p variants={item} style={{ fontSize: 22, color: 'rgba(255,255,255,0.6)', maxWidth: 650, marginBottom: 50, lineHeight: 1.6, zIndex: 1 }}>
          Transformez votre méthode de travail avec Moncef IA. Un écosystème révolutionnaire combinant IA de pointe, gestion du temps et collaboration en temps réel.
        </motion.p>
        
        {/* Grouped Button Pill */}
        <motion.div variants={item} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 1 }}>
          <Link href="/auth?tab=signup" style={{ textDecoration: 'none' }}>
            <motion.div whileHover={{ scale: 1.02 }} className="interactive" style={{ background: 'linear-gradient(135deg, var(--p), var(--a))', color: '#fff', padding: '16px 36px', borderRadius: '100px', fontWeight: 600, fontSize: 16, boxShadow: '0 4px 15px rgba(0,210,182,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Commencer Gratuitement ➜
            </motion.div>
          </Link>
          <Link href="/auth?tab=login" style={{ textDecoration: 'none' }}>
            <motion.div whileHover={{ background: 'rgba(255,255,255,0.08)' }} className="interactive" style={{ color: 'rgba(255,255,255,0.8)', padding: '16px 36px', borderRadius: '100px', fontWeight: 600, fontSize: 16, transition: 'all 0.3s' }}>
              Se Connecter
            </motion.div>
          </Link>
        </motion.div>
      </motion.section>

      <section className="landing-section" id="features" style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6 }}>
          <h2 style={{ fontSize: 40, marginBottom: 16 }}>Nos <span style={{ color: 'var(--a)' }}>Fonctionnalités</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 60, fontSize: 18 }}>Une suite absolue d'outils redéfinissant votre workflow pédagogique</p>
        </motion.div>

        <div className="features-grid">
          <FeatureCard icon={<Bot size={32} />} title="Moncef IA" desc="Assistance complète avec explication détaillée et corrections personnalisées par le LLM Claude Haiku." list={["Réponses intelligentes 24/7", "Explications détaillées", "Révisions personnalisées"]} delay={0.1} />
          <FeatureCard icon={<CalendarDays size={32} />} title="Emploi du Temps" desc="Gestion absolue de votre emploi du temps avec synchronisation automatique." list={["Semaines A/B automatiques", "Synchronisation en temps réel", "Impressions intelligentes"]} delay={0.2} />
          <FeatureCard icon={<ClipboardList size={32} />} title="Homework Tracker" desc="Suivi complet de vos devoirs avec analyse IA et rappels automatiques." list={["Extraction automatique", "Priorités intelligentes", "Historique de productivité"]} delay={0.3} />
          <FeatureCard icon={<MessageSquare size={32} />} title="Messagerie Interne" desc="Plateforme de discussion privée sécurisée pour collaborer avec vos pairs." list={["Chiffrement en temps réel", "Base de données SQL", "Notifications Push"]} delay={0.4} />
          <FeatureCard icon={<ShieldCheck size={32} color="var(--gold)" />} title="Sécurité Supabase" desc="Infrastructure Entreprise avec authentification OAuth et protection RLS." list={["Row Level Security", "OAuth Google / Apple", "Intégrité des données"]} premium delay={0.5} />
        </div>
      </section>

      <footer className="landing-footer" id="contact" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.8)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
          <h4 style={{ color: 'var(--a)', fontSize: 24, marginBottom: 10, fontFamily: 'Cinzel' }}>🎓 Moncef IA</h4>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 30 }}>Créé avec passion par Amine FJER. © 2026 Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc, list, premium = false, delay }) {
  return (
    <TiltCard delay={delay} className={`feature-card interactive ${premium ? 'premium' : ''}`} style={{ background: premium ? 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.02))' : 'rgba(255,255,255,0.02)' }}>
      {premium && <div className="premium-badge">ALPHA</div>}
      <div className="feature-icon" style={{ color: premium ? 'var(--gold)' : 'var(--p)', marginBottom: 20 }}>{icon}</div>
      <h3 style={{ fontSize: 22, color: premium ? 'var(--gold)' : '#fff', marginBottom: 12 }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 20 }}>{desc}</p>
      <ul className="feature-list" style={{ paddingLeft: 0 }}>
        {list.map((item, idx) => (
          <li key={idx} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--ok)' }}>✓</span> {item}
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}
