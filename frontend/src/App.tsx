import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type Exercise = {
  id: number
  name: string
  muscleGroups: string[]
}

type ExerciseSet = {
  id: string
  weightKg: number
  reps: number
}

type LoggedExercise = {
  exerciseId: number
  name: string
  muscleGroups: string[]
  sets: ExerciseSet[]
}

type Workout = {
  date: string
  exercises: LoggedExercise[]
}

type SavedData = {
  version: 1
  workouts: Workout[]
}

const STORAGE_KEY = 'workout-tracker-v1'

const GROUPS = [
  'CHEST',
  'BACK',
  'BICEPS',
  'TRICEPS',
  'SHOULDERS',
  'LEGS',
  'GLUTES',
  'CORE',
  'FOREARMS',
  'NECK',
]

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isSavedData(value: unknown): value is SavedData {
  if (typeof value !== 'object' || value === null) return false
  if (!('version' in value) || value.version !== 1) return false
  if (!('workouts' in value) || !Array.isArray(value.workouts)) return false

  return value.workouts.every(workout =>
      typeof workout.date === 'string' &&
      Array.isArray(workout.exercises) &&
      workout.exercises.every((exercise: LoggedExercise) =>
          typeof exercise.exerciseId === 'number' &&
          typeof exercise.name === 'string' &&
          Array.isArray(exercise.muscleGroups) &&
          exercise.muscleGroups.every(group => typeof group === 'string') &&
          Array.isArray(exercise.sets) &&
          exercise.sets.every(set =>
              typeof set.id === 'string' &&
              Number.isFinite(set.weightKg) &&
              set.weightKg >= 0 &&
              Number.isInteger(set.reps) &&
              set.reps > 0
          )
      )
  )
}

function readSavedData(): {
  workouts: Workout[]
  error: string | null
} {
  const failure = {
    workouts: [] as Workout[],
    error:
        'Could not read workout history. Saving is disabled ' +
        'to avoid overwriting existing data.',
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return { workouts: [], error: null }
    }

    const data: unknown = JSON.parse(raw)

    if (!isSavedData(data)) {
      return failure
    }

    return { workouts: data.workouts, error: null }
  } catch {
    return failure
  }
}

function App() {
  const [initialData] = useState(readSavedData)
  const [workouts, setWorkouts] = useState(initialData.workouts)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const [selectedGroup, setSelectedGroup] = useState('ALL')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [message, setMessage] = useState('')

  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()))
  const [visibleMonth, setVisibleMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadExercises() {
      try {
        const response = await fetch('/api/exercises', {
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!response.ok) {
          setApiError(`Could not load exercises (HTTP ${response.status}).`)
          return
        }

        const data: Exercise[] = await response.json()

        if (!controller.signal.aborted) {
          setExercises(data)
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiError('Could not load exercises. Check your connection.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadExercises()

    return () => controller.abort()
  }, [])

  const filteredExercises = exercises.filter(exercise =>
      selectedGroup === 'ALL' ||
      exercise.muscleGroups.includes(selectedGroup)
  )

  const selectedWorkout = workouts.find(
      workout => workout.date === selectedDate
  )

  const totalSets = selectedWorkout?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
  ) ?? 0

  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0
  ).getDate()

  const calendarCells = Array.from(
      { length: firstWeekday + daysInMonth },
      (_, index) => index < firstWeekday ? null : index - firstWeekday + 1
  )

  function persist(nextWorkouts: Workout[]): boolean {
    if (initialData.error) return false

    try {
      const data: SavedData = {
        version: 1,
        workouts: nextWorkouts,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setWorkouts(nextWorkouts)
      setSaveError(null)
      return true
    } catch {
      setSaveError('Could not save changes. Please try again.')
      return false
    }
  }

  function addSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const exercise = exercises.find(
        item => item.id === Number(selectedExerciseId)
    )

    const weightKg = Number(weight)
    const repetitions = Number(reps)

    if (
        !exercise ||
        weight.trim() === '' ||
        reps.trim() === '' ||
        !Number.isFinite(weightKg) ||
        weightKg < 0 ||
        !Number.isInteger(repetitions) ||
        repetitions < 1
    ) {
      setMessage(
          'Select an exercise, enter a weight of at least 0 kg, ' +
          'and a whole number of reps greater than 0.'
      )
      return
    }

    const newSet: ExerciseSet = {
      id: crypto.randomUUID(),
      weightKg,
      reps: repetitions,
    }

    const workout: Workout = selectedWorkout ?? {
      date: selectedDate,
      exercises: [],
    }

    const alreadyLogged = workout.exercises.some(
        item => item.exerciseId === exercise.id
    )

    const updatedWorkout: Workout = {
      ...workout,
      exercises: alreadyLogged
          ? workout.exercises.map(item =>
              item.exerciseId === exercise.id
                  ? { ...item, sets: [...item.sets, newSet] }
                  : item
          )
          : [
            ...workout.exercises,
            {
              exerciseId: exercise.id,
              name: exercise.name,
              muscleGroups: exercise.muscleGroups,
              sets: [newSet],
            },
          ],
    }

    const nextWorkouts = selectedWorkout
        ? workouts.map(item =>
            item.date === selectedDate ? updatedWorkout : item
        )
        : [...workouts, updatedWorkout]

    if (persist(nextWorkouts)) {
      setMessage('Set saved.')
    }
  }

  function removeSet(exerciseId: number, setId: string) {
    if (!selectedWorkout) return

    const updatedExercises = selectedWorkout.exercises
        .map(exercise =>
            exercise.exerciseId === exerciseId
                ? {
                  ...exercise,
                  sets: exercise.sets.filter(set => set.id !== setId),
                }
                : exercise
        )
        .filter(exercise => exercise.sets.length > 0)

    const nextWorkouts = updatedExercises.length === 0
        ? workouts.filter(workout => workout.date !== selectedDate)
        : workouts.map(workout =>
            workout.date === selectedDate
                ? { ...workout, exercises: updatedExercises }
                : workout
        )

    if (persist(nextWorkouts)) {
      setMessage('Set removed.')
    }
  }

  function changeMonth(offset: number) {
    setVisibleMonth(current => new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1
    ))
  }

  return (
      <main>
        <h1>Workout Tracker</h1>
        <p>Historia zapisywana lokalnie w tej przeglądarce.</p>

        {initialData.error && <p role="alert">{initialData.error}</p>}
        {saveError && <p role="alert">{saveError}</p>}

        <section>
          <h2>Kalendarz</h2>

          <div className="month-navigation">
            <button type="button" onClick={() => changeMonth(-1)}>
              ← Poprzedni
            </button>

            <strong>
              {visibleMonth.toLocaleDateString('pl-PL', {
                month: 'long',
                year: 'numeric',
              })}
            </strong>

            <button type="button" onClick={() => changeMonth(1)}>
              Następny →
            </button>
          </div>

          <div className="calendar">
            {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map(day => (
                <span key={day} className="weekday">{day}</span>
            ))}

            {calendarCells.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} />
              }

              const date = dateKey(new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth(),
                  day
              ))

              const workout = workouts.find(item => item.date === date)

              return (
                  <button
                      key={date}
                      type="button"
                      aria-pressed={date === selectedDate}
                      aria-label={`${date}, ćwiczeń: ${workout?.exercises.length ?? 0}`}
                      onClick={() => {
                        setSelectedDate(date)
                        setMessage('')
                      }}
                  >
                    <span>{day}</span>
                    {workout && (
                        <small>{workout.exercises.length} ćw.</small>
                    )}
                  </button>
              )
            })}
          </div>
        </section>

        <section>
          <h2>Trening: {selectedDate}</h2>

          {loading && <p>Ładowanie katalogu...</p>}
          {apiError && <p role="alert">{apiError}</p>}

          <form onSubmit={addSet}>
            <label>
              Partia
              <select
                  value={selectedGroup}
                  onChange={event => {
                    setSelectedGroup(event.target.value)
                    setSelectedExerciseId('')
                  }}
              >
                <option value="ALL">Wszystkie</option>
                {GROUPS.map(group => (
                    <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>

            <label>
              Ćwiczenie
              <select
                  required
                  value={selectedExerciseId}
                  onChange={event => setSelectedExerciseId(event.target.value)}
              >
                <option value="">Wybierz ćwiczenie</option>
                {filteredExercises.map(exercise => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                ))}
              </select>
            </label>

            <div className="set-inputs">
              <label>
                Ciężar (kg)
                <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={weight}
                    onChange={event => setWeight(event.target.value)}
                />
              </label>

              <label>
                Powtórzenia
                <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={reps}
                    onChange={event => setReps(event.target.value)}
                />
              </label>
            </div>

            <button
                type="submit"
                disabled={loading || !!apiError || !!initialData.error}
            >
              Zapisz serię
            </button>
          </form>

          <p role="status">{message}</p>

          <p>
            Ćwiczenia: {selectedWorkout?.exercises.length ?? 0}
            {' · '}
            Serie: {totalSets}
          </p>

          {!selectedWorkout && <p>Brak zapisanych serii tego dnia.</p>}

          {selectedWorkout?.exercises.map(exercise => (
              <article key={exercise.exerciseId}>
                <h3>{exercise.name}</h3>
                <p>{exercise.muscleGroups.join(' / ')}</p>

                <ol>
                  {exercise.sets.map(set => (
                      <li key={set.id}>
                        <span>{set.weightKg} kg × {set.reps} powt.</span>
                        <button
                            type="button"
                            onClick={() => removeSet(exercise.exerciseId, set.id)}
                        >
                          Usuń serię
                        </button>
                      </li>
                  ))}
                </ol>
              </article>
          ))}
        </section>
      </main>
  )
}

export default App