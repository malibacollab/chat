const socket = io();

const nameContainer = document.getElementById('name-container');
const chatContainer = document.getElementById('chat-container');
const nameInput = document.getElementById('name-input');
const joinButton = document.getElementById('join-button');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const imageInput = document.getElementById('image-input');
const imageButton = document.getElementById('image-button');
const voiceButton = document.getElementById('voice-button');
const messages = document.getElementById('messages');

let currentUserId = null;
let mediaRecorder = null;
let audioChunks = [];
let selectedUser = null; // Track the selected user for private chat

// Add user list container
const userList = document.createElement('div');
userList.id = 'user-list';
chatContainer.insertBefore(userList, messages);

// Handle joining the chat
joinButton.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (name) {
    socket.emit('join', name);
    nameContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    currentUserId = socket.id;
  } else {
    alert('Please enter a valid name');
  }
});

// Update user list
socket.on('user list', (users) => {
  userList.innerHTML = '';
  users.forEach(user => {
    if (user !== nameInput.value.trim()) { // Exclude the current user
      const userElement = document.createElement('div');
      userElement.textContent = user;
      userElement.classList.add('user');
      userElement.addEventListener('click', () => {
        selectedUser = user;
        alert(`Now chatting with ${user}`);
      });
      userList.appendChild(userElement);
    }
  });
});

// Send private text message
sendButton.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (message && selectedUser) {
    socket.emit('private message', { target: selectedUser, content: message });
    messageInput.value = '';
  } else {
    alert('Please select a user to chat with or enter a message');
  }
});

// Send private image
imageButton.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (file && file.type.startsWith('image/') && selectedUser) {
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('private message', {
        target: selectedUser,
        mediaType: 'image',
        mediaData: reader.result
      });
    };
    reader.readAsDataURL(file);
    imageInput.value = '';
  } else {
    alert('Please select a user and a valid image');
  }
});

// Send private voice note
voiceButton.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (selectedUser) {
            socket.emit('private message', {
              target: selectedUser,
              mediaType: 'voice',
              mediaData: reader.result
            });
          } else {
            alert('Please select a user to send the voice note');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      voiceButton.classList.add('recording');
      voiceButton.textContent = '⏹️';
    } catch (err) {
      alert('Microphone access denied or not available');
    }
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    voiceButton.classList.remove('recording');
    voiceButton.textContent = '🎤';
  }
});

// Display messages
socket.on('chat message', (msg) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');

  if (msg.type === 'system') {
    messageElement.classList.add('system');
    messageElement.textContent = msg.content;
  } else {
    messageElement.classList.add(msg.senderId === socket.id ? 'sent' : 'received');

    const nameElement = document.createElement('div');
    nameElement.classList.add('message-name');
    nameElement.textContent = msg.name;

    const contentElement = document.createElement('div');
    contentElement.classList.add(msg.mediaType ? 'message-voice' : 'message-bubble');

    if (msg.mediaType === 'image') {
      const img = document.createElement('img');
      img.src = msg.mediaData;
      img.classList.add('message-image');
      contentElement.appendChild(img);
    } else if (msg.mediaType === 'voice') {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = msg.mediaData;
      contentElement.appendChild(audio);
    } else {
      contentElement.textContent = msg.content;
    }

    const timeElement = document.createElement('div');
    timeElement.classList.add('message-time');
    const date = new Date(msg.timestamp);
    timeElement.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.appendChild(nameElement);
    messageElement.appendChild(contentElement);
    messageElement.appendChild(timeElement);
  }

  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
});

// Handle errors
socket.on('error', (msg) => {
  alert(msg);
});

// Handle Enter key for input fields
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
});

nameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinButton.click();
  }
});

socket.on('connect', () => {
  currentUserId = socket.id;
});