'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

type UserProfile = {
  id: string
  username: string
  uloga: string
  active: boolean
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('kolega')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('username')
    setUsers(data || [])
    setLoading(false)
  }

  async function toggleActive(user: UserProfile) {
    await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id)
    loadUsers()
  }

  async function changeRole(userId: string, role: string) {
    await supabase.from('profiles').update({ uloga: role }).eq('id', userId)
    loadUsers()
  }

  async function addUser() {
    if (!newUsername || !newPassword) return alert('Popuni polja')
    const email = `${newUsername.toLowerCase()}@example.com`

    // Kreiraj u auth
    const { data, error } = await supabase.auth.signUp({ email, password: newPassword })
    if (error) return alert(error.message)

    // Dodaj u profiles
    await supabase.from('profiles').insert({ id: data.user.id, username: newUsername.toLowerCase(), uloga: newRole, active: true })
    setNewUsername('')
    setNewPassword('')
    loadUsers()
  }

  if (loading) return <div className="p-10">Učitavanje...</div>

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="border p-2 rounded" />
        <input type="password" placeholder="Lozinka" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border p-2 rounded" />
        <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border p-2 rounded">
          <option value="kolega">Kolega</option>
          <option value="serviser">Serviser</option>
          <option value="lager">Lager</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={addUser} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Dodaj</button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Username</th>
            <th className="p-2">Uloga</th>
            <th className="p-2">Status</th>
            <th className="p-2">Akcije</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.username}</td>
              <td className="p-2">
                <select value={u.uloga} onChange={e => changeRole(u.id, e.target.value)} className="border p-1 rounded">
                  <option value="kolega">Kolega</option>
                  <option value="serviser">Serviser</option>
                  <option value="lager">Lager</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="p-2">{u.active ? 'Aktivan' : 'Deaktiviran'}</td>
              <td className="p-2">
                <button onClick={() => toggleActive(u)} className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                  {u.active ? 'Deaktiviraj' : 'Aktiviraj'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
