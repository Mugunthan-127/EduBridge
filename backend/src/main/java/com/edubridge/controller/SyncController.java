package com.edubridge.controller;

import com.edubridge.model.QuizAttempt;
import com.edubridge.model.MasteryStatus;
import com.edubridge.repository.QuizAttemptRepository;
import com.edubridge.repository.MasteryStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    @Autowired
    private QuizAttemptRepository quizAttemptRepository;

    @Autowired
    private MasteryStatusRepository masteryStatusRepository;

    /**
     * Synchronizes a student's quiz attempt.
     * Enforces idempotency via the client-generated unique syncUuid.
     *
     * Both /quiz-attempt (legacy) and /quiz-attempts (Core.zip contract) are mapped
     * to the same handler — clients can use either form.
     */
    @PostMapping({"/quiz-attempt", "/quiz-attempts"})
    public ResponseEntity<?> syncQuizAttempt(@RequestBody QuizAttempt attempt) {
        if (attempt.getSyncUuid() == null) {
            return ResponseEntity.badRequest().body("Error: syncUuid is required for deduplication.");
        }

        // Idempotency check: prevent duplicate grading record inserts
        if (quizAttemptRepository.existsBySyncUuid(attempt.getSyncUuid())) {
            return ResponseEntity.ok("Duplicate sync detected: Quiz attempt was already synchronized.");
        }

        QuizAttempt savedAttempt = quizAttemptRepository.save(attempt);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedAttempt);
    }

    /**
     * Synchronizes a student's BKT mastery probability score.
     * Resolves write conflicts using a timestamp-based Last-Write-Wins (LWW) strategy.
     */
    @PostMapping("/mastery")
    public ResponseEntity<?> syncMasteryStatus(@RequestBody MasteryStatus status) {
        Optional<MasteryStatus> existingOpt = masteryStatusRepository.findByStudentIdAndSkillTag(
                status.getStudentId(), status.getSkillTag());

        if (existingOpt.isPresent()) {
            MasteryStatus existing = existingOpt.get();
            
            // Last-Write-Wins: check if the incoming update is newer than what we store
            if (status.getLastUpdatedTimestamp() > existing.getLastUpdatedTimestamp()) {
                existing.setMasteryProbability(status.getMasteryProbability());
                existing.setLastUpdatedTimestamp(status.getLastUpdatedTimestamp());
                masteryStatusRepository.save(existing);
                return ResponseEntity.ok("Conflict resolved: client write accepted (client data is newer).");
            } else {
                return ResponseEntity.ok("Conflict resolved: client write skipped (server data is newer).");
            }
        } else {
            MasteryStatus savedStatus = masteryStatusRepository.save(status);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedStatus);
        }
    }
}
