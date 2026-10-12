import { PageHeader } from "@/components/page-header";
import { DemoNotice } from "@/components/states";
import { ConfirmButton } from "@/components/ui";
import { getDb } from "@/lib/data/db";
import { formatDate } from "@/lib/format";
import { supprimerCleWidget } from "./actions";
import { GenerateurWidget } from "./generateur";

export const metadata = { title: "Widget iPhone" };

export default async function WidgetPage() {
  const db = await getDb();
  const header = (
    <PageHeader
      title="Widget iPhone"
      description="Tes heures, ton ARE, tes salaires à percevoir et ton prochain tournage, sur l'écran d'accueil."
      back={{ href: "/plus", label: "Plus" }}
    />
  );
  if (!db) return <>{header}<DemoNotice /></>;

  const { data: cle } = await db.supabase.from("cles_widget").select("cree_le, utilise_le").maybeSingle();

  return (
    <>
      {header}
      <div className="space-y-6">
        <ol className="card divide-y divide-border text-sm">
          {[
            <>Installe l&apos;appli gratuite <strong>Scriptable</strong> depuis l&apos;App Store.</>,
            <>Appuie sur <strong>Créer mon script</strong> ci-dessous, puis sur <strong>Copier le script</strong>.</>,
            <>Dans Scriptable : <strong>+</strong> en haut à droite, colle le script, renomme-le « Intermiflouze » (en haut), puis <strong>OK</strong>.</>,
            <>
              Sur l&apos;écran d&apos;accueil : appui long sur un espace vide → <strong>Modifier</strong> → <strong>Ajouter un widget</strong> →
              Scriptable → choisis la taille (petit ou moyen) → <strong>Ajouter le widget</strong>.
            </>,
            <>
              Appui long sur le widget → <strong>Modifier le widget</strong> → Script : <strong>Intermiflouze</strong>. C&apos;est prêt.
            </>,
          ].map((etape, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
              <span>{etape}</span>
            </li>
          ))}
        </ol>

        <section className="card space-y-3 p-4 md:p-6">
          {cle && (
            <p className="text-sm text-muted">
              Script actif, créé le {formatDate(cle.cree_le as string, "long")}
              {cle.utilise_le ? ` · dernière mise à jour du widget le ${formatDate(cle.utilise_le as string, "long")}` : " · pas encore utilisé"}.
            </p>
          )}
          <GenerateurWidget existe={!!cle} />
        </section>

        {cle && (
          <form action={supprimerCleWidget} className="text-center">
            <ConfirmButton className="text-sm text-danger underline" message="Désactiver le widget ? Il affichera « Clé invalide ».">
              Désactiver le widget
            </ConfirmButton>
          </form>
        )}

        <p className="text-xs text-muted">
          Le widget se met à jour environ toutes les 30 minutes (c&apos;est l&apos;iPhone qui décide). Un appui dessus ouvre Intermiflouze.
        </p>
      </div>
    </>
  );
}
