package com.edubridge.controller;

import com.edubridge.model.Quiz;
import com.edubridge.repository.QuizRepository;
import com.edubridge.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    @Autowired
    private GeminiService geminiService;

    @Autowired
    private QuizRepository quizRepository;

    public static class QuizGenerateRequest {
        private String prompt;
        private Long moduleId;
        private String skillTag;

        public String getPrompt() { return prompt; }
        public void setPrompt(String prompt) { this.prompt = prompt; }
        public Long getModuleId() { return moduleId; }
        public void setModuleId(Long moduleId) { this.moduleId = moduleId; }
        public String getSkillTag() { return skillTag; }
        public void setSkillTag(String skillTag) { this.skillTag = skillTag; }
    }

    /**
     * Endpoint to dynamically generate quizzes via Gemini API.
     * Accessible only by instructors and administrators.
     */
    @PostMapping("/generate-quiz")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN')")
    public ResponseEntity<?> generateQuiz(@RequestBody QuizGenerateRequest request) {
        if (request.getModuleId() == null || request.getPrompt() == null || request.getSkillTag() == null) {
            return ResponseEntity.badRequest().body("Error: Missing required request parameters.");
        }

        try {
            // Generate MCQ question array from AI engine
            String questionsJson = geminiService.generateQuizQuestions(request.getPrompt(), request.getSkillTag());

            // Build new quiz entity mapping structure
            Quiz quiz = Quiz.builder()
                    .title("AI Generated: " + request.getPrompt())
                    .moduleId(request.getModuleId())
                    .skillTag(request.getSkillTag())
                    .questionsJson(questionsJson)
                    .totalPoints(3) // Default total point scale
                    .build();

            Quiz savedQuiz = quizRepository.save(quiz);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedQuiz);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("AI Generation failed: " + e.getMessage());
        }
    }
}
