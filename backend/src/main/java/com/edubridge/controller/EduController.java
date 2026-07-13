package com.edubridge.controller;

import com.edubridge.model.Course;
import com.edubridge.model.Module;
import com.edubridge.model.Content;
import com.edubridge.model.Quiz;
import com.edubridge.repository.CourseRepository;
import com.edubridge.repository.ModuleRepository;
import com.edubridge.repository.ContentRepository;
import com.edubridge.repository.QuizRepository;
import com.edubridge.security.TenantContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class EduController {

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private ModuleRepository moduleRepository;

    @Autowired
    private ContentRepository contentRepository;

    @Autowired
    private QuizRepository quizRepository;

    // --- Course Endpoints ---

    @GetMapping("/courses")
    public ResponseEntity<List<Course>> getCourses() {
        String tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
        List<Course> courses = courseRepository.findByTenantId(tenantId);
        return ResponseEntity.ok(courses);
    }

    @PostMapping("/courses")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN')")
    public ResponseEntity<Course> createCourse(@RequestBody Course course) {
        String tenantId = TenantContext.getCurrentTenant();
        if (course.getTenantId() == null) {
            course.setTenantId(tenantId);
        }
        Course savedCourse = courseRepository.save(course);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedCourse);
    }

    // --- Module Endpoints ---

    @GetMapping("/courses/{courseId}/modules")
    public ResponseEntity<List<Module>> getModulesByCourse(@PathVariable Long courseId) {
        // Enforce that course belongs to tenant
        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        List<Module> modules = moduleRepository.findByCourseIdOrderBySequenceOrderAsc(courseId);
        return ResponseEntity.ok(modules);
    }

    @PostMapping("/modules")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN')")
    public ResponseEntity<Module> createModule(@RequestBody Module module) {
        // Verify course belongs to tenant
        Course course = courseRepository.findById(module.getCourseId()).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Module savedModule = moduleRepository.save(module);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedModule);
    }

    // --- Content Endpoints ---

    @GetMapping("/modules/{moduleId}/content")
    public ResponseEntity<List<Content>> getContentByModule(@PathVariable Long moduleId) {
        // Verify parent module/course belongs to tenant
        Module module = moduleRepository.findById(moduleId).orElse(null);
        if (module == null) {
            return ResponseEntity.notFound().build();
        }
        Course course = courseRepository.findById(module.getCourseId()).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Content> contents = contentRepository.findByModuleId(moduleId);
        return ResponseEntity.ok(contents);
    }

    @PostMapping("/content")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN')")
    public ResponseEntity<Content> createContent(@RequestBody Content content) {
        Module module = moduleRepository.findById(content.getModuleId()).orElse(null);
        if (module == null) {
            return ResponseEntity.badRequest().build();
        }
        Course course = courseRepository.findById(module.getCourseId()).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Content savedContent = contentRepository.save(content);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedContent);
    }

    // --- Quiz Endpoints ---

    @GetMapping("/modules/{moduleId}/quizzes")
    public ResponseEntity<List<Quiz>> getQuizzesByModule(@PathVariable Long moduleId) {
        Module module = moduleRepository.findById(moduleId).orElse(null);
        if (module == null) {
            return ResponseEntity.notFound().build();
        }
        Course course = courseRepository.findById(module.getCourseId()).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Quiz> quizzes = quizRepository.findByModuleId(moduleId);
        return ResponseEntity.ok(quizzes);
    }

    @PostMapping("/quizzes")
    @PreAuthorize("hasAnyRole('TEACHER', 'SCHOOL_ADMIN', 'DISTRICT_ADMIN')")
    public ResponseEntity<Quiz> createQuiz(@RequestBody Quiz quiz) {
        Module module = moduleRepository.findById(quiz.getModuleId()).orElse(null);
        if (module == null) {
            return ResponseEntity.badRequest().build();
        }
        Course course = courseRepository.findById(module.getCourseId()).orElse(null);
        if (course == null || !course.getTenantId().equals(TenantContext.getCurrentTenant())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Quiz savedQuiz = quizRepository.save(quiz);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedQuiz);
    }
}
