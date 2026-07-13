package com.edubridge.repository;

import com.edubridge.model.MasteryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MasteryStatusRepository extends JpaRepository<MasteryStatus, Long> {
    List<MasteryStatus> findByStudentId(Long studentId);
    Optional<MasteryStatus> findByStudentIdAndSkillTag(Long studentId, String skillTag);
}
