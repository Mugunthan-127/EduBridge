document.addEventListener("DOMContentLoaded", function() {
    // Gamification Widget Logic
    var gamificationHeader = document.getElementById('edubridge-gamification-header');
    var gamificationBody = document.getElementById('edubridge-gamification-body');
    if (gamificationHeader && gamificationBody) {
        gamificationHeader.addEventListener('click', function() {
            gamificationBody.style.display = gamificationBody.style.display === 'none' ? 'flex' : 'none';
        });
    }

    // AI Co-Pilot Logic
    var aiHeader = document.getElementById('edubridge-ai-header');
    var aiBody = document.getElementById('edubridge-ai-body');
    if (aiHeader && aiBody) {
        aiHeader.addEventListener('click', function() {
            aiBody.style.display = aiBody.style.display === 'none' ? 'flex' : 'none';
        });
    }

    var aiInput = document.getElementById('edubridge-ai-input');
    var aiSendBtn = document.getElementById('edubridge-ai-send-btn');
    var messages = document.getElementById('edubridge-ai-messages');

    function sendAiMessage() {
        if (!aiInput) return;
        var text = aiInput.value.trim();
        if (!text) return;
        
        messages.innerHTML += '<div style="margin-top: 8px; text-align: right; color: #4368F5;"><strong>You:</strong> ' + text + '</div>';
        aiInput.value = '';
        messages.scrollTop = messages.scrollHeight;
        
        fetch('/api/edubridge_ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var response = (data.response || data.error).replace(/\n/g, '<br>');
            messages.innerHTML += '<div style="margin-top: 8px; color: #333;"><strong>AI:</strong> ' + response + '</div>';
            messages.scrollTop = messages.scrollHeight;
        })
        .catch(function(err) {
            messages.innerHTML += '<div style="margin-top: 8px; color: red;"><strong>AI Error:</strong> Could not connect to AI.</div>';
        });
    }

    if (aiSendBtn) {
        aiSendBtn.addEventListener('click', sendAiMessage);
    }
    
    if (aiInput) {
        aiInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                sendAiMessage();
            }
        });
    }
});
