import { useEffect, useState } from 'react'
import './App.css'

type OperationType = 'income' | 'expense'

type Operation = {
  id: number
  type: OperationType
  category: string
  amount: number
  time: string
}

const expenseCategories = [
  'Бензин',
  'Газ',
  'Техжидкости',
  'Мойка',
  'Парковка',
  'Запчасти',
  'Прочее'
]

const incomeCategories = [
  'Нал. База',
  'Безнал База',
  'Нал. Яндекс',
  'Безнал Яндекс',
  'Чаевые',
  'Бонус',
  'Прочее'
]

function formatMoney(amount: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2
  }).format(amount)
}

function App() {
  const [isShiftActive, setIsShiftActive] = useState(false)
  const [shiftStartedAt, setShiftStartedAt] = useState<number | null>(null)
  const [shiftEndedAt, setShiftEndedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())

  const [operations, setOperations] = useState<Operation[]>([])
  const [type, setType] = useState<OperationType>('income')
  const [category, setCategory] = useState('Заказ')
  const [amount, setAmount] = useState('')

  // Восстанавливаем операции после перезагрузки страницы
  useEffect(() => {
    try {
      const savedOperations = localStorage.getItem('taxiprofit-operations')

      if (savedOperations) {
        setOperations(JSON.parse(savedOperations) as Operation[])
      }
    } catch {
      console.error('Не удалось загрузить сохранённые операции')
    }
  }, [])

  // Сохраняем операции при каждом изменении
  useEffect(() => {
    localStorage.setItem('taxiprofit-operations', JSON.stringify(operations))
  }, [operations])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const income = operations
    .filter(operation => operation.type === 'income')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const expenses = operations
    .filter(operation => operation.type === 'expense')
    .reduce((sum, operation) => sum + operation.amount, 0)

  const profit = income - expenses

  const orderCount = operations.filter(
    operation => operation.type === 'income' && operation.category === 'Заказ'
  ).length

  const elapsedSeconds =
    shiftStartedAt === null
      ? 0
      : Math.max(0, Math.floor(((shiftEndedAt ?? now) - shiftStartedAt) / 1000))

  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  function startShift() {
    setOperations([])
    setShiftStartedAt(Date.now())
    setShiftEndedAt(null)
    setIsShiftActive(true)
    setNow(Date.now())
  }

  function finishShift() {
    setShiftEndedAt(Date.now())
    setIsShiftActive(false)
  }

  function handleTypeChange(newType: OperationType) {
    setType(newType)
    setCategory(newType === 'income' ? incomeCategories[0] : expenseCategories[0])
  }

  function addOperation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedAmount = Number(amount.replace(',', '.'))

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return
    }

    setOperations(previous => [
      {
        id: Date.now(),
        type,
        category,
        amount: parsedAmount,
        time: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      ...previous
    ])

    setAmount('')
  }

  return (
    <main className='app-shell'>
      <header className='topbar'>
        <div className='brand'>
          <div className='brand-icon'>181</div>
          <div>
            <h1>TaxiProfit</h1>
            <p>Твой заработок под контролем</p>
          </div>
        </div>
        <span className={`status ${isShiftActive ? 'active' : ''}`}>
          <span className='status-dot' />
          {isShiftActive ? 'Смена идёт' : shiftEndedAt ? 'Смена завершена' : 'Нет смены'}
        </span>
      </header>

      <section className='hero-card'>
        <div className='hero-label'>Чистый заработок</div>
        <div className='hero-profit'>{formatMoney(profit)}</div>
        <p className='hero-caption'>Доходы минус расходы</p>

        <div className='hero-stats'>
          <div>
            <span>Выручка</span>
            <strong>{formatMoney(income)}</strong>
          </div>
          <div>
            <span>Расходы</span>
            <strong>{formatMoney(expenses)}</strong>
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

      <section className='shift-controls'>
        {!isShiftActive ? (
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

        {!isShiftActive ? (
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
            <p>{operations.length} записей за смену</p>
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

      <footer>TaxiProfit · Учёт каждой смены · ПК Линия · 181 / 7599</footer>
    </main>
  )
}

export default App
