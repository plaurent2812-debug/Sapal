"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { searchAutocomplete, type AutocompleteResult } from "@/lib/data";

export function SearchButton() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchAutocomplete(term, 6);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    fetchSuggestions(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);
    router.push(`/recherche?q=${encodeURIComponent(query.trim())}`);
  };

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 max-w-2xl mx-auto relative">
      <form
        role="search"
        aria-label="Recherche de produits"
        onSubmit={handleSubmit}
        className="flex items-center bg-white border-2 border-accent rounded-l-md rounded-r-md overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-transparent transition-all"
      >
        <input
          type="search"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Rechercher par référence ou mot-clé..."
          aria-label="Rechercher par référence ou mot-clé"
          autoComplete="off"
          className="flex-1 bg-transparent px-4 py-3 text-sm md:text-base outline-none placeholder:text-muted-foreground/80 text-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
            className="p-2 text-muted-foreground hover:bg-muted/30 cursor-pointer"
            aria-label="Effacer la recherche"
          >
            <X size={18} />
          </button>
        )}
        <button
          type="submit"
          className="bg-accent text-accent-foreground px-6 py-3 md:px-8 border-l border-accent cursor-pointer hover:bg-accent/90 transition-colors font-bold flex items-center gap-2 h-full"
          aria-label="Rechercher"
        >
          <Search size={22} />
          <span className="hidden md:inline">Rechercher</span>
        </button>
      </form>

      {/* Dropdown suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div role="listbox" className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden">
          {suggestions.map((s) => (
            <Link
              key={s.id}
              role="option"
              href={`/catalogue/${s.categorySlug}/${s.slug}`}
              onClick={() => setShowSuggestions(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border/20 last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">Réf. {s.reference}</p>
              </div>
              {s.price > 0 && (
                <p className="text-sm font-bold text-foreground whitespace-nowrap">
                  {s.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </p>
              )}
            </Link>
          ))}
          <Link
            href={`/recherche?q=${encodeURIComponent(query)}`}
            onClick={() => setShowSuggestions(false)}
            className="block px-4 py-2.5 text-center text-xs font-semibold text-accent hover:bg-accent/5 transition-colors"
          >
            Voir tous les résultats pour &quot;{query}&quot;
          </Link>
        </div>
      )}
    </div>
  );
}
