import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { demoMode, isEmailAllowed, supabaseConfigured } from "@/lib/config";

const PUBLIC_PATHS = ["/connexion", "/auth/callback", "/hors-ligne", "/confidentialite"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

/**
 * Exécuté avant chaque page : rafraîchit la session Supabase et renvoie
 * vers /connexion toute personne non connectée ou non autorisée.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (demoMode) return NextResponse.next({ request });
  if (!supabaseConfigured) {
    return isPublic(pathname) ? NextResponse.next({ request }) : redirectTo(request, "/connexion");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
        },
      },
    },
  );

  // Ne rien intercaler entre la création du client et cet appel.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Copie les cookies de session rafraîchis sur une redirection.
  const withCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!claims) {
    return isPublic(pathname) ? response : redirectTo(request, "/connexion");
  }

  if (!isEmailAllowed(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return withCookies(redirectTo(request, "/connexion", { erreur: "non-autorise" }));
  }

  if (pathname === "/connexion") return withCookies(redirectTo(request, "/"));

  // Mot de passe provisoire : il faut d'abord en choisir un.
  const meta = claims.user_metadata as { doit_changer_mdp?: boolean } | undefined;
  if (meta?.doit_changer_mdp && pathname !== "/mot-de-passe") {
    return withCookies(redirectTo(request, "/mot-de-passe"));
  }

  return response;
}
