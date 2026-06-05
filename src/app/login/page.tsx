'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = `${username.toLowerCase().trim()}@example.com`

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Pogrešno korisničko ime ili lozinka.')
      } else if (authError.message.toLowerCase().includes('confirmed')) {
        setError('Nalog nije potvrđen. Kontaktiraj administratora.')
      } else {
        setError('Greška pri prijavi. Pokušaj ponovo.')
      }
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('active')
        .eq('id', data.user.id)
        .single()

      if (profile?.active === false) {
        await supabase.auth.signOut()
        setError('Nalog je deaktiviran. Kontaktiraj administratora.')
        setLoading(false)
        return
      }
    }

    router.push('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 sm:p-10 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
              Magacin v1.0
            </h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
              Prijava u sistem
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Korisničko ime
              </label>
              <input
                id="username"
                type="text"
                placeholder="Unesi korisničko ime"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-5 py-4 text-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Lozinka
              </label>
              <input
                id="password"
                type="password"
                placeholder="Unesi lozinku"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-5 py-4 text-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 text-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-70 rounded-xl shadow-lg transition transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'Ulazak...' : 'Uloguj se'}
            </button>
          </form>

          {error && (
            <div className="mt-8 p-5 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl">
              <p className="text-red-700 dark:text-red-300 font-semibold text-center">{error}</p>
            </div>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-10">
            Interni sistem • Kontaktiraj admina ako imaš problem
          </p>
        </div>
      </div>
    </div>
  )
}
