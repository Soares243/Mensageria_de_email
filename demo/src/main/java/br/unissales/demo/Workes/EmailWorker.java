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
public class EmailWorker {

    private static final Logger logger = LoggerFactory.getLogger(EmailWorker.class);

    @Autowired
    private RestTemplate restTemplate;

    @Value("${app.worker-queue:email}")
    private String workerQueue;

    @Value("${app.polling-interval:5000}")
    private long pollingInterval;

    private final String API_URL = "http://api:8080";
    private final String QUEUE_NAME = "email";

    @Scheduled(fixedDelayString = "${app.polling-interval:5000}")
    public void process() {
        // Processa apenas se configurado para essa fila
        if (!QUEUE_NAME.equals(workerQueue)) {
            return;
        }

        try {
            ResponseEntity<Task> response = restTemplate.getForEntity(
                    API_URL + "/tasks/next/" + QUEUE_NAME, Task.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Task task = response.getBody();
                logger.info("Processando tarefa de email: {}", task.getId());

                boolean success = sendEmail(task);

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
            logger.debug("Nenhuma tarefa disponível ou erro na requisição", e);
        }
    }

    private boolean sendEmail(Task task) {
        try {
            logger.info("Simulando envio de email para tarefa: {}", task.getId());
            // Simular processamento bem-sucedido (90% de chance)
            boolean success = Math.random() > 0.1;
            return success;
        } catch (Exception e) {
            logger.error("Erro ao processar email", e);
            return false;
        }
    }
}