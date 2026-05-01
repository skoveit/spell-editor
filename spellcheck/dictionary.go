package spellcheck

import (
	"bufio"
	"os"
	"strings"
)

type Dictionary struct {
	words map[string]bool
}

func LoadDictionary(path string) (*Dictionary, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	dict := &Dictionary{
		words: make(map[string]bool),
	}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		word := strings.ToLower(strings.TrimSpace(scanner.Text()))
		if len(word) > 0 {
			dict.words[word] = true
		}
	}
	return dict, scanner.Err()
}

func (d *Dictionary) IsKnown(word string) bool {
	return d.words[strings.ToLower(word)]
}
