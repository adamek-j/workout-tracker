import { useEffect, useState } from 'react'

type Exercise = {
  id: number
  name: string
  muscleGroup: string
}

function App() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState('ALL')

  useEffect(() => {
    async function loadExercises() {
      try {
        const response = await fetch('/api/exercises')

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: Exercise[] = await response.json()
        setExercises(data)
      } catch {
        setError('Nie udało się pobrać ćwiczeń.')
      } finally {
        setLoading(false)
      }
    }

    loadExercises()

  }, [])

  const filteredExercises = exercises.filter(exercise =>
      selectedGroup === 'ALL' || exercise.muscleGroup === selectedGroup
  )

  return (
      <main>
        <h1>Workout Tracker</h1>
        <h2>Ćwiczenia</h2>

        <div>
          <button
              type="button"
              onClick={() => setSelectedGroup('ALL')}
              aria-pressed={selectedGroup === 'ALL'}
          >
            Wszystkie
          </button>

          <button
              type="button"
              onClick={() => setSelectedGroup('CHEST')}
              aria-pressed={selectedGroup === 'CHEST'}
          >
            Chest
          </button>

          <button
              type="button"
              onClick={() => setSelectedGroup('BACK')}
              aria-pressed={selectedGroup === 'BACK'}
          >
            Back
          </button>
        </div>

        {loading && <p>Ładowanie...</p>}
        {error && <p role="alert">{error}</p>}

        <ul>
          {filteredExercises.map(exercise => (
              <li key={exercise.id}>{exercise.name}</li>
          ))}
        </ul>
      </main>
  )
}

export default App