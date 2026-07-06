package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func main() {
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODMzMDI1NTcsImlhdCI6MTc4MzIxNjE1Nywicm9sZSI6ImVkaXRvciIsInN1YiI6ImVkaXRvciJ9.LjmAkrq7WLlWm5Y3Rl-EFd-udmasUE4FAsxZCIoRHF0"
	
	body := map[string]interface{}{
		"feature_id": "test-1",
		"name":       "Test Building",
		"properties": map[string]interface{}{
			"height": 50,
			"floors": 12,
		},
		"geometry": map[string]interface{}{
			"type": "Point",
			"coordinates": []float64{30.3, 59.9},
		},
	}

	jsonBody, _ := json.Marshal(body)
	
	req, _ := http.NewRequest("POST", "http://localhost:8080/api/v1/admin/layers/buildings/features", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()
	
	respBody, _ := io.ReadAll(resp.Body)
	fmt.Println("Status:", resp.Status)
	fmt.Println("Body:", string(respBody))
}