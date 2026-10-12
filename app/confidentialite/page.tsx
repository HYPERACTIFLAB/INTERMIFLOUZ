export const metadata = { title: "Confidentialité" };

/** Page publique demandée par Google pour autoriser la connexion à Google Agenda. */
export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed md:py-16">
      <h1 className="text-2xl font-semibold">Règles de confidentialité</h1>
      <p className="mt-1 text-muted">Intermiflouze · mise à jour le 12 octobre 2026</p>

      <h2 className="mt-8 text-lg font-semibold">À qui sert cette application</h2>
      <p className="mt-2">
        Intermiflouze est une application personnelle, utilisée uniquement par son propriétaire, pour suivre ses contrats
        d&apos;intermittent du spectacle, ses heures, ses frais et son activité de micro-entrepreneur. Personne d&apos;autre ne
        peut s&apos;y connecter.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Données enregistrées</h2>
      <p className="mt-2">
        Les contrats, documents (PDF, photos), notes de frais et réglages saisis par l&apos;utilisateur sont stockés dans une base
        de données privée (Supabase, hébergée dans l&apos;Union européenne). Chaque ligne n&apos;est lisible que par le compte qui
        l&apos;a créée. Aucune donnée n&apos;est vendue, partagée ou utilisée à des fins publicitaires.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Google Agenda</h2>
      <p className="mt-2">
        Si l&apos;utilisateur connecte son compte Google, l&apos;application demande uniquement l&apos;autorisation de créer son
        propre agenda (« Tournage ») et d&apos;y gérer les événements qu&apos;elle crée : un événement par période de travail
        d&apos;un contrat. Elle ne lit pas et ne modifie pas les autres agendas ni les autres événements de l&apos;utilisateur.
        Le jeton d&apos;accès fourni par Google est conservé chiffré et sert uniquement à mettre à jour cet agenda.
        L&apos;utilisateur peut retirer l&apos;accès à tout moment depuis l&apos;application (Agenda → Déconnecter) ou depuis
        son compte Google (myaccount.google.com/permissions).
      </p>
      <p className="mt-2">
        L&apos;utilisation des informations reçues des API Google respecte la{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-accent underline">
          Google API Services User Data Policy
        </a>
        , y compris les exigences d&apos;utilisation limitée (Limited Use).
      </p>

      <h2 className="mt-8 text-lg font-semibold">Lecture des documents</h2>
      <p className="mt-2">
        Les documents importés peuvent être envoyés à l&apos;API Claude (Anthropic) pour en extraire les informations du contrat.
        Ils ne servent qu&apos;à cette lecture.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Suppression</h2>
      <p className="mt-2">
        L&apos;utilisateur peut supprimer à tout moment ses contrats, documents et la connexion à Google depuis
        l&apos;application.
      </p>
    </main>
  );
}
