"use client";

import { useFormStatus } from "react-dom";
import { AlertTriangle } from "lucide-react";

export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Bouton de suppression qui demande confirmation avant d'envoyer le formulaire. */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  incertain?: boolean;
  aide?: React.ReactNode;
  className?: string;
};

/** Libellé + champ, avec signalement orange si l'IA n'est pas sûre. */
export function Field({ label, htmlFor, children, incertain, aide, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label flex items-center gap-1.5">
        {label}
        {incertain && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
            <AlertTriangle size={12} aria-hidden /> à vérifier
          </span>
        )}
      </label>
      {children}
      {aide && <p className="mt-1 text-xs text-muted">{aide}</p>}
    </div>
  );
}
