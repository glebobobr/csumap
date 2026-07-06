package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret"

func dummyHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func signToken(claims jwt.MapClaims) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte(testSecret))
	return signed
}

func TestMiddleware_MissingAuthHeader(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	if w.Body.String() != "missing authorization header\n" {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestMiddleware_InvalidAuthHeaderFormat(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "InvalidFormat")
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	if w.Body.String() != "invalid authorization header\n" {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestMiddleware_WrongTokenType(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMiddleware_ExpiredToken(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	tokenStr := signToken(jwt.MapClaims{
		"sub": "editor",
		"exp": time.Now().Add(-1 * time.Hour).Unix(),
	})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMiddleware_WrongSigningMethod(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "editor",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	tokenStr, _ := token.SignedString([]byte(testSecret))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestMiddleware_ValidToken_Passes(t *testing.T) {
	mw := NewAuthMiddleware(testSecret)
	tokenStr := signToken(jwt.MapClaims{
		"sub":  "editor",
		"role": "editor",
		"exp":  time.Now().Add(1 * time.Hour).Unix(),
	})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	var capturedClaims jwt.MapClaims
	mw.JWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaims(r.Context())
		if ok {
			capturedClaims = claims
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if capturedClaims["sub"] != "editor" {
		t.Fatalf("expected sub=editor, got %v", capturedClaims["sub"])
	}
	if capturedClaims["role"] != "editor" {
		t.Fatalf("expected role=editor, got %v", capturedClaims["role"])
	}
}

func TestMiddleware_DifferentSecret_Fails(t *testing.T) {
	mw := NewAuthMiddleware("different-secret")
	tokenStr := signToken(jwt.MapClaims{
		"sub": "editor",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/features", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	mw.JWT(http.HandlerFunc(dummyHandler)).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestOptionalAuth_NoHeader_Passes(t *testing.T) {
	handler := OptionalAuth(testSecret)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/layers", nil)
	w := httptest.NewRecorder()

	handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestOptionalAuth_ValidToken_SetsClaims(t *testing.T) {
	handler := OptionalAuth(testSecret)
	tokenStr := signToken(jwt.MapClaims{
		"sub": "editor",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/layers", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()

	var capturedClaims jwt.MapClaims
	handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaims(r.Context())
		if ok {
			capturedClaims = claims
		}
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if capturedClaims["sub"] != "editor" {
		t.Fatalf("expected sub=editor, got %v", capturedClaims["sub"])
	}
}
