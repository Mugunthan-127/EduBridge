package com.edubridge.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "content_items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Content {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String contentType; // VIDEO, PDF, SLIDES, NOTES

    @Column(nullable = false)
    private String fileUrl;

    @Column(name = "module_id", nullable = false)
    private Long moduleId;

    // Used for BKT mastery mapping
    @Column(nullable = false)
    private String skillTag;

    // SHA-256 Checksum for mesh synchronization validation
    private String sha256Checksum;

    private Long fileSizeBytes;
}
