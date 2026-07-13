package com.edubridge.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    @Value("${edubridge.gemini.key:}")
    private String geminiApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String generateQuizQuestions(String prompt, String skillTag) {
        if (geminiApiKey == null || geminiApiKey.isEmpty()) {
            // Return static mock data if no key configured, acting as developer simulation
            return getFallbackMockQuestions(skillTag);
        }

        String url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey;

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Construct system instruction prompting for strict JSON output format matching quiz schema
            String structuredPrompt = "Generate 3 multiple choice questions about: " + prompt + ". " +
                    "Return ONLY a raw JSON array matching this exact schema, with no markdown code fences: " +
                    "[{\"questionText\":\"Question text?\",\"choices\":[\"choice A\",\"choice B\",\"choice C\",\"choice D\"],\"correctAnswer\":0}]." +
                    "correctAnswer should be the 0-based index of the right option.";

            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", structuredPrompt);

            Map<String, Object> parts = new HashMap<>();
            parts.put("parts", List.of(textPart));

            Map<String, Object> contents = new HashMap<>();
            contents.put("contents", List.of(parts));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(contents, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> bodyMap = objectMapper.readValue(response.getBody(), Map.class);
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) bodyMap.get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
                    List<Map<String, Object>> partsList = (List<Map<String, Object>>) contentMap.get("parts");
                    if (partsList != null && !partsList.isEmpty()) {
                        String rawText = (String) partsList.get(0).get("text");
                        // Clean up markdown block if LLM returned it despite instruction
                        rawText = rawText.replaceAll("```json", "").replaceAll("```", "").trim();
                        return rawText;
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Gemini API call failed: " + e.getMessage());
        }

        return getFallbackMockQuestions(skillTag);
    }

    private String getFallbackMockQuestions(String skillTag) {
        return "[" +
                "{\"questionText\":\"What is the base unit of measurement for " + skillTag + "?\",\"choices\":[\"Joule\",\"Meter\",\"Gram\",\"Kelvin\"],\"correctAnswer\":1}," +
                "{\"questionText\":\"Which principle governs the mechanics of " + skillTag + "?\",\"choices\":[\"Snell's Law\",\"Newtonian Gravity\",\"Equilibrium Constants\",\"BKT Convergence\"],\"correctAnswer\":0}" +
                "]";
    }
}
