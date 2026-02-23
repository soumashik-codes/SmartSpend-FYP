export async function getDefaultAccountId() {
  const token = localStorage.getItem("token");

  if (!token) return null;

  const res = await fetch("http://127.0.0.1:8000/accounts/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;

  const accounts = await res.json();

  if (!accounts.length) return null;

  return accounts[0].id;
}
