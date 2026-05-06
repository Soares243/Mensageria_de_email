package br.unissales.demo.DTO;

import java.util.Map;

public record CreateTaskRequest(String queueName, Map<String, Object> payload) {
}
