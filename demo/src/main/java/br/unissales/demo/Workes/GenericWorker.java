package br.unissales.demo.Workes;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import br.unissales.demo.Entity.Task;


@Component
@EnableScheduling
@ConditionalOnProperty(name = "app.worker-enabled", havingValue = "true")
public class GenericWorker {

    private static final Logger logger = LoggerFactory.getLogger(GenericWorker.class);

    @Autowired
    private RestTemplate restTemplate;

    @Value("${app.worker-queue:default}")
    private String workerQueue;

    @Value("${app.polling-interval:5000}")
    private long pollingInterval;

    private final String API_URL = "http://api:8080";

    @Scheduled(fixedDelayString = "${app.polling-interval:5000}")
    public void process() {
        try {
            ResponseEntity<Task> response = restTemplate.getForEntity(
                    API_URL + "/tasks/next/" + workerQueue, Task.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Task task = response.getBody();
                logger.info("Worker [{}] processando tarefa: {}", workerQueue, task.getId());

                boolean success = processTask(task);

                String status = success ? "done" : "error";

                try {
                    restTemplate.patchForObject(
                            API_URL + "/tasks/" + task.getId(),
                            Map.of("status", status),
                            Void.class);
                    logger.info("Tarefa {} atualizada para status: {}", task.getId(), status);
                } catch (Exception e) {
                    logger.error("Erro ao atualizar status da tarefa: {}", task.getId(), e);
                }
            }

        } catch (Exception e) {
            logger.debug("Nenhuma tarefa disponível para fila: {}", workerQueue);
        }
    }

    private boolean processTask(Task task) {
        try {
            logger.info("Processando tarefa genérica: {} (payload: {})", task.getId(), task.getPayload());
            // Simular processamento com 90% de sucesso
            return Math.random() > 0.1;
        } catch (Exception e) {
            logger.error("Erro ao processar tarefa", e);
            return false;
        }
    }
}
