'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

type UserProfile = {
  id: string
  username: string
  uloga: 'admin' | 'kolega' | 'serviser' | 'lager'
  active: boolean
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Forma za novog korisnika
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'kolega' | 'serviser' | 'lager' | 'admin'>('kolega')
  const [adding, setAdding] = useState(false)

  // Učitavanje korisnika
  const loadUsers = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, uloga, active')
        .order('username', { ascending: true })

      if (error) throw error

      setUsers((data as UserProfile[]) || [])
    } catch (err) {
      console.error('Greška pri učitavanju korisnika:', err)
      alert('Došlo je do greške pri učitavanju korisnika.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  // Prvo učitavanje + realtime
  useEffect(() => {
    loadUsers()

    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadUsers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Promena statusa
  const toggleActive = async (user: UserProfile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !user.active })
        .eq('id', user.id)

      if (error) throw error

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u))
      )
    } catch (err) {
      console.error(err)
      alert('Greška pri promeni statusa!')
    }
  }

  // Promena uloge
  const changeRole = async (userId: string, role: UserProfile['uloga']) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ uloga: role })
        .eq('id', userId)

      if (error) throw error

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, uloga: role } : u))
      )
    } catch (err) {
      console.error(err)
      alert('Greška pri promeni uloge!')
    }
  }

  // Dodavanje novog korisnika – GLAVNA ISPRAVKA OVDE
  const addUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      return alert('Unesi username i lozinku!')
    }

    if (newPassword.length < 6) {
      return alert('Lozinka mora imati najmanje 6 karaktera!')
    }

    setAdding(true)
    try {
      const email = `${newUsername.toLowerCase().trim()}@magacin.local`

      const { data, error } = await supabase.auth.signUp({
        email,
        password: newPassword,
      })

      if (error) throw error

      // *** ISPRAVKA: Provera da li je user kreiran ***
      if (!data.user) {
        throw new Error('Korisnik nije kreiran. Moguće je da je email već u upotrebi ili je potrebna potvrda email-a.')
      }

      // Sada je sigurno da data.user postoji
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username: newUsername.toLowerCase().trim(),
        uloga: newRole,
        active: true,
      })

      if (profileError) {
        // Ako profil ne uspe, obriši auth korisnika
        await supabase.auth.admin.deleteUser(data.user.id)
        throw profileError
      }

      alert(`Korisnik "${newUsername}" uspešno dodat!`)
      setNewUsername('')
      setNewPassword('')
      setNewRole('kolega')
      loadUsers() // osveži listu
    } catch (err: any) {
      console.error('Greška pri dodavanju korisnika:', err)
      alert(err.message || 'Greška pri kreiranju korisnika!')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-xl">Učitavanje korisnika...</div>
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Upravljanje korisnicima</h1>

      {/* Forma za dodavanje */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Dodaj novog korisnika</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Username (npr. pera)"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={adding}
          />
          <input
            type="password"
            placeholder="Lozinka (min 6 karaktera)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={adding}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as UserProfile['uloga'])}
            className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={adding}
          >
            <option value="kolega">Kolega</option>
            <option value="serviser">Serviser</option>
            <option value="lager">Lager</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={addUser}
            disabled={adding}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-8 py-3 rounded-lg font-bold transition"
          >
            {adding ? 'Dodavanje...' : 'Dodaj korisnika'}
          </button>
        </div>
      </div>

      {/* Lista korisnika */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-4 text-left font-semibold">Username</th>
                <th className="p-4 text-left font-semibold">Uloga</th>
                <th className="p-4 text-left font-semibold">Status</th>
                <th className="p-4 text-left font-semibold">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-gray-500">
                    Nema registrovanih korisnika.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 font-medium">{u.username}</td>
                    <td className="p-4">
                      <select
                        value={u.uloga}
                        onChange={(e) => changeRole(u.id, e.target.value as UserProfile['uloga'])}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="kolega">Kolega</option>
                        <option value="serviser">Serviser</option>
                        <option value="lager">Lager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          u.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.active ? 'Aktivan' : 'Deaktiviran'}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleActive(u)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          u.active
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {u.active ? 'Deaktiviraj' : 'Aktiviraj'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}