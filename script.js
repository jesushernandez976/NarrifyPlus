let currentText = '';
let currentPosition = 0;
let utterance = null;
let isPaused = false;
let voices = [];

// Initialize voices
function loadVoices() {
  voices = speechSynthesis.getVoices();
  const voiceSelect = document.getElementById('voice-select');
  voiceSelect.innerHTML = ''; // Clear previous options

  // Filter voices to include only Microsoft voices
  voices = voices.filter(voice => voice.name.includes('Microsoft'));

  voices.forEach(voice => {
    const option = document.createElement('option');
    option.textContent = voice.name + ' (' + voice.lang + ')';
    option.setAttribute('data-lang', voice.lang);
    option.setAttribute('data-name', voice.name);
    voiceSelect.appendChild(option);
  });
}

// File Input Event Listener
document.getElementById('file-input').addEventListener('change', handleFileUpload);

// Load voices on window load and when the voices change
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) {
    if (file.type === 'application/pdf') {
      extractTextFromPDF(file);
    } else if (file.type.startsWith('image/')) {
      extractTextFromImage(file);
    }
  }
}

// Extract text from PDF
function extractTextFromPDF(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const typedarray = new Uint8Array(e.target.result);

    pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
      let text = '';
      let count = 0;
      
      // Extract text from each page
      const extractPageText = (pageNum) => {
        pdf.getPage(pageNum).then(function(page) {
          page.getTextContent().then(function(textContent) {
            text += textContent.items.map(item => item.str).join(' ') + '\n\n';
            count++;
            if (count < pdf.numPages) {
              extractPageText(pageNum + 1);
            } else {
              currentText = text;
              displayText(text);
            }
          });
        });
      };

      extractPageText(1);
    });
  };
  reader.readAsArrayBuffer(file);
}

// Extract text from Image (using Tesseract.js)
function extractTextFromImage(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      console.log("Image loaded successfully!");
      document.getElementById('progress').textContent = 'Starting OCR...';

      // Use Tesseract.js to extract text from the image
      Tesseract.recognize(
        img,
        'eng',
        {
          logger: (m) => {
            console.log('OCR Progress:', m); // Log OCR progress
            if (m.status === 'recognizing text') {
              document.getElementById('progress').textContent = `Processing: ${Math.round(m.progress * 100)}%`;
            }
          }
        }
      ).then(({ data: { text } }) => {
        console.log("OCR Completed!");
        currentText = text;
        displayText(text);
      }).catch((err) => {
        console.error('Error during OCR processing:', err);
        displayText('Error extracting text. Please try again with a clearer image.');
      });
    };

    img.onerror = function(err) {
      console.error("Image failed to load", err);
      displayText("Error loading image. Please try again.");
    };

    img.src = e.target.result; // Load the image as data URL
  };
  reader.readAsDataURL(file);
}

// Display extracted text
function displayText(text) {
  document.getElementById('text-output').textContent = text;
  document.getElementById('speak-btn').disabled = false;
  document.getElementById('pause-btn').disabled = false;
  document.getElementById('rest-btn').disabled = false;
  document.getElementById('progress').textContent = '';
}

// Read extracted text aloud
document.getElementById('speak-btn').addEventListener('click', function() {
  const selectedVoice = document.getElementById('voice-select').selectedOptions[0].getAttribute('data-name');
  const voice = voices.find(v => v.name === selectedVoice);
  
  if (isPaused) {
    speechSynthesis.resume();
    isPaused = false;
  } else {
    utterance = new SpeechSynthesisUtterance(currentText);
    utterance.voice = voice;

    // Set the rate for slower speech
    utterance.rate = 0.8; // Lower than the default of 1 for slower speech
    
    utterance.onboundary = function(event) {
      currentPosition = event.charIndex;
    };

    utterance.onend = function() {
      currentPosition = 0;
    };

    // Speak the text
    speechSynthesis.speak(utterance);
  }
});

// Pause reading
document.getElementById('pause-btn').addEventListener('click', function() {
  speechSynthesis.pause();
  isPaused = true;
});

// Rest functionality (stop voice and reload page immediately)
document.getElementById('rest-btn').addEventListener('click', function() {
  // Stop any ongoing speech synthesis immediately
  speechSynthesis.cancel();
  
  // Add a small delay before reloading to ensure the speech stops fully
  setTimeout(function() {
    location.reload();  // Reload the page after stopping the speech
  }, 200);  // Delay in milliseconds (200ms delay)
});
