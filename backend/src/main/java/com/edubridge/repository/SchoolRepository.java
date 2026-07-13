package com.edubridge.repository;

import com.edubridge.model.School;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface SchoolRepository extends JpaRepository<School, Long> {

    /** Look up a school by its tenantId — used in admin and provisioning flows. */
    Optional<School> findByTenantId(String tenantId);

    /** List all schools in a given district — useful for DistrictAdmin view. */
    List<School> findByDistrict(String district);

    /** List all free-quota schools — useful for quota monitoring. */
    List<School> findByFreeQuotaTrue();
}
