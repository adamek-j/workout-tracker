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
  loggedGroup?: string
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
  finishedAt?: string
}

type SavedData = {
  version: 1
  workouts: Workout[]
}

type LoadedData = {
  workouts: Workout[]
  error: string | null
}

type GroupScore = {
  group: string
  reps: number
  sets: number
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return (
      Array.isArray(value) &&
      value.every((item: unknown) => typeof item === 'string')
  )
}

function isExercise(value: unknown): value is Exercise {
  return (
      isRecord(value) &&
      typeof value.id === 'number' &&
      Number.isInteger(value.id) &&
      typeof value.name === 'string' &&
      isStringArray(value.muscleGroups) &&
      value.muscleGroups.length > 0
  )
}

function isExerciseSet(value: unknown): value is ExerciseSet {
  return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.weightKg === 'number' &&
      Number.isFinite(value.weightKg) &&
      value.weightKg >= 0 &&
      typeof value.reps === 'number' &&
      Number.isInteger(value.reps) &&
      value.reps > 0 &&
      (
          value.loggedGroup === undefined ||
          (
              typeof value.loggedGroup === 'string' &&
              GROUPS.includes(value.loggedGroup)
          )
      )
  )
}

function isLoggedExercise(value: unknown): value is LoggedExercise {
  return (
      isRecord(value) &&
      typeof value.exerciseId === 'number' &&
      typeof value.name === 'string' &&
      isStringArray(value.muscleGroups) &&
      value.muscleGroups.length > 0 &&
      Array.isArray(value.sets) &&
      value.sets.every(isExerciseSet)
  )
}

function isWorkout(value: unknown): value is Workout {
  return (
      isRecord(value) &&
      typeof value.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
      (
          value.finishedAt === undefined ||
          (
              typeof value.finishedAt === 'string' &&
              Number.isFinite(Date.parse(value.finishedAt))
          )
      ) &&
      Array.isArray(value.exercises) &&
      value.exercises.every(isLoggedExercise)
  )
}

function isSavedData(value: unknown): value is SavedData {
  return (
      isRecord(value) &&
      value.version === 1 &&
      Array.isArray(value.workouts) &&
      value.workouts.every(isWorkout)
  )
}

function readSavedData(): LoadedData {
  const failure: LoadedData = {
    workouts: [],
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

    if (!isSavedData(data)) return failure

    return { workouts: data.workouts, error: null }
  } catch {
    return failure
  }
}

function rankGroups(workout: Workout): GroupScore[] {
  const scores = new Map<string, GroupScore>()

  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      const group = set.loggedGroup ?? exercise.muscleGroups[0]

      if (!group) continue

      const score = scores.get(group) ?? {
        group,
        reps: 0,
        sets: 0,
      }

      score.reps += set.reps
      score.sets += 1

      scores.set(group, score)
    }
  }

  return [...scores.values()].sort(
      (a, b) =>
          b.reps - a.reps ||
          a.group.localeCompare(b.group)
  )
}

function getDayLabel(workout: Workout): string {
  if (!workout.finishedAt) return 'In progress'

  const [first, second] = rankGroups(workout)

  if (!first) return 'No sets'

  const includeSecond =
      second !== undefined &&
      second.reps >= first.reps * 0.5 &&
      second.sets >= 3

  return includeSecond
      ? `${first.group} + ${second.group} day`
      : `${first.group} day`
}

function App() {
  const [initialData] = useState(readSavedData)
  const [workouts, setWorkouts] = useState(initialData.workouts)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  const [view, setView] = useState<'calendar' | 'day'>('calendar')
  const [selectedDate, setSelectedDate] = useState(
      () => dateKey(new Date())
  )
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadExercises() {
      try {
        const response = await fetch('/api/exercises', {
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!response.ok) {
          setApiError(
              `Could not load exercises (HTTP ${response.status}).`
          )
          return
        }

        const data: unknown = await response.json()

        if (controller.signal.aborted) return

        if (
            !Array.isArray(data) ||
            !data.every(isExercise)
        ) {
          setApiError('The exercise catalog has an invalid format.')
          return
        }

        setExercises(data)
      } catch {
        if (!controller.signal.aborted) {
          setApiError(
              'Could not load exercises. Check that the backend is running.'
          )
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
      exercise.muscleGroups.includes(selectedGroup)
  )

  const selectedWorkout = workouts.find(
      workout => workout.date === selectedDate
  )

  const isFinished = Boolean(selectedWorkout?.finishedAt)
  const storageBlocked = Boolean(initialData.error)

  const totalSets = selectedWorkout?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
  ) ?? 0

  const groupScores = selectedWorkout
      ? rankGroups(selectedWorkout)
      : []

  const firstWeekday = (visibleMonth.getDay() + 6) % 7
  const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0
  ).getDate()

  const calendarCells = Array.from(
      { length: firstWeekday + daysInMonth },
      (_, index) =>
          index < firstWeekday ? null : index - firstWeekday + 1
  )

  function persist(nextWorkouts: Workout[]): boolean {
    if (storageBlocked) return false

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

  function clearInputs() {
    setWeight('')
    setReps('')
    setMessage('')
  }

  function openDay(date: string) {
    setSelectedDate(date)
    setSelectedGroup('')
    setSelectedExerciseId('')
    clearInputs()
    setView('day')
  }

  function chooseGroup(group: string) {
    setSelectedGroup(group)
    setSelectedExerciseId('')
    clearInputs()
  }

  function chooseExercise(id: number) {
    setSelectedExerciseId(String(id))
    clearInputs()
  }

  function addSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (storageBlocked || isFinished) return

    const exercise = exercises.find(
        item => item.id === Number(selectedExerciseId)
    )

    const weightKg = Number(weight)
    const repetitions = Number(reps)

    if (
        !exercise ||
        !GROUPS.includes(selectedGroup) ||
        !exercise.muscleGroups.includes(selectedGroup) ||
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
      loggedGroup: selectedGroup,
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
              muscleGroups: [...exercise.muscleGroups],
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
    if (!selectedWorkout || isFinished || storageBlocked) return

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

  function finishDay() {
    if (
        !selectedWorkout ||
        totalSets === 0 ||
        isFinished ||
        storageBlocked
    ) {
      return
    }

    const updatedWorkout: Workout = {
      ...selectedWorkout,
      finishedAt: new Date().toISOString(),
    }

    const nextWorkouts = workouts.map(workout =>
        workout.date === selectedDate ? updatedWorkout : workout
    )

    if (persist(nextWorkouts)) {
      clearInputs()
      setView('calendar')
    }
  }

  function reopenDay() {
    if (!selectedWorkout || !isFinished || storageBlocked) return

    const updatedWorkout = { ...selectedWorkout }
    delete updatedWorkout.finishedAt

    const nextWorkouts = workouts.map(workout =>
        workout.date === selectedDate ? updatedWorkout : workout
    )

    if (persist(nextWorkouts)) {
      setSelectedGroup('')
      setSelectedExerciseId('')
      clearInputs()
      setMessage('Day reopened.')
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
        <header>
          <h1>Workout Tracker</h1>
          <p className="muted">
            Your workouts, one day at a time.
          </p>
        </header>

        {initialData.error && (
            <p role="alert">{initialData.error}</p>
        )}

        {saveError && <p role="alert">{saveError}</p>}

        {view === 'calendar' ? (
            <section aria-labelledby="calendar-title">
              <h2 id="calendar-title">Calendar</h2>

              <div className="month-navigation">
                <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => changeMonth(-1)}
                >
                  ←
                </button>

                <strong>
                  {visibleMonth.toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>

                <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => changeMonth(1)}
                >
                  →
                </button>
              </div>

              <div className="calendar">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                    day => (
                        <span key={day} className="weekday">
                  {day}
                </span>
                    )
                )}

                {calendarCells.map((day, index) => {
                  if (day === null) {
                    return <span key={`empty-${index}`} />
                  }

                  const date = dateKey(new Date(
                      visibleMonth.getFullYear(),
                      visibleMonth.getMonth(),
                      day
                  ))

                  const workout = workouts.find(
                      item => item.date === date
                  )
                  const label = workout
                      ? getDayLabel(workout)
                      : 'No workout'

                  const isToday = date === dateKey(new Date())

                  return (
                      <button
                          key={date}
                          type="button"
                          className={
                            workout?.finishedAt ? 'finished-day' : ''
                          }
                          aria-label={`${date}: ${label}`}
                          aria-current={isToday ? 'date' : undefined}
                          onClick={() => openDay(date)}
                      >
                        <span>{day}</span>
                        {workout && <small>{label}</small>}
                      </button>
                  )
                })}
              </div>

              <p className="muted">
                Select a day to log or review a workout.
              </p>
            </section>
        ) : (
            <section aria-labelledby="workout-title">
              <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setView('calendar')
                  }}
              >
                ← Calendar
              </button>

              <h2 id="workout-title">Workout: {selectedDate}</h2>

              {selectedWorkout && (
                  <p className="day-label">
                    {getDayLabel(selectedWorkout)}
                  </p>
              )}

              {!isFinished && (
                  <>
                    <h3>Choose a muscle group</h3>

                    <div className="tiles">
                      {GROUPS.map(group => (
                          <button
                              key={group}
                              type="button"
                              aria-pressed={selectedGroup === group}
                              onClick={() => chooseGroup(group)}
                          >
                            {group}
                          </button>
                      ))}
                    </div>

                    {loading && <p>Loading exercises...</p>}
                    {apiError && <p role="alert">{apiError}</p>}

                    {selectedGroup && !loading && !apiError && (
                        <>
                          <h3>{selectedGroup} exercises</h3>

                          {filteredExercises.length === 0 && (
                              <p>No exercises found for this muscle group.</p>
                          )}

                          <div className="tiles exercise-tiles">
                            {filteredExercises.map(exercise => {
                              const selected =
                                  selectedExerciseId === String(exercise.id)

                              return (
                                  <div
                                      key={exercise.id}
                                      className="exercise-tile"
                                  >
                                    <button
                                        type="button"
                                        aria-pressed={selected}
                                        aria-expanded={selected}
                                        onClick={() => chooseExercise(exercise.id)}
                                    >
                                      {exercise.name}
                                    </button>

                                    {selected && (
                                        <form onSubmit={addSet}>
                                          <div className="set-inputs">
                                            <label>
                                              Weight (kg)
                                              <input
                                                  required
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={weight}
                                                  onChange={event =>
                                                      setWeight(event.target.value)
                                                  }
                                              />
                                            </label>

                                            <label>
                                              Reps
                                              <input
                                                  required
                                                  type="number"
                                                  min="1"
                                                  step="1"
                                                  value={reps}
                                                  onChange={event =>
                                                      setReps(event.target.value)
                                                  }
                                              />
                                            </label>
                                          </div>

                                          <button
                                              type="submit"
                                              disabled={storageBlocked}
                                          >
                                            Save set
                                          </button>
                                        </form>
                                    )}
                                  </div>
                              )
                            })}
                          </div>
                        </>
                    )}
                  </>
              )}

              <p role="status">{message}</p>

              <h3>Logged sets</h3>

              <p>
                Exercises: {selectedWorkout?.exercises.length ?? 0}
                {' · '}
                Sets: {totalSets}
              </p>

              {totalSets === 0 && (
                  <p className="muted">No sets logged for this day.</p>
              )}

              {selectedWorkout?.exercises.map(exercise => (
                  <article key={exercise.exerciseId}>
                    <h3>{exercise.name}</h3>

                    <ol className="set-list">
                      {exercise.sets.map(set => (
                          <li key={set.id}>
                    <span>
                      {set.weightKg} kg × {set.reps} reps
                      <small>
                        {set.loggedGroup ?? exercise.muscleGroups[0]}
                      </small>
                    </span>

                            {!isFinished && (
                                <button
                                    type="button"
                                    disabled={storageBlocked}
                                    aria-label={`Remove ${exercise.name} set: ${set.weightKg} kg, ${set.reps} reps`}
                                    onClick={() =>
                                        removeSet(exercise.exerciseId, set.id)
                                    }
                                >
                                  Remove
                                </button>
                            )}
                          </li>
                      ))}
                    </ol>
                  </article>
              ))}

              {groupScores.length > 0 && (
                  <div className="summary">
                    <h3>Muscle group summary</h3>

                    <ul>
                      {groupScores.map(score => (
                          <li key={score.group}>
                            <strong>{score.group}</strong>
                            <span>
                      {score.reps} reps · {score.sets} sets
                    </span>
                          </li>
                      ))}
                    </ul>
                  </div>
              )}

              {isFinished ? (
                  <button
                      type="button"
                      className="finish-day"
                      disabled={storageBlocked}
                      onClick={reopenDay}
                  >
                    Reopen day
                  </button>
              ) : (
                  <button
                      type="button"
                      className="finish-day"
                      disabled={totalSets === 0 || storageBlocked}
                      onClick={finishDay}
                  >
                    Finish day
                  </button>
              )}
            </section>
        )}

        <footer>
          Saved sets stay in this browser. Unsaved inputs are not stored.
        </footer>
      </main>
  )
}

export default App