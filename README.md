# Mensageria_de_email

Sistemas Distribuídos e Infraestrutura em Nuvem <br><br><br>
Trabalho Prático — Sistema de Filas Distribuídas com Implementação Manual
1. Contexto e Objetivo
Sistemas distribuídos modernos dependem fortemente do conceito de fila de mensagens para desacoplar produtores de consumidores, absorver picos de carga e garantir que nenhuma tarefa seja perdida. Ferramentas como RabbitMQ, Kafka e SQS implementam essas filas internamente, mas o que acontece por baixo?

Neste trabalho, você vai construir esse mecanismo do zero. O objetivo é implementar um sistema distribuído de processamento de tarefas genéricas onde toda a lógica de fila é de responsabilidade da sua própria aplicação, sem bibliotecas de mensageria prontas.

O nome da fila determina quem processa a tarefa: workers registrados para uma fila específica buscam e processam apenas as tarefas daquela fila.
