"use client";

import { useState } from "react";
import { Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui";
import type { Contact } from "@/lib/data/types";
import { deleteContact } from "../actions";
import { ContactForm } from "../forms";

export function ContactItem({ contact }: { contact: Contact }) {
  const [editing, setEditing] = useState(false);
  const nom = [contact.prenom, contact.nom].filter(Boolean).join(" ");

  if (editing) {
    return (
      <div className="p-4">
        <ContactForm organisationId={contact.organisation_id!} contact={contact} onDone={() => setEditing(false)} />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-muted">
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{nom}</p>
        {contact.fonction && <p className="text-sm text-muted">{contact.fonction}</p>}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-accent">
              <Mail size={14} aria-hidden /> {contact.email}
            </a>
          )}
          {contact.telephone && (
            <a href={`tel:${contact.telephone}`} className="inline-flex items-center gap-1 text-accent">
              <Phone size={14} aria-hidden /> {contact.telephone}
            </a>
          )}
        </div>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="p-2 text-muted hover:text-foreground" aria-label={`Modifier ${nom}`}>
        <Pencil size={16} />
      </button>
      <form action={deleteContact}>
        <input type="hidden" name="id" value={contact.id} />
        <input type="hidden" name="organisation_id" value={contact.organisation_id ?? ""} />
        <ConfirmButton message={`Supprimer ${nom} ?`} className="p-2 text-muted hover:text-danger">
          <Trash2 size={16} aria-label={`Supprimer ${nom}`} />
        </ConfirmButton>
      </form>
    </div>
  );
}
