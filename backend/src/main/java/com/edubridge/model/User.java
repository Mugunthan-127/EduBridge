package com.edubridge.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // Multi-tenant isolation field: corresponds to School ID
    @Column(nullable = true)
    private String tenantId;

    // Used for student-parent mapping
    private Long parentId;

    // Used for parent contact notifications (SMS fallback)
    private String parentPhone;

    private String email;

    @Builder.Default
    private boolean active = true;
}
