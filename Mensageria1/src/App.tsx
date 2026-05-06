import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Task = {
  id: string
  queueName: string
  payload: unknown
  status: string
  attempts: number
  createdAt: string
  updatedAt: string
}

type Stats = {
  queues: Record<string, Record<string, number>>
  total_tasks: number
  timestamp: string
}

type RequestLog = {
  id: number
  title: string
  method: string
  endpoint: string
  status: 'success' | 'error'
  timestamp: string
  details: unknown
}

const API_BASE = '/api/tasks'

const initialPayload = JSON.stringify(
  {
    destinatario: 'teste@email.com',
    assunto: 'Teste',
    corpo: 'Ola',
  },
  null,
  2,
)

function App() {
  const [queueName, setQueueName] = useState('email')
  const [payload, setPayload] = useState(initialPayload)
  const [taskId, setTaskId] = useState('')
  const [nextQueue, setNextQueue] = useState('email')
  const [statusTaskId, setStatusTaskId] = useState('')
  const [statusValue, setStatusValue] = useState('done')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('Pronto para testar a API.')
  const [autoRefresh, setAutoRefresh] = useState(true)

  function addLog(entry: Omit<RequestLog, 'id' | 'timestamp'>) {
    setLogs((current) => [
      {
        ...entry,
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      },
      ...current,
    ])
  }

  async function requestApi<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const response = await fetch(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })

    const rawBody = await response.text()
    const parsedBody = rawBody ? safeJsonParse(rawBody) : null

    if (!response.ok) {
      const message =
        typeof parsedBody === 'string'
          ? parsedBody
          : rawBody || `Erro ${response.status} ao acessar a API.`
      throw new Error(message)
    }

    return parsedBody as T
  }

  async function runAction(
    actionName: string,
    title: string,
    method: string,
    endpoint: string,
    execute: () => Promise<Task | null>,
  ) {
    setBusyAction(actionName)

    try {
      const task = await execute()
      setSelectedTask(task)

      if (task?.id) {
        setTaskId(task.id)
        setStatusTaskId(task.id)
      }

      setFeedback(task ? `${title} executado com sucesso.` : `${title} sem retorno de tarefa.`)
      addLog({
        title,
        method,
        endpoint,
        status: 'success',
        details: task ?? { message: 'Sem conteúdo retornado pela API.' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado.'
      setFeedback(message)
      addLog({
        title,
        method,
        endpoint,
        status: 'error',
        details: { message },
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payloadText = payload.trim()
    let parsedPayload: unknown

    if (!queueName.trim()) {
      setFeedback('Informe o nome da fila antes de criar a task.')
      return
    }

    if (!payloadText) {
      setFeedback('Informe um payload JSON válido.')
      return
    }

    try {
      parsedPayload = JSON.parse(payloadText)
    } catch {
      setFeedback('O payload precisa ser um JSON válido para salvar no campo jsonb.')
      return
    }

    await runAction(
      'create',
      'Criar task',
      'POST',
      API_BASE,
      () =>
        requestApi<Task>(API_BASE, {
          method: 'POST',
          body: JSON.stringify({
            queueName: queueName.trim(),
            payload: parsedPayload,
          }),
        }),
    )
  }

  async function handleFind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!taskId.trim()) {
      setFeedback('Informe o ID da task para consultar.')
      return
    }

    const endpoint = `${API_BASE}/${taskId.trim()}`

    await runAction('find', 'Buscar por ID', 'GET', endpoint, () =>
      requestApi<Task>(endpoint),
    )
  }

  async function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!nextQueue.trim()) {
      setFeedback('Informe a fila para buscar a próxima task.')
      return
    }

    const endpoint = `${API_BASE}/next/${encodeURIComponent(nextQueue.trim())}`

    await runAction('next', 'Consumir próxima task', 'GET', endpoint, () =>
      requestApi<Task | null>(endpoint),
    )
  }

  async function handleUpdateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!statusTaskId.trim()) {
      setFeedback('Informe o ID da task para atualizar o status.')
      return
    }

    const endpoint = `${API_BASE}/${statusTaskId.trim()}`

    await runAction(
      'update',
      'Atualizar status',
      'PATCH',
      endpoint,
      () =>
        requestApi<Task>(endpoint, {
          method: 'PATCH',
          body: JSON.stringify({
            status: statusValue,
          }),
        }),
    )
  }

  async function handleGetStats(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyAction('stats')

    try {
      const statsData = await requestApi<Stats>(`${API_BASE}/stats`)
      setStats(statsData)
      setFeedback('Estatísticas carregadas com sucesso.')
      addLog({
        title: 'Obter Estatísticas',
        method: 'GET',
        endpoint: `${API_BASE}/stats`,
        status: 'success',
        details: statsData,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar estatísticas.'
      setFeedback(message)
      addLog({
        title: 'Obter Estatísticas',
        method: 'GET',
        endpoint: `${API_BASE}/stats`,
        status: 'error',
        details: { message },
      })
    } finally {
      setBusyAction(null)
    }
  }

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(async () => {
      try {
        const statsData = await requestApi<Stats>(`${API_BASE}/stats`)
        setStats(statsData)
      } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <h1>Teste de Mensageria</h1>
        </div>

      </section>

      <section className="dashboard">
        <div className="forms-grid">
          <form className="panel" onSubmit={handleCreate}>
            <div className="panel-header">
              <h2>Criar task</h2>
              <span className="endpoint-tag">POST /tasks</span>
            </div>

            <label>
              Nome da fila
              <input
                value={queueName}
                onChange={(event) => setQueueName(event.target.value)}
                placeholder="email"
              />
            </label>

            <label>
              Payload JSON
              <textarea
                value={payload}
                onChange={(event) => setPayload(event.target.value)}
                rows={8}
                placeholder='{"destinatario":"teste@email.com","assunto":"Teste","corpo":"Ola"}'
              />
            </label>

            <button type="submit" disabled={busyAction === 'create'}>
              {busyAction === 'create' ? 'Enviando...' : 'Criar task'}
            </button>
          </form>

          <form className="panel" onSubmit={handleFind}>
            <div className="panel-header">
              <h2>Buscar por ID</h2>
              <span className="endpoint-tag">GET /tasks/{'{id}'}</span>
            </div>

            <label>
              ID da task
              <input
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                placeholder="UUID da task"
              />
            </label>

            <button type="submit" disabled={busyAction === 'find'}>
              {busyAction === 'find' ? 'Consultando...' : 'Buscar task'}
            </button>
          </form>

          <form className="panel" onSubmit={handleNext}>
            <div className="panel-header">
              <h2>Proxima da fila</h2>
              <span className="endpoint-tag">GET /tasks/next/{'{queue}'}</span>
            </div>

            <label>
              Fila
              <input
                value={nextQueue}
                onChange={(event) => setNextQueue(event.target.value)}
                placeholder="email"
              />
            </label>

            <button type="submit" disabled={busyAction === 'next'}>
              {busyAction === 'next' ? 'Buscando...' : 'Consumir proxima'}
            </button>
          </form>

          <form className="panel" onSubmit={handleUpdateStatus}>
            <div className="panel-header">
              <h2>Atualizar status</h2>
              <span className="endpoint-tag">PATCH /tasks/{'{id}'}</span>
            </div>

            <label>
              ID da task
              <input
                value={statusTaskId}
                onChange={(event) => setStatusTaskId(event.target.value)}
                placeholder="UUID da task"
              />
            </label>

            <label>
              Novo status
              <select
                value={statusValue}
                onChange={(event) => setStatusValue(event.target.value)}
              >
                <option value="done">done</option>
                <option value="processing">processing</option>
                <option value="pending">pending</option>
                <option value="error">error</option>
              </select>
            </label>

            <button type="submit" disabled={busyAction === 'update'}>
              {busyAction === 'update' ? 'Atualizando...' : 'Salvar status'}
            </button>
          </form>

          <form className="panel" onSubmit={handleGetStats}>
            <div className="panel-header">
              <h2>Estatísticas</h2>
              <span className="endpoint-tag">GET /tasks/stats</span>
            </div>

            <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
              Visualize o status de todas as filas e tarefas
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
              Auto-atualizar (a cada 2s)
            </label>

            <button type="submit" disabled={busyAction === 'stats'}>
              {busyAction === 'stats' ? 'Carregando...' : 'Carregar Estatísticas'}
            </button>
          </form>
        </div>

        <aside className="side-column">
          <section className="panel result-panel">
            <div className="panel-header">
              <h2>Monitoramento de Workers</h2>
              <span className="feedback">{autoRefresh ? '🔄 Ao vivo' : '⏸️ Parado'}</span>
            </div>

            {stats ? (
              <div className="stats-card">
                <div className="stats-meta">
                  <span>Total: {stats.total_tasks}</span>
                  <span>{new Date(stats.timestamp).toLocaleTimeString('pt-BR')}</span>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  {Object.entries(stats.queues).length === 0 ? (
                    <p className="empty-state">Nenhuma fila com tarefas</p>
                  ) : (
                    Object.entries(stats.queues).map(([queueName, statusCounts]) => (
                      <div key={queueName} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: queueName === 'email' ? '#e8f4f8' : '#f8e8f4', borderRadius: '8px', border: '2px solid #ccc' }}>
                        <strong style={{ fontSize: '1.1em' }}>📬 {queueName.toUpperCase()}</strong>
                        <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {Object.entries(statusCounts).map(([status, count]) => (
                            <div key={status} style={{ padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
                              <span className={`pill pill-${status}`}>{status}</span>
                              <strong style={{ float: 'right' }}>{count}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="empty-state">
                Clique em "Carregar Estatísticas" para ativar o monitoramento
              </p>
            )}
          </section>

          <section className="panel result-panel">
            <div className="panel-header">
              <h2>Ultima resposta</h2>
              <span className="feedback">{feedback}</span>
            </div>

            {selectedTask ? (
              <div className="task-card">
                <div className="task-meta">
                  <span className={`pill pill-${selectedTask.status}`}>
                    {selectedTask.status}
                  </span>
                  <span>Tentativas: {selectedTask.attempts}</span>
                </div>

                <dl>
                  <div>
                    <dt>ID</dt>
                    <dd>{selectedTask.id}</dd>
                  </div>
                  <div>
                    <dt>Fila</dt>
                    <dd>{selectedTask.queueName}</dd>
                  </div>
                  <div>
                    <dt>Criado em</dt>
                    <dd>{selectedTask.createdAt}</dd>
                  </div>
                  <div>
                    <dt>Atualizado em</dt>
                    <dd>{selectedTask.updatedAt}</dd>
                  </div>
                </dl>

                <div>
                  <h3>Payload</h3>
                  <pre>{formatPayload(selectedTask.payload)}</pre>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                Execute uma acao para visualizar a resposta da API aqui.
              </p>
            )}
          </section>

          <section className="panel log-panel">
            <div className="panel-header">
              <h2>Historico rapido</h2>
              <span className="endpoint-tag">{logs.length} chamadas</span>
            </div>

            {logs.length === 0 ? (
              <p className="empty-state">Nenhuma chamada feita ainda.</p>
            ) : (
              <div className="log-list">
                {logs.map((log) => (
                  <article key={log.id} className="log-item">
                    <div className="log-topline">
                      <strong>{log.title}</strong>
                      <span className={`log-status log-status-${log.status}`}>
                        {log.status}
                      </span>
                    </div>
                    <p>
                      {log.method} {log.endpoint}
                    </p>
                    <small>{log.timestamp}</small>
                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  )
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function formatPayload(payloadValue: unknown) {
  if (typeof payloadValue === 'string') {
    const parsed = safeJsonParse(payloadValue)

    if (typeof parsed === 'string') {
      return parsed
    }

    return JSON.stringify(parsed, null, 2)
  }

  return JSON.stringify(payloadValue, null, 2)
}

export default App
