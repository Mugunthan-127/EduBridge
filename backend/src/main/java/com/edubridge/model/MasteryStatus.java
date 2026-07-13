package com.edubridge.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "mastery_statuses",
       uniqueConstraints = {@UniqueConstraint(columnNames = {"student_id", "skillTag"})})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MasteryStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(nullable = false)
    private String skillTag;

    @Column(nullable = false)
    private double masteryProbability;

    @Column(nullable = false)
    private Long lastUpdatedTimestamp;
}
