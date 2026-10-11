// Tâche de fond Netlify : lecture d'un document par Claude.
// Les fonctions « -background » répondent tout de suite (202) et peuvent tourner
// jusqu'à 15 minutes, au lieu d'être coupées au bout de quelques secondes.
// Le résultat est écrit dans la table documents ; l'appli le surveille.
import { createClient } from "@supabase/supabase-js";
import { isEmailAllowed } from "../../lib/config";
import { lancerExtraction } from "../../lib/extraction/run";

async function extractionEnFond(req: Request) {
  if (req.method !== "POST" || !process.env.ANTHROPIC_API_KEY) return;

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { documentId } = (await req.json().catch(() => ({}))) as { documentId?: string };
  if (!token || typeof documentId !== "string") return;

  // Client Supabase au nom de l'utilisateur : les règles RLS s'appliquent.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data } = await supabase.auth.getUser(token);
  if (!data.user || !isEmailAllowed(data.user.email)) return;

  await lancerExtraction(supabase, documentId);
}

export default extractionEnFond;
