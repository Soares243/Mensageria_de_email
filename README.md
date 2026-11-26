# Sistemas Distribuídos e Infraestrutura em Nuvem
## Trabalho Prático — Implementação Manual de um Sistema de Filas Distribuídas

### 1. Contextualização e Objetivo

Os sistemas distribuídos modernos utilizam filas de mensagens como mecanismo fundamental para permitir a comunicação assíncrona entre diferentes serviços, promovendo o desacoplamento entre produtores e consumidores, o gerenciamento de picos de processamento e a confiabilidade na execução de tarefas.

Tecnologias como RabbitMQ, Apache Kafka e Amazon SQS oferecem soluções consolidadas para esse tipo de arquitetura. Entretanto, compreender seu funcionamento interno é essencial para o desenvolvimento de aplicações distribuídas eficientes e escaláveis.

Neste trabalho, o objetivo é desenvolver, do zero, um sistema distribuído de processamento de tarefas genéricas, implementando manualmente toda a lógica de gerenciamento de filas, sem utilizar bibliotecas ou plataformas de mensageria prontas.

A aplicação deverá permitir que diferentes produtores enviem tarefas para filas específicas, enquanto workers independentes serão responsáveis por consultar, retirar e processar exclusivamente as tarefas destinadas às filas para as quais foram configurados.

### 2. Arquitetura do Sistema

A arquitetura deverá ser composta por quatro componentes principais, que se comunicarão exclusivamente por meio de requisições HTTP REST.

#### 2.1. Front-end

Responsável por fornecer uma interface de interação com o usuário, permitindo:

- Criar e enviar novas tarefas;
- Selecionar a fila de destino;
- Consultar tarefas cadastradas;
- Acompanhar o status de processamento;
- Visualizar os resultados das tarefas executadas.

A comunicação do front-end deverá ocorrer exclusivamente com a API Centralizadora.

**Observação:** A implementação de uma interface gráfica não é obrigatória. Para simplificar o desenvolvimento, é permitido utilizar ferramentas como Postman para realizar requisições e testar os endpoints da API.

#### 2.2. API Centralizadora

Representa o núcleo operacional do sistema, sendo responsável por gerenciar a comunicação entre os produtores, o banco de dados e os workers.

Suas principais responsabilidades são:

- Receber novas tarefas e armazená-las na fila correspondente;
- Disponibilizar endpoints para consulta e retirada de tarefas pelos workers;
- Controlar e atualizar o ciclo de vida das tarefas;
- Registrar os resultados dos processamentos;
- Garantir a exclusividade na retirada de tarefas, impedindo que dois workers processem simultaneamente a mesma tarefa;
- Disponibilizar informações sobre as filas existentes e a quantidade de tarefas em cada estado.

#### 2.3. Banco de Dados

O banco de dados será responsável pelo armazenamento persistente das tarefas e pelo gerenciamento dos estados de processamento.

A própria tabela de tarefas representará a estrutura das filas, sendo identificada pelo campo `queue_name`.

O esquema deverá suportar o ciclo de vida completo das tarefas, utilizando como referência a seguinte estrutura:

```sql
CREATE TABLE tasks (
    id          UUID PRIMARY KEY,
    queue_name  VARCHAR(100) NOT NULL,
    payload     JSONB NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts    INT DEFAULT 0,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);
```

**Estados possíveis das tarefas:**

| Status | Significado | Transição |
|---|---|---|
| `pending` | Tarefa cadastrada e aguardando processamento. | Estado inicial após POST /tasks. |
| `processing` | Tarefa reservada por um worker e em processamento. | Após a retirada da tarefa pelo worker. |
| `done` | Processamento concluído com sucesso. | Após confirmação de conclusão pelo worker. |
| `error` | Processamento encerrado sem sucesso após o esgotamento das tentativas. | Após atingir o limite de retries. |

#### 2.4. Workers

Os workers serão serviços independentes responsáveis pela execução das tarefas armazenadas nas filas.

Cada worker deverá ser configurado para monitorar uma fila específica, consultando periodicamente a API Centralizadora em busca de novas tarefas disponíveis.

Suas responsabilidades incluem:

- Consultar a API por meio de requisições HTTP;
- Retirar tarefas pendentes da fila correspondente;
- Executar o processamento definido para cada tarefa;
- Comunicar à API o resultado da execução;
- Implementar mecanismos de retry em caso de falhas;
- Atualizar o status da tarefa conforme o resultado do processamento.

Os workers deverão operar de maneira independente e paralela.

### 3. Endpoints da API Centralizadora

A API deverá implementar, obrigatoriamente, os seguintes endpoints. O grupo poderá adicionar funcionalidades complementares, mas não poderá remover nenhum dos endpoints especificados.

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/tasks` | Recebe e armazena uma nova tarefa na fila especificada. |
| GET | `/tasks/:id` | Retorna os detalhes e o status atual de uma tarefa. |
| GET | `/tasks/next/:queue_name` | Busca e reserva a próxima tarefa pendente da fila informada. |
| PUT/PATCH | `/tasks/:id` | Atualiza o status da tarefa e registra o resultado do processamento. |

#### 3.1. Mecanismo de Dequeue e Exclusão Mútua

O endpoint `GET /tasks/next/:queue_name` representa uma das operações mais importantes do sistema.

Sua implementação deverá garantir a exclusividade na retirada das tarefas, impedindo que dois ou mais workers da mesma fila recebam simultaneamente a mesma tarefa.

Para isso, deverá ser implementado um mecanismo de controle de concorrência que assegure a reserva atômica da tarefa no banco de dados.

Após a retirada, a tarefa deverá ter seu status atualizado para `processing`, impedindo que outros workers a selecionem novamente enquanto estiver reservada.

#### 3.2. Exemplos de Requisições

**POST /tasks — Cadastro de uma nova tarefa**

```json
{
  "queue_name": "email",
  "payload": {
    "destinatario": "aluno@unixpto.br",
    "assunto": "Confirmação de matrícula",
    "corpo": "Sua matrícula foi confirmada."
  }
}
```

**PATCH /tasks/:id — Atualização do resultado**

Conclusão com sucesso:

```json
{
  "status": "done"
}
```

Nova tentativa de processamento:

```json
{
  "status": "pending"
}
```

Falha após o esgotamento das tentativas:

```json
{
  "status": "error"
}
```

### 4. Requisitos do Sistema

#### 4.1. Requisitos Funcionais — Obrigatórios

- **RF-01:** A API deverá receber novas tarefas por meio do endpoint `POST /tasks`, armazenando-as no banco de dados com status inicial `pending`.

- **RF-02:** O endpoint `GET /tasks/next/:queue_name` deverá localizar, retornar e reservar a próxima tarefa pendente da fila solicitada.

- **RF-03:** O sistema deverá garantir que dois workers da mesma fila não recebam a mesma tarefa simultaneamente, evitando duplicidade de processamento.

- **RF-04:** Os workers deverão consultar periodicamente a API Centralizadora por meio de polling. O intervalo entre as consultas deverá ser configurável por variável de ambiente.

- **RF-05:** Cada worker deverá implementar um mecanismo de retry. Em caso de falha, a tarefa deverá retornar ao estado `pending` enquanto não atingir o limite máximo de tentativas. Após o esgotamento das tentativas, deverá receber o status `error`. O limite deverá ser configurável por variável de ambiente.

- **RF-06:** Todos os componentes do sistema deverão ser executados por meio do Docker, sem necessidade de configurações manuais adicionais para inicialização.

- **RF-07:** Deverão existir, no mínimo, dois workers para cada fila criada. Os workers deverão executar em paralelo, utilizando o mecanismo de réplicas do Docker.

#### 4.2. Requisitos Técnicos

| Componente | Tecnologia / Restrição |
|---|---|
| API Centralizadora | Java (obrigatório). |
| Workers | Java ou Python. |
| Banco de Dados | PostgreSQL ou MongoDB. |
| Comunicação | HTTP REST exclusivamente. |
| Containerização | Docker. |
| Escalabilidade dos workers | Réplicas de containers. |
| Mensageria | Implementação manual, sem ferramentas prontas. |

**Restrição tecnológica:** Não será permitido utilizar bibliotecas, frameworks ou plataformas de mensageria que implementem automaticamente o gerenciamento das filas, como RabbitMQ, Apache Kafka, BullMQ, Celery ou equivalentes.

Toda a lógica de enfileiramento, retirada, reserva, controle de concorrência, atualização de estados e novas tentativas deverá ser desenvolvida pela própria equipe.
