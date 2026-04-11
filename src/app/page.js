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

      <section className="landing-section" id="features" style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6 }}>
          <h2 style={{ fontSize: 40, marginBottom: 16 }}>Nos <span style={{ color: 'var(--a)' }}>FONCTIONNALITÉS</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 60, fontSize: 18 }}>Une suite complète d'outils pour transformer votre expérience éducative</p>
        </motion.div>

        <div className="features-grid">
          <FeatureCard icon={<Bot size={32} />} title="Moncef IA" desc="Assistance pédagogique complète avec explications détaillées et corrections personnalisées." list={["Réponses intelligentes 24/7", "Explications détaillées", "Corrections instantanées", "Révisions personnalisées"]} delay={0.1} />
          <FeatureCard icon={<CalendarDays size={32} />} title="Emploi de Temps IA" desc="Gestion intelligente de votre emploi du temps avec synchronisation automatique." list={["Semaines A/B automatiques", "Synchronisation en temps réel", "Rappels intelligents", "Impression facile"]} delay={0.2} />
          <FeatureCard icon={<ClipboardList size={32} />} title="Homework Tracker" desc="Suivi complet de vos devoirs avec analyse IA et rappels automatiques." list={["Extraction automatique", "Priorités intelligentes", "Rappels avant échéance", "Historique complet"]} delay={0.3} />
          <FeatureCard icon={<MessageSquare size={32} />} title="Communication" desc="Plateforme de messagerie ultra-sécurisée pour collaborer avec vos camarades." list={["Messagerie instantanée", "Profils utilisateurs", "Système de parrainage", "Notifications en temps réel"]} delay={0.4} />
          <FeatureCard icon={<ShieldCheck size={32} color="var(--gold)" />} title="ALPHA AI" desc="IA exclusive au Fondateur pour la gestion avancée du site en temps réel." list={["Gestion complète du site", "Analyse des données", "Notifications globales", "Contrôle utilisateurs"]} premium delay={0.5} />
          <FeatureCard icon={<ShieldCheck size={32} />} title="Modération" desc="Outils de gestion communautaire pour les modérateurs et administrateurs." list={["Gestion des utilisateurs", "Modération du contenu", "Rapports d'activité", "Sécurité renforcée"]} delay={0.6} />
        </div>
      </section>

      <section className="landing-section" id="how-it-works" style={{ background: 'rgba(0,0,0,0.1)' }}>
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6 }}>
          <h2 style={{ fontSize: 40, marginBottom: 16 }}>COMMENT ÇA <span style={{ color: 'var(--a)' }}>MARCHE</span> ?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 60, fontSize: 18 }}>En 4 étapes simples, transformez votre expérience éducative</p>
        </motion.div>
        
        <div className="steps-grid">
          <TiltCard delay={0.1} className="step-card card">
            <div className="step-number">1</div>
            <h3 style={{ color: 'var(--a)', fontSize: 20, marginBottom: 16 }}>Créer ton compte</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Inscris-toi gratuitement en quelques secondes avec votre email</p>
          </TiltCard>
          <TiltCard delay={0.2} className="step-card card">
            <div className="step-number">2</div>
            <h3 style={{ color: 'var(--a)', fontSize: 20, marginBottom: 16 }}>Brancher ton EDT</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Importez ou créez votre emploi du temps avec l'aide de Moncef IA</p>
          </TiltCard>
          <TiltCard delay={0.3} className="step-card card">
            <div className="step-number">3</div>
            <h3 style={{ color: 'var(--a)', fontSize: 20, marginBottom: 16 }}>Laisser l'IA travailler</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Laissez Moncef IA gérer vos devoirs et vous assister dans vos études</p>
          </TiltCard>
          <TiltCard delay={0.4} className="step-card card">
            <div className="step-number">4</div>
            <h3 style={{ color: 'var(--a)', fontSize: 20, marginBottom: 16 }}>Profiter de la plateforme</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Collaborez avec d'autres étudiants et progressez ensemble</p>
          </TiltCard>
        </div>
      </section>

      <section className="landing-section" id="tiers" style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ duration: 0.6 }}>
          <h2 style={{ fontSize: 40, marginBottom: 16 }}>NIVEAUX DE <span style={{ color: 'var(--a)' }}>COMPTE</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 60, fontSize: 18 }}>Chaque utilisateur possède un rôle clair avec des droits différenciés</p>
        </motion.div>
        
        <div className="tiers-grid">
          <TierCard title="Casque Bronze" roleLevel={3} desc="Accès standard avec 100 crédits/jour régénérés toutes les 2 heures" list={["Accès à Moncef IA", "Emploi du temps", "Suivi des devoirs", "Messagerie"]} crossList={["ALPHA AI"]} delay={0.1} />
          <TierCard title="Casque Argent" roleLevel={2} desc="Modérateur avec accès illimité et crédits infinis pour modérer" list={["Tout du Bronze", "Crédits illimités", "Gestion utilisateurs", "Modération"]} crossList={["ALPHA AI"]} delay={0.2} />
          <TierCard title="Casque Or" roleLevel="👑" desc="Co-fondateur avec accès complet et contrôle du site (max 2)" list={["Tout du Modérateur", "ALPHA AI", "Gestion complète", "Analytics avancées", "Notifications globales"]} premium delay={0.3} />
        </div>
      </section>

      <section className="landing-section" id="infrastructure" style={{ background: 'radial-gradient(ellipse at bottom, rgba(46,91,255,0.1) 0%, rgba(0,0,0,0) 70%)', position: 'relative', overflow: 'hidden' }}>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} style={{ position: 'relative', zIndex: 1, marginBottom: 60 }}>
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 60px)', textTransform: 'uppercase', letterSpacing: '4px', textShadow: '0 0 40px rgba(0,210,182,0.4)', background: 'linear-gradient(to right, #ffffff, var(--a), var(--p))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 10 }}>Sécurité Inébranlable</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, maxWidth: 600, margin: '0 auto', fontFamily: 'JetBrains Mono, monospace' }}>// Propulsé par la meilleure infrastructure mondiale.</p>
        </motion.div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 30, maxWidth: 1000, margin: '0 auto', textAlign: 'left' }}>
          <TiltCard delay={0.2} style={{ background: 'rgba(25,30,40,0.6)', border: '1px solid rgba(0,210,182,0.3)', borderRadius: 24, padding: 40, boxShadow: '0 20px 40px rgba(0,210,182,0.15)' }}>
            <h3 style={{ fontSize: 28, color: 'var(--a)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldCheck size={36} /> Supabase Auth
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 20 }}>Notre base de données de niveau entreprise vous garantit que vos créations et vos notes sont toujours protégées et encryptées.</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--ok)' }}>✓</span> Row Level Security (RLS) Actif</li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--ok)' }}>✓</span> OAuth Google Haute Performance</li>
              <li style={{ padding: '8px 0', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--ok)' }}>✓</span> Base de Données PostgreSQL</li>
            </ul>
          </TiltCard>

          <TiltCard delay={0.4} style={{ background: 'rgba(25,30,40,0.6)', border: '1px solid rgba(46,91,255,0.3)', borderRadius: 24, padding: 40, boxShadow: '0 20px 40px rgba(46,91,255,0.15)' }}>
            <h3 style={{ fontSize: 28, color: 'var(--p)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Star size={36} /> Cloudflare Edge
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 20 }}>Le moteur d'Intelligence Artificielle est propulsé via le réseau P2P mondial de Cloudflare, le rendant insensible à toute surcharge locale.</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--p)' }}>✓</span> Réseau Global Anycast CDN</li>
              <li style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--p)' }}>✓</span> Protection L7 DDoS Garantie</li>
              <li style={{ padding: '8px 0', fontSize: 14, color: 'rgba(255,255,255,0.9)' }}><span style={{ color:'var(--p)' }}>✓</span> AI Proxy Workers Sécurisés</li>
            </ul>
          </TiltCard>
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
    <TiltCard delay={delay} className={`feature-card interactive ${premium ? 'premium' : ''}`} style={{ background: premium ? 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.02))' : 'rgba(255,255,255,0.02)', padding: '30px' }}>
      {premium && <div className="premium-badge">PREMIUM</div>}
      <div className="feature-icon" style={{ color: premium ? 'var(--gold)' : 'var(--p)', marginBottom: 20 }}>{icon}</div>
      <h3 style={{ fontSize: 22, color: premium ? 'var(--gold)' : '#fff', marginBottom: 12 }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 20 }}>{desc}</p>
      <ul className="feature-list" style={{ paddingLeft: 0 }}>
        {list.map((item, idx) => (
          <li key={idx} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <span style={{ color: 'var(--ok)' }}>✓</span> {item}
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}

function TierCard({ title, desc, list, crossList = [], roleLevel, premium = false, delay }) {
  const color = premium ? 'var(--gold)' : (roleLevel === 2 ? 'var(--p)' : 'var(--a)');
  return (
    <TiltCard delay={delay} className={`feature-card interactive ${premium ? 'premium' : ''}`} style={{ background: premium ? 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.02))' : 'rgba(255,255,255,0.02)', padding: '40px 30px' }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: `rgba(255,255,255,0.05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold', margin: '0 auto 20px auto', border: `2px solid ${color}`, color }}>
        {roleLevel}
      </div>
      <h3 style={{ fontSize: 24, color: color, marginBottom: 12 }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: 30, fontSize: 14 }}>{desc}</p>
      <ul className="feature-list" style={{ paddingLeft: 0, textAlign: 'left' }}>
        {list.map((item, idx) => (
          <li key={idx} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{ color: 'var(--ok)' }}>✓</span> {item}
          </li>
        ))}
        {crossList.map((item, idx) => (
          <li key={`x-${idx}`} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>
            <span style={{ color: 'var(--err)' }}>✗</span> {item}
          </li>
        ))}
      </ul>
    </TiltCard>
  );
}
