package com.edubridge.repository;

import com.edubridge.model.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findByStudentId(Long studentId);
    List<QuizAttempt> findByQuizId(Long quizId);
    Optional<QuizAttempt> findBySyncUuid(String syncUuid);
    boolean existsBySyncUuid(String syncUuid);
}
