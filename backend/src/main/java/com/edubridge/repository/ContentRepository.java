package com.edubridge.repository;

import com.edubridge.model.Content;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContentRepository extends JpaRepository<Content, Long> {
    List<Content> findByModuleId(Long moduleId);
    List<Content> findBySkillTag(String skillTag);
}
