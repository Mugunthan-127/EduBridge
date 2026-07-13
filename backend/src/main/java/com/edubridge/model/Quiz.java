package com.edubridge.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "quizzes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Quiz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "module_id", nullable = false)
    private Long moduleId;

    // Maps to BKT skill category
    @Column(nullable = false)
    private String skillTag;

    // Stored as JSON string for easy offline transport and Dexie.js persistence
    @Column(columnDefinition = "TEXT", nullable = false)
    private String questionsJson;

    private int totalPoints;
}
