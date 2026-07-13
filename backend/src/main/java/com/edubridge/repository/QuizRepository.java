package com.edubridge.repository;

import com.edubridge.model.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, Long> {
    List<Quiz> findByModuleId(Long moduleId);
    List<Quiz> findBySkillTag(String skillTag);
}
