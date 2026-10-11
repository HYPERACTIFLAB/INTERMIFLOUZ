import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { DemoNotice } from "@/components/states";
import { getDb } from "@/lib/data/db";
import { listContratsChoix, type NoteFrais } from "@/lib/data/frais";
import { lienTemporaire, listNomsProjets, listOrganisations } from "@/lib/data/queries";
import { LIBELLES_CATEGORIE } from "@/lib/extraction/justificatif";
import { centimesVersSaisie, formatDate, formatEuros } from "@/lib/format";
import { DocumentPreview } from "../../contrats/document-preview";
import { deleteNote, marquerRembourse } from "../actions";
import { NoteForm } from "../note-form";

export default async function NotePage({ params }: PageProps<"/frais/[id]">) {
  const { id } = await params;
  const db = await getDb();
  if (!db) return <DemoNotice />;

  const [{ data: note }, { data: docs }, organisations, contrats, projets] = await Promise.all([
    db.supabase.from("notes_de_frais").select("*, organisation:organisations(nom), projet:projets(nom)").eq("id", id).maybeSingle<NoteFrais>(),
    db.supabase.from("documents").select("id, nom_fichier, mime, chemin_stockage").eq("note_frais_id", id),
    listOrganisations(db.supabase),
    listContratsChoix(db.supabase),
    listNomsProjets(db.supabase),
  ]);
  if (!note) notFound();
  const liens = await Promise.all((docs ?? []).map((d) => lienTemporaire(db.supabase, d.chemin_stockage as string)));

  return (
    <>
      <PageHeader
        title={formatEuros(note.montant_ttc)}
        description={`${note.marchand ?? LIBELLES_CATEGORIE[note.categorie]} · ${formatDate(note.date, "long")}`}
        back={{ href: "/frais", label: "Notes de frais" }}
      />
      <div className="space-y-6">
        {note.statut !== "non_remboursable" && (
          <form action={marquerRembourse} className="card flex items-center justify-between gap-3 p-4">
            <input type="hidden" name="id" value={note.id} />
            <input type="hidden" name="rembourse" value={note.statut === "rembourse" ? "0" : "1"} />
            <span className="text-sm">
              {note.statut === "rembourse" ? `Remboursée le ${formatDate(note.date_remboursement)}` : "Pas encore remboursée"}
            </span>
            <SubmitButton className={note.statut === "rembourse" ? "btn-secondary text-sm" : "btn-primary text-sm"} pendingLabel="…">
              {note.statut === "rembourse" ? "Annuler" : "Marquer remboursée"}
            </SubmitButton>
          </form>
        )}

        {(docs ?? []).map((d, i) => (
          <details key={d.id as string} className="card p-4">
            <summary className="cursor-pointer font-medium">Justificatif · <span className="font-normal text-muted">{d.nom_fichier as string}</span></summary>
            <div className="mt-3">
              <DocumentPreview url={liens[i]} mime={d.mime as string} nom={d.nom_fichier as string} />
            </div>
          </details>
        ))}

        <details className="card p-4 md:p-6">
          <summary className="cursor-pointer font-semibold">Modifier la note</summary>
          <div className="mt-4">
            <NoteForm
              noteId={note.id}
              valeurs={{
                date: note.date,
                marchand: note.marchand ?? "",
                description: note.description ?? "",
                montant_ttc: centimesVersSaisie(note.montant_ttc),
                tva: centimesVersSaisie(note.tva),
                categorie: note.categorie,
                moyen_paiement: note.moyen_paiement ?? "",
                refacturable_a: note.refacturable_a,
                organisation_id: note.organisation_id ?? "",
                contrat_id: note.contrat_id ?? "",
                projet_nom: note.projet?.nom ?? "",
                statut: note.statut,
                date_remboursement: note.date_remboursement ?? "",
                notes: note.notes ?? "",
              }}
              organisations={organisations}
              contrats={contrats}
              projets={projets}
              submitLabel="Enregistrer"
            />
          </div>
        </details>

        <form action={deleteNote}>
          <input type="hidden" name="id" value={note.id} />
          <ConfirmButton message="Supprimer cette note de frais et son justificatif ?">Supprimer la note</ConfirmButton>
        </form>
      </div>
    </>
  );
}
