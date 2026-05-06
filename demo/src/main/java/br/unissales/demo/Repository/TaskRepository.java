package br.unissales.demo.Repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import br.unissales.demo.Entity.Task;

@Repository
public interface TaskRepository extends JpaRepository<Task, UUID> {

    @Query(value = """
        UPDATE tasks
        SET status = 'processing'
        WHERE id = (
            SELECT id FROM tasks
            WHERE queue_name = :queueName
            AND status = 'pending'
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING *
    """, nativeQuery = true)
    Task getNextTask(@Param("queueName") String queueName);
}