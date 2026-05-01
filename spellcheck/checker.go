package spellcheck

import "strings"

const alphabet = "abcdefghijklmnopqrstuvwxyz"

type Checker struct {
	dict *Dictionary
}

func NewChecker(dict *Dictionary) *Checker {
	return &Checker{dict: dict}
}

func (c *Checker) IsKnown(word string) bool {
	return c.dict.IsKnown(word)
}

func edits1(word string) []string {
	var result []string
	wordLen := len(word)

	// deletions
	for i := 0; i < wordLen; i++ {
		result = append(result, word[:i]+word[i+1:])
	}
	// transpositions
	for i := 0; i < wordLen-1; i++ {
		result = append(result, word[:i]+string(word[i+1])+string(word[i])+word[i+2:])
	}
	// replacements
	for i := 0; i < wordLen; i++ {
		for _, c := range alphabet {
			result = append(result, word[:i]+string(c)+word[i+1:])
		}
	}
	// insertions
	for i := 0; i <= wordLen; i++ {
		for _, c := range alphabet {
			result = append(result, word[:i]+string(c)+word[i:])
		}
	}
	return result
}

func (c *Checker) known(words []string) []string {
	var result []string
	seen := make(map[string]bool)
	for _, w := range words {
		if c.dict.IsKnown(w) && !seen[w] {
			seen[w] = true
			result = append(result, w)
		}
	}
	return result
}

func (c *Checker) GetSuggestions(word string) []string {
	word = strings.ToLower(word)

	e1 := edits1(word)
	k1 := c.known(e1)
	if len(k1) > 0 {
		if len(k1) > 5 {
			return k1[:5]
		}
		return k1
	}

	var e2 []string
	for _, e := range e1 {
		e2 = append(e2, edits1(e)...)
	}
	k2 := c.known(e2)
	if len(k2) > 0 {
		if len(k2) > 5 {
			return k2[:5]
		}
		return k2
	}

	return []string{}
}
