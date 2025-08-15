// Quotes array with objects containing text and category properties
const quotes = [
  { text: "The best way to get started is to quit talking and begin doing.", category: "Motivation" },
  { text: "Life is what happens when you're busy making other plans.", category: "Life" },
  { text: "Do not let what you cannot do interfere with what you can do.", category: "Inspiration" }
];

// Function to display a random quote
function displayRandomQuote() {
  const quoteDisplay = document.getElementById("quoteDisplay");
  quoteDisplay.innerHTML = ""; // Clear old quote

  const randomIndex = Math.floor(Math.random() * quotes.length);
  const randomQuote = quotes[randomIndex];

  const quoteText = document.createElement("p");
  quoteText.textContent = `"${randomQuote.text}"`;

  const quoteCategory = document.createElement("small");
  quoteCategory.textContent = ` - Category: ${randomQuote.category}`;

  quoteDisplay.appendChild(quoteText);
  quoteDisplay.appendChild(quoteCategory);
}

// Function to add a new quote
function addQuote() {
  const textInput = document.getElementById("newQuoteText");
  const categoryInput = document.getElementById("newQuoteCategory");

  const newQuoteText = textInput.value.trim();
  const newQuoteCategory = categoryInput.value.trim();

  if (newQuoteText && newQuoteCategory) {
    quotes.push({ text: newQuoteText, category: newQuoteCategory });
    textInput.value = "";
    categoryInput.value = "";
    displayRandomQuote(); // Update DOM with the new quote
  }
}

// Event listener for "Show New Quote" button
document.getElementById("newQuote").addEventListener("click", displayRandomQuote);
