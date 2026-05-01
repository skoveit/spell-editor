package main

import (
	"fmt"
	"log"
	"net/http"

	"spell-checker/handler"
	"spell-checker/spellcheck"
)

func main() {
	dict, err := spellcheck.LoadDictionary("dict/words.txt")
	if err != nil {
		log.Fatalf("Failed to load dictionary: %v", err)
	}
	
	checker := spellcheck.NewChecker(dict)
	spellHandler := handler.NewSpellHandler(checker)
	
	http.HandleFunc("/api/check", spellHandler.HandleCheck)
	http.Handle("/", http.FileServer(http.Dir("web")))
	
	fmt.Println("Loaded dictionary. Started server on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}