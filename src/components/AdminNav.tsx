'use client'

import Link from 'next/link'

type AdminTab = 'prodaje' | 'obavestenja' | 'korisnici'

const linkClass = (active: boolean) =>
  `px-4 py-2 rounded-lg font-medium transition ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
  }`

export default function AdminNav({ active }: { active: AdminTab }) {
  return (
    <nav className="flex flex-wrap items-center gap-3 mb-6">
      <Link href="/" className={linkClass(false)}>
        ← Dashboard
      </Link>
      <Link href="/admin/prodaje" className={linkClass(active === 'prodaje')}>
        Pregled prodaja
      </Link>
      <Link href="/admin/obavestenja" className={linkClass(active === 'obavestenja')}>
        Obaveštenja lager
      </Link>
      <Link href="/admin/korisnici" className={linkClass(active === 'korisnici')}>
        Korisnici
      </Link>
    </nav>
  )
}
