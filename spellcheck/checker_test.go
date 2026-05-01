package spellcheck

import (
	"testing"
)

func TestChecker(t *testing.T) {
	dict := &Dictionary{
		words: map[string]bool{
			"hello":   true,
			"world":   true,
			"testing": true,
		},
	}
	checker := NewChecker(dict)

	t.Run("Known word should be known", func(t *testing.T) {
		if !checker.IsKnown("hello") {
			t.Errorf("Expected 'hello' to be known")
		}
	})

	t.Run("Unknown word with distance 1", func(t *testing.T) {
		sugg := checker.GetSuggestions("helo") // missing 'l'
		found := false
		for _, s := range sugg {
			if s == "hello" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected 'hello' in suggestions, got %v", sugg)
		}
	})

	t.Run("Unknown word with distance 2", func(t *testing.T) {
		sugg := checker.GetSuggestions("heo") // missing 'l' and 'l'
		found := false
		for _, s := range sugg {
			if s == "hello" {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected 'hello' in suggestions, got %v", sugg)
		}
	})

	t.Run("Unknown word no suggestions", func(t *testing.T) {
		sugg := checker.GetSuggestions("xyzabc")
		if len(sugg) != 0 {
			t.Errorf("Expected no suggestions, got %v", sugg)
		}
	})
}
