Sistemas Distribuídos e Infraestrutura em Nuvem
Trabalho Prático — Sistema de Filas Distribuídas com Implementação Manual


1. Contexto e Objetivo
Sistemas distribuídos modernos dependem fortemente do conceito de fila de mensagens para desacoplar produtores de consumidores, absorver picos de carga e garantir que nenhuma tarefa seja perdida. Ferramentas como RabbitMQ, Kafka e SQS implementam essas filas internamente, mas o que acontece por baixo?

Neste trabalho, você vai construir esse mecanismo do zero. O objetivo é implementar um sistema distribuído de processamento de tarefas genéricas onde toda a lógica de fila é de responsabilidade da sua própria aplicação, sem bibliotecas de mensageria prontas.

O nome da fila determina quem processa a tarefa: workers registrados para uma fila específica buscam e processam apenas as tarefas daquela fila.

2. Arquitetura do Sistema
O sistema é composto por quatro componentes que se comunicam exclusivamente via HTTP REST:

2.1 Front-end
Interface web que permite ao usuário criar tarefas, escolher a fila de destino e acompanhar o status de cada tarefa enviada. Comunica-se exclusivamente com a API Centralizadora.

A fim de simplificar a implementação, é permitido utilizar uma ferramenta como o Postman para testar a API.

Portanto, a apresentação de um front-end não é obrigatória.

2.2 API Centralizadora
O coração do sistema. É responsável por:

Receber novas tarefas do front-end e inseri-las na fila correta no banco de dados;
Expor endpoints para que os workers busquem a próxima tarefa disponível;
Atualizar o status das tarefas conforme os workers reportam progresso ou conclusão;
Garantir que dois workers não peguem a mesma tarefa simultaneamente;
Listar filas ativas e quantidade de tarefas em cada status.
2.3 Banco de Dados
O banco de dados é onde a fila vive. A tabela de tarefas é a fila. O esquema deve suportar o ciclo de vida completo de uma tarefa:

CREATE TABLE tasks (
  id          UUID PRIMARY KEY,
  queue_name  VARCHAR(100) NOT NULL,
  payload     JSONB NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts    INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
O campo status representa o ciclo de vida da tarefa:

Status	Significado	Transição
pending	Tarefa enfileirada, aguardando worker	Estado inicial após POST /tasks
processing	Um worker retirou a tarefa e está processando	Após dequeue pelo worker
done	Processamento concluído com sucesso	Worker reporta conclusão
error	Falhou após todas as tentativas	Worker reporta erro (esgotou retries)
2.4 Workers
Serviços independentes que consultam periodicamente a API Centralizadora em busca de tarefas para processar. Cada worker é configurado para escutar apenas uma fila específica.

3. Endpoints da API Centralizadora
Abaixo estão os endpoints mínimos que a API deve implementar. O grupo pode adicionar endpoints extras, mas não pode remover nenhum dos listados:

Método	Endpoint	Descrição
POST	/tasks	Enfileira nova tarefa.
GET	/tasks/:id	Retorna detalhes e status atual de uma tarefa.
GET	/tasks/next/:queue_name	Dequeue: retorna e reserva a próxima tarefa pendente da fila informada.
PUT/PATCH	/tasks/:id	Atualiza o status de uma tarefa (done, error, pending) e seu resultado.
3.1 Dequeue com Exclusão Mútua
O endpoint GET /tasks/next/:queue_name é o mais crítico do sistema. Ele deve garantir que duas chamadas simultâneas (de dois workers da mesma fila) nunca retornem a mesma tarefa.

3.2 Exemplos de Corpo das Requisições
POST /tasks — Enfileirar tarefa
{
  "queue_name": "email",
  "payload": {
    "destinatario": "aluno@unixpto.br",
    "assunto": "Confirmação de matrícula",
    "corpo": "Sua matrícula foi confirmada."
  }
}
PATCH /tasks/:id — Worker reporta resultado
{ "status": "done" }
{ "status": "pending" }
{ "status": "error" }
4. Requisitos
4.1 Funcionais — Obrigatórios
RF-01: A API deve receber tarefas via POST /tasks e armazená-las no banco com status pending.
RF-02: O endpoint GET /tasks/next/:queue_name deve retornar e reservar a próxima tarefa pendente da fila solicitada.
RF-03: Dois workers da mesma fila não podem receber a mesma tarefa (sem duplicação).
RF-04: Workers devem consultar a API via polling a cada N segundos. Esse tempo deve ser configurável via variável de ambiente.
RF-05: Cada worker deve implementar retry: em caso de erro, a tarefa volta para pending até atingir o limite de tentativas. Esse limite também deve ser configurável via variável de ambiente.
RF-06: Todos os serviços devem rodar via Docker, sem configuração manual adicional.
RF-07: Devem existir pelo menos 2 workers para cada fila criada. Esses workers devem rodar em paralelo. Utilizar as réplicas do docker para isso.
4.2 Técnicos
Linguagem da API Centralizadora: Java.
Linguagem dos Workers: Java ou Python.
Banco de dados: PostgreSQL ou MongoDB.
Comunicação entre todos os componentes: REST exclusivamente.
Nenhuma biblioteca de mensageria (RabbitMQ, Kafka, BullMQ, Celery, etc.) pode ser utilizada.