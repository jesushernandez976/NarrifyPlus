
let currentText = '';
let currentPosition = 0;
let utterance = null;
let isPaused = false;
let voices = [];

document.getElementById('file-input').addEventListener('change', handleFileUpload);

function loadVoices() {
    voices = speechSynthesis.getVoices();
    const voiceSelect = document.getElementById('voice-select');
    if (voiceSelect) {
        voiceSelect.innerHTML = ''; 
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

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        showAlert();

        if (file.type === 'application/pdf') {
            extractTextFromPDF(file);
        } else if (file.type.startsWith('image/')) {
            if (file.name.endsWith('.heic') || file.type === 'image/heic') {
                convertHEICToImage(file);
            } else {
                extractTextFromImage(file);
            }
        }
    }
}

function showAlert() {
    var alert = document.getElementById('alert');
    if (alert) {
        alert.style.display = 'block'; 
        alert.classList.add('show');

        alert.querySelector('.btn-close').addEventListener('click', function () {
            alert.style.display = 'none';
        });
    }
}

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

function convertHEICToImage(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const heicData = e.target.result;

        // Convert the .HEIC file to a .JPG using heic2any
        heic2any({
            blob: new Blob([heicData], { type: 'image/heic' }),
            toType: 'image/jpeg',  // or 'image/png'
        }).then((convertedBlob) => {
            const img = new Image();
            img.onload = function () {
                document.getElementById('progress').textContent = 'Starting OCR...';

                // Perform OCR with Tesseract after conversion
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
                displayText("Error loading converted image.");
            };

            img.src = URL.createObjectURL(convertedBlob);  // Create URL for the converted image
        }).catch((error) => {
            console.error('Error converting HEIC:', error);
            displayText('Error converting HEIC file. Please try again.');
        });
    };
    reader.readAsArrayBuffer(file);
}

function displayText(text) {
    document.getElementById('text-output').textContent = text;
    enableButton('speak-btn');
    disableButton('pause-btn');
    enableButton('rest-btn');
    document.getElementById('progress').textContent = '';
}

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
            enableButton('speak-btn');
            disableButton('pause-btn');
        };

        speechSynthesis.speak(utterance);
    }

    disableButton('speak-btn');
    enableButton('pause-btn');
});

document.getElementById('pause-btn').addEventListener('click', function () {
    speechSynthesis.pause();
    isPaused = true;

    disableButton('pause-btn');
    enableButton('speak-btn');
});

document.getElementById('rest-btn').addEventListener('click', function () {
    speechSynthesis.cancel();
    setTimeout(() => location.reload(), 200);
});

function disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    button.disabled = true;
    button.classList.add('disabled-button'); // Add class to remove hover
}

function enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    button.disabled = false;
    button.classList.remove('disabled-button'); // Remove class when enabled
}