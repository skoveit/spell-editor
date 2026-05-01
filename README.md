# spell

A lightweight, real-time spell checking web based text editor.

## Stack
- **API:** Go
- **UI:** HTML / CSS / Vanilla JS

## Get It Running

```bash
git clone https://github.com/skoveit/spell
cd spell
```

### Using Docker
```bash
docker build -t spell-editor .
docker run -p 8080:8080 spell-editor
```

### Local Setup
You just need Go 1.20+.
```bash
# pull the dictionary
curl -sSLko dict/words.txt https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt

go run main.go
```

Then head to `http://localhost:8080`.

## How It Works

**The engine:** Implemented Peter Norvig's spelling corrector. It generates all words 1 and 2 edit distances away from the misspelled word, then verifies them against an in-memory hash map. Fast, zero external dependencies, and virtually no memory overhead compared to ML/NLP models.

**The API:** Returns each error with its exact character offset and length, not just the word. The frontend uses this to highlight the precise position in the text without scanning for it.

**Single server:** Go serves both the API and the frontend. One command to run, no CORS issues, no separate frontend server.

## Key Decisions

**Hash map over a trie:** O(1) lookup per word. A trie would use less memory but adds implementation complexity that is not justified here.

**Custom tokenizer:** Explicitly breaks down camelCase expressions and splits around hyphens and underscores before checking. This extracts true English words and preserves the original character offsets so highlights stay accurate.

**No frameworks:** No React, no Gin, no Echo. Go's standard library handles the HTTP layer cleanly. A single `fetch()` call is all the frontend needs.

## What I Cut

**Rate limiting:** No rate limiting on the API. First thing to add in production.

**Suggestion caching:** The same misspelled word gets reprocessed on every request. A simple map cache would fix this.


## What's Next

**Frequency sorting:** Suggestions are valid words within edit distance but not ranked. A frequency map would surface better ones first. Norvig's full implementation includes this.

**Differential syncing:** Currently sends the full text block on debounce. Better to send only diffs for large documents.

**Context awareness:** A basic n-gram model to catch wrong-word errors like "their" vs "there."
