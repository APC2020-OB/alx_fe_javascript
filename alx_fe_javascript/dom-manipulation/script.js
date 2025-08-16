// Global quotes array
let quotes = [];

// Load quotes from local storage when the app starts
function loadQuotes() {
  const storedQuotes = localStorage.getItem("quotes");
  if (storedQuotes) {
    quotes = JSON.parse(storedQuotes);
  } else {
    // Default quotes if none are saved
    quotes = [
      { text: "The best way to get started is to quit talking and begin doing.", author: "Walt Disney" },
      { text: "Don’t let yesterday take up too much of today.", author: "Will Rogers" },
      { text: "It’s not whether you get knocked down, it’s whether you get up.", author: "Vince Lombardi" }
    ];
    saveQuotes();
  }
}

// Save quotes array to local storage
function saveQuotes() {
  localStorage.setItem("quotes", JSON.stringify(quotes));
}

// Display a random quote
function generateQuote() {
  if (quotes.length === 0) return;
  const index = Math.floor(Math.random() * quotes.length);
  const quote = quotes[index];

  document.getElementById("quoteDisplay").textContent = quote.text;
  document.getElementById("authorDisplay").textContent = `- ${quote.author}`;

  // Save last viewed quote in session storage
  sessionStorage.setItem("lastQuote", index);
}

// Add a new quote
function addQuote() {
  const text = document.getElementById("newQuoteText").value.trim();
  const author = document.getElementById("newQuoteAuthor").value.trim();

  if (text === "" || author === "") {
    alert("Please enter both a quote and an author.");
    return;
  }

  quotes.push({ text, author });
  saveQuotes();

  document.getElementById("newQuoteText").value = "";
  document.getElementById("newQuoteAuthor").value = "";

  alert("Quote added successfully!");
}

// Export quotes to a JSON file
function exportToJsonFile() {
  const jsonData = JSON.stringify(quotes, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "quotes.json";
  a.click();

  URL.revokeObjectURL(url);
}

// Import quotes from a JSON file
function importFromJsonFile(event) {
  const fileReader = new FileReader();
  fileReader.onload = function(e) {
    try {
      const importedQuotes = JSON.parse(e.target.result);
      if (Array.isArray(importedQuotes)) {
        quotes.push(...importedQuotes);
        saveQuotes();
        alert("Quotes imported successfully!");
      } else {
        alert("Invalid file format. Please upload a valid JSON file.");
      }
    } catch (error) {
      alert("Error reading file: " + error);
    }
  };
  fileReader.readAsText(event.target.files[0]);
}

// Initialize app
loadQuotes();

// Restore last viewed quote from session storage
const lastViewed = sessionStorage.getItem("lastQuote");
if (lastViewed !== null && quotes[lastViewed]) {
  const quote = quotes[lastViewed];
  document.getElementById("quoteDisplay").textContent = quote.text;
  document.getElementById("authorDisplay").textContent = `- ${quote.author}`;
}
