package com.edubridge.controller;

import com.edubridge.model.Role;
import com.edubridge.model.User;
import com.edubridge.repository.UserRepository;
import com.edubridge.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest registerRequest) {
        if (userRepository.findByUsername(registerRequest.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("Error: Username is already taken!");
        }

        // Create new user's account
        User user = User.builder()
                .username(registerRequest.getUsername())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .fullName(registerRequest.getFullName())
                .role(Role.valueOf(registerRequest.getRole().toUpperCase()))
                .tenantId(registerRequest.getTenantId())
                .parentPhone(registerRequest.getParentPhone())
                .parentId(registerRequest.getParentId())
                .email(registerRequest.getEmail())
                .build();

        userRepository.save(user);

        return ResponseEntity.ok("User registered successfully!");
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.getUsername(),
                        loginRequest.getPassword()
                )
        );

        Optional<User> userOpt = userRepository.findByUsername(loginRequest.getUsername());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Error: Authentication failed!");
        }

        User user = userOpt.get();
        String jwt = tokenProvider.generateToken(authentication, user.getTenantId(), user.getId(), user.getRole().name());

        return ResponseEntity.ok(new JwtAuthenticationResponse(jwt, user.getId(), user.getUsername(), user.getFullName(), user.getRole().name(), user.getTenantId()));
    }

    // Requests and Responses DTOs
    public static class LoginRequest {
        private String username;
        private String password;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class RegisterRequest {
        private String username;
        private String password;
        private String fullName;
        private String role;
        private String tenantId;
        private String parentPhone;
        private Long parentId;
        private String email;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getTenantId() { return tenantId; }
        public void setTenantId(String tenantId) { this.tenantId = tenantId; }
        public String getParentPhone() { return parentPhone; }
        public void setParentPhone(String parentPhone) { this.parentPhone = parentPhone; }
        public Long getParentId() { return parentId; }
        public void setParentId(Long parentId) { this.parentId = parentId; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
    }

    public static class JwtAuthenticationResponse {
        private String accessToken;
        private String tokenType = "Bearer";
        private Long userId;
        private String username;
        private String fullName;
        private String role;
        private String tenantId;

        public JwtAuthenticationResponse(String accessToken, Long userId, String username, String fullName, String role, String tenantId) {
            this.accessToken = accessToken;
            this.userId = userId;
            this.username = username;
            this.fullName = fullName;
            this.role = role;
            this.tenantId = tenantId;
        }

        public String getAccessToken() { return accessToken; }
        public String getTokenType() { return tokenType; }
        public Long getUserId() { return userId; }
        public String getUsername() { return username; }
        public String getFullName() { return fullName; }
        public String getRole() { return role; }
        public String getTenantId() { return tenantId; }
    }
}
