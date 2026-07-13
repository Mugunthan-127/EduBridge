package com.edubridge.repository;

import com.edubridge.model.Role;
import com.edubridge.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    List<User> findByTenantId(String tenantId);
    List<User> findByTenantIdAndRole(String tenantId, Role role);
    List<User> findByParentId(Long parentId);
}
