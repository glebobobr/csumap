package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"csumap/internal/config"
)

func TestAuthHandler_Login_Success(t *testing.T) {
	h := NewAuthHandler(&config.Config{
		JWT: config.JWTConfig{Secret: "test-secret"},
	})

	body := `{"password":"editor123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/token", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Login(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp LoginResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("expected non-empty token")
	}
}

func TestAuthHandler_Login_WrongPassword(t *testing.T) {
	h := NewAuthHandler(&config.Config{
		JWT: config.JWTConfig{Secret: "test-secret"},
	})

	body := `{"password":"wrong-pass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/token", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Login(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandler_Login_InvalidJSON(t *testing.T) {
	h := NewAuthHandler(&config.Config{
		JWT: config.JWTConfig{Secret: "test-secret"},
	})

	body := `not-json`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/token", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAuthHandler_Login_MissingPassword(t *testing.T) {
	h := NewAuthHandler(&config.Config{
		JWT: config.JWTConfig{Secret: "test-secret"},
	})

	body := `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/token", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Login(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}
