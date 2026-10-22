import { useEffect, useState } from 'react'

type Exercise = {
  id: number
  name: string
}

function App() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
      <main>
        <h1>Workout Tracker</h1>
        <h2>Ćwiczenia</h2>

        {loading && <p>Ładowanie...</p>}
        {error && <p role="alert">{error}</p>}

        <ul>
          {exercises.map(exercise => (
              <li key={exercise.id}>{exercise.name}</li>
          ))}
        </ul>
      </main>
  )
}

export default App