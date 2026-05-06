package br.unissales.demo.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unissales.demo.Entity.Task;
import br.unissales.demo.Repository.TaskRepository;

@Service
public class TaskService {

    @Autowired
    private TaskRepository repository;

    @Value("${app.max-retries:3}")
    private int maxRetries;

    public Task createTask(String queueName, Map<String, Object> payload) {
        Task task = new Task();
        task.setId(UUID.randomUUID());
        task.setQueueName(queueName);
        task.setPayload(payload);
        task.setStatus("pending");
        task.setAttempts(0);
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        return repository.save(task);
    }

    public Task getById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task não encontrada"));
    }

    @Transactional
    public Task getNext(String queueName) {
        return repository.getNextTask(queueName);
    }

    @Transactional
    public Task updateStatus(UUID id, String newStatus) {
        Task task = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task não encontrada"));

        String currentStatus = task.getStatus();

        if ("error".equals(newStatus)) {
            task.setAttempts(task.getAttempts() + 1);

            // Se atingiu o limite de tentativas, marca como erro permanente
            if (task.getAttempts() >= maxRetries) {
                task.setStatus("error");
            } else {
                // Caso contrário, volta para pending para retry
                task.setStatus("pending");
            }
        } else {
            task.setStatus(newStatus);
        }

        task.setUpdatedAt(LocalDateTime.now());
        return repository.save(task);
    }

    public Map<String, Object> getStatistics() {
        List<Task> allTasks = repository.findAll();
        
        Map<String, Object> stats = new HashMap<>();
        Map<String, Map<String, Long>> queueStats = new HashMap<>();

        for (Task task : allTasks) {
            String queue = task.getQueueName();
            String status = task.getStatus();

            queueStats.putIfAbsent(queue, new HashMap<>());
            Map<String, Long> statusMap = queueStats.get(queue);
            statusMap.put(status, statusMap.getOrDefault(status, 0L) + 1);
        }

        stats.put("queues", queueStats);
        stats.put("total_tasks", allTasks.size());
        stats.put("timestamp", LocalDateTime.now());

        return stats;
    }
}
