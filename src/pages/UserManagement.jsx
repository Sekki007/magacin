import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    uloga: "kolega",
  });

  const loadUsers = async () => {
    const { data } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });
    setUsers(data?.data?.users || []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const createUser = async () => {
    await supabase.functions.invoke("admin-users", {
      body: { action: "create", ...form },
    });
    setForm({ email: "", password: "", username: "", uloga: "kolega" });
    loadUsers();
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Obrisati korisnika?")) return;

    await supabase.functions.invoke("admin-users", {
      body: { action: "delete", userId: id },
    });

    loadUsers();
  };

  return (
    <div className="container mt-4">
      <h3>👥 User Management</h3>

      {/* ➕ ADD USER */}
      <div className="card p-3 mb-4">
        <h5>Dodaj novog korisnika</h5>
        <input className="form-control mb-2" placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input className="form-control mb-2" placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <input className="form-control mb-2" placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <select className="form-control mb-2"
          value={form.uloga}
          onChange={(e) => setForm({ ...form, uloga: e.target.value })}
        >
          <option value="admin">Admin</option>
          <option value="kolega">Kolega</option>
        </select>
        <button className="btn btn-success" onClick={createUser}>
          ➕ Dodaj korisnika
        </button>
      </div>

      {/* 👤 USER LIST */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Email</th>
            <th>ID</th>
            <th>Akcija</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.id}</td>
              <td>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteUser(u.id)}
                >
                  🗑 Obriši
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
