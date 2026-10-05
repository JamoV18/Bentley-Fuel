import { auth, isAdminAuthConfigured, isAdminSession, signIn } from "@/auth";
import { redirect } from "next/navigation";
import "../921-sync/sync.css";

export const metadata = {
  title: "Admin sign in · Falcon Fuel",
};

export default async function AdminSignInPage() {
  const session = await auth();
  if (isAdminSession(session)) redirect("/admin/921-sync");
  const configured = isAdminAuthConfigured();

  return (
    <main className="ff921-page">
      <header className="ff921-header">
        <p className="ff921-kicker">Falcon Fuel Admin</p>
        <h1>Sign in</h1>
        <p>The 921 publishing workflow is limited to the configured Falcon Fuel administrator.</p>
      </header>
      <section className="ff921-card">
        {configured ? (
          <form action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/admin/921-sync" });
          }}>
            <button className="ff921-primary" type="submit">Continue with GitHub</button>
          </form>
        ) : (
          <p>Admin authentication is not configured for this deployment.</p>
        )}
      </section>
    </main>
  );
}
