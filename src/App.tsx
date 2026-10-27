import { useEffect, useState, type FormEvent } from 'react'
import logo from './assets/7599.png'
import './App.css'

type OperationType = 'income' | 'expense'

type Operation = {
  id: number
  type: OperationType
  category: string
  amount: number
  time: string
  createdAt: number
}

type Shift = {
  id: string
  startedAt: number
  endedAt: number | null
  operations: Operation[]
}

type AnalyticsPeriod = 'day' | 'week' | 'month'

const SHIFT_STORAGE_KEY = 'taxiprofit-shifts'
const LEGACY_STORAGE_KEY = 'taxiprofit-operations'

const expenseCategories = ['Топливо', 'Комиссия агрегатора', 'Мойка', 'Парковка', 'Прочее']

const incomeCategories = ['Заказ', 'Бонус', 'Прочее']

function formatMoney(amount: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount)
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Загружаем смены и при необходимости переносим старые операции.
function loadShifts(): Shift[] {
  try {
    const savedShifts = localStorage.getItem(SHIFT_STORAGE_KEY)

    if (savedShifts !== null) {
      const parsed: unknown = JSON.parse(savedShifts)

      if (Array.isArray(parsed)) {
        return parsed as Shift[]
      }
    }

    // Совместимость с предыдущей версией TaxiProfit.
    const savedOperations = localStorage.getItem(LEGACY_STORAGE_KEY)

    if (savedOperations) {
      const parsed: unknown = JSON.parse(savedOperations)

      if (Array.isArray(parsed) && parsed.length > 0) {
        return [
          {
            id: crypto.randomUUID(),
            startedAt: Date.now(),
            endedAt: null,
            operations: parsed as Operation[]
          }
        ]
      }
    }
  } catch (error) {
    console.error('Не удалось загрузить данные TaxiProfit:', error)
  }

  return []
}

function App() {
  const [shifts, setShifts] = useState<Shift[]>(loadShifts)
  const [now, setNow] = useState(Date.now())

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('week')
  const [selectedOperationsShiftId, setSelectedOperationsShiftId] = useState<string | null>(null)
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)

  const [type, setType] = useState<OperationType>('income')
  const [category, setCategory] = useState('Заказ')
  const [amount, setAmount] = useState('')

  // Сохраняем всю историю смен.
  useEffect(() => {
    try {
      localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(shifts))
    } catch (error) {
      console.error('Не удалось сохранить смены:', error)
    }
  }, [shifts])

  // Обновляем часы, но не меняем время начала смены.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  // Активная смена — та, у которой ещё нет времени завершения.
  const activeShift = shifts.find(shift => shift.endedAt === null)

  // Верхняя сводка показывает активную смену или последнюю завершённую.
  const displayedShift = activeShift ?? shifts[0]

  // В истории можно отдельно выбрать смену для просмотра её операций.
  const selectedOperationsShift =
    shifts.find(shift => shift.id === selectedOperationsShiftId) ?? displayedShift

  const operations = selectedOperationsShift?.operations ?? []

  const income = operations
    .filter(operation => operation.type === 'income')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const expenses = operations
    .filter(operation => operation.type === 'expense')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const profit = income - expenses
  // Зарплата считается от общей выручки до вычета расходов.
  const salary = income * 0.25

  const orderCount = operations.filter(
    operation => operation.type === 'income' && operation.category === 'Заказ'
  ).length

  const elapsedSeconds = displayedShift
    ? Math.max(0, Math.floor(((displayedShift.endedAt ?? now) - displayedShift.startedAt) / 1000))
    : 0

  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  // Начало выбранного аналитического периода.
  const periodStart = new Date(now)
  periodStart.setHours(0, 0, 0, 0)

  if (analyticsPeriod === 'week') {
    const daysSinceMonday = (periodStart.getDay() + 6) % 7
    periodStart.setDate(periodStart.getDate() - daysSinceMonday)
  } else if (analyticsPeriod === 'month') {
    periodStart.setDate(1)
  }

  const periodDays =
    analyticsPeriod === 'day'
      ? 1
      : analyticsPeriod === 'week'
        ? 7
        : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()

  const periodEnd = new Date(periodStart)
  periodEnd.setDate(periodEnd.getDate() + periodDays)

  // Смены, которые хотя бы частично пересекаются с выбранным периодом.
  const periodStartTime = periodStart.getTime()
  const periodEndTime = periodEnd.getTime()

  const analyticsShifts = shifts.filter(shift => {
    const shiftEnd = shift.endedAt ?? now
    return shift.startedAt < periodEndTime && shiftEnd > periodStartTime
  })

  // Для финансовой аналитики учитываем операции по дате их создания,
  // а не по дате начала смены. Это корректно работает и для смен через полночь.
  const periodOperations = shifts.flatMap(shift =>
    shift.operations.filter(operation => {
      const timestamp = operation.createdAt ?? Number(operation.id)
      return Number.isFinite(timestamp) && timestamp >= periodStartTime && timestamp < periodEndTime
    })
  )

  const analyticsIncome = periodOperations
    .filter(operation => operation.type === 'income')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const analyticsExpenses = periodOperations
    .filter(operation => operation.type === 'expense')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const analyticsProfit = analyticsIncome - analyticsExpenses

  // Считаем только то время смен, которое попало в выбранный период.
  const analyticsSeconds = analyticsShifts.reduce((total, shift) => {
    const shiftEnd = shift.endedAt ?? now
    const overlapStart = Math.max(shift.startedAt, periodStartTime)
    const overlapEnd = Math.min(shiftEnd, periodEndTime)
    return total + Math.max(0, overlapEnd - overlapStart) / 1000
  }, 0)

  const analyticsHours = analyticsSeconds / 3600

  const averageProfit = analyticsShifts.length > 0 ? analyticsProfit / analyticsShifts.length : 0

  const analyticsHourlyProfit = analyticsHours > 0 ? analyticsProfit / analyticsHours : 0

  function dateKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const chartData = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(periodStart)
    date.setDate(date.getDate() + index)

    const key = dateKey(date)

    const dayOperations = shifts.flatMap(shift =>
      shift.operations.filter(operation => {
        // Поддержка старых операций, если их ID — timestamp.
        const timestamp = operation.createdAt ?? Number(operation.id)

        if (!Number.isFinite(timestamp) || timestamp <= 0) {
          return false
        }

        return dateKey(new Date(timestamp)) === key
      })
    )


    const dayIncome = dayOperations
      .filter(operation => operation.type === 'income')
      .reduce((sum, operation) => sum + operation.amount, 0)

    const dayExpenses = dayOperations
      .filter(operation => operation.type === 'expense')
      .reduce((sum, operation) => sum + operation.amount, 0)

    return {
      key,
      label: date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      }),
      income: dayIncome,
      expenses: dayExpenses,
      profit: dayIncome - dayExpenses
    }
  })

  const chartMax = Math.max(
    1,
    ...chartData.flatMap(day => [day.income, day.expenses, Math.abs(day.profit)])
  )

  function startShift() {
    if (activeShift) return

    const newShift: Shift = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      endedAt: null,
      operations: []
    }

    setShifts(previous => [newShift, ...previous])
    setSelectedOperationsShiftId(newShift.id)
    setNow(Date.now())
    setAmount('')
  }

  function finishShift() {
    if (!activeShift) return

    const endedAt = Date.now()

    setShifts(previous =>
      previous.map(shift => (shift.id === activeShift.id ? { ...shift, endedAt } : shift))
    )

    setNow(endedAt)
  }

  function handleTypeChange(newType: OperationType) {
    setType(newType)
    setCategory(newType === 'income' ? incomeCategories[0] : expenseCategories[0])
  }

  function addOperation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!activeShift) return

    const parsedAmount = Number(amount.replace(',', '.'))

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return
    }

    const operation: Operation = {
      id: Date.now(),
      type,
      category,
      amount: parsedAmount,
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: Date.now()
    }

    setShifts(previous =>
      previous.map(shift =>
        shift.id === activeShift.id
          ? {
              ...shift,
              operations: [operation, ...shift.operations]
            }
          : shift
      )
    )

    setAmount('')
  }

  return (
    <main className='app-shell'>
      <header className='topbar'>
        <div className='brand'>
          <div className='brand-icon'>
            <img className='brand-icon-img' src={logo} alt="logo" />
          </div>
          <div>
            <h1>TaxiProfit</h1>
            <p>Контроль дохода</p>
          </div>
        </div>

        <span className={`status ${activeShift ? 'active' : ''}`}>
          <span className='status-dot' />
          {activeShift ? 'Смена идёт' : displayedShift ? 'Смена завершена' : 'Нет смены'}
        </span>
      </header>

      <section className='hero-card'>
        <div className='hero-label'>
          {displayedShift ? 'Чистый заработок за смену' : 'Чистый заработок'}
        </div>

        <div className='hero-profit'>{formatMoney(profit)}</div>

        <p className='hero-caption'>
          {displayedShift ? formatDate(displayedShift.startedAt) : 'Начни смену, чтобы вести учёт'}
        </p>

        <div className='hero-stats'>
          <div>
            <span>Выручка</span>
            <strong>{formatMoney(income)}</strong>
          </div>
          <div>
            <span>Расходы</span>
            <strong>{formatMoney(expenses)}</strong>
          </div>
          <div>
            <span>Зарплата · 25%</span>
            <strong>{formatMoney(salary)}</strong>
          </div>
        </div>
      </section>

      <section className='metrics'>
        <article className='metric-card'>
          <span className='metric-icon'>↗</span>
          <span className='metric-label'>Заказы</span>
          <strong>{orderCount}</strong>
        </article>

        <article className='metric-card'>
          <span className='metric-icon'>◷</span>
          <span className='metric-label'>Время смены</span>
          <strong>
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
            {String(seconds).padStart(2, '0')}
          </strong>
        </article>

        <article className='metric-card'>
          <span className='metric-icon'>₿</span>
          <span className='metric-label'>Заработок в час</span>
          <strong>
            {elapsedSeconds > 0 ? formatMoney(profit / (elapsedSeconds / 3600)) : formatMoney(0)}
          </strong>
        </article>
      </section>

      {/* Секция аналитики - начало */}

      <section className='panel analytics-panel'>
        <div className='section-heading'>
          <div>
            <h2>Аналитика заработка</h2>
            <p>Результаты твоей работы</p>
          </div>
          <span className='section-symbol'>↗</span>
        </div>

        <div className='analytics-tabs'>
          <button
            className={analyticsPeriod === 'day' ? 'selected' : ''}
            onClick={() => setAnalyticsPeriod('day')}
          >
            День
          </button>
          <button
            className={analyticsPeriod === 'week' ? 'selected' : ''}
            onClick={() => setAnalyticsPeriod('week')}
          >
            Неделя
          </button>
          <button
            className={analyticsPeriod === 'month' ? 'selected' : ''}
            onClick={() => setAnalyticsPeriod('month')}
          >
            Месяц
          </button>
        </div>

        <p className='analytics-date'>
          {periodStart.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
          {' — '}
          {new Date(periodEnd.getTime() - 1).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>

        <div className='analytics-summary'>
          <div className='analytics-main-stat'>
            <span>Чистая прибыль: </span>
            <strong className={analyticsProfit >= 0 ? 'positive-text' : 'negative-text'}>
              {formatMoney(analyticsProfit)}
            </strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Выручка: </span>
            <strong>{formatMoney(analyticsIncome)}</strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Расходы: </span>
            <strong className='negative-text'>{formatMoney(analyticsExpenses)}</strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Количество смен: </span>
            <strong>{analyticsShifts.length}</strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Время за рулём: </span>
            <strong>
              {Math.floor(analyticsHours)} ч {Math.floor((analyticsSeconds % 3600) / 60)} мин
            </strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Прибыль в час: </span>
            <strong>{formatMoney(analyticsHourlyProfit)}</strong>
          </div>

          <div className='analytics-stat-row'>
            <span>Средняя прибыль за смену: </span>
            <strong>{formatMoney(averageProfit)}</strong>
          </div>
        </div>

        <h3 className='chart-title'>Доходы и расходы по дням</h3>

        <div className='chart-legend'>
          <span>
            <i className='legend-income' /> Выручка
          </span>
          <span>
            <i className='legend-expenses' /> Расходы
          </span>
          <span>
            <i className='legend-profit' /> Прибыль
          </span>
        </div>

        <div className='chart-scroll'>
          <div className={`chart-grid ${analyticsPeriod === 'month' ? 'chart-month' : ''}`}>
            {chartData.map(day => (
              <div className='chart-day' key={day.key}>
                <div className='chart-bars'>
                  <div
                    className='chart-bar bar-income'
                    title={`Выручка: ${formatMoney(day.income)}`}
                    style={{
                      height: `${Math.max(3, (day.income / chartMax) * 100)}%`
                    }}
                  />

                  <div
                    className='chart-bar bar-expenses'
                    title={`Расходы: ${formatMoney(day.expenses)}`}
                    style={{
                      height: `${Math.max(3, (day.expenses / chartMax) * 100)}%`
                    }}
                  />

                  <div
                    className={`chart-bar ${day.profit < 0 ? 'bar-negative-profit' : 'bar-profit'}`}
                    title={`Прибыль: ${formatMoney(day.profit)}`}
                    style={{
                      height: `${Math.max(3, (Math.abs(day.profit) / chartMax) * 100)}%`
                    }}
                  />
                </div>
                <span className='chart-day-label'>{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        {analyticsShifts.length === 0 && (
          <p className='analytics-empty'>
            За этот период смен пока нет. Начни работать, и здесь появится статистика.
          </p>
        )}
      </section>

      {/* Секция аналитики - конец */}

      <section className='shift-controls'>
        {!activeShift ? (
          <button className='button button-primary' onClick={startShift}>
            ▶ Начать новую смену
          </button>
        ) : (
          <button className='button button-danger' onClick={finishShift}>
            ■ Завершить смену
          </button>
        )}
      </section>

      <section className='panel'>
        <div className='section-heading'>
          <div>
            <h2>Добавить операцию</h2>
            <p>Запиши доход или расход за пару секунд</p>
          </div>
          <span className='section-symbol'>＋</span>
        </div>

        {!activeShift ? (
          <div className='notice'>Чтобы учитывать операции, сначала начни смену.</div>
        ) : (
          <form className='operation-form' onSubmit={addOperation}>
            <div className='type-switch'>
              <button
                type='button'
                className={type === 'income' ? 'selected income-tab' : ''}
                onClick={() => handleTypeChange('income')}
              >
                + Доход
              </button>

              <button
                type='button'
                className={type === 'expense' ? 'selected expense-tab' : ''}
                onClick={() => handleTypeChange('expense')}
              >
                − Расход
              </button>
            </div>

            <label htmlFor='category'>Категория</label>
            <select
              id='category'
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              {(type === 'income' ? incomeCategories : expenseCategories).map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label htmlFor='amount'>Сумма (BYN)</label>
            <input
              id='amount'
              type='number'
              min='0.01'
              step='0.01'
              inputMode='decimal'
              placeholder='Например, 25.50'
              value={amount}
              onChange={event => setAmount(event.target.value)}
              required
            />

            <button className='button button-primary' type='submit'>
              Добавить операцию
            </button>
          </form>
        )}
      </section>


      <section className='panel'>
        <div className='section-heading'>
          <div>
            <h2>История операций</h2>
            <p>
              {selectedOperationsShift
                ? `Смена от ${formatDateTime(selectedOperationsShift.startedAt)} · ${operations.length} записей`
                : 'Выбери смену, чтобы посмотреть операции'}
            </p>
          </div>
        </div>

        {operations.length === 0 ? (
          <div className='empty-state'>
            <div className='empty-icon'>▤</div>
            <strong>Пока нет операций</strong>
            <p>Начни смену и добавь первый доход.</p>
          </div>
        ) : (
          <div className='operation-list'>
            {operations.map(operation => (
              <article className='operation-item' key={operation.id}>
                <div
                  className={`operation-icon ${
                    operation.type === 'income' ? 'positive' : 'negative'
                  }`}
                >
                  {operation.type === 'income' ? '+' : '−'}
                </div>

                <div className='operation-details'>
                  <strong>{operation.category}</strong>
                  <span>{operation.time}</span>
                </div>

                <strong className={operation.type === 'income' ? 'positive-text' : 'negative-text'}>
                  {operation.type === 'income' ? '+' : '−'}
                  {formatMoney(operation.amount)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className='panel'>
        <div className='section-heading'>
          <div>
            <h2>История смен</h2>
            <p>Всего смен: {shifts.length}</p>
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className='empty-state'>
            <div className='empty-icon'>◷</div>
            <strong>История пока пуста</strong>
            <p>Завершённые смены будут появляться здесь.</p>
          </div>
        ) : (
          <div className='shift-history'>
            {shifts.map(shift => {
              const shiftIncome = shift.operations
                .filter(operation => operation.type === 'income')
                .reduce((sum, operation) => sum + operation.amount, 0)

              const shiftExpenses = shift.operations
                .filter(operation => operation.type === 'expense')
                .reduce((sum, operation) => sum + operation.amount, 0)

              const shiftSalary = shiftIncome * 0.25
              const shiftOrderCount = shift.operations.filter(
                operation => operation.type === 'income' && operation.category === 'Заказ'
              ).length
              const isExpanded = expandedShiftId === shift.id

              const duration = Math.max(
                0,
                Math.floor(((shift.endedAt ?? now) - shift.startedAt) / 1000)
              )

              const durationHours = Math.floor(duration / 3600)
              const durationMinutes = Math.floor((duration % 3600) / 60)

              return (
                <article className='shift-history-item' key={shift.id}>
                  <div className='shift-history-top'>
                    <div>
                      <strong>{formatDate(shift.startedAt)}</strong>
                      <span>
                        {formatDateTime(shift.startedAt)}
                        {' — '}
                        {shift.endedAt ? formatDateTime(shift.endedAt) : 'Сейчас'}
                      </span>
                    </div>

                    <span className={`shift-badge ${shift.endedAt === null ? 'ongoing' : ''}`}>
                      {shift.endedAt === null ? 'Активна' : 'Завершена'}
                    </span>
                  </div>

                  <div className='shift-history-stats'>
                    <div>
                      <span>Выручка: </span>
                      <strong>{formatMoney(shiftIncome)}</strong>
                    </div>
                    <div>
                      <span>Расходы: </span>
                      <strong>{formatMoney(shiftExpenses)}</strong>
                    </div>
                    <div>
                      <span>Прибыль: </span>
                      <strong
                        className={
                          shiftIncome - shiftExpenses >= 0 ? 'positive-text' : 'negative-text'
                        }
                      >
                        {formatMoney(shiftIncome - shiftExpenses)}
                      </strong>
                    </div>
                  </div>

                  <div className='shift-duration'>
                    Длительность: {durationHours} ч {durationMinutes} мин
                    {' · '}
                    Операций: {shift.operations.length}
                  </div>

                  <button
                    type='button'
                    className='button button-primary shift-details-button'
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedShiftId(isExpanded ? null : shift.id)
                      setSelectedOperationsShiftId(shift.id)
                    }}
                  >
                    {isExpanded ? 'Скрыть подробности' : 'Подробнее о смене'}
                    <span aria-hidden='true'>{isExpanded ? '⌃' : '⌄'}</span>
                  </button>

                  {isExpanded && (
                    <div className='shift-details'>
                      <div className='shift-details-summary'>
                        <div>
                          <span>Зарплата · 25%</span>
                          <strong>{formatMoney(shiftSalary)}</strong>
                        </div>
                        <div>
                          <span>Заказы</span>
                          <strong>{shiftOrderCount}</strong>
                        </div>
                        <div>
                          <span>Всего операций</span>
                          <strong>{shift.operations.length}</strong>
                        </div>
                      </div>

                      <h3>Операции смены</h3>
                      {shift.operations.length === 0 ? (
                        <p className='shift-details-empty'>В этой смене пока нет операций.</p>
                      ) : (
                        <div className='shift-details-operations'>
                          {shift.operations.map(operation => (
                            <div className='shift-details-operation' key={operation.id}>
                              <span
                                className={`shift-details-operation-icon ${
                                  operation.type === 'income' ? 'positive' : 'negative'
                                }`}
                                aria-hidden='true'
                              >
                                {operation.type === 'income' ? '+' : '−'}
                              </span>
                              <div className='shift-details-operation-info'>
                                <strong>{operation.category}</strong>
                                <span>{operation.time}</span>
                              </div>
                              <strong
                                className={
                                  operation.type === 'income' ? 'positive-text' : 'negative-text'
                                }
                              >
                                {operation.type === 'income' ? '+' : '−'}{formatMoney(operation.amount)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <footer>TaxiProfit · Учёт каждой смены</footer>
    </main>
  )
}

export default App
