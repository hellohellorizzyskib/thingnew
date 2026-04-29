const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');
const LOGINS_FILE = path.join(__dirname, 'logins.json');
const BAN_FILE = path.join(__dirname, 'ban.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(POSTS_FILE)) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(LOGINS_FILE)) {
  fs.writeFileSync(LOGINS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(BAN_FILE)) {
  fs.writeFileSync(BAN_FILE, JSON.stringify([]));
}
if (!fs.existsSync(SESSIONS_FILE)) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/create-post', (req, res) => {
  res.sendFile(path.join(__dirname, 'create-post.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/posts', (req, res) => {
  fs.readFile(POSTS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    let posts = [];
    try {
      posts = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(posts);
  });
});

app.post('/posts', (req, res) => {
  const { username, content, mediaData, mediaType } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'You must be signed in to create a post' });
  }

  if (!content && !mediaData) {
    return res.status(400).json({ error: 'Post content or media is required' });
  }

  fs.readFile(USERS_FILE, 'utf8', (err, usersData) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    let users = [];
    try {
      users = JSON.parse(usersData);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }

    const user = users.find(user => user.username === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }

    fs.readFile(POSTS_FILE, 'utf8', (err, postsData) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      let posts = [];
      try {
        posts = JSON.parse(postsData);
      } catch (e) {
        return res.status(500).json({ error: 'Server error' });
      }

      const newPost = {
        id: Date.now(),
        username,
        nickname: user.nickname,
        content: content || '',
        mediaData: mediaData || null,
        mediaType: mediaType || null,
        createdAt: new Date().toISOString()
      };

      posts.unshift(newPost);

      fs.writeFile(POSTS_FILE, JSON.stringify(posts, null, 2), (err) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }
        res.json({ message: 'Post created successfully' });
      });
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress || 'unknown';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check if IP is banned
  fs.readFile(BAN_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    let bannedIps = [];
    try {
      bannedIps = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (bannedIps.includes(clientIp)) {
      return res.status(403).json({ error: 'Your IP has been banned' });
    }

    fs.readFile(USERS_FILE, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      let users = [];
      try {
        users = JSON.parse(data);
      } catch (e) {
        return res.status(500).json({ error: 'Server error' });
      }

      const user = users.find(user => user.username === username && user.password === password);
      if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }

      // Track login attempt and create session
      fs.readFile(LOGINS_FILE, 'utf8', (err, logData) => {
        let logins = [];
        if (!err) {
          try {
            logins = JSON.parse(logData);
          } catch (e) {
            logins = [];
          }
        }

        logins.push({
          username,
          ip: clientIp,
          timestamp: new Date().toISOString()
        });

        fs.writeFile(LOGINS_FILE, JSON.stringify(logins, null, 2), (err) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }

          // Create session
          fs.readFile(SESSIONS_FILE, 'utf8', (err, sessionData) => {
            let sessions = [];
            if (!err) {
              try {
                sessions = JSON.parse(sessionData);
              } catch (e) {
                sessions = [];
              }
            }

            sessions.push({
              username,
              ip: clientIp,
              loginTime: new Date().toISOString()
            });

            fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), (err) => {
              if (err) {
                return res.status(500).json({ error: 'Server error' });
              }
              res.json({ message: 'Login successful' });
            });
          });
        });
      });
    });
  });
});

app.post('/signup', (req, res) => {
  const { username, password, nickname } = req.body;

  if (!username || !password || !nickname) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  fs.readFile(USERS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    let users = [];
    try {
      users = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }

    // Check if username exists
    if (users.some(user => user.username === username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Add new user
    users.push({ username, password, nickname });

    fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: 'Signup successful' });
    });
  });
});

// Admin endpoints
app.get('/admin/logins', (req, res) => {
  fs.readFile(LOGINS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    let logins = [];
    try {
      logins = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(logins);
  });
});

app.get('/admin/bans', (req, res) => {
  fs.readFile(BAN_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    let bannedIps = [];
    try {
      bannedIps = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(bannedIps);
  });
});

app.post('/admin/ban', (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }

  fs.readFile(BAN_FILE, 'utf8', (err, data) => {
    let bannedIps = [];
    if (!err) {
      try {
        bannedIps = JSON.parse(data);
      } catch (e) {
        bannedIps = [];
      }
    }

    if (bannedIps.includes(ip)) {
      return res.status(400).json({ error: 'IP is already banned' });
    }

    bannedIps.push(ip);

    fs.writeFile(BAN_FILE, JSON.stringify(bannedIps, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: `IP ${ip} has been banned` });
    });
  });
});

app.post('/admin/unban', (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }

  fs.readFile(BAN_FILE, 'utf8', (err, data) => {
    let bannedIps = [];
    if (!err) {
      try {
        bannedIps = JSON.parse(data);
      } catch (e) {
        bannedIps = [];
      }
    }

    bannedIps = bannedIps.filter(bannedIp => bannedIp !== ip);

    fs.writeFile(BAN_FILE, JSON.stringify(bannedIps, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: `IP ${ip} has been unbanned` });
    });
  });
});

app.get('/admin/sessions', (req, res) => {
  fs.readFile(SESSIONS_FILE, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    let sessions = [];
    try {
      sessions = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(sessions);
  });
});

app.post('/logout', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  fs.readFile(SESSIONS_FILE, 'utf8', (err, data) => {
    let sessions = [];
    if (!err) {
      try {
        sessions = JSON.parse(data);
      } catch (e) {
        sessions = [];
      }
    }

    sessions = sessions.filter(session => session.username !== username);

    fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});