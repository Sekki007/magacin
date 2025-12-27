'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserProfile = {
  id: string
  username: string
  uloga: string
  active: boolean
}

export default function AdminUsers() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Provera admina + učitavanje korisnika
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: me } = await supabase
        .from('profiles')
        .select('uloga')
        .eq('id', session.user.id)
        .single()

      if (me?.uloga !== 'admin') {
        alert('Samo admin može da pristupi ovoj stranici!')
        router.push('/')
        return
      }

      await loadUsers()
      setLoading(false)
    }

    init()
  }, [router])

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, uloga, active')
      .order('username', { ascending: true })

    setUsers(data || [])
  }

  async function toggleActive(user: UserProfile) {
    if (!confirm(`Da li želiš da ${user.active ? 'deaktiviraš' : 'aktiviraš'} korisnika "${user.username}"?`)) return

    await supabase
      .from('profiles')
      .update({ active: !user.active })
      .eq('id', user.id)

    loadUsers()
  }

  async function changeRole(userId: string, newRole: string) {
    await supabase
      .from('profiles')
      .update({ uloga: newRole })
      .eq('id', userId)

    loadUsers()
  }

  if (loading) return <div className="p-10">Učitavanje...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-3xl font-bold mb-8 text-center">
          User Management – Admin
        </h1>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-4 text-left">Username</th>
              <th className="p-4 text-left">Uloga</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-4 font-medium">{u.username}</td>

                <td className="p-4">
                  <select
                    value={u.uloga}
                    onChange={e => changeRole(u.id, e.target.value)}
                    className="border rounded px-3 py-2"
                  >
                    <option value="kolega">Kolega</option>
                    <option value="serviser">Serviser</option>
                    <option value="lager">Lager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>

                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded font-semibold text-sm ${
                    u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {u.active ? 'Aktivan' : 'Deaktiviran'}
                  </span>
                </td>

                <td className="p-4 text-center">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`px-4 py-2 rounded font-semibold ${
                      u.active
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {u.active ? 'Deaktiviraj' : 'Aktiviraj'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
          >
            ← Nazad na dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
