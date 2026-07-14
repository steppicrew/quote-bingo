import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { navigate } from '../router'
import { SIZES, quotesNeeded } from '../types'

export function Manage(): ReactNode {
  const { t } = useTranslation()
  const persons = useStore((s) => s.persons)
  const quotes = useStore((s) => s.quotes)
  const addPerson = useStore((s) => s.addPerson)

  const [newName, setNewName] = useState('')

  const count = (personId: string): number =>
    quotes.filter((q) => q.personId === personId).length

  const add = (): void => {
    const name = newName.trim()
    if (!name) return
    const id = addPerson(name)
    setNewName('')
    navigate({ name: 'person', id })
  }

  return (
    <div className="content">
      <div className="card-tile">
        <div className="row">
          <input
            placeholder={t('manage.newPersonPlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="primary" onClick={add}>
            {t('manage.add')}
          </button>
        </div>
      </div>

      {persons.length === 0 && <p className="dim">{t('manage.empty')}</p>}

      {persons.map((p) => {
        const n = count(p.id)
        const minPool = quotesNeeded(SIZES[0]!)
        const maxPlayable = [...SIZES].reverse().find((s) => n >= quotesNeeded(s))
        return (
          <div
            key={p.id}
            className="card-tile row"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate({ name: 'person', id: p.id })}
          >
            <div>
              <strong>{p.name}</strong>
              <div className="dim">{t('manage.quoteCount', { count: n })}</div>
            </div>
            <div className="spacer" />
            <span className={`badge ${maxPlayable ? 'ok' : 'warn'}`}>
              {maxPlayable
                ? t('manage.upTo', { size: maxPlayable })
                : t('manage.remaining', { count: minPool - n })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
