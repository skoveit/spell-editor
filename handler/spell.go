package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"spell-checker/spellcheck"
)

type SpellHandler struct {
	checker *spellcheck.Checker
}

func NewSpellHandler(checker *spellcheck.Checker) *SpellHandler {
	return &SpellHandler{checker: checker}
}

type CheckRequest struct {
	Text string `json:"text"`
}

type SpellingError struct {
	Word        string   `json:"word"`
	Offset      int      `json:"offset"`
	Length      int      `json:"length"`
	Suggestions []string `json:"suggestions"`
}

type CheckResponse struct {
	Errors []SpellingError `json:"errors"`
}

func findWords(text string) [][]int {
	var matches [][]int
	start := -1

	for i, r := range text {
		isLetter := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
		isUpper := r >= 'A' && r <= 'Z'

		if !isLetter {
			if start != -1 {
				matches = append(matches, []int{start, i})
				start = -1
			}
		} else {
			if start == -1 {
				start = i
			} else {
				prev := text[i-1]
				prevIsLower := prev >= 'a' && prev <= 'z'
				prevIsUpper := prev >= 'A' && prev <= 'Z'

				if prevIsLower && isUpper {
					// camelCase -> camel, Case
					matches = append(matches, []int{start, i})
					start = i
				} else if prevIsUpper && isUpper && i+1 < len(text) {
					next := text[i+1]
					nextIsLower := next >= 'a' && next <= 'z'
					if nextIsLower {
						// XMLHttp -> XML, Http
						matches = append(matches, []int{start, i})
						start = i
					}
				}
			}
		}
	}
	if start != -1 {
		matches = append(matches, []int{start, len(text)})
	}
	return matches
}

func (h *SpellHandler) HandleCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	resp := CheckResponse{
		Errors: make([]SpellingError, 0),
	}

	matches := findWords(req.Text)

	for _, match := range matches {
		start := match[0]
		end := match[1]
		word := req.Text[start:end]
		lowerWord := strings.ToLower(word)

		if !h.checker.IsKnown(lowerWord) {
			suggestions := h.checker.GetSuggestions(lowerWord)
			if suggestions == nil {
				suggestions = []string{} // prevent null in json
			}
			resp.Errors = append(resp.Errors, SpellingError{
				Word:        word,
				Offset:      start,
				Length:      len(word),
				Suggestions: suggestions,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
