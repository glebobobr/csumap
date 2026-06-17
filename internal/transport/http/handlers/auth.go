package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"csumap/internal/config"
)

type AuthHandler struct {
	jwtSecret string
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{jwtSecret: cfg.JWT.Secret}
}

type LoginRequest struct {
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	log.Printf("Login request: method=%s, content-type=%s, content-length=%s", r.Method, r.Header.Get("Content-Type"), r.Header.Get("Content-Length"))
	body, _ := io.ReadAll(r.Body)
	log.Printf("Login request body: %s", string(body))
	
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	
	var req LoginRequest
	if err := json.Unmarshal(body, &req); err != nil {
		log.Printf("JSON decode error: %v", err)
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// Simple password check - in production use proper password hashing
	editorPassword := "editor123" // TODO: move to config
	if req.Password != editorPassword {
		respondError(w, http.StatusUnauthorized, fmt.Errorf("invalid password"))
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  "editor",
		"role": "editor",
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
	})

	tokenString, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusOK, LoginResponse{Token: tokenString})
}