package com.edubridge.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Multi-tenant School entity.
 * SRS v2 §10 — Zero-Investment Deployment Architecture (multi-tenant isolation).
 *
 * Each school maps to a unique tenantId that threads through:
 *   User.tenantId → Course.tenantId → TenantContext → JWT claims
 *
 * tenantId is kept as a plain String on User for backward compatibility.
 * This entity is the authoritative source for school metadata and quota tracking.
 */
@Entity
@Table(name = "schools", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"tenant_id"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class School {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Globally unique school identifier — matches User.tenantId and Course.tenantId.
     * Format: "school-<slug>" (e.g. "school-gps-vellore-1")
     */
    @Column(name = "tenant_id", nullable = false, unique = true, length = 64)
    private String tenantId;

    @Column(nullable = false)
    private String name;

    @Column
    private String district;

    @Column
    private String state;

    /**
     * Whether this school is on the free tier.
     * Free-tier schools are subject to Render/Supabase quota limits described in SRS v2 §10.
     */
    @Builder.Default
    @Column(nullable = false)
    private boolean freeQuota = true;

    /**
     * Contact email for the school admin (used for quota alerts, not SMS).
     */
    @Column
    private String adminEmail;

    @Column(nullable = false)
    private Long createdAt;

    @PrePersist
    protected void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = System.currentTimeMillis();
        }
    }
}
