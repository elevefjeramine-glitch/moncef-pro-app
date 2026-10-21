/**
 * Données structurées schema.org (JSON-LD) pour le SEO.
 *
 * Composant serveur rendu dans le <head> du layout racine : aide Google à
 * comprendre que la page d'accueil représente la marque "Moncef IA"
 * (Organization + WebApplication) et expose la FAQ réelle du site
 * (FAQPage — textes FR repris tels quels de src/utils/i18n.tsx).
 *
 * Règle d'honnêteté : uniquement des infos réelles — offre gratuite
 * (700 crédits/jour), fonctionnalités existantes (devoirs, Thunder IA,
 * emploi du temps, QCM, fiches), aucun contenu inventé.
 */
export default function SeoJsonLd() {
  const base = "https://proappmoncef.netlify.app";

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Moncef IA",
    url: `${base}/`,
    logo: `${base}/logo.png`,
    sameAs: [] as string[],
  };

  const webApplication = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Moncef IA",
    url: `${base}/`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "fr",
    image: `${base}/og-image.png`,
    description:
      "Moncef IA, la plateforme éducative propulsée par l'intelligence artificielle : organise tes devoirs, révise avec Thunder IA et suis ton emploi du temps. 700 crédits IA offerts chaque jour, sans carte bancaire.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "MAD",
      description: "700 crédits IA offerts chaque jour, sans carte bancaire.",
    },
    featureList: [
      "Gestion des devoirs",
      "Thunder IA — assistant de révision",
      "Emploi du temps",
      "QCM et fiches de révision",
      "Messagerie",
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Comment marchent les 700 crédits ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Chaque jour, ton solde remonte à 700 crédits au premier appel (heure UTC). Une question coûte 10 crédits, un QCM 15, des liens 5. Si ton solde est déjà au-dessus de 700, il n'est jamais réduit.",
        },
      },
      {
        "@type": "Question",
        name: "Mes devoirs sont-ils privés ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Chaque compte ne voit que ses propres données, cloisonnées par des règles d'accès strictes. Tes devoirs et messages ne sont visibles par personne d'autre.",
        },
      },
      {
        "@type": "Question",
        name: "Qui peut utiliser la plateforme ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Les élèves et étudiants. Si tu es mineur, parles-en à tes parents avant de créer un compte : l'inscription ne demande qu'un e-mail, un mot de passe et ton prénom.",
        },
      },
      {
        "@type": "Question",
        name: "Que se passe-t-il si je dépasse mes crédits ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tes crédits se rechargent automatiquement à 700 au premier appel du lendemain (heure UTC). En attendant, tu peux toujours consulter tes devoirs, ton emploi du temps et tes messages.",
        },
      },
      {
        "@type": "Question",
        name: "Le site est-il vraiment gratuit ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Les 700 crédits quotidiens sont offerts, sans carte bancaire. Il n'y a aucun abonnement caché.",
        },
      },
    ],
  };

  const payloads = [organization, webApplication, faqPage];

  return (
    <>
      {payloads.map((payload, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Recommandation doc Next.js : neutraliser les "<" contre le XSS.
            __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
