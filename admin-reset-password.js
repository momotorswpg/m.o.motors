(() => {
  const db = supabase.createClient("https://dpsgtliddmdvfwjahkkq.supabase.co", "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0");
  const $ = id => document.getElementById(id);
  let ready = false;
  async function checkSession() {
    const { data:{ session } } = await db.auth.getSession();
    ready = Boolean(session);
    $("passwordStatus").textContent = ready ? "Password link verified." : "This link is invalid or has expired. Ask an administrator to send a new invitation or password reset.";
  }
  db.auth.onAuthStateChange((_event, session) => { if (session) { ready = true; $("passwordStatus").textContent = "Password link verified."; } });
  $("passwordForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready) return $("passwordStatus").textContent = "This password link is invalid or expired.";
    const password = $("newPassword").value;
    if (password !== $("confirmPassword").value) return $("passwordStatus").textContent = "The passwords do not match.";
    $("passwordStatus").textContent = "Saving password…";
    const { error } = await db.auth.updateUser({ password });
    if (error) return $("passwordStatus").textContent = error.message;
    await db.auth.signOut();
    $("passwordStatus").textContent = "Password saved. You can now sign in.";
    $("passwordForm").classList.add("hidden");
    $("adminLink").classList.remove("hidden");
  });
  checkSession();
})();
