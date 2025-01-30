let currentText = '';
let currentPosition = 0;
let utterance = null;
let isPaused = false;
let voices = [];

document.getElementById('file-input').addEventListener('change', handleFileUpload);

// Initialize voices
function loadVoices() {
    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        voiceSelect.innerHTML = ''; // Clear previous options
        voices = voices.filter(voice => voice.name.includes('Microsoft'));

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = voice.name + ' (' + voice.lang + ')';
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            voiceSelect.appendChild(option);
        });
    }
}

window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        showAlert();

        if (file.type === 'application/pdf') {
            extractTextFromPDF(file);
        } else if (file.type.startsWith('image/')) {
            extractTextFromImage(file);
        }
    }
}

// Function to show the alert
function showAlert() {
    var alert = document.getElementById('alert');
    if (alert) {
        alert.style.display = 'block'; // Make it visible
        alert.classList.add('show'); // Add Bootstrap show class

        // Ensure alert closes when "X" is clicked
        alert.querySelector('.btn-close').addEventListener('click', function () {
            alert.style.display = 'none';
        });
    }
}

// Extract text from PDF
function extractTextFromPDF(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const typedarray = new Uint8Array(e.target.result);
        pdfjsLib.getDocument(typedarray).promise.then(function (pdf) {
            let text = '';
            let count = 0;

            const extractPageText = (pageNum) => {
                pdf.getPage(pageNum).then(function (page) {
                    page.getTextContent().then(function (textContent) {
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
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            document.getElementById('progress').textContent = 'Starting OCR...';

            Tesseract.recognize(img, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        document.getElementById('progress').textContent = `Processing: ${Math.round(m.progress * 100)}%`;
                    }
                }
            }).then(({ data: { text } }) => {
                currentText = text;
                displayText(text);
            }).catch((err) => {
                console.error('Error during OCR:', err);
                displayText('Error extracting text. Please try again.');
            });
        };

        img.onerror = function () {
            displayText("Error loading image.");
        };

        img.src = e.target.result;
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
document.getElementById('speak-btn').addEventListener('click', function () {
    const selectedVoice = document.getElementById('voice-select')?.selectedOptions[0]?.getAttribute('data-name');
    const voice = voices.find(v => v.name === selectedVoice);

    if (isPaused) {
        speechSynthesis.resume();
        isPaused = false;
    } else {
        utterance = new SpeechSynthesisUtterance(currentText);
        if (voice) utterance.voice = voice;
        utterance.rate = 0.8;

        utterance.onboundary = function (event) {
            currentPosition = event.charIndex;
        };

        utterance.onend = function () {
            currentPosition = 0;
        };

        speechSynthesis.speak(utterance);
    }
});

// Pause reading
document.getElementById('pause-btn').addEventListener('click', function () {
    speechSynthesis.pause();
    isPaused = true;
});

// Reset functionality (stop voice and reload page)
document.getElementById('rest-btn').addEventListener('click', function () {
    speechSynthesis.cancel();
    setTimeout(() => location.reload(), 200);
});
