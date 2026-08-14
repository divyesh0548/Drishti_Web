export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureDefaultSiteAdmin } = await import("./src/lib/user-database");
  await ensureDefaultSiteAdmin();
}
